/**
 * 財務模組 - 排程處理程序
 * 目前為空白文件，將在後續實現排程功能
 * 
 * 預計包含：
 * - generateMonthlyProfitReports: 每月自動生成上個月的利潤報表
 * - generateQuarterlyFinancialReports: 每季度自動生成上季度的財務報表
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { DateTime } from 'luxon';
import { calculateMonthlyProfit } from './services/profitCalculation';

/**
 * 生成月度利潤報告
 * 每月1日凌晨1點自動執行，為所有活躍店鋪計算上個月的利潤報告
 */
export const generateMonthlyProfitReports = onSchedule({
  schedule: '0 1 1 * *',        // 每月1日凌晨1:00執行
  timeZone: 'Asia/Taipei',       // 台北時區
  region: 'asia-east1'           // 亞洲區域（台灣）
}, async (event) => {
  try {
    console.log('開始執行月度利潤報告生成任務');
    
    // 1. 計算上一個月的年份和月份
    const now = DateTime.now().setZone('Asia/Taipei');
    const previousMonth = now.minus({ months: 1 });
    const year = previousMonth.year;
    const month = previousMonth.month; // 1-12
    
    console.log(`準備計算 ${year}年${month}月 的月度利潤報告`);
    
    // 2. 獲取所有活躍的店鋪
    const storesSnapshot = await admin.firestore()
      .collection('stores')
      .where('status', '==', 'active')
      .get();
    
    if (storesSnapshot.empty) {
      console.log('沒有找到活躍的店鋪，任務結束');
      return;
    }
    
    console.log(`找到 ${storesSnapshot.size} 個活躍店鋪，開始計算利潤報告`);
    
    // 3. 遍歷每個店鋪，計算上月利潤
    const results = {
      totalStores: storesSnapshot.size,
      successCount: 0,
      failureCount: 0,
      failures: [] as Array<{ storeId: string, error: string }>
    };
    
    // 為了避免可能的並發問題，使用循序處理
    for (const storeDoc of storesSnapshot.docs) {
      const storeId = storeDoc.id;
      const storeName = storeDoc.data().name || storeId;
      
      try {
        console.log(`開始計算店鋪 "${storeName}" (${storeId}) 的 ${year}年${month}月利潤報告`);
        
        // 調用利潤計算服務
        const netProfit = await calculateMonthlyProfit(storeId, year, month);
        
        console.log(`成功計算店鋪 "${storeName}" (${storeId}) 的利潤報告，稅後淨利: ${netProfit}`);
        results.successCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`計算店鋪 "${storeName}" (${storeId}) 的利潤報告時發生錯誤:`, error);
        
        results.failureCount++;
        results.failures.push({
          storeId,
          error: errorMessage
        });
      }
    }
    
    // 4. 記錄任務結果
    console.log(`月度利潤報告生成任務完成，總計: ${results.totalStores}，成功: ${results.successCount}，失敗: ${results.failureCount}`);
    
    if (results.failureCount > 0) {
      console.log('失敗的店鋪清單:');
      results.failures.forEach(failure => {
        console.log(`- 店鋪ID: ${failure.storeId}, 錯誤: ${failure.error}`);
      });
    }
    
    // 5. 將任務執行記錄寫入資料庫（可選）
    try {
      await admin.firestore().collection('systemLogs').add({
        type: 'scheduled_task',
        taskName: 'generateMonthlyProfitReports',
        executionTime: admin.firestore.Timestamp.now(),
        period: `${year}-${month.toString().padStart(2, '0')}`,
        results: {
          totalStores: results.totalStores,
          successCount: results.successCount,
          failureCount: results.failureCount,
          failures: results.failures
        }
      });
    } catch (logError) {
      console.error('記錄任務執行結果時發生錯誤:', logError);
    }
  } catch (error) {
    console.error('執行月度利潤報告生成任務時發生錯誤:', error);
    throw error;
  }
});

// 此文件目前留空，後續將實現排程功能 