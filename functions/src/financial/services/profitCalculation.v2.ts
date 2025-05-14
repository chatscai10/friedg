/**
 * 利潤計算服務 - Gen 2 版本
 * 使用 Firebase Functions v2 API
 */

import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { hasPermission, getUserInfoFromClaims } from '../../libs/rbac';

// 確保應用已初始化
try {
  admin.app();
} catch (error) {
  admin.initializeApp();
}

// 設定區域和其他配置
const region = 'asia-east1'; // 台灣區域
const runtimeOptions = {
  memory: '256MiB' as const,
  timeoutSeconds: 60
};

/**
 * 計算指定時間範圍內的月度利潤
 * @param tenantId 租戶ID
 * @param storeId 店鋪ID
 * @param startDate 開始日期
 * @param endDate 結束日期
 * @returns 利潤數據
 */
export async function calculateMonthlyProfit(
  tenantId: string,
  storeId: string,
  startDate: Date,
  endDate: Date
) {
  // 轉換日期為 Firestore 時間戳
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);

  // 獲取指定時間範圍內的訂單
  const ordersSnapshot = await admin.firestore()
    .collection('orders')
    .where('tenantId', '==', tenantId)
    .where('storeId', '==', storeId)
    .where('createdAt', '>=', startTimestamp)
    .where('createdAt', '<=', endTimestamp)
    .where('status', 'in', ['COMPLETED', 'DELIVERED'])
    .get();

  // 獲取指定時間範圍內的費用
  const expensesSnapshot = await admin.firestore()
    .collection('expenses')
    .where('tenantId', '==', tenantId)
    .where('storeId', '==', storeId)
    .where('date', '>=', startTimestamp)
    .where('date', '<=', endTimestamp)
    .get();

  // 計算總收入
  let totalRevenue = 0;
  ordersSnapshot.forEach(doc => {
    const order = doc.data();
    totalRevenue += order.totalAmount || 0;
  });

  // 計算總費用
  let totalExpenses = 0;
  const expensesByCategory: Record<string, number> = {};

  expensesSnapshot.forEach(doc => {
    const expense = doc.data();
    const amount = expense.amount || 0;
    totalExpenses += amount;

    // 按類別分類費用
    const category = expense.category || '其他';
    expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
  });

  // 計算毛利潤和淨利潤
  const grossProfit = totalRevenue - totalExpenses;
  const netProfit = grossProfit; // 簡化版本，實際可能需要考慮稅收等

  // 計算利潤率
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    revenue: totalRevenue,
    expenses: totalExpenses,
    expensesByCategory,
    grossProfit,
    netProfit,
    profitMargin,
    orderCount: ordersSnapshot.size,
    period: {
      startDate,
      endDate
    }
  };
}

/**
 * 手動計算月度利潤的可調用函數
 */
export const calculateProfitForPeriod = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能計算利潤');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { tenantId, storeId, startDate, endDate } = request.data;

    if (!tenantId) {
      throw new Error('租戶ID不能為空');
    }

    if (!storeId) {
      throw new Error('店鋪ID不能為空');
    }

    if (!startDate || !endDate) {
      throw new Error('開始日期和結束日期不能為空');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'financial' },
      { tenantId, storeId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限計算此店鋪的利潤');
    }

    // 計算利潤
    const profitData = await calculateMonthlyProfit(
      tenantId,
      storeId,
      new Date(startDate),
      new Date(endDate)
    );

    return profitData;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    throw new Error(`計算利潤失敗: ${errorMessage}`);
  }
});

/**
 * 獲取歷史利潤報告的可調用函數
 */
export const getProfitReports = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能獲取利潤報告');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { tenantId, storeId, year, month, limit = 12, page = 1 } = request.data;

    if (!tenantId) {
      throw new Error('租戶ID不能為空');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'financial' },
      { tenantId, storeId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限查看此租戶的利潤報告');
    }

    // 構建查詢
    let query = admin.firestore()
      .collection('tenants')
      .doc(tenantId)
      .collection('financialReports')
      .where('reportType', '==', 'monthly_profit')
      .orderBy('period.year', 'desc')
      .orderBy('period.month', 'desc');

    // 根據店鋪過濾
    if (storeId) {
      query = query.where('storeId', '==', storeId);
    }

    // 根據年份過濾
    if (year) {
      query = query.where('period.year', '==', year);

      // 根據月份過濾
      if (month) {
        query = query.where('period.month', '==', month);
      }
    }

    // 分頁處理
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);

    // 執行查詢
    const snapshot = await query.get();

    // 獲取總數
    const countQuery = admin.firestore()
      .collection('tenants')
      .doc(tenantId)
      .collection('financialReports')
      .where('reportType', '==', 'monthly_profit');

    if (storeId) {
      countQuery.where('storeId', '==', storeId);
    }

    if (year) {
      countQuery.where('period.year', '==', year);
      if (month) {
        countQuery.where('period.month', '==', month);
      }
    }

    const countSnapshot = await countQuery.count().get();
    const total = countSnapshot.data().count;

    // 格式化結果
    const reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      reports,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    throw new Error(`獲取利潤報告失敗: ${errorMessage}`);
  }
});
