/**
 * 顧客消費行為分析報表服務
 * 生成顧客消費行為相關的報表
 */

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp, 
  QueryConstraint,
  getDoc,
  doc
} from 'firebase/firestore';
import { ReportService, ReportParams, ReportResult, ReportTimeRange } from './reportService';

// 顧客消費行為報表類型
export enum CustomerBehaviorReportType {
  FREQUENCY = 'frequency',             // 消費頻率
  AVERAGE_SPENDING = 'average_spending', // 平均消費金額
  PREFERRED_PRODUCTS = 'preferred_products', // 偏好商品
  PURCHASE_TIME = 'purchase_time',     // 購買時間分析
  CUSTOMER_SEGMENT = 'customer_segment', // 顧客分群
  RETENTION = 'retention'              // 顧客留存率
}

// 顧客消費行為報表參數
export interface CustomerBehaviorReportParams extends ReportParams {
  reportType: CustomerBehaviorReportType;
  customerSegment?: string;            // 顧客分群 (可選)
  productCategory?: string;            // 商品類別 (可選)
  minPurchaseCount?: number;           // 最小購買次數 (可選)
  minTotalSpending?: number;           // 最小總消費金額 (可選)
  sortBy?: string;                     // 排序欄位
  sortOrder?: 'asc' | 'desc';          // 排序順序
}

// 顧客消費行為報表項目
export interface CustomerBehaviorReportItem {
  customerId: string;
  customerName: string;
  
  // 消費頻率相關
  firstPurchaseDate?: Date;
  lastPurchaseDate?: Date;
  purchaseCount?: number;
  purchaseFrequency?: number;          // 平均每月購買次數
  daysSinceLastPurchase?: number;
  
  // 消費金額相關
  totalSpending?: number;
  averageOrderValue?: number;
  
  // 偏好商品相關
  favoriteProducts?: Array<{
    productId: string;
    productName: string;
    purchaseCount: number;
  }>;
  favoriteCategories?: Array<{
    categoryId: string;
    categoryName: string;
    purchaseCount: number;
  }>;
  
  // 購買時間相關
  preferredDayOfWeek?: string;
  preferredTimeOfDay?: string;
  
  // 顧客分群相關
  segment?: string;
  segmentScore?: number;
  
  // 其他
  membershipLevel?: string;
  points?: number;
  period?: string;
}

/**
 * 顧客消費行為報表服務類
 */
export class CustomerBehaviorReportService extends ReportService<CustomerBehaviorReportItem> {
  /**
   * 生成顧客消費行為報表
   */
  async generateReport(params: CustomerBehaviorReportParams): Promise<ReportResult<CustomerBehaviorReportItem>> {
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
      
      // 獲取顧客資料
      const customers = await this.getCustomers(tenantId, storeId);
      
      if (customers.length === 0) {
        return {
          data: [],
          summary: {},
          metadata: {
            title: this.getReportTitle(),
            description: this.getReportDescription(),
            generatedAt: new Date(),
            params: params,
            totalCount: 0
          }
        };
      }
      
      // 獲取訂單資料
      const orders = await this.getOrders(tenantId, storeId, startDate, endDate);
      
      // 根據報表類型生成報表數據
      let reportData: CustomerBehaviorReportItem[] = [];
      
      switch (params.reportType) {
        case CustomerBehaviorReportType.FREQUENCY:
          reportData = await this.generateFrequencyReport(customers, orders);
          break;
        case CustomerBehaviorReportType.AVERAGE_SPENDING:
          reportData = await this.generateAverageSpendingReport(customers, orders);
          break;
        case CustomerBehaviorReportType.PREFERRED_PRODUCTS:
          reportData = await this.generatePreferredProductsReport(customers, orders);
          break;
        case CustomerBehaviorReportType.PURCHASE_TIME:
          reportData = await this.generatePurchaseTimeReport(customers, orders);
          break;
        case CustomerBehaviorReportType.CUSTOMER_SEGMENT:
          reportData = await this.generateCustomerSegmentReport(customers, orders);
          break;
        case CustomerBehaviorReportType.RETENTION:
          reportData = await this.generateRetentionReport(customers, orders, startDate, endDate);
          break;
        default:
          throw new Error(`不支持的報表類型: ${params.reportType}`);
      }
      
      // 應用過濾條件
      reportData = this.applyFilters(reportData, params);
      
      // 排序
      if (params.sortBy && reportData.length > 0 && reportData[0].hasOwnProperty(params.sortBy)) {
        reportData.sort((a: any, b: any) => {
          if (a[params.sortBy!] === b[params.sortBy!]) return 0;
          if (a[params.sortBy!] === undefined || a[params.sortBy!] === null) return 1;
          if (b[params.sortBy!] === undefined || b[params.sortBy!] === null) return -1;
          
          return params.sortOrder === 'desc' 
            ? (b[params.sortBy!] > a[params.sortBy!] ? 1 : -1)
            : (a[params.sortBy!] > b[params.sortBy!] ? 1 : -1);
        });
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
      console.error('生成顧客消費行為報表失敗:', error);
      throw error;
    }
  }
  
  /**
   * 獲取報表標題
   */
  getReportTitle(): string {
    return '顧客消費行為分析報表';
  }
  
  /**
   * 獲取報表描述
   */
  getReportDescription(): string {
    return '顯示顧客的消費頻率、平均消費金額、偏好商品等消費行為分析。';
  }
  
  /**
   * 獲取顧客列表
   */
  private async getCustomers(tenantId: string, storeId?: string): Promise<any[]> {
    const queryConstraints: QueryConstraint[] = [
      where('tenantId', '==', tenantId)
    ];
    
    if (storeId) {
      // 如果需要按店鋪過濾顧客，可以添加相應的條件
      // 例如：queryConstraints.push(where('favoriteStoreId', '==', storeId));
    }
    
    const customersRef = collection(this.firestore, 'customers');
    const q = query(customersRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
  
  /**
   * 獲取訂單列表
   */
  private async getOrders(
    tenantId: string, 
    storeId: string | undefined, 
    startDate: Date, 
    endDate: Date
  ): Promise<any[]> {
    const queryConstraints: QueryConstraint[] = [
      where('tenantId', '==', tenantId),
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      where('status', '!=', 'cancelled')
    ];
    
    if (storeId) {
      queryConstraints.push(where('storeId', '==', storeId));
    }
    
    const ordersRef = collection(this.firestore, 'orders');
    const q = query(ordersRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
}
