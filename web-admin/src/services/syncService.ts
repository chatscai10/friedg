/**
 * 同步服務
 * 處理離線資料同步和衝突解決
 */

import { getFirestore, doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { OfflineStorageService, PendingOperation, SyncStatus, OperationType, SyncPriority } from './offlineStorage';
import { NetworkService } from './networkService';
import { showErrorNotification, showSuccessNotification } from '../utils/notification';
import { store } from '../store';
import { setIsSyncing, setSyncProgress } from '../store/slices/appSlice';

/**
 * 衝突解決策略
 */
export enum ConflictResolutionStrategy {
  CLIENT_WINS = 'client',
  SERVER_WINS = 'server',
  MANUAL_RESOLUTION = 'manual'
}

/**
 * 同步配置
 */
export interface SyncConfig {
  // 自動同步間隔（毫秒）
  autoSyncInterval: number;
  // 最大重試次數
  maxRetryCount: number;
  // 重試延遲（毫秒）
  retryDelay: number;
  // 批量同步大小
  batchSize: number;
  // 默認衝突解決策略
  defaultConflictStrategy: ConflictResolutionStrategy;
  // 高優先級集合
  highPriorityCollections: string[];
  // 中優先級集合
  mediumPriorityCollections: string[];
}

/**
 * 同步服務類
 */
export class SyncService {
  private offlineStorage: OfflineStorageService;
  private networkService: NetworkService;
  private firestore = getFirestore();
  private syncConfig: SyncConfig;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private syncQueue: PendingOperation[] = [];
  private manualResolutionCallbacks: Map<string, (strategy: ConflictResolutionStrategy) => void> = new Map();

  constructor(
    offlineStorage: OfflineStorageService,
    networkService: NetworkService,
    config?: Partial<SyncConfig>
  ) {
    this.offlineStorage = offlineStorage;
    this.networkService = networkService;
    
    // 默認配置
    this.syncConfig = {
      autoSyncInterval: 60000, // 1分鐘
      maxRetryCount: 5,
      retryDelay: 5000, // 5秒
      batchSize: 10,
      defaultConflictStrategy: ConflictResolutionStrategy.SERVER_WINS,
      highPriorityCollections: ['orders', 'attendanceRecords'],
      mediumPriorityCollections: ['inventoryItems', 'menuItems', 'schedules'],
      ...config
    };
    
    // 監聽網絡狀態變化
    this.networkService.onNetworkStatusChange((isOnline) => {
      if (isOnline) {
        this.startSync();
      } else {
        this.stopSync();
      }
    });
  }

  /**
   * 初始化同步服務
   */
  async initialize(): Promise<void> {
    try {
      // 獲取用戶離線設置
      const settings = await this.offlineStorage.getOfflineSettings();
      
      if (settings) {
        // 更新同步配置
        this.syncConfig.autoSyncInterval = settings.syncInterval;
        this.syncConfig.highPriorityCollections = settings.priorityCollections;
      }
      
      // 如果網絡在線，開始同步
      if (this.networkService.isOnline()) {
        this.startSync();
      }
    } catch (error) {
      console.error('初始化同步服務失敗:', error);
    }
  }

  /**
   * 開始自動同步
   */
  startSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    // 立即執行一次同步
    this.syncPendingOperations();
    
    // 設置定時同步
    this.syncTimer = setInterval(() => {
      this.syncPendingOperations();
    }, this.syncConfig.autoSyncInterval);
  }

  /**
   * 停止自動同步
   */
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * 手動觸發同步
   */
  async manualSync(): Promise<void> {
    if (!this.networkService.isOnline()) {
      showErrorNotification('無法同步，網絡離線');
      return;
    }
    
    try {
      store.dispatch(setIsSyncing(true));
      await this.syncPendingOperations();
      showSuccessNotification('同步完成');
    } catch (error) {
      console.error('手動同步失敗:', error);
      showErrorNotification('同步失敗: ' + (error.message || '未知錯誤'));
    } finally {
      store.dispatch(setIsSyncing(false));
    }
  }

  /**
   * 同步待處理操作
   */
  private async syncPendingOperations(): Promise<void> {
    if (this.isSyncing || !this.networkService.isOnline()) return;
    
    this.isSyncing = true;
    store.dispatch(setIsSyncing(true));
    
    try {
      // 獲取所有待同步操作
      const pendingOps = await this.offlineStorage.getPendingOperations(SyncStatus.PENDING);
      
      if (pendingOps.length === 0) {
        this.isSyncing = false;
        store.dispatch(setIsSyncing(false));
        return;
      }
      
      // 按優先級排序
      this.syncQueue = this.prioritizeOperations(pendingOps);
      
      // 批量處理
      const totalOps = this.syncQueue.length;
      let processedOps = 0;
      
      while (this.syncQueue.length > 0 && this.networkService.isOnline()) {
        const batch = this.syncQueue.splice(0, this.syncConfig.batchSize);
        
        // 並行處理批次
        await Promise.all(batch.map(op => this.processSingleOperation(op)));
        
        processedOps += batch.length;
        store.dispatch(setSyncProgress(Math.floor((processedOps / totalOps) * 100)));
      }
    } catch (error) {
      console.error('同步操作失敗:', error);
    } finally {
      this.isSyncing = false;
      store.dispatch(setIsSyncing(false));
      store.dispatch(setSyncProgress(0));
    }
  }

  /**
   * 按優先級排序操作
   */
  private prioritizeOperations(operations: PendingOperation[]): PendingOperation[] {
    return operations.sort((a, b) => {
      // 首先按優先級排序
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      
      // 然後按集合優先級排序
      const aCollectionPriority = this.getCollectionPriority(a.collection);
      const bCollectionPriority = this.getCollectionPriority(b.collection);
      
      if (aCollectionPriority !== bCollectionPriority) {
        return aCollectionPriority - bCollectionPriority;
      }
      
      // 最後按時間戳排序
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * 獲取集合優先級
   */
  private getCollectionPriority(collection: string): number {
    if (this.syncConfig.highPriorityCollections.includes(collection)) {
      return 1;
    } else if (this.syncConfig.mediumPriorityCollections.includes(collection)) {
      return 2;
    }
    return 3;
  }

  /**
   * 處理單個同步操作
   */
  private async processSingleOperation(operation: PendingOperation): Promise<void> {
    try {
      // 更新操作狀態為進行中
      await this.offlineStorage.updatePendingOperationStatus(
        operation.id,
        SyncStatus.IN_PROGRESS
      );
      
      // 檢查是否存在衝突
      const hasConflict = await this.checkForConflict(operation);
      
      if (hasConflict) {
        // 處理衝突
        await this.handleConflict(operation);
      } else {
        // 執行操作
        await this.executeOperation(operation);
      }
    } catch (error) {
      console.error(`處理操作 ${operation.id} 失敗:`, error);
      
      // 更新操作狀態為失敗
      await this.offlineStorage.updatePendingOperationStatus(
        operation.id,
        SyncStatus.FAILED,
        error.message
      );
      
      // 檢查是否需要重試
      if (operation.retryCount < this.syncConfig.maxRetryCount) {
        // 延遲後重新加入隊列
        setTimeout(() => {
          this.syncQueue.push(operation);
        }, this.syncConfig.retryDelay);
      }
    }
  }

  /**
   * 檢查操作是否存在衝突
   */
  private async checkForConflict(operation: PendingOperation): Promise<boolean> {
    // 刪除操作不檢查衝突
    if (operation.operation === OperationType.DELETE) {
      return false;
    }
    
    try {
      // 獲取服務器文檔
      const docRef = doc(this.firestore, operation.collection, operation.documentId);
      const serverDoc = await getDoc(docRef);
      
      // 如果是創建操作，且服務器已存在文檔，則存在衝突
      if (operation.operation === OperationType.CREATE && serverDoc.exists()) {
        return true;
      }
      
      // 如果是更新操作，且服務器文檔不存在，則存在衝突
      if (operation.operation === OperationType.UPDATE && !serverDoc.exists()) {
        return true;
      }
      
      // 如果是更新操作，檢查版本或時間戳是否衝突
      if (operation.operation === OperationType.UPDATE && serverDoc.exists()) {
        const serverData = serverDoc.data();
        const clientData = operation.data;
        
        // 檢查版本號
        if (serverData.version && clientData.version && serverData.version > clientData.version) {
          return true;
        }
        
        // 檢查更新時間
        if (serverData.updatedAt && operation.timestamp && 
            serverData.updatedAt.toMillis() > operation.timestamp) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('檢查衝突失敗:', error);
      return false;
    }
  }

  /**
   * 處理衝突
   */
  private async handleConflict(operation: PendingOperation): Promise<void> {
    // 更新操作狀態為衝突
    await this.offlineStorage.updatePendingOperationStatus(
      operation.id,
      SyncStatus.CONFLICT
    );
    
    // 根據衝突解決策略處理
    let strategy = this.syncConfig.defaultConflictStrategy;
    
    // 如果操作已有指定的衝突解決策略，使用該策略
    if (operation.conflictResolution) {
      strategy = operation.conflictResolution as ConflictResolutionStrategy;
    } else if (strategy === ConflictResolutionStrategy.MANUAL_RESOLUTION) {
      // 需要手動解決，顯示衝突解決對話框
      strategy = await this.promptForConflictResolution(operation);
    }
    
    // 根據策略執行操作
    if (strategy === ConflictResolutionStrategy.CLIENT_WINS) {
      await this.executeOperation(operation, true);
    } else if (strategy === ConflictResolutionStrategy.SERVER_WINS) {
      // 獲取服務器文檔並更新本地緩存
      const docRef = doc(this.firestore, operation.collection, operation.documentId);
      const serverDoc = await getDoc(docRef);
      
      if (serverDoc.exists()) {
        await this.offlineStorage.cacheDocument(
          operation.collection,
          operation.documentId,
          serverDoc.data(),
          false
        );
      } else {
        // 服務器文檔不存在，刪除本地緩存
        await this.offlineStorage.deleteCachedDocument(
          operation.collection,
          operation.documentId
        );
      }
      
      // 標記操作為完成
      await this.offlineStorage.updatePendingOperationStatus(
        operation.id,
        SyncStatus.COMPLETED
      );
    }
  }

  /**
   * 提示用戶解決衝突
   */
  private async promptForConflictResolution(operation: PendingOperation): Promise<ConflictResolutionStrategy> {
    return new Promise<ConflictResolutionStrategy>((resolve) => {
      // 存儲回調函數
      this.manualResolutionCallbacks.set(operation.id, resolve);
      
      // 顯示衝突解決對話框
      store.dispatch({
        type: 'app/showConflictDialog',
        payload: {
          operationId: operation.id,
          collection: operation.collection,
          documentId: operation.documentId,
          operation: operation.operation
        }
      });
    });
  }

  /**
   * 解決衝突
   */
  resolveConflict(operationId: string, strategy: ConflictResolutionStrategy): void {
    const callback = this.manualResolutionCallbacks.get(operationId);
    
    if (callback) {
      callback(strategy);
      this.manualResolutionCallbacks.delete(operationId);
    }
  }

  /**
   * 執行操作
   */
  private async executeOperation(operation: PendingOperation, forceOverwrite = false): Promise<void> {
    const docRef = doc(this.firestore, operation.collection, operation.documentId);
    
    try {
      switch (operation.operation) {
        case OperationType.CREATE:
          // 添加服務器時間戳
          const createData = {
            ...operation.data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          await setDoc(docRef, createData);
          break;
          
        case OperationType.UPDATE:
          // 添加服務器時間戳
          const updateData = {
            ...operation.data,
            updatedAt: serverTimestamp()
          };
          
          if (forceOverwrite) {
            await setDoc(docRef, updateData);
          } else {
            await updateDoc(docRef, updateData);
          }
          break;
          
        case OperationType.DELETE:
          await deleteDoc(docRef);
          break;
      }
      
      // 更新操作狀態為完成
      await this.offlineStorage.updatePendingOperationStatus(
        operation.id,
        SyncStatus.COMPLETED
      );
      
      // 記錄同步日誌
      await this.offlineStorage.addSyncLog({
        userId: operation.userId,
        tenantId: operation.tenantId,
        storeId: operation.storeId,
        operationId: operation.id,
        collection: operation.collection,
        documentId: operation.documentId,
        operation: operation.operation,
        status: SyncStatus.COMPLETED,
        syncDuration: Date.now() - (operation.lastAttempt || operation.timestamp)
      });
    } catch (error) {
      console.error(`執行操作 ${operation.id} 失敗:`, error);
      
      // 更新操作狀態為失敗
      await this.offlineStorage.updatePendingOperationStatus(
        operation.id,
        SyncStatus.FAILED,
        error.message
      );
      
      // 記錄同步日誌
      await this.offlineStorage.addSyncLog({
        userId: operation.userId,
        tenantId: operation.tenantId,
        storeId: operation.storeId,
        operationId: operation.id,
        collection: operation.collection,
        documentId: operation.documentId,
        operation: operation.operation,
        status: SyncStatus.FAILED,
        error: error.message
      });
      
      throw error;
    }
  }
}
