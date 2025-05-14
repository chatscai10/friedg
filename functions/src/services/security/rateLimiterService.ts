/**
 * API請求速率限制服務
 * 負責防止API濫用和DDoS攻擊
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as express from 'express';

// 速率限制類型
export enum RateLimitType {
  IP = 'ip',
  USER = 'user',
  API_KEY = 'api_key',
  ENDPOINT = 'endpoint'
}

// 速率限制配置
export interface RateLimitConfig {
  type: RateLimitType;
  limit: number;
  windowSeconds: number;
  blockDurationSeconds?: number;
}

// 速率限制記錄
interface RateLimitRecord {
  id?: string;
  type: RateLimitType;
  key: string;
  count: number;
  windowStart: admin.firestore.Timestamp;
  windowEnd: admin.firestore.Timestamp;
  blocked?: boolean;
  blockedUntil?: admin.firestore.Timestamp;
}

/**
 * API請求速率限制服務類
 */
export class RateLimiterService {
  private static instance: RateLimiterService;
  private db: admin.firestore.Firestore;
  private rateLimitCollection = 'rateLimits';
  private configCollection = 'rateLimitConfigs';
  private configs: Map<string, RateLimitConfig> = new Map();
  private cache: Map<string, { count: number; expires: number }> = new Map();
  
  /**
   * 私有構造函數，防止直接實例化
   */
  private constructor() {
    this.db = admin.firestore();
  }
  
  /**
   * 獲取單例實例
   */
  public static getInstance(): RateLimiterService {
    if (!RateLimiterService.instance) {
      RateLimiterService.instance = new RateLimiterService();
    }
    return RateLimiterService.instance;
  }
  
  /**
   * 初始化速率限制服務
   */
  public async initialize(): Promise<void> {
    try {
      // 從Firestore加載速率限制配置
      await this.loadConfigs();
      
      // 設置定期清理任務
      this.scheduleCleanup();
    } catch (error) {
      console.error('初始化速率限制服務失敗:', error);
    }
  }
  
  /**
   * 從Firestore加載速率限制配置
   */
  private async loadConfigs(): Promise<void> {
    try {
      const configsSnapshot = await this.db.collection(this.configCollection).get();
      
      configsSnapshot.forEach(doc => {
        const config = doc.data() as RateLimitConfig;
        this.configs.set(doc.id, config);
      });
      
      // 如果沒有配置，使用默認配置
      if (this.configs.size === 0) {
        this.useDefaultConfigs();
      }
    } catch (error) {
      console.error('加載速率限制配置失敗:', error);
      // 使用默認配置
      this.useDefaultConfigs();
    }
  }
  
  /**
   * 使用默認速率限制配置
   */
  private useDefaultConfigs(): void {
    // 默認IP限制：每分鐘60個請求
    this.configs.set('default_ip', {
      type: RateLimitType.IP,
      limit: 60,
      windowSeconds: 60
    });
    
    // 默認用戶限制：每分鐘100個請求
    this.configs.set('default_user', {
      type: RateLimitType.USER,
      limit: 100,
      windowSeconds: 60
    });
    
    // 默認API密鑰限制：每分鐘200個請求
    this.configs.set('default_api_key', {
      type: RateLimitType.API_KEY,
      limit: 200,
      windowSeconds: 60
    });
    
    // 登錄限制：每分鐘5次嘗試
    this.configs.set('login_ip', {
      type: RateLimitType.IP,
      limit: 5,
      windowSeconds: 60,
      blockDurationSeconds: 300 // 5分鐘
    });
    
    // 註冊限制：每小時3次嘗試
    this.configs.set('register_ip', {
      type: RateLimitType.IP,
      limit: 3,
      windowSeconds: 3600,
      blockDurationSeconds: 3600 // 1小時
    });
  }
  
  /**
   * 設置定期清理任務
   */
  private scheduleCleanup(): void {
    // 每小時清理過期的速率限制記錄
    setInterval(async () => {
      try {
        const now = admin.firestore.Timestamp.now();
        
        // 刪除過期的速率限制記錄
        const expiredRecordsQuery = this.db.collection(this.rateLimitCollection)
          .where('windowEnd', '<', now)
          .where('blocked', '==', false)
          .limit(100);
        
        const expiredRecordsSnapshot = await expiredRecordsQuery.get();
        
        const batch = this.db.batch();
        expiredRecordsSnapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        if (expiredRecordsSnapshot.size > 0) {
          await batch.commit();
          console.log(`已清理 ${expiredRecordsSnapshot.size} 條過期的速率限制記錄`);
        }
        
        // 清理過期的緩存
        const now_ms = Date.now();
        for (const [key, value] of this.cache.entries()) {
          if (value.expires < now_ms) {
            this.cache.delete(key);
          }
        }
      } catch (error) {
        console.error('清理過期的速率限制記錄失敗:', error);
      }
    }, 3600000); // 每小時執行一次
  }
  
  /**
   * 檢查請求是否超過速率限制
   * @param type 限制類型
   * @param key 限制鍵
   * @param configId 配置ID
   * @returns 是否允許請求
   */
  public async checkRateLimit(type: RateLimitType, key: string, configId?: string): Promise<boolean> {
    try {
      // 獲取配置
      const config = this.getConfig(type, configId);
      if (!config) {
        // 如果沒有配置，默認允許請求
        return true;
      }
      
      // 檢查緩存
      const cacheKey = `${type}:${key}:${configId || 'default'}`;
      const cachedValue = this.cache.get(cacheKey);
      
      if (cachedValue) {
        if (cachedValue.count >= config.limit) {
          // 已超過限制
          return false;
        }
        
        // 增加計數
        cachedValue.count++;
        return true;
      }
      
      // 獲取當前時間
      const now = admin.firestore.Timestamp.now();
      
      // 計算時間窗口
      const windowStart = admin.firestore.Timestamp.fromMillis(
        now.toMillis() - (config.windowSeconds * 1000)
      );
      
      // 檢查是否被阻止
      const blockedRecord = await this.db.collection(this.rateLimitCollection)
        .where('type', '==', type)
        .where('key', '==', key)
        .where('blocked', '==', true)
        .where('blockedUntil', '>', now)
        .limit(1)
        .get();
      
      if (!blockedRecord.empty) {
        // 被阻止
        return false;
      }
      
      // 查詢當前時間窗口內的請求數
      const recordRef = this.db.collection(this.rateLimitCollection)
        .doc(`${type}_${key}_${now.toDate().toISOString().split('T')[0]}`);
      
      const record = await recordRef.get();
      
      if (record.exists) {
        const recordData = record.data() as RateLimitRecord;
        
        // 檢查是否在當前時間窗口內
        if (recordData.windowStart.toMillis() <= now.toMillis() && 
            recordData.windowEnd.toMillis() >= now.toMillis()) {
          
          // 檢查是否超過限制
          if (recordData.count >= config.limit) {
            // 如果配置了阻止時間，則阻止
            if (config.blockDurationSeconds) {
              await recordRef.update({
                blocked: true,
                blockedUntil: admin.firestore.Timestamp.fromMillis(
                  now.toMillis() + (config.blockDurationSeconds * 1000)
                )
              });
            }
            
            // 已超過限制
            return false;
          }
          
          // 增加計數
          await recordRef.update({
            count: admin.firestore.FieldValue.increment(1)
          });
          
          // 更新緩存
          this.cache.set(cacheKey, {
            count: recordData.count + 1,
            expires: recordData.windowEnd.toMillis()
          });
          
          return true;
        }
      }
      
      // 創建新記錄
      const windowEnd = admin.firestore.Timestamp.fromMillis(
        now.toMillis() + (config.windowSeconds * 1000)
      );
      
      const newRecord: RateLimitRecord = {
        type,
        key,
        count: 1,
        windowStart: now,
        windowEnd,
        blocked: false
      };
      
      await recordRef.set(newRecord);
      
      // 更新緩存
      this.cache.set(cacheKey, {
        count: 1,
        expires: windowEnd.toMillis()
      });
      
      return true;
    } catch (error) {
      console.error('檢查速率限制失敗:', error);
      // 出錯時默認允許請求
      return true;
    }
  }
  
  /**
   * 獲取速率限制配置
   * @param type 限制類型
   * @param configId 配置ID
   * @returns 速率限制配置
   */
  private getConfig(type: RateLimitType, configId?: string): RateLimitConfig | undefined {
    if (configId && this.configs.has(configId)) {
      return this.configs.get(configId);
    }
    
    // 使用默認配置
    return this.configs.get(`default_${type}`);
  }
  
  /**
   * 創建Express中間件
   * @param type 限制類型
   * @param keyExtractor 鍵提取函數
   * @param configId 配置ID
   * @returns Express中間件
   */
  public createMiddleware(
    type: RateLimitType,
    keyExtractor?: (req: express.Request) => string,
    configId?: string
  ): express.RequestHandler {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        let key: string;
        
        // 提取鍵
        if (keyExtractor) {
          key = keyExtractor(req);
        } else {
          switch (type) {
            case RateLimitType.IP:
              key = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
              break;
            case RateLimitType.USER:
              key = (req as any).user?.uid || 'anonymous';
              break;
            case RateLimitType.API_KEY:
              key = req.headers['x-api-key'] as string || 'unknown';
              break;
            case RateLimitType.ENDPOINT:
              key = `${req.method}:${req.path}`;
              break;
            default:
              key = 'unknown';
          }
        }
        
        // 檢查速率限制
        const allowed = await this.checkRateLimit(type, key, configId);
        
        if (allowed) {
          next();
        } else {
          res.status(429).json({
            error: 'Too Many Requests',
            message: '請求過於頻繁，請稍後再試'
          });
        }
      } catch (error) {
        console.error('速率限制中間件錯誤:', error);
        next();
      }
    };
  }
  
  /**
   * 創建Cloud Functions中間件
   * @param type 限制類型
   * @param keyExtractor 鍵提取函數
   * @param configId 配置ID
   * @returns Cloud Functions中間件
   */
  public createFunctionsMiddleware(
    type: RateLimitType,
    keyExtractor?: (context: functions.https.CallableContext) => string,
    configId?: string
  ): (data: any, context: functions.https.CallableContext) => Promise<any> {
    return async (data: any, context: functions.https.CallableContext) => {
      try {
        let key: string;
        
        // 提取鍵
        if (keyExtractor) {
          key = keyExtractor(context);
        } else {
          switch (type) {
            case RateLimitType.IP:
              key = context.rawRequest.ip || 'unknown';
              break;
            case RateLimitType.USER:
              key = context.auth?.uid || 'anonymous';
              break;
            case RateLimitType.API_KEY:
              key = context.rawRequest.headers['x-api-key'] as string || 'unknown';
              break;
            case RateLimitType.ENDPOINT:
              key = context.rawRequest.url || 'unknown';
              break;
            default:
              key = 'unknown';
          }
        }
        
        // 檢查速率限制
        const allowed = await this.checkRateLimit(type, key, configId);
        
        if (!allowed) {
          throw new functions.https.HttpsError(
            'resource-exhausted',
            '請求過於頻繁，請稍後再試',
            { rateLimitExceeded: true }
          );
        }
        
        return data;
      } catch (error) {
        console.error('速率限制中間件錯誤:', error);
        throw error;
      }
    };
  }
}

// 導出單例實例
export const rateLimiterService = RateLimiterService.getInstance();
