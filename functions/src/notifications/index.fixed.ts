/**
 * 通知系統API
 * 標準化修復版本，統一使用新版Firebase Functions API
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getUserInfoFromClaims } from '../libs/rbac';
import { hasPermission } from '../libs/rbac/core/permission';
import { notificationService } from './notification.service';
import { NotificationEventType, NotificationChannelType } from './notification.types';

// 設定函數區域
const region = 'asia-east1';

/**
 * 監聽訂單狀態變更的Firestore觸發器
 */
export const orderStatusChangeHandler = functions.region(region)
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
 * 提供手動發送訂單通知的可調用函數 - 標準化API簽名
 */
export const sendOrderNotification = functions.region(region).https.onCall(async (data, context) => {
  try {
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
    
    // 獲取用戶資訊
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
      );
    }
    
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
    
    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'update', resource: 'orders', resourceId: orderId },
      { storeId: orderData.storeId, tenantId: orderData.tenantId }
    );
    
    if (!permissionResult.granted) {
      // 顧客只能發送自己的訂單的通知
      if (userInfo.role === 'customer' && orderData.customerId !== userInfo.uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          '無權發送此訂單的通知'
        );
      }
    }
    
    // 根據提供的事件類型或訂單狀態發送通知
    // 如果提供了特定的eventType，則直接使用它，否則根據當前訂單狀態映射
    const notification = {
      eventType: eventType || mapStatusToEventType(orderData.status)
    };
    
    // 使用notificationService發送通知
    const result = await notificationService.sendNotification(
      orderId,
      notification.eventType,
      { order: orderData },
      userInfo.uid
    );
    
    return { success: true, message: '通知發送成功', result };
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `發送訂單通知失敗: ${errorMessage}`
    );
  }
});

/**
 * 更新用戶通知偏好設置 - 標準化API簽名
 */
export const updateNotificationPreferences = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 確保用戶已認證
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '必須登入才能更新通知偏好設置'
      );
    }
    
    // 獲取用戶資訊
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
      );
    }
    
    const { channels, orderUpdates, promotions, quietHours, userId } = data;
    
    // 基本驗證
    if (typeof orderUpdates !== 'boolean' || typeof promotions !== 'boolean') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'orderUpdates和promotions必須為布爾值'
      );
    }
    
    // 如果提供了userId，檢查是否有權限更新該用戶的設置
    let targetUserId = userInfo.uid;
    
    if (userId && userId !== userInfo.uid) {
      // 只有管理員角色可以更新其他用戶的設置
      if (userInfo.role !== 'super_admin' && userInfo.role !== 'tenant_admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          '無權更新其他用戶的通知偏好設置'
        );
      }
      targetUserId = userId;
    }
    
    // 更新用戶通知偏好
    await admin.firestore()
      .collection('users')
      .doc(targetUserId)
      .collection('settings')
      .doc('notificationPreferences')
      .set({
        userId: targetUserId,
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
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userInfo.uid
      }, { merge: true });
    
    return { success: true, message: '通知偏好設置已更新' };
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `更新通知偏好設置失敗: ${errorMessage}`
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
 * 發送短信通知的可調用函數 - 標準化API簽名
 */
export const sendSMSNotification = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 確保用戶已認證
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '必須登入才能使用此功能'
      );
    }
    
    // 獲取用戶資訊
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
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
    
    // 權限檢查
    let targetTenantId = tenantId || userInfo.tenantId;
    
    // 只有自己、租戶管理員或超級管理員可以發送通知
    if (userInfo.uid !== userId && 
        userInfo.role !== 'super_admin' && 
        userInfo.role !== 'tenant_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無權發送此通知'
      );
    }
    
    // 如果是租戶管理員，確保只能發送自己租戶的通知
    if (userInfo.role === 'tenant_admin' && 
        targetTenantId && 
        targetTenantId !== userInfo.tenantId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無權發送其他租戶的通知'
      );
    }
    
    // 發送SMS通知
    const result = await notificationService.sendSMSNotification(
      userId,
      eventType as NotificationEventType,
      variables || {},
      resourceId,
      targetTenantId
    );
    
    return { 
      success: result, 
      message: result ? 'SMS通知已成功發送' : 'SMS通知發送失敗' 
    };
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `發送SMS通知失敗: ${errorMessage}`
    );
  }
});

/**
 * 發送Email通知的可調用函數 - 標準化API簽名
 */
export const sendEmailNotification = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 確保用戶已認證
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '必須登入才能使用此功能'
      );
    }
    
    // 獲取用戶資訊
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
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
    
    // 權限檢查
    let targetTenantId = tenantId || userInfo.tenantId;
    
    // 只有自己、租戶管理員或超級管理員可以發送通知
    if (userInfo.uid !== userId && 
        userInfo.role !== 'super_admin' && 
        userInfo.role !== 'tenant_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無權發送此通知'
      );
    }
    
    // 如果是租戶管理員，確保只能發送自己租戶的通知
    if (userInfo.role === 'tenant_admin' && 
        targetTenantId && 
        targetTenantId !== userInfo.tenantId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無權發送其他租戶的通知'
      );
    }
    
    // 發送Email通知
    const result = await notificationService.sendEmailNotification(
      userId,
      eventType as NotificationEventType,
      variables || {},
      resourceId,
      targetTenantId
    );
    
    return { 
      success: result, 
      message: result ? 'Email通知已成功發送' : 'Email通知發送失敗' 
    };
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `發送Email通知失敗: ${errorMessage}`
    );
  }
});

/**
 * 初始化通知模板的可調用函數 - 標準化API簽名
 * 僅供管理員使用
 */
export const initializeNotificationTemplates = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 確保用戶已認證
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '必須登入才能初始化通知模板'
      );
    }
    
    // 獲取用戶資訊
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
      );
    }
    
    // 只有超級管理員可以初始化模板
    if (userInfo.role !== 'super_admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        '僅超級管理員可初始化通知模板'
      );
    }
    
    // 初始化模板
    await notificationService.initializeTemplates();
    return { success: true, message: '通知模板已成功初始化' };
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `初始化通知模板失敗: ${errorMessage}`
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