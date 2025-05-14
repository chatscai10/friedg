/**
 * 系統使用情況統計服務
 * 負責追蹤功能使用頻率和用戶活躍度
 */

import { firestore, functions } from '../../firebaseConfig';
import { formatDate, formatDateTime } from '../../utils/dateUtils';

// 使用者活躍度類型
export enum UserActivityType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

// 功能使用統計
export interface FeatureUsageStats {
  id?: string;
  feature: string;
  module: string;
  usageCount: number;
  uniqueUsers: number;
  averageDuration?: number;
  lastUpdated: Date;
}

// 使用者活躍度
export interface UserActivityStats {
  id?: string;
  date: Date;
  type: UserActivityType;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  byRole: Record<string, number>;
  byStore?: Record<string, number>;
}

// 頁面訪問統計
export interface PageViewStats {
  id?: string;
  page: string;
  viewCount: number;
  uniqueUsers: number;
  averageDuration: number;
  bounceRate: number;
  lastUpdated: Date;
}

// 使用者會話
export interface UserSession {
  id?: string;
  userId: string;
  userName?: string;
  userRole?: string;
  storeId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  device: string;
  browser: string;
  os: string;
  ipAddress?: string;
  pagesVisited: Array<{
    page: string;
    timestamp: Date;
    duration?: number;
  }>;
  actions: Array<{
    action: string;
    timestamp: Date;
    details?: Record<string, any>;
  }>;
  isActive: boolean;
}

/**
 * 系統使用情況統計服務類
 */
export class UsageStatsService {
  private readonly featureUsageCollection = 'featureUsageStats';
  private readonly userActivityCollection = 'userActivityStats';
  private readonly pageViewCollection = 'pageViewStats';
  private readonly userSessionCollection = 'userSessions';
  
  /**
   * 獲取功能使用統計
   * @param module 模組名稱
   * @returns 功能使用統計
   */
  async getFeatureUsageStats(module?: string): Promise<FeatureUsageStats[]> {
    try {
      let query = firestore.collection(this.featureUsageCollection);
      
      if (module) {
        query = query.where('module', '==', module);
      }
      
      const snapshot = await query
        .orderBy('usageCount', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated.toDate()
      } as FeatureUsageStats));
    } catch (error) {
      console.error('獲取功能使用統計失敗:', error);
      return [];
    }
  }
  
  /**
   * 獲取使用者活躍度統計
   * @param type 活躍度類型
   * @param limit 限制數量
   * @returns 使用者活躍度統計
   */
  async getUserActivityStats(type: UserActivityType, limit: number = 30): Promise<UserActivityStats[]> {
    try {
      const snapshot = await firestore
        .collection(this.userActivityCollection)
        .where('type', '==', type)
        .orderBy('date', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      } as UserActivityStats));
    } catch (error) {
      console.error('獲取使用者活躍度統計失敗:', error);
      return [];
    }
  }
  
  /**
   * 獲取頁面訪問統計
   * @param limit 限制數量
   * @returns 頁面訪問統計
   */
  async getPageViewStats(limit: number = 20): Promise<PageViewStats[]> {
    try {
      const snapshot = await firestore
        .collection(this.pageViewCollection)
        .orderBy('viewCount', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastUpdated: doc.data().lastUpdated.toDate()
      } as PageViewStats));
    } catch (error) {
      console.error('獲取頁面訪問統計失敗:', error);
      return [];
    }
  }
  
  /**
   * 獲取活躍使用者會話
   * @returns 活躍使用者會話
   */
  async getActiveUserSessions(): Promise<UserSession[]> {
    try {
      const snapshot = await firestore
        .collection(this.userSessionCollection)
        .where('isActive', '==', true)
        .orderBy('startTime', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime?.toDate(),
        pagesVisited: doc.data().pagesVisited.map((pv: any) => ({
          ...pv,
          timestamp: pv.timestamp.toDate()
        })),
        actions: doc.data().actions.map((a: any) => ({
          ...a,
          timestamp: a.timestamp.toDate()
        }))
      } as UserSession));
    } catch (error) {
      console.error('獲取活躍使用者會話失敗:', error);
      return [];
    }
  }
  
  /**
   * 獲取使用者會話歷史
   * @param userId 使用者ID
   * @param limit 限制數量
   * @returns 使用者會話
   */
  async getUserSessionHistory(userId: string, limit: number = 10): Promise<UserSession[]> {
    try {
      const snapshot = await firestore
        .collection(this.userSessionCollection)
        .where('userId', '==', userId)
        .orderBy('startTime', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime?.toDate(),
        pagesVisited: doc.data().pagesVisited.map((pv: any) => ({
          ...pv,
          timestamp: pv.timestamp.toDate()
        })),
        actions: doc.data().actions.map((a: any) => ({
          ...a,
          timestamp: a.timestamp.toDate()
        }))
      } as UserSession));
    } catch (error) {
      console.error('獲取使用者會話歷史失敗:', error);
      return [];
    }
  }
  
  /**
   * 記錄功能使用
   * @param feature 功能名稱
   * @param module 模組名稱
   * @param userId 使用者ID
   * @param duration 使用時長（毫秒）
   * @returns 是否成功
   */
  async logFeatureUsage(feature: string, module: string, userId: string, duration?: number): Promise<boolean> {
    try {
      // 調用Cloud Function記錄功能使用
      await functions.httpsCallable('logFeatureUsage')({
        feature,
        module,
        userId,
        duration
      });
      
      return true;
    } catch (error) {
      console.error('記錄功能使用失敗:', error);
      return false;
    }
  }
  
  /**
   * 記錄頁面訪問
   * @param page 頁面路徑
   * @param userId 使用者ID
   * @returns 是否成功
   */
  async logPageView(page: string, userId: string): Promise<boolean> {
    try {
      // 調用Cloud Function記錄頁面訪問
      await functions.httpsCallable('logPageView')({
        page,
        userId
      });
      
      return true;
    } catch (error) {
      console.error('記錄頁面訪問失敗:', error);
      return false;
    }
  }
  
  /**
   * 開始使用者會話
   * @param userId 使用者ID
   * @param userName 使用者名稱
   * @param userRole 使用者角色
   * @param storeId 店鋪ID
   * @param device 設備
   * @param browser 瀏覽器
   * @param os 操作系統
   * @param ipAddress IP地址
   * @returns 會話ID
   */
  async startUserSession(
    userId: string,
    userName: string,
    userRole: string,
    storeId: string | undefined,
    device: string,
    browser: string,
    os: string,
    ipAddress?: string
  ): Promise<string | null> {
    try {
      // 調用Cloud Function開始使用者會話
      const result = await functions.httpsCallable('startUserSession')({
        userId,
        userName,
        userRole,
        storeId,
        device,
        browser,
        os,
        ipAddress
      });
      
      return result.data.sessionId;
    } catch (error) {
      console.error('開始使用者會話失敗:', error);
      return null;
    }
  }
  
  /**
   * 結束使用者會話
   * @param sessionId 會話ID
   * @returns 是否成功
   */
  async endUserSession(sessionId: string): Promise<boolean> {
    try {
      // 調用Cloud Function結束使用者會話
      await functions.httpsCallable('endUserSession')({
        sessionId
      });
      
      return true;
    } catch (error) {
      console.error('結束使用者會話失敗:', error);
      return false;
    }
  }
  
  /**
   * 獲取模組列表
   * @returns 模組列表
   */
  async getModules(): Promise<string[]> {
    try {
      const snapshot = await firestore
        .collection(this.featureUsageCollection)
        .select('module')
        .get();
      
      const modules = new Set<string>();
      snapshot.docs.forEach(doc => {
        const module = doc.data().module;
        if (module) {
          modules.add(module);
        }
      });
      
      return Array.from(modules);
    } catch (error) {
      console.error('獲取模組列表失敗:', error);
      return [];
    }
  }
}

export default new UsageStatsService();
