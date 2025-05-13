/**
 * 批量庫存調整服務
 * 
 * 處理批量庫存調整操作
 */
import * as admin from 'firebase-admin';
import { StockAdjustment, StockAdjustmentType } from '../../inventory.types';
import { InventoryItemService } from '../inventory-item.service';
import { StockOperationService } from '../stock-operation.service';
import { processBatches, BatchProcessResult } from '../../utils/batch-processor';
import { firestoreProvider } from '../../db/database.provider';
import { cacheManager, CachePrefix } from '../../cache/cache-manager';
import { NegativeStockError, TransactionTooLargeError } from '../../utils/errors';
import { validateStockAdjustment } from '../../utils/validators';

/**
 * 單項調整數據接口
 */
export interface AdjustmentData {
  /** 品項ID */
  itemId: string;
  /** 店鋪ID */
  storeId: string;
  /** 調整類型 */
  adjustmentType: StockAdjustmentType;
  /** 調整數量 */
  quantityAdjusted: number;
  /** 調整原因 */
  reason?: string;
  /** 移撥目標店鋪ID */
  transferToStoreId?: string;
}

/**
 * 批量調整結果接口
 */
export interface BatchAdjustmentResult {
  /** 操作是否成功 */
  success: boolean;
  /** 所有處理結果 */
  results: SingleAdjustmentResult[];
  /** 成功項目數 */
  successCount: number;
  /** 失敗項目數 */
  failureCount: number;
  /** 創建的調整記錄 */
  adjustments?: StockAdjustment[];
}

/**
 * 單項調整處理結果
 */
export interface SingleAdjustmentResult {
  /** 品項ID */
  itemId: string;
  /** 店鋪ID */
  storeId: string;
  /** 是否成功 */
  success: boolean;
  /** 成功時的數據 */
  data?: any;
  /** 失敗時的錯誤訊息 */
  error?: string;
}

/**
 * 移撥處理數據
 */
interface TransferQuantities {
  /** 來源當前庫存 */
  sourceCurrentQuantity: number;
  /** 來源調整後庫存 */
  sourceNewQuantity: number;
  /** 目標當前庫存 */
  targetCurrentQuantity: number;
  /** 目標調整後庫存 */
  targetNewQuantity: number;
  /** 移撥數量 */
  transferQuantity: number;
}

/**
 * 批量庫存調整服務類
 */
export class BatchAdjustmentService {
  private stockOperationService: StockOperationService;
  
  constructor(
    private inventoryItemService: InventoryItemService
  ) {
    this.stockOperationService = new StockOperationService();
  }
  
  /**
   * 驗證批量調整參數
   */
  async validateBatchParams(
    tenantId: string,
    adjustments: AdjustmentData[]
  ): Promise<void> {
    // 檢查空數組
    if (!adjustments.length) {
      return;
    }
    
    // 檢查批次大小
    if (adjustments.length > 100) {
      throw new TransactionTooLargeError();
    }
    
    // 收集所有要調整的品項ID
    const itemIds = [...new Set(adjustments.map(item => item.itemId))];
    
    // 批量獲取品項信息
    const itemsMap = await this.inventoryItemService.batchGetItems(itemIds, tenantId);
    
    // 檢查所有品項是否存在
    const missingItemIds = itemIds.filter(id => !itemsMap[id]);
    if (missingItemIds.length > 0) {
      throw new Error(`找不到以下品項: ${missingItemIds.join(', ')}`);
    }
  }
  
  /**
   * 執行批量庫存調整
   */
  async executeBatch(
    tenantId: string,
    adjustments: AdjustmentData[],
    userId: string,
    adjustmentDate?: Date
  ): Promise<BatchAdjustmentResult> {
    // 使用批次處理工具處理
    const batchResults = await this.processBatchAdjustments(
      tenantId, adjustments, userId, adjustmentDate
    );
    
    // 收集所有受影響的品項和店鋪
    const { affectedItemIds, affectedStoreIds } = this.collectAffectedEntities(adjustments);
    
    // 清除所有相關緩存
    this.invalidateBatchRelatedCaches(
      tenantId, 
      Array.from(affectedItemIds), 
      Array.from(affectedStoreIds)
    );
    
    // 合併和返回結果
    return this.combineBatchResults(batchResults);
  }
  
  /**
   * 處理批量調整
   * @private
   */
  private async processBatchAdjustments(
    tenantId: string,
    adjustments: AdjustmentData[],
    userId: string,
    adjustmentDate?: Date
  ): Promise<BatchProcessResult<AdjustmentData, any>> {
    return processBatches(
      adjustments,
      batchItems => this.processBatchCreateAdjustments(
        tenantId, 
        batchItems, 
        userId, 
        adjustmentDate
      ),
      10, // 每批最多10個
      { tenantId }
    );
  }
  
  /**
   * 處理單個批次的庫存調整創建
   * @private
   */
  private async processBatchCreateAdjustments(
    tenantId: string,
    adjustments: AdjustmentData[],
    userId: string,
    adjustmentDate?: Date
  ): Promise<BatchAdjustmentResult> {
    // 處理日期
    const now = admin.firestore.Timestamp.now();
    const adjDate = adjustmentDate || now.toDate();
    
    // 預先獲取所有庫存品項信息
    const itemIds = [...new Set(adjustments.map(a => a.itemId))];
    const itemsMap = await this.inventoryItemService.batchGetItems(itemIds, tenantId);
    
    // 使用事務處理批量創建調整
    return firestoreProvider.runTransaction(async (transaction) => {
      const results: SingleAdjustmentResult[] = [];
      let successCount = 0;
      let failureCount = 0;
      const createdAdjustments: StockAdjustment[] = [];
      
      // 處理每個調整
      for (const adjustment of adjustments) {
        try {
          // 根據調整類型選擇不同的處理方式
          if (adjustment.adjustmentType === StockAdjustmentType.TRANSFER && adjustment.transferToStoreId) {
            await this.processSingleTransferInBatch(
              transaction,
              tenantId,
              adjustment,
              userId,
              adjDate,
              results,
              createdAdjustments,
              itemsMap
            );
          } else {
            await this.processSingleAdjustmentInBatch(
              transaction,
              tenantId,
              adjustment,
              userId,
              adjDate,
              results,
              createdAdjustments,
              itemsMap
            );
          }
          
          successCount++;
        } catch (error: any) {
          // 記錄失敗
          results.push({
            itemId: adjustment.itemId,
            storeId: adjustment.storeId,
            success: false,
            error: error.message || '創建庫存調整時發生錯誤'
          });
          
          failureCount++;
        }
      }
      
      // 返回結果
      return {
        success: failureCount === 0,
        results,
        successCount,
        failureCount,
        adjustments: createdAdjustments
      };
    });
  }
  
  /**
   * 批量處理中處理單個一般調整
   * @private
   */
  private async processSingleAdjustmentInBatch(
    transaction: admin.firestore.Transaction,
    tenantId: string,
    adjustment: AdjustmentData,
    userId: string,
    adjustmentDate: Date,
    results: SingleAdjustmentResult[],
    createdAdjustments: StockAdjustment[],
    itemsMap: Record<string, any>
  ): Promise<void> {
    // 驗證調整資料
    validateStockAdjustment({
      itemId: adjustment.itemId,
      storeId: adjustment.storeId,
      tenantId,
      adjustmentType: adjustment.adjustmentType,
      quantityAdjusted: adjustment.quantityAdjusted
    });
    
    // 獲取或創建庫存水平
    const stockLevelInfo = await this.stockOperationService.getOrCreateStockLevel(
      transaction,
      adjustment.itemId,
      adjustment.storeId,
      tenantId,
      itemsMap[adjustment.itemId]?.lowStockThreshold || 0
    );
    
    // 計算新數量
    const newQuantity = stockLevelInfo.currentQuantity + adjustment.quantityAdjusted;
    
    // 確保不為負數
    if (newQuantity < 0) {
      throw new NegativeStockError(adjustment.itemId, adjustment.storeId);
    }
    
    // 創建調整記錄
    const newAdjustment = this.stockOperationService.createAdjustmentRecord(
      transaction,
      {
        itemId: adjustment.itemId,
        storeId: adjustment.storeId,
        tenantId,
        adjustmentType: adjustment.adjustmentType,
        quantityAdjusted: adjustment.quantityAdjusted,
        beforeQuantity: stockLevelInfo.currentQuantity,
        afterQuantity: newQuantity,
        operatorId: userId,
        reason: adjustment.reason,
        adjustmentDate
      }
    );
    
    // 更新庫存水平
    this.stockOperationService.updateStockLevel(
      transaction,
      stockLevelInfo.stockLevelRef,
      stockLevelInfo.stockLevelId,
      {
        itemId: adjustment.itemId,
        storeId: adjustment.storeId,
        tenantId,
        quantity: newQuantity,
        lowStockThreshold: stockLevelInfo.lowStockThreshold
      },
      userId,
      stockLevelInfo.isNew
    );
    
    // 添加到結果
    createdAdjustments.push(newAdjustment);
    
    // 記錄成功
    results.push({
      itemId: adjustment.itemId,
      storeId: adjustment.storeId,
      success: true,
      data: {
        adjustmentId: newAdjustment.adjustmentId,
        adjustmentType: adjustment.adjustmentType,
        quantityAdjusted: adjustment.quantityAdjusted,
        newQuantity
      }
    });
  }
  
  /**
   * 批量處理中處理單個移撥調整
   * @private
   */
  private async processSingleTransferInBatch(
    transaction: admin.firestore.Transaction,
    tenantId: string,
    adjustment: AdjustmentData,
    userId: string,
    adjustmentDate: Date,
    results: SingleAdjustmentResult[],
    createdAdjustments: StockAdjustment[],
    itemsMap: Record<string, any>
  ): Promise<void> {
    if (!adjustment.transferToStoreId) {
      throw new Error('移撥必須指定目標店鋪');
    }
    
    // 獲取來源庫存水平
    const sourceStockLevelInfo = await this.stockOperationService.getOrCreateStockLevel(
      transaction,
      adjustment.itemId,
      adjustment.storeId,
      tenantId,
      itemsMap[adjustment.itemId]?.lowStockThreshold || 0
    );
    
    // 確保移撥數量為正數值
    const transferQuantity = adjustment.quantityAdjusted < 0 ? 
      Math.abs(adjustment.quantityAdjusted) : adjustment.quantityAdjusted;
    
    // 計算來源新數量
    const sourceNewQuantity = sourceStockLevelInfo.currentQuantity - transferQuantity;
    
    // 確保不為負數
    if (sourceNewQuantity < 0) {
      throw new NegativeStockError(adjustment.itemId, adjustment.storeId);
    }
    
    // 獲取目標庫存水平
    const targetStockLevelInfo = await this.stockOperationService.getOrCreateStockLevel(
      transaction,
      adjustment.itemId,
      adjustment.transferToStoreId,
      tenantId,
      itemsMap[adjustment.itemId]?.lowStockThreshold || 0
    );
    
    // 計算目標新數量
    const targetNewQuantity = targetStockLevelInfo.currentQuantity + transferQuantity;
    
    // 創建移撥調整記錄
    const { sourceAdjustment, targetAdjustment } = this.createTransferAdjustmentRecords(
      transaction,
      tenantId,
      adjustment,
      userId,
      adjustmentDate,
      {
        sourceCurrentQuantity: sourceStockLevelInfo.currentQuantity,
        sourceNewQuantity,
        targetCurrentQuantity: targetStockLevelInfo.currentQuantity,
        targetNewQuantity,
        transferQuantity
      }
    );
    
    // 更新來源庫存水平
    this.stockOperationService.updateStockLevel(
      transaction,
      sourceStockLevelInfo.stockLevelRef,
      sourceStockLevelInfo.stockLevelId,
      {
        itemId: adjustment.itemId,
        storeId: adjustment.storeId,
        tenantId,
        quantity: sourceNewQuantity,
        lowStockThreshold: sourceStockLevelInfo.lowStockThreshold
      },
      userId,
      sourceStockLevelInfo.isNew
    );
    
    // 更新目標庫存水平
    this.stockOperationService.updateStockLevel(
      transaction,
      targetStockLevelInfo.stockLevelRef,
      targetStockLevelInfo.stockLevelId,
      {
        itemId: adjustment.itemId,
        storeId: adjustment.transferToStoreId,
        tenantId,
        quantity: targetNewQuantity,
        lowStockThreshold: targetStockLevelInfo.lowStockThreshold
      },
      userId,
      targetStockLevelInfo.isNew
    );
    
    // 添加到結果
    createdAdjustments.push(sourceAdjustment);
    createdAdjustments.push(targetAdjustment);
    
    // 記錄成功
    results.push({
      itemId: adjustment.itemId,
      storeId: adjustment.storeId,
      success: true,
      data: {
        adjustmentId: sourceAdjustment.adjustmentId,
        adjustmentType: StockAdjustmentType.TRANSFER,
        quantityAdjusted: -transferQuantity,
        newQuantity: sourceNewQuantity,
        transferToStoreId: adjustment.transferToStoreId
      }
    });
  }
  
  /**
   * 創建移撥調整記錄
   * @private
   */
  private createTransferAdjustmentRecords(
    transaction: admin.firestore.Transaction,
    tenantId: string,
    adjustment: AdjustmentData,
    userId: string,
    adjustmentDate: Date,
    quantities: TransferQuantities
  ): { sourceAdjustment: StockAdjustment; targetAdjustment: StockAdjustment } {
    if (!adjustment.transferToStoreId) {
      throw new Error('移撥必須指定目標店鋪');
    }
    
    // 創建來源調整記錄
    const sourceAdjustment = this.stockOperationService.createAdjustmentRecord(
      transaction,
      {
        itemId: adjustment.itemId,
        storeId: adjustment.storeId,
        tenantId,
        adjustmentType: StockAdjustmentType.TRANSFER,
        quantityAdjusted: -quantities.transferQuantity,
        beforeQuantity: quantities.sourceCurrentQuantity,
        afterQuantity: quantities.sourceNewQuantity,
        operatorId: userId,
        reason: adjustment.reason,
        adjustmentDate,
        transferToStoreId: adjustment.transferToStoreId
      }
    );
    
    // 創建目標調整記錄
    const targetAdjustment = this.stockOperationService.createAdjustmentRecord(
      transaction,
      {
        itemId: adjustment.itemId,
        storeId: adjustment.transferToStoreId,
        tenantId,
        adjustmentType: StockAdjustmentType.RECEIPT,
        quantityAdjusted: quantities.transferQuantity,
        beforeQuantity: quantities.targetCurrentQuantity,
        afterQuantity: quantities.targetNewQuantity,
        operatorId: userId,
        reason: `從 ${adjustment.storeId} 移撥${adjustment.reason ? `: ${adjustment.reason}` : ''}`,
        adjustmentDate,
        transferToStoreId: adjustment.storeId // 反向引用
      }
    );
    
    return { sourceAdjustment, targetAdjustment };
  }
  
  /**
   * 合併批量處理結果
   * @private
   */
  private combineBatchResults(batchResults: any[]): BatchAdjustmentResult {
    const results = batchResults.flatMap(r => r.results || []);
    const createdAdjustments = batchResults.flatMap(r => r.adjustments || []);
    const successCount = batchResults.reduce((sum, r) => sum + (r.successCount || 0), 0);
    const failureCount = batchResults.reduce((sum, r) => sum + (r.failureCount || 0), 0);
    
    return {
      success: failureCount === 0,
      results,
      successCount,
      failureCount,
      adjustments: createdAdjustments
    };
  }
  
  /**
   * 收集批量調整中受影響的實體
   * @private
   */
  private collectAffectedEntities(adjustments: AdjustmentData[]): { 
    affectedItemIds: Set<string>; 
    affectedStoreIds: Set<string>; 
  } {
    const affectedItemIds = new Set<string>();
    const affectedStoreIds = new Set<string>();
    
    adjustments.forEach(adj => {
      affectedItemIds.add(adj.itemId);
      affectedStoreIds.add(adj.storeId);
      if (adj.transferToStoreId) {
        affectedStoreIds.add(adj.transferToStoreId);
      }
    });
    
    return { affectedItemIds, affectedStoreIds };
  }
  
  /**
   * 批量清除相關緩存
   * @private
   */
  private invalidateBatchRelatedCaches(
    tenantId: string,
    itemIds: string[],
    storeIds: string[]
  ): void {
    // 清除調整記錄列表緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.LIST}adjustments_${tenantId}`);
    
    // 清除品項相關緩存
    itemIds.forEach(itemId => {
      cacheManager.invalidateByPrefix(`${CachePrefix.INVENTORY_ITEM}${tenantId}_${itemId}`);
      
      // 清除每個品項在每個店鋪的庫存水平緩存
      storeIds.forEach(storeId => {
        cacheManager.invalidateByPrefix(`${CachePrefix.STOCK_LEVEL}${tenantId}_${itemId}_${storeId}`);
      });
    });
    
    // 清除庫存水平列表緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.LIST}stockLevels_${tenantId}`);
  }
} 