import { expect } from 'chai';
import * as sinon from 'sinon';
import { DateTime } from 'luxon';
import * as admin from 'firebase-admin';
import { ReportStatus } from '../../src/financial/types';

// 初始化 Firebase Admin SDK (會自動連接到模擬器，如果設定了環境變數)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'friedg-dev' // 使用任意專案 ID，因為我們使用模擬器
  });
}

// 獲取 Firestore 實例
const db = admin.firestore();

// Mock orderService (只模擬與外部系統的互動)
jest.mock('../../src/orders/services/orderService', () => ({
  getOrderStats: jest.fn()
}));

// 導入被測試的模組
import { calculateMonthlyProfit } from '../../src/financial/services/profitCalculation';
import { getOrderStats } from '../../src/orders/services/orderService';

describe('財務模塊 - calculateMonthlyProfit (使用 Emulator)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // 清除 Firestore 集合數據
    const collections = ['stores', 'monthlyProfitReports'];
    await Promise.all(collections.map(async (collectionName) => {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      return batch.commit();
    }));
    
    // 準備測試所需的 store 數據
    await db.collection('stores').doc('store-123').set({
      id: 'store-123',
      name: '測試店鋪',
      tenantId: 'tenant-123'
    });
    
    // 模擬 getOrderStats 返回值
    (getOrderStats as jest.Mock).mockResolvedValue({
      totalSales: 10000,
      orderCount: 100,
      averageOrderValue: 100
    });
  });
  
  afterEach(async () => {
    sinon.restore();
  });

  test('應該正確計算稅後淨利並儲存報告', async () => {
    const storeId = 'store-123';
    const year = 2025;
    const month = 4;

    // 執行函數
    const result = await calculateMonthlyProfit(storeId, year, month);

    // 驗證 getOrderStats 被正確調用
    expect((getOrderStats as jest.Mock).mock.calls.length).to.be.at.least(1);
    
    // 驗證調用參數
    const callArgs = (getOrderStats as jest.Mock).mock.calls[0];
    expect(callArgs[0]).to.equal(storeId);
    
    // 後兩個參數是日期，需要更寬鬆的驗證
    expect(callArgs[1]).to.be.an.instanceOf(Date);
    expect(callArgs[2]).to.be.an.instanceOf(Date);
    expect(callArgs[3]).to.equal('month');

    // 驗證淨利計算邏輯
    const expectedSales = 10000;
    const expectedCOGS = expectedSales * 0.5;
    const expectedExpenses = expectedSales * 0.3;
    const expectedProfitBeforeTax = expectedSales - expectedCOGS - expectedExpenses;
    const expectedTax = expectedProfitBeforeTax * 0.2;
    const expectedNetProfit = expectedProfitBeforeTax - expectedTax;

    expect(result).to.equal(expectedNetProfit);
    
    // 驗證報告數據已儲存到 Firestore
    const docId = `${storeId}_${year}04`;
    const reportDoc = await db.collection('monthlyProfitReports').doc(docId).get();
    
    expect(reportDoc.exists).to.be.true;
    
    const reportData = reportDoc.data();
    expect(reportData).to.include({
      storeId,
      year,
      month,
      totalSales: expectedSales,
      costOfGoodsSold: expectedCOGS,
      costCalculationMethod: 'estimated',
      operatingExpenses: expectedExpenses,
      profitBeforeTax: expectedProfitBeforeTax,
      tax: expectedTax,
      netProfitAfterTax: expectedNetProfit,
      status: ReportStatus.DRAFT
    });
  });
}); 