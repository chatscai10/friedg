/**
 * 財務模塊排程處理程序 - Gen 2 版本
 * 使用 Firebase Functions v2 API
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { calculateMonthlyProfit } from './services/profitCalculation';
import { updateUncompensatedLosses } from './services/lossTracking';
import { MonthlyProfitReport } from './types';

// 報告狀態 (與 types.ts 中的 ReportStatus 保持一致)
enum ReportStatus {
  DRAFT = 'draft',             // 草稿
  COMPLETED = 'completed',     // 已完成
  APPROVED = 'approved',       // 已審核
  ARCHIVED = 'archived',       // 已歸檔
  REJECTED = 'rejected',       // 被拒絕
  FAILED = 'failed'            // 失敗
}

// 確保應用已初始化
try {
  admin.app();
} catch (error) {
  admin.initializeApp();
}

// 設定區域和其他配置
const region = 'asia-east1'; // 台灣區域

/**
 * 每月生成利潤報告
 * 在每月第二天凌晨 3:00 執行
 */
export const generateMonthlyProfitReports = onSchedule({
  schedule: '0 3 2 * *',
  region,
  timeZone: 'Asia/Taipei',
  retryCount: 3,
  memory: '256MiB'
}, async (event) => {
  try {
    console.log('開始生成每月利潤報告...');

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

      console.log(`為租戶 ${tenantId} (${tenantData.name}) 生成利潤報告`);

      try {
        // 獲取租戶的所有店鋪
        const storesSnapshot = await admin.firestore()
          .collection('stores')
          .where('tenantId', '==', tenantId)
          .where('status', '==', 'active')
          .get();

        if (storesSnapshot.empty) {
          console.log(`租戶 ${tenantId} 沒有活躍的店鋪，跳過報告生成`);
          return null;
        }

        // 為每個店鋪生成報告
        const storeReportPromises = storesSnapshot.docs.map(async (storeDoc) => {
          const storeId = storeDoc.id;
          const storeData = storeDoc.data();

          console.log(`為店鋪 ${storeId} (${storeData.name}) 生成利潤報告`);

          try {
            // 計算上個月的利潤
            const profitData = await calculateMonthlyProfit(
              tenantId,
              storeId,
              lastMonth,
              lastMonthEnd
            );

            // 創建報告記錄
            const reportRef = admin.firestore()
              .collection('tenants')
              .doc(tenantId)
              .collection('financialReports')
              .doc();

            // 創建自定義報告格式
            const report = {
              id: reportRef.id,
              tenantId,
              storeId,
              storeName: storeData.name,
              reportType: 'monthly_profit',
              period: {
                year: lastMonth.getFullYear(),
                month: lastMonth.getMonth() + 1,
                startDate: admin.firestore.Timestamp.fromDate(lastMonth),
                endDate: admin.firestore.Timestamp.fromDate(lastMonthEnd)
              },
              // 財務數據
              totalSales: profitData.revenue,
              costOfGoodsSold: profitData.expenses * 0.7, // 假設 70% 的費用是銷貨成本
              costCalculationMethod: 'estimated',
              operatingExpenses: profitData.expenses * 0.3, // 假設 30% 的費用是營運費用
              profitBeforeTax: profitData.netProfit,
              tax: profitData.netProfit * 0.2, // 假設 20% 稅率
              taxRate: 0.2,
              netProfitAfterTax: profitData.netProfit * 0.8, // 稅後淨利

              // 元數據
              reportDate: admin.firestore.Timestamp.fromDate(lastMonthEnd),
              calculatedAt: admin.firestore.Timestamp.now(),
              status: ReportStatus.COMPLETED,

              // 系統欄位
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await reportRef.set(report);

            console.log(`店鋪 ${storeId} 的利潤報告生成成功，報告ID: ${reportRef.id}`);
            return report;
          } catch (error) {
            console.error(`為店鋪 ${storeId} 生成利潤報告時出錯:`, error);

            // 創建失敗的報告記錄
            const reportRef = admin.firestore()
              .collection('tenants')
              .doc(tenantId)
              .collection('financialReports')
              .doc();

            // 創建失敗報告
            const failedReport = {
              id: reportRef.id,
              tenantId,
              storeId,
              storeName: storeData.name,
              reportType: 'monthly_profit',
              period: {
                year: lastMonth.getFullYear(),
                month: lastMonth.getMonth() + 1,
                startDate: admin.firestore.Timestamp.fromDate(lastMonth),
                endDate: admin.firestore.Timestamp.fromDate(lastMonthEnd)
              },
              // 元數據
              reportDate: admin.firestore.Timestamp.fromDate(lastMonthEnd),
              calculatedAt: admin.firestore.Timestamp.now(),
              status: ReportStatus.FAILED,

              // 錯誤信息
              notes: error instanceof Error ? error.message : '未知錯誤',

              // 系統欄位
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await reportRef.set(failedReport);

            // 繼續處理其他店鋪
            return null;
          }
        });

        // 等待所有店鋪報告生成完成
        const storeReports = await Promise.all(storeReportPromises);
        const successfulStoreReports = storeReports.filter(report => report !== null);

        console.log(`租戶 ${tenantId} 的利潤報告生成完成。成功: ${successfulStoreReports.length}, 失敗: ${storeReports.length - successfulStoreReports.length}`);

        // 更新未補償損失
        // 計算季度淨利潤 (假設為所有成功報告的淨利潤總和)
        const quarterlyNetProfit = successfulStoreReports.reduce((total, report) => {
          return total + (report.netProfitAfterTax || 0);
        }, 0);

        await updateUncompensatedLosses(tenantId, quarterlyNetProfit);

        return {
          tenantId,
          successCount: successfulStoreReports.length,
          failureCount: storeReports.length - successfulStoreReports.length
        };
      } catch (error) {
        console.error(`為租戶 ${tenantId} 生成利潤報告時出錯:`, error);
        // 繼續處理其他租戶
        return null;
      }
    });

    // 等待所有租戶報告生成完成
    const reports = await Promise.all(reportPromises);
    const successfulReports = reports.filter(report => report !== null);

    console.log(`每月利潤報告生成完成。成功處理租戶數: ${successfulReports.length}, 失敗: ${reports.length - successfulReports.length}`);
  } catch (error) {
    console.error('生成每月利潤報告時出錯:', error);
    throw error;
  }
});
