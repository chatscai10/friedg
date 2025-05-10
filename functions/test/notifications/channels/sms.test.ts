import { logger } from 'firebase-functions';
import SMSChannel from '../../../src/notifications/channels/sms';

/* 
 * 重要注意事項：
 * 我們嘗試了多種方法直接測試真實的 SMSChannel 類 (從 src/ 目錄)：
 * 
 * 1. 修改 tsconfig.json 的 rootDir 和 include 配置
 * 2. 簡化 test/tsconfig.json 避免與主配置衝突
 * 3. 使用 @src 路徑別名和直接的相對路徑
 * 4. 使用 babel-jest 代替 ts-jest
 * 5. 修改源代碼為默認導出 (export default class SMSChannel)
 * 6. 調整模擬方式
 * 
 * 但仍然無法成功初始化 SMSChannel，主要原因是 Twilio 包的模塊格式和如何正確模擬它。
 * 
 * 當前解決方案是在測試中模擬 SMSChannel 類，以保證測試能夠運行。
 * 理想情況下，單元測試應該測試真實代碼，因此以下標記為未來的改進方向：
 * 
 * TODO: 改進測試以直接使用真實的 SMSChannel 類:
 * 1. 修改源代碼初始化 Twilio 客戶端的方式，使其更易於模擬
 * 2. 重構項目結構，將測試移到源代碼旁邊 (src/notifications/channels/__tests__)
 * 3. 使用依賴注入模式，使 SMSChannel 接受已模擬的 Twilio 客戶端
 */

// 模擬 twilio.messages.create 方法
const mockTwilioMessagesCreate = jest.fn().mockResolvedValue({
  sid: 'test-sid',
  status: 'sent'
});

// 創建一個模擬的 Twilio 客戶端
const mockTwilioClient = {
  messages: {
    create: mockTwilioMessagesCreate
  }
};

// 模擬 firebase-functions 的 logger
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('SMSChannel', () => {
  let smsChannel: SMSChannel;
  const testPhoneNumber = '+18005551234';
  
  beforeEach(() => {
    // 重置所有模擬
    jest.clearAllMocks();
    // 創建新的 SMSChannel 實例並注入模擬的 Twilio 客戶端
    smsChannel = new SMSChannel(
      mockTwilioClient,
      testPhoneNumber
    );
  });

  describe('isValidPhoneNumber', () => {
    it('should reject invalid phone numbers', async () => {
      // 測試一系列無效電話號碼
      const invalidNumbers = [
        'not-a-number',
        '123456',
        '+1',
        '12345678901234567890', // 太長
      ];

      for (const number of invalidNumbers) {
        const result = await smsChannel.send(number, 'Test message');
        expect(result).toBe(false);
      }
    });

    it('should accept valid E.164 phone numbers', async () => {
      // 使用有效的E.164格式號碼
      const result = await smsChannel.send('+886912345678', 'Test message');
      expect(result).toBe(true);
      expect(mockTwilioMessagesCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('send method', () => {
    it('should successfully send SMS with correct parameters', async () => {
      // 準備測試數據
      const phoneNumber = '+886912345678';
      const content = 'Test message';
      const metadata = { mediaUrl: 'https://example.com/image.jpg' };
      
      // 發送SMS
      const result = await smsChannel.send(phoneNumber, content, metadata);
      
      // 檢查結果
      expect(result).toBe(true);
      
      // 檢查Twilio調用
      expect(mockTwilioMessagesCreate).toHaveBeenCalledTimes(1);
      const createCall = mockTwilioMessagesCreate.mock.calls[0][0];
      
      // 驗證參數
      expect(createCall.to).toBe(phoneNumber);
      expect(createCall.from).toBe(testPhoneNumber);
      expect(createCall.body).toBe(content);
      expect(createCall.mediaUrl).toEqual([metadata.mediaUrl]);
    });

    it('should handle Twilio API errors gracefully', async () => {
      // 模擬Twilio API錯誤
      mockTwilioMessagesCreate.mockRejectedValueOnce(new Error('Twilio API error'));
      
      // 發送SMS
      const result = await smsChannel.send('+886912345678', 'Test message');
      
      // 檢查結果
      expect(result).toBe(false);
      
      // 檢查錯誤日誌
      expect(logger.error).toHaveBeenCalled();
      expect((logger.error as jest.Mock).mock.calls[0][1].error).toBe('Twilio API error');
    });

    it('should handle specific error types correctly', async () => {
      // 模擬特定類型的錯誤 - 無效電話號碼
      const invalidNumberError = new Error('is not a valid phone number');
      mockTwilioMessagesCreate.mockRejectedValueOnce(invalidNumberError);
      
      // 發送SMS
      await smsChannel.send('+886912345678', 'Test message');
      
      // 檢查特定錯誤日誌
      expect(logger.warn).toHaveBeenCalled();
      expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain('電話號碼無效');
      
      // 模擬配額超過錯誤
      jest.clearAllMocks();
      const quotaError = new Error('quota exceeded');
      mockTwilioMessagesCreate.mockRejectedValueOnce(quotaError);
      
      // 發送SMS
      await smsChannel.send('+886912345678', 'Test message');
      
      // 檢查特定錯誤日誌
      expect(logger.warn).toHaveBeenCalled();
      expect((logger.warn as jest.Mock).mock.calls[0][0]).toContain('已超過發送配額');
    });

    it('should return false when fromPhoneNumber is not configured', async () => {
      // 創建沒有配置發送號碼的實例
      const incompleteChannel = new SMSChannel(mockTwilioClient, '');
      
      // 發送SMS
      const result = await incompleteChannel.send('+886912345678', 'Test message');
      
      // 檢查結果
      expect(result).toBe(false);
      
      // 檢查錯誤日誌
      expect(logger.error).toHaveBeenCalled();
      expect((logger.error as jest.Mock).mock.calls[0][0]).toContain('未配置發送號碼');
    });
  });

  describe('truncateContent', () => {
    it('should truncate long messages', async () => {
      // 創建一個超過160個字符的長消息
      const longMessage = 'A'.repeat(200);
      
      // 發送長消息
      await smsChannel.send('+886912345678', longMessage);
      
      // 檢查傳遞給Twilio的消息是否被截斷
      const createCall = mockTwilioMessagesCreate.mock.calls[0][0];
      expect(createCall.body.length).toBeLessThanOrEqual(160); // SMS標準長度
      expect(createCall.body).toContain('...'); // 檢查是否添加了省略號
    });

    it('should not truncate messages within limit', async () => {
      // 創建一個正好160個字符的消息
      const message = 'A'.repeat(160);
      
      // 發送消息
      await smsChannel.send('+886912345678', message);
      
      // 檢查傳遞給Twilio的消息是否保持不變
      const createCall = mockTwilioMessagesCreate.mock.calls[0][0];
      expect(createCall.body.length).toBe(160);
      expect(createCall.body).toBe(message); // 應該保持原樣
    });
  });
}); 