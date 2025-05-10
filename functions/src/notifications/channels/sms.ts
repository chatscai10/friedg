import { logger } from 'firebase-functions';
import { NotificationChannel } from '../notification.types';

// 導入 Twilio 庫和類型
import twilio from 'twilio';
import { Twilio } from 'twilio';

/**
 * 基於Twilio的SMS通知渠道
 */
export default class SMSChannel implements NotificationChannel {
  private client: any;
  private fromPhoneNumber: string;

  /**
   * 構造函數
   * @param twilioClient Twilio 客戶端實例 (通過依賴注入)
   * @param fromNumber 發送短信的號碼
   * @param accountSid 可選的Twilio帳號SID (若不使用依賴注入，則從環境變數獲取)
   * @param authToken 可選的Twilio授權令牌 (若不使用依賴注入，則從環境變數獲取)
   */
  constructor(
    twilioClient?: any,
    fromNumber: string = process.env.TWILIO_PHONE_NUMBER || '',
    accountSid: string = process.env.TWILIO_ACCOUNT_SID || '',
    authToken: string = process.env.TWILIO_AUTH_TOKEN || ''
  ) {
    // 優先使用注入的客戶端，如果沒有提供則創建新的客戶端
    if (twilioClient) {
      this.client = twilioClient;
    } else {
      if (!accountSid || !authToken) {
        logger.error('SMSChannel: 缺少Twilio配置，無法初始化');
      }
      // 創建 Twilio 客戶端
      try {
        this.client = new Twilio(accountSid, authToken);
      } catch (error) {
        logger.error('SMSChannel: 初始化 Twilio 客戶端失敗', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        this.client = null;
      }
    }
    
    this.fromPhoneNumber = fromNumber;
  }

  /**
   * 發送SMS通知
   * @param phoneNumber 接收者的電話號碼 (需為E.164格式: +886912345678)
   * @param content 通知內容
   * @param metadata 附加元數據，可能包含其他參數
   * @returns 發送成功返回true，否則返回false
   */
  async send(phoneNumber: string, content: string, metadata?: any): Promise<boolean> {
    try {
      // 檢查電話號碼格式
      if (!this.isValidPhoneNumber(phoneNumber)) {
        logger.warn('SMSChannel.send: 無效的電話號碼格式', { phoneNumber });
        return false;
      }

      // 檢查SMS通道是否正確初始化
      if (!this.client) {
        logger.error('SMSChannel.send: Twilio 客戶端未初始化');
        return false;
      }

      if (!this.fromPhoneNumber) {
        logger.error('SMSChannel.send: 未配置發送號碼');
        return false;
      }

      // 處理內容長度限制
      const truncatedContent = this.truncateContent(content);

      // 準備傳送參數
      const messageParams: any = {
        body: truncatedContent,
        from: this.fromPhoneNumber,
        to: phoneNumber,
      };

      // 若存在metadata.mediaUrl，添加MMS支持
      if (metadata?.mediaUrl) {
        messageParams.mediaUrl = [metadata.mediaUrl];
      }

      // 發送SMS
      const message = await this.client.messages.create(messageParams);
      
      logger.info('SMSChannel.send: 通知發送成功', { 
        sid: message.sid,
        status: message.status 
      });

      return true;
    } catch (error) {
      // 記錄錯誤
      logger.error('SMSChannel.send: 發送SMS失敗', {
        error: error instanceof Error ? error.message : 'Unknown error',
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        content: content.substring(0, 30) + (content.length > 30 ? '...' : '')
      });

      // 處理特定錯誤
      if (error instanceof Error) {
        // 無效電話號碼
        if (error.message.includes('is not a valid phone number')) {
          logger.warn('SMSChannel.send: 電話號碼無效，應更新數據庫', {
            phoneNumber: this.maskPhoneNumber(phoneNumber)
          });
        }
        
        // 超過發送配額
        if (error.message.includes('quota exceeded')) {
          logger.warn('SMSChannel.send: 已超過發送配額');
        }
      }

      return false;
    }
  }

  /**
   * 驗證電話號碼格式
   * @param phoneNumber 電話號碼
   * @returns 是否為有效的E.164格式
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // E.164格式正則驗證
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * 隱藏部分電話號碼用於日誌
   * @param phoneNumber 完整電話號碼
   * @returns 遮罩後的電話號碼
   */
  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 8) return '******';
    const firstPart = phoneNumber.substring(0, 3);
    const lastPart = phoneNumber.substring(phoneNumber.length - 2);
    return `${firstPart}****${lastPart}`;
  }

  /**
   * 處理超長內容
   * @param content 原始內容
   * @returns 截斷後的內容
   */
  private truncateContent(content: string): string {
    const SMS_MAX_LENGTH = 160;
    
    if (content.length <= SMS_MAX_LENGTH) {
      return content;
    }
    
    // 截斷過長內容並添加省略號
    return content.substring(0, SMS_MAX_LENGTH - 3) + '...';
  }
} 