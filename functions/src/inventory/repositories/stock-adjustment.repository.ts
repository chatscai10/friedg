/**
 * 庫存調整儲存庫
 * 
 * 處理庫存調整記錄的存取
 */
import { BaseRepository } from './base.repository';
import { StockAdjustment, StockAdjustmentsFilter } from '../inventory.types';
import { QueryCondition } from '../db/repository.base';

/**
 * 庫存調整儲存庫類
 */
export class StockAdjustmentRepository extends BaseRepository<StockAdjustment> {
  /**
   * 構造函數
   */
  constructor() {
    super('stockAdjustments', '庫存調整記錄');
  }
  
  /**
   * 獲取調整記錄
   */
  async getAdjustment(adjustmentId: string, tenantId: string): Promise<StockAdjustment | null> {
    return this.getOptional(adjustmentId, tenantId);
  }
  
  /**
   * 查詢調整記錄列表
   */
  async listAdjustments(
    tenantId: string,
    filter: StockAdjustmentsFilter = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ items: StockAdjustment[]; total: number; page: number; pageSize: number; hasMore: boolean }> {
    const conditions: QueryCondition[] = [];
    
    // 應用過濾條件
    if (filter.itemId) {
      conditions.push({
        field: 'itemId',
        operator: '==',
        value: filter.itemId
      });
    }
    
    if (filter.storeId) {
      conditions.push({
        field: 'storeId',
        operator: '==',
        value: filter.storeId
      });
    }
    
    if (filter.adjustmentType) {
      conditions.push({
        field: 'adjustmentType',
        operator: '==',
        value: filter.adjustmentType
      });
    }
    
    if (filter.operatorId) {
      conditions.push({
        field: 'operatorId',
        operator: '==',
        value: filter.operatorId
      });
    }
    
    if (filter.startDate) {
      conditions.push({
        field: 'adjustmentDate',
        operator: '>=',
        value: filter.startDate
      });
    }
    
    if (filter.endDate) {
      conditions.push({
        field: 'adjustmentDate',
        operator: '<=',
        value: filter.endDate
      });
    }
    
    // 預設按調整日期降序排序
    const orderBy = [{ field: 'adjustmentDate', direction: 'desc' }];
    
    return this.findPaginated(tenantId, conditions, page, pageSize, orderBy);
  }
  
  /**
   * 創建調整記錄
   */
  async createAdjustment(adjustment: Omit<StockAdjustment, 'adjustmentId'>, tenantId: string): Promise<StockAdjustment> {
    // 確保填寫必要欄位
    const adjustmentData: Partial<StockAdjustment> = {
      ...adjustment,
      adjustmentDate: adjustment.adjustmentDate || new Date(),
      createdAt: new Date()
    };
    
    const result = await this.create(adjustmentData, tenantId);
    
    // 將ID賦值給adjustmentId字段
    const completeAdjustment: StockAdjustment = {
      ...result,
      adjustmentId: result.id as string
    };
    
    // 更新記錄，確保adjustmentId被儲存
    return this.update(result.id as string, completeAdjustment, tenantId);
  }
} 