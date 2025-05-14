/**
 * 銷售報表服務
 * 生成銷售相關的報表
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

// 銷售報表類型
export enum SalesReportType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  BY_PRODUCT = 'by_product',
  BY_CATEGORY = 'by_category',
  BY_PAYMENT_METHOD = 'by_payment_method',
  BY_ORDER_SOURCE = 'by_order_source'
}

// 銷售報表項目
export interface SalesReportItem {
  date: string;
  period: string;
  totalOrders: number;
  totalSales: number;
  totalTax: number;
  totalDiscount: number;
  netSales: number;
  averageOrderValue: number;
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryName?: string;
  paymentMethod?: string;
  orderSource?: string;
  quantity?: number;
}

// 銷售報表參數
export interface SalesReportParams extends ReportParams {
  reportType: SalesReportType;
  includeVoidedOrders?: boolean;
  includeDiscounts?: boolean;
  groupByProduct?: boolean;
  groupByCategory?: boolean;
  groupByPaymentMethod?: boolean;
  groupByOrderSource?: boolean;
}

/**
 * 銷售報表服務類
 */
export class SalesReportService extends ReportService<SalesReportItem> {
  /**
   * 生成銷售報表
   */
  async generateReport(params: SalesReportParams): Promise<ReportResult<SalesReportItem>> {
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
        where('tenantId', '==', tenantId),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate))
      ];
      
      // 如果有店鋪ID，添加店鋪過濾
      if (storeId) {
        queryConstraints.push(where('storeId', '==', storeId));
      }
      
      // 如果不包括已取消訂單，添加狀態過濾
      if (!params.includeVoidedOrders) {
        queryConstraints.push(where('status', '!=', 'cancelled'));
      }
      
      // 添加排序
      queryConstraints.push(orderBy('createdAt', 'asc'));
      
      // 執行查詢
      const ordersRef = collection(this.firestore, 'orders');
      const q = query(ordersRef, ...queryConstraints);
      const querySnapshot = await getDocs(q);
      
      // 處理查詢結果
      const orders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 根據報表類型生成報表數據
      let reportData: SalesReportItem[] = [];
      
      switch (params.reportType) {
        case SalesReportType.DAILY:
          reportData = this.generateDailyReport(orders, startDate, endDate);
          break;
        case SalesReportType.WEEKLY:
          reportData = this.generateWeeklyReport(orders, startDate, endDate);
          break;
        case SalesReportType.MONTHLY:
          reportData = this.generateMonthlyReport(orders, startDate, endDate);
          break;
        case SalesReportType.YEARLY:
          reportData = this.generateYearlyReport(orders, startDate, endDate);
          break;
        case SalesReportType.BY_PRODUCT:
          reportData = await this.generateProductReport(orders);
          break;
        case SalesReportType.BY_CATEGORY:
          reportData = await this.generateCategoryReport(orders);
          break;
        case SalesReportType.BY_PAYMENT_METHOD:
          reportData = this.generatePaymentMethodReport(orders);
          break;
        case SalesReportType.BY_ORDER_SOURCE:
          reportData = this.generateOrderSourceReport(orders);
          break;
        default:
          throw new Error(`不支持的報表類型: ${params.reportType}`);
      }
      
      // 計算摘要數據
      const summary = this.calculateSummary(reportData);
      
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
      console.error('生成銷售報表失敗:', error);
      throw error;
    }
  }
  
  /**
   * 獲取報表標題
   */
  getReportTitle(): string {
    return '銷售報表';
  }
  
  /**
   * 獲取報表描述
   */
  getReportDescription(): string {
    return '顯示指定時間範圍內的銷售數據，包括訂單數量、銷售額、平均訂單金額等。';
  }
  
  /**
   * 獲取報表列定義
   */
  getReportColumns(): { field: string; header: string; width?: number }[] {
    return [
      { field: 'date', header: '日期', width: 100 },
      { field: 'period', header: '時段', width: 100 },
      { field: 'totalOrders', header: '訂單數量', width: 80 },
      { field: 'totalSales', header: '總銷售額', width: 100 },
      { field: 'totalTax', header: '總稅額', width: 80 },
      { field: 'totalDiscount', header: '總折扣', width: 80 },
      { field: 'netSales', header: '淨銷售額', width: 100 },
      { field: 'averageOrderValue', header: '平均訂單金額', width: 100 },
      { field: 'productName', header: '產品名稱', width: 150 },
      { field: 'categoryName', header: '分類名稱', width: 150 },
      { field: 'paymentMethod', header: '支付方式', width: 100 },
      { field: 'orderSource', header: '訂單來源', width: 100 },
      { field: 'quantity', header: '數量', width: 80 }
    ];
  }
  
  /**
   * 生成日報表
   */
  private generateDailyReport(orders: any[], startDate: Date, endDate: Date): SalesReportItem[] {
    // 創建日期範圍內的每一天
    const days: SalesReportItem[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      days.push({
        date: currentDate.toISOString().split('T')[0],
        period: currentDate.toLocaleDateString(),
        totalOrders: 0,
        totalSales: 0,
        totalTax: 0,
        totalDiscount: 0,
        netSales: 0,
        averageOrderValue: 0
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 填充每天的銷售數據
    orders.forEach(order => {
      const orderDate = order.createdAt instanceof Timestamp 
        ? order.createdAt.toDate() 
        : new Date(order.createdAt);
      
      const dateString = orderDate.toISOString().split('T')[0];
      const dayReport = days.find(day => day.date === dateString);
      
      if (dayReport) {
        dayReport.totalOrders += 1;
        dayReport.totalSales += order.total || 0;
        dayReport.totalTax += order.tax || 0;
        dayReport.totalDiscount += order.discount || 0;
        dayReport.netSales += (order.total || 0) - (order.tax || 0);
      }
    });
    
    // 計算平均訂單金額
    days.forEach(day => {
      day.averageOrderValue = day.totalOrders > 0 
        ? day.totalSales / day.totalOrders 
        : 0;
    });
    
    return days;
  }
  
  /**
   * 生成週報表
   */
  private generateWeeklyReport(orders: any[], startDate: Date, endDate: Date): SalesReportItem[] {
    // 按週分組
    const weekMap = new Map<string, SalesReportItem>();
    
    // 處理每個訂單
    orders.forEach(order => {
      const orderDate = order.createdAt instanceof Timestamp 
        ? order.createdAt.toDate() 
        : new Date(order.createdAt);
      
      // 計算週數
      const weekStart = new Date(orderDate);
      weekStart.setDate(orderDate.getDate() - orderDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekKey = `${weekStart.toISOString().split('T')[0]}_${weekEnd.toISOString().split('T')[0]}`;
      const weekPeriod = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
      
      // 獲取或創建週報表項
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          date: weekKey,
          period: weekPeriod,
          totalOrders: 0,
          totalSales: 0,
          totalTax: 0,
          totalDiscount: 0,
          netSales: 0,
          averageOrderValue: 0
        });
      }
      
      const weekReport = weekMap.get(weekKey)!;
      
      // 更新週報表數據
      weekReport.totalOrders += 1;
      weekReport.totalSales += order.total || 0;
      weekReport.totalTax += order.tax || 0;
      weekReport.totalDiscount += order.discount || 0;
      weekReport.netSales += (order.total || 0) - (order.tax || 0);
    });
    
    // 計算平均訂單金額
    const weeklyReport = Array.from(weekMap.values());
    weeklyReport.forEach(week => {
      week.averageOrderValue = week.totalOrders > 0 
        ? week.totalSales / week.totalOrders 
        : 0;
    });
    
    // 按日期排序
    return weeklyReport.sort((a, b) => a.date.localeCompare(b.date));
  }
  
  /**
   * 生成月報表
   */
  private generateMonthlyReport(orders: any[], startDate: Date, endDate: Date): SalesReportItem[] {
    // 按月分組
    const monthMap = new Map<string, SalesReportItem>();
    
    // 處理每個訂單
    orders.forEach(order => {
      const orderDate = order.createdAt instanceof Timestamp 
        ? order.createdAt.toDate() 
        : new Date(order.createdAt);
      
      // 計算月份
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      const monthPeriod = `${orderDate.getFullYear()}年${orderDate.getMonth() + 1}月`;
      
      // 獲取或創建月報表項
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          date: monthKey,
          period: monthPeriod,
          totalOrders: 0,
          totalSales: 0,
          totalTax: 0,
          totalDiscount: 0,
          netSales: 0,
          averageOrderValue: 0
        });
      }
      
      const monthReport = monthMap.get(monthKey)!;
      
      // 更新月報表數據
      monthReport.totalOrders += 1;
      monthReport.totalSales += order.total || 0;
      monthReport.totalTax += order.tax || 0;
      monthReport.totalDiscount += order.discount || 0;
      monthReport.netSales += (order.total || 0) - (order.tax || 0);
    });
    
    // 計算平均訂單金額
    const monthlyReport = Array.from(monthMap.values());
    monthlyReport.forEach(month => {
      month.averageOrderValue = month.totalOrders > 0 
        ? month.totalSales / month.totalOrders 
        : 0;
    });
    
    // 按日期排序
    return monthlyReport.sort((a, b) => a.date.localeCompare(b.date));
  }
  
  /**
   * 生成年報表
   */
  private generateYearlyReport(orders: any[], startDate: Date, endDate: Date): SalesReportItem[] {
    // 按年分組
    const yearMap = new Map<string, SalesReportItem>();
    
    // 處理每個訂單
    orders.forEach(order => {
      const orderDate = order.createdAt instanceof Timestamp 
        ? order.createdAt.toDate() 
        : new Date(order.createdAt);
      
      // 計算年份
      const yearKey = `${orderDate.getFullYear()}`;
      const yearPeriod = `${orderDate.getFullYear()}年`;
      
      // 獲取或創建年報表項
      if (!yearMap.has(yearKey)) {
        yearMap.set(yearKey, {
          date: yearKey,
          period: yearPeriod,
          totalOrders: 0,
          totalSales: 0,
          totalTax: 0,
          totalDiscount: 0,
          netSales: 0,
          averageOrderValue: 0
        });
      }
      
      const yearReport = yearMap.get(yearKey)!;
      
      // 更新年報表數據
      yearReport.totalOrders += 1;
      yearReport.totalSales += order.total || 0;
      yearReport.totalTax += order.tax || 0;
      yearReport.totalDiscount += order.discount || 0;
      yearReport.netSales += (order.total || 0) - (order.tax || 0);
    });
    
    // 計算平均訂單金額
    const yearlyReport = Array.from(yearMap.values());
    yearlyReport.forEach(year => {
      year.averageOrderValue = year.totalOrders > 0 
        ? year.totalSales / year.totalOrders 
        : 0;
    });
    
    // 按日期排序
    return yearlyReport.sort((a, b) => a.date.localeCompare(b.date));
  }
  
  /**
   * 生成產品報表
   */
  private async generateProductReport(orders: any[]): Promise<SalesReportItem[]> {
    // 按產品分組
    const productMap = new Map<string, SalesReportItem>();
    
    // 獲取所有訂單項目
    for (const order of orders) {
      // 如果訂單中包含項目，直接使用
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          this.processOrderItem(item, productMap, order);
        }
      } else {
        // 否則從orderItems集合中獲取
        const orderItemsRef = collection(this.firestore, 'orderItems');
        const q = query(orderItemsRef, where('orderId', '==', order.id));
        const itemsSnapshot = await getDocs(q);
        
        itemsSnapshot.forEach(doc => {
          const item = doc.data();
          this.processOrderItem(item, productMap, order);
        });
      }
    }
    
    // 轉換為數組並排序
    const productReport = Array.from(productMap.values());
    return productReport.sort((a, b) => b.totalSales - a.totalSales);
  }
  
  /**
   * 處理訂單項目
   */
  private processOrderItem(item: any, productMap: Map<string, SalesReportItem>, order: any): void {
    const productId = item.menuItemId;
    const productName = item.menuItemName;
    
    // 獲取或創建產品報表項
    if (!productMap.has(productId)) {
      productMap.set(productId, {
        date: '',
        period: '',
        totalOrders: 0,
        totalSales: 0,
        totalTax: 0,
        totalDiscount: 0,
        netSales: 0,
        averageOrderValue: 0,
        productId,
        productName,
        quantity: 0
      });
    }
    
    const productReport = productMap.get(productId)!;
    
    // 更新產品報表數據
    productReport.totalOrders += 1;
    productReport.totalSales += item.totalPrice || 0;
    productReport.quantity += item.quantity || 0;
    
    // 計算稅額和折扣（按比例分配）
    const orderTotal = order.total || 0;
    if (orderTotal > 0) {
      const itemRatio = (item.totalPrice || 0) / orderTotal;
      productReport.totalTax += (order.tax || 0) * itemRatio;
      productReport.totalDiscount += (order.discount || 0) * itemRatio;
    }
    
    productReport.netSales = productReport.totalSales - productReport.totalTax;
    productReport.averageOrderValue = productReport.totalSales / productReport.quantity;
  }
  
  /**
   * 生成分類報表
   */
  private async generateCategoryReport(orders: any[]): Promise<SalesReportItem[]> {
    // 按分類分組
    const categoryMap = new Map<string, SalesReportItem>();
    
    // 獲取所有菜單項目和分類
    const menuItemsRef = collection(this.firestore, 'menuItems');
    const menuItemsSnapshot = await getDocs(menuItemsRef);
    const menuItems = new Map<string, any>();
    
    menuItemsSnapshot.forEach(doc => {
      menuItems.set(doc.id, doc.data());
    });
    
    const categoriesRef = collection(this.firestore, 'menuCategories');
    const categoriesSnapshot = await getDocs(categoriesRef);
    const categories = new Map<string, any>();
    
    categoriesSnapshot.forEach(doc => {
      categories.set(doc.id, doc.data());
    });
    
    // 處理所有訂單項目
    for (const order of orders) {
      // 如果訂單中包含項目，直接使用
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          await this.processOrderItemByCategory(item, categoryMap, order, menuItems, categories);
        }
      } else {
        // 否則從orderItems集合中獲取
        const orderItemsRef = collection(this.firestore, 'orderItems');
        const q = query(orderItemsRef, where('orderId', '==', order.id));
        const itemsSnapshot = await getDocs(q);
        
        for (const doc of itemsSnapshot.docs) {
          const item = doc.data();
          await this.processOrderItemByCategory(item, categoryMap, order, menuItems, categories);
        }
      }
    }
    
    // 轉換為數組並排序
    const categoryReport = Array.from(categoryMap.values());
    return categoryReport.sort((a, b) => b.totalSales - a.totalSales);
  }
  
  /**
   * 按分類處理訂單項目
   */
  private async processOrderItemByCategory(
    item: any, 
    categoryMap: Map<string, SalesReportItem>, 
    order: any,
    menuItems: Map<string, any>,
    categories: Map<string, any>
  ): Promise<void> {
    const menuItemId = item.menuItemId;
    const menuItem = menuItems.get(menuItemId);
    
    if (!menuItem) {
      return;
    }
    
    const categoryId = menuItem.categoryId;
    const category = categories.get(categoryId);
    
    if (!category) {
      return;
    }
    
    const categoryName = category.name;
    
    // 獲取或創建分類報表項
    if (!categoryMap.has(categoryId)) {
      categoryMap.set(categoryId, {
        date: '',
        period: '',
        totalOrders: 0,
        totalSales: 0,
        totalTax: 0,
        totalDiscount: 0,
        netSales: 0,
        averageOrderValue: 0,
        categoryId,
        categoryName,
        quantity: 0
      });
    }
    
    const categoryReport = categoryMap.get(categoryId)!;
    
    // 更新分類報表數據
    categoryReport.totalOrders += 1;
    categoryReport.totalSales += item.totalPrice || 0;
    categoryReport.quantity += item.quantity || 0;
    
    // 計算稅額和折扣（按比例分配）
    const orderTotal = order.total || 0;
    if (orderTotal > 0) {
      const itemRatio = (item.totalPrice || 0) / orderTotal;
      categoryReport.totalTax += (order.tax || 0) * itemRatio;
      categoryReport.totalDiscount += (order.discount || 0) * itemRatio;
    }
    
    categoryReport.netSales = categoryReport.totalSales - categoryReport.totalTax;
    categoryReport.averageOrderValue = categoryReport.totalSales / categoryReport.quantity;
  }
  
  /**
   * 生成支付方式報表
   */
  private generatePaymentMethodReport(orders: any[]): SalesReportItem[] {
    // 按支付方式分組
    const paymentMethodMap = new Map<string, SalesReportItem>();
    
    // 處理每個訂單
    orders.forEach(order => {
      const paymentMethod = order.paymentMethod || 'unknown';
      
      // 獲取或創建支付方式報表項
      if (!paymentMethodMap.has(paymentMethod)) {
        paymentMethodMap.set(paymentMethod, {
          date: '',
          period: '',
          totalOrders: 0,
          totalSales: 0,
          totalTax: 0,
          totalDiscount: 0,
          netSales: 0,
          averageOrderValue: 0,
          paymentMethod: this.getPaymentMethodName(paymentMethod)
        });
      }
      
      const paymentReport = paymentMethodMap.get(paymentMethod)!;
      
      // 更新支付方式報表數據
      paymentReport.totalOrders += 1;
      paymentReport.totalSales += order.total || 0;
      paymentReport.totalTax += order.tax || 0;
      paymentReport.totalDiscount += order.discount || 0;
      paymentReport.netSales += (order.total || 0) - (order.tax || 0);
    });
    
    // 計算平均訂單金額
    const paymentReport = Array.from(paymentMethodMap.values());
    paymentReport.forEach(payment => {
      payment.averageOrderValue = payment.totalOrders > 0 
        ? payment.totalSales / payment.totalOrders 
        : 0;
    });
    
    // 按銷售額排序
    return paymentReport.sort((a, b) => b.totalSales - a.totalSales);
  }
  
  /**
   * 生成訂單來源報表
   */
  private generateOrderSourceReport(orders: any[]): SalesReportItem[] {
    // 按訂單來源分組
    const sourceMap = new Map<string, SalesReportItem>();
    
    // 處理每個訂單
    orders.forEach(order => {
      const source = order.source || 'unknown';
      
      // 獲取或創建訂單來源報表項
      if (!sourceMap.has(source)) {
        sourceMap.set(source, {
          date: '',
          period: '',
          totalOrders: 0,
          totalSales: 0,
          totalTax: 0,
          totalDiscount: 0,
          netSales: 0,
          averageOrderValue: 0,
          orderSource: this.getOrderSourceName(source)
        });
      }
      
      const sourceReport = sourceMap.get(source)!;
      
      // 更新訂單來源報表數據
      sourceReport.totalOrders += 1;
      sourceReport.totalSales += order.total || 0;
      sourceReport.totalTax += order.tax || 0;
      sourceReport.totalDiscount += order.discount || 0;
      sourceReport.netSales += (order.total || 0) - (order.tax || 0);
    });
    
    // 計算平均訂單金額
    const sourceReport = Array.from(sourceMap.values());
    sourceReport.forEach(source => {
      source.averageOrderValue = source.totalOrders > 0 
        ? source.totalSales / source.totalOrders 
        : 0;
    });
    
    // 按銷售額排序
    return sourceReport.sort((a, b) => b.totalSales - a.totalSales);
  }
  
  /**
   * 計算報表摘要
   */
  private calculateSummary(reportData: SalesReportItem[]): Record<string, any> {
    // 計算總計
    const totalOrders = reportData.reduce((sum, item) => sum + item.totalOrders, 0);
    const totalSales = reportData.reduce((sum, item) => sum + item.totalSales, 0);
    const totalTax = reportData.reduce((sum, item) => sum + item.totalTax, 0);
    const totalDiscount = reportData.reduce((sum, item) => sum + item.totalDiscount, 0);
    const netSales = reportData.reduce((sum, item) => sum + item.netSales, 0);
    
    // 計算平均值
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    return {
      '總訂單數': totalOrders,
      '總銷售額': totalSales.toFixed(2),
      '總稅額': totalTax.toFixed(2),
      '總折扣': totalDiscount.toFixed(2),
      '淨銷售額': netSales.toFixed(2),
      '平均訂單金額': averageOrderValue.toFixed(2)
    };
  }
  
  /**
   * 獲取支付方式名稱
   */
  private getPaymentMethodName(method: string): string {
    const methodNames: Record<string, string> = {
      'cash': '現金',
      'credit_card': '信用卡',
      'line_pay': 'LINE Pay',
      'uber_eats': 'Uber Eats',
      'foodpanda': 'Foodpanda',
      'unknown': '未知'
    };
    
    return methodNames[method] || method;
  }
  
  /**
   * 獲取訂單來源名稱
   */
  private getOrderSourceName(source: string): string {
    const sourceNames: Record<string, string> = {
      'pos': '店內POS',
      'online': '線上訂單',
      'uber_eats': 'Uber Eats',
      'foodpanda': 'Foodpanda',
      'unknown': '未知'
    };
    
    return sourceNames[source] || source;
  }
}
