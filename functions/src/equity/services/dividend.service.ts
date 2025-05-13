/**
 * 動態股權系統 - 分紅服務
 * 
 * 提供對分紅週期的管理功能
 */

import * as admin from 'firebase-admin';
import { DividendCycle, DividendCycleStatus } from '../equity.types';

export class DividendService {
  private db: FirebaseFirestore.Firestore;
  private dividendCyclesCollection: FirebaseFirestore.CollectionReference;

  constructor() {
    this.db = admin.firestore();
    this.dividendCyclesCollection = this.db.collection('dividend_cycles');
  }

  /**
   * 創建分紅週期
   * @param cycleData 週期數據
   * @returns 創建的分紅週期
   */
  async createDividendCycle(
    storeId: string,
    tenantId: string,
    year: number,
    quarter: number,
    totalNetProfit: number,
    previousDeficit: number = 0
  ): Promise<DividendCycle> {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // 生成週期ID
      const cycleId = `store_${storeId}_Q${quarter}_${year}`;
      
      // 計算季度的開始和結束日期
      const startDate = new Date(year, (quarter - 1) * 3, 1);
      const endDate = new Date(year, quarter * 3, 0); // 季度最後一天
      
      // 計算可分配利潤 (淨利減去虧損)
      const distributableProfit = Math.max(0, totalNetProfit - previousDeficit);
      
      // 創建週期記錄
      const newCycle: DividendCycle = {
        cycleId,
        storeId,
        tenantId,
        year,
        quarter,
        startDate: admin.firestore.Timestamp.fromDate(startDate),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        totalNetProfit,
        previousDeficit,
        distributableProfit,
        dividendPerShare: 0, // 初始為0，將在計算階段更新
        totalDividendAmount: 0, // 初始為0，將在計算階段更新
        status: DividendCycleStatus.DRAFT,
        createdAt: now,
        updatedAt: now
      };
      
      // 寫入資料庫
      await this.dividendCyclesCollection.doc(cycleId).set(newCycle);
      
      // 獲取創建的週期記錄
      const cycleDoc = await this.dividendCyclesCollection.doc(cycleId).get();
      return cycleDoc.data() as DividendCycle;
    } catch (error) {
      console.error('創建分紅週期時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取特定分紅週期
   * @param cycleId 週期ID
   * @returns 分紅週期記錄
   */
  async getDividendCycle(cycleId: string): Promise<DividendCycle | null> {
    try {
      const cycleDoc = await this.dividendCyclesCollection.doc(cycleId).get();
      
      if (!cycleDoc.exists) {
        return null;
      }
      
      return cycleDoc.data() as DividendCycle;
    } catch (error) {
      console.error('獲取分紅週期時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取店鋪的分紅週期歷史
   * @param storeId 店鋪ID
   * @param limit 返回數量限制
   * @returns 分紅週期列表
   */
  async getStoreDividendCycles(storeId: string, limit: number = 10): Promise<DividendCycle[]> {
    try {
      const snapshot = await this.dividendCyclesCollection
        .where('storeId', '==', storeId)
        .orderBy('year', 'desc')
        .orderBy('quarter', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => doc.data() as DividendCycle);
    } catch (error) {
      console.error('獲取店鋪分紅週期時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新分紅週期狀態
   * @param cycleId 週期ID
   * @param status 新狀態
   * @param updateData 其他更新數據
   * @returns 更新後的週期記錄
   */
  async updateCycleStatus(
    cycleId: string,
    status: DividendCycleStatus,
    updateData: Partial<DividendCycle> = {}
  ): Promise<DividendCycle> {
    try {
      const cycleRef = this.dividendCyclesCollection.doc(cycleId);
      const now = admin.firestore.Timestamp.now();
      
      // 檢查週期是否存在
      const cycleDoc = await cycleRef.get();
      if (!cycleDoc.exists) {
        throw new Error(`找不到ID為 ${cycleId} 的分紅週期`);
      }
      
      // 更新週期狀態
      await cycleRef.update({
        ...updateData,
        status,
        updatedAt: now
      });
      
      // 獲取更新後的記錄
      const updatedDoc = await cycleRef.get();
      return updatedDoc.data() as DividendCycle;
    } catch (error) {
      console.error('更新分紅週期狀態時發生錯誤:', error);
      throw error;
    }
  }
}

export default new DividendService(); 