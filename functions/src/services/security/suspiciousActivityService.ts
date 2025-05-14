/**
 * 可疑活動監控服務
 * 負責檢測異常登入、異常交易等行為
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// 可疑活動類型
export enum SuspiciousActivityType {
  LOGIN_ATTEMPT = 'login_attempt',
  FAILED_LOGIN = 'failed_login',
  UNUSUAL_LOGIN_LOCATION = 'unusual_login_location',
  UNUSUAL_LOGIN_TIME = 'unusual_login_time',
  UNUSUAL_LOGIN_DEVICE = 'unusual_login_device',
  UNUSUAL_TRANSACTION = 'unusual_transaction',
  LARGE_TRANSACTION = 'large_transaction',
  MULTIPLE_TRANSACTIONS = 'multiple_transactions',
  ACCOUNT_MODIFICATION = 'account_modification',
  PERMISSION_CHANGE = 'permission_change',
  DATA_EXPORT = 'data_export',
  API_ABUSE = 'api_abuse',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt'
}

// 可疑活動嚴重程度
export enum SuspiciousActivitySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 可疑活動狀態
export enum SuspiciousActivityStatus {
  DETECTED = 'detected',
  INVESTIGATING = 'investigating',
  RESOLVED_LEGITIMATE = 'resolved_legitimate',
  RESOLVED_SUSPICIOUS = 'resolved_suspicious',
  RESOLVED_MALICIOUS = 'resolved_malicious',
  IGNORED = 'ignored'
}

// 可疑活動記錄
export interface SuspiciousActivity {
  id?: string;
  type: SuspiciousActivityType;
  severity: SuspiciousActivitySeverity;
  status: SuspiciousActivityStatus;
  timestamp: admin.firestore.Timestamp;
  userId?: string;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  deviceInfo?: {
    userAgent?: string;
    browser?: string;
    os?: string;
    device?: string;
  };
  details?: Record<string, any>;
  relatedActivities?: string[];
  actionsTaken?: string[];
  notes?: string;
  resolvedBy?: string;
  resolvedAt?: admin.firestore.Timestamp;
  tenantId?: string;
  storeId?: string;
}

// 警報配置
export interface AlertConfig {
  type: SuspiciousActivityType;
  severity: SuspiciousActivitySeverity;
  enabled: boolean;
  notifyEmail?: boolean;
  notifySMS?: boolean;
  notifyAdmin?: boolean;
  blockUser?: boolean;
  requireVerification?: boolean;
  threshold?: number;
  timeWindowMinutes?: number;
}

// 警報通知
export interface AlertNotification {
  id?: string;
  activityId: string;
  type: SuspiciousActivityType;
  severity: SuspiciousActivitySeverity;
  timestamp: admin.firestore.Timestamp;
  userId?: string;
  userName?: string;
  message: string;
  details?: Record<string, any>;
  read: boolean;
  readBy?: string;
  readAt?: admin.firestore.Timestamp;
  tenantId?: string;
  storeId?: string;
}

/**
 * 可疑活動監控服務類
 */
export class SuspiciousActivityService {
  private static instance: SuspiciousActivityService;
  private db: admin.firestore.Firestore;
  private activityCollection = 'suspiciousActivities';
  private alertConfigCollection = 'alertConfigs';
  private alertNotificationCollection = 'alertNotifications';
  private userHistoryCollection = 'userLoginHistory';
  private alertConfigs: Map<string, AlertConfig> = new Map();
  
  /**
   * 私有構造函數，防止直接實例化
   */
  private constructor() {
    this.db = admin.firestore();
  }
  
  /**
   * 獲取單例實例
   */
  public static getInstance(): SuspiciousActivityService {
    if (!SuspiciousActivityService.instance) {
      SuspiciousActivityService.instance = new SuspiciousActivityService();
    }
    return SuspiciousActivityService.instance;
  }
  
  /**
   * 初始化可疑活動監控服務
   */
  public async initialize(): Promise<void> {
    try {
      // 從Firestore加載警報配置
      await this.loadAlertConfigs();
    } catch (error) {
      console.error('初始化可疑活動監控服務失敗:', error);
    }
  }
  
  /**
   * 從Firestore加載警報配置
   */
  private async loadAlertConfigs(): Promise<void> {
    try {
      const configsSnapshot = await this.db.collection(this.alertConfigCollection).get();
      
      configsSnapshot.forEach(doc => {
        const config = doc.data() as AlertConfig;
        this.alertConfigs.set(doc.id, config);
      });
      
      // 如果沒有配置，使用默認配置
      if (this.alertConfigs.size === 0) {
        this.useDefaultAlertConfigs();
      }
    } catch (error) {
      console.error('加載警報配置失敗:', error);
      // 使用默認配置
      this.useDefaultAlertConfigs();
    }
  }
  
  /**
   * 使用默認警報配置
   */
  private useDefaultAlertConfigs(): void {
    // 默認警報配置
    const defaultConfigs: Record<string, AlertConfig> = {
      'failed_login': {
        type: SuspiciousActivityType.FAILED_LOGIN,
        severity: SuspiciousActivitySeverity.MEDIUM,
        enabled: true,
        notifyAdmin: true,
        threshold: 5,
        timeWindowMinutes: 10
      },
      'unusual_login_location': {
        type: SuspiciousActivityType.UNUSUAL_LOGIN_LOCATION,
        severity: SuspiciousActivitySeverity.HIGH,
        enabled: true,
        notifyEmail: true,
        notifyAdmin: true,
        requireVerification: true
      },
      'unusual_login_time': {
        type: SuspiciousActivityType.UNUSUAL_LOGIN_TIME,
        severity: SuspiciousActivitySeverity.MEDIUM,
        enabled: true,
        notifyAdmin: true
      },
      'unusual_login_device': {
        type: SuspiciousActivityType.UNUSUAL_LOGIN_DEVICE,
        severity: SuspiciousActivitySeverity.MEDIUM,
        enabled: true,
        notifyEmail: true,
        notifyAdmin: true
      },
      'large_transaction': {
        type: SuspiciousActivityType.LARGE_TRANSACTION,
        severity: SuspiciousActivitySeverity.HIGH,
        enabled: true,
        notifyAdmin: true,
        requireVerification: true
      },
      'multiple_transactions': {
        type: SuspiciousActivityType.MULTIPLE_TRANSACTIONS,
        severity: SuspiciousActivitySeverity.MEDIUM,
        enabled: true,
        notifyAdmin: true,
        threshold: 10,
        timeWindowMinutes: 30
      },
      'permission_change': {
        type: SuspiciousActivityType.PERMISSION_CHANGE,
        severity: SuspiciousActivitySeverity.HIGH,
        enabled: true,
        notifyAdmin: true,
        notifyEmail: true
      },
      'data_export': {
        type: SuspiciousActivityType.DATA_EXPORT,
        severity: SuspiciousActivitySeverity.MEDIUM,
        enabled: true,
        notifyAdmin: true
      },
      'brute_force_attempt': {
        type: SuspiciousActivityType.BRUTE_FORCE_ATTEMPT,
        severity: SuspiciousActivitySeverity.CRITICAL,
        enabled: true,
        notifyAdmin: true,
        blockUser: true,
        threshold: 10,
        timeWindowMinutes: 5
      }
    };
    
    for (const [id, config] of Object.entries(defaultConfigs)) {
      this.alertConfigs.set(id, config);
    }
  }
  
  /**
   * 記錄可疑活動
   * @param activity 可疑活動
   * @returns 活動ID
   */
  public async logActivity(activity: Omit<SuspiciousActivity, 'id' | 'status' | 'timestamp'>): Promise<string> {
    try {
      // 設置默認值
      const now = admin.firestore.Timestamp.now();
      const fullActivity: SuspiciousActivity = {
        ...activity,
        status: SuspiciousActivityStatus.DETECTED,
        timestamp: now
      };
      
      // 保存到Firestore
      const docRef = await this.db.collection(this.activityCollection).add(fullActivity);
      
      // 檢查是否需要觸發警報
      await this.checkAndTriggerAlert(fullActivity, docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('記錄可疑活動失敗:', error);
      throw error;
    }
  }
  
  /**
   * 檢查並觸發警報
   * @param activity 可疑活動
   * @param activityId 活動ID
   */
  private async checkAndTriggerAlert(activity: SuspiciousActivity, activityId: string): Promise<void> {
    try {
      // 獲取警報配置
      const configId = this.getAlertConfigId(activity.type);
      const config = this.alertConfigs.get(configId);
      
      if (!config || !config.enabled) {
        return;
      }
      
      // 檢查閾值
      if (config.threshold && config.timeWindowMinutes) {
        const thresholdMet = await this.checkActivityThreshold(
          activity.type,
          activity.userId,
          activity.ipAddress,
          config.threshold,
          config.timeWindowMinutes
        );
        
        if (!thresholdMet) {
          return;
        }
      }
      
      // 創建警報通知
      const notification: AlertNotification = {
        activityId,
        type: activity.type,
        severity: activity.severity,
        timestamp: activity.timestamp,
        userId: activity.userId,
        userName: activity.userName,
        message: this.generateAlertMessage(activity),
        details: {
          ipAddress: activity.ipAddress,
          location: activity.location,
          deviceInfo: activity.deviceInfo,
          activityDetails: activity.details
        },
        read: false,
        tenantId: activity.tenantId,
        storeId: activity.storeId
      };
      
      await this.db.collection(this.alertNotificationCollection).add(notification);
      
      // 執行警報動作
      await this.executeAlertActions(activity, config, activityId);
    } catch (error) {
      console.error('檢查並觸發警報失敗:', error);
    }
  }
  
  /**
   * 獲取警報配置ID
   * @param type 可疑活動類型
   * @returns 警報配置ID
   */
  private getAlertConfigId(type: SuspiciousActivityType): string {
    // 將枚舉值轉換為小寫字符串
    return type.toString().toLowerCase();
  }
  
  /**
   * 檢查活動閾值
   * @param type 活動類型
   * @param userId 用戶ID
   * @param ipAddress IP地址
   * @param threshold 閾值
   * @param timeWindowMinutes 時間窗口（分鐘）
   * @returns 是否達到閾值
   */
  private async checkActivityThreshold(
    type: SuspiciousActivityType,
    userId?: string,
    ipAddress?: string,
    threshold: number = 1,
    timeWindowMinutes: number = 60
  ): Promise<boolean> {
    try {
      const now = admin.firestore.Timestamp.now();
      const windowStart = admin.firestore.Timestamp.fromMillis(
        now.toMillis() - (timeWindowMinutes * 60 * 1000)
      );
      
      let query = this.db.collection(this.activityCollection)
        .where('type', '==', type)
        .where('timestamp', '>=', windowStart);
      
      if (userId) {
        query = query.where('userId', '==', userId);
      } else if (ipAddress) {
        query = query.where('ipAddress', '==', ipAddress);
      } else {
        // 如果沒有用戶ID和IP地址，無法檢查閾值
        return false;
      }
      
      const snapshot = await query.get();
      
      return snapshot.size >= threshold;
    } catch (error) {
      console.error('檢查活動閾值失敗:', error);
      return false;
    }
  }
  
  /**
   * 生成警報消息
   * @param activity 可疑活動
   * @returns 警報消息
   */
  private generateAlertMessage(activity: SuspiciousActivity): string {
    const userName = activity.userName || activity.userId || '未知用戶';
    const location = activity.location ? 
      `${activity.location.city || ''} ${activity.location.region || ''} ${activity.location.country || ''}`.trim() : 
      '未知位置';
    
    switch (activity.type) {
      case SuspiciousActivityType.FAILED_LOGIN:
        return `用戶 ${userName} 登入失敗多次`;
      case SuspiciousActivityType.UNUSUAL_LOGIN_LOCATION:
        return `用戶 ${userName} 從異常位置 ${location} 登入`;
      case SuspiciousActivityType.UNUSUAL_LOGIN_TIME:
        return `用戶 ${userName} 在異常時間登入`;
      case SuspiciousActivityType.UNUSUAL_LOGIN_DEVICE:
        const device = activity.deviceInfo?.device || activity.deviceInfo?.userAgent || '未知設備';
        return `用戶 ${userName} 使用新設備 ${device} 登入`;
      case SuspiciousActivityType.LARGE_TRANSACTION:
        const amount = activity.details?.amount || '未知金額';
        return `用戶 ${userName} 進行大額交易 ${amount}`;
      case SuspiciousActivityType.MULTIPLE_TRANSACTIONS:
        return `用戶 ${userName} 短時間內進行多筆交易`;
      case SuspiciousActivityType.PERMISSION_CHANGE:
        return `用戶 ${userName} 的權限被修改`;
      case SuspiciousActivityType.DATA_EXPORT:
        return `用戶 ${userName} 導出了系統數據`;
      case SuspiciousActivityType.BRUTE_FORCE_ATTEMPT:
        return `檢測到針對用戶 ${userName} 的暴力破解嘗試`;
      default:
        return `檢測到可疑活動: ${activity.type}`;
    }
  }
  
  /**
   * 執行警報動作
   * @param activity 可疑活動
   * @param config 警報配置
   * @param activityId 活動ID
   */
  private async executeAlertActions(
    activity: SuspiciousActivity,
    config: AlertConfig,
    activityId: string
  ): Promise<void> {
    try {
      const actionsTaken: string[] = [];
      
      // 發送電子郵件通知
      if (config.notifyEmail && activity.userEmail) {
        // TODO: 實現發送電子郵件的邏輯
        actionsTaken.push('sent_email_notification');
      }
      
      // 發送SMS通知
      if (config.notifySMS) {
        // TODO: 實現發送SMS的邏輯
        actionsTaken.push('sent_sms_notification');
      }
      
      // 阻止用戶
      if (config.blockUser && activity.userId) {
        await this.blockUser(activity.userId);
        actionsTaken.push('blocked_user');
      }
      
      // 要求驗證
      if (config.requireVerification && activity.userId) {
        await this.requireVerification(activity.userId);
        actionsTaken.push('required_verification');
      }
      
      // 更新活動記錄
      if (actionsTaken.length > 0) {
        await this.db.collection(this.activityCollection).doc(activityId).update({
          actionsTaken
        });
      }
    } catch (error) {
      console.error('執行警報動作失敗:', error);
    }
  }
  
  /**
   * 阻止用戶
   * @param userId 用戶ID
   */
  private async blockUser(userId: string): Promise<void> {
    try {
      // 禁用用戶帳戶
      await admin.auth().updateUser(userId, {
        disabled: true
      });
      
      // 更新用戶文檔
      await this.db.collection('users').doc(userId).update({
        status: 'blocked',
        blockedAt: admin.firestore.FieldValue.serverTimestamp(),
        blockedReason: 'suspicious_activity'
      });
    } catch (error) {
      console.error('阻止用戶失敗:', error);
      throw error;
    }
  }
  
  /**
   * 要求用戶驗證
   * @param userId 用戶ID
   */
  private async requireVerification(userId: string): Promise<void> {
    try {
      // 更新用戶文檔
      await this.db.collection('users').doc(userId).update({
        requireVerification: true,
        verificationReason: 'suspicious_activity',
        verificationRequestedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('要求用戶驗證失敗:', error);
      throw error;
    }
  }
  
  /**
   * 檢測異常登入
   * @param userId 用戶ID
   * @param ipAddress IP地址
   * @param userAgent 用戶代理
   * @param location 位置信息
   * @param tenantId 租戶ID
   * @returns 是否為異常登入
   */
  public async detectUnusualLogin(
    userId: string,
    ipAddress: string,
    userAgent: string,
    location: SuspiciousActivity['location'],
    tenantId?: string
  ): Promise<boolean> {
    try {
      // 獲取用戶登入歷史
      const historySnapshot = await this.db.collection(this.userHistoryCollection)
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      
      if (historySnapshot.empty) {
        // 沒有登入歷史，記錄當前登入
        await this.recordLoginHistory(userId, ipAddress, userAgent, location, tenantId);
        return false;
      }
      
      const loginHistory = historySnapshot.docs.map(doc => doc.data());
      
      // 檢查位置異常
      const unusualLocation = this.isUnusualLocation(location, loginHistory);
      
      // 檢查設備異常
      const unusualDevice = this.isUnusualDevice(userAgent, loginHistory);
      
      // 檢查時間異常
      const unusualTime = this.isUnusualTime(loginHistory);
      
      // 記錄當前登入
      await this.recordLoginHistory(userId, ipAddress, userAgent, location, tenantId);
      
      // 記錄可疑活動
      if (unusualLocation) {
        await this.logActivity({
          type: SuspiciousActivityType.UNUSUAL_LOGIN_LOCATION,
          severity: SuspiciousActivitySeverity.HIGH,
          userId,
          ipAddress,
          location,
          deviceInfo: {
            userAgent
          },
          tenantId
        });
      }
      
      if (unusualDevice) {
        await this.logActivity({
          type: SuspiciousActivityType.UNUSUAL_LOGIN_DEVICE,
          severity: SuspiciousActivitySeverity.MEDIUM,
          userId,
          ipAddress,
          location,
          deviceInfo: {
            userAgent
          },
          tenantId
        });
      }
      
      if (unusualTime) {
        await this.logActivity({
          type: SuspiciousActivityType.UNUSUAL_LOGIN_TIME,
          severity: SuspiciousActivitySeverity.MEDIUM,
          userId,
          ipAddress,
          location,
          deviceInfo: {
            userAgent
          },
          tenantId
        });
      }
      
      return unusualLocation || unusualDevice || unusualTime;
    } catch (error) {
      console.error('檢測異常登入失敗:', error);
      return false;
    }
  }
  
  /**
   * 記錄登入歷史
   * @param userId 用戶ID
   * @param ipAddress IP地址
   * @param userAgent 用戶代理
   * @param location 位置信息
   * @param tenantId 租戶ID
   */
  private async recordLoginHistory(
    userId: string,
    ipAddress: string,
    userAgent: string,
    location: SuspiciousActivity['location'],
    tenantId?: string
  ): Promise<void> {
    try {
      await this.db.collection(this.userHistoryCollection).add({
        userId,
        ipAddress,
        userAgent,
        location,
        tenantId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('記錄登入歷史失敗:', error);
    }
  }
  
  /**
   * 檢查位置是否異常
   * @param location 當前位置
   * @param loginHistory 登入歷史
   * @returns 是否為異常位置
   */
  private isUnusualLocation(
    location: SuspiciousActivity['location'],
    loginHistory: any[]
  ): boolean {
    if (!location || !location.country) {
      return false;
    }
    
    // 檢查是否有相同國家的登入記錄
    const sameCountryLogin = loginHistory.some(history => 
      history.location && history.location.country === location.country
    );
    
    return !sameCountryLogin;
  }
  
  /**
   * 檢查設備是否異常
   * @param userAgent 當前用戶代理
   * @param loginHistory 登入歷史
   * @returns 是否為異常設備
   */
  private isUnusualDevice(userAgent: string, loginHistory: any[]): boolean {
    if (!userAgent) {
      return false;
    }
    
    // 檢查是否有相同用戶代理的登入記錄
    const sameDeviceLogin = loginHistory.some(history => 
      history.userAgent === userAgent
    );
    
    return !sameDeviceLogin;
  }
  
  /**
   * 檢查時間是否異常
   * @param loginHistory 登入歷史
   * @returns 是否為異常時間
   */
  private isUnusualTime(loginHistory: any[]): boolean {
    const now = new Date();
    const hour = now.getHours();
    
    // 檢查是否在深夜登入（凌晨0點到6點）
    if (hour >= 0 && hour < 6) {
      // 檢查歷史記錄中是否有在這個時間段登入的記錄
      const sameTimeLogin = loginHistory.some(history => {
        const loginTime = history.timestamp.toDate();
        const loginHour = loginTime.getHours();
        return loginHour >= 0 && loginHour < 6;
      });
      
      return !sameTimeLogin;
    }
    
    return false;
  }
}

// 導出單例實例
export const suspiciousActivityService = SuspiciousActivityService.getInstance();
