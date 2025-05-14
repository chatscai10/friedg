/**
 * 離線服務初始化
 * 初始化和整合所有離線功能
 */

import { OfflineStorageService } from './offlineStorage';
import { NetworkService } from './networkService';
import { SyncService } from './syncService';
import { OfflinePermissionService } from './offlinePermissionService';
import { store } from '../store';
import { setIsOnline, setPendingOperationsCount } from '../store/slices/appSlice';
import { getAuth } from 'firebase/auth';

// 離線服務實例
let offlineStorage: OfflineStorageService | null = null;
let networkService: NetworkService | null = null;
let syncService: SyncService | null = null;
let permissionService: OfflinePermissionService | null = null;

/**
 * 初始化離線服務
 */
export const initializeOfflineServices = async (): Promise<{
  offlineStorage: OfflineStorageService;
  networkService: NetworkService;
  syncService: SyncService;
  permissionService: OfflinePermissionService;
}> => {
  // 檢查用戶是否已登入
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('用戶未登入，無法初始化離線服務');
  }
  
  // 初始化網絡服務
  if (!networkService) {
    networkService = new NetworkService();
    
    // 監聽網絡狀態變化
    networkService.onNetworkStatusChange((isOnline) => {
      store.dispatch(setIsOnline(isOnline));
    });
  }
  
  // 初始化離線存儲
  if (!offlineStorage) {
    offlineStorage = new OfflineStorageService();
    await offlineStorage.initialize();
    
    // 獲取待同步操作數量
    const pendingOps = await offlineStorage.getPendingOperations();
    store.dispatch(setPendingOperationsCount(pendingOps.length));
  }
  
  // 初始化同步服務
  if (!syncService) {
    syncService = new SyncService(offlineStorage, networkService);
    await syncService.initialize();
  }
  
  // 初始化權限服務
  if (!permissionService) {
    permissionService = new OfflinePermissionService();
  }
  
  return {
    offlineStorage,
    networkService,
    syncService,
    permissionService
  };
};

/**
 * 獲取離線存儲服務
 */
export const getOfflineStorage = (): OfflineStorageService => {
  if (!offlineStorage) {
    throw new Error('離線存儲服務未初始化');
  }
  
  return offlineStorage;
};

/**
 * 獲取網絡服務
 */
export const getNetworkService = (): NetworkService => {
  if (!networkService) {
    throw new Error('網絡服務未初始化');
  }
  
  return networkService;
};

/**
 * 獲取同步服務
 */
export const getSyncService = (): SyncService => {
  if (!syncService) {
    throw new Error('同步服務未初始化');
  }
  
  return syncService;
};

/**
 * 獲取權限服務
 */
export const getPermissionService = (): OfflinePermissionService => {
  if (!permissionService) {
    throw new Error('權限服務未初始化');
  }
  
  return permissionService;
};

/**
 * 離線操作包裝器
 * 用於包裝API調用，在離線時將操作存儲到本地
 */
export const withOfflineSupport = <T>(
  apiCall: () => Promise<T>,
  offlineOperation: () => Promise<void>,
  options: {
    collection: string;
    documentId: string;
    operation: 'create' | 'update' | 'delete';
    data?: any;
  }
) => {
  return async (): Promise<T | void> => {
    // 獲取網絡服務
    const network = getNetworkService();
    
    // 如果在線，直接調用API
    if (network.isOnline()) {
      try {
        return await apiCall();
      } catch (error) {
        // 如果API調用失敗，嘗試離線操作
        console.error('API調用失敗，切換到離線操作:', error);
        await offlineOperation();
        
        // 獲取離線存儲
        const storage = getOfflineStorage();
        
        // 添加待同步操作
        await storage.addPendingOperation(
          options.collection,
          options.documentId,
          options.operation as any,
          options.data
        );
        
        // 更新待同步操作數量
        const pendingOps = await storage.getPendingOperations();
        store.dispatch(setPendingOperationsCount(pendingOps.length));
      }
    } else {
      // 離線狀態，執行離線操作
      await offlineOperation();
      
      // 獲取離線存儲
      const storage = getOfflineStorage();
      
      // 添加待同步操作
      await storage.addPendingOperation(
        options.collection,
        options.documentId,
        options.operation as any,
        options.data
      );
      
      // 更新待同步操作數量
      const pendingOps = await storage.getPendingOperations();
      store.dispatch(setPendingOperationsCount(pendingOps.length));
    }
  };
};

/**
 * 離線讀取包裝器
 * 用於包裝讀取操作，在離線時從本地緩存讀取
 */
export const withOfflineRead = <T>(
  apiCall: () => Promise<T>,
  offlineRead: () => Promise<T | null>,
  options: {
    collection: string;
    documentId: string;
    cacheResult?: boolean;
  }
) => {
  return async (): Promise<T | null> => {
    // 獲取網絡服務
    const network = getNetworkService();
    
    // 如果在線，嘗試從API獲取
    if (network.isOnline()) {
      try {
        const result = await apiCall();
        
        // 如果需要緩存結果
        if (options.cacheResult !== false && result) {
          // 獲取離線存儲
          const storage = getOfflineStorage();
          
          // 緩存文檔
          await storage.cacheDocument(
            options.collection,
            options.documentId,
            result,
            false
          );
        }
        
        return result;
      } catch (error) {
        console.error('API讀取失敗，嘗試從緩存讀取:', error);
        return await offlineRead();
      }
    } else {
      // 離線狀態，從緩存讀取
      return await offlineRead();
    }
  };
};

/**
 * 清理離線服務
 */
export const cleanupOfflineServices = async (): Promise<void> => {
  // 停止網絡服務
  if (networkService) {
    networkService.stopPinging();
  }
  
  // 停止同步服務
  if (syncService) {
    syncService.stopSync();
  }
  
  // 重置服務實例
  offlineStorage = null;
  networkService = null;
  syncService = null;
  permissionService = null;
};
