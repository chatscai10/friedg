/**
 * 動態股權系統 - 股權池服務
 * 
 * 提供對店鋪股權池的管理功能
 */

import * as admin from 'firebase-admin';
import { StoreEquityPool, EquityType } from '../equity.types';

export class PoolService {
  private db: FirebaseFirestore.Firestore;
  private storeEquityPoolCollection: FirebaseFirestore.CollectionReference;

  constructor() {
    this.db = admin.firestore();
    this.storeEquityPoolCollection = this.db.collection('store_equity_pools');
  }

  /**
   * 初始化店鋪股權池
   * @param storeId 店鋪ID
   * @param tenantId 租戶ID
   * @param poolData 股權池初始數據
   * @returns 創建的股權池記錄
   */
  async initializePool(
    storeId: string, 
    tenantId: string, 
    poolData: {
      totalShares: number;
      poolShares: number;
      equityType: EquityType;
    }
  ): Promise<StoreEquityPool> {
    try {
      const docId = `${tenantId}_${storeId}`;
      const poolRef = this.storeEquityPoolCollection.doc(docId);
      const now = admin.firestore.Timestamp.now();

      // 創建股權池數據
      const newPool: StoreEquityPool = {
        storeId,
        tenantId,
        totalShares: poolData.totalShares,
        poolShares: poolData.poolShares,
        remainingPoolShares: poolData.poolShares,
        allocatedShares: 0,
        currentSharePrice: 0, // 初始化時可能無股價，將在首次估值後更新
        currentValuation: 0,  // 初始化時可能無估值
        lastValuationId: '',
        lastValuationDate: now,
        equityType: poolData.equityType,
        purchaseWindowOpen: false,
        maxEmployeePercentage: 10, // 預設值
        maxTotalEmployeePercentage: 49, // 預設值
        buybackReserveBalance: 0,
        createdAt: now,
        updatedAt: now
      };
      
      await poolRef.set(newPool);
      
      // 獲取創建的記錄
      const poolDoc = await poolRef.get();
      return poolDoc.data() as StoreEquityPool;
    } catch (error) {
      console.error('初始化股權池時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取店鋪股權池信息
   * @param storeId 店鋪ID
   * @param tenantId 租戶ID
   * @returns 股權池記錄
   */
  async getPool(storeId: string, tenantId: string): Promise<StoreEquityPool | null> {
    try {
      const docId = `${tenantId}_${storeId}`;
      const poolDoc = await this.storeEquityPoolCollection.doc(docId).get();
      
      if (!poolDoc.exists) {
        return null;
      }
      
      return poolDoc.data() as StoreEquityPool;
    } catch (error) {
      console.error('獲取股權池時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新店鋪股權池
   * @param storeId 店鋪ID
   * @param tenantId 租戶ID
   * @param updateData 更新數據
   * @returns 更新後的股權池記錄
   */
  async updatePool(storeId: string, tenantId: string, updateData: Partial<StoreEquityPool>): Promise<StoreEquityPool> {
    try {
      const docId = `${tenantId}_${storeId}`;
      const poolRef = this.storeEquityPoolCollection.doc(docId);
      const now = admin.firestore.Timestamp.now();
      
      // 檢查股權池是否存在
      const poolDoc = await poolRef.get();
      if (!poolDoc.exists) {
        throw new Error(`店鋪 ${storeId} 的股權池尚未初始化`);
      }
      
      // 更新股權池
      await poolRef.update({
        ...updateData,
        updatedAt: now
      });
      
      // 獲取更新後的記錄
      const updatedPoolDoc = await poolRef.get();
      return updatedPoolDoc.data() as StoreEquityPool;
    } catch (error) {
      console.error('更新股權池時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 設置股權購買窗口開放狀態
   * @param storeId 店鋪ID
   * @param tenantId 租戶ID
   * @param isOpen 是否開放
   * @returns 更新後的股權池記錄
   */
  async setPurchaseWindowStatus(storeId: string, tenantId: string, isOpen: boolean): Promise<StoreEquityPool> {
    return this.updatePool(storeId, tenantId, { purchaseWindowOpen: isOpen });
  }
}

export default new PoolService(); 