import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { NotificationChannel } from '../notification.types';

/**
 * 基於Firebase Cloud Messaging的應用內推送通知渠道
 */
export class AppPushChannel implements NotificationChannel {
  /**
   * 發送通知
   * @param deviceToken 接收者的FCM設備令牌
   * @param content 通知內容
   * @param metadata 附加元數據，可包含標題、圖片URL等
   * @returns 發送成功返回true，否則返回false
   */
  async send(deviceToken: string, content: string, metadata?: any): Promise<boolean> {
    try {
      // 檢查deviceToken是否有效
      if (!deviceToken || deviceToken.trim().length === 0) {
        logger.warn('AppPushChannel.send: 無效的設備令牌');
        return false;
      }
      
      // 準備消息數據
      const message: admin.messaging.Message = {
        token: deviceToken,
        notification: {
          title: metadata?.title || '訂單狀態更新',
          body: content
        },
        data: {
          ...metadata,
          // 確保metadata中的所有值都是字符串
          clickAction: metadata?.clickAction || 'OPEN_ORDER_DETAIL'
        },
        android: {
          priority: 'high',
          notification: {
            clickAction: metadata?.clickAction || 'OPEN_ORDER_DETAIL',
            channelId: 'order_updates'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: 'default'
            }
          }
        }
      };
      
      // 發送FCM消息
      const response = await admin.messaging().send(message);
      logger.info('AppPushChannel.send: 通知發送成功', { messageId: response });
      return true;
    } catch (error) {
      // 記錄錯誤
      logger.error('AppPushChannel.send: 發送FCM消息失敗', {
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceToken: deviceToken.substring(0, 10) + '...',
        content: content.substring(0, 30) + (content.length > 30 ? '...' : '')
      });
      
      // 對特定錯誤進行處理
      if (error instanceof Error) {
        // 處理無效令牌
        if (error.message.includes('registration-token-not-registered')) {
          logger.warn('AppPushChannel.send: 設備令牌已失效，應從數據庫中移除', {
            deviceToken: deviceToken.substring(0, 10) + '...'
          });
          // 這裡可以添加將無效令牌從數據庫移除的邏輯
        }
      }
      
      return false;
    }
  }
} 