import { expect } from 'chai';
import * as sinon from 'sinon';
import * as admin from 'firebase-admin';

// 初始化 Firebase Admin SDK (會自動連接到模擬器，如果設定了環境變數)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'friedg-dev' // 使用任意專案 ID，因為我們使用模擬器
  });
}

// 獲取 Firestore 實例
const db = admin.firestore();

// 導入被測試的模組
import { updateUncompensatedLosses } from '../../src/financial/services/lossTracking';

describe('財務模塊 - updateUncompensatedLosses (使用 Emulator)', () => {
  // 測試用數據
  const poolId = 'equity-pool-123';
  
  beforeEach(async () => {
    // 清除 Firestore 集合數據
    const collections = ['equity_pool'];
    await Promise.all(collections.map(async (collectionName) => {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      return batch.commit();
    }));
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  test('當季度淨利為負數時，應增加未彌補虧損', async () => {
    // 模擬當前未彌補虧損值
    const currentUncompensatedLosses = 1000;
    const quarterlyNetProfit = -500; // 季度虧損 500
    
    // 在 Firestore 中創建測試數據
    await db.collection('equity_pool').doc(poolId).set({
      uncompensatedLosses: currentUncompensatedLosses
    });
    
    // 執行函數
    const result = await updateUncompensatedLosses(poolId, quarterlyNetProfit);
    
    // 驗證返回值
    const expectedUncompensatedLosses = currentUncompensatedLosses + Math.abs(quarterlyNetProfit);
    expect(result).to.equal(expectedUncompensatedLosses);
    
    // 驗證文檔已更新
    const docSnapshot = await db.collection('equity_pool').doc(poolId).get();
    expect(docSnapshot.exists).to.be.true;
    
    const docData = docSnapshot.data();
    expect(docData).to.have.property('uncompensatedLosses', expectedUncompensatedLosses);
  });
  
  test('當季度淨利為正數且小於未彌補虧損時，應減少未彌補虧損', async () => {
    // 模擬當前未彌補虧損值
    const currentUncompensatedLosses = 1000;
    const quarterlyNetProfit = 300; // 季度盈利 300
    
    // 在 Firestore 中創建測試數據
    await db.collection('equity_pool').doc(poolId).set({
      uncompensatedLosses: currentUncompensatedLosses
    });
    
    // 執行函數
    const result = await updateUncompensatedLosses(poolId, quarterlyNetProfit);
    
    // 驗證返回值
    const expectedUncompensatedLosses = currentUncompensatedLosses - quarterlyNetProfit;
    expect(result).to.equal(expectedUncompensatedLosses);
    
    // 驗證文檔已更新
    const docSnapshot = await db.collection('equity_pool').doc(poolId).get();
    expect(docSnapshot.exists).to.be.true;
    
    const docData = docSnapshot.data();
    expect(docData).to.have.property('uncompensatedLosses', expectedUncompensatedLosses);
  });
  
  test('當季度淨利為正數且大於未彌補虧損時，未彌補虧損應變為零', async () => {
    // 模擬當前未彌補虧損值
    const currentUncompensatedLosses = 500;
    const quarterlyNetProfit = 800; // 季度盈利 800，超過未彌補虧損
    
    // 在 Firestore 中創建測試數據
    await db.collection('equity_pool').doc(poolId).set({
      uncompensatedLosses: currentUncompensatedLosses
    });
    
    // 執行函數
    const result = await updateUncompensatedLosses(poolId, quarterlyNetProfit);
    
    // 驗證返回值
    expect(result).to.equal(0);
    
    // 驗證文檔已更新
    const docSnapshot = await db.collection('equity_pool').doc(poolId).get();
    expect(docSnapshot.exists).to.be.true;
    
    const docData = docSnapshot.data();
    expect(docData).to.have.property('uncompensatedLosses', 0);
  });
  
  test('當季度淨利為零時，未彌補虧損應保持不變', async () => {
    // 模擬當前未彌補虧損值
    const currentUncompensatedLosses = 1000;
    const quarterlyNetProfit = 0; // 季度持平
    
    // 在 Firestore 中創建測試數據
    await db.collection('equity_pool').doc(poolId).set({
      uncompensatedLosses: currentUncompensatedLosses
    });
    
    // 執行函數
    const result = await updateUncompensatedLosses(poolId, quarterlyNetProfit);
    
    // 驗證返回值
    expect(result).to.equal(currentUncompensatedLosses);
    
    // 驗證文檔已更新
    const docSnapshot = await db.collection('equity_pool').doc(poolId).get();
    expect(docSnapshot.exists).to.be.true;
    
    const docData = docSnapshot.data();
    expect(docData).to.have.property('uncompensatedLosses', currentUncompensatedLosses);
  });
  
  test('當股權池不存在時，應拋出錯誤', async () => {
    // 不創建文檔，確保它不存在
    
    // 驗證函數拋出錯誤
    try {
      await updateUncompensatedLosses(poolId, 100);
      // 如果沒有拋出錯誤，則測試失敗
      expect.fail('預期應該拋出錯誤，但沒有');
    } catch (error: any) {
      expect(error.message).to.include(`股權池 ${poolId} 不存在`);
    }
    
    // 驗證文檔仍然不存在（沒有被創建）
    const docSnapshot = await db.collection('equity_pool').doc(poolId).get();
    expect(docSnapshot.exists).to.be.false;
  });
  
  test('當未彌補虧損欄位不存在時，應初始化為零並正確處理', async () => {
    // 創建一個沒有 uncompensatedLosses 欄位的文檔
    await db.collection('equity_pool').doc(poolId).set({
      // 不包含 uncompensatedLosses 欄位
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const quarterlyNetProfit = -500; // 季度虧損 500
    
    // 執行函數
    const result = await updateUncompensatedLosses(poolId, quarterlyNetProfit);
    
    // 驗證返回值：應從 0 開始累加虧損
    const expectedUncompensatedLosses = 0 + Math.abs(quarterlyNetProfit);
    expect(result).to.equal(expectedUncompensatedLosses);
    
    // 驗證文檔已更新
    const docSnapshot = await db.collection('equity_pool').doc(poolId).get();
    expect(docSnapshot.exists).to.be.true;
    
    const docData = docSnapshot.data();
    expect(docData).to.have.property('uncompensatedLosses', expectedUncompensatedLosses);
  });
}); 