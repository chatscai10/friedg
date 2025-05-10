/**
 * 員工動態股權制度 - 排程處理程序文件
 * 包含 openPurchaseWindow 和 closePurchaseWindow 等排程函數
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineString } from 'firebase-functions/params';

// 引入 v2 函數
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as payments from '../payments';

// 使用函數而非直接獲取Firestore集合
function getDb() {
  return admin.firestore();
}

function getTenantsCollection() {
  return getDb().collection('tenants');
}

function getEquityPoolCollection() {
  return getDb().collection('equity_pool');
}

function getEmployeeEquityCollection() {
  return getDb().collection('employee_equity');
}

function getMonthlyProfitReportsCollection() {
  return getDb().collection('monthlyProfitReports');
}

function getQuarterlyFinancialReportsCollection() {
  return getDb().collection('quarterlyFinancialReports');
}

// 引入財務模組中的updateUncompensatedLosses函數
import { updateUncompensatedLosses } from '../financial';
// 引入薪資模組中的scheduleOneTimeDeduction函數
import { scheduleOneTimeDeduction } from '../payroll';

/**
 * 開啟購股窗口的邏輯實現
 * 設置所有活躍租戶的購股窗口狀態為開啟
 */
export async function openPurchaseWindowFunc(): Promise<number> {
  try {
    console.log('開始執行開啟購股窗口任務');
    
    // 1. 獲取所有活躍租戶
    const tenantsSnapshot = await getTenantsCollection()
      .where('status', '==', 'active')
      .get();
    
    if (tenantsSnapshot.empty) {
      console.log('沒有找到活躍租戶');
      return 0;
    }
    
    // 2. 逐一處理每個租戶
    const batch = getDb().batch();
    const timestamp = admin.firestore.Timestamp.now();
    const processingDate = timestamp.toDate();
    const processingQuarter = Math.floor(processingDate.getMonth() / 3) + 1;
    const processingYear = processingDate.getFullYear();
    
    let updateCount = 0;
    
    console.log(`處理 ${tenantsSnapshot.size} 個活躍租戶的購股窗口開啟 (年度: ${processingYear}, 季度: ${processingQuarter})`);
    
    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;
      
      // 獲取租戶下的所有股權池
      const equityPoolsSnapshot = await getEquityPoolCollection()
        .where('tenantId', '==', tenantId)
        .get();
      
      for (const poolDoc of equityPoolsSnapshot.docs) {
        // 更新每個股權池的購股窗口狀態
        batch.update(poolDoc.ref, {
          purchaseWindowOpen: true,
          lastWindowOpenDate: processingDate,
          currentQuarter: processingQuarter,
          currentYear: processingYear,
          updatedAt: timestamp.toDate()
        });
        
        updateCount++;
      }
    }
    
    // 3. 執行批量更新
    if (updateCount > 0) {
      await batch.commit();
      console.log(`成功開啟 ${updateCount} 個股權池的購股窗口`);
    } else {
      console.log('沒有找到需要開啟的股權池');
    }
    
    return updateCount;
  } catch (error) {
    console.error('開啟購股窗口時發生錯誤:', error);
    throw error;
  }
}

/**
 * 開啟購股窗口 (每季第一天觸發)
 * 設置所有活躍租戶的購股窗口狀態為開啟
 */
export const openPurchaseWindow = onSchedule({
  schedule: '0 0 1 1,4,7,10 *',
  timeZone: 'Asia/Taipei',
  region: 'asia-east1'
}, async (event) => {
  await openPurchaseWindowFunc();
  return null;
});

/**
 * 關閉購股窗口的邏輯實現
 * 設置所有開啟中的購股窗口狀態為關閉
 */
export async function closePurchaseWindowFunc(): Promise<number> {
  try {
    console.log('開始執行關閉購股窗口任務');
    
    // 1. 直接獲取所有購股窗口開啟的股權池
    const openPoolsSnapshot = await getEquityPoolCollection()
      .where('purchaseWindowOpen', '==', true)
      .get();
    
    if (openPoolsSnapshot.empty) {
      console.log('沒有找到開啟中的購股窗口');
      return 0;
    }
    
    // 2. 批量關閉所有開啟的窗口
    const batch = getDb().batch();
    const timestamp = admin.firestore.Timestamp.now();
    
    console.log(`準備關閉 ${openPoolsSnapshot.size} 個開啟中的購股窗口`);
    
    for (const poolDoc of openPoolsSnapshot.docs) {
      batch.update(poolDoc.ref, {
        purchaseWindowOpen: false,
        lastWindowCloseDate: timestamp.toDate(),
        updatedAt: timestamp.toDate()
      });
    }
    
    // 3. 執行批量更新
    await batch.commit();
    console.log(`成功關閉 ${openPoolsSnapshot.size} 個股權池的購股窗口`);
    
    return openPoolsSnapshot.size;
  } catch (error) {
    console.error('關閉購股窗口時發生錯誤:', error);
    throw error;
  }
}

/**
 * 關閉購股窗口 (開窗 5 天後觸發)
 * 設置所有活躍租戶的購股窗口狀態為關閉
 */
export const closePurchaseWindow = onSchedule({
  schedule: '0 0 6 1,4,7,10 *',
  timeZone: 'Asia/Taipei',
  region: 'asia-east1'
}, async (event) => {
  await closePurchaseWindowFunc();
  return null;
});

/**
 * 重估股權價值 (每半年執行一次)
 * 根據店鋪近期稅後淨利，計算並更新股權估值
 */
export const revalueShares = onSchedule({
  schedule: '0 0 1 1,7 *', // 每年1月1日和7月1日的 00:00 執行
  timeZone: 'Asia/Taipei',
  region: 'asia-east1'
}, async (event) => {
  try {
    console.log('開始執行股權重估任務');
    
    // 1. 獲取所有活躍的租戶
    const tenantsSnapshot = await getTenantsCollection()
      .where('status', '==', 'active')
      .get();
    
    if (tenantsSnapshot.empty) {
      console.log('沒有找到活躍租戶');
      return null;
    }
    
    // 2. 獲取當前時間
    const now = admin.firestore.Timestamp.now();
    const currentDate = now.toDate();
    const timestamp = now;
    
    // 3. 批次處理所有更新
    const batch = getDb().batch();
    let updateCount = 0;
    
    // 4. 遍歷所有活躍租戶
    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;
      
      // 5. 獲取租戶下的所有股權池
      const equityPoolsSnapshot = await getEquityPoolCollection()
        .where('tenantId', '==', tenantId)
        .get();
      
      if (equityPoolsSnapshot.empty) {
        console.log(`租戶 ${tenantId} 沒有股權池`);
        continue;
      }
      
      // 6. 處理每個股權池
      for (const poolDoc of equityPoolsSnapshot.docs) {
        const poolData = poolDoc.data();
        const storeId = poolData.storeId;
        const createdAt = poolData.createdAt.toDate();
        const previousValuation = poolData.valuation || 0;
        
        // 7. 計算店鋪營運時長（月）
        const operationMonths = calculateMonthsDifference(createdAt, currentDate);
        
        // 8. 獲取店鋪利潤數據
        const profitData = await fetchProfitData(storeId, operationMonths);
        
        // 9. 計算新估值
        const newValuation = calculateValuation(profitData, operationMonths, previousValuation);
        
        // 10. 更新股權池估值
        batch.update(poolDoc.ref, {
          valuation: newValuation,
          shareValue: newValuation / poolData.totalShares, // 更新每股價值
          lastValuationDate: currentDate,
          updatedAt: timestamp.toDate()
        });
        
        console.log(`重估股權池 ${poolDoc.id} 估值: ${previousValuation} → ${newValuation}`);
        updateCount++;
      }
    }
    
    // 11. 提交批量更新
    if (updateCount > 0) {
      await batch.commit();
      console.log(`成功完成 ${updateCount} 個股權池的估值重估`);
    } else {
      console.log('沒有找到需要更新的股權池');
    }
    
    return null;
  } catch (error) {
    console.error('執行股權重估任務時發生錯誤:', error);
    throw error;
  }
});

/**
 * 自動計算並發放股權分紅 (每季度結束後執行)
 * 根據持股比例和當季淨利計算分紅
 */
export const autoDistributeDividends = onSchedule({
  schedule: '0 0 1 1,4,7,10 *', // 每季度結束後的第一天 00:00 執行
  timeZone: 'Asia/Taipei',
  region: 'asia-east1'
}, async (event) => {
  try {
    console.log('開始執行自動分紅計算任務');
    
    // 1. 獲取當前時間和前一季度信息
    const now = admin.firestore.Timestamp.now();
    const currentDate = now.toDate();
    
    // 計算前一季度的年份和季度號
    let prevQuarter = currentDate.getMonth() / 3; // 當前季度（0-based）
    prevQuarter = prevQuarter === 0 ? 3 : prevQuarter; // 如果是第一季，則前一季是去年第四季
    const prevYear = prevQuarter === 3 && currentDate.getMonth() < 3 ? 
                     currentDate.getFullYear() - 1 : 
                     currentDate.getFullYear();
    
    // 格式化為 yyyyQn 格式：例如 2023Q4
    const dividendPeriodId = `${prevYear}Q${Math.floor(prevQuarter)}`;
    console.log(`處理 ${dividendPeriodId} 季度的分紅計算`);
    
    // 2. 獲取所有活躍租戶
    const tenantsSnapshot = await getTenantsCollection()
      .where('status', '==', 'active')
      .get();
    
    if (tenantsSnapshot.empty) {
      console.log('沒有找到活躍租戶');
      return null;
    }
    
    // 3. 遍歷所有活躍租戶
    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantId = tenantDoc.id;
      
      // 4. 獲取租戶下的所有股權池
      const equityPoolsSnapshot = await getEquityPoolCollection()
        .where('tenantId', '==', tenantId)
        .get();
      
      if (equityPoolsSnapshot.empty) {
        console.log(`租戶 ${tenantId} 沒有股權池`);
        continue;
      }
      
      // 5. 處理每個股權池
      for (const poolDoc of equityPoolsSnapshot.docs) {
        const poolId = poolDoc.id;
        const poolData = poolDoc.data();
        const storeId = poolData.storeId;
        
        // 6. 獲取季度財務報告
        const quarterlyFinancialData = await fetchQuarterlyFinancialData(storeId, prevYear, Math.floor(prevQuarter));
        
        // 確認是否有稅後淨利可供分配
        if (quarterlyFinancialData.netProfitAfterTax <= 0) {
          console.log(`店鋪 ${storeId} 在 ${dividendPeriodId} 季度沒有稅後淨利，跳過分紅`);
          continue;
        }
        
        // 7. 更新未彌補虧損
        const quarterlyNetProfit = quarterlyFinancialData.netProfitAfterTax;
        console.log(`正在更新店鋪 ${storeId} 的未彌補虧損，季度淨利: ${quarterlyNetProfit}`);
        const updatedUncompensatedLosses = await updateUncompensatedLosses(poolId, quarterlyNetProfit);
        
        // 8. 計算可分配利潤 = max(0, 季淨利 - 未彌補虧損)
        const distributableProfit = Math.max(0, quarterlyNetProfit - updatedUncompensatedLosses);
        
        if (distributableProfit <= 0) {
          console.log(`店鋪 ${storeId} 在 ${dividendPeriodId} 季度的可分配利潤為零，跳過分紅`);
          continue;
        }
        
        // 9. 獲取所有持有該股權池股份的員工
        const employeeEquitySnapshot = await getEmployeeEquityCollection()
          .where('storeId', '==', storeId)
          .where('status', '==', 'active') // 只考慮狀態為活躍的持股記錄
          .where('shares', '>', 0) // 只考慮持有股份的員工
          .get();
        
        if (employeeEquitySnapshot.empty) {
          console.log(`店鋪 ${storeId} 沒有符合條件的持股員工，跳過分紅`);
          continue;
        }
        
        // 10. 計算總發行股數和每位員工的持股比例與分紅
        const totalShares = poolData.totalShares;
        let totalDistributedAmount = 0;
        const employeePayouts = [];
        
        for (const employeeEquityDoc of employeeEquitySnapshot.docs) {
          const employeeEquityData = employeeEquityDoc.data();
          const employeeId = employeeEquityData.employeeId;
          const employeeShares = employeeEquityData.shares;
          
          // 計算持股比例
          const sharePercentage = employeeShares / totalShares;
          
          // 計算應得分紅金額
          const dividendAmount = Math.floor(distributableProfit * sharePercentage);
          
          if (dividendAmount > 0) {
            employeePayouts.push({
              employeeId: employeeId,
              shares: employeeShares,
              sharePercentage: sharePercentage,
              dividendAmount: dividendAmount,
              status: 'pending', // 分紅狀態：待支付
              createdAt: now.toDate(),
              updatedAt: now.toDate()
            });
            
            totalDistributedAmount += dividendAmount;
          }
        }
        
        // 若沒有任何員工獲得分紅，跳過後續處理
        if (employeePayouts.length === 0) {
          console.log(`店鋪 ${storeId} 在 ${dividendPeriodId} 季度沒有員工獲得分紅，跳過`);
          continue;
        }
        
        // 11. 建立分紅快照文件
        const dividendSnapshotRef = getDb().collection('dividend_snapshots').doc(`${storeId}_${dividendPeriodId}`);
        const dividendSnapshot = {
          storeId: storeId,
          tenantId: tenantId,
          period: dividendPeriodId,
          quarterlyProfit: quarterlyNetProfit,
          uncompensatedLosses: updatedUncompensatedLosses,
          distributableProfit: distributableProfit,
          totalDistributedAmount: totalDistributedAmount,
          totalEmployees: employeePayouts.length,
          status: 'completed',
          createdAt: now.toDate(),
          updatedAt: now.toDate()
        };
        
        // 12. 建立批次寫入操作
        const batch = getDb().batch();
        
        // 寫入分紅快照
        batch.set(dividendSnapshotRef, dividendSnapshot);
        
        // 13. 為每位員工創建分紅記錄
        for (const payout of employeePayouts) {
          const payoutRef = dividendSnapshotRef.collection('equity_payouts').doc(payout.employeeId);
          batch.set(payoutRef, payout);
        }
        
        // 14. 提交批次寫入
        await batch.commit();
        console.log(`完成店鋪 ${storeId} 在 ${dividendPeriodId} 季度的分紅計算，總分配金額: ${totalDistributedAmount}`);

        // 15. 分紅支付處理 - 使用新的支付模塊
        try {
          // 獲取員工資訊以獲取支付方式資訊
          const payoutRequests = [];
          const employeesCollection = getDb().collection('employees');
          
          for (const payout of employeePayouts) {
            // 從員工文檔中讀取支付資訊
            const employeeDoc = await employeesCollection.doc(payout.employeeId).get();
            
            if (!employeeDoc.exists) {
              console.log(`找不到員工 ${payout.employeeId} 的資訊，跳過支付請求`);
              continue;
            }
            
            const employeeData = employeeDoc.data();
            
            // 檢查是否有 LINE Pay 用戶ID或銀行帳戶資訊
            // 注：此處假設員工文檔中有 linePayUserId 或 bankAccountInfo 字段
            let payoutMethod;
            let targetIdentifier;
            
            if (employeeData.linePayUserId) {
              payoutMethod = payments.PayoutMethod.LINE_PAY;
              targetIdentifier = employeeData.linePayUserId;
            } else if (employeeData.bankAccountInfo) {
              payoutMethod = payments.PayoutMethod.BANK_TRANSFER;
              targetIdentifier = employeeData.bankAccountInfo;
            } else {
              console.log(`員工 ${payout.employeeId} 沒有配置支付方式，跳過支付請求`);
              
              // 更新分紅狀態為失敗（無支付方式）
              await dividendSnapshotRef.collection('equity_payouts').doc(payout.employeeId).update({
                status: 'failed', 
                failureReason: '員工未配置支付方式',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              continue;
            }
            
            // 建立支付請求
            payoutRequests.push({
              amount: payout.dividendAmount,
              description: `${dividendPeriodId} 季度股權分紅`,
              method: payoutMethod,
              targetIdentifier: targetIdentifier,
              
              employeeId: payout.employeeId,
              tenantId: tenantId,
              referenceId: `${storeId}_${dividendPeriodId}/${payout.employeeId}`,  // 使用分紅記錄路徑作為參考ID
              referenceType: 'dividend',
              
              metadata: {
                storeId: storeId,
                period: dividendPeriodId,
                shares: payout.shares,
                sharePercentage: payout.sharePercentage
              }
            });
          }
          
          // 如果有支付請求，則處理批次支付
          if (payoutRequests.length > 0) {
            const payoutResult = await payments.processBatchPayout(payoutRequests);
            console.log(`成功創建批次支付，批次ID: ${payoutResult.batchId}，總記錄數: ${payoutResult.records.length}`);
          } else {
            console.log(`店鋪 ${storeId} 在 ${dividendPeriodId} 季度沒有有效的支付請求`);
          }
        } catch (paymentError) {
          console.error(`處理店鋪 ${storeId} 的分紅支付時發生錯誤:`, paymentError);
          // 在生產環境中，這裡可能需要添加錯誤報告和通知機制
        }
      }
    }
    
    console.log(`完成 ${dividendPeriodId} 季度的分紅計算任務`);
    return null;
  } catch (error) {
    console.error('執行分紅計算任務時發生錯誤:', error);
    throw error;
  }
});

/**
 * 計算兩個日期之間的月份差
 */
function calculateMonthsDifference(startDate: Date, endDate: Date): number {
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  const monthDiff = endDate.getMonth() - startDate.getMonth();
  return yearDiff * 12 + monthDiff;
}

/**
 * 獲取店鋪的利潤數據
 * 
 * 從 monthlyProfitReports 集合獲取店鋪的月度利潤數據
 */
async function fetchProfitData(storeId: string, operationMonths: number): Promise<{ 
  monthlyProfits: number[],
  totalProfit: number,
  avgProfit: number 
}> {
  try {
    console.log(`獲取店鋪 ${storeId} 的利潤數據，營運月數: ${operationMonths}`);
    
    if (operationMonths < 1) {
      console.log(`店鋪 ${storeId} 營運不足一個月，返回默認數據`);
      return {
        monthlyProfits: [0],
        totalProfit: 0,
        avgProfit: 0
      };
    }
    
    // 確定查詢月數，優先使用最近12個月，或實際營運月數
    const monthsToFetch = operationMonths >= 12 ? 12 : operationMonths;
    
    // 從 monthlyProfitReports 集合查詢數據
    const profitSnapshot = await getMonthlyProfitReportsCollection()
      .where('storeId', '==', storeId)
      .orderBy('reportDate', 'desc')
      .limit(monthsToFetch)
      .get();
    
    if (profitSnapshot.empty) {
      console.log(`沒有找到店鋪 ${storeId} 的月度利潤報告，返回安全默認值`);
      return {
        monthlyProfits: Array(Math.max(Math.min(operationMonths, 1), 1)).fill(0),
        totalProfit: 0,
        avgProfit: 0
      };
    }
    
    // 從報告中提取淨利數據
    const monthlyProfits = profitSnapshot.docs.map(doc => {
      const data = doc.data();
      return data.netProfitAfterTax || 0;
    });
    
    // 計算總利潤和平均利潤
    const totalProfit = monthlyProfits.reduce((sum, profit) => sum + profit, 0);
    const avgProfit = totalProfit / monthlyProfits.length;
    
    console.log(`成功獲取店鋪 ${storeId} 的利潤數據，獲取 ${monthlyProfits.length} 個月的報告，平均月淨利: ${avgProfit}`);
    
    return {
      monthlyProfits,
      totalProfit,
      avgProfit
    };
  } catch (error) {
    console.error(`獲取店鋪 ${storeId} 利潤數據時發生錯誤:`, error);
    
    // 出錯時返回安全的默認值
    return {
      monthlyProfits: [0],
      totalProfit: 0,
      avgProfit: 0
    };
  }
}

/**
 * 計算股權池的估值
 * 
 * 根據 10.4 節的規則：
 * - 超過12個月運營的店鋪：近12個月平均稅後淨利 × 4 ÷ 100
 * - 未滿12個月但至少3個月的店鋪：實際月份的平均稅後淨利 × 4 ÷ 100，並根據運營月數調整
 * - 波動限制：新估值相較上次估值的波動不超過 ±20%
 */
function calculateValuation(
  profitData: { monthlyProfits: number[], totalProfit: number, avgProfit: number },
  operationMonths: number,
  previousValuation: number
): number {
  // 1. 基礎估值計算
  let baseValuation = 0;
  
  if (operationMonths >= 12) {
    // 超過12個月：近12個月平均稅後淨利 × 4 ÷ 100
    baseValuation = profitData.avgProfit * 4;
  } else if (operationMonths >= 3) {
    // 3-11個月：實際月份的平均稅後淨利 × 4 ÷ 100，並根據營運月數進行調整
    // 根據 10.4 節的特殊算法（這裡是假設的算法，實際應參照報告）
    const adjustmentFactor = 0.7 + (operationMonths / 12) * 0.3; // 根據營運時長給予 70%-100% 的估值係數
    baseValuation = profitData.avgProfit * 4 * adjustmentFactor;
  } else {
    // 不足3個月：使用固定初始估值
    baseValuation = 10000 * 4; // 假設初始估值為4萬
  }
  
  // 2. 估值取整（向上取整到萬位）
  const roundedValuation = Math.ceil(baseValuation / 10000) * 10000;
  
  // 3. 波動限制處理（若有前次估值）
  if (previousValuation > 0) {
    const upperLimit = previousValuation * 1.2; // 上次估值的 120%
    const lowerLimit = previousValuation * 0.8; // 上次估值的 80%
    
    if (roundedValuation > upperLimit) {
      return upperLimit;
    } else if (roundedValuation < lowerLimit) {
      return lowerLimit;
    }
  }
  
  return roundedValuation;
}

/**
 * 獲取季度財務數據
 * 
 * 從 monthlyProfitReports 集合中獲取並計算季度財務數據
 */
async function fetchQuarterlyFinancialData(
  storeId: string, 
  year: number, 
  quarter: number
): Promise<{
  netProfitAfterTax: number,
  grossRevenue: number,
  totalExpenses: number
}> {
  try {
    console.log(`獲取店鋪 ${storeId} 第 ${year}Q${quarter} 季度財務數據`);
    
    // 計算季度對應的月份
    const startMonth = (quarter - 1) * 3 + 1; // 1, 4, 7, 10
    const endMonth = quarter * 3; // 3, 6, 9, 12
    
    // 查詢該季度的月度利潤報告
    const reportsSnapshot = await getMonthlyProfitReportsCollection()
      .where('storeId', '==', storeId)
      .where('year', '==', year)
      .where('month', '>=', startMonth)
      .where('month', '<=', endMonth)
      .get();
    
    // 初始化季度數據
    let quarterlyNetProfit = 0;
    let quarterlyRevenue = 0;
    let quarterlyExpenses = 0;
    
    // 累計所有月份的數據
    if (!reportsSnapshot.empty) {
      for (const doc of reportsSnapshot.docs) {
        const reportData = doc.data();
        quarterlyNetProfit += reportData.netProfitAfterTax || 0;
        quarterlyRevenue += reportData.totalSales || 0;
        
        // 計算總支出 = 銷貨成本 + 營運費用
        const expenses = (reportData.costOfGoodsSold || 0) + (reportData.operatingExpenses || 0);
        quarterlyExpenses += expenses;
      }
      
      console.log(`成功獲取店鋪 ${storeId} 第 ${year}Q${quarter} 季度財務數據，包含 ${reportsSnapshot.size} 個月度報告`);
      
      return {
        netProfitAfterTax: quarterlyNetProfit,
        grossRevenue: quarterlyRevenue,
        totalExpenses: quarterlyExpenses
      };
    }
    
    // 如果沒有月度數據，尝试檢查是否有直接的季度報告（如果有實現）
    console.log(`沒有找到店鋪 ${storeId} 第 ${year}Q${quarter} 季度的月度報告，檢查是否有季度報告`);
    
    // 這裡保留對 quarterlyFinancialReportsCollection 的檢查，作為後備方案
    const quarterlyId = `${year}Q${quarter}`;
    const financialReportDoc = await getQuarterlyFinancialReportsCollection()
      .doc(`${storeId}_${quarterlyId}`)
      .get();
    
    if (financialReportDoc.exists) {
      const data = financialReportDoc.data() || {};
      console.log(`找到店鋪 ${storeId} 第 ${year}Q${quarter} 季度的季度報告`);
      
      return {
        netProfitAfterTax: data.netProfitAfterTax || 0,
        grossRevenue: data.grossRevenue || 0,
        totalExpenses: data.totalExpenses || 0
      };
    }
    
    // 如果都沒有數據，則返回零值
    console.log(`沒有找到店鋪 ${storeId} 第 ${year}Q${quarter} 季度的任何財務數據，返回零值`);
    
    return {
      netProfitAfterTax: 0,
      grossRevenue: 0,
      totalExpenses: 0
    };
  } catch (error) {
    console.error(`獲取店鋪 ${storeId} 第 ${year}Q${quarter} 季度財務數據時發生錯誤:`, error);
    
    // 出錯時返回安全的默認值
    return {
      netProfitAfterTax: 0,
      grossRevenue: 0,
      totalExpenses: 0
    };
  }
}

/**
 * 處理員工股權分期付款的月度扣款
 * 每月執行一次，找出所有未完成的分期付款計畫並進行扣款處理
 */
export const processInstallmentDebit = onSchedule({
  schedule: '0 0 1 * *', // 每月1日 00:00 執行
  timeZone: 'Asia/Taipei',
  region: 'asia-east1'
}, async (event) => {
  try {
    console.log('開始執行股權分期付款扣款處理');
    
    // 1. 獲取所有有未完成分期付款的員工股權記錄
    const pendingInstallmentsSnapshot = await getEmployeeEquityCollection()
      .where('installments.remaining', '>', 0) // 剩餘分期數大於0
      .where('installments.active', '==', true) // 分期計畫為活躍狀態
      .get();
    
    if (pendingInstallmentsSnapshot.empty) {
      console.log('沒有找到需要處理的分期付款');
      return null;
    }
    
    console.log(`找到 ${pendingInstallmentsSnapshot.size} 個需要處理的分期付款`);
    
    // 2. 獲取當前時間
    const now = admin.firestore.Timestamp.now();
    const currentDate = now.toDate();
    const currentMonth = currentDate.getMonth() + 1; // 1-based月份
    const currentYear = currentDate.getFullYear();
    
    // 3. 批次處理所有扣款
    let processedCount = 0;
    let successCount = 0;
    
    // 無法使用批次處理因為需要與薪資系統交互
    for (const equityDoc of pendingInstallmentsSnapshot.docs) {
      const equityId = equityDoc.id;
      const equityData = equityDoc.data();
      const employeeId = equityData.employeeId;
      const storeId = equityData.storeId;
      const tenantId = equityData.tenantId;
      
      // 4. 獲取分期付款資訊
      const installments = equityData.installments || {};
      const installmentAmount = installments.monthlyAmount || 0;
      const remainingInstallments = installments.remaining || 0;
      const paidAmount = installments.paidAmount || 0;
      const totalAmount = installments.totalAmount || 0;
      
      if (installmentAmount <= 0 || remainingInstallments <= 0) {
        console.log(`股權記錄 ${equityId} 的分期付款資訊不完整，跳過處理`);
        continue;
      }
      
      // 5. 檢查是否已經完成該月的扣款
      const debitKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
      const debitHistory = installments.debitHistory || {};
      
      if (debitHistory[debitKey]) {
        console.log(`股權記錄 ${equityId} 在 ${debitKey} 已完成扣款，跳過處理`);
        continue;
      }
      
      processedCount++;
      
      try {
        // 6. 處理扣款 - 使用新的scheduleOneTimeDeduction函數
        const installmentPaymentDesc = `股權分期付款 (${processedCount}/${remainingInstallments})`;
        console.log(`正在為員工 ${employeeId} 安排薪資扣款: ${installmentAmount}，描述: ${installmentPaymentDesc}`);
        
        const deductionId = await scheduleOneTimeDeduction(
          employeeId,
          tenantId,
          installmentAmount,
          installmentPaymentDesc,
          {
            source: 'equity_installment',
            equityId: equityId,
            installmentNumber: processedCount,
            totalInstallments: remainingInstallments
          }
        );
        
        // 扣款成功，更新股權記錄
        if (deductionId) {
          // 7. 計算新的分期付款狀態
          const newRemainingInstallments = remainingInstallments - 1;
          const newPaidAmount = paidAmount + installmentAmount;
          
          // 判斷分期是否已完成
          const isCompleted = newRemainingInstallments <= 0;
          
          // 8. 更新分期付款歷史記錄
          debitHistory[debitKey] = {
            amount: installmentAmount,
            date: currentDate,
            method: 'payroll_deduction',
            status: 'pending',
            deductionId: deductionId
          };
          
          // 9. 構建更新對象
          const updateData: any = {
            'installments.remaining': newRemainingInstallments,
            'installments.paidAmount': newPaidAmount,
            'installments.debitHistory': debitHistory,
            'installments.lastDebitDate': currentDate,
            updatedAt: currentDate
          };
          
          // 如果分期已完成，更新分期狀態
          if (isCompleted) {
            updateData['installments.active'] = false;
            updateData['installments.completedAt'] = currentDate;
            
            // 根據實際業務邏輯，可能還需要更新股權狀態
            if (Math.abs(newPaidAmount - totalAmount) < 1) { // 考慮可能的小數點差異
              updateData['installments.status'] = 'completed';
            } else {
              updateData['installments.status'] = 'partial_completed';
            }
          }
          
          // 10. 更新股權記錄
          await getEmployeeEquityCollection().doc(equityId).update(updateData);
          
          console.log(`成功處理股權記錄 ${equityId} 的分期付款，剩餘期數: ${newRemainingInstallments}`);
          successCount++;
        } else {
          console.error(`股權記錄 ${equityId} 的薪資扣款失敗: 未獲得有效的扣款ID`);
          
          // 記錄扣款失敗
          debitHistory[debitKey] = {
            amount: installmentAmount,
            date: currentDate,
            method: 'payroll_deduction',
            status: 'failed',
            errorMessage: '未獲得有效的扣款ID'
          };
          
          // 更新失敗記錄
          await getEmployeeEquityCollection().doc(equityId).update({
            'installments.debitHistory': debitHistory,
            'installments.lastDebitAttempt': currentDate,
            updatedAt: currentDate
          });
        }
      } catch (error) {
        console.error(`處理股權記錄 ${equityId} 的分期付款時發生錯誤:`, error);
        
        // 記錄扣款失敗
        debitHistory[debitKey] = {
          amount: installmentAmount,
          date: currentDate,
          method: 'payroll_deduction',
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : '未知錯誤'
        };
        
        // 更新失敗記錄
        await getEmployeeEquityCollection().doc(equityId).update({
          'installments.debitHistory': debitHistory,
          'installments.lastDebitAttempt': currentDate,
          updatedAt: currentDate
        });
      }
    }
    
    console.log(`分期付款處理完成，總處理: ${processedCount}，成功: ${successCount}`);
    return null;
  } catch (error) {
    console.error('執行分期付款處理時發生錯誤:', error);
    throw error;
  }
}); 