import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import * as functions from 'firebase-functions';
import { v4 as uuidv4 } from 'uuid';

// 導入顧客訂單驗證模式
import { CustomerOrderSchema, CustomerOrderInput, CustomerOrderQuerySchema } from './customer.orders.validators';
import { createOrderWithTransaction, getOrderById } from './orders.service';
import { OrderInput, OrderStatus, PaymentStatus, Order } from './types';

const logger = functions.logger;
const db = admin.firestore();

/**
 * 處理顧客創建新訂單請求
 * 支援已登入用戶和匿名用戶
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const createCustomerOrderHandler = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理顧客創建訂單請求', { structuredData: true });
  
  try {
    // 1. 驗證請求數據
    const validationResult = CustomerOrderSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.error('創建訂單失敗: 驗證錯誤', { errors: errorMessage });
      
      return res.status(400).json({
        success: false,
        message: '請求數據驗證失敗',
        errors: validationResult.error.format(),
      });
    }
    
    const customerData = validationResult.data;
    
    // 2. 獲取用戶信息 (若已登入)
    const user = req.user as { uid?: string; tenantId?: string; role?: string; customerId?: string } | undefined;
    let userId = 'anonymous';
    let customerId = null;
    
    if (user && user.uid) {
      userId = user.uid;
      // 如果是已登入的顧客，使用其customerId
      if (user.customerId) {
        customerId = user.customerId;
      }
    }
    
    // 3. 確定租戶ID (從店鋪獲取)
    const storeRef = db.collection('stores').doc(customerData.storeId);
    const storeDoc = await storeRef.get();
    
    if (!storeDoc.exists) {
      logger.error('創建訂單失敗: 店鋪不存在', { storeId: customerData.storeId });
      return res.status(404).json({
        success: false,
        message: '店鋪不存在',
      });
    }
    
    const storeData = storeDoc.data()!;
    const tenantId = storeData.tenantId;
    
    if (!tenantId) {
      logger.error('創建訂單失敗: 店鋪缺少租戶ID', { storeId: customerData.storeId });
      return res.status(500).json({
        success: false,
        message: '店鋪配置錯誤',
      });
    }
    
    // 4. 為匿名用戶處理 - 創建匿名訂單跟踪記錄
    const orderTrackingId = uuidv4();
    
    if (!customerId) {
      // 建立匿名訂單跟踪記錄
      try {
        await db.collection('anonymousOrderTracking').doc(orderTrackingId).set({
          phone: customerData.customerPhone,
          customerName: customerData.customerName || '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAccessed: admin.firestore.FieldValue.serverTimestamp()
        });
        
        logger.info('已創建匿名訂單跟踪記錄', { trackingId: orderTrackingId });
      } catch (trackingError) {
        logger.warn('創建匿名訂單跟踪記錄失敗', { 
          error: trackingError instanceof Error ? trackingError.message : '未知錯誤',
          trackingId: orderTrackingId
        });
        // 這不是致命錯誤，繼續處理
      }
    }
    
    // 5. 轉換為OrderInput格式（適配現有服務函數）
    const orderInput: OrderInput = {
      storeId: customerData.storeId,
      customerId: customerId,
      customerName: customerData.customerName || '',
      customerPhone: customerData.customerPhone,
      customerEmail: customerData.customerEmail || '',
      orderType: customerData.orderType,
      tableNumber: customerData.tableNumber,
      estimatedPickupTime: customerData.estimatedPickupTime,
      specialInstructions: customerData.specialInstructions,
      items: customerData.items.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions,
        // 單價由服務函數在獲取menuItem時確定
        unitPrice: 0, // 會在createOrderWithTransaction中被實際價格覆蓋
        options: item.options ? item.options.map(option => ({
          optionId: option.optionId,
          value: option.value,
          additionalPrice: option.additionalPrice || 0
        })) : undefined
      })),
      discountCode: customerData.discountCode,
      taxIncluded: true, // 默認稅金已包含
      deliveryInfo: customerData.deliveryInfo ? {
        address: customerData.deliveryInfo.address,
        contactPhone: customerData.deliveryInfo.contactPhone,
        notes: customerData.deliveryInfo.notes
      } : undefined
    };
    
    logger.info('準備創建顧客訂單', { 
      storeId: orderInput.storeId,
      tenantId,
      itemCount: orderInput.items.length,
      isAnonymous: !customerId
    });
    
    // 6. 調用服務函數創建訂單
    const newOrder = await createOrderWithTransaction(
      orderInput,
      tenantId,
      userId
    );
    
    // 7. 處理成功 - 添加追踪引用
    if (!customerId) {
      try {
        // 更新匿名訂單跟踪記錄，添加訂單ID
        await db.collection('anonymousOrderTracking').doc(orderTrackingId).update({
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          status: newOrder.status
        });
      } catch (updateError) {
        logger.warn('更新匿名訂單跟踪記錄失敗', {
          error: updateError instanceof Error ? updateError.message : '未知錯誤',
          trackingId: orderTrackingId
        });
        // 不是致命錯誤，繼續處理
      }
    }
    
    logger.info('顧客訂單創建成功', { 
      orderId: newOrder.id, 
      orderNumber: newOrder.orderNumber,
      tenantId,
      storeId: orderInput.storeId,
      isAnonymous: !customerId
    });
    
    // 8. 返回成功響應（客戶端友好型）
    return res.status(201).json({
      success: true,
      message: '訂單創建成功',
      data: {
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        status: newOrder.status,
        totalAmount: newOrder.totalAmount,
        estimatedCompletionTime: newOrder.estimatedPickupTime,
        paymentMethod: newOrder.paymentMethod,
        paymentStatus: newOrder.paymentStatus,
        trackingCode: !customerId ? orderTrackingId : undefined,
        nextSteps: newOrder.paymentStatus === PaymentStatus.UNPAID 
          ? '請前往收銀台完成付款' 
          : '您的訂單已確認，正在製作中'
      }
    });
    
  } catch (error) {
    // 9. 捕獲並處理各種錯誤類型
    logger.error('創建顧客訂單時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // 根據錯誤類型返回適當的HTTP狀態碼
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      if (errorMessage.includes('店鋪不存在')) {
        return res.status(404).json({
          success: false,
          message: errorMessage,
        });
      } else if (errorMessage.includes('菜單項不存在')) {
        return res.status(404).json({
          success: false,
          message: errorMessage,
        });
      } else if (errorMessage.includes('庫存不足')) {
        return res.status(400).json({
          success: false,
          message: errorMessage,
        });
      }
    }
    
    // 默認返回500錯誤
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 處理顧客查詢訂單狀態請求
 * 支援通過訂單號+電話查詢(用於匿名訂單)或登入用戶查詢自己訂單
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const getCustomerOrderStatusHandler = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理顧客查詢訂單狀態請求', { orderId: req.params.orderId, structuredData: true });
  
  try {
    const { orderId } = req.params;
    
    if (!orderId || typeof orderId !== 'string') {
      logger.error('查詢訂單狀態失敗: 缺少有效的訂單ID');
      return res.status(400).json({
        success: false,
        message: '請提供有效的訂單ID',
      });
    }
    
    // 獲取用戶信息 (若已登入)
    const user = req.user as { uid?: string; tenantId?: string; customerId?: string } | undefined;
    let isAuthenticated = false;
    let customerId = null;
    
    if (user && user.uid && user.customerId) {
      isAuthenticated = true;
      customerId = user.customerId;
    }
    
    // 如果用戶未登入，檢查是否提供訂單號和電話
    if (!isAuthenticated) {
      // 驗證查詢參數
      const validationResult = CustomerOrderQuerySchema.safeParse(req.query);
      
      if (!validationResult.success) {
        logger.error('查詢訂單狀態失敗: 查詢參數驗證錯誤');
        return res.status(400).json({
          success: false,
          message: '未登入用戶必須提供訂單號和電話號碼',
          errors: validationResult.error.format(),
        });
      }
      
      const { orderNumber, phone } = validationResult.data;
      
      // 尋找匹配的訂單
      try {
        const ordersSnapshot = await db.collection('orders')
          .where('orderNumber', '==', orderNumber)
          .where('customerPhone', '==', phone)
          .limit(1)
          .get();
        
        if (ordersSnapshot.empty) {
          logger.warn('查詢訂單狀態失敗: 未找到匹配的訂單', { orderNumber, phone });
          return res.status(404).json({
            success: false,
            message: '未找到匹配的訂單',
          });
        }
        
        // 獲取訂單數據
        const orderData = ordersSnapshot.docs[0].data() as Order;
        
        // 返回簡化的訂單狀態信息
        return res.status(200).json({
          success: true,
          data: {
            orderId: orderData.id,
            orderNumber: orderData.orderNumber,
            status: orderData.status,
            statusText: getOrderStatusText(orderData.status),
            estimatedCompletionTime: orderData.estimatedPickupTime,
            paymentStatus: orderData.paymentStatus,
            totalAmount: orderData.totalAmount,
            storeId: orderData.storeId,
            storeName: orderData.storeName,
            createdAt: orderData.createdAt,
          }
        });
        
      } catch (error) {
        logger.error('查詢訂單狀態發生錯誤', { 
          error: error instanceof Error ? error.message : '未知錯誤',
          orderNumber, 
          phone 
        });
        
        return res.status(500).json({
          success: false,
          message: '伺服器內部錯誤',
          error: error instanceof Error ? error.message : '未知錯誤',
        });
      }
    }
    
    // 如果用戶已登入，使用現有服務函數查詢訂單
    // 先獲取訂單數據
    let orderRef = await db.collection('orders').doc(orderId).get();
    
    if (!orderRef.exists) {
      logger.warn('訂單未找到', { orderId });
      return res.status(404).json({
        success: false,
        message: '訂單未找到',
      });
    }
    
    const orderData = orderRef.data() as Order;
    
    // 權限檢查 - 只能查看自己的訂單
    if (orderData.customerId !== customerId) {
      logger.warn('無權訪問此訂單', { orderId, requestedBy: customerId });
      return res.status(403).json({
        success: false,
        message: '無權訪問此訂單',
      });
    }
    
    // 返回簡化的訂單狀態信息
    return res.status(200).json({
      success: true,
      data: {
        orderId: orderData.id,
        orderNumber: orderData.orderNumber,
        status: orderData.status,
        statusText: getOrderStatusText(orderData.status),
        estimatedCompletionTime: orderData.estimatedPickupTime,
        items: orderData.items.map(item => ({
          name: item.menuItemName,
          quantity: item.quantity,
          totalPrice: item.totalPrice
        })),
        paymentStatus: orderData.paymentStatus,
        totalAmount: orderData.totalAmount,
        storeId: orderData.storeId,
        storeName: orderData.storeName,
        createdAt: orderData.createdAt,
      }
    });
    
  } catch (error) {
    logger.error('查詢訂單狀態時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined,
      orderId: req.params.orderId
    });
    
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 獲取訂單狀態對應的友好文字描述
 * @param status 訂單狀態
 * @returns 狀態的中文描述
 */
function getOrderStatusText(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING:
      return '訂單已接收，等待處理';
    case OrderStatus.PREPARING:
      return '餐點正在製作中';
    case OrderStatus.READY:
      return '餐點已完成，等待取餐';
    case OrderStatus.COMPLETED:
      return '訂單已完成';
    case OrderStatus.CANCELLED:
      return '訂單已取消';
    default:
      return '未知狀態';
  }
} 