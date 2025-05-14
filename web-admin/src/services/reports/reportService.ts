/**
 * 報表服務基礎類
 * 提供通用的報表功能
 */

import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  Timestamp, 
  DocumentData, 
  QuerySnapshot 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { AutoTableSettings } from 'jspdf-autotable';

// 報表時間範圍
export enum ReportTimeRange {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  THIS_WEEK = 'this_week',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_QUARTER = 'this_quarter',
  LAST_QUARTER = 'last_quarter',
  THIS_YEAR = 'this_year',
  LAST_YEAR = 'last_year',
  CUSTOM = 'custom'
}

// 報表格式
export enum ReportFormat {
  EXCEL = 'excel',
  PDF = 'pdf',
  CSV = 'csv'
}

// 報表參數
export interface ReportParams {
  timeRange: ReportTimeRange;
  startDate?: Date;
  endDate?: Date;
  tenantId?: string;
  storeId?: string;
  limit?: number;
  filters?: Record<string, any>;
}

// 報表結果
export interface ReportResult<T = any> {
  data: T[];
  summary: Record<string, any>;
  metadata: {
    title: string;
    description: string;
    generatedAt: Date;
    params: ReportParams;
    totalCount: number;
  };
}

/**
 * 報表服務基礎類
 */
export abstract class ReportService<T = any> {
  protected firestore = getFirestore();
  
  /**
   * 生成報表
   */
  abstract generateReport(params: ReportParams): Promise<ReportResult<T>>;
  
  /**
   * 獲取報表標題
   */
  abstract getReportTitle(): string;
  
  /**
   * 獲取報表描述
   */
  abstract getReportDescription(): string;
  
  /**
   * 獲取報表列定義
   */
  abstract getReportColumns(): { field: string; header: string; width?: number }[];
  
  /**
   * 導出報表
   */
  async exportReport(result: ReportResult<T>, format: ReportFormat, filename?: string): Promise<void> {
    const reportTitle = this.getReportTitle();
    const defaultFilename = `${reportTitle.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}`;
    const outputFilename = filename || defaultFilename;
    
    switch (format) {
      case ReportFormat.EXCEL:
        await this.exportToExcel(result, outputFilename);
        break;
      case ReportFormat.PDF:
        await this.exportToPdf(result, outputFilename);
        break;
      case ReportFormat.CSV:
        await this.exportToCsv(result, outputFilename);
        break;
      default:
        throw new Error(`不支持的報表格式: ${format}`);
    }
  }
  
  /**
   * 導出為Excel
   */
  private async exportToExcel(result: ReportResult<T>, filename: string): Promise<void> {
    try {
      // 創建工作簿
      const wb = XLSX.utils.book_new();
      
      // 創建數據工作表
      const dataWs = XLSX.utils.json_to_sheet(result.data);
      XLSX.utils.book_append_sheet(wb, dataWs, '數據');
      
      // 創建摘要工作表
      const summaryData = Object.entries(result.summary).map(([key, value]) => ({
        指標: key,
        值: value
      }));
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, '摘要');
      
      // 創建元數據工作表
      const metadataData = [
        { 項目: '報表標題', 值: result.metadata.title },
        { 項目: '報表描述', 值: result.metadata.description },
        { 項目: '生成時間', 值: result.metadata.generatedAt.toLocaleString() },
        { 項目: '時間範圍', 值: this.getTimeRangeText(result.metadata.params.timeRange) },
        { 項目: '開始日期', 值: result.metadata.params.startDate?.toLocaleDateString() || '' },
        { 項目: '結束日期', 值: result.metadata.params.endDate?.toLocaleDateString() || '' },
        { 項目: '租戶ID', 值: result.metadata.params.tenantId || '' },
        { 項目: '店鋪ID', 值: result.metadata.params.storeId || '' },
        { 項目: '記錄總數', 值: result.metadata.totalCount }
      ];
      const metadataWs = XLSX.utils.json_to_sheet(metadataData);
      XLSX.utils.book_append_sheet(wb, metadataWs, '元數據');
      
      // 導出工作簿
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `${filename}.xlsx`);
    } catch (error) {
      console.error('導出Excel失敗:', error);
      throw error;
    }
  }
  
  /**
   * 導出為PDF
   */
  private async exportToPdf(result: ReportResult<T>, filename: string): Promise<void> {
    try {
      // 創建PDF文檔
      const doc = new jsPDF();
      
      // 添加標題
      doc.setFontSize(18);
      doc.text(result.metadata.title, 14, 22);
      
      // 添加描述
      doc.setFontSize(12);
      doc.text(result.metadata.description, 14, 30);
      
      // 添加元數據
      doc.setFontSize(10);
      doc.text(`生成時間: ${result.metadata.generatedAt.toLocaleString()}`, 14, 38);
      doc.text(`時間範圍: ${this.getTimeRangeText(result.metadata.params.timeRange)}`, 14, 44);
      if (result.metadata.params.startDate && result.metadata.params.endDate) {
        doc.text(`日期區間: ${result.metadata.params.startDate.toLocaleDateString()} - ${result.metadata.params.endDate.toLocaleDateString()}`, 14, 50);
      }
      
      // 添加摘要
      doc.setFontSize(14);
      doc.text('報表摘要', 14, 60);
      
      const summaryData = Object.entries(result.summary).map(([key, value]) => [key, value]);
      (doc as any).autoTable({
        startY: 65,
        head: [['指標', '值']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] }
      });
      
      // 添加數據表格
      const columns = this.getReportColumns();
      const headers = columns.map(col => col.header);
      const dataRows = result.data.map(item => 
        columns.map(col => this.getNestedValue(item, col.field))
      );
      
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [headers],
        body: dataRows,
        theme: 'grid',
        headStyles: { fillColor: [66, 139, 202] }
      });
      
      // 添加頁腳
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`第 ${i} 頁，共 ${pageCount} 頁`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      }
      
      // 保存PDF
      doc.save(`${filename}.pdf`);
    } catch (error) {
      console.error('導出PDF失敗:', error);
      throw error;
    }
  }
  
  /**
   * 導出為CSV
   */
  private async exportToCsv(result: ReportResult<T>, filename: string): Promise<void> {
    try {
      // 獲取列定義
      const columns = this.getReportColumns();
      
      // 創建CSV標題行
      const headers = columns.map(col => col.header);
      
      // 創建CSV數據行
      const dataRows = result.data.map(item => 
        columns.map(col => this.getNestedValue(item, col.field))
      );
      
      // 合併標題和數據
      const csvContent = [
        headers.join(','),
        ...dataRows.map(row => row.join(','))
      ].join('\n');
      
      // 創建Blob並下載
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `${filename}.csv`);
    } catch (error) {
      console.error('導出CSV失敗:', error);
      throw error;
    }
  }
  
  /**
   * 獲取嵌套屬性值
   */
  protected getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => 
      prev && prev[curr] !== undefined ? prev[curr] : '', obj
    );
  }
  
  /**
   * 獲取時間範圍的開始和結束日期
   */
  protected getTimeRangeDates(timeRange: ReportTimeRange, customStartDate?: Date, customEndDate?: Date): { startDate: Date; endDate: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeRange) {
      case ReportTimeRange.TODAY:
        return {
          startDate: today,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case ReportTimeRange.YESTERDAY:
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          startDate: yesterday,
          endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      case ReportTimeRange.THIS_WEEK:
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const thisWeekEnd = new Date(thisWeekStart);
        thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
        thisWeekEnd.setHours(23, 59, 59, 999);
        return {
          startDate: thisWeekStart,
          endDate: thisWeekEnd
        };
      case ReportTimeRange.LAST_WEEK:
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59, 999);
        return {
          startDate: lastWeekStart,
          endDate: lastWeekEnd
        };
      case ReportTimeRange.THIS_MONTH:
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return {
          startDate: thisMonthStart,
          endDate: thisMonthEnd
        };
      case ReportTimeRange.LAST_MONTH:
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return {
          startDate: lastMonthStart,
          endDate: lastMonthEnd
        };
      case ReportTimeRange.THIS_QUARTER:
        const quarter = Math.floor(now.getMonth() / 3);
        const thisQuarterStart = new Date(now.getFullYear(), quarter * 3, 1);
        const thisQuarterEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
        return {
          startDate: thisQuarterStart,
          endDate: thisQuarterEnd
        };
      case ReportTimeRange.LAST_QUARTER:
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        const lastQuarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const lastQuarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3;
        const lastQuarterStart = new Date(lastQuarterYear, lastQuarterMonth, 1);
        const lastQuarterEnd = new Date(lastQuarterYear, lastQuarterMonth + 3, 0, 23, 59, 59, 999);
        return {
          startDate: lastQuarterStart,
          endDate: lastQuarterEnd
        };
      case ReportTimeRange.THIS_YEAR:
        const thisYearStart = new Date(now.getFullYear(), 0, 1);
        const thisYearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return {
          startDate: thisYearStart,
          endDate: thisYearEnd
        };
      case ReportTimeRange.LAST_YEAR:
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        return {
          startDate: lastYearStart,
          endDate: lastYearEnd
        };
      case ReportTimeRange.CUSTOM:
        if (!customStartDate || !customEndDate) {
          throw new Error('自定義時間範圍需要提供開始和結束日期');
        }
        const endDateWithTime = new Date(customEndDate);
        endDateWithTime.setHours(23, 59, 59, 999);
        return {
          startDate: customStartDate,
          endDate: endDateWithTime
        };
      default:
        throw new Error(`不支持的時間範圍: ${timeRange}`);
    }
  }
  
  /**
   * 獲取時間範圍的文字描述
   */
  protected getTimeRangeText(timeRange: ReportTimeRange): string {
    switch (timeRange) {
      case ReportTimeRange.TODAY:
        return '今天';
      case ReportTimeRange.YESTERDAY:
        return '昨天';
      case ReportTimeRange.THIS_WEEK:
        return '本週';
      case ReportTimeRange.LAST_WEEK:
        return '上週';
      case ReportTimeRange.THIS_MONTH:
        return '本月';
      case ReportTimeRange.LAST_MONTH:
        return '上月';
      case ReportTimeRange.THIS_QUARTER:
        return '本季度';
      case ReportTimeRange.LAST_QUARTER:
        return '上季度';
      case ReportTimeRange.THIS_YEAR:
        return '本年';
      case ReportTimeRange.LAST_YEAR:
        return '去年';
      case ReportTimeRange.CUSTOM:
        return '自定義';
      default:
        return timeRange;
    }
  }
  
  /**
   * 獲取當前用戶的租戶ID
   */
  protected async getCurrentUserTenantId(): Promise<string | null> {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return null;
      }
      
      const idTokenResult = await user.getIdTokenResult();
      return idTokenResult.claims.tenantId as string || null;
    } catch (error) {
      console.error('獲取當前用戶租戶ID失敗:', error);
      return null;
    }
  }
  
  /**
   * 獲取當前用戶的店鋪ID
   */
  protected async getCurrentUserStoreId(): Promise<string | null> {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return null;
      }
      
      const idTokenResult = await user.getIdTokenResult();
      return idTokenResult.claims.storeId as string || null;
    } catch (error) {
      console.error('獲取當前用戶店鋪ID失敗:', error);
      return null;
    }
  }
  
  /**
   * 獲取當前用戶的角色
   */
  protected async getCurrentUserRole(): Promise<string | null> {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        return null;
      }
      
      const idTokenResult = await user.getIdTokenResult();
      return idTokenResult.claims.role as string || null;
    } catch (error) {
      console.error('獲取當前用戶角色失敗:', error);
      return null;
    }
  }
}
