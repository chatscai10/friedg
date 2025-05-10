/**
 * 動態股權系統 - 持股服務
 * 
 * 提供對員工持股記錄的管理功能
 */

import * as admin from 'firebase-admin';
import { EmployeeEquityHolding, EquitySourceType, EquityType, EquityHoldingStatus } from '../equity.types';
import transactionService from './transaction.service';

export class HoldingService {
  private db: FirebaseFirestore.Firestore;
  private equityHoldingsCollection: FirebaseFirestore.CollectionReference;

  constructor() {
    this.db = admin.firestore();
    this.equityHoldingsCollection = this.db.collection('employee_equity_holdings');
  }

  /**
   * 創建員工持股記錄
   * @param holdingData 持股數據
   * @returns 創建的持股記錄
   */
  async createHolding(holdingData: Omit<EmployeeEquityHolding, 'holdingId' | 'createdAt' | 'updatedAt' | 'currentValue' | 'vestingPercentage'>): Promise<EmployeeEquityHolding> {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // 計算初始當前市值和歸屬百分比
      const currentValue = holdingData.purchasePrice ? 
        holdingData.shares * holdingData.purchasePrice : 0;
      
      const vestingPercentage = 0; // 初始時為0%
      
      // 創建持股記錄
      const newHolding: Omit<EmployeeEquityHolding, 'holdingId'> = {
        ...holdingData,
        currentValue,
        vestingPercentage,
        createdAt: now,
        updatedAt: now,
        lastValuationDate: now
      };
      
      // 添加到集合
      const docRef = await this.equityHoldingsCollection.add(newHolding);
      
      // 更新記錄，添加ID
      const holdingId = docRef.id;
      await docRef.update({
        holdingId
      });
      
      // 如果是認購，則創建交易記錄
      if (holdingData.sourceType === EquitySourceType.PURCHASE && holdingData.purchasePrice) {
        await transactionService.createPurchaseTransaction({
          employeeId: holdingData.employeeId,
          storeId: holdingData.storeId,
          tenantId: holdingData.tenantId,
          shares: holdingData.shares,
          sharePrice: holdingData.purchasePrice,
          holdingId,
          installmentPlanId: holdingData.installmentPlanId
        });
      }
      
      // 如果是績效獎勵，也創建相應的交易記錄
      if (holdingData.sourceType === EquitySourceType.PERFORMANCE) {
        await transactionService.createPerformanceGrantTransaction({
          employeeId: holdingData.employeeId,
          storeId: holdingData.storeId,
          tenantId: holdingData.tenantId,
          shares: holdingData.shares,
          sharePrice: holdingData.purchasePrice || 0, // 績效獎勵可能沒有明確價格
          holdingId
        });
      }
      
      // 獲取完整的持股記錄
      const holdingDoc = await docRef.get();
      return {
        ...holdingDoc.data(),
        holdingId
      } as EmployeeEquityHolding;
    } catch (error) {
      console.error('創建員工持股記錄時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取特定員工持股記錄
   * @param holdingId 持股ID
   * @returns 持股記錄
   */
  async getHolding(holdingId: string): Promise<EmployeeEquityHolding | null> {
    try {
      const holdingDoc = await this.equityHoldingsCollection.doc(holdingId).get();
      
      if (!holdingDoc.exists) {
        return null;
      }
      
      return holdingDoc.data() as EmployeeEquityHolding;
    } catch (error) {
      console.error('獲取持股記錄時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取員工的所有持股記錄
   * @param employeeId 員工ID
   * @param storeId 店鋪ID (可選)
   * @returns 持股記錄列表
   */
  async getEmployeeHoldings(employeeId: string, storeId?: string): Promise<EmployeeEquityHolding[]> {
    try {
      let query = this.equityHoldingsCollection
        .where('employeeId', '==', employeeId);
      
      if (storeId) {
        query = query.where('storeId', '==', storeId);
      }
      
      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => doc.data() as EmployeeEquityHolding);
    } catch (error) {
      console.error('獲取員工持股記錄時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取店鋪所有員工的持股記錄
   * @param storeId 店鋪ID
   * @param status 持股狀態 (可選)
   * @returns 持股記錄列表
   */
  async getStoreHoldings(storeId: string, status?: EquityHoldingStatus): Promise<EmployeeEquityHolding[]> {
    try {
      let query = this.equityHoldingsCollection
        .where('storeId', '==', storeId);
      
      if (status) {
        query = query.where('status', '==', status);
      }
      
      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => doc.data() as EmployeeEquityHolding);
    } catch (error) {
      console.error('獲取店鋪持股記錄時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新持股狀態
   * @param holdingId 持股ID
   * @param status 新狀態
   * @param updatedData 其他需要更新的數據
   * @returns 更新後的持股記錄
   */
  async updateHoldingStatus(
    holdingId: string, 
    status: EquityHoldingStatus,
    updatedData: Partial<EmployeeEquityHolding> = {}
  ): Promise<EmployeeEquityHolding> {
    try {
      const holdingRef = this.equityHoldingsCollection.doc(holdingId);
      const now = admin.firestore.Timestamp.now();
      
      // 檢查記錄是否存在
      const holdingDoc = await holdingRef.get();
      if (!holdingDoc.exists) {
        throw new Error(`找不到ID為 ${holdingId} 的持股記錄`);
      }
      
      // 更新持股狀態
      await holdingRef.update({
        ...updatedData,
        status,
        updatedAt: now
      });
      
      // 獲取更新後的記錄
      const updatedDoc = await holdingRef.get();
      return updatedDoc.data() as EmployeeEquityHolding;
    } catch (error) {
      console.error('更新持股狀態時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新持股記錄
   * @param holdingId 持股ID
   * @param updateData 更新數據
   * @returns 更新後的持股記錄
   */
  async updateHolding(
    holdingId: string,
    updateData: Partial<EmployeeEquityHolding>
  ): Promise<EmployeeEquityHolding> {
    try {
      const holdingRef = this.equityHoldingsCollection.doc(holdingId);
      const now = admin.firestore.Timestamp.now();
      
      // 檢查記錄是否存在
      const holdingDoc = await holdingRef.get();
      if (!holdingDoc.exists) {
        throw new Error(`找不到ID為 ${holdingId} 的持股記錄`);
      }
      
      // 更新持股記錄
      await holdingRef.update({
        ...updateData,
        updatedAt: now
      });
      
      // 獲取更新後的記錄
      const updatedDoc = await holdingRef.get();
      return updatedDoc.data() as EmployeeEquityHolding;
    } catch (error) {
      console.error('更新持股記錄時發生錯誤:', error);
      throw error;
    }
  }
}

export default new HoldingService(); 