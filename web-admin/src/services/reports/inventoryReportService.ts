/**
 * 庫存分析報表服務
 * 生成庫存相關的報表
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp, 
  QueryConstraint 
} from 'firebase/firestore';
import { ReportService, ReportParams, ReportResult, ReportTimeRange } from './reportService';

// 庫存報表類型
export enum InventoryReportType {
  CURRENT_STOCK = 'current_stock',
  LOW_STOCK = 'low_stock',
  STOCK_MOVEMENT = 'stock_movement',
  EXPIRY_ALERT = 'expiry_alert',
  USAGE_ANALYSIS = 'usage_analysis',
  COST_ANALYSIS = 'cost_analysis'
}

// 庫存報表項目
export interface InventoryReportItem {
  itemId: string;
  itemName: string;
  category?: string;
  currentStock: number;
  unit: string;
  minStock?: number;
  maxStock?: number;
  reorderPoint?: number;
  costPerUnit?: number;
  totalCost?: number;
  lastRestockDate?: string;
  expiryDate?: string;
  daysToExpiry?: number;
  usageRate?: number;
  estimatedDaysLeft?: number;
  stockStatus?: 'normal' | 'low' | 'out_of_stock' | 'overstock';
  movementIn?: number;
  movementOut?: number;
  netMovement?: number;
  wastage?: number;
  supplier?: string;
}

// 庫存報表參數
export interface InventoryReportParams extends ReportParams {
  reportType: InventoryReportType;
  categoryFilter?: string;
  supplierFilter?: string;
  includeZeroStock?: boolean;
  lowStockThreshold?: number;
  expiryAlertDays?: number;
}

/**
 * 庫存報表服務類
 */
export class InventoryReportService extends ReportService<InventoryReportItem> {
  /**
   * 生成庫存報表
   */
  async generateReport(params: InventoryReportParams): Promise<ReportResult<InventoryReportItem>> {
    try {
      // 獲取時間範圍
      const { startDate, endDate } = this.getTimeRangeDates(
        params.timeRange,
        params.startDate,
        params.endDate
      );
      
      // 獲取租戶ID和店鋪ID
      const tenantId = params.tenantId || await this.getCurrentUserTenantId();
      const storeId = params.storeId || await this.getCurrentUserStoreId();
      
      if (!tenantId) {
        throw new Error('無法獲取租戶ID');
      }
      
      // 構建查詢條件
      const queryConstraints: QueryConstraint[] = [
        where('tenantId', '==', tenantId)
      ];
      
      // 如果有店鋪ID，添加店鋪過濾
      if (storeId) {
        queryConstraints.push(where('storeId', '==', storeId));
      }
      
      // 如果有分類過濾，添加分類過濾
      if (params.categoryFilter) {
        queryConstraints.push(where('category', '==', params.categoryFilter));
      }
      
      // 如果有供應商過濾，添加供應商過濾
      if (params.supplierFilter) {
        queryConstraints.push(where('supplier', '==', params.supplierFilter));
      }
      
      // 如果不包括零庫存，添加庫存過濾
      if (!params.includeZeroStock) {
        queryConstraints.push(where('currentStock', '>', 0));
      }
      
      // 添加排序
      queryConstraints.push(orderBy('itemName', 'asc'));
      
      // 執行查詢
      const inventoryRef = collection(this.firestore, 'inventoryItems');
      const q = query(inventoryRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      // 處理查詢結果
      const inventoryItems = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 根據報表類型生成報表數據
      let reportData: InventoryReportItem[] = [];
      
      switch (params.reportType) {
        case InventoryReportType.CURRENT_STOCK:
          reportData = this.generateCurrentStockReport(inventoryItems);
          break;
        case InventoryReportType.LOW_STOCK:
          reportData = this.generateLowStockReport(inventoryItems, params.lowStockThreshold);
          break;
        case InventoryReportType.STOCK_MOVEMENT:
          reportData = await this.generateStockMovementReport(inventoryItems, startDate, endDate);
          break;
        case InventoryReportType.EXPIRY_ALERT:
          reportData = this.generateExpiryAlertReport(inventoryItems, params.expiryAlertDays);
          break;
        case InventoryReportType.USAGE_ANALYSIS:
          reportData = await this.generateUsageAnalysisReport(inventoryItems, startDate, endDate);
          break;
        case InventoryReportType.COST_ANALYSIS:
          reportData = this.generateCostAnalysisReport(inventoryItems);
          break;
        default:
          throw new Error(`不支持的報表類型: ${params.reportType}`);
      }
      
      // 計算摘要數據
      const summary = this.calculateSummary(reportData, params.reportType);
      
      // 返回報表結果
      return {
        data: reportData,
        summary,
        metadata: {
          title: this.getReportTitle(),
          description: this.getReportDescription(),
          generatedAt: new Date(),
          params: params,
          totalCount: reportData.length
        }
      };
    } catch (error) {
      console.error('生成庫存報表失敗:', error);
      throw error;
    }
  }
  
  /**
   * 獲取報表標題
   */
  getReportTitle(): string {
    return '庫存分析報表';
  }
  
  /**
   * 獲取報表描述
   */
  getReportDescription(): string {
    return '顯示庫存狀態、庫存變動、即將過期和使用分析等庫存相關數據。';
  }
  
  /**
   * 獲取報表列定義
   */
  getReportColumns(): { field: string; header: string; width?: number }[] {
    return [
      { field: 'itemName', header: '品項名稱', width: 150 },
      { field: 'category', header: '分類', width: 100 },
      { field: 'currentStock', header: '目前庫存', width: 80 },
      { field: 'unit', header: '單位', width: 60 },
      { field: 'minStock', header: '最低庫存', width: 80 },
      { field: 'reorderPoint', header: '再訂購點', width: 80 },
      { field: 'costPerUnit', header: '單位成本', width: 80 },
      { field: 'totalCost', header: '總成本', width: 80 },
      { field: 'lastRestockDate', header: '最後進貨日期', width: 100 },
      { field: 'expiryDate', header: '到期日', width: 100 },
      { field: 'daysToExpiry', header: '剩餘天數', width: 80 },
      { field: 'usageRate', header: '使用率', width: 80 },
      { field: 'estimatedDaysLeft', header: '預估剩餘天數', width: 100 },
      { field: 'stockStatus', header: '庫存狀態', width: 100 },
      { field: 'movementIn', header: '進貨量', width: 80 },
      { field: 'movementOut', header: '出貨量', width: 80 },
      { field: 'netMovement', header: '淨變動', width: 80 },
      { field: 'wastage', header: '損耗', width: 80 },
      { field: 'supplier', header: '供應商', width: 120 }
    ];
  }
  
  /**
   * 生成當前庫存報表
   */
  private generateCurrentStockReport(inventoryItems: any[]): InventoryReportItem[] {
    return inventoryItems.map(item => ({
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      currentStock: item.currentStock || 0,
      unit: item.unit || '個',
      minStock: item.minStock,
      maxStock: item.maxStock,
      reorderPoint: item.reorderPoint,
      costPerUnit: item.costPerUnit,
      totalCost: (item.currentStock || 0) * (item.costPerUnit || 0),
      lastRestockDate: item.lastRestockDate instanceof Timestamp 
        ? item.lastRestockDate.toDate().toLocaleDateString() 
        : item.lastRestockDate,
      stockStatus: this.calculateStockStatus(item),
      supplier: item.supplier
    }));
  }
  
  /**
   * 生成低庫存報表
   */
  private generateLowStockReport(inventoryItems: any[], threshold?: number): InventoryReportItem[] {
    // 過濾低庫存項目
    const lowStockItems = inventoryItems.filter(item => {
      // 如果有指定閾值，使用閾值
      if (threshold !== undefined) {
        return (item.currentStock || 0) <= threshold;
      }
      
      // 否則使用項目的再訂購點或最低庫存
      const reorderPoint = item.reorderPoint || item.minStock || 0;
      return (item.currentStock || 0) <= reorderPoint;
    });
    
    return lowStockItems.map(item => ({
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      currentStock: item.currentStock || 0,
      unit: item.unit || '個',
      minStock: item.minStock,
      reorderPoint: item.reorderPoint,
      costPerUnit: item.costPerUnit,
      totalCost: (item.currentStock || 0) * (item.costPerUnit || 0),
      lastRestockDate: item.lastRestockDate instanceof Timestamp 
        ? item.lastRestockDate.toDate().toLocaleDateString() 
        : item.lastRestockDate,
      stockStatus: this.calculateStockStatus(item),
      supplier: item.supplier
    }));
  }
  
  /**
   * 生成庫存變動報表
   */
  private async generateStockMovementReport(inventoryItems: any[], startDate: Date, endDate: Date): Promise<InventoryReportItem[]> {
    // 獲取庫存變動記錄
    const movementData = await this.getStockMovements(inventoryItems.map(item => item.id), startDate, endDate);
    
    return inventoryItems.map(item => {
      const itemMovements = movementData[item.id] || { in: 0, out: 0, wastage: 0 };
      
      return {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        currentStock: item.currentStock || 0,
        unit: item.unit || '個',
        movementIn: itemMovements.in,
        movementOut: itemMovements.out,
        netMovement: itemMovements.in - itemMovements.out,
        wastage: itemMovements.wastage,
        costPerUnit: item.costPerUnit,
        totalCost: (item.currentStock || 0) * (item.costPerUnit || 0),
        supplier: item.supplier
      };
    });
  }
  
  /**
   * 生成到期警報報表
   */
  private generateExpiryAlertReport(inventoryItems: any[], alertDays: number = 7): InventoryReportItem[] {
    const today = new Date();
    
    // 過濾即將到期的項目
    const expiryItems = inventoryItems.filter(item => {
      if (!item.expiryDate) return false;
      
      const expiryDate = item.expiryDate instanceof Timestamp 
        ? item.expiryDate.toDate() 
        : new Date(item.expiryDate);
      
      const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysToExpiry <= alertDays && daysToExpiry >= 0;
    });
    
    return expiryItems.map(item => {
      const expiryDate = item.expiryDate instanceof Timestamp 
        ? item.expiryDate.toDate() 
        : new Date(item.expiryDate);
      
      const daysToExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        currentStock: item.currentStock || 0,
        unit: item.unit || '個',
        expiryDate: expiryDate.toLocaleDateString(),
        daysToExpiry,
        costPerUnit: item.costPerUnit,
        totalCost: (item.currentStock || 0) * (item.costPerUnit || 0),
        supplier: item.supplier
      };
    }).sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  }
  
  /**
   * 生成使用分析報表
   */
  private async generateUsageAnalysisReport(inventoryItems: any[], startDate: Date, endDate: Date): Promise<InventoryReportItem[]> {
    // 獲取庫存變動記錄
    const movementData = await this.getStockMovements(inventoryItems.map(item => item.id), startDate, endDate);
    
    // 計算日期範圍的天數
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return inventoryItems.map(item => {
      const itemMovements = movementData[item.id] || { in: 0, out: 0, wastage: 0 };
      
      // 計算日均使用量
      const totalUsage = itemMovements.out;
      const dailyUsage = daysDiff > 0 ? totalUsage / daysDiff : 0;
      
      // 計算預估剩餘天數
      const estimatedDaysLeft = dailyUsage > 0 ? Math.floor((item.currentStock || 0) / dailyUsage) : 999;
      
      return {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        currentStock: item.currentStock || 0,
        unit: item.unit || '個',
        usageRate: dailyUsage,
        estimatedDaysLeft,
        movementOut: itemMovements.out,
        wastage: itemMovements.wastage,
        costPerUnit: item.costPerUnit,
        totalCost: (item.currentStock || 0) * (item.costPerUnit || 0),
        supplier: item.supplier
      };
    }).sort((a, b) => a.estimatedDaysLeft - b.estimatedDaysLeft);
  }
  
  /**
   * 生成成本分析報表
   */
  private generateCostAnalysisReport(inventoryItems: any[]): InventoryReportItem[] {
    return inventoryItems.map(item => {
      const totalCost = (item.currentStock || 0) * (item.costPerUnit || 0);
      
      return {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        currentStock: item.currentStock || 0,
        unit: item.unit || '個',
        costPerUnit: item.costPerUnit || 0,
        totalCost,
        supplier: item.supplier
      };
    }).sort((a, b) => b.totalCost - a.totalCost);
  }
  
  /**
   * 獲取庫存變動記錄
   */
  private async getStockMovements(itemIds: string[], startDate: Date, endDate: Date): Promise<Record<string, { in: number; out: number; wastage: number }>> {
    const result: Record<string, { in: number; out: number; wastage: number }> = {};
    
    // 初始化結果
    itemIds.forEach(id => {
      result[id] = { in: 0, out: 0, wastage: 0 };
    });
    
    try {
      // 獲取庫存訂單（進貨）
      const inventoryOrdersRef = collection(this.firestore, 'inventoryOrders');
      const ordersQuery = query(
        inventoryOrdersRef,
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate)),
        where('status', '==', 'completed')
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      
      // 處理進貨數據
      for (const doc of ordersSnapshot.docs) {
        const order = doc.data();
        
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            if (result[item.itemId]) {
              result[item.itemId].in += item.quantity || 0;
            }
          });
        }
      }
      
      // 獲取庫存盤點（出貨和損耗）
      const inventoryCountsRef = collection(this.firestore, 'inventoryCounts');
      const countsQuery = query(
        inventoryCountsRef,
        where('countDate', '>=', Timestamp.fromDate(startDate)),
        where('countDate', '<=', Timestamp.fromDate(endDate))
      );
      
      const countsSnapshot = await getDocs(countsQuery);
      
      // 處理盤點數據
      for (const doc of countsSnapshot.docs) {
        const count = doc.data();
        
        if (count.items && Array.isArray(count.items)) {
          count.items.forEach((item: any) => {
            if (result[item.itemId]) {
              // 計算使用量和損耗
              const previousCount = item.previousCount || 0;
              const currentCount = item.currentCount || 0;
              const received = item.received || 0;
              
              // 計算理論上的使用量
              const theoreticalUsage = previousCount + received - currentCount;
              
              // 實際使用量
              const actualUsage = item.usage || 0;
              
              // 損耗 = 理論使用量 - 實際使用量
              const wastage = Math.max(0, theoreticalUsage - actualUsage);
              
              result[item.itemId].out += actualUsage;
              result[item.itemId].wastage += wastage;
            }
          });
        }
      }
      
      return result;
    } catch (error) {
      console.error('獲取庫存變動記錄失敗:', error);
      return result;
    }
  }
  
  /**
   * 計算庫存狀態
   */
  private calculateStockStatus(item: any): 'normal' | 'low' | 'out_of_stock' | 'overstock' {
    const currentStock = item.currentStock || 0;
    const minStock = item.minStock || 0;
    const maxStock = item.maxStock || 0;
    const reorderPoint = item.reorderPoint || minStock;
    
    if (currentStock <= 0) {
      return 'out_of_stock';
    } else if (currentStock <= reorderPoint) {
      return 'low';
    } else if (maxStock > 0 && currentStock > maxStock) {
      return 'overstock';
    } else {
      return 'normal';
    }
  }
  
  /**
   * 計算報表摘要
   */
  private calculateSummary(reportData: InventoryReportItem[], reportType: InventoryReportType): Record<string, any> {
    switch (reportType) {
      case InventoryReportType.CURRENT_STOCK:
      case InventoryReportType.LOW_STOCK:
        return this.calculateStockSummary(reportData);
      case InventoryReportType.STOCK_MOVEMENT:
        return this.calculateMovementSummary(reportData);
      case InventoryReportType.EXPIRY_ALERT:
        return this.calculateExpirySummary(reportData);
      case InventoryReportType.USAGE_ANALYSIS:
        return this.calculateUsageSummary(reportData);
      case InventoryReportType.COST_ANALYSIS:
        return this.calculateCostSummary(reportData);
      default:
        return {};
    }
  }
  
  /**
   * 計算庫存摘要
   */
  private calculateStockSummary(reportData: InventoryReportItem[]): Record<string, any> {
    const totalItems = reportData.length;
    const totalStock = reportData.reduce((sum, item) => sum + item.currentStock, 0);
    const totalCost = reportData.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    
    const lowStockItems = reportData.filter(item => item.stockStatus === 'low').length;
    const outOfStockItems = reportData.filter(item => item.stockStatus === 'out_of_stock').length;
    const overstockItems = reportData.filter(item => item.stockStatus === 'overstock').length;
    const normalStockItems = reportData.filter(item => item.stockStatus === 'normal').length;
    
    return {
      '總品項數': totalItems,
      '總庫存量': totalStock.toFixed(2),
      '總庫存成本': totalCost.toFixed(2),
      '正常庫存品項': normalStockItems,
      '低庫存品項': lowStockItems,
      '無庫存品項': outOfStockItems,
      '過量庫存品項': overstockItems
    };
  }
  
  /**
   * 計算變動摘要
   */
  private calculateMovementSummary(reportData: InventoryReportItem[]): Record<string, any> {
    const totalItems = reportData.length;
    const totalIn = reportData.reduce((sum, item) => sum + (item.movementIn || 0), 0);
    const totalOut = reportData.reduce((sum, item) => sum + (item.movementOut || 0), 0);
    const totalNet = reportData.reduce((sum, item) => sum + (item.netMovement || 0), 0);
    const totalWastage = reportData.reduce((sum, item) => sum + (item.wastage || 0), 0);
    
    const wastageRate = totalOut > 0 ? (totalWastage / totalOut) * 100 : 0;
    
    return {
      '總品項數': totalItems,
      '總進貨量': totalIn.toFixed(2),
      '總出貨量': totalOut.toFixed(2),
      '淨變動量': totalNet.toFixed(2),
      '總損耗量': totalWastage.toFixed(2),
      '損耗率': `${wastageRate.toFixed(2)}%`
    };
  }
  
  /**
   * 計算到期摘要
   */
  private calculateExpirySummary(reportData: InventoryReportItem[]): Record<string, any> {
    const totalItems = reportData.length;
    const totalCost = reportData.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    
    const expireToday = reportData.filter(item => item.daysToExpiry === 0).length;
    const expireIn3Days = reportData.filter(item => (item.daysToExpiry || 0) <= 3).length;
    const expireIn7Days = reportData.filter(item => (item.daysToExpiry || 0) <= 7).length;
    
    return {
      '即將到期品項數': totalItems,
      '即將到期庫存成本': totalCost.toFixed(2),
      '今日到期': expireToday,
      '3天內到期': expireIn3Days,
      '7天內到期': expireIn7Days
    };
  }
  
  /**
   * 計算使用摘要
   */
  private calculateUsageSummary(reportData: InventoryReportItem[]): Record<string, any> {
    const totalItems = reportData.length;
    const totalUsage = reportData.reduce((sum, item) => sum + (item.movementOut || 0), 0);
    const totalWastage = reportData.reduce((sum, item) => sum + (item.wastage || 0), 0);
    
    const criticalItems = reportData.filter(item => (item.estimatedDaysLeft || 0) <= 3).length;
    const lowItems = reportData.filter(item => {
      const days = item.estimatedDaysLeft || 0;
      return days > 3 && days <= 7;
    }).length;
    
    const wastageRate = totalUsage > 0 ? (totalWastage / totalUsage) * 100 : 0;
    
    return {
      '總品項數': totalItems,
      '總使用量': totalUsage.toFixed(2),
      '總損耗量': totalWastage.toFixed(2),
      '損耗率': `${wastageRate.toFixed(2)}%`,
      '庫存危急品項(≤3天)': criticalItems,
      '庫存偏低品項(≤7天)': lowItems
    };
  }
  
  /**
   * 計算成本摘要
   */
  private calculateCostSummary(reportData: InventoryReportItem[]): Record<string, any> {
    const totalItems = reportData.length;
    const totalCost = reportData.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    
    // 按分類分組
    const categoryCosts: Record<string, number> = {};
    reportData.forEach(item => {
      const category = item.category || '未分類';
      categoryCosts[category] = (categoryCosts[category] || 0) + (item.totalCost || 0);
    });
    
    // 找出成本最高的分類
    let highestCategory = '未分類';
    let highestCost = 0;
    
    Object.entries(categoryCosts).forEach(([category, cost]) => {
      if (cost > highestCost) {
        highestCategory = category;
        highestCost = cost;
      }
    });
    
    // 計算高成本品項（佔總成本的80%）
    const sortedItems = [...reportData].sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0));
    let cumulativeCost = 0;
    let highCostItems = 0;
    
    for (const item of sortedItems) {
      cumulativeCost += (item.totalCost || 0);
      highCostItems++;
      
      if (cumulativeCost >= totalCost * 0.8) {
        break;
      }
    }
    
    return {
      '總品項數': totalItems,
      '總庫存成本': totalCost.toFixed(2),
      '成本最高分類': highestCategory,
      '成本最高分類金額': highestCost.toFixed(2),
      '高成本品項數(佔80%)': highCostItems
    };
  }
}
