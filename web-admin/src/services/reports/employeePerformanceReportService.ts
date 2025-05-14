/**
 * 員工績效分析報表服務
 * 生成員工績效相關的報表
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

// 員工績效報表類型
export enum EmployeePerformanceReportType {
  ATTENDANCE = 'attendance',           // 出勤率
  SALES_PERFORMANCE = 'sales',         // 銷售業績
  CUSTOMER_RATING = 'customer_rating', // 顧客評價
  COMPREHENSIVE = 'comprehensive'      // 綜合績效
}

// 員工績效報表參數
export interface EmployeePerformanceReportParams extends ReportParams {
  reportType: EmployeePerformanceReportType;
  employeeId?: string;                 // 特定員工ID (可選)
  departmentId?: string;               // 部門ID (可選)
  includeInactive?: boolean;           // 是否包含非活躍員工
  sortBy?: string;                     // 排序欄位
  sortOrder?: 'asc' | 'desc';          // 排序順序
}

// 員工績效報表項目
export interface EmployeePerformanceReportItem {
  employeeId: string;
  employeeName: string;
  department?: string;
  position?: string;

  // 出勤相關
  scheduledHours?: number;
  actualHours?: number;
  attendanceRate?: number;
  lateCount?: number;
  absenceCount?: number;

  // 銷售相關
  orderCount?: number;
  totalSales?: number;
  averageOrderValue?: number;

  // 顧客評價相關
  averageRating?: number;
  ratingCount?: number;

  // 綜合績效
  performanceScore?: number;
  kpiAchievement?: number;

  // 其他
  period?: string;
  details?: any;
}

/**
 * 員工績效報表服務類
 */
export class EmployeePerformanceReportService extends ReportService<EmployeePerformanceReportItem> {
  /**
   * 生成員工績效報表
   */
  async generateReport(params: EmployeePerformanceReportParams): Promise<ReportResult<EmployeePerformanceReportItem>> {
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

      // 獲取員工資料
      const employees = await this.getEmployees(tenantId, storeId, params.employeeId, params.departmentId, params.includeInactive);

      if (employees.length === 0) {
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

      // 根據報表類型生成報表數據
      let reportData: EmployeePerformanceReportItem[] = [];

      switch (params.reportType) {
        case EmployeePerformanceReportType.ATTENDANCE:
          reportData = await this.generateAttendanceReport(employees, startDate, endDate);
          break;
        case EmployeePerformanceReportType.SALES_PERFORMANCE:
          reportData = await this.generateSalesPerformanceReport(employees, startDate, endDate);
          break;
        case EmployeePerformanceReportType.CUSTOMER_RATING:
          reportData = await this.generateCustomerRatingReport(employees, startDate, endDate);
          break;
        case EmployeePerformanceReportType.COMPREHENSIVE:
          reportData = await this.generateComprehensiveReport(employees, startDate, endDate);
          break;
        default:
          throw new Error(`不支持的報表類型: ${params.reportType}`);
      }

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
      console.error('生成員工績效報表失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取報表標題
   */
  getReportTitle(): string {
    return '員工績效分析報表';
  }

  /**
   * 獲取報表描述
   */
  getReportDescription(): string {
    return '顯示員工的出勤率、銷售業績、顧客評價等績效指標。';
  }

  /**
   * 獲取員工列表
   */
  private async getEmployees(
    tenantId: string,
    storeId?: string,
    employeeId?: string,
    departmentId?: string,
    includeInactive: boolean = false
  ): Promise<any[]> {
    const queryConstraints: QueryConstraint[] = [
      where('tenantId', '==', tenantId)
    ];

    if (storeId) {
      queryConstraints.push(where('assignedStores', 'array-contains', storeId));
    }

    if (employeeId) {
      queryConstraints.push(where('employeeId', '==', employeeId));
    }

    if (departmentId) {
      queryConstraints.push(where('departmentId', '==', departmentId));
    }

    if (!includeInactive) {
      queryConstraints.push(where('active', '==', true));
    }

    const employeesRef = collection(this.firestore, 'employees');
    const q = query(employeesRef, ...queryConstraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  /**
   * 生成出勤報表
   */
  private async generateAttendanceReport(
    employees: any[],
    startDate: Date,
    endDate: Date
  ): Promise<EmployeePerformanceReportItem[]> {
    const result: EmployeePerformanceReportItem[] = [];

    for (const employee of employees) {
      // 查詢員工出勤記錄
      const attendanceRef = collection(this.firestore, 'attendanceRecords');
      const q = query(
        attendanceRef,
        where('employeeId', '==', employee.id),
        where('clockInTime', '>=', Timestamp.fromDate(startDate)),
        where('clockInTime', '<=', Timestamp.fromDate(endDate))
      );

      const attendanceSnapshot = await getDocs(q);
      const attendanceRecords = attendanceSnapshot.docs.map(doc => doc.data());

      // 查詢員工排班記錄
      const shiftsRef = collection(this.firestore, 'shifts');
      const shiftsQuery = query(
        shiftsRef,
        where('assignedEmployees', 'array-contains', employee.id),
        where('startTime', '>=', Timestamp.fromDate(startDate)),
        where('startTime', '<=', Timestamp.fromDate(endDate))
      );

      const shiftsSnapshot = await getDocs(shiftsQuery);
      const shifts = shiftsSnapshot.docs.map(doc => doc.data());

      // 計算出勤率和相關指標
      const scheduledHours = this.calculateScheduledHours(shifts);
      const actualHours = this.calculateActualHours(attendanceRecords);
      const attendanceRate = scheduledHours > 0 ? (actualHours / scheduledHours) * 100 : 0;
      const lateCount = this.calculateLateCount(attendanceRecords, shifts);
      const absenceCount = this.calculateAbsenceCount(attendanceRecords, shifts);

      result.push({
        employeeId: employee.id,
        employeeName: employee.displayName || '未知員工',
        department: employee.department || '未分配',
        position: employee.role || '一般員工',
        scheduledHours,
        actualHours,
        attendanceRate,
        lateCount,
        absenceCount,
        period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      });
    }

    return result;
  }

  /**
   * 生成銷售業績報表
   */
  private async generateSalesPerformanceReport(
    employees: any[],
    startDate: Date,
    endDate: Date
  ): Promise<EmployeePerformanceReportItem[]> {
    const result: EmployeePerformanceReportItem[] = [];

    for (const employee of employees) {
      // 查詢員工處理的訂單
      const ordersRef = collection(this.firestore, 'orders');
      const q = query(
        ordersRef,
        where('createdBy', '==', employee.id),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate)),
        where('status', '!=', 'cancelled')
      );

      const ordersSnapshot = await getDocs(q);
      const orders = ordersSnapshot.docs.map(doc => doc.data());

      // 計算銷售指標
      const orderCount = orders.length;
      const totalSales = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
      const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

      result.push({
        employeeId: employee.id,
        employeeName: employee.displayName || '未知員工',
        department: employee.department || '未分配',
        position: employee.role || '一般員工',
        orderCount,
        totalSales,
        averageOrderValue,
        period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      });
    }

    return result;
  }

  /**
   * 生成顧客評價報表
   */
  private async generateCustomerRatingReport(
    employees: any[],
    startDate: Date,
    endDate: Date
  ): Promise<EmployeePerformanceReportItem[]> {
    const result: EmployeePerformanceReportItem[] = [];

    for (const employee of employees) {
      // 查詢員工相關的顧客評價
      const ratingsRef = collection(this.firestore, 'customerRatings');
      const q = query(
        ratingsRef,
        where('employeeId', '==', employee.id),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate))
      );

      const ratingsSnapshot = await getDocs(q);
      const ratings = ratingsSnapshot.docs.map(doc => doc.data());

      // 計算評價指標
      const ratingCount = ratings.length;
      const totalRating = ratings.reduce((sum, rating) => sum + (rating.rating || 0), 0);
      const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

      result.push({
        employeeId: employee.id,
        employeeName: employee.displayName || '未知員工',
        department: employee.department || '未分配',
        position: employee.role || '一般員工',
        averageRating,
        ratingCount,
        period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      });
    }

    return result;
  }

  /**
   * 生成綜合績效報表
   */
  private async generateComprehensiveReport(
    employees: any[],
    startDate: Date,
    endDate: Date
  ): Promise<EmployeePerformanceReportItem[]> {
    // 獲取各項指標報表
    const attendanceReport = await this.generateAttendanceReport(employees, startDate, endDate);
    const salesReport = await this.generateSalesPerformanceReport(employees, startDate, endDate);
    const ratingReport = await this.generateCustomerRatingReport(employees, startDate, endDate);

    // 合併報表數據
    const result: EmployeePerformanceReportItem[] = [];

    for (const employee of employees) {
      const attendanceData = attendanceReport.find(item => item.employeeId === employee.id) || {};
      const salesData = salesReport.find(item => item.employeeId === employee.id) || {};
      const ratingData = ratingReport.find(item => item.employeeId === employee.id) || {};

      // 計算綜合績效分數 (可根據業務需求調整權重)
      const attendanceWeight = 0.3;
      const salesWeight = 0.4;
      const ratingWeight = 0.3;

      const attendanceScore = (attendanceData.attendanceRate || 0) / 100;
      const salesScore = this.calculateSalesScore(salesData.totalSales || 0);
      const ratingScore = ((ratingData.averageRating || 0) / 5);

      const performanceScore =
        (attendanceScore * attendanceWeight) +
        (salesScore * salesWeight) +
        (ratingScore * ratingWeight);

      // 計算KPI達成率 (假設目標為80分)
      const kpiTarget = 0.8;
      const kpiAchievement = (performanceScore / kpiTarget) * 100;

      result.push({
        employeeId: employee.id,
        employeeName: employee.displayName || '未知員工',
        department: employee.department || '未分配',
        position: employee.role || '一般員工',

        // 出勤數據
        attendanceRate: attendanceData.attendanceRate,
        lateCount: attendanceData.lateCount,
        absenceCount: attendanceData.absenceCount,

        // 銷售數據
        orderCount: salesData.orderCount,
        totalSales: salesData.totalSales,
        averageOrderValue: salesData.averageOrderValue,

        // 評價數據
        averageRating: ratingData.averageRating,
        ratingCount: ratingData.ratingCount,

        // 綜合績效
        performanceScore: performanceScore * 100, // 轉換為百分制
        kpiAchievement,

        period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      });
    }

    return result;
  }

  /**
   * 計算摘要數據
   */
  private calculateSummary(
    reportData: EmployeePerformanceReportItem[],
    reportType: EmployeePerformanceReportType
  ): Record<string, any> {
    if (reportData.length === 0) {
      return {};
    }

    switch (reportType) {
      case EmployeePerformanceReportType.ATTENDANCE:
        return this.calculateAttendanceSummary(reportData);
      case EmployeePerformanceReportType.SALES_PERFORMANCE:
        return this.calculateSalesSummary(reportData);
      case EmployeePerformanceReportType.CUSTOMER_RATING:
        return this.calculateRatingSummary(reportData);
      case EmployeePerformanceReportType.COMPREHENSIVE:
        return this.calculateComprehensiveSummary(reportData);
      default:
        return {};
    }
  }

  /**
   * 計算出勤摘要
   */
  private calculateAttendanceSummary(reportData: EmployeePerformanceReportItem[]): Record<string, any> {
    const totalEmployees = reportData.length;
    const totalScheduledHours = reportData.reduce((sum, item) => sum + (item.scheduledHours || 0), 0);
    const totalActualHours = reportData.reduce((sum, item) => sum + (item.actualHours || 0), 0);
    const averageAttendanceRate = reportData.reduce((sum, item) => sum + (item.attendanceRate || 0), 0) / totalEmployees;
    const totalLateCount = reportData.reduce((sum, item) => sum + (item.lateCount || 0), 0);
    const totalAbsenceCount = reportData.reduce((sum, item) => sum + (item.absenceCount || 0), 0);

    return {
      '員工總數': totalEmployees,
      '總排班時數': totalScheduledHours.toFixed(2) + ' 小時',
      '總實際工作時數': totalActualHours.toFixed(2) + ' 小時',
      '平均出勤率': averageAttendanceRate.toFixed(2) + '%',
      '總遲到次數': totalLateCount,
      '總缺勤次數': totalAbsenceCount
    };
  }

  /**
   * 計算銷售摘要
   */
  private calculateSalesSummary(reportData: EmployeePerformanceReportItem[]): Record<string, any> {
    const totalEmployees = reportData.length;
    const totalOrders = reportData.reduce((sum, item) => sum + (item.orderCount || 0), 0);
    const totalSales = reportData.reduce((sum, item) => sum + (item.totalSales || 0), 0);
    const averageOrdersPerEmployee = totalOrders / totalEmployees;
    const averageSalesPerEmployee = totalSales / totalEmployees;

    return {
      '員工總數': totalEmployees,
      '總訂單數': totalOrders,
      '總銷售額': totalSales.toFixed(2) + ' 元',
      '平均每位員工訂單數': averageOrdersPerEmployee.toFixed(2),
      '平均每位員工銷售額': averageSalesPerEmployee.toFixed(2) + ' 元'
    };
  }

  /**
   * 計算評價摘要
   */
  private calculateRatingSummary(reportData: EmployeePerformanceReportItem[]): Record<string, any> {
    const totalEmployees = reportData.length;
    const totalRatings = reportData.reduce((sum, item) => sum + (item.ratingCount || 0), 0);
    const weightedRatingSum = reportData.reduce((sum, item) => sum + (item.averageRating || 0) * (item.ratingCount || 0), 0);
    const overallAverageRating = totalRatings > 0 ? weightedRatingSum / totalRatings : 0;

    return {
      '員工總數': totalEmployees,
      '總評價數': totalRatings,
      '整體平均評分': overallAverageRating.toFixed(2) + ' / 5'
    };
  }

  /**
   * 計算綜合績效摘要
   */
  private calculateComprehensiveSummary(reportData: EmployeePerformanceReportItem[]): Record<string, any> {
    const totalEmployees = reportData.length;
    const averagePerformanceScore = reportData.reduce((sum, item) => sum + (item.performanceScore || 0), 0) / totalEmployees;
    const averageKpiAchievement = reportData.reduce((sum, item) => sum + (item.kpiAchievement || 0), 0) / totalEmployees;

    // 計算達標員工數量
    const kpiTargetThreshold = 80; // 80分為達標
    const employeesAboveTarget = reportData.filter(item => (item.performanceScore || 0) >= kpiTargetThreshold).length;
    const percentageAboveTarget = (employeesAboveTarget / totalEmployees) * 100;

    return {
      '員工總數': totalEmployees,
      '平均績效分數': averagePerformanceScore.toFixed(2) + ' 分',
      '平均KPI達成率': averageKpiAchievement.toFixed(2) + '%',
      '達標員工數': employeesAboveTarget,
      '達標員工比例': percentageAboveTarget.toFixed(2) + '%'
    };
  }

  /**
   * 計算排班時數
   */
  private calculateScheduledHours(shifts: any[]): number {
    return shifts.reduce((total, shift) => {
      const startTime = shift.startTime?.toDate ? shift.startTime.toDate() : new Date(shift.startTime);
      const endTime = shift.endTime?.toDate ? shift.endTime.toDate() : new Date(shift.endTime);
      const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      return total + hours;
    }, 0);
  }

  /**
   * 計算實際工作時數
   */
  private calculateActualHours(attendanceRecords: any[]): number {
    return attendanceRecords.reduce((total, record) => {
      if (record.clockInTime && record.clockOutTime) {
        const clockInTime = record.clockInTime?.toDate ? record.clockInTime.toDate() : new Date(record.clockInTime);
        const clockOutTime = record.clockOutTime?.toDate ? record.clockOutTime.toDate() : new Date(record.clockOutTime);
        const hours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        return total + hours;
      }
      return total;
    }, 0);
  }

  /**
   * 計算遲到次數
   */
  private calculateLateCount(attendanceRecords: any[], shifts: any[]): number {
    let lateCount = 0;

    // 建立排班時間映射表
    const shiftMap = new Map();
    shifts.forEach(shift => {
      const startTime = shift.startTime?.toDate ? shift.startTime.toDate() : new Date(shift.startTime);
      const dateKey = startTime.toISOString().split('T')[0];
      shiftMap.set(dateKey, startTime);
    });

    // 檢查每條出勤記錄是否遲到
    attendanceRecords.forEach(record => {
      if (record.clockInTime) {
        const clockInTime = record.clockInTime?.toDate ? record.clockInTime.toDate() : new Date(record.clockInTime);
        const dateKey = clockInTime.toISOString().split('T')[0];

        // 如果當天有排班
        if (shiftMap.has(dateKey)) {
          const shiftStartTime = shiftMap.get(dateKey);
          // 如果打卡時間晚於排班開始時間15分鐘以上，視為遲到
          if (clockInTime.getTime() - shiftStartTime.getTime() > 15 * 60 * 1000) {
            lateCount++;
          }
        }
      }
    });

    return lateCount;
  }

  /**
   * 計算缺勤次數
   */
  private calculateAbsenceCount(attendanceRecords: any[], shifts: any[]): number {
    // 建立出勤日期集合
    const attendanceDates = new Set();
    attendanceRecords.forEach(record => {
      if (record.clockInTime) {
        const clockInTime = record.clockInTime?.toDate ? record.clockInTime.toDate() : new Date(record.clockInTime);
        const dateKey = clockInTime.toISOString().split('T')[0];
        attendanceDates.add(dateKey);
      }
    });

    // 計算排班但未出勤的天數
    let absenceCount = 0;
    shifts.forEach(shift => {
      const startTime = shift.startTime?.toDate ? shift.startTime.toDate() : new Date(shift.startTime);
      const dateKey = startTime.toISOString().split('T')[0];

      if (!attendanceDates.has(dateKey)) {
        absenceCount++;
      }
    });

    return absenceCount;
  }

  /**
   * 計算銷售分數 (0-1之間)
   * 根據銷售額計算分數，可根據業務需求調整計算方式
   */
  private calculateSalesScore(totalSales: number): number {
    // 假設銷售目標為10000元
    const salesTarget = 10000;
    // 計算達成率，最高為1
    return Math.min(totalSales / salesTarget, 1);
  }
}
