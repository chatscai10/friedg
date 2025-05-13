/**
 * 庫存調整服務
 * 
 * 整合所有庫存調整相關功能的門面服務
 */
import { StockAdjustment, StockAdjustmentType, StockAdjustmentsFilter } from '../../inventory.types';
import { StockAdjustmentRepository } from '../../repositories/stock-adjustment.repository';
import { StockLevelRepository } from '../../repositories/stock-level.repository';
import { InventoryItemService } from '../inventory-item.service';
import { StockTransferService } from '../stock-transfer.service';
import { withErrorHandling, ErrorContext, ErrorSeverity, ErrorSource } from '../../utils/error-handler';
import { BusinessLogicError } from '../../utils/error-handler';
import { 
  RegularAdjustmentService, 
  AdjustmentOptions 
} from './regular-adjustment.service';
import { TransferAdjustmentService } from './transfer-adjustment.service';
import { 
  BatchAdjustmentService, 
  AdjustmentData,
  BatchAdjustmentResult 
} from './batch-adjustment.service';
import { AdjustmentCacheService } from './adjustment-cache.service';

/**
 * 庫存調整服務類
 * 
 * 門面模式：整合多個專業的庫存調整服務類
 */
export class StockAdjustmentService {
  private regularAdjustmentService: RegularAdjustmentService;
  private transferAdjustmentService: TransferAdjustmentService;
  private batchAdjustmentService: BatchAdjustmentService;
  private cacheService: AdjustmentCacheService;
  
  constructor(
    private repository: StockAdjustmentRepository,
    private stockLevelRepository: StockLevelRepository,
    private inventoryItemService: InventoryItemService
  ) {
    // 初始化所有子服務
    const stockTransferService = new StockTransferService();
    
    this.regularAdjustmentService = new RegularAdjustmentService(inventoryItemService);
    this.transferAdjustmentService = new TransferAdjustmentService(stockLevelRepository, stockTransferService);
    this.batchAdjustmentService = new BatchAdjustmentService(inventoryItemService);
    this.cacheService = new AdjustmentCacheService(repository);
  }
  
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
      identity: { tenantId, userId },
      params: { itemId, storeId, adjustmentType, quantityAdjusted },
      severity: ErrorSeverity.MEDIUM,
      source: ErrorSource.SYSTEM
    };
    
    return withErrorHandling(async () => {
      // 驗證參數和檢查品項是否存在
      await this.validateAdjustmentParams(tenantId, itemId, storeId, adjustmentType, quantityAdjusted, options);
      
      // 根據調整類型選擇不同的處理方式
      if (adjustmentType === StockAdjustmentType.TRANSFER && options.transferToStoreId) {
        // 處理移撥類型調整
        return await this.transferAdjustmentService.executeTransfer(
          tenantId, 
          itemId, 
          storeId, 
          options.transferToStoreId, 
          quantityAdjusted, 
          userId, 
          options
        );
      } else {
        // 處理一般調整
        return await this.regularAdjustmentService.executeAdjustment(
          tenantId,
          itemId,
          storeId,
          adjustmentType,
          quantityAdjusted,
          userId,
          options
        );
      }
    }, errorContext, {
      retry: adjustmentType !== StockAdjustmentType.TRANSFER, // 移撥操作不要重試，避免重複移撥
      logToDatabase: true
    });
  }
  
  /**
   * 獲取調整記錄詳情
   */
  async getAdjustment(adjustmentId: string, tenantId: string): Promise<StockAdjustment> {
    const errorContext: ErrorContext = {
      component: 'StockAdjustmentService',
      operation: '獲取調整記錄詳情',
      identity: { tenantId },
      params: { adjustmentId },
      severity: ErrorSeverity.LOW
    };
    
    return withErrorHandling(async () => {
      const adjustment = await this.cacheService.getAdjustmentWithCache(adjustmentId, tenantId);
      
      if (!adjustment) {
        throw new BusinessLogicError(`找不到ID為 ${adjustmentId} 的調整記錄`, 'ADJUSTMENT_NOT_FOUND');
      }
      
      return adjustment;
    }, errorContext, {
      retry: true,  // 讀取操作可以重試
      maxRetries: 2
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
    const errorContext: ErrorContext = {
      component: 'StockAdjustmentService',
      operation: '查詢調整記錄列表',
      identity: { tenantId },
      params: { filter, page, pageSize },
      severity: ErrorSeverity.LOW
    };
    
    return withErrorHandling(async () => {
      return await this.cacheService.listAdjustmentsWithCache(tenantId, filter, page, pageSize);
    }, errorContext, {
      retry: true  // 讀取操作可以重試
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
  ): Promise<BatchAdjustmentResult> {
    const errorContext: ErrorContext = {
      component: 'StockAdjustmentService',
      operation: '批量創建庫存調整',
      identity: { tenantId, userId },
      params: { 
        adjustmentCount: adjustments.length,
        adjustmentDate
      },
      severity: ErrorSeverity.MEDIUM
    };
    
    return withErrorHandling(async () => {
      // 驗證批次參數
      await this.batchAdjustmentService.validateBatchParams(tenantId, adjustments);
      
      // 執行批量調整
      return await this.batchAdjustmentService.executeBatch(
        tenantId, adjustments, userId, adjustmentDate
      );
    }, errorContext, {
      retry: false,  // 批量操作不要自動重試
      logToDatabase: true
    });
  }
  
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
      throw new BusinessLogicError(`找不到品項 (ID: ${itemId})`, 'ITEM_NOT_FOUND');
    }
    
    // 檢查移撥情況
    if (adjustmentType === StockAdjustmentType.TRANSFER && options.transferToStoreId) {
      this.transferAdjustmentService.validateTransferParams(storeId, options.transferToStoreId, quantityAdjusted);
    }
  }
} 