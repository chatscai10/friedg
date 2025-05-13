/**
 * 員工動態股權制度 - 索引文件
 * 導出所有股權相關函數
 */

// 確保初始化時使用共享的Firebase應用實例
import * as admin from 'firebase-admin';

// 避免多次初始化Firebase應用
// 這個條件檢查可確保在模組加載時不會有初始化問題
try {
  admin.app();
} catch (error) {
  // 如果沒有已初始化的應用實例，則在此處不初始化
  // 由主index.ts處理初始化
  console.log('Firebase應用尚未初始化，equity模組將使用主模組初始化的實例');
}

import { checkEquityEligibility } from './handlers';
import { openPurchaseWindow, closePurchaseWindow, revalueShares, autoDistributeDividends, processInstallmentDebit } from './schedule.handlers';

export {
  checkEquityEligibility,
  openPurchaseWindow,
  closePurchaseWindow,
  revalueShares,
  autoDistributeDividends,
  processInstallmentDebit
}; 