/**
 * 雲端出單 (Cloud Printing) 模組 - 處理函數
 */
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { 
  PrintJob, 
  PrintJobInput, 
  PrinterType, 
  PrintJobStatus,
  PrintContent
} from './types';

// Firestore 參考
const db = admin.firestore();
const printJobsCollection = db.collection('printJobs');

/**
 * 創建新的列印任務
 * 
 * @param jobData 列印任務輸入數據
 * @returns 創建的列印任務
 */
export const createPrintJob = async (jobData: PrintJobInput): Promise<PrintJob> => {
  try {
    // 檢查必要欄位
    if (!jobData.tenantId || !jobData.storeId || !jobData.content) {
      throw new Error('缺少必要的列印任務資訊');
    }

    // 生成任務ID
    const jobId = uuidv4();
    const now = admin.firestore.Timestamp.now();
    
    // 初始化列印任務
    const printJob: PrintJob = {
      jobId,
      tenantId: jobData.tenantId,
      storeId: jobData.storeId,
      printerType: jobData.printerType,
      printerId: jobData.printerId,
      content: jobData.content,
      status: PrintJobStatus.PENDING,
      retryCount: 0,
      maxRetries: jobData.maxRetries || 3,
      createdAt: now,
      updatedAt: now,
      createdBy: jobData.createdBy,
      source: jobData.source,
      relatedOrderId: jobData.relatedOrderId,
      relatedEntityId: jobData.relatedEntityId, 
      relatedEntityType: jobData.relatedEntityType
    };

    // 如需要，生成原始印表機指令
    if (jobData.content) {
      printJob.rawCommands = formatPrintContent(jobData.content, jobData.printerType);
      // 注意：目前僅生成佔位符指令，需要後續完善
    }

    // 寫入 Firestore
    await printJobsCollection.doc(jobId).set(printJob);
    
    console.log(`已創建列印任務: ${jobId}, 商店: ${jobData.storeId}, 類型: ${jobData.printerType}`);
    
    return printJob;
  } catch (error) {
    console.error('創建列印任務時發生錯誤:', error);
    throw error;
  }
};

/**
 * 根據列印任務的狀態獲取任務列表
 * 
 * @param storeId 商店ID
 * @param status 任務狀態 (可選)
 * @param limit 最大返回數量 (預設30)
 * @returns 列印任務列表
 */
export const getPrintJobs = async (
  storeId: string, 
  status?: PrintJobStatus,
  limit: number = 30
): Promise<PrintJob[]> => {
  try {
    let query: any = printJobsCollection.where('storeId', '==', storeId);
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    // 按創建時間排序並限制返回數量
    const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => doc.data() as PrintJob);
  } catch (error) {
    console.error('獲取列印任務列表時發生錯誤:', error);
    throw error;
  }
};

/**
 * 更新列印任務狀態
 * 
 * @param jobId 任務ID
 * @param status 新狀態
 * @param statusMessage 狀態訊息 (可選)
 * @returns 更新後的列印任務
 */
export const updatePrintJobStatus = async (
  jobId: string, 
  status: PrintJobStatus, 
  statusMessage?: string
): Promise<PrintJob> => {
  try {
    const jobRef = printJobsCollection.doc(jobId);
    const jobDoc = await jobRef.get();
    
    if (!jobDoc.exists) {
      throw new Error(`列印任務 ${jobId} 不存在`);
    }
    
    const updateData: any = {
      status,
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    if (statusMessage) {
      updateData.statusMessage = statusMessage;
    }
    
    // 如果任務完成或失敗，記錄完成時間
    if (status === PrintJobStatus.COMPLETED || status === PrintJobStatus.FAILED) {
      updateData.completedAt = admin.firestore.Timestamp.now();
    }
    
    // 更新任務
    await jobRef.update(updateData);
    
    // 獲取更新後的任務數據
    const updatedJobDoc = await jobRef.get();
    return updatedJobDoc.data() as PrintJob;
  } catch (error) {
    console.error(`更新列印任務 ${jobId} 狀態時發生錯誤:`, error);
    throw error;
  }
};

/**
 * 將列印內容格式化為印表機指令
 * 
 * @param content 結構化列印內容
 * @param printerType 印表機類型
 * @returns 格式化後的印表機指令
 */
function formatPrintContent(content: PrintContent, printerType: PrinterType): string {
  // TODO: 實現完整的ESC/POS或其他印表機指令格式化
  // 目前僅生成簡單文本作為佔位符
  
  let result = '';
  
  // 初始化 (重置印表機)
  result += '\\x1B\\x40'; // ESC @ 重置印表機
  
  // 根據內容類型進行基本格式化
  switch (content.type) {
    case 'order':
      const orderData = content.data as any;
      result += `\n===== 廚房訂單 =====\n`;
      result += `訂單編號: ${orderData.orderNumber}\n`;
      result += `時間: ${orderData.orderTime}\n`;
      result += orderData.tableNumber ? `桌號: ${orderData.tableNumber}\n` : '';
      result += `\n--- 品項 ---\n`;
      
      if (orderData.items && Array.isArray(orderData.items)) {
        orderData.items.forEach((item: any) => {
          result += `${item.name} x ${item.quantity}\n`;
          if (item.options && item.options.length) {
            result += `  選項: ${item.options.join(', ')}\n`;
          }
          if (item.notes) {
            result += `  備註: ${item.notes}\n`;
          }
        });
      }
      
      if (orderData.notes) {
        result += `\n備註: ${orderData.notes}\n`;
      }
      
      if (orderData.preparationPriority && orderData.preparationPriority !== 'normal') {
        result += `\n優先級: ${orderData.preparationPriority === 'high' ? '高' : '緊急'}\n`;
      }
      break;
      
    case 'receipt':
      const receiptData = content.data as any;
      result += `\n===== 收據 =====\n`;
      result += `${receiptData.storeName}\n`;
      result += receiptData.storeAddress ? `${receiptData.storeAddress}\n` : '';
      result += receiptData.storePhone ? `電話: ${receiptData.storePhone}\n` : '';
      result += `\n訂單編號: ${receiptData.orderNumber}\n`;
      result += `時間: ${receiptData.orderTime}\n`;
      result += receiptData.tableNumber ? `桌號: ${receiptData.tableNumber}\n` : '';
      result += `\n--- 品項 ---\n`;
      
      if (receiptData.items && Array.isArray(receiptData.items)) {
        receiptData.items.forEach((item: any) => {
          result += `${item.name} x ${item.quantity} ... ${item.totalPrice} 元\n`;
        });
      }
      
      result += `\n小計: ${receiptData.subtotal} 元\n`;
      if (receiptData.tax) {
        result += `稅額: ${receiptData.tax} 元\n`;
      }
      if (receiptData.discount) {
        result += `折扣: ${receiptData.discount} 元\n`;
      }
      result += `總計: ${receiptData.total} 元\n`;
      result += `\n付款方式: ${receiptData.paymentMethod}\n`;
      result += `付款狀態: ${receiptData.paymentStatus}\n`;
      
      if (receiptData.footer) {
        result += `\n${receiptData.footer}\n`;
      }
      break;
      
    case 'label':
      const labelData = content.data as any;
      result += `\n===== 標籤 =====\n`;
      if (labelData.title) {
        result += `${labelData.title}\n`;
      }
      result += `${labelData.content}\n`;
      if (labelData.qrCode) {
        result += `QR碼: ${labelData.qrCode}\n`;
      }
      if (labelData.barcode) {
        result += `條碼: ${labelData.barcode}\n`;
      }
      break;
      
    case 'text':
      const textData = content.data as any;
      result += textData.content;
      break;
      
    default:
      result += `無法識別的內容類型: ${content.type}`;
  }
  
  // 切紙指令
  if (content.printOptions?.cutPaper !== false) {
    result += '\n\\x1D\\x56\\x41'; // GS V A 全切紙
  }
  
  return result;
}

/**
 * 取消列印任務
 * 
 * @param jobId 任務ID
 * @returns 是否成功取消
 */
export const cancelPrintJob = async (jobId: string): Promise<boolean> => {
  try {
    const jobRef = printJobsCollection.doc(jobId);
    const jobDoc = await jobRef.get();
    
    if (!jobDoc.exists) {
      throw new Error(`列印任務 ${jobId} 不存在`);
    }
    
    const jobData = jobDoc.data() as PrintJob;
    
    // 只有待處理的任務可以取消
    if (jobData.status !== PrintJobStatus.PENDING) {
      return false;
    }
    
    // 更新任務為取消狀態
    await jobRef.update({
      status: PrintJobStatus.FAILED,
      statusMessage: '任務已手動取消',
      updatedAt: admin.firestore.Timestamp.now(),
      completedAt: admin.firestore.Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error(`取消列印任務 ${jobId} 時發生錯誤:`, error);
    throw error;
  }
}; 