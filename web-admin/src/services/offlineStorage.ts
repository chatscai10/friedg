/**
 * 離線存儲服務
 * 提供離線資料存儲、同步和衝突解決功能
 */

import { openDB, IDBPDatabase } from 'idb';
import { getAuth } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';

// 離線資料庫名稱和版本
const DB_NAME = 'friedg-offline-db';
const DB_VERSION = 1;

// 離線存儲的集合名稱
export enum OfflineStoreNames {
  PENDING_OPERATIONS = 'pendingOperations',
  CACHED_DOCUMENTS = 'cachedDocuments',
  OFFLINE_SETTINGS = 'offlineSettings',
  SYNC_LOGS = 'syncLogs'
}

// 操作類型
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

// 同步狀態
export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CONFLICT = 'conflict'
}

// 優先級
export enum SyncPriority {
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3
}

// 待同步操作
export interface PendingOperation {
  id: string;
  timestamp: number;
  userId: string;
  tenantId: string;
  storeId?: string;
  collection: string;
  documentId: string;
  operation: OperationType;
  data?: any;
  priority: SyncPriority;
  status: SyncStatus;
  retryCount: number;
  lastAttempt?: number;
  error?: string;
  conflictResolution?: 'client' | 'server' | 'manual';
  serverTimestamp?: number;
}

// 緩存文檔
export interface CachedDocument {
  id: string;
  collection: string;
  documentId: string;
  data: any;
  timestamp: number;
  userId: string;
  tenantId: string;
  storeId?: string;
  isOfflineCreated: boolean;
  lastSyncedAt?: number;
  version: number;
}

// 同步日誌
export interface SyncLog {
  id: string;
  timestamp: number;
  userId: string;
  tenantId: string;
  storeId?: string;
  operationId: string;
  collection: string;
  documentId: string;
  operation: OperationType;
  status: SyncStatus;
  error?: string;
  syncDuration?: number;
}

// 離線設置
export interface OfflineSettings {
  id: string;
  userId: string;
  enableOfflineMode: boolean;
  syncInterval: number;
  maxCacheSize: number;
  priorityCollections: string[];
  lastFullSync: number;
}

/**
 * 離線存儲服務類
 */
export class OfflineStorageService {
  private db: IDBPDatabase | null = null;
  private isInitialized = false;
  private userId: string | null = null;
  private tenantId: string | null = null;
  private storeId: string | null = null;

  /**
   * 初始化離線存儲
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 獲取當前用戶信息
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('用戶未登入，無法初始化離線存儲');
      }
      
      this.userId = user.uid;
      
      // 從用戶聲明中獲取租戶ID和店鋪ID
      const idTokenResult = await user.getIdTokenResult();
      this.tenantId = idTokenResult.claims.tenantId as string || null;
      this.storeId = idTokenResult.claims.storeId as string || null;
      
      // 打開IndexedDB數據庫
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // 創建存儲
          if (!db.objectStoreNames.contains(OfflineStoreNames.PENDING_OPERATIONS)) {
            const pendingOpsStore = db.createObjectStore(OfflineStoreNames.PENDING_OPERATIONS, { keyPath: 'id' });
            pendingOpsStore.createIndex('by-status', 'status', { unique: false });
            pendingOpsStore.createIndex('by-priority', 'priority', { unique: false });
            pendingOpsStore.createIndex('by-collection', 'collection', { unique: false });
            pendingOpsStore.createIndex('by-timestamp', 'timestamp', { unique: false });
            pendingOpsStore.createIndex('by-user', 'userId', { unique: false });
            pendingOpsStore.createIndex('by-tenant', 'tenantId', { unique: false });
            pendingOpsStore.createIndex('by-store', 'storeId', { unique: false });
          }
          
          if (!db.objectStoreNames.contains(OfflineStoreNames.CACHED_DOCUMENTS)) {
            const cachedDocsStore = db.createObjectStore(OfflineStoreNames.CACHED_DOCUMENTS, { keyPath: 'id' });
            cachedDocsStore.createIndex('by-collection-doc', ['collection', 'documentId'], { unique: true });
            cachedDocsStore.createIndex('by-collection', 'collection', { unique: false });
            cachedDocsStore.createIndex('by-timestamp', 'timestamp', { unique: false });
            cachedDocsStore.createIndex('by-user', 'userId', { unique: false });
            cachedDocsStore.createIndex('by-tenant', 'tenantId', { unique: false });
            cachedDocsStore.createIndex('by-store', 'storeId', { unique: false });
          }
          
          if (!db.objectStoreNames.contains(OfflineStoreNames.OFFLINE_SETTINGS)) {
            const settingsStore = db.createObjectStore(OfflineStoreNames.OFFLINE_SETTINGS, { keyPath: 'id' });
            settingsStore.createIndex('by-user', 'userId', { unique: true });
          }
          
          if (!db.objectStoreNames.contains(OfflineStoreNames.SYNC_LOGS)) {
            const logsStore = db.createObjectStore(OfflineStoreNames.SYNC_LOGS, { keyPath: 'id' });
            logsStore.createIndex('by-timestamp', 'timestamp', { unique: false });
            logsStore.createIndex('by-user', 'userId', { unique: false });
            logsStore.createIndex('by-operation', 'operationId', { unique: false });
            logsStore.createIndex('by-status', 'status', { unique: false });
          }
        }
      });
      
      // 初始化用戶的離線設置
      await this.initializeUserSettings();
      
      this.isInitialized = true;
      console.log('離線存儲初始化成功');
    } catch (error) {
      console.error('初始化離線存儲失敗:', error);
      throw error;
    }
  }

  /**
   * 初始化用戶的離線設置
   */
  private async initializeUserSettings(): Promise<void> {
    if (!this.db || !this.userId) return;
    
    try {
      // 檢查用戶是否已有設置
      const existingSettings = await this.db.getFromIndex(
        OfflineStoreNames.OFFLINE_SETTINGS,
        'by-user',
        this.userId
      );
      
      if (!existingSettings) {
        // 創建默認設置
        const defaultSettings: OfflineSettings = {
          id: uuidv4(),
          userId: this.userId,
          enableOfflineMode: true,
          syncInterval: 60000, // 1分鐘
          maxCacheSize: 50 * 1024 * 1024, // 50MB
          priorityCollections: ['orders', 'menuItems', 'inventoryItems'],
          lastFullSync: Date.now()
        };
        
        await this.db.add(OfflineStoreNames.OFFLINE_SETTINGS, defaultSettings);
      }
    } catch (error) {
      console.error('初始化用戶離線設置失敗:', error);
    }
  }

  /**
   * 獲取用戶的離線設置
   */
  async getOfflineSettings(): Promise<OfflineSettings | null> {
    if (!this.db || !this.userId) return null;
    
    try {
      return await this.db.getFromIndex(
        OfflineStoreNames.OFFLINE_SETTINGS,
        'by-user',
        this.userId
      );
    } catch (error) {
      console.error('獲取離線設置失敗:', error);
      return null;
    }
  }

  /**
   * 更新用戶的離線設置
   */
  async updateOfflineSettings(settings: Partial<OfflineSettings>): Promise<void> {
    if (!this.db || !this.userId) return;
    
    try {
      const currentSettings = await this.getOfflineSettings();
      
      if (currentSettings) {
        const updatedSettings = {
          ...currentSettings,
          ...settings
        };
        
        await this.db.put(OfflineStoreNames.OFFLINE_SETTINGS, updatedSettings);
      }
    } catch (error) {
      console.error('更新離線設置失敗:', error);
    }
  }

  /**
   * 緩存文檔
   */
  async cacheDocument(collection: string, documentId: string, data: any, isOfflineCreated = false): Promise<string> {
    if (!this.db || !this.userId || !this.tenantId) {
      throw new Error('離線存儲未初始化或用戶未登入');
    }
    
    try {
      // 檢查文檔是否已存在
      const existingDoc = await this.getCachedDocument(collection, documentId);
      
      const cachedDoc: CachedDocument = {
        id: existingDoc ? existingDoc.id : uuidv4(),
        collection,
        documentId,
        data,
        timestamp: Date.now(),
        userId: this.userId,
        tenantId: this.tenantId,
        storeId: this.storeId || undefined,
        isOfflineCreated,
        version: existingDoc ? existingDoc.version + 1 : 1
      };
      
      await this.db.put(OfflineStoreNames.CACHED_DOCUMENTS, cachedDoc);
      
      return cachedDoc.id;
    } catch (error) {
      console.error('緩存文檔失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取緩存文檔
   */
  async getCachedDocument(collection: string, documentId: string): Promise<CachedDocument | null> {
    if (!this.db) return null;
    
    try {
      return await this.db.getFromIndex(
        OfflineStoreNames.CACHED_DOCUMENTS,
        'by-collection-doc',
        [collection, documentId]
      );
    } catch (error) {
      console.error('獲取緩存文檔失敗:', error);
      return null;
    }
  }

  /**
   * 獲取集合中的所有緩存文檔
   */
  async getCachedDocumentsByCollection(collection: string): Promise<CachedDocument[]> {
    if (!this.db) return [];
    
    try {
      return await this.db.getAllFromIndex(
        OfflineStoreNames.CACHED_DOCUMENTS,
        'by-collection',
        collection
      );
    } catch (error) {
      console.error('獲取集合緩存文檔失敗:', error);
      return [];
    }
  }

  /**
   * 刪除緩存文檔
   */
  async deleteCachedDocument(collection: string, documentId: string): Promise<void> {
    if (!this.db) return;
    
    try {
      const doc = await this.getCachedDocument(collection, documentId);
      
      if (doc) {
        await this.db.delete(OfflineStoreNames.CACHED_DOCUMENTS, doc.id);
      }
    } catch (error) {
      console.error('刪除緩存文檔失敗:', error);
    }
  }

  /**
   * 添加待同步操作
   */
  async addPendingOperation(
    collection: string,
    documentId: string,
    operation: OperationType,
    data?: any,
    priority: SyncPriority = SyncPriority.MEDIUM
  ): Promise<string> {
    if (!this.db || !this.userId || !this.tenantId) {
      throw new Error('離線存儲未初始化或用戶未登入');
    }
    
    try {
      const pendingOp: PendingOperation = {
        id: uuidv4(),
        timestamp: Date.now(),
        userId: this.userId,
        tenantId: this.tenantId,
        storeId: this.storeId || undefined,
        collection,
        documentId,
        operation,
        data,
        priority,
        status: SyncStatus.PENDING,
        retryCount: 0
      };
      
      await this.db.add(OfflineStoreNames.PENDING_OPERATIONS, pendingOp);
      
      return pendingOp.id;
    } catch (error) {
      console.error('添加待同步操作失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取待同步操作
   */
  async getPendingOperations(status?: SyncStatus): Promise<PendingOperation[]> {
    if (!this.db) return [];
    
    try {
      if (status) {
        return await this.db.getAllFromIndex(
          OfflineStoreNames.PENDING_OPERATIONS,
          'by-status',
          status
        );
      } else {
        return await this.db.getAll(OfflineStoreNames.PENDING_OPERATIONS);
      }
    } catch (error) {
      console.error('獲取待同步操作失敗:', error);
      return [];
    }
  }

  /**
   * 更新待同步操作狀態
   */
  async updatePendingOperationStatus(
    operationId: string,
    status: SyncStatus,
    error?: string
  ): Promise<void> {
    if (!this.db) return;
    
    try {
      const operation = await this.db.get(OfflineStoreNames.PENDING_OPERATIONS, operationId);
      
      if (operation) {
        operation.status = status;
        operation.lastAttempt = Date.now();
        
        if (status === SyncStatus.FAILED) {
          operation.retryCount += 1;
          operation.error = error;
        }
        
        await this.db.put(OfflineStoreNames.PENDING_OPERATIONS, operation);
      }
    } catch (error) {
      console.error('更新待同步操作狀態失敗:', error);
    }
  }

  /**
   * 記錄同步日誌
   */
  async addSyncLog(log: Omit<SyncLog, 'id' | 'timestamp'>): Promise<string> {
    if (!this.db) throw new Error('離線存儲未初始化');
    
    try {
      const syncLog: SyncLog = {
        ...log,
        id: uuidv4(),
        timestamp: Date.now()
      };
      
      await this.db.add(OfflineStoreNames.SYNC_LOGS, syncLog);
      
      return syncLog.id;
    } catch (error) {
      console.error('記錄同步日誌失敗:', error);
      throw error;
    }
  }

  /**
   * 清理過期的同步日誌
   */
  async cleanupSyncLogs(olderThanDays = 7): Promise<void> {
    if (!this.db) return;
    
    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      const logs = await this.db.getAllFromIndex(
        OfflineStoreNames.SYNC_LOGS,
        'by-timestamp'
      );
      
      const oldLogs = logs.filter(log => log.timestamp < cutoffTime);
      
      for (const log of oldLogs) {
        await this.db.delete(OfflineStoreNames.SYNC_LOGS, log.id);
      }
    } catch (error) {
      console.error('清理同步日誌失敗:', error);
    }
  }
}
