import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { PayoutRequest, PayoutRecord, PayoutStatus, PayoutMethod } from './types';

// 使用函數而非直接獲取Firestore集合，避免在模組加載時調用未初始化的Firebase
function getDb() {
  return admin.firestore();
}

function getPayoutsCollection() {
  return getDb().collection('payouts');
}

/**
 * 處理批次支付
 * @param requests 支付請求陣列
 * @returns 處理結果，包含批次ID和建立的支付記錄
 */
export async function processBatchPayout(
  requests: PayoutRequest[]
): Promise<{ batchId: string; records: PayoutRecord[] }> {
  if (!requests || requests.length === 0) {
    throw new Error('支付請求不能為空');
  }

  // 生成批次ID
  const batchId = uuidv4();
  const timestamp = new Date();
  
  // 批次寫入操作
  const batch = getDb().batch();
  const records: PayoutRecord[] = [];

  // 為每個請求建立支付記錄
  for (const request of requests) {
    const id = uuidv4();
    
    // 建立支付記錄對象
    const record: PayoutRecord = {
      id,
      amount: request.amount,
      description: request.description,
      method: request.method,
      targetIdentifier: request.targetIdentifier,
      status: PayoutStatus.PENDING,
      
      employeeId: request.employeeId,
      tenantId: request.tenantId,
      referenceId: request.referenceId,
      referenceType: request.referenceType,
      batchId,
      
      metadata: request.metadata || {},
      statusHistory: [
        {
          status: PayoutStatus.PENDING,
          timestamp,
          note: '初始化支付請求'
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // 添加到批次
    const docRef = getPayoutsCollection().doc(id);
    batch.set(docRef, record);
    records.push(record);
  }

  // 提交批次寫入
  await batch.commit();
  
  // 觸發批次處理
  await scheduleBatchPayoutProcessing(batchId);
  
  return { batchId, records };
}

/**
 * 安排批次支付處理
 * @param batchId 批次ID
 */
export async function scheduleBatchPayoutProcessing(batchId: string): Promise<void> {
  console.log(`安排處理批次支付 batchId: ${batchId}`);
  
  // 查詢待處理的支付記錄
  const pendingPayoutsSnapshot = await getPayoutsCollection()
    .where('batchId', '==', batchId)
    .where('status', '==', PayoutStatus.PENDING)
    .get();
  
  if (pendingPayoutsSnapshot.empty) {
    console.log(`批次 ${batchId} 沒有待處理的支付記錄`);
    return;
  }
  
  // 更新狀態為處理中 (初始標記)
  const batch = getDb().batch();
  const processingTime = new Date();
  
  for (const doc of pendingPayoutsSnapshot.docs) {
    const payoutRecord = doc.data() as PayoutRecord;
    
    // 建立更新物件
    const timestamp = new Date();
    const statusHistoryEntry = {
      status: PayoutStatus.PROCESSING,
      timestamp,
      note: '開始處理支付'
    };
    
    // 更新物件
    const updateData: Partial<PayoutRecord> = {
      status: PayoutStatus.PROCESSING,
      statusHistory: admin.firestore.FieldValue.arrayUnion(statusHistoryEntry) as any,
      updatedAt: timestamp,
      processingTime
    };
    
    // 添加到批次
    batch.update(doc.ref, updateData);
  }
  
  // 提交更新
  await batch.commit();
  
  // 重新獲取已更新為處理中的記錄
  const processingPayoutsSnapshot = await getPayoutsCollection()
    .where('batchId', '==', batchId)
    .where('status', '==', PayoutStatus.PROCESSING)
    .get();
  
  // 動態導入支付處理函數，避免循環依賴
  const { processLinePayPayout } = await import('./providers/linepay');
  
  // 循環處理每筆支付
  for (const doc of processingPayoutsSnapshot.docs) {
    const payout = doc.data() as PayoutRecord;
    
    try {
      console.log(`開始處理支付記錄: ${payout.id}`);
      
      // 根據支付方式選擇處理方法
      if (payout.method === PayoutMethod.LINE_PAY) {
        await processLinePayPayout(payout);
      } else if (payout.method === PayoutMethod.BANK_TRANSFER) {
        // 銀行轉賬處理（尚未實現）
        console.log(`銀行轉賬尚未實現，跳過處理: ${payout.id}`);
        
        // 更新狀態為待處理
        await updatePayoutStatus(
          payout.id,
          PayoutStatus.PENDING,
          '支付方式尚未實現處理邏輯',
          {}
        );
      } else {
        // 未知支付方式
        console.error(`不支持的支付方式: ${payout.method}，記錄ID: ${payout.id}`);
        
        // 更新狀態為失敗
        await updatePayoutStatus(
          payout.id,
          PayoutStatus.FAILED,
          `不支持的支付方式: ${payout.method}`,
          { failureReason: `不支持的支付方式: ${payout.method}` }
        );
      }
    } catch (error) {
      // 處理單筆支付的錯誤，確保不影響其他支付處理
      const errorMessage = error instanceof Error 
        ? error.message 
        : '未知錯誤';
      
      console.error(`處理支付記錄 ${payout.id} 時發生錯誤:`, errorMessage);
      
      // 更新狀態為失敗
      await updatePayoutStatus(
        payout.id,
        PayoutStatus.FAILED,
        `處理時發生錯誤: ${errorMessage}`,
        { failureReason: errorMessage }
      );
    }
  }
  
  console.log(`完成批次支付處理 batchId: ${batchId}`);
}

/**
 * 更新支付記錄狀態
 * @param payoutId 支付記錄ID
 * @param newStatus 新狀態
 * @param note 狀態說明
 * @param additionalFields 其他要更新的欄位
 */
export async function updatePayoutStatus(
  payoutId: string | PayoutRecord,
  newStatus: PayoutStatus,
  note?: string,
  additionalFields: Record<string, any> = {}
): Promise<void> {
  try {
    // 處理傳入的是記錄ID還是記錄物件
    const id = typeof payoutId === 'string' ? payoutId : payoutId.id;
    
    const timestamp = new Date();
    
    // 建立新的狀態歷史記錄
    const statusHistoryEntry = {
      status: newStatus,
      timestamp,
      note: note || ''
    };
    
    // 建立更新物件
    const updateData: Partial<PayoutRecord> = {
      status: newStatus,
      statusHistory: admin.firestore.FieldValue.arrayUnion(statusHistoryEntry) as any,
      updatedAt: timestamp,
      ...additionalFields
    };
    
    // 更新記錄
    await getPayoutsCollection().doc(id).update(updateData);
    
    console.log(`成功更新支付記錄 ${id} 狀態為 ${newStatus}`);
  } catch (error) {
    console.error('更新支付記錄狀態失敗:', error);
    throw error;
  }
}

/**
 * 更新原始記錄的狀態
 * @param payout 支付記錄
 * @param status 新狀態
 */
export async function updateOriginalRecordStatus(
  payout: PayoutRecord, 
  status: string
): Promise<void> {
  try {
    // 根據 referenceType 和 referenceId 找到原始記錄
    let originalRecordPath = '';
    
    if (payout.referenceType === 'dividend') {
      // 路徑格式：dividend_snapshots/{snapshotId}/equity_payouts/{employeeId}
      const parts = payout.referenceId.split('/');
      if (parts.length >= 2) {
        originalRecordPath = `dividend_snapshots/${parts[0]}/equity_payouts/${payout.employeeId}`;
      }
    }
    
    if (!originalRecordPath) {
      console.log(`找不到參考類型 ${payout.referenceType} 的原始記錄路徑`);
      return;
    }
    
    console.log(`正在更新文檔 ${originalRecordPath} 的狀態為 ${status}`);
    
    // 執行實際更新
    const originalRecord = getDb().doc(originalRecordPath);
    await originalRecord.update({
      status: status,
      payoutId: payout.id,
      payoutStatus: status,
      updatedAt: new Date()
    });
    
    console.log(`成功更新原始記錄 ${originalRecordPath} 的狀態`);
  } catch (error) {
    console.error(`更新原始記錄狀態失敗:`, error);
    // 這裡只記錄錯誤，不拋出異常，避免影響主流程
  }
} 