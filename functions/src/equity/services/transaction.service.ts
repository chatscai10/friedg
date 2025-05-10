/**
 * 動態股權系統 - 交易服務
 * 
 * 提供股權交易記錄的管理功能
 */

import * as admin from 'firebase-admin';
import { EquityTransaction, EquityTransactionType } from '../equity.types';

export class TransactionService {
  private db: FirebaseFirestore.Firestore;
  private transactionsCollection: FirebaseFirestore.CollectionReference;

  constructor() {
    this.db = admin.firestore();
    this.transactionsCollection = this.db.collection('equity_transactions');
  }

  /**
   * 創建交易記錄
   * @param transactionData 交易數據
   * @returns 創建的交易記錄
   */
  async createTransaction(transactionData: Omit<EquityTransaction, 'transactionId' | 'createdAt' | 'updatedAt'>): Promise<EquityTransaction> {
    try {
      const now = admin.firestore.Timestamp.now();
      
      // 如果未提供交易日期，使用當前時間
      const transactionDate = transactionData.transactionDate || now;
      
      // 計算總金額（如果未提供）
      const totalAmount = transactionData.totalAmount || 
        (transactionData.shares * transactionData.sharePrice);
      
      // 創建交易記錄
      const newTransaction: Omit<EquityTransaction, 'transactionId'> = {
        ...transactionData,
        transactionDate,
        totalAmount,
        createdAt: now,
        updatedAt: now
      };
      
      // 添加到集合
      const docRef = await this.transactionsCollection.add(newTransaction);
      
      // 更新記錄，添加ID
      const transactionId = docRef.id;
      await docRef.update({
        transactionId
      });
      
      // 獲取完整的交易記錄
      const transactionDoc = await docRef.get();
      return {
        ...transactionDoc.data(),
        transactionId
      } as EquityTransaction;
    } catch (error) {
      console.error('創建交易記錄時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 創建績效授予交易記錄
   * @param data 交易相關數據
   * @returns 創建的交易記錄
   */
  async createPerformanceGrantTransaction(data: {
    employeeId: string;
    storeId: string;
    tenantId: string;
    shares: number;
    sharePrice: number;
    holdingId: string;
  }): Promise<EquityTransaction> {
    return this.createTransaction({
      employeeId: data.employeeId,
      storeId: data.storeId,
      tenantId: data.tenantId,
      transactionDate: admin.firestore.Timestamp.now(),
      transactionType: EquityTransactionType.PERFORMANCE_GRANT,
      shares: data.shares,
      sharePrice: data.sharePrice,
      totalAmount: data.shares * data.sharePrice,
      holdingId: data.holdingId,
      notes: '績效獎勵授予'
    });
  }

  /**
   * 創建現金認購交易記錄
   * @param data 交易相關數據
   * @returns 創建的交易記錄
   */
  async createPurchaseTransaction(data: {
    employeeId: string;
    storeId: string;
    tenantId: string;
    shares: number;
    sharePrice: number;
    holdingId: string;
    installmentPlanId?: string;
    paymentMethod?: string;
  }): Promise<EquityTransaction> {
    return this.createTransaction({
      employeeId: data.employeeId,
      storeId: data.storeId,
      tenantId: data.tenantId,
      transactionDate: admin.firestore.Timestamp.now(),
      transactionType: EquityTransactionType.PURCHASE,
      shares: data.shares,
      sharePrice: data.sharePrice,
      totalAmount: data.shares * data.sharePrice,
      holdingId: data.holdingId,
      installmentPlanId: data.installmentPlanId,
      paymentMethod: data.paymentMethod,
      notes: data.installmentPlanId ? '分期認購' : '一次性認購'
    });
  }

  /**
   * 獲取特定交易記錄
   * @param transactionId 交易ID
   * @returns 交易記錄
   */
  async getTransaction(transactionId: string): Promise<EquityTransaction | null> {
    try {
      const transactionDoc = await this.transactionsCollection.doc(transactionId).get();
      
      if (!transactionDoc.exists) {
        return null;
      }
      
      return transactionDoc.data() as EquityTransaction;
    } catch (error) {
      console.error('獲取交易記錄時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取員工的交易記錄
   * @param employeeId 員工ID
   * @param limit 返回數量限制
   * @returns 交易記錄列表
   */
  async getEmployeeTransactions(employeeId: string, limit: number = 20): Promise<EquityTransaction[]> {
    try {
      const snapshot = await this.transactionsCollection
        .where('employeeId', '==', employeeId)
        .orderBy('transactionDate', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => doc.data() as EquityTransaction);
    } catch (error) {
      console.error('獲取員工交易記錄時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取特定持股ID相關的交易記錄
   * @param holdingId 持股ID
   * @returns 交易記錄列表
   */
  async getHoldingTransactions(holdingId: string): Promise<EquityTransaction[]> {
    try {
      const snapshot = await this.transactionsCollection
        .where('holdingId', '==', holdingId)
        .orderBy('transactionDate', 'desc')
        .get();
      
      return snapshot.docs.map(doc => doc.data() as EquityTransaction);
    } catch (error) {
      console.error('獲取持股交易記錄時發生錯誤:', error);
      throw error;
    }
  }
}

export default new TransactionService(); 