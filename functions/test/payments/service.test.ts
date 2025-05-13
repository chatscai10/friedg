import { expect } from 'chai';
import * as sinon from 'sinon';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { 
  PayoutRequest, 
  PayoutRecord, 
  PayoutStatus,
  PayoutMethod 
} from '../../src/payments/types';

// 初始化 Firebase Admin SDK (會自動連接到模擬器，如果設定了環境變數)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'friedg-dev' // 使用任意專案 ID，因為我們使用模擬器
  });
}

// 獲取 Firestore 實例
const db = admin.firestore();

// 創建一個 mock 函數，用於模擬 scheduleBatchPayoutProcessing
const mockScheduleBatchPayoutProcessing = jest.fn().mockResolvedValue(undefined);

// 使用 Jest 的模組模擬
jest.mock('../../src/payments/service', () => {
  // 首先獲取原始模組
  const originalModule = jest.requireActual('../../src/payments/service');
  
  // 返回一個物件，其中包含我們想要 mock 的函數
  return {
    ...originalModule,
    scheduleBatchPayoutProcessing: mockScheduleBatchPayoutProcessing
  };
});

// 導入被測試的模組（這裡進行導入的時候，會使用上面的 mock）
import * as paymentService from '../../src/payments/service';

// 為了避免循環依賴，我們需要 mock LINE Pay 處理函數
jest.mock('../../src/payments/providers/linepay', () => ({
  processLinePayPayout: jest.fn().mockResolvedValue(true)
}));

describe('支付模組 - service (使用 Emulator)', () => {
  // 清理 Firestore 中的資料
  beforeEach(async () => {
    // 清除 payouts 集合
    const collectionsToClean = ['payouts', 'dividend_snapshots'];
    await Promise.all(collectionsToClean.map(async (collectionName) => {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      return batch.commit();
    }));

    // 在每次測試前清除所有 mock 的呼叫記錄
    jest.clearAllMocks();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('processBatchPayout', () => {
    test('應該成功處理批次支付請求並創建記錄', async () => {
      // 建立假的支付請求
      const payoutRequests: PayoutRequest[] = [
        {
          amount: 1000,
          description: '測試支付 1',
          method: PayoutMethod.LINE_PAY,
          targetIdentifier: 'line_user_123',
          employeeId: 'emp-001',
          tenantId: 'tenant-001',
          referenceId: 'snapshot-001/payout-001',
          referenceType: 'dividend'
        },
        {
          amount: 2000,
          description: '測試支付 2',
          method: PayoutMethod.BANK_TRANSFER,
          targetIdentifier: '1234567890',
          employeeId: 'emp-002',
          tenantId: 'tenant-001',
          referenceId: 'snapshot-001/payout-002',
          referenceType: 'dividend'
        }
      ];

      // 執行函數
      const result = await paymentService.processBatchPayout(payoutRequests);

      // 驗證返回結果
      expect(result).to.have.property('batchId').and.to.be.a('string');
      expect(result).to.have.property('records').and.to.be.an('array');
      expect(result.records).to.have.lengthOf(2);

      // 驗證批次處理函數被呼叫
      expect(mockScheduleBatchPayoutProcessing.mock.calls.length).to.equal(1);
      expect(mockScheduleBatchPayoutProcessing.mock.calls[0][0]).to.equal(result.batchId);

      // 驗證記錄已存在於 Firestore
      const payoutsSnapshot = await db.collection('payouts').get();
      expect(payoutsSnapshot.docs).to.have.lengthOf(2);

      // 驗證記錄內容
      for (let i = 0; i < payoutsSnapshot.docs.length; i++) {
        const doc = payoutsSnapshot.docs[i];
        const data = doc.data() as PayoutRecord;

        expect(data).to.have.property('status', PayoutStatus.PENDING);
        expect(data).to.have.property('batchId', result.batchId);
        
        // 匹配請求中的內容
        const matchingRequest = payoutRequests.find(req => 
          req.amount === data.amount && 
          req.description === data.description
        );
        
        expect(matchingRequest).to.not.be.undefined;
        
        if (matchingRequest) {
          expect(data.method).to.equal(matchingRequest.method);
          expect(data.targetIdentifier).to.equal(matchingRequest.targetIdentifier);
          expect(data.employeeId).to.equal(matchingRequest.employeeId);
          expect(data.referenceId).to.equal(matchingRequest.referenceId);
          expect(data.referenceType).to.equal(matchingRequest.referenceType);
        }
        
        // 驗證狀態歷史
        expect(data.statusHistory).to.be.an('array').and.to.have.lengthOf(1);
        expect(data.statusHistory[0].status).to.equal(PayoutStatus.PENDING);
        expect(data.statusHistory[0].note).to.include('初始化支付請求');
      }
    });

    test('應該在請求陣列為空時拋出錯誤', async () => {
      // 測試空陣列
      try {
        await paymentService.processBatchPayout([]);
        expect.fail('應該拋出錯誤');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('支付請求不能為空');
      }

      // 測試 null/undefined
      try {
        await paymentService.processBatchPayout(null as any);
        expect.fail('應該拋出錯誤');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('支付請求不能為空');
      }
    });
  });

  describe('scheduleBatchPayoutProcessing', () => {
    test('當批次中有 PENDING 支付記錄時，應正確更新狀態為 PROCESSING', async () => {
      // 使用 sandbox 來管理 stubs
      const sandbox = sinon.createSandbox();
      
      try {
        // 準備測試數據 - 建立批次和支付記錄
        const batchId = uuidv4();
        const payoutRecords: Partial<PayoutRecord>[] = [
          {
            id: uuidv4(),
            batchId,
            status: PayoutStatus.PENDING,
            method: PayoutMethod.LINE_PAY,
            amount: 1000,
            description: '測試支付 1',
            targetIdentifier: 'line_user_123',
            employeeId: 'emp-001',
            tenantId: 'tenant-001',
            referenceId: 'snapshot-001/payout-001',
            referenceType: 'dividend',
            statusHistory: [
              {
                status: PayoutStatus.PENDING,
                timestamp: new Date(),
                note: '初始化支付請求'
              }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: uuidv4(),
            batchId,
            status: PayoutStatus.PENDING,
            method: PayoutMethod.BANK_TRANSFER,
            amount: 2000,
            description: '測試支付 2',
            targetIdentifier: '1234567890',
            employeeId: 'emp-002',
            tenantId: 'tenant-001',
            referenceId: 'snapshot-001/payout-002',
            referenceType: 'dividend',
            statusHistory: [
              {
                status: PayoutStatus.PENDING,
                timestamp: new Date(),
                note: '初始化支付請求'
              }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        // 寫入支付記錄到 Firestore
        const batch = db.batch();
        for (const record of payoutRecords) {
          const docRef = db.collection('payouts').doc(record.id!);
          batch.set(docRef, record);
        }
        await batch.commit();

        // 替換或 stub updatePayoutStatus 方法
        const updateStatusStub = sandbox.stub(paymentService, 'updatePayoutStatus').resolves();
        
        // 替換 import 語句，避免實際導入 linepay 模組
        const importOriginal = (global as any).import;
        (global as any).import = sandbox.stub().resolves({
          processLinePayPayout: sandbox.stub().resolves(true)
        });

        // 執行函數 - 使用原始的 scheduleBatchPayoutProcessing 函數
        await paymentService.scheduleBatchPayoutProcessing(batchId);

        // 查詢已更新的記錄
        const processingRecordsSnapshot = await db.collection('payouts')
          .where('batchId', '==', batchId)
          .where('status', '==', PayoutStatus.PROCESSING)
          .get();

        // 驗證有記錄被更新
        expect(processingRecordsSnapshot.docs.length).to.be.greaterThan(0);

        // 檢查每個記錄的狀態和更新欄位
        for (const doc of processingRecordsSnapshot.docs) {
          const data = doc.data();
          expect(data.status).to.equal(PayoutStatus.PROCESSING);
          expect(data).to.have.property('processingTime');
          
          // 驗證狀態歷史已更新
          expect(data.statusHistory).to.be.an('array');
          expect(data.statusHistory.length).to.be.greaterThan(1);
          
          // 查找 PROCESSING 狀態的歷史記錄
          const processingHistory = data.statusHistory.find(
            (h: any) => h.status === PayoutStatus.PROCESSING
          );
          expect(processingHistory).to.exist;
          expect(processingHistory.note).to.include('開始處理支付');
        }
      } finally {
        // 恢復所有 sandbox stubs
        sandbox.restore();
      }
    });

    test('當批次中沒有 PENDING 支付記錄時，應不做任何更改', async () => {
      // 準備測試數據 - 建立一個不存在待處理記錄的批次
      const batchId = uuidv4();
      
      // 執行函數
      await paymentService.scheduleBatchPayoutProcessing(batchId);

      // 查詢記錄，應該沒有任何更改
      const processingRecordsSnapshot = await db.collection('payouts')
        .where('batchId', '==', batchId)
        .get();

      // 驗證沒有記錄被更新
      expect(processingRecordsSnapshot.docs).to.have.lengthOf(0);
    });
  });

  describe('updatePayoutStatus', () => {
    test('應該正確更新支付記錄的狀態', async () => {
      // 準備測試數據 - 建立一個支付記錄
      const payoutId = uuidv4();
      const createdAt = new Date();
      const updatedAt = new Date();
      const payoutRecord: Partial<PayoutRecord> = {
        id: payoutId,
        status: PayoutStatus.PENDING,
        method: PayoutMethod.LINE_PAY,
        amount: 1000,
        description: '測試支付',
        targetIdentifier: 'line_user_123',
        employeeId: 'emp-001',
        tenantId: 'tenant-001',
        referenceId: 'snapshot-001/payout-001',
        referenceType: 'dividend',
        batchId: uuidv4(),
        statusHistory: [
          {
            status: PayoutStatus.PENDING,
            timestamp: createdAt,
            note: '初始化支付請求'
          }
        ],
        createdAt: createdAt,
        updatedAt: updatedAt
      };

      // 寫入支付記錄到 Firestore
      await db.collection('payouts').doc(payoutId).set(payoutRecord);

      // 定義新狀態和附加欄位
      const newStatus = PayoutStatus.COMPLETED;
      const note = '支付成功測試';
      const additionalFields = {
        providerPayoutId: 'test-provider-id',
        completionTime: new Date()
      };

      // 執行函數 - 使用 ID 字符串
      await paymentService.updatePayoutStatus(payoutId, newStatus, note, additionalFields);

      // 獲取更新後的記錄
      const updatedDoc = await db.collection('payouts').doc(payoutId).get();
      const updatedData = updatedDoc.data() as PayoutRecord;

      // 驗證記錄已更新
      expect(updatedData.status).to.equal(newStatus);
      expect(updatedData.providerPayoutId).to.equal(additionalFields.providerPayoutId);
      expect(updatedData.completionTime).to.exist;
      
      // 驗證狀態歷史已更新
      expect(updatedData.statusHistory).to.be.an('array').with.lengthOf(2);
      expect(updatedData.statusHistory[1].status).to.equal(newStatus);
      expect(updatedData.statusHistory[1].note).to.equal(note);
      
      // 驗證 updatedAt 欄位已更新
      const oldUpdatedAtTime = updatedAt.getTime();
      // 當 Firestore 返回 Timestamp 時，我們需要轉換為 Date
      const newUpdatedAt = updatedData.updatedAt instanceof admin.firestore.Timestamp 
        ? updatedData.updatedAt.toDate() 
        : updatedData.updatedAt;
      
      expect(newUpdatedAt.getTime()).to.be.greaterThan(oldUpdatedAtTime);
    });

    test('應該處理傳入 PayoutRecord 物件而非 ID 字符串的情況', async () => {
      // 準備測試數據 - 建立一個支付記錄
      const payoutId = uuidv4();
      const createdAt = new Date();
      const updatedAt = new Date();
      const payoutRecord: PayoutRecord = {
        id: payoutId,
        status: PayoutStatus.PENDING,
        method: PayoutMethod.LINE_PAY,
        amount: 1000,
        description: '測試支付',
        targetIdentifier: 'line_user_123',
        employeeId: 'emp-001',
        tenantId: 'tenant-001',
        referenceId: 'snapshot-001/payout-001',
        referenceType: 'dividend',
        batchId: uuidv4(),
        statusHistory: [
          {
            status: PayoutStatus.PENDING,
            timestamp: createdAt,
            note: '初始化支付請求'
          }
        ],
        createdAt: createdAt,
        updatedAt: updatedAt,
        metadata: {}
      };

      // 寫入支付記錄到 Firestore
      await db.collection('payouts').doc(payoutId).set(payoutRecord);

      // 執行函數 - 傳入整個記錄物件
      await paymentService.updatePayoutStatus(payoutRecord, PayoutStatus.FAILED, '測試失敗', { failureReason: '測試原因' });

      // 獲取更新後的記錄
      const updatedDoc = await db.collection('payouts').doc(payoutId).get();
      const updatedData = updatedDoc.data() as PayoutRecord;

      // 驗證記錄已更新
      expect(updatedData.status).to.equal(PayoutStatus.FAILED);
      expect(updatedData.failureReason).to.equal('測試原因');
      
      // 驗證狀態歷史已更新
      expect(updatedData.statusHistory).to.be.an('array').with.lengthOf(2);
      expect(updatedData.statusHistory[1].status).to.equal(PayoutStatus.FAILED);
      expect(updatedData.statusHistory[1].note).to.equal('測試失敗');
    });
  });

  describe('updateOriginalRecordStatus', () => {
    test('對於分紅記錄(dividend)，應該正確更新原始記錄的狀態', async () => {
      // 準備測試數據
      const employeeId = 'emp-001';
      const snapshotId = 'snapshot-001';
      const payoutId = uuidv4();
      
      // 建立支付記錄
      const payoutRecord: PayoutRecord = {
        id: payoutId,
        status: PayoutStatus.COMPLETED,
        method: PayoutMethod.LINE_PAY,
        amount: 1000,
        description: '測試支付',
        targetIdentifier: 'line_user_123',
        employeeId: employeeId,
        tenantId: 'tenant-001',
        referenceId: `${snapshotId}/payout-001`,
        referenceType: 'dividend',
        batchId: uuidv4(),
        statusHistory: [
          {
            status: PayoutStatus.PENDING,
            timestamp: new Date(),
            note: '初始化支付請求'
          },
          {
            status: PayoutStatus.COMPLETED,
            timestamp: new Date(),
            note: '支付完成'
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      };

      // 建立原始的分紅記錄
      const originalRecordPath = `dividend_snapshots/${snapshotId}/equity_payouts/${employeeId}`;
      const originalRecord = {
        employeeId: employeeId,
        amount: 1000,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 寫入原始記錄到 Firestore
      await db.doc(originalRecordPath).set(originalRecord);

      // 執行函數
      await paymentService.updateOriginalRecordStatus(payoutRecord, 'completed');

      // 獲取更新後的原始記錄
      const updatedOriginalDoc = await db.doc(originalRecordPath).get();
      const updatedOriginalData = updatedOriginalDoc.data();

      // 驗證原始記錄已更新
      expect(updatedOriginalData).to.exist;
      expect(updatedOriginalData!.status).to.equal('completed');
      expect(updatedOriginalData!.payoutId).to.equal(payoutId);
      expect(updatedOriginalData!.payoutStatus).to.equal('completed');
      
      // 驗證 updatedAt 已更新
      expect(updatedOriginalData!.updatedAt).to.exist;
      
      // 由於 Firestore 返回的時間可能是 Timestamp 物件，需要轉換
      const updatedAt = updatedOriginalData!.updatedAt instanceof admin.firestore.Timestamp
        ? updatedOriginalData!.updatedAt.toDate()
        : updatedOriginalData!.updatedAt;
        
      expect(updatedAt.getTime()).to.be.greaterThan(
        originalRecord.updatedAt.getTime()
      );
    });

    test('當找不到參考類型的路徑時，應該不拋出錯誤', async () => {
      // 準備一個有未知參考類型的支付記錄
      const payoutRecord: PayoutRecord = {
        id: uuidv4(),
        status: PayoutStatus.COMPLETED,
        method: PayoutMethod.LINE_PAY,
        amount: 1000,
        description: '測試支付',
        targetIdentifier: 'line_user_123',
        employeeId: 'emp-001',
        tenantId: 'tenant-001',
        referenceId: 'unknown-ref',
        referenceType: 'unknown-type', // 未知參考類型
        batchId: uuidv4(),
        statusHistory: [
          {
            status: PayoutStatus.COMPLETED,
            timestamp: new Date(),
            note: '支付完成'
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {}
      };

      // 執行函數，不應拋出錯誤
      try {
        await paymentService.updateOriginalRecordStatus(payoutRecord, 'completed');
        // 如果執行到這裡，表示沒有拋出錯誤
        expect(true).to.be.true;
      } catch (error) {
        // 如果拋出錯誤，測試失敗
        expect.fail('不應拋出錯誤');
      }
    });
  });
}); 