/**
 * 通知模塊 - Gen 2 版本
 * 使用 Firebase Functions v2 API
 */

import { onCall } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

import { notificationService } from './notification.service';
import { NotificationEventType, NotificationChannelType } from './notification.types';

// 確保應用已初始化
try {
  admin.app();
} catch (error) {
  admin.initializeApp();
}

// 設定區域和其他配置
const region = 'asia-east1'; // 台灣區域
const runtimeOptions = {
  memory: '256MiB' as const,
  timeoutSeconds: 60
};

/**
 * 監聽訂單狀態變更的Firestore觸發器
 */
export const orderStatusChangeHandler = onDocumentUpdated({
  document: 'orders/{orderId}',
  region
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  // 檢查訂單狀態是否變更
  if (before.status !== after.status) {
    await notificationService.sendOrderStatusNotification(
      event.params.orderId,
      before.status,
      after.status
    );
  }
});

/**
 * 提供手動發送訂單通知的可調用函數
 */
export const sendOrderNotification = onCall({ region, ...runtimeOptions }, async (request) => {
  // 確保用戶已認證
  if (!request.auth) {
    throw new Error('必須登入才能使用此功能');
  }

  const { orderId, eventType } = request.data;
  if (!orderId) {
    throw new Error('訂單ID為必填項');
  }

  try {
    // 獲取訂單
    const orderRef = admin.firestore().collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new Error(`找不到ID為${orderId}的訂單`);
    }

    const orderData = orderDoc.data();
    if (!orderData) {
      throw new Error('訂單數據為空');
    }

    // 只有特定用戶（管理員或訂單創建者）可以發送通知
    if (request.auth.uid !== orderData.customerId &&
        request.auth.uid !== orderData.createdBy &&
        !request.auth.token.admin) {
      throw new Error('無權發送此訂單的通知');
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
    throw new Error(error instanceof Error ? error.message : '發送通知時出錯');
  }
});

/**
 * 更新用戶通知偏好設置
 */
export const updateNotificationPreferences = onCall({ region, ...runtimeOptions }, async (request) => {
  // 確保用戶已認證
  if (!request.auth) {
    throw new Error('必須登入才能更新通知偏好設置');
  }

  const { channels, orderUpdates, promotions, quietHours } = request.data;

  // 基本驗證
  if (typeof orderUpdates !== 'boolean' || typeof promotions !== 'boolean') {
    throw new Error('orderUpdates和promotions必須為布爾值');
  }

  try {
    // 更新用戶通知偏好
    await admin.firestore()
      .collection('users')
      .doc(request.auth.uid)
      .collection('settings')
      .doc('notificationPreferences')
      .set({
        userId: request.auth.uid,
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
    throw new Error(error instanceof Error ? error.message : '更新通知偏好設置時出錯');
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
export const sendSMSNotification = onCall({ region, ...runtimeOptions }, async (request) => {
  // 確保用戶已認證
  if (!request.auth) {
    throw new Error('必須登入才能使用此功能');
  }

  const { userId, eventType, variables, resourceId, tenantId } = request.data;

  // 驗證參數
  if (!userId || !eventType) {
    throw new Error('userId與eventType為必填項');
  }

  // 驗證eventType是否為有效的NotificationEventType
  if (!Object.values(NotificationEventType).includes(eventType)) {
    throw new Error(`無效的事件類型: ${eventType}`);
  }

  // 只有自己、租戶管理員或超級管理員可以發送通知
  if (request.auth.uid !== userId &&
      !request.auth.token.admin &&
      !request.auth.token.tenantAdmin) {
    throw new Error('無權發送此通知');
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
    throw new Error(error instanceof Error ? error.message : '發送SMS通知時出錯');
  }
});

/**
 * 發送電子郵件通知的可調用函數
 */
export const sendEmailNotification = onCall({ region, ...runtimeOptions }, async (request) => {
  // 確保用戶已認證
  if (!request.auth) {
    throw new Error('必須登入才能使用此功能');
  }

  const { userId, eventType, variables, resourceId, tenantId } = request.data;

  // 驗證參數
  if (!userId || !eventType) {
    throw new Error('userId與eventType為必填項');
  }

  // 驗證eventType是否為有效的NotificationEventType
  if (!Object.values(NotificationEventType).includes(eventType)) {
    throw new Error(`無效的事件類型: ${eventType}`);
  }

  // 只有自己、租戶管理員或超級管理員可以發送通知
  if (request.auth.uid !== userId &&
      !request.auth.token.admin &&
      !request.auth.token.tenantAdmin) {
    throw new Error('無權發送此通知');
  }

  try {
    // 發送電子郵件通知
    const result = await notificationService.sendEmailNotification(
      userId,
      eventType as NotificationEventType,
      variables || {},
      resourceId,
      tenantId
    );

    return {
      success: result,
      message: result ? '電子郵件通知已成功發送' : '電子郵件通知發送失敗'
    };
  } catch (error) {
    console.error('發送電子郵件通知時出錯:', error);
    throw new Error(error instanceof Error ? error.message : '發送電子郵件通知時出錯');
  }
});

/**
 * 發送應用內推送通知的可調用函數
 */
export const sendPushNotification = onCall({ region, ...runtimeOptions }, async (request) => {
  // 確保用戶已認證
  if (!request.auth) {
    throw new Error('必須登入才能使用此功能');
  }

  const { userId, eventType, variables, resourceId, tenantId } = request.data;

  // 驗證參數
  if (!userId || !eventType) {
    throw new Error('userId與eventType為必填項');
  }

  // 驗證eventType是否為有效的NotificationEventType
  if (!Object.values(NotificationEventType).includes(eventType)) {
    throw new Error(`無效的事件類型: ${eventType}`);
  }

  // 只有自己、租戶管理員或超級管理員可以發送通知
  if (request.auth.uid !== userId &&
      !request.auth.token.admin &&
      !request.auth.token.tenantAdmin) {
    throw new Error('無權發送此通知');
  }

  try {
    // 發送推送通知
    const result = await notificationService.sendPushNotification(
      userId,
      eventType as NotificationEventType,
      variables || {},
      resourceId,
      tenantId
    );

    return {
      success: result,
      message: result ? '推送通知已成功發送' : '推送通知發送失敗'
    };
  } catch (error) {
    console.error('發送推送通知時出錯:', error);
    throw new Error(error instanceof Error ? error.message : '發送推送通知時出錯');
  }
});

/**
 * 獲取用戶通知歷史記錄
 */
export const getUserNotifications = onCall({ region, ...runtimeOptions }, async (request) => {
  // 確保用戶已認證
  if (!request.auth) {
    throw new Error('必須登入才能獲取通知歷史');
  }

  const { limit = 20, page = 1, status, type } = request.data;

  try {
    // 構建查詢
    let query = admin.firestore()
      .collection('notifications')
      .where('userId', '==', request.auth.uid)
      .orderBy('createdAt', 'desc');

    // 根據狀態過濾
    if (status) {
      query = query.where('status', '==', status);
    }

    // 根據類型過濾
    if (type) {
      query = query.where('eventType', '==', type);
    }

    // 分頁處理
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);

    // 執行查詢
    const snapshot = await query.get();

    // 獲取總數
    const countQuery = admin.firestore()
      .collection('notifications')
      .where('userId', '==', request.auth.uid);

    if (status) {
      countQuery.where('status', '==', status);
    }

    if (type) {
      countQuery.where('eventType', '==', type);
    }

    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    // 格式化結果
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('獲取通知歷史時出錯:', error);
    throw new Error(error instanceof Error ? error.message : '獲取通知歷史時出錯');
  }
});

/**
 * 標記通知為已讀
 */
export const markNotificationAsRead = onCall({ region, ...runtimeOptions }, async (request) => {
  // 確保用戶已認證
  if (!request.auth) {
    throw new Error('必須登入才能標記通知');
  }

  const { notificationId } = request.data;

  if (!notificationId) {
    throw new Error('通知ID為必填項');
  }

  try {
    // 獲取通知
    const notificationRef = admin.firestore().collection('notifications').doc(notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
      throw new Error(`找不到ID為${notificationId}的通知`);
    }

    const notificationData = notificationDoc.data();
    if (!notificationData) {
      throw new Error('通知數據為空');
    }

    // 確保用戶只能標記自己的通知
    if (notificationData.userId !== request.auth.uid) {
      throw new Error('無權標記此通知');
    }

    // 標記為已讀
    await notificationRef.update({
      status: 'read',
      readAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: '通知已標記為已讀' };
  } catch (error) {
    console.error('標記通知為已讀時出錯:', error);
    throw new Error(error instanceof Error ? error.message : '標記通知為已讀時出錯');
  }
});
