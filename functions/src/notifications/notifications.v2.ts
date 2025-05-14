import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { OrderStatus, orderStatusToString } from '../types/order.types'; // 更新導入路徑

// 確保 Firebase Admin SDK 初始化 (如果尚未在主 index.ts 中全局初始化)
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }

/**
 * Firestore 觸發器：當訂單狀態更新時觸發。
 * 用於記錄訂單變更，並向顧客發送 FCM 推送通知。
 */
export const onOrderStatusUpdate = functions.region('asia-east1') // 根據您的部署區域調整
  .firestore.document('orders/{orderId}')
  .onWrite(async (change, context) => {
    const { orderId } = context.params;

    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    if (!change.after.exists) {
      logger.info(`訂單 ${orderId} 已被刪除。`, { orderId });
      return null;
    }

    // 主要關注訂單更新時的狀態變更
    if (beforeData && afterData) {
      const oldStatus = beforeData.status as OrderStatus;
      const newStatus = afterData.status as OrderStatus;
      const customerId = afterData.customerId as string; // 假設 customerId 是 Firebase UID

      if (oldStatus !== newStatus && customerId) {
        logger.info(
          `訂單 ${orderId} 狀態從 [${oldStatus}] 變更為 [${newStatus}]，準備通知顧客 ${customerId}。`,
          {
            orderId,
            oldStatus,
            newStatus,
            customerId,
            storeId: afterData.storeId,
          }
        );

        try {
          const userRef = admin.firestore().collection('users').doc(customerId);
          const userDoc = await userRef.get();

          if (!userDoc.exists) {
            logger.warn(`找不到用戶 ${customerId} 的文檔，無法發送通知。`, { customerId, orderId });
            return null;
          }

          const userData = userDoc.data();
          const fcmTokens: string[] = userData?.fcmTokens || [];

          if (fcmTokens.length === 0) {
            logger.info(`用戶 ${customerId} 沒有 FCM token，不發送通知。`, { customerId, orderId });
            return null;
          }

          const newStatusText = orderStatusToString(newStatus); // 使用輔助函數轉換狀態為可讀文本

          const payload = {
            notification: {
              title: '您的訂單狀態已更新！',
              body: `您的訂單 #${orderId.substring(0, 6)} 狀態已變更為: ${newStatusText}`, // 截斷訂單號以簡潔
              // icon: 'URL_TO_YOUR_APP_ICON', // 可選
              // click_action: 'YOUR_APP_URL_TO_ORDER_DETAILS' // PWA中通常不直接使用，而是通過 service worker 處理 notificationclick
            },
            data: { // 可選，用於傳遞額外數據給客戶端應用
              orderId: orderId,
              newStatus: newStatus,
              clickPath: `/order/${orderId}` // 添加 PWA 內部導航路徑
              // deepLink: `yourappschemename://order/${orderId}` // 針對原生應用的深層鏈接示例
            }
          };

          logger.info(`準備向用戶 ${customerId} 的 ${fcmTokens.length} 個 token 發送通知。Payload data: ${JSON.stringify(payload.data)}`, { customerId, orderId, tokens: fcmTokens });
          const response = await admin.messaging().sendToDevice(fcmTokens, payload);
          logger.info(`FCM 通知發送成功: ${response.successCount}，失敗: ${response.failureCount}`, { orderId, customerId });

          const tokensToRemove: string[] = [];
          response.results.forEach((result, index) => {
            const error = result.error;
            if (error) {
              logger.error(`FCM Token ${fcmTokens[index]} 發送失敗:`, { errorCode: error.code, errorMessage: error.message, orderId, customerId });
              // 檢查特定錯誤碼以確定是否應刪除token
              if (error.code === 'messaging/invalid-registration-token' ||
                  error.code === 'messaging/registration-token-not-registered') {
                tokensToRemove.push(fcmTokens[index]);
              }
            }
          });

          if (tokensToRemove.length > 0) {
            logger.info(`準備從用戶 ${customerId} 移除 ${tokensToRemove.length} 個無效的 FCM token。`, { customerId, tokensToRemove });
            await userRef.update({
              fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove)
            });
            logger.info(`已成功移除用戶 ${customerId} 的無效 FCM token。`, { customerId });
          }

        } catch (error) {
          logger.error(`為訂單 ${orderId} 發送 FCM 通知或處理 Token 時出錯:`, { error, orderId, customerId });
        }

      } else if (oldStatus === newStatus) {
        logger.log(`訂單 ${orderId} 有更新，但狀態未改變。`, { orderId, customerId });
      } else if (!customerId) {
        logger.warn(`訂單 ${orderId} 缺少 customerId，無法發送通知。`, { orderId });
      }
    } else if (!beforeData && afterData) {
      logger.info(`新訂單 ${orderId} 已創建。初始狀態為 [${afterData.status}]。暫不為新訂單發送狀態更新通知。`, { orderId, newData: afterData });
      // 根據需求，也可以為新訂單發送 "已收到訂單" 的通知
    }
    return null;
  }); 