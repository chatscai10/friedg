/**
 * 股權模塊排程處理程序 - Gen 2 版本
 * 使用 Firebase Functions v2 API
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { 
  generateEquityReports, 
  updateEquityValuations,
  notifyUpcomingVestingEvents,
  archiveOldEquityTransactions
} from './services';

// 確保應用已初始化
try {
  admin.app();
} catch (error) {
  admin.initializeApp();
}

// 設定區域和其他配置
const region = 'asia-east1'; // 台灣區域

/**
 * 每月生成股權報告
 * 在每月第一天凌晨 2:00 執行
 */
export const generateMonthlyEquityReports = onSchedule({
  schedule: '0 2 1 * *',
  region,
  timeZone: 'Asia/Taipei',
  retryCount: 3,
  memory: '256MiB'
}, async (event) => {
  try {
    console.log('開始生成每月股權報告...');
    
    // 獲取所有租戶
    const tenantsSnapshot = await admin.firestore()
      .collection('tenants')
      .where('status', '==', 'active')
      .get();
    
    if (tenantsSnapshot.empty) {
      console.log('沒有找到活躍的租戶，跳過報告生成');
      return;
    }
    
    // 獲取上個月的日期範圍
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // 為每個租戶生成報告
    const reportPromises = tenantsSnapshot.docs.map(async (tenantDoc) => {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data();
      
      console.log(`為租戶 ${tenantId} (${tenantData.name}) 生成股權報告`);
      
      try {
        const report = await generateEquityReports(
          tenantId,
          lastMonth,
          lastMonthEnd
        );
        
        console.log(`租戶 ${tenantId} 的股權報告生成成功，報告ID: ${report.id}`);
        return report;
      } catch (error) {
        console.error(`為租戶 ${tenantId} 生成股權報告時出錯:`, error);
        // 繼續處理其他租戶
        return null;
      }
    });
    
    // 等待所有報告生成完成
    const reports = await Promise.all(reportPromises);
    const successfulReports = reports.filter(report => report !== null);
    
    console.log(`每月股權報告生成完成。成功: ${successfulReports.length}, 失敗: ${reports.length - successfulReports.length}`);
  } catch (error) {
    console.error('生成每月股權報告時出錯:', error);
    throw error;
  }
});

/**
 * 每週更新股權估值
 * 在每週一凌晨 3:00 執行
 */
export const weeklyEquityValuationUpdate = onSchedule({
  schedule: '0 3 * * 1',
  region,
  timeZone: 'Asia/Taipei',
  retryCount: 3,
  memory: '256MiB'
}, async (event) => {
  try {
    console.log('開始每週股權估值更新...');
    
    // 獲取所有租戶
    const tenantsSnapshot = await admin.firestore()
      .collection('tenants')
      .where('status', '==', 'active')
      .get();
    
    if (tenantsSnapshot.empty) {
      console.log('沒有找到活躍的租戶，跳過估值更新');
      return;
    }
    
    // 為每個租戶更新估值
    const updatePromises = tenantsSnapshot.docs.map(async (tenantDoc) => {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data();
      
      console.log(`為租戶 ${tenantId} (${tenantData.name}) 更新股權估值`);
      
      try {
        const result = await updateEquityValuations(tenantId);
        console.log(`租戶 ${tenantId} 的股權估值更新成功`);
        return result;
      } catch (error) {
        console.error(`為租戶 ${tenantId} 更新股權估值時出錯:`, error);
        // 繼續處理其他租戶
        return null;
      }
    });
    
    // 等待所有更新完成
    const results = await Promise.all(updatePromises);
    const successfulUpdates = results.filter(result => result !== null);
    
    console.log(`每週股權估值更新完成。成功: ${successfulUpdates.length}, 失敗: ${results.length - successfulUpdates.length}`);
  } catch (error) {
    console.error('更新每週股權估值時出錯:', error);
    throw error;
  }
});

/**
 * 每天檢查並通知即將到來的股權歸屬事件
 * 在每天凌晨 1:00 執行
 */
export const dailyVestingNotifications = onSchedule({
  schedule: '0 1 * * *',
  region,
  timeZone: 'Asia/Taipei',
  retryCount: 3,
  memory: '256MiB'
}, async (event) => {
  try {
    console.log('開始檢查即將到來的股權歸屬事件...');
    
    // 獲取所有租戶
    const tenantsSnapshot = await admin.firestore()
      .collection('tenants')
      .where('status', '==', 'active')
      .get();
    
    if (tenantsSnapshot.empty) {
      console.log('沒有找到活躍的租戶，跳過歸屬通知');
      return;
    }
    
    // 為每個租戶檢查歸屬事件
    const notificationPromises = tenantsSnapshot.docs.map(async (tenantDoc) => {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data();
      
      console.log(`為租戶 ${tenantId} (${tenantData.name}) 檢查股權歸屬事件`);
      
      try {
        // 檢查未來7天內的歸屬事件
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const result = await notifyUpcomingVestingEvents(
          tenantId,
          now,
          nextWeek
        );
        
        console.log(`租戶 ${tenantId} 的股權歸屬通知發送成功，共 ${result.notificationCount} 條通知`);
        return result;
      } catch (error) {
        console.error(`為租戶 ${tenantId} 發送股權歸屬通知時出錯:`, error);
        // 繼續處理其他租戶
        return null;
      }
    });
    
    // 等待所有通知發送完成
    const results = await Promise.all(notificationPromises);
    const successfulNotifications = results.filter(result => result !== null);
    
    console.log(`每日股權歸屬通知完成。成功: ${successfulNotifications.length}, 失敗: ${results.length - successfulNotifications.length}`);
  } catch (error) {
    console.error('發送每日股權歸屬通知時出錯:', error);
    throw error;
  }
});

/**
 * 每季歸檔舊的股權交易記錄
 * 在每季度第一天凌晨 4:00 執行
 */
export const quarterlyTransactionArchiving = onSchedule({
  schedule: '0 4 1 1,4,7,10 *',
  region,
  timeZone: 'Asia/Taipei',
  retryCount: 3,
  memory: '256MiB'
}, async (event) => {
  try {
    console.log('開始歸檔舊的股權交易記錄...');
    
    // 獲取所有租戶
    const tenantsSnapshot = await admin.firestore()
      .collection('tenants')
      .where('status', '==', 'active')
      .get();
    
    if (tenantsSnapshot.empty) {
      console.log('沒有找到活躍的租戶，跳過交易歸檔');
      return;
    }
    
    // 計算歸檔日期（超過一年的交易）
    const now = new Date();
    const archiveDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    
    // 為每個租戶歸檔交易
    const archivePromises = tenantsSnapshot.docs.map(async (tenantDoc) => {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data();
      
      console.log(`為租戶 ${tenantId} (${tenantData.name}) 歸檔舊的股權交易記錄`);
      
      try {
        const result = await archiveOldEquityTransactions(
          tenantId,
          archiveDate
        );
        
        console.log(`租戶 ${tenantId} 的股權交易歸檔成功，共歸檔 ${result.archivedCount} 條記錄`);
        return result;
      } catch (error) {
        console.error(`為租戶 ${tenantId} 歸檔股權交易時出錯:`, error);
        // 繼續處理其他租戶
        return null;
      }
    });
    
    // 等待所有歸檔完成
    const results = await Promise.all(archivePromises);
    const successfulArchives = results.filter(result => result !== null);
    
    console.log(`每季股權交易歸檔完成。成功: ${successfulArchives.length}, 失敗: ${results.length - successfulArchives.length}`);
  } catch (error) {
    console.error('歸檔每季股權交易時出錯:', error);
    throw error;
  }
});
