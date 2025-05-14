/**
 * 股權模塊處理程序 - Gen 2 版本
 * 使用 Firebase Functions v2 API
 */

import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  calculateEquityDistribution,
  getEquityHolders,
  updateEquityRecord,
  getEquityTransactions,
  validateEquityTransfer
} from './services';
import { hasPermission, getUserInfoFromClaims } from '../libs/rbac';

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
 * 獲取股權持有者列表
 */
export const getHolders = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能獲取股權持有者列表');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { tenantId } = request.data;

    if (!tenantId) {
      throw new Error('租戶ID不能為空');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'equity' },
      { tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限查看股權持有者列表');
    }

    // 獲取股權持有者列表
    const holders = await getEquityHolders(tenantId);

    return holders;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    throw new Error(`獲取股權持有者列表失敗: ${errorMessage}`);
  }
});

/**
 * 計算股權分配
 */
export const calculateDistribution = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能計算股權分配');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { tenantId, date } = request.data;

    if (!tenantId) {
      throw new Error('租戶ID不能為空');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'equity' },
      { tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限計算股權分配');
    }

    // 計算股權分配
    const distribution = await calculateEquityDistribution(
      tenantId,
      date ? new Date(date) : new Date()
    );

    return distribution;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    throw new Error(`計算股權分配失敗: ${errorMessage}`);
  }
});

/**
 * 更新股權記錄
 */
export const updateEquity = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能更新股權記錄');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { tenantId, holderId, shares, transactionType, notes } = request.data;

    if (!tenantId) {
      throw new Error('租戶ID不能為空');
    }

    if (!holderId) {
      throw new Error('持有者ID不能為空');
    }

    if (typeof shares !== 'number' || shares <= 0) {
      throw new Error('股份數量必須是大於零的數字');
    }

    if (!transactionType || !['issue', 'transfer', 'buyback'].includes(transactionType)) {
      throw new Error('無效的交易類型');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'update', resource: 'equity' },
      { tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限更新股權記錄');
    }

    // 更新股權記錄
    const result = await updateEquityRecord(
      tenantId,
      holderId,
      shares,
      transactionType,
      userInfo.uid,
      notes
    );

    return result;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    throw new Error(`更新股權記錄失敗: ${errorMessage}`);
  }
});

/**
 * 獲取股權交易歷史
 */
export const getTransactions = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能獲取股權交易歷史');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { tenantId, holderId, limit, page } = request.data;

    if (!tenantId) {
      throw new Error('租戶ID不能為空');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'equity' },
      { tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限獲取股權交易歷史');
    }

    // 獲取股權交易歷史
    const transactions = await getEquityTransactions(
      tenantId,
      holderId,
      limit || 20,
      page || 1
    );

    return transactions;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    throw new Error(`獲取股權交易歷史失敗: ${errorMessage}`);
  }
});

/**
 * 驗證股權轉讓
 */
export const validateTransfer = onCall({ region, ...runtimeOptions }, async (request) => {
  // 驗證用戶是否已登入
  if (!request.auth) {
    throw new Error('需要登入才能驗證股權轉讓');
  }

  // 獲取用戶資訊
  const userInfo = await getUserInfoFromClaims(request.auth.token);

  if (!userInfo) {
    throw new Error('無法獲取用戶權限資訊');
  }

  try {
    const { tenantId, fromHolderId, toHolderId, shares } = request.data;

    if (!tenantId) {
      throw new Error('租戶ID不能為空');
    }

    if (!fromHolderId) {
      throw new Error('轉讓方ID不能為空');
    }

    if (!toHolderId) {
      throw new Error('受讓方ID不能為空');
    }

    if (typeof shares !== 'number' || shares <= 0) {
      throw new Error('股份數量必須是大於零的數字');
    }

    // 權限檢查
    const permissionResult = await hasPermission(
      userInfo,
      { action: 'read', resource: 'equity' },
      { tenantId }
    );

    if (!permissionResult.granted) {
      throw new Error(permissionResult.reason || '您沒有權限驗證股權轉讓');
    }

    // 驗證股權轉讓
    const validationResult = await validateEquityTransfer(
      tenantId,
      fromHolderId,
      toHolderId,
      shares
    );

    return validationResult;
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    throw new Error(`驗證股權轉讓失敗: ${errorMessage}`);
  }
});
