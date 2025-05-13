import { AppPushChannel } from '../../../src/notifications/channels/app-push';
import * as admin from 'firebase-admin';

// 模擬Firebase Admin SDK
jest.mock('firebase-admin', () => {
  const messagingMock = {
    send: jest.fn().mockResolvedValue('test-message-id')
  };

  return {
    messaging: jest.fn().mockReturnValue(messagingMock),
    __esModule: true
  };
});

// 模擬日誌記錄
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('AppPushChannel', () => {
  let appPushChannel: AppPushChannel;
  
  beforeEach(() => {
    // 重置所有模擬
    jest.clearAllMocks();
    
    // 創建新的AppPushChannel實例
    appPushChannel = new AppPushChannel();
  });

  describe('send method', () => {
    it('should successfully send push notification with correct parameters', async () => {
      // 準備測試數據
      const deviceToken = 'test-device-token-12345';
      const content = '您的訂單已確認';
      const metadata = { 
        title: '訂單狀態更新',
        orderId: '12345',
        clickAction: 'VIEW_ORDER_DETAILS'
      };
      
      // 發送通知
      const result = await appPushChannel.send(deviceToken, content, metadata);
      
      // 檢查結果
      expect(result).toBe(true);
      
      // 檢查Firebase messaging調用
      expect(admin.messaging().send).toHaveBeenCalledTimes(1);
      
      // 驗證發送的消息參數
      const messageArg = (admin.messaging().send as jest.Mock).mock.calls[0][0];
      expect(messageArg.token).toBe(deviceToken);
      expect(messageArg.notification.title).toBe(metadata.title);
      expect(messageArg.notification.body).toBe(content);
      expect(messageArg.data.orderId).toBe(metadata.orderId);
      expect(messageArg.data.clickAction).toBe(metadata.clickAction);
      expect(messageArg.android.notification.clickAction).toBe(metadata.clickAction);
    });

    it('should use default title and clickAction when not provided', async () => {
      // 準備測試數據 - 不包含標題和clickAction
      const deviceToken = 'test-device-token-12345';
      const content = '您的訂單已確認';
      
      // 發送通知，不提供metadata
      const result = await appPushChannel.send(deviceToken, content);
      
      // 檢查結果
      expect(result).toBe(true);
      
      // 驗證發送的消息參數
      const messageArg = (admin.messaging().send as jest.Mock).mock.calls[0][0];
      expect(messageArg.notification.title).toBe('訂單狀態更新'); // 默認標題
      expect(messageArg.data.clickAction).toBe('OPEN_ORDER_DETAIL'); // 默認動作
      expect(messageArg.android.notification.clickAction).toBe('OPEN_ORDER_DETAIL');
    });

    it('should reject invalid (empty) device tokens', async () => {
      // 測試一系列無效設備令牌
      const invalidTokens = [
        '',
        '   ',
        null,
        undefined
      ];
      
      for (const token of invalidTokens) {
        // @ts-ignore 忽略類型檢查以測試無效輸入
        const result = await appPushChannel.send(token, '測試內容');
        expect(result).toBe(false);
      }
      
      // 確認Firebase messaging未被調用
      expect(admin.messaging().send).not.toHaveBeenCalled();
      
      // 檢查警告日誌
      const logger = require('firebase-functions').logger;
      expect(logger.warn).toHaveBeenCalledWith('AppPushChannel.send: 無效的設備令牌');
    });

    it('should handle FCM send errors gracefully', async () => {
      // 模擬FCM發送錯誤
      (admin.messaging().send as jest.Mock).mockRejectedValueOnce(new Error('FCM送達失敗'));
      
      // 發送通知
      const result = await appPushChannel.send('test-device-token', '測試內容');
      
      // 檢查結果
      expect(result).toBe(false);
      
      // 檢查錯誤日誌
      const logger = require('firebase-functions').logger;
      expect(logger.error).toHaveBeenCalled();
      const errorCall = logger.error.mock.calls[0][1];
      expect(errorCall.error).toBe('FCM送達失敗');
    });

    it('should handle invalid token errors specially', async () => {
      // 模擬特定的無效令牌錯誤
      const invalidTokenError = new Error('Requested entity was not found. registration-token-not-registered');
      (admin.messaging().send as jest.Mock).mockRejectedValueOnce(invalidTokenError);
      
      // 發送通知
      const result = await appPushChannel.send('invalid-token', '測試內容');
      
      // 檢查結果
      expect(result).toBe(false);
      
      // 檢查特定警告日誌
      const logger = require('firebase-functions').logger;
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.warn.mock.calls[0][0]).toContain('設備令牌已失效');
    });

    it('should mask device token in error logs', async () => {
      // 模擬FCM錯誤
      (admin.messaging().send as jest.Mock).mockRejectedValueOnce(new Error('FCM錯誤'));
      
      // 使用較長的令牌發送
      const longToken = 'abcdefghijklmnopqrstuvwxyz1234567890';
      await appPushChannel.send(longToken, '測試內容');
      
      // 獲取firebase-functions的logger模擬
      const logger = require('firebase-functions').logger;
      
      // 檢查錯誤日誌中的令牌是否被遮罩
      expect(logger.error).toHaveBeenCalled();
      const errorCall = logger.error.mock.calls[0][1];
      
      // 檢查遮罩後的令牌格式是否正確（不是完整令牌）
      expect(errorCall.deviceToken).not.toContain(longToken);
      expect(errorCall.deviceToken).toBe(longToken.substring(0, 10) + '...');
    });

    it('should truncate long content in error logs', async () => {
      // 模擬FCM錯誤
      (admin.messaging().send as jest.Mock).mockRejectedValueOnce(new Error('FCM錯誤'));
      
      // 使用較長的內容發送
      const longContent = '這是一個非常長的測試內容，用於測試錯誤日誌中的內容截斷功能。這段內容應該超過30個字符，以確保測試有效。';
      await appPushChannel.send('test-token', longContent);
      
      // 獲取firebase-functions的logger模擬
      const logger = require('firebase-functions').logger;
      
      // 檢查錯誤日誌中的內容是否被截斷
      expect(logger.error).toHaveBeenCalled();
      const errorCall = logger.error.mock.calls[0][1];
      
      // 檢查截斷後的內容格式
      expect(errorCall.content).not.toContain(longContent);
      expect(errorCall.content).toBe(longContent.substring(0, 30) + '...');
    });

    it('should include relevant notification details based on platform', async () => {
      // 發送通知
      await appPushChannel.send('test-token', '測試內容', { title: '測試標題' });
      
      // 驗證平台特定配置
      const messageArg = (admin.messaging().send as jest.Mock).mock.calls[0][0];
      
      // Android配置
      expect(messageArg.android).toBeDefined();
      expect(messageArg.android.priority).toBe('high');
      expect(messageArg.android.notification.channelId).toBe('order_updates');
      
      // iOS配置
      expect(messageArg.apns).toBeDefined();
      expect(messageArg.apns.payload.aps.badge).toBe(1);
      expect(messageArg.apns.payload.aps.sound).toBe('default');
    });
  });
}); 