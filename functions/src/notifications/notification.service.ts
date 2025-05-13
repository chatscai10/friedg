import { firestore } from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import * as Handlebars from 'handlebars';
import * as twilio from 'twilio';
import { 
  NotificationResult, 
  NotificationRequest, 
  NotificationChannelType, 
  NotificationStatus,
  NotificationRecord,
  NotificationTemplate,
  NotificationType,
  NotificationPriority
} from './notification.types';
import * as admin from 'firebase-admin';

/**
 * 通知服務配置
 */
interface NotificationServiceConfig {
  email: {
    service?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    auth: {
      user: string;
      pass: string;
    };
    defaultFrom: {
      name: string;
      email: string;
    };
  };
  sms?: {
    accountSid: string;
    authToken: string;
    from: string;
  };
  push?: {
    // FCM 相關配置，暫時使用默認值
  };
}

/**
 * 通知服務類別
 * 提供統一的介面來發送不同類型的通知
 */
export class NotificationService {
  private readonly config: NotificationServiceConfig;
  private readonly db: FirebaseFirestore.Firestore;
  private readonly emailTransporter: nodemailer.Transporter | null = null;
  private readonly twilioClient: twilio.Twilio | null = null;
  
  /**
   * 建構子
   */
  constructor(config: NotificationServiceConfig) {
    this.config = config;
    this.db = firestore();
    
    // 初始化郵件傳輸器
    if (config.email) {
      this.emailTransporter = nodemailer.createTransport({
        service: config.email.service,
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.auth.user,
          pass: config.email.auth.pass
        }
      });
    }
    
    // 初始化 Twilio SMS 客戶端
    if (config.sms && config.sms.accountSid && config.sms.authToken) {
      this.twilioClient = twilio.default(config.sms.accountSid, config.sms.authToken);
    }
  }

  /**
   * 取得服務實例 (使用Firebase Functions配置)
   */
  static getInstance(): NotificationService {
    try {
      // 從Firebase Functions配置獲取
      const emailConfig = functions.config().email || {};
      const emailService = emailConfig.service || 'gmail';
      const emailHost = emailConfig.host;
      const emailPort = emailConfig.port ? parseInt(emailConfig.port) : 587;
      const emailSecure = emailConfig.secure === 'true';
      const emailUser = emailConfig.user;
      const emailPass = emailConfig.pass;
      const emailFromName = emailConfig.from_name || '富利得系統';
      const emailFromEmail = emailConfig.from_email || 'noreply@example.com';

      // 獲取 SMS 配置
      const smsConfig = functions.config().sms || {};
      const smsAccountSid = smsConfig.account_sid;
      const smsAuthToken = smsConfig.auth_token;
      const smsFrom = smsConfig.from_number;

      if (!emailUser || !emailPass) {
        console.warn('Email 配置不完整，無法建立郵件傳輸器');
      }

      if (!smsAccountSid || !smsAuthToken || !smsFrom) {
        console.warn('SMS 配置不完整，無法建立簡訊服務');
      }

      return new NotificationService({
        email: {
          service: emailService,
          host: emailHost,
          port: emailPort,
          secure: emailSecure,
          auth: {
            user: emailUser || '',
            pass: emailPass || ''
          },
          defaultFrom: {
            name: emailFromName,
            email: emailFromEmail
          }
        },
        sms: {
          accountSid: smsAccountSid || '',
          authToken: smsAuthToken || '',
          from: smsFrom || ''
        }
      });
    } catch (error) {
      console.error('初始化通知服務失敗:', error);
      
      // 返回默認配置
      return new NotificationService({
        email: {
          auth: {
            user: '',
            pass: ''
          },
          defaultFrom: {
            name: '富利得系統',
            email: 'noreply@example.com'
          }
        }
      });
    }
  }

  /**
   * 發送通知
   * @param request 通知請求
   * @returns 發送結果
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];
    const timestamp = new Date();
    const notificationId = uuidv4();

    try {
      console.log(`開始處理通知 ID: ${notificationId}`);

      // 發送各個渠道的通知
      const channels = Object.keys(request.channels) as NotificationChannelType[];
      
      for (const channel of channels) {
        console.log(`正在通過 ${channel} 渠道發送通知...`);
        
        switch (channel) {
          case NotificationChannelType.EMAIL:
            if (request.channels.email) {
              for (const recipient of request.base.recipients) {
                const emailResult = await this.sendEmail(
                  recipient,
                  request.base,
                  request.channels.email,
                  notificationId
                );
                results.push(emailResult);
              }
            }
            break;
            
          case NotificationChannelType.SMS:
            // 待實作
            break;
            
          case NotificationChannelType.PUSH:
            // 待實作
            break;
            
          case NotificationChannelType.APP:
            // 待實作
            break;
            
          case NotificationChannelType.WEB:
            // 待實作
            break;
            
          default:
            console.warn(`未支援的通知渠道: ${channel}`);
            break;
        }
      }

      return results;
    } catch (error) {
      console.error(`發送通知失敗 (ID: ${notificationId}):`, error);
      
      // 返回通用錯誤結果
      return [{
        success: false,
        notificationId,
        channel: NotificationChannelType.EMAIL,
        timestamp,
        error: error instanceof Error ? error : new Error(String(error))
      }];
    }
  }

  /**
   * 發送電子郵件通知
   * @param recipient 收件人地址
   * @param basePayload 基本通知資料
   * @param emailOptions Email特定選項
   * @param notificationId 通知ID
   * @returns 發送結果
   */
  private async sendEmail(
    recipient: string,
    basePayload: NotificationRequest['base'],
    emailOptions: NotificationRequest['channels']['email'],
    notificationId: string
  ): Promise<NotificationResult> {
    const timestamp = new Date();
    
    if (!this.emailTransporter) {
      const error = new Error('Email服務未初始化');
      return {
        success: false,
        notificationId,
        recipientId: recipient,
        channel: NotificationChannelType.EMAIL,
        timestamp,
        error
      };
    }

    if (!emailOptions) {
      const error = new Error('Email選項不能為空');
      return {
        success: false,
        notificationId,
        recipientId: recipient,
        channel: NotificationChannelType.EMAIL,
        timestamp,
        error
      };
    }

    try {
      // 創建郵件選項
      const mailOptions: nodemailer.SendMailOptions = {
        from: emailOptions.from 
          ? `"${emailOptions.from.name || this.config.email.defaultFrom.name}" <${emailOptions.from.email || this.config.email.defaultFrom.email}>`
          : `"${this.config.email.defaultFrom.name}" <${this.config.email.defaultFrom.email}>`,
        to: recipient,
        subject: emailOptions.subject || basePayload.title,
        text: emailOptions.text || basePayload.body,
        html: emailOptions.html || `<div>${basePayload.body}</div>`,
        cc: emailOptions.cc,
        bcc: emailOptions.bcc,
        replyTo: emailOptions.replyTo,
        attachments: emailOptions.attachments
      };

      // 創建通知記錄
      const recordData: Omit<NotificationRecord, 'id'> = {
        recipientId: recipient,
        recipientType: recipient.includes('@') ? 'user' : 'employee',
        title: basePayload.title,
        body: basePayload.body,
        type: basePayload.type,
        priority: basePayload.priority,
        channelType: NotificationChannelType.EMAIL,
        status: NotificationStatus.SENDING,
        data: {
          ...basePayload.data,
          emailOptions: {
            subject: emailOptions.subject,
            cc: emailOptions.cc,
            bcc: emailOptions.bcc
          }
        },
        sentAt: firestore.Timestamp.now(),
        appUrl: basePayload.appUrl,
        webUrl: basePayload.webUrl,
        tenantId: basePayload.data?.tenantId,
        storeId: basePayload.data?.storeId,
        createdAt: firestore.Timestamp.now(),
        updatedAt: firestore.Timestamp.now()
      };

      // 儲存通知記錄
      const recordRef = this.db.collection('notifications').doc(notificationId);
      await recordRef.set(recordData);

      // 發送郵件
      console.log(`發送郵件至 ${recipient}`);
      const info = await this.emailTransporter.sendMail(mailOptions);

      // 更新通知狀態
      await recordRef.update({
        status: NotificationStatus.SENT,
        updatedAt: firestore.Timestamp.now(),
        data: {
          ...recordData.data,
          messageId: info.messageId,
          response: info.response
        }
      });

      // 返回成功結果
      return {
        success: true,
        notificationId,
        recipientId: recipient,
        channel: NotificationChannelType.EMAIL,
        timestamp,
        details: {
          messageId: info.messageId,
          response: info.response
        }
      };
    } catch (error) {
      console.error(`發送郵件失敗 (${recipient}):`, error);
      
      // 更新通知記錄為失敗狀態
      try {
        await this.db.collection('notifications').doc(notificationId).update({
          status: NotificationStatus.FAILED,
          failedReason: error instanceof Error ? error.message : String(error),
          updatedAt: firestore.Timestamp.now()
        });
      } catch (dbError) {
        console.error('更新通知狀態失敗:', dbError);
      }

      // 返回錯誤結果
      return {
        success: false,
        notificationId,
        recipientId: recipient,
        channel: NotificationChannelType.EMAIL,
        timestamp,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * 標記通知為已讀
   * @param notificationId 通知ID
   * @param userId 用戶ID
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const notificationRef = this.db.collection('notifications').doc(notificationId);
      const notificationDoc = await notificationRef.get();
      
      if (!notificationDoc.exists) {
        throw new Error('通知不存在');
      }
      
      const notificationData = notificationDoc.data() as NotificationRecord;
      
      // 驗證用戶是否是通知的接收者
      if (notificationData.recipientId !== userId) {
        throw new Error('無權標記此通知為已讀');
      }
      
      // 更新通知狀態
      await notificationRef.update({
        status: NotificationStatus.READ,
        readAt: firestore.Timestamp.now(),
        updatedAt: firestore.Timestamp.now()
      });
      
      console.log(`通知 ${notificationId} 已被用戶 ${userId} 標記為已讀`);
    } catch (error) {
      console.error('標記通知為已讀失敗:', error);
      throw error;
    }
  }
  
  /**
   * 獲取用戶的通知列表
   * @param userId 用戶ID
   * @param limit 限制數量
   * @param page 頁碼
   */
  async getUserNotifications(userId: string, limit = 10, page = 1): Promise<{
    notifications: NotificationRecord[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      // 計算總數
      const countQuery = await this.db.collection('notifications')
        .where('recipientId', '==', userId)
        .count()
        .get();
      
      const totalCount = countQuery.data().count;
      const totalPages = Math.ceil(totalCount / limit);
      const offset = (page - 1) * limit;
      
      // 獲取通知
      const querySnapshot = await this.db.collection('notifications')
        .where('recipientId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();
      
      const notifications = querySnapshot.docs.map(doc => {
        const data = doc.data() as Omit<NotificationRecord, 'id'>;
        return { id: doc.id, ...data } as NotificationRecord;
      });
      
      return {
        notifications,
        totalCount,
        totalPages,
        currentPage: page
      };
    } catch (error) {
      console.error('獲取用戶通知失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取通知模板
   * @param templateId 模板ID
   * @param tenantId 租戶ID (可選)
   * @returns 通知模板或null
   */
  async getTemplate(templateId: string, tenantId?: string): Promise<NotificationTemplate | null> {
    try {
      console.log(`正在獲取模板：${templateId}${tenantId ? `，租戶：${tenantId}` : ''}`);
      
      // 構建查詢
      let query = this.db.collection('notificationTemplates').where('templateId', '==', templateId);
      
      // 如果提供了租戶ID，則限制為特定租戶的模板
      if (tenantId) {
        query = query.where('tenantId', '==', tenantId);
      }
      
      // 獲取模板文檔
      const querySnapshot = await query.where('isActive', '==', true).limit(1).get();
      
      if (querySnapshot.empty) {
        console.warn(`未找到模板：${templateId}`);
        return null;
      }
      
      // 獲取文檔數據
      const templateDoc = querySnapshot.docs[0];
      const templateData = templateDoc.data() as NotificationTemplate;
      
      console.log(`成功獲取模板：${templateId}`);
      return templateData;
    } catch (error) {
      console.error(`獲取模板失敗 (ID: ${templateId}):`, error);
      return null;
    }
  }
  
  /**
   * 使用 Handlebars 渲染模板
   * @param templateString 模板字符串
   * @param data 數據對象
   * @returns 渲染後的字符串
   */
  private renderTemplate(templateString: string, data: Record<string, any>): string {
    try {
      // 編譯模板
      const template = Handlebars.compile(templateString);
      
      // 渲染並返回結果
      return template(data);
    } catch (error) {
      console.error('渲染模板失敗:', error);
      // 發生錯誤時返回原模板
      return templateString;
    }
  }
  
  /**
   * 使用模板發送電子郵件
   * @param recipientEmail 收件人電子郵件地址
   * @param templateId 模板ID
   * @param data 填充模板的數據
   * @param tenantId 租戶ID (可選)
   * @param options 額外選項
   * @returns 發送結果
   */
  async sendEmailWithTemplate(
    recipientEmail: string,
    templateId: string,
    data: Record<string, any>,
    tenantId?: string,
    options?: {
      from?: { name?: string; email?: string };
      cc?: string[];
      bcc?: string[];
      attachments?: any[];
    }
  ): Promise<NotificationResult> {
    const timestamp = new Date();
    const notificationId = uuidv4();
    
    try {
      // 檢查郵件傳輸器是否初始化
      if (!this.emailTransporter) {
        throw new Error('郵件傳輸器未初始化');
      }
      
      // 獲取模板
      const template = await this.getTemplate(templateId, tenantId);
      
      if (!template || !template.channels.email) {
        throw new Error(`未找到有效的郵件模板: ${templateId}`);
      }
      
      // 渲染模板
      const subject = this.renderTemplate(template.channels.email.subject, data);
      const body = this.renderTemplate(template.channels.email.body, data);
      
      // 設置發件人信息
      const fromName = options?.from?.name || this.config.email.defaultFrom.name;
      const fromEmail = options?.from?.email || this.config.email.defaultFrom.email;
      
      // 構建郵件選項
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: recipientEmail,
        subject,
        html: body
      };
      
      // 添加抄送和密送選項 (如果有)
      if (options?.cc && options.cc.length > 0) {
        mailOptions.cc = options.cc;
      }
      
      if (options?.bcc && options.bcc.length > 0) {
        mailOptions.bcc = options.bcc;
      }
      
      // 添加附件 (如果有)
      if (options?.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments;
      }
      
      // 發送郵件
      const info = await this.emailTransporter.sendMail(mailOptions);
      
      console.log(`郵件已發送，ID: ${info.messageId}`);
      
      // 記錄發送記錄到 Firestore
      await this.db.collection('notifications').add({
        notificationId,
        templateId,
        recipientId: recipientEmail,
        channelType: NotificationChannelType.EMAIL,
        status: NotificationStatus.SENT,
        sentAt: timestamp,
        subject,
        content: body,
        messageId: info.messageId,
        data: data,
        tenantId
      });
      
      // 返回成功結果
      return {
        success: true,
        notificationId,
        channel: NotificationChannelType.EMAIL,
        timestamp
      };
    } catch (error) {
      console.error(`發送模板郵件失敗 (ID: ${notificationId}):`, error);
      
      // 記錄失敗記錄到 Firestore
      await this.db.collection('notifications').add({
        notificationId,
        templateId,
        recipientId: recipientEmail,
        channelType: NotificationChannelType.EMAIL,
        status: NotificationStatus.FAILED,
        sentAt: timestamp,
        error: error instanceof Error ? error.message : String(error),
        data: data,
        tenantId
      });
      
      // 返回失敗結果
      return {
        success: false,
        notificationId,
        channel: NotificationChannelType.EMAIL,
        timestamp,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * 發送 SMS 簡訊
   * @param recipientPhoneNumber 收件人電話號碼
   * @param templateId 模板ID
   * @param data 填充模板的數據
   * @param tenantId 租戶ID (可選)
   * @returns 發送結果
   */
  async sendSms(
    recipientPhoneNumber: string,
    templateId: string,
    data: Record<string, any>,
    tenantId?: string
  ): Promise<NotificationResult> {
    const timestamp = new Date();
    const notificationId = uuidv4();
    
    try {
      // 檢查 Twilio 客戶端是否初始化
      if (!this.twilioClient) {
        throw new Error('SMS 服務未初始化');
      }
      
      // 檢查電話號碼格式
      if (!recipientPhoneNumber.startsWith('+')) {
        // 確保電話號碼包含國碼 (E.164 格式)
        console.warn('電話號碼未包含國碼，嘗試添加默認台灣國碼 +886');
        
        // 移除開頭的 0，並添加台灣國碼
        if (recipientPhoneNumber.startsWith('0')) {
          recipientPhoneNumber = '+886' + recipientPhoneNumber.substring(1);
        } else {
          recipientPhoneNumber = '+886' + recipientPhoneNumber;
        }
      }
      
      // 獲取模板
      const template = await this.getTemplate(templateId, tenantId);
      
      if (!template || !template.channels.sms) {
        throw new Error(`未找到有效的簡訊模板: ${templateId}`);
      }
      
      // 渲染模板
      const message = this.renderTemplate(template.channels.sms.message, data);
      
      // 發送簡訊
      console.log(`正在發送簡訊到 ${recipientPhoneNumber}`);
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.config.sms?.from || '',
        to: recipientPhoneNumber
      });
      
      console.log(`簡訊已發送，SID: ${result.sid}`);
      
      // 記錄發送記錄到 Firestore
      await this.db.collection('notifications').add({
        notificationId,
        templateId,
        recipientId: recipientPhoneNumber,
        channelType: NotificationChannelType.SMS,
        status: NotificationStatus.SENT,
        sentAt: timestamp,
        content: message,
        messageId: result.sid,
        data: data,
        tenantId
      });
      
      // 返回成功結果
      return {
        success: true,
        notificationId,
        recipientId: recipientPhoneNumber,
        channel: NotificationChannelType.SMS,
        timestamp,
        details: {
          messageId: result.sid,
          status: result.status
        }
      };
    } catch (error) {
      console.error(`發送簡訊失敗 (ID: ${notificationId}):`, error);
      
      // 記錄失敗記錄到 Firestore
      await this.db.collection('notifications').add({
        notificationId,
        templateId,
        recipientId: recipientPhoneNumber,
        channelType: NotificationChannelType.SMS,
        status: NotificationStatus.FAILED,
        sentAt: timestamp,
        error: error instanceof Error ? error.message : String(error),
        data: data,
        tenantId
      });
      
      // 返回失敗結果
      return {
        success: false,
        notificationId,
        recipientId: recipientPhoneNumber,
        channel: NotificationChannelType.SMS,
        timestamp,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * 使用模板發送 SMS 簡訊 (兼容舊接口命名)
   * @param phoneNumber 收件人電話號碼
   * @param templateId 模板ID
   * @param data 填充模板的數據
   * @param tenantId 租戶ID (可選)
   * @returns 發送結果
   */
  async sendSmsWithTemplate(
    phoneNumber: string,
    templateId: string,
    data: Record<string, any>,
    tenantId?: string
  ): Promise<NotificationResult> {
    return this.sendSms(phoneNumber, templateId, data, tenantId);
  }

  /**
   * 發送推播通知
   * @param recipientUserId 接收者用戶ID
   * @param templateId 通知模板ID
   * @param data 模板數據
   * @param tenantId 租戶ID (可選)
   * @returns 推播通知結果
   */
  async sendPushNotification(
    recipientUserId: string,
    templateId: string,
    data: Record<string, any>,
    tenantId?: string
  ): Promise<NotificationResult> {
    const timestamp = new Date();
    const notificationId = uuidv4();
    
    try {
      console.log(`開始發送推播通知 (ID: ${notificationId}, User: ${recipientUserId})`);
      
      // 獲取模板
      const template = await this.getTemplate(templateId, tenantId);
      if (!template) {
        throw new Error(`找不到通知模板: ${templateId}`);
      }
      
      // 檢查模板是否包含 appPush 通道配置
      if (!template.channels.appPush?.title || !template.channels.appPush?.body) {
        throw new Error(`模板 ${templateId} 未定義 appPush 通道內容`);
      }
      
      // 渲染模板內容
      const renderedTitle = this.renderTemplate(template.channels.appPush.title, data);
      const renderedBody = this.renderTemplate(template.channels.appPush.body, data);
      
      // 獲取用戶的FCM令牌
      const userDoc = await this.db.collection('employees').doc(recipientUserId).get();
      
      if (!userDoc.exists) {
        throw new Error(`找不到用戶: ${recipientUserId}`);
      }
      
      const userData = userDoc.data();
      
      // 從用戶文檔中獲取 FCM 令牌
      const fcmTokens: string[] = userData?.fcmTokens || [];
      
      if (!fcmTokens || fcmTokens.length === 0) {
        console.warn(`用戶 ${recipientUserId} 沒有註冊FCM令牌`);
        return {
          success: false,
          notificationId,
          recipientId: recipientUserId,
          channel: NotificationChannelType.PUSH,
          timestamp,
          error: new Error('用戶未註冊FCM令牌')
        };
      }
      
      console.log(`為用戶 ${recipientUserId} 發送推播通知到 ${fcmTokens.length} 個設備`);
      
      // 準備FCM消息
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: {
          title: renderedTitle,
          body: renderedBody
        },
        data: {
          ...data,
          notificationId,
          templateId,
          // 確保所有值都是字符串
          ...Object.entries(data).reduce((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {} as Record<string, string>)
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'general_notifications'
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
      
      // 發送FCM多播消息
      const response = await admin.messaging().sendEachForMulticast(message);
      
      // 記錄通知發送
      const notificationRecord: NotificationRecord = {
        id: notificationId,
        recipientId: recipientUserId,
        recipientType: 'employee', // 假設接收者是員工
        title: renderedTitle,
        body: renderedBody,
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.NORMAL,
        channelType: NotificationChannelType.PUSH,
        status: response.failureCount === fcmTokens.length 
          ? NotificationStatus.FAILED 
          : (response.failureCount > 0 ? NotificationStatus.SENT : NotificationStatus.DELIVERED),
        sentAt: firestore.Timestamp.fromDate(timestamp),
        deliveredAt: response.successCount > 0 
          ? firestore.Timestamp.fromDate(new Date()) 
          : undefined,
        createdAt: firestore.Timestamp.fromDate(timestamp),
        updatedAt: firestore.Timestamp.fromDate(timestamp),
        data: data
      };
      
      await this.db.collection('notifications').doc(notificationId).set(notificationRecord);
      
      // 檢查是否有無效的令牌，並更新用戶的FCM令牌列表
      const invalidTokens: string[] = [];
      
      if (response.responses) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(fcmTokens[idx]);
          }
        });
      }
      
      // 如果有無效的令牌，從用戶的FCM令牌列表中移除
      if (invalidTokens.length > 0) {
        console.log(`移除 ${invalidTokens.length} 個無效的FCM令牌`);
        const validTokens = fcmTokens.filter(token => !invalidTokens.includes(token));
        
        // 更新用戶的FCM令牌列表
        await this.db.collection('employees').doc(recipientUserId).update({
          fcmTokens: validTokens
        });
      }
      
      // 準備返回結果
      const result: NotificationResult = {
        success: response.successCount > 0,
        notificationId,
        recipientId: recipientUserId,
        channel: NotificationChannelType.PUSH,
        timestamp,
        details: {
          successCount: response.successCount,
          failureCount: response.failureCount,
          invalidTokensRemoved: invalidTokens.length
        }
      };
      
      if (response.failureCount > 0 && response.failureCount === fcmTokens.length) {
        result.error = new Error('所有推播通知發送失敗');
      }
      
      return result;
    } catch (error) {
      console.error(`發送推播通知失敗 (ID: ${notificationId}):`, error);
      
      // 記錄發送失敗的通知
      const failedNotification: NotificationRecord = {
        id: notificationId,
        recipientId: recipientUserId,
        recipientType: 'employee',
        title: '通知發送失敗',
        body: '系統無法發送推播通知',
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.NORMAL,
        channelType: NotificationChannelType.PUSH,
        status: NotificationStatus.FAILED,
        sentAt: firestore.Timestamp.fromDate(timestamp),
        failedReason: error instanceof Error ? error.message : String(error),
        createdAt: firestore.Timestamp.fromDate(timestamp),
        updatedAt: firestore.Timestamp.fromDate(timestamp),
        data: data
      };
      
      try {
        await this.db.collection('notifications').doc(notificationId).set(failedNotification);
      } catch (dbError) {
        console.error('記錄失敗通知時出錯:', dbError);
      }
      
      return {
        success: false,
        notificationId,
        recipientId: recipientUserId,
        channel: NotificationChannelType.PUSH,
        timestamp,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

// 導出單例實例
export const notificationService = NotificationService.getInstance();
