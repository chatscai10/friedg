/**
 * 庫存調整服務
 * 
 * 處理庫存調整的業務邏輯
 */
import * as admin from 'firebase-admin';
import { 
  StockAdjustment, 
  StockAdjustmentType, 
  StockAdjustmentsFilter,
  StockLevel
} from '../inventory.types';
import { StockAdjustmentRepository } from '../repositories/stock-adjustment.repository';
import { StockLevelRepository } from '../repositories/stock-level.repository';
import { InventoryItemService } from './inventory-item.service';
import { validateStockAdjustment } from '../utils/validators';
import { NegativeStockError, TransactionTooLargeError, ItemNotFoundError } from '../utils/errors';
import { processBatches, BatchProcessResult } from '../utils/batch-processor';
import { firestoreProvider } from '../db/database.provider';
import { StockTransferService } from './stock-transfer.service';
import { StockOperationService } from './stock-operation.service';
import { cacheManager, CacheLevel, CachePrefix } from '../cache/cache-manager';
import { withErrorHandling, ErrorContext } from '../utils/error-handler';
import { logger } from '../../logger';

const db = admin.firestore();

/**
 * 庫存調整處理結果接口
 */
interface AdjustmentResult {
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
interface SingleAdjustmentResult {
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
 * 庫存調整選項介面
 */
interface AdjustmentOptions {
  /** 調整原因 */
  reason?: string;
  /** 調整日期 */
  adjustmentDate?: Date;
  /** 移撥目標店鋪ID */
  transferToStoreId?: string;
}

/**
 * 單項調整數據接口
 */
interface AdjustmentData {
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
 * 庫存水平信息
 */
interface StockLevelInfo {
  /** 庫存水平ID */
  stockLevelId: string;
  /** 庫存水平引用 */
  stockLevelRef: admin.firestore.DocumentReference;
  /** 當前庫存數量 */
  currentQuantity: number;
  /** 低庫存閾值 */
  lowStockThreshold: number;
  /** 是否新創建的記錄 */
  isNew: boolean;
}

/**
 * 庫存調整服務類
 */
export class StockAdjustmentService {
  private stockOperationService: StockOperationService;
  private stockTransferService: StockTransferService;
  
  constructor(
    private repository: StockAdjustmentRepository,
    private stockLevelRepository: StockLevelRepository,
    private inventoryItemService: InventoryItemService,
    private stockOperationService: StockOperationService,
    private stockTransferService: StockTransferService
  ) {
    this.stockOperationService = stockOperationService;
    this.stockTransferService = stockTransferService;
  }
  
  // #region 公開方法
  
  /**
   * 創建庫存調整
   */
  async createAdjustment(
    tenantId: string,
    itemId: string,
    storeId: string,
    adjustmentType: StockAdjustmentType,
    quantityAdjusted: number,
    userId: string,
    options: AdjustmentOptions = {}
  ): Promise<StockAdjustment> {
    const errorContext: ErrorContext = {
      component: 'StockAdjustmentService',
      operation: '創建庫存調整',
      identity: { tenantId, userId }
    };
    
    return withErrorHandling(async () => {
      // 驗證參數和檢查品項
      await this.validateAdjustmentParams(tenantId, itemId, storeId, adjustmentType, quantityAdjusted, options);
      
      // 根據調整類型選擇不同的處理方式
      const result = await this.processAdjustmentByType(
        tenantId, 
        itemId, 
        storeId, 
        adjustmentType,
        quantityAdjusted, 
        userId, 
        options
      );
      
      return result;
    }, errorContext);
  }
  
  /**
   * 獲取調整記錄詳情
   */
  async getAdjustment(adjustmentId: string, tenantId: string): Promise<StockAdjustment> {
    return withErrorHandling(async () => {
      return await this.fetchAdjustmentWithCache(adjustmentId, tenantId);
    }, {
      component: 'StockAdjustmentService',
      operation: '獲取調整記錄詳情',
      identity: { tenantId }
    });
  }
  
  /**
   * 查詢調整記錄列表
   */
  async listAdjustments(
    tenantId: string, 
    filter: StockAdjustmentsFilter = {},
    page = 1, 
    pageSize = 20
  ) {
    return withErrorHandling(async () => {
      return await this.fetchAdjustmentsListWithCache(tenantId, filter, page, pageSize);
    }, {
      component: 'StockAdjustmentService',
      operation: '查詢調整記錄列表',
      identity: { tenantId }
    });
  }

  /**
   * 批量創建庫存調整
   */
  async batchCreateAdjustments(
    tenantId: string,
    adjustments: AdjustmentData[],
    userId: string,
    adjustmentDate?: Date
  ): Promise<AdjustmentResult> {
    return withErrorHandling(async () => {
      // 驗證批次參數
      await this.validateBatchAdjustmentParams(tenantId, adjustments);
      
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
      return this.combineBatchResults(tenantId, batchResults);
    }, {
      component: 'StockAdjustmentService',
      operation: '批量創建庫存調整',
      identity: { tenantId, userId }
    });
  }
  
  // #endregion 公開方法
  
  // #region 調整處理核心方法
  
  /**
   * 根據調整類型處理不同的調整
   * @private
   */
  private async processAdjustmentByType(
    tenantId: string,
    itemId: string,
    storeId: string,
    adjustmentType: StockAdjustmentType,
    quantityAdjusted: number,
    userId: string,
    options: AdjustmentOptions
  ): Promise<StockAdjustment> {
    // 如果是移撥類型，使用專門的移撥服務處理
    if (adjustmentType === StockAdjustmentType.TRANSFER && options.transferToStoreId) {
      return await this.processTransferAdjustment(
        tenantId, itemId, storeId, options.transferToStoreId, 
        quantityAdjusted, userId, options
      );
    }
    
    // 處理一般調整類型
    return await this.processRegularAdjustment(
      tenantId, itemId, storeId, adjustmentType,
      quantityAdjusted, userId, options
    );
  }
  
  /**
   * 處理移撥類型的調整
   * @private
   */
  private async processTransferAdjustment(
    tenantId: string,
    itemId: string,
    sourceStoreId: string,
    targetStoreId: string,
    quantityAdjusted: number,
    userId: string,
    options: AdjustmentOptions
  ): Promise<StockAdjustment> {
    // 獲取當前庫存水平
    const sourceStockLevel = await this.stockLevelRepository.getStockLevel(
      itemId, 
      sourceStoreId, 
      tenantId
    );
    
    if (!sourceStockLevel) {
      throw new Error(`找不到品項 ${itemId} 在店鋪 ${sourceStoreId} 的庫存記錄`);
    }
    
    // 使用專門的移撥服務處理
    const transferResult = await this.stockTransferService.executeTransfer(
      {
        itemId,
        storeId: sourceStoreId,
        tenantId,
        currentQuantity: sourceStockLevel.quantity
      },
      targetStoreId,
      Math.abs(quantityAdjusted), // 確保移撥數量為正數
      userId,
      options
    );
    
    // 清除相關緩存
    this.invalidateRelatedCaches(tenantId, itemId, sourceStoreId, targetStoreId);
    
    return transferResult.sourceAdjustment;
  }
  
  /**
   * 處理一般庫存調整
   * @private
   */
  private async processRegularAdjustment(
    tenantId: string,
    itemId: string,
    storeId: string,
    adjustmentType: StockAdjustmentType,
    quantityAdjusted: number,
    userId: string,
    options: AdjustmentOptions
  ): Promise<StockAdjustment> {
    // 獲取品項閾值
    const item = await this.inventoryItemService.getItem(itemId, tenantId);
    
    const adjustment = await firestoreProvider.runTransaction(async transaction => {
      // 獲取或創建庫存水平
      const stockLevelInfo = await this.stockOperationService.getOrCreateStockLevel(
        transaction,
        itemId,
        storeId,
        tenantId,
        item!.lowStockThreshold || 0
      );
      
      // 計算新數量和驗證
      const newQuantity = this.calculateAndValidateNewQuantity(
        stockLevelInfo.currentQuantity,
        quantityAdjusted,
        itemId,
        storeId
      );
      
      // 創建調整記錄
      const adjustment = this.stockOperationService.createAdjustmentRecord(
        transaction,
        {
          itemId,
          storeId,
          tenantId,
          adjustmentType,
          quantityAdjusted,
          beforeQuantity: stockLevelInfo.currentQuantity,
          afterQuantity: newQuantity,
          operatorId: userId,
          reason: options.reason,
          adjustmentDate: options.adjustmentDate
        }
      );
      
      // 更新庫存水平
      this.stockOperationService.updateStockLevel(
        transaction,
        stockLevelInfo.stockLevelRef,
        stockLevelInfo.stockLevelId,
        {
          itemId,
          storeId,
          tenantId,
          quantity: newQuantity,
          lowStockThreshold: stockLevelInfo.lowStockThreshold
        },
        userId,
        stockLevelInfo.isNew
      );
      
      return adjustment;
    });
    
    // 清除相關緩存
    this.invalidateRelatedCaches(tenantId, itemId, storeId);
    
    return adjustment;
  }
  
  // #endregion 調整處理核心方法
  
  // #region 批量處理方法
  
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
  ): Promise<AdjustmentResult> {
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
    const newQuantity = this.calculateAndValidateNewQuantity(
      stockLevelInfo.currentQuantity,
      adjustment.quantityAdjusted,
      adjustment.itemId,
      adjustment.storeId
    );
    
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
  private combineBatchResults(tenantId: string, batchResults: any[]): AdjustmentResult {
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
  
  // #endregion 批量處理方法
  
  // #region 緩存管理方法
  
  /**
   * 從緩存或資料庫獲取調整記錄
   * @private
   */
  private async fetchAdjustmentWithCache(adjustmentId: string, tenantId: string): Promise<StockAdjustment> {
    // 構建緩存鍵
    const cacheKey = `${CachePrefix.STOCK_ADJUSTMENT}${tenantId}_${adjustmentId}`;
    
    // 嘗試從緩存獲取
    const cachedData = cacheManager.get<StockAdjustment>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // 從資料庫獲取
    const adjustment = await this.repository.getAdjustment(adjustmentId, tenantId);
    
    if (!adjustment) {
      throw new Error(`找不到 ID 為 ${adjustmentId} 的庫存調整記錄`);
    }
    
    // 存入緩存 (長期緩存，因為歷史調整很少變化)
    cacheManager.set(cacheKey, adjustment, CacheLevel.LEVEL3);
    
    return adjustment;
  }
  
  /**
   * 從緩存或資料庫獲取調整記錄列表
   * @private
   */
  private async fetchAdjustmentsListWithCache(
    tenantId: string,
    filter: StockAdjustmentsFilter,
    page: number,
    pageSize: number
  ) {
    // 構建緩存鍵
    const filterKey = JSON.stringify(filter);
    const cacheKey = `${CachePrefix.LIST}adjustments_${tenantId}_${filterKey}_p${page}_s${pageSize}`;
    
    // 嘗試從緩存獲取
    const cachedResult = cacheManager.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    // 從儲存庫獲取數據
    const result = await this.repository.listAdjustments(tenantId, filter, page, pageSize);
    
    // 存入緩存 (中期緩存)
    cacheManager.set(cacheKey, result, CacheLevel.LEVEL2);
    
    return result;
  }
  
  /**
   * 清除相關緩存
   * @private
   */
  private invalidateRelatedCaches(
    tenantId: string,
    itemId: string,
    sourceStoreId: string,
    targetStoreId?: string
  ): void {
    // 清除調整記錄列表緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.LIST}adjustments_${tenantId}`);
    
    // 清除庫存水平緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.STOCK_LEVEL}${tenantId}_${itemId}_${sourceStoreId}`);
    
    // 如果有目標店鋪，也清除其緩存
    if (targetStoreId) {
      cacheManager.invalidateByPrefix(`${CachePrefix.STOCK_LEVEL}${tenantId}_${itemId}_${targetStoreId}`);
    }
    
    // 清除品項相關緩存
    cacheManager.invalidateByPrefix(`${CachePrefix.INVENTORY_ITEM}${tenantId}_${itemId}`);
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
  
  // #endregion 緩存管理方法
  
  // #region 驗證方法
  
  /**
   * 驗證調整參數
   * @private
   */
  private async validateAdjustmentParams(
    tenantId: string,
    itemId: string,
    storeId: string,
    adjustmentType: StockAdjustmentType,
    quantityAdjusted: number,
    options: AdjustmentOptions = {}
  ): Promise<void> {
    // 檢查品項是否存在
    const item = await this.inventoryItemService.getItem(itemId, tenantId);
    if (!item) {
      throw new ItemNotFoundError(itemId);
    }
    
    // 驗證調整類型和數據
    validateStockAdjustment({
      itemId,
      storeId,
      tenantId,
      adjustmentType,
      quantityAdjusted,
      transferToStoreId: options.transferToStoreId
    });
    
    // 檢查移撥情況
    if (adjustmentType === StockAdjustmentType.TRANSFER) {
      this.validateTransferParams(options, storeId, quantityAdjusted);
    }
  }
  
  /**
   * 驗證移撥參數
   * @private
   */
  private validateTransferParams(
    options: AdjustmentOptions,
    storeId: string,
    quantityAdjusted: number
  ): void {
    if (!options.transferToStoreId) {
      throw new Error('移撥類型的調整必須指定目標店鋪');
    }
    
    if (options.transferToStoreId === storeId) {
      throw new Error('移撥目標店鋪不能與來源店鋪相同');
    }
    
    if (quantityAdjusted >= 0) {
      throw new Error('移撥調整的數量必須為負數');
    }
  }
  
  /**
   * 驗證批量調整參數
   * @private
   */
  private async validateBatchAdjustmentParams(
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
   * 計算並驗證新庫存量
   * @private
   */
  private calculateAndValidateNewQuantity(
    currentQuantity: number,
    quantityAdjusted: number,
    itemId: string,
    storeId: string
  ): number {
    // 計算新數量
    const newQuantity = currentQuantity + quantityAdjusted;
    
    // 確保不為負數
    if (newQuantity < 0) {
      throw new NegativeStockError(itemId, storeId);
    }
    
    return newQuantity;
  }
  
  // #endregion 驗證方法

  /**
   * [REFACTORED] Creates a stock adjustment record and updates the stock level
   * directly in the 'menuItems' collection within a single transaction.
   * Assumes itemId is the document ID in 'menuItems'. This ID should be for the item in the *source* store.
   * Assumes menuItems documents contain: storeId, tenantId, stock: { current }, manageStock (boolean), and potentially a global `productId`.
   */
  async createAdjustment_REFACTORED(
    tenantId: string,
    itemId: string, // Document ID of the menuItem in the source store
    storeId: string, // Source store for the adjustment
    adjustmentType: StockAdjustmentType,
    quantityAdjusted: number, // Positive for increase (RECEIPT, POSITIVE_ADJ), negative for decrease (ISSUE, WASTAGE, NEGATIVE_ADJ, TRANSFER_OUT)
    userId: string,
    options: {
      reason?: string;
      adjustmentDate?: Date;
      transferToStoreId?: string; // Required if adjustmentType is TRANSFER. This is the ID of the destination store.
      isInitialStock?: boolean; // Flag for initial stock setup
      productId?: string; // Global product identifier, used for transfers if targetItemId not given.
    } = {}
  ) {
    const sourceMenuItemRef = db.collection('menuItems').doc(itemId); // Ref to source item\\\'s document
    const now = admin.firestore.Timestamp.now();
    const adjustmentDate = options.adjustmentDate || now.toDate();

    return db.runTransaction(async transaction => {
      const sourceMenuItemDoc = await transaction.get(sourceMenuItemRef);

      if (!sourceMenuItemDoc.exists) {
        logger.error(`[createAdjustment_REFACTORED] Source MenuItem with ID ${itemId} not found.`);
        throw new Error(`[RefactoredAdjustment] Source Menu item with ID ${itemId} not found.`);
      }
      const sourceMenuItemData = sourceMenuItemDoc.data() as {
        storeId?: string;
        tenantId?: string;
        productId?: string; // Global product ID
        stock?: { current?: number; manageStock?: boolean; lowStockThreshold?: number };
        // manageStock?: boolean; // Prefer nested
        name?: string;
      };

      // Validate source item belongs to the specified source storeId and tenantId
      if (sourceMenuItemData.storeId !== storeId) {
        logger.error(`[createAdjustment_REFACTORED] Source MenuItem ${itemId} storeId mismatch. Expected source store: ${storeId}, Actual item store: ${sourceMenuItemData.storeId}`);
        throw new Error(`[RefactoredAdjustment] Source Menu item ${itemId} is associated with store ${sourceMenuItemData.storeId}, not target source store ${storeId}.`);
      }
      if (sourceMenuItemData.tenantId !== tenantId) {
        logger.error(`[createAdjustment_REFACTORED] Source MenuItem ${itemId} tenantId mismatch. Expected: ${tenantId}, Actual: ${sourceMenuItemData.tenantId}`);
        throw new Error(`[RefactoredAdjustment] Source Menu item ${itemId} tenant mismatch. Expected ${tenantId}, got ${sourceMenuItemData.tenantId}.`);
      }

      const sourceCurrentQuantity = sourceMenuItemData.stock?.current || 0;
      let actualQuantityAdjusted = quantityAdjusted; // This is the delta for the source
      let sourceNewQuantity;

      if (options.isInitialStock) {
        sourceNewQuantity = quantityAdjusted;
        actualQuantityAdjusted = sourceNewQuantity - sourceCurrentQuantity; 
      } else {
        sourceNewQuantity = sourceCurrentQuantity + quantityAdjusted; 
      }

      if (!options.isInitialStock && sourceNewQuantity < 0) {
         // Allow stock to become less negative or zero if it was already negative and adjustment is positive.
         // Otherwise, prevent stock from becoming negative.
        if (! (sourceCurrentQuantity < 0 && actualQuantityAdjusted > 0) ) {
            // If it was positive or zero and is becoming negative, throw error.
            if (sourceCurrentQuantity >=0 ) {
                 logger.error(`[createAdjustment_REFACTORED] Adj for source item ${itemId} in store ${storeId} results in negative stock (${sourceNewQuantity}). Current: ${sourceCurrentQuantity}, Adjusted: ${actualQuantityAdjusted}`);
                 throw new Error(`Adjusted quantity (${sourceNewQuantity}) for item '${sourceMenuItemData.name || itemId}' (source) cannot be negative.`);
            }
        }
      }
      
      const updatePayload: any = {
        'stock.current': sourceNewQuantity,
        'stock.manageStock': true, 
        'updatedAt': now,
      };
      
      // Preserve existing lowStockThreshold if not explicitly changed and it exists
      if (sourceMenuItemData.stock?.lowStockThreshold !== undefined) {
        updatePayload['stock.lowStockThreshold'] = sourceMenuItemData.stock.lowStockThreshold;
      }


      transaction.update(sourceMenuItemRef, updatePayload);
      logger.info(`[createAdjustment_REFACTORED] Stock for source menuItem ${itemId} in store ${storeId} updated from ${sourceCurrentQuantity} to ${sourceNewQuantity}.`);

      const sourceAdjustment = await this.createAdjustmentRecordInTransaction_REFACTORED(transaction, {
        itemId: itemId, 
        storeId,
        tenantId,
        adjustmentType,
        quantityAdjusted: actualQuantityAdjusted,
        beforeQuantity: sourceCurrentQuantity,
        afterQuantity: sourceNewQuantity,
        reason: options.reason,
        adjustmentDate,
        operatorId: userId,
        transferToStoreId: adjustmentType === StockAdjustmentType.TRANSFER_IN ? sourceStoreIdFromReason : undefined, // For TRANSFER_IN, source is in reason
      });
      logger.info(`[createAdjustment_REFACTORED] Source stock adjustment record ${sourceAdjustment.adjustmentId} created for item ${itemId}, store ${storeId}.`);

      let targetAdjustmentResponse: StockAdjustment | undefined = undefined;

      if (adjustmentType === StockAdjustmentType.TRANSFER) {
        if (!options.transferToStoreId || options.transferToStoreId === storeId) {
          logger.error(`[createAdjustment_REFACTORED] Invalid transferToStoreId for TRANSFER: ${options.transferToStoreId}.`);
          throw new Error('Inventory transfer destination store ID is invalid or same as source store.');
        }
        const targetStoreId = options.transferToStoreId;
        const globalProductId = options.productId || sourceMenuItemData.productId || itemId; 

        const targetItemQuery = db.collection('menuItems')
                                  .where('productId', '==', globalProductId)
                                  .where('storeId', '==', targetStoreId)
                                  .where('tenantId', '==', tenantId)
                                  .limit(1);
        const targetMenuItemSnapshot = await transaction.get(targetItemQuery);

        if (targetMenuItemSnapshot.empty) {
          logger.error(`[createAdjustment_REFACTORED] Target menu item for product ID ${globalProductId} in store ${targetStoreId} not found for TRANSFER.`);
          throw new Error(`Transfer failed: Product '${sourceMenuItemData.name || globalProductId}' not found in destination store ${targetStoreId}.`);
        }
        const targetMenuItemRef = targetMenuItemSnapshot.docs[0].ref;
        const targetMenuItemDocId = targetMenuItemRef.id; 
        const targetMenuItemData = targetMenuItemSnapshot.docs[0].data() as {
            stock?: { current?: number; manageStock?: boolean; lowStockThreshold?: number };
            name?: string;
        };

        const targetCurrentQuantity = targetMenuItemData.stock?.current || 0;
        const quantityReceivedByTarget = Math.abs(actualQuantityAdjusted);
        const targetNewQuantity = targetCurrentQuantity + quantityReceivedByTarget;

        const targetUpdatePayload: any = {
            'stock.current': targetNewQuantity,
            'stock.manageStock': true,
            'updatedAt': now,
        };
        if (targetMenuItemData.stock?.lowStockThreshold !== undefined) {
            targetUpdatePayload['stock.lowStockThreshold'] = targetMenuItemData.stock.lowStockThreshold;
        }

        transaction.update(targetMenuItemRef, targetUpdatePayload);
        logger.info(`[createAdjustment_REFACTORED] Stock for target menuItem ${targetMenuItemDocId} (product ${globalProductId}) in store ${targetStoreId} updated to ${targetNewQuantity}.`);

        targetAdjustmentResponse = await this.createAdjustmentRecordInTransaction_REFACTORED(transaction, {
          itemId: targetMenuItemDocId,
          storeId: targetStoreId,
          tenantId,
          adjustmentType: StockAdjustmentType.RECEIPT, 
          quantityAdjusted: quantityReceivedByTarget,
          beforeQuantity: targetCurrentQuantity,
          afterQuantity: targetNewQuantity,
          reason: `Transfer from store ${storeId} (Product: ${globalProductId}) - ${options.reason || 'Product Transfer'}`.trim(),
          adjustmentDate,
          operatorId: userId,
        });
        logger.info(`[createAdjustment_REFACTORED] Target stock adjustment record ${targetAdjustmentResponse.adjustmentId} created for item ${targetMenuItemDocId}, target store ${targetStoreId}.`);
      }

      return {
        sourceAdjustment,
        targetAdjustment: targetAdjustmentResponse,
      };
    });
  }

  /**
   * [REFACTORED - Helper, added createdAt/updatedAt to StockAdjustment type]
   * Creates a stock adjustment record within a Firestore transaction.
   */
  async createAdjustmentRecordInTransaction_REFACTORED(
    transaction: admin.firestore.Transaction,
    details: {
      itemId: string;
      storeId: string;
      tenantId: string;
      adjustmentType: StockAdjustmentType;
      quantityAdjusted: number;
      beforeQuantity: number;
      afterQuantity: number;
      reason?: string;
      adjustmentDate?: Date;
      operatorId: string;
      transferToStoreId?: string;
    }
  ): Promise<StockAdjustment> {
    const adjustmentId = db.collection('stockAdjustments').doc().id;
    const nowTimestamp = admin.firestore.Timestamp.now().toDate(); 
    const adjustmentData: StockAdjustment = {
      adjustmentId,
      itemId: details.itemId,
      storeId: details.storeId,
      tenantId: details.tenantId,
      adjustmentType: details.adjustmentType,
      quantityAdjusted: details.quantityAdjusted,
      beforeQuantity: details.beforeQuantity,
      afterQuantity: details.afterQuantity,
      reason: details.reason,
      adjustmentDate: details.adjustmentDate || nowTimestamp, 
      operatorId: details.operatorId,
      transferToStoreId: details.transferToStoreId,
      createdAt: nowTimestamp,
      updatedAt: nowTimestamp,
    };
    const adjustmentRef = db.collection('stockAdjustments').doc(adjustmentId);
    transaction.set(adjustmentRef, adjustmentData);
    logger.info(`[createAdjustmentRecordInTransaction_REFACTORED] Adjustment record ${adjustmentId} set in transaction for item ${details.itemId} store ${details.storeId}.`);
    return adjustmentData;
  }
}

export {}; // Ensures this is treated as a module if it becomes completely empty 