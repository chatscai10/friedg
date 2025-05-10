import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from 'firebase-admin';

/**
 * 通知事件類型枚舉
 */
export enum NotificationEventType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_PREPARING = 'ORDER_PREPARING',
  ORDER_READY = 'ORDER_READY',
  ORDER_DELIVERING = 'ORDER_DELIVERING',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_REJECTED = 'ORDER_REJECTED'
}

/**
 * 通知渠道類型
 */
export enum NotificationChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  APP = 'app',
  WEB = 'web'
}

/**
 * 通知優先級
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 通知狀態
 */
export enum NotificationStatus {
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read'
}

/**
 * 通知類型
 */
export enum NotificationType {
  SYSTEM = 'system',
  ORDER = 'order',
  SCHEDULE = 'schedule',
  INVENTORY = 'inventory',
  EMPLOYEE = 'employee',
  MARKETING = 'marketing',
  ANNOUNCEMENT = 'announcement'
}

/**
 * 通知渠道接口
 */
export interface NotificationChannel {
  /**
   * 發送通知
   * @param recipient 接收者識別符（如設備令牌、電話號碼、電子郵件）
   * @param content 通知內容
   * @param metadata 附加元數據
   * @returns 發送成功返回true，否則返回false
   */
  send(recipient: string, content: string, metadata?: any): Promise<boolean>;
}

/**
 * 通知載荷接口
 */
export interface NotificationPayload {
  /**
   * 接收者ID
   */
  recipientId: string;
  
  /**
   * 通知標題
   */
  title: string;
  
  /**
   * 通知內容
   */
  content: string;
  
  /**
   * 通知事件類型
   */
  eventType: NotificationEventType;
  
  /**
   * 通知渠道類型
   */
  channelType: NotificationChannelType;
  
  /**
   * 相關資源ID（如訂單ID）
   */
  resourceId?: string;
  
  /**
   * 租戶ID
   */
  tenantId: string;
  
  /**
   * 附加元數據
   */
  metadata?: Record<string, any>;
}

/**
 * 通知模板介面
 */
export interface NotificationTemplate {
  /**
   * 模板ID
   */
  templateId: string;
  
  /**
   * 模板名稱
   */
  name: string;
  
  /**
   * 模板描述
   */
  description: string;
  
  /**
   * 各通知渠道的模板內容
   */
  channels: {
    /**
     * 電子郵件模板
     */
    email?: {
      /**
       * 郵件主題模板
       */
      subject: string;
      
      /**
       * 郵件內容模板 (HTML格式)
       */
      body: string;
    };
    
    /**
     * 簡訊模板
     */
    sms?: {
      /**
       * 簡訊內容模板
       */
      message: string;
    };
    
    /**
     * App推送模板
     */
    appPush?: {
      /**
       * 推送標題模板
       */
      title: string;
      
      /**
       * 推送內容模板
       */
      body: string;
    };
    
    /**
     * Web推送模板
     */
    webPush?: {
      /**
       * 推送標題模板
       */
      title: string;
      
      /**
       * 推送內容模板
       */
      body: string;
      
      /**
       * 推送圖標URL
       */
      icon?: string;
    };
  };
  
  /**
   * 佔位符列表
   */
  placeholders: string[];
  
  /**
   * 是否啟用
   */
  isActive: boolean;
  
  /**
   * 租戶ID (用於隔離不同租戶的模板)
   */
  tenantId?: string;
  
  /**
   * 創建時間
   */
  createdAt: Timestamp;
  
  /**
   * 更新時間
   */
  updatedAt: Timestamp;
  
  /**
   * 創建者ID
   */
  createdBy?: string;
  
  /**
   * 更新者ID
   */
  updatedBy?: string;
}

/**
 * 通知日誌接口
 */
export interface NotificationLog {
  /**
   * 通知ID
   */
  id: string;
  
  /**
   * 用戶ID
   */
  userId: string;
  
  /**
   * 訂單ID
   */
  orderId?: string;
  
  /**
   * 事件類型
   */
  eventType: NotificationEventType;
  
  /**
   * 通知渠道
   */
  channel: NotificationChannelType;
  
  /**
   * 實際發送內容
   */
  content: string;
  
  /**
   * 發送狀態
   */
  status: NotificationStatus;
  
  /**
   * 錯誤信息
   */
  errorMessage?: string;
  
  /**
   * 發送時間
   */
  sentAt: Timestamp;
  
  /**
   * 送達時間
   */
  deliveredAt?: Timestamp;
  
  /**
   * 已讀時間
   */
  readAt?: Timestamp;
}

/**
 * 用戶通知偏好接口
 */
export interface NotificationPreferences {
  /**
   * 用戶ID
   */
  userId: string;
  
  /**
   * 各通知渠道設置
   */
  channels: {
    /**
     * 是否啟用App推送
     */
    appPush: boolean;
    
    /**
     * 是否啟用SMS
     */
    sms: boolean;
    
    /**
     * 是否啟用Email
     */
    email: boolean;
  };
  
  /**
   * 是否接收訂單更新通知
   */
  orderUpdates: boolean;
  
  /**
   * 是否接收促銷通知
   */
  promotions: boolean;
  
  /**
   * 勿擾時段
   */
  quietHours: {
    /**
     * 是否啟用勿擾時段
     */
    enabled: boolean;
    
    /**
     * 開始時間, "22:00"
     */
    startTime: string;
    
    /**
     * 結束時間, "08:00"
     */
    endTime: string;
  };
  
  /**
   * 更新時間
   */
  updatedAt: Timestamp;
}

/**
 * 基本通知資料
 */
export interface BaseNotificationPayload {
  title: string;              // 通知標題
  body: string;               // 通知主體內容
  recipients: string[];       // 收件人ID列表 (可能是userIds, employeeIds或email地址等)
  priority: NotificationPriority; // 通知優先級
  type: NotificationType;     // 通知類型
  data?: Record<string, any>; // 附加資料
  sendAt?: Date;              // 定時發送時間
  expiresAt?: Date;           // 過期時間
  templateId?: string;        // 模板ID (如果使用模板)
  appUrl?: string;            // 在應用內的指向連結
  webUrl?: string;            // 在網站上的指向連結
}

/**
 * Email通知特殊參數
 */
export interface EmailNotificationOptions {
  subject: string;            // 郵件主題
  html?: string;              // HTML格式內容
  text?: string;              // 純文字格式內容
  cc?: string[];              // 副本收件人
  bcc?: string[];             // 密件副本收件人
  attachments?: Array<{       // 附件
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  replyTo?: string;           // 回覆地址
  from?: {                    // 寄件人資訊
    name?: string;
    email: string;
  };
}

/**
 * SMS通知特殊參數
 */
export interface SmsNotificationOptions {
  senderId?: string;          // 傳送者ID
  recipient: string;          // 接收者電話號碼
}

/**
 * 推送通知特殊參數
 */
export interface PushNotificationOptions {
  image?: string;              // 推送通知圖片URL
  badge?: number;              // app徽章數字
  sound?: string;              // 通知聲音
  clickAction?: string;        // 點擊時執行的動作
  icon?: string;               // 通知圖標
  vibrate?: boolean | number[]; // 振動模式
  timeToLive?: number;         // 推送過期時間(秒)
  collapseKey?: string;        // 摺疊相同通知的鍵值
  silent?: boolean;            // 是否為靜默推送
}

/**
 * 完整通知請求
 */
export interface NotificationRequest {
  base: BaseNotificationPayload;
  channels: {
    [NotificationChannelType.EMAIL]?: EmailNotificationOptions;
    [NotificationChannelType.SMS]?: SmsNotificationOptions;
    [NotificationChannelType.PUSH]?: PushNotificationOptions;
    [NotificationChannelType.APP]?: Record<string, any>;
    [NotificationChannelType.WEB]?: Record<string, any>;
  };
  tenantId?: string;          // 租戶ID
  storeId?: string;           // 商店ID
}

/**
 * 通知記錄
 */
export interface NotificationRecord {
  id: string;                           // 通知ID
  tenantId?: string;                    // 租戶ID
  storeId?: string;                     // 商店ID
  recipientId: string;                  // 接收者ID
  recipientType: 'user' | 'employee';   // 接收者類型
  title: string;                        // 通知標題
  body: string;                         // 通知內容
  type: NotificationType;               // 通知類型
  priority: NotificationPriority;       // 優先級
  channelType: NotificationChannelType; // 通知渠道
  status: NotificationStatus;           // 通知狀態
  data?: Record<string, any>;           // 附加資料
  readAt?: firestore.Timestamp;         // 已讀時間
  sentAt: firestore.Timestamp;          // 發送時間
  deliveredAt?: firestore.Timestamp;    // 送達時間
  failedReason?: string;                // 失敗原因
  appUrl?: string;                      // 應用內連結
  webUrl?: string;                      // 網站連結
  createdAt: firestore.Timestamp;       // 創建時間
  updatedAt: firestore.Timestamp;       // 更新時間
}

/**
 * 通知發送結果
 */
export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  recipientId?: string;
  channel: NotificationChannelType;
  timestamp: Date;
  error?: Error | string;
  details?: Record<string, any>;
} 