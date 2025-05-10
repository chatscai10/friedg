/**
 * 財務模組 - 利潤計算服務
 * 負責計算店鋪的月度和季度利潤數據
 */

import * as admin from 'firebase-admin';
import { DateTime } from 'luxon';
import { MonthlyProfitReport, ReportStatus } from '../types';

// Firestore 引用
const db = admin.firestore();
const monthlyProfitReportsCollection = db.collection('monthlyProfitReports');

// 從訂單服務中導入查詢功能（用於獲取銷售額數據）
import { getOrderStats } from '../../orders/services/orderService';

// 定義利潤計算所需的常量
const DEFAULT_TAX_RATE = 0.2;           // 預設公司稅率20%
const DEFAULT_EXPENSE_RATIO = 0.3;      // 預設費用佔比30%
const DEFAULT_COGS_RATIO = 0.5;         // 預設銷貨成本佔比50%

/**
 * 計算店鋪月度稅後淨利並儲存
 * 
 * @param storeId 店鋪ID
 * @param year 年份
 * @param month 月份 (1-12)
 * @returns 計算出的稅後淨利
 */
export async function calculateMonthlyProfit(
  storeId: string,
  year: number,
  month: number
): Promise<number> {
  console.log(`開始計算店鋪 ${storeId} ${year}年${month}月的利潤數據`);
  
  try {
    // 1. 獲取店鋪基本信息（包括租戶ID）
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) {
      throw new Error(`找不到店鋪: ${storeId}`);
    }
    const storeData = storeDoc.data()!;
    const tenantId = storeData.tenantId;
    
    // 2. 確定月份的開始和結束日期
    const startDate = DateTime.fromObject({ year, month, day: 1 }).startOf('day').toJSDate();
    const endDate = DateTime.fromObject({ year, month, day: 1 }).endOf('month').toJSDate();
    
    // 3. 獲取銷售數據
    const orderStats = await getOrderStats(storeId, startDate, endDate, 'month');
    const totalSales = orderStats.totalSales;
    
    // 4. 計算成本 - 改進方法：嘗試基於實際菜單成本計算，若數據不足則回退到比例估算
    let costOfGoodsSold = 0;
    let costCalculationMethod: 'actual' | 'estimated' = 'estimated'; // 明確指定類型為 'actual' | 'estimated'
    
    try {
      // 先獲取該時間範圍內的所有訂單項目
      const orderItems = await db.collection('orders')
        .where('storeId', '==', storeId)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get()
        .then(snapshot => snapshot.docs.flatMap(doc => {
          const order = doc.data();
          return order.items || [];
        }));
      
      // 如果有訂單項目，嘗試計算實際成本
      if (orderItems.length > 0) {
        // 獲取所有相關的菜單項目ID
        const menuItemIds = [...new Set(orderItems.map(item => item.menuItemId))];
        
        // 每次最多查詢10個ID (Firestore 'in' 查詢的限制)
        let menuItemsData = {};
        for (let i = 0; i < menuItemIds.length; i += 10) {
          const batchIds = menuItemIds.slice(i, i + 10);
          if (batchIds.length > 0) {
            const batchData = await db.collection('menuItems')
              .where('id', 'in', batchIds)
              .get()
              .then(snapshot => {
                const items = {};
                snapshot.docs.forEach(doc => {
                  const data = doc.data();
                  items[data.id] = data;
                });
                return items;
              });
            menuItemsData = { ...menuItemsData, ...batchData };
          }
        }
        
        // 計算實際的銷貨成本
        let hasRealCostData = false;
        let totalItemsWithCost = 0;
        let totalItemsCount = orderItems.length;
        
        for (const item of orderItems) {
          const menuItem = menuItemsData[item.menuItemId];
          if (menuItem && typeof menuItem.costPrice === 'number') {
            costOfGoodsSold += menuItem.costPrice * item.quantity;
            totalItemsWithCost++;
            hasRealCostData = true;
          }
        }
        
        // 如果成本數據覆蓋率超過70%，使用實際計算的成本
        if (hasRealCostData && (totalItemsWithCost / totalItemsCount) > 0.7) {
          costCalculationMethod = 'actual';
          console.log(`使用實際成本數據計算銷貨成本，覆蓋率: ${(totalItemsWithCost / totalItemsCount * 100).toFixed(2)}%`);
        } else {
          // 數據不足，回退到預設比例
          costOfGoodsSold = totalSales * DEFAULT_COGS_RATIO;
          costCalculationMethod = 'estimated';
          console.log(`實際成本數據不足(僅覆蓋${(totalItemsWithCost / totalItemsCount * 100).toFixed(2)}%)，使用預設比例(${DEFAULT_COGS_RATIO * 100}%)計算銷貨成本`);
        }
      } else {
        // 沒有訂單項目，使用預設比例
        costOfGoodsSold = totalSales * DEFAULT_COGS_RATIO;
        costCalculationMethod = 'estimated';
        console.log(`沒有找到訂單項目，使用預設比例(${DEFAULT_COGS_RATIO * 100}%)計算銷貨成本`);
      }
    } catch (error) {
      // 如果出現錯誤，回退到預設比例
      costOfGoodsSold = totalSales * DEFAULT_COGS_RATIO;
      costCalculationMethod = 'estimated';
      console.error('計算實際銷貨成本時出錯，使用預設比例:', error);
    }
    
    // 5. 計算費用 (使用預設比例)
    // 注意: 這是一個基於假設的 placeholder 計算方式
    const operatingExpenses = totalSales * DEFAULT_EXPENSE_RATIO;
    
    // 6. 計算稅前利潤
    const profitBeforeTax = totalSales - costOfGoodsSold - operatingExpenses;
    
    // 7. 計算稅金 (使用固定稅率)
    // 注意: 這是一個簡化的 placeholder 稅率計算方式
    const tax = profitBeforeTax > 0 ? profitBeforeTax * DEFAULT_TAX_RATE : 0;
    
    // 8. 計算稅後淨利
    const netProfitAfterTax = profitBeforeTax - tax;
    
    // 9. 建立月度報告日期 (通常是月末)
    const reportDate = admin.firestore.Timestamp.fromDate(endDate);
    
    // 10. 構建報告對象
    const monthlyReport: MonthlyProfitReport = {
      storeId,
      tenantId,
      year,
      month,
      totalSales,
      costOfGoodsSold,
      costCalculationMethod, // 使用明確類型的變數
      operatingExpenses,
      profitBeforeTax,
      tax,
      taxRate: DEFAULT_TAX_RATE,
      netProfitAfterTax,
      reportDate,
      calculatedAt: admin.firestore.Timestamp.now(),
      status: ReportStatus.DRAFT
    };
    
    // 11. 生成文檔ID (格式: storeId_yyyyMM)
    const monthStr = month.toString().padStart(2, '0');
    const docId = `${storeId}_${year}${monthStr}`;
    
    // 12. 儲存到 Firestore
    await monthlyProfitReportsCollection.doc(docId).set(monthlyReport);
    
    console.log(`成功計算並儲存店鋪 ${storeId} ${year}年${month}月 利潤報告，稅後淨利: ${netProfitAfterTax}`);
    return netProfitAfterTax;
  } catch (error) {
    console.error(`計算店鋪 ${storeId} ${year}年${month}月 利潤時發生錯誤:`, error);
    throw error;
  }
}

/**
 * 根據月度報告計算季度財務報告 (此函數為後續開發預留)
 * 
 * @param storeId 店鋪ID
 * @param year 年份
 * @param quarter 季度 (1-4)
 */
// export async function calculateQuarterlyProfit(
//   storeId: string,
//   year: number,
//   quarter: number
// ): Promise<number> {
//   // 此函數將在後續開發中實現
//   return 0;
// } 