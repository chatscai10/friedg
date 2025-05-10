import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import * as functions from 'firebase-functions';

const logger = functions.logger;
const db = admin.firestore();

/**
 * 呼叫取餐號碼
 * 
 * 當 POS 或員工呼叫此 API 時，更新 Firestore 中的叫號狀態文檔，
 * 取餐顯示螢幕應用程式可以監聽此文檔變化以顯示最新被叫的號碼。
 * 
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const callPickupNumber = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理叫號請求', { structuredData: true });
  
  try {
    // 1. 獲取並驗證路徑參數和請求體
    const { storeId } = req.params;
    const { pickupNumber, orderNumber, orderInfo } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：缺少店鋪ID',
      });
    }

    // 至少需要提供 pickupNumber 或 orderNumber
    if (!pickupNumber && !orderNumber) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：必須提供取餐號碼(pickupNumber)或訂單號碼(orderNumber)',
      });
    }

    // 2. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('叫號失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }

    // 3. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('叫號失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }

    // 4. 檢查店鋪是否存在
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) {
      logger.error('叫號失敗: 店鋪不存在', { storeId });
      return res.status(404).json({
        success: false,
        message: '店鋪不存在',
      });
    }

    const storeData = storeDoc.data();
    // 確保店鋪屬於當前用戶的租戶
    if (storeData?.tenantId !== user.tenantId) {
      logger.error('叫號失敗: 店鋪不屬於當前租戶', { 
        storeId, 
        storeTenantId: storeData?.tenantId, 
        userTenantId: user.tenantId 
      });
      return res.status(403).json({
        success: false,
        message: '沒有權限：店鋪不屬於當前租戶',
      });
    }

    // 5. 記錄叫號歷史
    const callHistoryRef = db.collection('pickupCallHistory').doc();
    const now = admin.firestore.Timestamp.now();

    const callRecord = {
      id: callHistoryRef.id,
      storeId,
      tenantId: user.tenantId,
      pickupNumber: pickupNumber || orderNumber, // 使用提供的取餐號碼或訂單號碼
      orderNumber: orderNumber || null,
      calledBy: user.uid,
      calledAt: now,
      orderInfo: orderInfo || null // 額外的訂單信息（如有）
    };

    await callHistoryRef.set(callRecord);

    // 6. 更新店鋪的當前叫號狀態
    // 使用 pickupStatus/{storeId} 文檔存儲當前叫號狀態，客戶端可以監聽此文檔
    const pickupStatusRef = db.collection('pickupStatus').doc(storeId);
    await pickupStatusRef.set({
      latestCalledNumber: pickupNumber || orderNumber,
      latestOrderNumber: orderNumber || null,
      calledAt: now,
      calledBy: user.uid,
      orderInfo: orderInfo || null,
      updatedAt: now
    }, { merge: true });

    // 7. 返回成功響應
    return res.status(200).json({
      success: true,
      message: '叫號成功',
      data: {
        id: callHistoryRef.id,
        pickupNumber: pickupNumber || orderNumber,
        orderNumber: orderNumber || null,
        calledAt: now
      }
    });

  } catch (error) {
    logger.error('叫號處理時發生錯誤', { 
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
 * 獲取店鋪的叫號歷史記錄
 * 
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const getPickupCallHistory = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理獲取叫號歷史請求', { structuredData: true });
  
  try {
    // 1. 獲取並驗證路徑參數
    const { storeId } = req.params;
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: '請求參數錯誤：缺少店鋪ID',
      });
    }

    // 2. 獲取查詢參數
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    
    // 3. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('獲取叫號歷史失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }

    // 4. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('獲取叫號歷史失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }

    // 5. 構建查詢
    const historyQuery = db.collection('pickupCallHistory')
      .where('storeId', '==', storeId)
      .where('tenantId', '==', user.tenantId)
      .orderBy('calledAt', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    
    // 6. 執行查詢
    const historySnapshot = await historyQuery.get();
    
    // 7. 獲取總數（用於分頁）
    const countQuery = db.collection('pickupCallHistory')
      .where('storeId', '==', storeId)
      .where('tenantId', '==', user.tenantId);
    
    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;
    
    // 8. 處理結果
    const callHistory = historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 9. 返回結果
    return res.status(200).json({
      success: true,
      message: '成功獲取叫號歷史',
      data: {
        history: callHistory,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    logger.error('獲取叫號歷史時發生錯誤', { 
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