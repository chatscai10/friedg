/**
 * 網絡狀態監控服務
 * 監控網絡連接狀態並提供離線檢測功能
 */

import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import { store } from '../store';
import { setIsOnline } from '../store/slices/appSlice';

// 網絡狀態變化回調函數類型
export type NetworkStatusCallback = (isOnline: boolean) => void;

/**
 * 網絡服務類
 */
export class NetworkService {
  private isNetworkOnline = navigator.onLine;
  private callbacks: NetworkStatusCallback[] = [];
  private pingInterval: NodeJS.Timeout | null = null;
  private pingUrl = 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel';
  private pingTimeout = 5000; // 5秒超時
  private pingIntervalTime = 30000; // 30秒檢查一次
  private firestore = getFirestore();

  constructor() {
    // 初始化時設置網絡狀態
    this.updateOnlineStatus(navigator.onLine);
    
    // 監聽瀏覽器的在線/離線事件
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    
    // 開始定期檢查網絡連接
    this.startPinging();
  }

  /**
   * 獲取當前網絡狀態
   */
  isOnline(): boolean {
    return this.isNetworkOnline;
  }

  /**
   * 註冊網絡狀態變化回調
   */
  onNetworkStatusChange(callback: NetworkStatusCallback): () => void {
    this.callbacks.push(callback);
    
    // 立即調用回調，傳遞當前狀態
    callback(this.isNetworkOnline);
    
    // 返回取消訂閱函數
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * 處理網絡狀態變化
   */
  private handleNetworkChange(isOnline: boolean): void {
    // 如果狀態沒有變化，不做處理
    if (this.isNetworkOnline === isOnline) return;
    
    // 更新狀態
    this.updateOnlineStatus(isOnline);
    
    // 如果變為在線，進行額外檢查確認
    if (isOnline) {
      this.checkRealConnectivity();
    }
  }

  /**
   * 更新在線狀態
   */
  private updateOnlineStatus(isOnline: boolean): void {
    this.isNetworkOnline = isOnline;
    
    // 更新Redux狀態
    store.dispatch(setIsOnline(isOnline));
    
    // 調用所有回調
    this.callbacks.forEach(callback => callback(isOnline));
    
    // 記錄狀態變化
    console.log(`網絡狀態變更為: ${isOnline ? '在線' : '離線'}`);
  }

  /**
   * 開始定期檢查網絡連接
   */
  private startPinging(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.pingInterval = setInterval(() => {
      // 只有當瀏覽器報告在線時才進行檢查
      if (navigator.onLine) {
        this.checkRealConnectivity();
      }
    }, this.pingIntervalTime);
  }

  /**
   * 停止定期檢查
   */
  stopPinging(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * 檢查實際網絡連接
   */
  async checkRealConnectivity(): Promise<boolean> {
    try {
      // 方法1: 嘗試獲取一個小的Firestore文檔
      const result = await this.checkFirestoreConnectivity();
      
      // 如果Firestore檢查失敗，嘗試方法2
      if (!result) {
        // 方法2: 嘗試ping一個URL
        return await this.pingServer();
      }
      
      return result;
    } catch (error) {
      console.error('檢查網絡連接失敗:', error);
      
      // 更新狀態為離線
      this.updateOnlineStatus(false);
      return false;
    }
  }

  /**
   * 檢查Firestore連接
   */
  private async checkFirestoreConnectivity(): Promise<boolean> {
    try {
      // 嘗試獲取一個小的集合
      const systemConfigsRef = collection(this.firestore, 'systemConfigs');
      const q = query(systemConfigsRef, limit(1));
      
      // 設置超時
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), this.pingTimeout);
      });
      
      // 競爭Promise
      const result = await Promise.race([
        getDocs(q),
        timeoutPromise
      ]);
      
      // 如果結果為null，表示超時
      if (result === null) {
        this.updateOnlineStatus(false);
        return false;
      }
      
      // 成功獲取文檔，表示在線
      this.updateOnlineStatus(true);
      return true;
    } catch (error) {
      console.error('檢查Firestore連接失敗:', error);
      
      // 更新狀態為離線
      this.updateOnlineStatus(false);
      return false;
    }
  }

  /**
   * Ping服務器
   */
  private async pingServer(): Promise<boolean> {
    try {
      // 添加時間戳防止緩存
      const url = `${this.pingUrl}?t=${Date.now()}`;
      
      // 設置超時
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.pingTimeout);
      
      // 發送請求
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });
      
      // 清除超時
      clearTimeout(timeoutId);
      
      // 更新狀態
      this.updateOnlineStatus(true);
      return true;
    } catch (error) {
      console.error('Ping服務器失敗:', error);
      
      // 更新狀態為離線
      this.updateOnlineStatus(false);
      return false;
    }
  }

  /**
   * 手動檢查網絡連接
   */
  async manualCheck(): Promise<boolean> {
    return await this.checkRealConnectivity();
  }
}
