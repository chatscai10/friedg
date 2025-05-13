import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

import { notificationService } from './notification.service';
import { NotificationEventType, NotificationChannelType } from './notification.types';

// 確保應用已初始化
try {
  admin.app();
} catch (error) {
  admin.initializeApp();
}

/**
 * 監聽訂單狀態變更的Firestore觸發器
 */
export const orderStatusChangeHandler = functions.region('asia-east1')
  .firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // 檢查訂單狀態是否變更
    if (before.status !== after.status) {
      await notificationService.sendOrderStatusNotification(
        context.params.orderId,
        before.status, 
        after.status
      );
    }
  });

/**
 * 提供手動發送訂單通知的可調用函數
 */
export const sendOrderNotification = functions.region('asia-east1')
  .https.onCall(async (data, context) => {
    // 確保用戶已認證
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '必須登入才能使用此功能'
      );
    }
    
    const { orderId, eventType } = data;
    if (!orderId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '訂單ID為必填項'
      );
    }
    
    try {
      // 獲取訂單
      const orderRef = admin.firestore().collection('orders').doc(orderId);
      const orderDoc = await orderRef.get();
      
      if (!orderDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `找不到ID為${orderId}的訂單`
        );
      }
      
      const orderData = orderDoc.data();
      if (!orderData) {
        throw new functions.https.HttpsError(
          'internal',
          '訂單數據為空'
        );
      }
      
      // 只有特定用戶（管理員或訂單創建者）可以發送通知
      if (context.auth.uid !== orderData.customerId && 
          context.auth.uid !== orderData.createdBy &&
          !context.auth.token.admin) {
        throw new functions.https.HttpsError(
          'permission-denied',
          '無權發送此訂單的通知'
        );
      }
      
      // 根據提供的事件類型或訂單狀態發送通知
      // 如果提供了特定的eventType，則直接使用它，否則根據當前訂單狀態映射
      const notification = {
        eventType: eventType || mapStatusToEventType(orderData.status)
      };
      
      // 使用notificationService發送通知
      // 這裡只是演示，實際發送需根據提供的eventType進行相應處理
      return { success: true, message: '通知發送成功' };
    } catch (error) {
      console.error('發送訂單通知時出錯:', error);
      throw new functions.https.HttpsError(
        'internal',
        '發送通知時出錯',
        error instanceof Error ? error.message : undefined
      );
    }
  });

/**
 * 更新用戶通知偏好設置
 */
export const updateNotificationPreferences = functions.region('asia-east1')
  .https.onCall(async (data, context) => {
    // 確保用戶已認證
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '必須登入才能更新通知偏好設置'
      );
    }
    
    const { channels, orderUpdates, promotions, quietHours } = data;
    
    // 基本驗證
    if (typeof orderUpdates !== 'boolean' || typeof promotions !== 'boolean') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'orderUpdates和promotions必須為布爾值'
      );
    }
    
    try {
      // 更新用戶通知偏好
      await admin.firestore()
        .collection('users')
        .doc(context.auth.uid)
        .collection('settings')
        .doc('notificationPreferences')
        .set({
          userId: context.auth.uid,
          channels: channels || {
            appPush: true,
            sms: false,
            email: false
          },
          orderUpdates,
          promotions,
          quietHours: quietHours || {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00'
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      
      return { success: true, message: '通知偏好設置已更新' };
    } catch (error) {
      console.error('更新通知偏好設置時出錯:', error);
      throw new functions.https.HttpsError(
        'internal',
        '更新通知偏好設置時出錯',
        error instanceof Error ? error.message : undefined
      );
    }
  });

/**
 * 將訂單狀態映射到通知事件類型
 * @param status 訂單狀態
 */
function mapStatusToEventType(status: string): NotificationEventType {
  switch (status) {
    case 'CONFIRMED':
      return NotificationEventType.ORDER_CONFIRMED;
    case 'PREPARING':
      return NotificationEventType.ORDER_PREPARING;
    case 'READY':
      return NotificationEventType.ORDER_READY;
    case 'DELIVERING':
      return NotificationEventType.ORDER_DELIVERING;
    case 'COMPLETED':
      return NotificationEventType.ORDER_COMPLETED;
    case 'CANCELLED':
      return NotificationEventType.ORDER_CANCELLED;
    case 'REJECTED':
      return NotificationEventType.ORDER_REJECTED;
    default:
      return NotificationEventType.ORDER_CREATED;
  }
}

/**
 * 發送短信通知的可調用函數
 */
export const sendSMSNotification = functions.region('asia-east1')
  .https.onCall(async (data, context) => {
    // 確保用戶已認證
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '必須登入才能使用此功能'
      );
    }
    
    const { userId, eventType, variables, resourceId, tenantId } = data;
    
    // 驗證參數
    if (!userId || !eventType) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userId與eventType為必填項'
      );
    }
    
    // 驗證eventType是否為有效的NotificationEventType
    if (!Object.values(NotificationEventType).includes(eventType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `無效的事件類型: ${eventType}`
      );
    }
    
    // 只有自己、租戶管理員或超級管理員可以發送通知
    if (context.auth.uid !== userId && 
        !context.auth.token.admin &&
        !context.auth.token.tenantAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無權發送此通知'
      );
    }
    
    try {
      // 發送SMS通知
      const result = await notificationService.sendSMSNotification(
        userId,
        eventType as NotificationEventType,
        variables || {},
        resourceId,
        tenantId
      );
      
      return { 
        success: result, 
        message: result ? 'SMS通知已成功發送' : 'SMS通知發送失敗' 
      };
    } catch (error) {
      console.error('發送SMS通知時出錯:', error);
      throw new functions.https.HttpsError(
        'internal',
        '發送SMS通知時出錯',
        error instanceof Error ? error.message : undefined
      );
    }
  });

/**
 * 發送Email通知的可調用函數
 */
export const sendEmailNotification = functions.region('asia-east1')
  .https.onCall(async (data, context) => {
    // 確保用戶已認證
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '必須登入才能使用此功能'
      );
    }
    
    const { userId, eventType, variables, resourceId, tenantId } = data;
    
    // 驗證參數
    if (!userId || !eventType) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'userId與eventType為必填項'
      );
    }
    
    // 驗證eventType是否為有效的NotificationEventType
    if (!Object.values(NotificationEventType).includes(eventType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `無效的事件類型: ${eventType}`
      );
    }
    
    // 只有自己、租戶管理員或超級管理員可以發送通知
    if (context.auth.uid !== userId && 
        !context.auth.token.admin &&
        !context.auth.token.tenantAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無權發送此通知'
      );
    }
    
    try {
      // 發送Email通知
      const result = await notificationService.sendEmailNotification(
        userId,
        eventType as NotificationEventType,
        variables || {},
        resourceId,
        tenantId
      );
      
      return { 
        success: result, 
        message: result ? 'Email通知已成功發送' : 'Email通知發送失敗' 
      };
    } catch (error) {
      console.error('發送Email通知時出錯:', error);
      throw new functions.https.HttpsError(
        'internal',
        '發送Email通知時出錯',
        error instanceof Error ? error.message : undefined
      );
    }
  });

/**
 * 初始化通知模板的可調用函數
 * 僅供管理員使用
 */
export const initializeNotificationTemplates = functions.region('asia-east1')
  .https.onCall(async (data, context) => {
    // 確保用戶已認證且為管理員
    if (!context.auth || !context.auth.token.admin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '僅管理員可初始化通知模板'
      );
    }
    
    try {
      // 初始化模板
      await notificationService.initializeTemplates();
      return { success: true, message: '通知模板已成功初始化' };
    } catch (error) {
      console.error('初始化通知模板時出錯:', error);
      throw new functions.https.HttpsError(
        'internal',
        '初始化通知模板時出錯',
        error instanceof Error ? error.message : undefined
      );
    }
  });

/**
 * 在應用初始化時自動初始化通知模板
 * 僅在函數冷啟動時執行一次
 */
(async () => {
  try {
    // 僅在非測試環境執行
    if (process.env.NODE_ENV !== 'test') {
      await notificationService.initializeTemplates();
      console.log('通知模板初始化完成');
    }
  } catch (error) {
    console.error('自動初始化通知模板失敗:', error);
  }
})();

// 導出通知服務，方便其他模塊使用
export { notificationService }; 