/**
 * 應用狀態Slice
 * 管理應用全局狀態，包括網絡狀態、同步狀態等
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// 衝突對話框數據
export interface ConflictDialogData {
  operationId: string;
  collection: string;
  documentId: string;
  operation: string;
  clientData?: any;
  serverData?: any;
}

// 應用狀態接口
export interface AppState {
  // 網絡狀態
  isOnline: boolean;
  // 離線模式是否啟用
  offlineModeEnabled: boolean;
  // 是否正在同步
  isSyncing: boolean;
  // 同步進度 (0-100)
  syncProgress: number;
  // 待同步操作數量
  pendingOperationsCount: number;
  // 是否顯示衝突解決對話框
  showConflictDialog: boolean;
  // 衝突對話框數據
  conflictDialogData: ConflictDialogData | null;
  // 系統通知
  notifications: {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
    read: boolean;
  }[];
  // 系統設置
  settings: {
    // 主題
    theme: 'light' | 'dark' | 'system';
    // 語言
    language: 'zh-TW' | 'en-US';
    // 是否啟用聲音通知
    soundEnabled: boolean;
    // 是否啟用桌面通知
    desktopNotificationsEnabled: boolean;
    // 是否自動同步
    autoSync: boolean;
    // 自動同步間隔（毫秒）
    autoSyncInterval: number;
  };
}

// 初始狀態
const initialState: AppState = {
  isOnline: navigator.onLine,
  offlineModeEnabled: true,
  isSyncing: false,
  syncProgress: 0,
  pendingOperationsCount: 0,
  showConflictDialog: false,
  conflictDialogData: null,
  notifications: [],
  settings: {
    theme: 'system',
    language: 'zh-TW',
    soundEnabled: true,
    desktopNotificationsEnabled: false,
    autoSync: true,
    autoSyncInterval: 60000 // 1分鐘
  }
};

// 創建Slice
const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // 設置網絡狀態
    setIsOnline: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    
    // 設置離線模式
    setOfflineModeEnabled: (state, action: PayloadAction<boolean>) => {
      state.offlineModeEnabled = action.payload;
    },
    
    // 設置同步狀態
    setIsSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    
    // 設置同步進度
    setSyncProgress: (state, action: PayloadAction<number>) => {
      state.syncProgress = action.payload;
    },
    
    // 設置待同步操作數量
    setPendingOperationsCount: (state, action: PayloadAction<number>) => {
      state.pendingOperationsCount = action.payload;
    },
    
    // 顯示衝突解決對話框
    showConflictDialog: (state, action: PayloadAction<ConflictDialogData>) => {
      state.showConflictDialog = true;
      state.conflictDialogData = action.payload;
    },
    
    // 隱藏衝突解決對話框
    hideConflictDialog: (state) => {
      state.showConflictDialog = false;
      state.conflictDialogData = null;
    },
    
    // 添加通知
    addNotification: (state, action: PayloadAction<{
      type: 'success' | 'error' | 'warning' | 'info';
      message: string;
    }>) => {
      state.notifications.push({
        id: Date.now().toString(),
        type: action.payload.type,
        message: action.payload.message,
        timestamp: Date.now(),
        read: false
      });
      
      // 最多保留20條通知
      if (state.notifications.length > 20) {
        state.notifications.shift();
      }
    },
    
    // 標記通知為已讀
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    
    // 清除所有通知
    clearNotifications: (state) => {
      state.notifications = [];
    },
    
    // 更新設置
    updateSettings: (state, action: PayloadAction<Partial<AppState['settings']>>) => {
      state.settings = {
        ...state.settings,
        ...action.payload
      };
    }
  }
});

// 導出Actions
export const {
  setIsOnline,
  setOfflineModeEnabled,
  setIsSyncing,
  setSyncProgress,
  setPendingOperationsCount,
  showConflictDialog,
  hideConflictDialog,
  addNotification,
  markNotificationAsRead,
  clearNotifications,
  updateSettings
} = appSlice.actions;

// 導出Reducer
export default appSlice.reducer;
