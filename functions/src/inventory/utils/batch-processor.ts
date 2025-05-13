/**
 * 庫存管理模組的批量處理工具
 * 
 * 提供高效的批量數據處理功能
 */
import { TransactionTooLargeError } from './errors';
import { quotaLimiter, QuotaType } from './quota-limiter';

/**
 * Firestore批次處理的建議上限
 */
const MAX_BATCH_SIZE = 20;

/**
 * 批量處理選項
 */
export interface BatchProcessOptions {
  /** 每個批次的最大項目數 */
  batchSize?: number;
  /** 並發批次的最大數量 */
  maxConcurrent?: number;
  /** 批次之間的延遲毫秒數 */
  delayBetweenBatches?: number;
  /** 租戶ID，用於配額檢查 */
  tenantId?: string;
  /** 是否啟用進度回調 */
  enableProgressCallback?: boolean;
  /** 在錯誤時是否中止整個處理 */
  abortOnError?: boolean;
  /** 是否檢查配額限制 */
  checkQuota?: boolean;
}

/**
 * 批量處理進度回調
 */
export interface BatchProcessProgress {
  /** 已處理項目數 */
  processed: number;
  /** 總項目數 */
  total: number;
  /** 成功項目數 */
  succeeded: number;
  /** 失敗項目數 */
  failed: number;
  /** 完成百分比 */
  percentage: number;
  /** 已處理批次數 */
  batchesProcessed: number;
  /** 總批次數 */
  totalBatches: number;
}

/**
 * 批量處理進度回調函數類型
 */
export type ProgressCallback = (progress: BatchProcessProgress) => void;

/**
 * 批量處理結果
 */
export interface BatchProcessResult<T = any, R = any> {
  /** 所有批次的結果 */
  results: R[];
  /** 成功項目數 */
  successCount: number;
  /** 失敗項目數 */
  failureCount: number;
  /** 處理的項目 */
  processedItems: T[];
  /** 跳過的項目 */
  skippedItems: T[];
  /** 錯誤信息 */
  errors: Error[];
}

/**
 * 批量處理的方法簽名
 */
export type BatchProcessor<T, R> = (items: T[]) => Promise<R>;

/**
 * 批量處理方法
 * @param items 要處理的項目數組
 * @param processBatch 處理單個批次的方法
 * @param batchSize 每個批次的大小
 * @param options 附加選項
 * @param progressCallback 進度回調函數
 * @returns 批量處理結果
 */
export async function processBatches<T, R>(
  items: T[],
  processBatch: BatchProcessor<T, R>,
  batchSize: number = 20,
  options: BatchProcessOptions = {},
  progressCallback?: ProgressCallback
): Promise<BatchProcessResult<T, R>> {
  const {
    maxConcurrent = 5,
    delayBetweenBatches = 0,
    tenantId,
    enableProgressCallback = false,
    abortOnError = false,
    checkQuota = true
  } = options;
  
  // 檢查批次大小是否超出配額限制
  if (checkQuota && tenantId) {
    quotaLimiter.enforceBatchSize(batchSize, tenantId);
  }
  
  // 如果沒有項目，立即返回空結果
  if (!items.length) {
    return {
      results: [],
      successCount: 0,
      failureCount: 0,
      processedItems: [],
      skippedItems: [],
      errors: []
    };
  }
  
  // 分割項目為多個批次
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  // 追蹤進度的變量
  let processedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;
  let batchesProcessed = 0;
  
  const results: R[] = [];
  const processedItems: T[] = [];
  const skippedItems: T[] = [];
  const errors: Error[] = [];
  
  // 每完成一個批次後更新進度
  const updateProgress = (batchSuccess: number, batchFailure: number, batchItems: T[]) => {
    processedCount += batchItems.length;
    succeededCount += batchSuccess;
    failedCount += batchFailure;
    batchesProcessed++;
    
    processedItems.push(...batchItems);
    
    // 如果啟用了進度回調，通知調用者
    if (enableProgressCallback && progressCallback) {
      progressCallback({
        processed: processedCount,
        total: items.length,
        succeeded: succeededCount,
        failed: failedCount,
        percentage: Math.round((processedCount / items.length) * 100),
        batchesProcessed,
        totalBatches: batches.length
      });
    }
  };
  
  // 處理單個批次的函數
  const processSingleBatch = async (batch: T[], batchIndex: number): Promise<void> => {
    try {
      // 執行批次處理
      const result = await processBatch(batch);
      
      // 獲取批次處理結果的成功和失敗計數
      let batchSuccess = 0;
      let batchFailure = 0;
      
      if (result && typeof result === 'object') {
        if ('successCount' in result && typeof result.successCount === 'number') {
          batchSuccess = result.successCount;
        }
        
        if ('failureCount' in result && typeof result.failureCount === 'number') {
          batchFailure = result.failureCount;
        }
        
        // 如果沒有明確的成功/失敗計數，假設全部成功
        if (batchSuccess === 0 && batchFailure === 0) {
          batchSuccess = batch.length;
        }
      } else {
        // 如果沒有返回對象，假設全部成功
        batchSuccess = batch.length;
      }
      
      // 添加結果
      results.push(result);
      
      // 更新進度
      updateProgress(batchSuccess, batchFailure, batch);
    } catch (error: any) {
      // 記錄錯誤
      errors.push(error);
      
      if (error instanceof TransactionTooLargeError) {
        // 如果是事務太大錯誤，嘗試將批次分成更小的批次重試
        if (batch.length > 1) {
          const halfSize = Math.ceil(batch.length / 2);
          const firstHalf = batch.slice(0, halfSize);
          const secondHalf = batch.slice(halfSize);
          
          // 遞歸處理較小的批次
          await processSingleBatch(firstHalf, batchIndex);
          await processSingleBatch(secondHalf, batchIndex);
        } else {
          // 已經是最小批次，無法進一步分割，標記為失敗
          skippedItems.push(...batch);
          updateProgress(0, batch.length, batch);
        }
      } else {
        // 其他錯誤，標記整個批次為失敗
        if (abortOnError) {
          throw error; // 如果設置了錯誤中止，重新拋出錯誤
        }
        
        skippedItems.push(...batch);
        updateProgress(0, batch.length, batch);
      }
    }
  };
  
  // 根據maxConcurrent限制並發處理批次
  if (maxConcurrent <= 1) {
    // 串行處理
    for (let i = 0; i < batches.length; i++) {
      await processSingleBatch(batches[i], i);
      
      // 批次之間的延遲
      if (delayBetweenBatches > 0 && i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
  } else {
    // 並行處理，但控制並發數
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const concurrentBatches = batches.slice(i, i + maxConcurrent);
      
      await Promise.all(
        concurrentBatches.map((batch, index) => processSingleBatch(batch, i + index))
      );
      
      // 批次組之間的延遲
      if (delayBetweenBatches > 0 && i + maxConcurrent < batches.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
  }
  
  return {
    results,
    successCount: succeededCount,
    failureCount: failedCount,
    processedItems,
    skippedItems,
    errors
  };
}

/**
 * 批量獲取文檔，自動處理Firestore的in查詢限制(最多10個)
 */
export async function batchFetch<T, K extends keyof T>(
  fetchFunction: (ids: string[]) => Promise<T[]>,
  items: string[],
  idField: K,
  batchSize: number = 10
): Promise<T[]> {
  if (!items.length) return [];
  
  const results: T[] = [];
  
  // 每次最多查詢指定數量的ID
  for (let i = 0; i < items.length; i += batchSize) {
    const batchIds = items.slice(i, i + batchSize);
    const batchResults = await fetchFunction(batchIds);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * 批量導入/導出選項
 */
export interface BatchImportExportOptions {
  /** 檔案格式 */
  format?: 'json' | 'csv' | 'excel';
  /** CSV/Excel列定義 */
  columns?: Array<{
    /** 列頭名稱 */
    header: string;
    /** 資料欄位名稱 */
    field: string;
    /** 資料類型 */
    type?: 'string' | 'number' | 'boolean' | 'date';
    /** 是否必填 */
    required?: boolean;
    /** 預設值 */
    default?: any;
  }>;
  /** 是否包含表頭 */
  includeHeaders?: boolean;
  /** 日期格式 */
  dateFormat?: string;
  /** 分隔符 (CSV) */
  delimiter?: string;
  /** 租戶ID */
  tenantId?: string;
  /** 處理進度回調 */
  progressCallback?: ProgressCallback;
}

/**
 * 將資料匯出為指定格式
 * @param data 要匯出的資料
 * @param options 匯出選項
 * @returns 匯出的資料字串或Buffer
 */
export function exportData(
  data: any[],
  options: BatchImportExportOptions = {}
): string | Buffer {
  const {
    format = 'json',
    columns,
    includeHeaders = true,
    dateFormat = 'YYYY-MM-DD HH:mm:ss',
    delimiter = ','
  } = options;
  
  // 處理JSON格式
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  
  // 處理CSV格式
  if (format === 'csv') {
    // 確保有列定義
    if (!columns || columns.length === 0) {
      throw new Error('匯出CSV格式需要提供columns定義');
    }
    
    // 創建表頭
    let csv = '';
    if (includeHeaders) {
      csv = columns.map(col => `"${col.header}"`).join(delimiter) + '\n';
    }
    
    // 添加每一行資料
    for (const item of data) {
      const row = columns.map(col => {
        let value = item[col.field];
        
        // 格式化日期
        if (col.type === 'date' && value) {
          const date = new Date(value);
          value = formatDate(date, dateFormat);
        }
        
        // 處理空值和引號
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'string') {
          // 轉義引號
          return `"${value.replace(/"/g, '""')}"`;
        } else {
          return String(value);
        }
      }).join(delimiter);
      
      csv += row + '\n';
    }
    
    return csv;
  }
  
  // 處理Excel格式 (預設返回CSV，實際實現可能需要使用外部庫)
  if (format === 'excel') {
    // 在實際實現中，這裡會使用如 xlsx 等庫來處理 Excel 格式
    // 目前簡化為返回 CSV 格式
    return exportData(data, { ...options, format: 'csv' });
  }
  
  throw new Error(`不支持的匯出格式: ${format}`);
}

/**
 * 從指定格式匯入資料
 * @param content 要匯入的內容
 * @param options 匯入選項
 * @returns 解析後的資料陣列
 */
export function importData(
  content: string | Buffer,
  options: BatchImportExportOptions = {}
): any[] {
  const {
    format = 'json',
    columns,
    includeHeaders = true,
    dateFormat = 'YYYY-MM-DD HH:mm:ss',
    delimiter = ','
  } = options;
  
  // 將Buffer轉為字串
  const contentStr = Buffer.isBuffer(content) ? content.toString('utf8') : content;
  
  // 處理JSON格式
  if (format === 'json') {
    try {
      return JSON.parse(contentStr);
    } catch (error) {
      throw new Error('無效的JSON格式');
    }
  }
  
  // 處理CSV格式
  if (format === 'csv') {
    // 確保有列定義
    if (!columns || columns.length === 0) {
      throw new Error('匯入CSV格式需要提供columns定義');
    }
    
    // 分割行和處理空行
    const lines = contentStr
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (lines.length === 0) {
      return [];
    }
    
    // 跳過表頭行
    const startIndex = includeHeaders ? 1 : 0;
    if (includeHeaders && lines.length < 2) {
      return [];
    }
    
    const result = [];
    
    // 處理每一行資料
    for (let i = startIndex; i < lines.length; i++) {
      // 解析CSV行，處理引號和逗號
      const values = parseCSVLine(lines[i], delimiter);
      
      // 檢查列數是否匹配
      if (values.length !== columns.length) {
        throw new Error(`第 ${i + 1} 行的列數 (${values.length}) 與定義的列數 (${columns.length}) 不匹配`);
      }
      
      // 創建資料對象
      const item: any = {};
      
      for (let j = 0; j < columns.length; j++) {
        const col = columns[j];
        let value = values[j];
        
        // 處理空值和預設值
        if (value === '') {
          if (col.required) {
            throw new Error(`第 ${i + 1} 行中必填欄位 "${col.header}" 的值為空`);
          }
          value = col.default !== undefined ? col.default : null;
        } else {
          // 轉換數據類型
          switch (col.type) {
            case 'number':
              const num = Number(value);
              if (isNaN(num)) {
                throw new Error(`第 ${i + 1} 行中欄位 "${col.header}" 的值 "${value}" 不是有效的數字`);
              }
              value = num;
              break;
              
            case 'boolean':
              value = value.toLowerCase() === 'true' || value === '1';
              break;
              
            case 'date':
              try {
                value = parseDate(value, dateFormat);
              } catch (error) {
                throw new Error(`第 ${i + 1} 行中欄位 "${col.header}" 的值 "${value}" 不是有效的日期格式`);
              }
              break;
          }
        }
        
        item[col.field] = value;
      }
      
      result.push(item);
    }
    
    return result;
  }
  
  // 處理Excel格式 (需要外部庫處理)
  if (format === 'excel') {
    throw new Error('Excel格式暫未實現，請使用CSV或JSON格式');
  }
  
  throw new Error(`不支持的匯入格式: ${format}`);
}

// 輔助函數

/**
 * 解析CSV行，處理引號和分隔符
 * @private
 */
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // 檢查是否為轉義的引號
      if (i < line.length - 1 && line[i + 1] === '"') {
        current += '"';
        i++; // 跳過下一個引號
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // 遇到分隔符且不在引號內
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // 添加最後一列
  result.push(current);
  
  return result;
}

/**
 * 格式化日期為指定格式
 * @private
 */
function formatDate(date: Date, format: string): string {
  // 簡單的日期格式化，實際實現可能需要使用日期庫
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 解析日期字串
 * @private
 */
function parseDate(dateStr: string, format: string): Date {
  // 簡單的日期解析，實際實現可能需要使用日期庫
  if (/^\d{4}-\d{2}-\d{2}(T|\s)?\d{2}:\d{2}:\d{2}/.test(dateStr)) {
    return new Date(dateStr);
  }
  
  throw new Error(`無法解析日期: ${dateStr} (使用格式: ${format})`);
} 