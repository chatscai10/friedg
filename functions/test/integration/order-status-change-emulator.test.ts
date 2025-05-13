import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import { Transporter } from 'nodemailer';
import * as firebaseFunctions from '../../src/index';
import { before, after, beforeEach } from 'mocha';

// 引入通知類型
import { 
  NotificationChannelType, 
  NotificationEventType, 
  NotificationStatus 
} from '../../src/notifications/notification.types';

// 引入渠道類以便我們可以注入模擬
import SMSChannel from '../../src/notifications/channels/sms';
import EmailChannel from '../../src/notifications/channels/email';
import { AppPushChannel } from '../../src/notifications/channels/app-push';

// 初始化 Firebase 測試環境
const testEnv = functionsTest({
  projectId: 'test-project'
});

// 手動設置模擬器環境變數
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST = 'localhost:5001';

// 設置等待輔助函數用於輪詢 Firestore 變更
const waitForFirestoreUpdate = async (
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>,
  predicate: (docs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]) => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const snapshot = await query.get();
    const docs = snapshot.docs;
    
    if (predicate(docs)) {
      return docs;
    }
    
    // 等待指定的時間間隔再嘗試
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`等待 Firestore 更新超時: ${timeout}ms`);
};

describe('訂單狀態變更通知集成測試 (使用 Firebase Emulator)', () => {
  // 測試數據
  let testCustomerId: string;
  let testOrderId: string;
  let testStoreId: string;
  let testPhoneNumber: string = '+886912345678';
  let testEmail: string = 'test@example.com';
  let testDeviceToken: string = 'test-device-token';
  
  // 外部服務模擬
  let mockTwilioClient: any;
  let mockEmailTransporter: any;
  let mockFCMSend: sinon.SinonStub;
  
  // 數據庫參考
  let db: FirebaseFirestore.Firestore;
  
  // 在所有測試之前設置測試環境
  before(async function() {
    // 這個測試依賴於 Firebase Emulator 運行
    console.log('設置 Firebase Emulator 測試環境...');
    
    try {
      // 確保 admin 應用已初始化
      admin.app();
    } catch (error) {
      // 初始化 admin 指向模擬器
      admin.initializeApp({
        projectId: 'test-project'
      });
    }
    
    // 獲取 Firestore 實例
    db = admin.firestore();
    
    // 初始化測試數據
    testCustomerId = `customer-${uuidv4()}`;
    testOrderId = `order-${uuidv4()}`;
    testStoreId = `store-${uuidv4()}`;
    
    // 創建模擬外部服務
    mockTwilioClient = {
      messages: {
        create: sinon.stub().resolves({
          sid: 'mock-message-sid',
          status: 'sent'
        })
      }
    };
    
    mockEmailTransporter = {
      sendMail: sinon.stub().resolves({
        messageId: 'mock-email-id'
      }),
      options: {},
      meta: {},
      dkim: {},
      transporter: {},
      close: sinon.stub(),
      verify: sinon.stub()
    } as unknown as Transporter;
    
    mockFCMSend = sinon.stub().resolves({
      successCount: 1,
      failureCount: 0
    });
    
    // 通過依賴注入替換真實的外部服務客戶端
    injectMockServices();
    
    // 設置測試數據
    await setupTestData();
  });
  
  // 每個測試前重置模擬
  beforeEach(function() {
    sinon.resetHistory();
  });
  
  // 測試後清理
  after(async function() {
    // 清理測試數據
    await cleanupTestData();
    
    // 清理測試環境
    testEnv.cleanup();
    delete process.env.FIRESTORE_EMULATOR_HOST;
  });
  
  /**
   * 主測試：訂單狀態從 PENDING 到 CONFIRMED 的通知
   */
  it('當訂單狀態從 PENDING 更改為 CONFIRMED 時，應發送正確的通知', async function() {
    // 增加測試超時時間以確保有足夠時間等待異步事件處理
    this.timeout(10000);
    
    // 1. 通過 Admin SDK 將訂單狀態從 PENDING 更新為 CONFIRMED
    await db.collection('orders').doc(testOrderId).update({
      status: 'CONFIRMED',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`訂單狀態已更新：${testOrderId}`);
    
    // 2. 等待 Firestore 觸發器執行並創建通知日誌
    // 創建查詢來檢查通知日誌
    const notificationLogsQuery = db.collection('notificationLogs')
      .where('orderId', '==', testOrderId)
      .where('eventType', '==', NotificationEventType.ORDER_CONFIRMED);
    
    console.log('等待通知日誌創建...');
    
    // 等待至少兩個通知日誌創建 (SMS 和 Email)
    const notificationLogs = await waitForFirestoreUpdate(
      notificationLogsQuery,
      (docs) => docs.length >= 2,
      7000, // 7秒超時
      500   // 500ms 輪詢間隔
    );
    
    console.log(`找到 ${notificationLogs.length} 個通知日誌`);
    
    // 3. 驗證通知日誌創建
    expect(notificationLogs.length).to.be.at.least(2, '應至少創建 SMS 和 Email 通知日誌');
    
    // 驗證 SMS 通知日誌
    const smsLog = notificationLogs.find(log => log.data().channel === NotificationChannelType.SMS);
    expect(smsLog).to.exist;
    expect(smsLog?.data().eventType).to.equal(NotificationEventType.ORDER_CONFIRMED);
    expect(smsLog?.data().userId).to.equal(testCustomerId);
    expect(smsLog?.data().orderId).to.equal(testOrderId);
    
    // 驗證 Email 通知日誌
    const emailLog = notificationLogs.find(log => log.data().channel === NotificationChannelType.EMAIL);
    expect(emailLog).to.exist;
    expect(emailLog?.data().eventType).to.equal(NotificationEventType.ORDER_CONFIRMED);
    expect(emailLog?.data().userId).to.equal(testCustomerId);
    
    // 4. 驗證模擬服務被正確調用
    
    // 4.1 驗證發送 SMS 通知
    expect(mockTwilioClient.messages.create.called).to.be.true;
    const smsCallArgs = mockTwilioClient.messages.create.firstCall.args[0];
    expect(smsCallArgs.to).to.equal(testPhoneNumber);
    expect(smsCallArgs.body).to.include('已確認');
    
    // 4.2 驗證發送 Email 通知
    expect(mockEmailTransporter.sendMail.called).to.be.true;
    const emailCallArgs = mockEmailTransporter.sendMail.firstCall.args[0];
    expect(emailCallArgs.to).to.equal(testEmail);
    expect(emailCallArgs.subject).to.include('已確認');
    
    // 4.3 驗證 App Push 通知未發送 (根據用戶偏好設置)
    expect(mockFCMSend.called).to.be.false;
    
    // 4.4 模擬器環境下通知日誌更新可能需要延遲一段時間才能觀察到
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 檢查通知日誌的狀態更新
    for (const log of notificationLogs) {
      const updatedLog = await log.ref.get();
      const logData = updatedLog.data();
      
      if (logData) {
        expect([NotificationStatus.SENT, NotificationStatus.PENDING]).to.include(
          logData.status,
          '通知日誌應標記為已發送或待處理'
        );
      }
    }
  });
  
  /**
   * 輔助函數：設置測試數據
   */
  async function setupTestData() {
    console.log('設置測試數據...');
    const now = admin.firestore.Timestamp.now();
    
    // 1. 創建測試用戶
    await db.collection('users').doc(testCustomerId).set({
      id: testCustomerId,
      name: '測試用戶',
      phone: testPhoneNumber,
      email: testEmail,
      createdAt: now
    });
    
    // 2. 設置用戶通知偏好 (開啟 SMS 和 Email，關閉 App Push)
    await db.collection('users').doc(testCustomerId)
      .collection('settings').doc('notificationPreferences').set({
        userId: testCustomerId,
        channels: {
          appPush: false, // 禁用 App Push 通知
          sms: true,      // 啟用 SMS 通知
          email: true     // 啟用 Email 通知
        },
        orderUpdates: true,
        promotions: false,
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00'
        },
        updatedAt: now
      });
      
    // 3. 設置用戶設備令牌 (即使未啟用 App Push，也設置設備令牌以測試邏輯)
    await db.collection('users').doc(testCustomerId)
      .collection('devices').doc('device-1').set({
        token: testDeviceToken,
        platform: 'android',
        active: true,
        lastUsed: now
      });
      
    // 4. 創建測試訂單 (狀態為 PENDING)
    await db.collection('orders').doc(testOrderId).set({
      id: testOrderId,
      customerId: testCustomerId,
      storeId: testStoreId,
      status: 'PENDING',
      orderNumber: 'ORD-12345',
      storeName: '測試商店',
      estimatedPickupTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3600000)), // 1小時後
      createdAt: now,
      items: [
        { name: '測試商品', price: 100, quantity: 2 }
      ],
      totalAmount: 200
    });
    
    // 5. 設置通知模板
    
    // SMS模板
    await db.collection('notificationTemplates').doc('sms-order-confirmed').set({
      id: 'sms-order-confirmed',
      eventType: NotificationEventType.ORDER_CONFIRMED,
      channel: NotificationChannelType.SMS,
      language: 'zh-TW',
      title: '訂單已確認',
      content: '您好，您的訂單 #{orderNumber} 已被 {storeName} 確認，預計 {estimatedTime} 可取餐。',
      variables: ['orderNumber', 'storeName', 'estimatedTime'],
      active: true,
      createdAt: now,
      updatedAt: now
    });
    
    // Email模板
    await db.collection('notificationTemplates').doc('email-order-confirmed').set({
      id: 'email-order-confirmed',
      eventType: NotificationEventType.ORDER_CONFIRMED,
      channel: NotificationChannelType.EMAIL,
      language: 'zh-TW',
      title: '訂單已確認 - {storeName}',
      content: '<h1>訂單已確認</h1><p>您好，您的訂單 #{orderNumber} 已被 {storeName} 確認，預計 {estimatedTime} 可取餐。</p>',
      variables: ['orderNumber', 'storeName', 'estimatedTime'],
      active: true,
      createdAt: now,
      updatedAt: now
    });
    
    // App Push模板
    await db.collection('notificationTemplates').doc('app-push-order-confirmed').set({
      id: 'app-push-order-confirmed',
      eventType: NotificationEventType.ORDER_CONFIRMED,
      channel: NotificationChannelType.APP_PUSH,
      language: 'zh-TW',
      title: '訂單已確認',
      content: '您的訂單 #{orderNumber} 已被 {storeName} 確認',
      variables: ['orderNumber', 'storeName'],
      active: true,
      createdAt: now,
      updatedAt: now
    });
    
    console.log('測試數據設置完成');
  }
  
  /**
   * 輔助函數：清理測試數據
   */
  async function cleanupTestData() {
    console.log('清理測試數據...');
    
    // 清理所有可能的測試數據
    
    // 1. 清理通知日誌
    const notificationLogs = await db.collection('notificationLogs')
      .where('orderId', '==', testOrderId)
      .get();
      
    const deletePromises1 = notificationLogs.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises1);
    
    // 2. 刪除測試訂單
    await db.collection('orders').doc(testOrderId).delete();
    
    // 3. 刪除用戶設備令牌
    await db.collection('users').doc(testCustomerId)
      .collection('devices').doc('device-1').delete();
      
    // 4. 刪除用戶通知偏好
    await db.collection('users').doc(testCustomerId)
      .collection('settings').doc('notificationPreferences').delete();
      
    // 5. 刪除測試用戶
    await db.collection('users').doc(testCustomerId).delete();
    
    // 6. 其他可能的清理
    
    console.log('測試數據清理完成');
  }
  
  /**
   * 輔助函數：注入模擬服務
   */
  function injectMockServices() {
    console.log('注入模擬外部服務...');
    
    // 尋找並替換 NotificationService 中的外部服務客戶端
    // 由於 NotificationService 可能是單例，我們需要找到已經存在的實例並替換其依賴
    
    // 獲取並包裝雲函數
    const wrappedOrderStatusChangeHandler = testEnv.wrap(
      firebaseFunctions.orderStatusChangeHandler
    );
    
    // 使用 Prototype 修改 SMS 渠道
    const smsChannelProto = Object.getPrototypeOf(
      new SMSChannel(mockTwilioClient, '+15551234567')
    );
    
    // 修改 EmailChannel
    const emailChannelProto = Object.getPrototypeOf(
      new EmailChannel(mockEmailTransporter, 'noreply@test.com')
    );
    
    // 修改 AppPushChannel
    const appPushChannelProto = Object.getPrototypeOf(
      new AppPushChannel()
    );
    
    // 替換 sendSMS 方法
    if (smsChannelProto.send) {
      const originalSMSSend = smsChannelProto.send;
      smsChannelProto.send = async function(to: string, message: string) {
        console.log(`[模擬] 發送 SMS 到 ${to}: ${message}`);
        // 使用模擬的 Twilio 客戶端
        return mockTwilioClient.messages.create({
          to, 
          from: '+15551234567',
          body: message
        });
      };
    }
    
    // 替換 sendEmail 方法
    if (emailChannelProto.send) {
      const originalEmailSend = emailChannelProto.send;
      emailChannelProto.send = async function(to: string, subject: string, html: string) {
        console.log(`[模擬] 發送 Email 到 ${to}: ${subject}`);
        // 使用模擬的 Email Transporter
        return mockEmailTransporter.sendMail({
          to,
          from: 'noreply@test.com',
          subject,
          html
        });
      };
    }
    
    // 替換 sendToDevice 方法
    if (appPushChannelProto.sendToDevice) {
      const originalAppPushSend = appPushChannelProto.sendToDevice;
      appPushChannelProto.sendToDevice = async function(token: string, title: string, body: string, data?: any) {
        console.log(`[模擬] 發送 App Push 到 ${token}: ${title}`);
        // 使用模擬的 FCM 方法
        return mockFCMSend(token, {
          notification: { title, body },
          data
        });
      };
    }
    
    console.log('模擬服務注入完成');
  }
}); 