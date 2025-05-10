import { logger } from 'firebase-functions';
import { NotificationChannel } from '../notification.types';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';

/**
 * 基於Nodemailer的Email通知渠道
 */
export default class EmailChannel implements NotificationChannel {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;

  /**
   * 構造函數
   * @param transporterInstance nodemailer Transporter 實例 (通過依賴注入)
   * @param fromEmail 發件人郵箱
   * @param host SMTP服務器地址 (從環境變數獲取)
   * @param port SMTP服務器端口 (從環境變數獲取)
   * @param user 郵箱用戶名 (從環境變數獲取)
   * @param pass 郵箱密碼 (從環境變數獲取)
   */
  constructor(
    transporterInstance?: nodemailer.Transporter,
    fromEmail: string = process.env.EMAIL_FROM || '',
    host: string = process.env.EMAIL_SMTP_HOST || '',
    port: number = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10),
    user: string = process.env.EMAIL_SMTP_USER || '',
    pass: string = process.env.EMAIL_SMTP_PASS || ''
  ) {
    // 優先使用注入的 transporter 實例，如果沒有提供則創建新的
    if (transporterInstance) {
      this.transporter = transporterInstance;
    } else {
      if (!host || !user || !pass) {
        logger.error('EmailChannel: 缺少SMTP配置，無法初始化');
      }
      
      try {
        this.transporter = nodemailer.createTransport({
          host: host,
          port: port,
          secure: port === 465, // true for 465, false for other ports
          auth: {
            user: user,
            pass: pass,
          },
        });
      } catch (error) {
        logger.error('EmailChannel: 初始化 Nodemailer Transporter 失敗', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        this.transporter = null as any;
      }
    }
    
    // 設置發件人電子郵件地址
    this.fromEmail = fromEmail || user;
  }

  /**
   * 發送Email通知
   * @param emailAddress 接收者的電子郵件地址
   * @param content 通知內容 (可能是純文本或HTML)
   * @param metadata 附加元數據，包含標題、HTML內容選項等
   * @returns 發送成功返回true，否則返回false
   */
  async send(emailAddress: string, content: string, metadata?: any): Promise<boolean> {
    try {
      // 檢查電子郵件地址格式
      if (!this.isValidEmail(emailAddress)) {
        logger.warn('EmailChannel.send: 無效的電子郵件地址格式', { emailAddress });
        return false;
      }

      // 檢查Email通道是否正確初始化
      if (!this.transporter) {
        logger.error('EmailChannel.send: Nodemailer Transporter 未初始化');
        return false;
      }

      if (!this.fromEmail) {
        logger.error('EmailChannel.send: 未配置發件人郵箱');
        return false;
      }

      // 準備郵件配置
      const mailOptions: Mail.Options = {
        from: `"${metadata?.senderName || '訂單通知'}" <${this.fromEmail}>`,
        to: emailAddress,
        subject: metadata?.title || '通知',
        text: content, // 純文本內容
      };

      // 如果提供了HTML內容，則優先使用HTML
      if (metadata?.htmlContent) {
        mailOptions.html = metadata.htmlContent;
      } else if (metadata?.isHtml) {
        // 如果content已經是HTML格式的，直接使用
        mailOptions.html = content;
        delete mailOptions.text;
      }

      // 如果提供了附件
      if (metadata?.attachments) {
        mailOptions.attachments = metadata.attachments;
      }

      // 發送郵件
      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('EmailChannel.send: 郵件發送成功', { 
        messageId: info.messageId,
        emailAddress: this.maskEmail(emailAddress)
      });

      return true;
    } catch (error) {
      // 記錄錯誤
      logger.error('EmailChannel.send: 發送郵件失敗', {
        error: error instanceof Error ? error.message : 'Unknown error',
        emailAddress: this.maskEmail(emailAddress)
      });

      // 處理特定錯誤
      if (error instanceof Error) {
        // 無效郵箱地址
        if (error.message.includes('Invalid email')) {
          logger.warn('EmailChannel.send: 電子郵件地址無效，應更新數據庫', {
            emailAddress: this.maskEmail(emailAddress)
          });
        }
        
        // SMTP錯誤
        if (error.message.includes('SMTP')) {
          logger.warn('EmailChannel.send: SMTP服務器錯誤', {
            emailAddress: this.maskEmail(emailAddress)
          });
        }
      }

      return false;
    }
  }

  /**
   * 驗證電子郵件地址格式
   * @param emailAddress 電子郵件地址
   * @returns 是否為有效的電子郵件地址
   */
  private isValidEmail(emailAddress: string): boolean {
    // 簡單的電子郵件格式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailAddress);
  }

  /**
   * 隱藏部分電子郵件地址用於日誌
   * @param emailAddress 完整電子郵件地址
   * @returns 遮罩後的電子郵件地址
   */
  private maskEmail(emailAddress: string): string {
    try {
      const [localPart, domain] = emailAddress.split('@');
      if (!localPart || !domain) return '******@****.***';
      
      // 只保留本地部分的前2個字符和後1個字符
      const maskedLocalPart = localPart.length <= 4 
        ? '****' 
        : `${localPart.substring(0, 2)}****${localPart.substring(localPart.length - 1)}`;
      
      // 只保留域名的第一段
      const domainParts = domain.split('.');
      const maskedDomain = `${domainParts[0].substring(0, 2)}****${domainParts[domainParts.length - 1]}`;
      
      return `${maskedLocalPart}@${maskedDomain}`;
    } catch (error) {
      return '******@****.***';
    }
  }
} 