import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import * as functions from 'firebase-functions';
import { PrintJobInput, PrinterType, PrintJobStatus, PrintContent, ReceiptPrintData } from '../printing/types';
import { createPrintJob } from '../printing/handlers';

const logger = functions.logger;
const db = admin.firestore();

/**
 * 獲取指定分店的活躍訂單
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const getPosOrders = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理獲取POS訂單請求', { structuredData: true });
  
  try {
    // 1. 獲取並驗證路徑參數
    const { storeId } = req.params;
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：缺少店鋪ID',
      });
    }

    // 2. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('獲取POS訂單列表失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }

    // 3. 檢查租戶隔離及權限
    if (!user.tenantId) {
      logger.error('獲取POS訂單列表失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }

    // 4. 檢查店鋪是否存在
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) {
      logger.error('獲取POS訂單列表失敗: 店鋪不存在', { storeId });
      return res.status(404).json({
        success: false,
        message: '店鋪不存在',
      });
    }

    const storeData = storeDoc.data();
    // 確保店鋪屬於當前用戶的租戶
    if (storeData?.tenantId !== user.tenantId) {
      logger.error('獲取POS訂單列表失敗: 店鋪不屬於當前租戶', { 
        storeId, 
        storeTenantId: storeData?.tenantId, 
        userTenantId: user.tenantId 
      });
      return res.status(403).json({
        success: false,
        message: '沒有權限：店鋪不屬於當前租戶',
      });
    }

    // 5. 獲取查詢參數
    const status = req.query.status as string || 'active';
    const limit = parseInt(req.query.limit as string) || 50;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    // 6. 構建查詢
    let ordersQuery = db.collection('orders')
      .where('storeId', '==', storeId)
      .where('tenantId', '==', user.tenantId);

    // 根據status參數進行過濾
    if (status === 'active') {
      // 活躍訂單：confirmed, preparing, ready
      ordersQuery = db.collection('orders')
        .where('storeId', '==', storeId)
        .where('tenantId', '==', user.tenantId)
        .where('status', 'in', ['confirmed', 'preparing', 'ready']);
    } else if (status !== 'all') {
      // 特定狀態
      ordersQuery = db.collection('orders')
        .where('storeId', '==', storeId)
        .where('tenantId', '==', user.tenantId)
        .where('status', '==', status);
    }

    // 按訂單創建時間降序排序
    ordersQuery = ordersQuery.orderBy('createdAt', 'desc');

    // 7. 執行查詢
    // 獲取總數
    const countSnapshot = await ordersQuery.get();
    const totalCount = countSnapshot.size;

    // 應用分頁
    const ordersSnapshot = await ordersQuery.limit(limit).offset(offset).get();
    
    // 8. 處理查詢結果
    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 9. 返回結果
    return res.status(200).json({
      success: true,
      message: '成功獲取訂單列表',
      data: {
        orders,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    logger.error('獲取POS訂單列表時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 更新訂單狀態（從POS終端）
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const updatePosOrderStatus = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理POS更新訂單狀態請求', { structuredData: true });
  
  try {
    // 1. 獲取並驗證路徑參數和請求體
    const { orderId } = req.params;
    const { newStatus, reason, staffId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：缺少訂單ID',
      });
    }

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：缺少新訂單狀態',
      });
    }

    // 檢查狀態是否有效
    const validStatuses = ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：無效的訂單狀態',
        validStatuses,
      });
    }

    // 如果狀態是cancelled但沒有提供reason
    if (newStatus === 'cancelled' && !reason) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：取消訂單時必須提供原因',
      });
    }

    // 2. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('更新訂單狀態失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }

    // 3. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('更新訂單狀態失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }

    // 4. 獲取訂單
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      logger.error('更新訂單狀態失敗: 訂單不存在', { orderId });
      return res.status(404).json({
        success: false,
        message: '訂單不存在',
      });
    }

    const orderData = orderDoc.data();
    if (!orderData) {
      logger.error('更新訂單狀態失敗: 訂單數據為空', { orderId });
      return res.status(500).json({
        success: false,
        message: '伺服器內部錯誤：訂單數據為空',
      });
    }

    // 5. 檢查訂單是否屬於當前租戶
    if (orderData.tenantId !== user.tenantId) {
      logger.error('更新訂單狀態失敗: 訂單不屬於當前租戶', { 
        orderId, 
        orderTenantId: orderData.tenantId, 
        userTenantId: user.tenantId 
      });
      return res.status(403).json({
        success: false,
        message: '沒有權限：訂單不屬於當前租戶',
      });
    }

    // 6. 檢查狀態變更是否合理
    const currentStatus = orderData.status;
    
    // 定義狀態遷移規則
    const allowedTransitions: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['completed', 'cancelled'],
      'completed': ['cancelled'], // 一般來說已完成訂單不應該被取消，但特殊情況可能需要
      'cancelled': [] // 已取消訂單不能再變更
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      logger.error('更新訂單狀態失敗: 無效的狀態變更', { 
        orderId, 
        currentStatus, 
        newStatus,
        allowedTransitions: allowedTransitions[currentStatus]
      });
      return res.status(422).json({
        success: false,
        message: `無法處理的狀態變更：從 ${currentStatus} 到 ${newStatus}`,
        allowedTransitions: allowedTransitions[currentStatus]
      });
    }

    // 7. 更新訂單狀態
    const now = admin.firestore.Timestamp.now();
    const updateData: any = {
      status: newStatus,
      updatedAt: now,
      [`statusHistory.${newStatus}`]: now
    };

    // 添加狀態變更原因（如果有）
    if (reason) {
      updateData.statusChangeReason = reason;
    }

    // 記錄操作員工（如果有）
    if (staffId) {
      updateData.lastUpdatedBy = staffId;
    } else {
      updateData.lastUpdatedBy = user.uid;
    }

    // 如果標記為完成，記錄完成時間
    if (newStatus === 'completed') {
      updateData.completedAt = now;
    }

    // 如果標記為取消，記錄取消時間
    if (newStatus === 'cancelled') {
      updateData.cancelledAt = now;
      updateData.cancellationReason = reason;
    }

    // 執行更新
    await orderRef.update(updateData);

    // 8. 獲取更新後的訂單
    const updatedOrderDoc = await orderRef.get();
    const updatedOrderData = updatedOrderDoc.data();

    // 9. 返回更新後的訂單數據
    return res.status(200).json({
      success: true,
      message: '訂單狀態更新成功',
      data: {
        id: orderId,
        ...updatedOrderData
      }
    });
  } catch (error) {
    logger.error('更新訂單狀態時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 觸發訂單收據列印
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const triggerOrderPrint = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理觸發訂單列印請求', { structuredData: true });
  
  try {
    // 1. 獲取並驗證路徑參數和請求體
    const { orderId } = req.params;
    const { 
      printerId, 
      copies = 1, 
      type = 'receipt', 
      receiptType = 'both',
      includeHeader = true,
      includeFooter = true,
      requestSource
    } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：缺少訂單ID',
      });
    }

    // 檢查副本數量
    if (copies < 1 || copies > 5) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：列印份數必須在1-5份之間',
      });
    }

    // 2. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('觸發訂單列印失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }

    // 3. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('觸發訂單列印失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }

    // 4. 獲取訂單
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      logger.error('觸發訂單列印失敗: 訂單不存在', { orderId });
      return res.status(404).json({
        success: false,
        message: '訂單不存在',
      });
    }

    const orderData = orderDoc.data();
    if (!orderData) {
      logger.error('觸發訂單列印失敗: 訂單數據為空', { orderId });
      return res.status(500).json({
        success: false,
        message: '伺服器內部錯誤：訂單數據為空',
      });
    }

    // 5. 檢查訂單是否屬於當前租戶
    if (orderData.tenantId !== user.tenantId) {
      logger.error('觸發訂單列印失敗: 訂單不屬於當前租戶', { 
        orderId, 
        orderTenantId: orderData.tenantId, 
        userTenantId: user.tenantId 
      });
      return res.status(403).json({
        success: false,
        message: '沒有權限：訂單不屬於當前租戶',
      });
    }

    // 6. 檢查訂單狀態（例如：未付款的訂單可能不允許列印收據）
    if (orderData.paymentStatus !== 'paid' && type.includes('receipt')) {
      logger.error('觸發訂單列印失敗: 未完成支付的訂單不能列印收據', { 
        orderId, 
        paymentStatus: orderData.paymentStatus 
      });
      return res.status(422).json({
        success: false,
        message: '未完成支付的訂單不能列印收據',
      });
    }

    // 7. 獲取店鋪信息（用於標頭和頁尾）
    const storeRef = db.collection('stores').doc(orderData.storeId);
    const storeDoc = await storeRef.get();
    
    if (!storeDoc.exists) {
      logger.error('觸發訂單列印失敗: 店鋪不存在', { storeId: orderData.storeId });
      return res.status(404).json({
        success: false,
        message: '店鋪不存在',
      });
    }
    
    const storeData = storeDoc.data();

    // 8. 構建列印內容
    const buildPrintContent = (): PrintContent => {
      // 根據列印類型構建不同的內容
      if (type === 'receipt' || type === 'both') {
        // 構建收據列印數據
        const receiptData: ReceiptPrintData = {
          orderId: orderId,
          orderNumber: orderData.orderNumber,
          orderTime: orderData.createdAt.toDate(),
          storeName: storeData?.name || '吃雞排找不早',
          storeAddress: storeData?.address,
          storePhone: storeData?.phoneNumber,
          tableNumber: orderData.tableNumber,
          customerName: orderData.customerName,
          items: orderData.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            options: item.options?.map((opt: any) => `${opt.name}${opt.price ? ` (+${opt.price})` : ''}`) || [],
            notes: item.notes
          })),
          subtotal: orderData.subtotal,
          tax: orderData.tax,
          discount: orderData.discount,
          total: orderData.total,
          paymentMethod: orderData.paymentMethod,
          paymentStatus: orderData.paymentStatus,
          notes: orderData.notes,
          footer: includeFooter ? storeData?.receiptFooter : undefined
        };

        return {
          type: 'receipt',
          data: receiptData,
          title: `收據 - ${orderData.orderNumber}`,
          copies: copies
        };
      } else if (type === 'kitchen') {
        // 構建廚房訂單列印數據
        return {
          type: 'order',
          data: {
            orderId: orderId,
            orderNumber: orderData.orderNumber,
            orderTime: orderData.createdAt.toDate(),
            tableNumber: orderData.tableNumber,
            customerName: orderData.customerName,
            items: orderData.items.map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              options: item.options?.map((opt: any) => opt.name) || [],
              notes: item.notes
            })),
            notes: orderData.notes,
            preparationPriority: orderData.priority || 'normal'
          },
          title: `廚房訂單 - ${orderData.orderNumber}`,
          copies: copies
        };
      }
      
      // 默認情況下返回收據內容
      return {
        type: 'text',
        data: {
          content: `訂單 ${orderData.orderNumber} 的內容無法格式化`
        },
        copies: copies
      };
    };

    // 9. 創建列印任務
    const printerType = type === 'kitchen' ? PrinterType.KITCHEN : PrinterType.RECEIPT;
    
    const printJobInput: PrintJobInput = {
      tenantId: user.tenantId,
      storeId: orderData.storeId,
      printerType: printerType,
      printerId: printerId, // 如果未提供，會使用店鋪默認印表機
      content: buildPrintContent(),
      createdBy: user.uid,
      source: 'user',
      relatedOrderId: orderId,
      relatedEntityId: orderId,
      relatedEntityType: 'order',
      maxRetries: 3
    };

    const printJob = await createPrintJob(printJobInput);

    // 10. 更新訂單的列印狀態
    await orderRef.update({
      lastPrintedAt: admin.firestore.Timestamp.now(),
      printStatus: 'requested',
      lastPrintJobId: printJob.jobId
    });

    // 11. 返回成功響應
    return res.status(200).json({
      success: true,
      message: '列印請求已成功觸發',
      data: {
        printJobId: printJob.jobId,
        status: PrintJobStatus.PENDING
      }
    });
  } catch (error) {
    logger.error('觸發訂單列印時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
}; 