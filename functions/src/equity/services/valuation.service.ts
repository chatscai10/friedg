/**
 * 動態股權系統 - 估值服務
 * 
 * 提供對股價估值的創建、查詢等功能
 */

import * as admin from 'firebase-admin';
import { SharePriceLog } from '../equity.types';

export class ValuationService {
  private db: FirebaseFirestore.Firestore;
  private sharePriceLogsCollection: FirebaseFirestore.CollectionReference;

  constructor() {
    this.db = admin.firestore();
    this.sharePriceLogsCollection = this.db.collection('share_price_logs');
  }

  /**
   * 創建新的股價估值記錄
   * @param valuationData 估值資料
   * @returns 創建的估值記錄
   */
  async createValuation(valuationData: Omit<SharePriceLog, 'valuationId' | 'createdAt' | 'updatedAt'>): Promise<SharePriceLog> {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // 獲取上一次的股價（如果有）
      const lastValuation = await this.getLatestValuation(valuationData.storeId, valuationData.tenantId);
      const priorSharePrice = lastValuation ? lastValuation.sharePrice : undefined;
      
      // 計算價格變化百分比
      let priceChangePercentage = 0;
      if (priorSharePrice) {
        priceChangePercentage = ((valuationData.sharePrice - priorSharePrice) / priorSharePrice) * 100;
      }
      
      // 創建新的估值記錄
      const newValuation: Omit<SharePriceLog, 'valuationId'> = {
        ...valuationData,
        priorSharePrice,
        priceChangePercentage,
        createdAt: now,
        updatedAt: now
      };
      
      const docRef = await this.sharePriceLogsCollection.add(newValuation);
      
      // 更新記錄，添加ID
      await docRef.update({
        valuationId: docRef.id
      });
      
      // 獲取完整的估值記錄
      const valuationDoc = await docRef.get();
      return {
        ...valuationDoc.data(),
        valuationId: docRef.id
      } as SharePriceLog;
    } catch (error) {
      console.error('創建股價估值時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取最新的股價估值
   * @param storeId 店鋪ID
   * @param tenantId 租戶ID
   * @returns 最新的估值記錄
   */
  async getLatestValuation(storeId: string, tenantId: string): Promise<SharePriceLog | null> {
    try {
      const snapshot = await this.sharePriceLogsCollection
        .where('storeId', '==', storeId)
        .where('tenantId', '==', tenantId)
        .orderBy('effectiveDate', 'desc')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return {
        ...doc.data(),
        valuationId: doc.id
      } as SharePriceLog;
    } catch (error) {
      console.error('獲取最新股價估值時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取股價估值歷史
   * @param storeId 店鋪ID
   * @param tenantId 租戶ID
   * @param limit 返回記錄數量限制
   * @returns 估值記錄列表
   */
  async getValuationHistory(storeId: string, tenantId: string, limit: number = 10): Promise<SharePriceLog[]> {
    try {
      const snapshot = await this.sharePriceLogsCollection
        .where('storeId', '==', storeId)
        .where('tenantId', '==', tenantId)
        .orderBy('effectiveDate', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        valuationId: doc.id
      })) as SharePriceLog[];
    } catch (error) {
      console.error('獲取股價估值歷史時發生錯誤:', error);
      throw error;
    }
  }
}

export default new ValuationService(); 