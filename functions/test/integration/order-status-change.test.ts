import * as admin from 'firebase-admin';
import * as functionsTest from 'firebase-functions-test';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase-admin/firestore';
import { Transporter } from 'nodemailer';

// 引入所需的服務和類型
import { NotificationService } from '../../src/notifications/notification.service';
import { orderStatusChangeHandler } from '../../src/notifications/index';
import { 
  NotificationChannelType, 
  NotificationEventType, 
  NotificationStatus 
} from '../../src/notifications/notification.types';

// 引入渠道模擬
import SMSChannel from '../../src/notifications/channels/sms';
import EmailChannel from '../../src/notifications/channels/email';
import { AppPushChannel } from '../../src/notifications/channels/app-push';

// 初始化測試環境
const testEnv = functionsTest();
const projectId = 'test-project';

// 創建模擬外部服務
const mockTwilioClient = {
  messages: {
    create: sinon.stub().resolves({
      sid: 'mock-message-sid',
      status: 'sent'
    })
  }
};

// 創建模擬的 Nodemailer Transporter
const mockEmailTransporter = {
  sendMail: sinon.stub().resolves({
    messageId: 'mock-email-id'
  }),
  // 添加 Transporter 接口所需的其他屬性
  options: {},
  meta: {},
  dkim: {},
  transporter: {},
  close: sinon.stub(),
  verify: sinon.stub()
} as unknown as Transporter;

const mockFCMSend = sinon.stub().resolves({
  successCount: 1,
  failureCount: 0
});

describe('訂單狀態變更通知集成測試', () => {
  // 測試數據
  let testCustomerId: string;
  let testOrderId: string;
  let testStoreId: string;
  let testPhoneNumber: string = '+886912345678';
  let testEmail: string = 'test@example.com';
  let testDeviceToken: string = 'test-device-token';
  let mockFirestore: any;
  let mockDb: any;
  let notificationService: NotificationService;
  
  // 模擬集合和文檔引用
  let mockOrdersRef: any;
  let mockUsersRef: any;
  let mockNotificationLogsRef: any;
  let mockNotificationTemplatesRef: any;
  
  // 模擬查詢結果
  let mockOrderDoc: any;
  let mockUserDoc: any;
  let mockUserSettingsDoc: any;
  let mockUserDevicesCollection: any;
  let mockTemplatesCollection: any;
  
  // Firestore 文檔的模擬數據容器
  const mockDocData: Record<string, any> = {};
  const mockCollectionData: Record<string, Record<string, any>> = {};
  
  before(function() {
    // 在沒有啟動模擬器的情況下，我們使用完全模擬的 Firestore 和外部服務
    // 初始化數據
    testCustomerId = `customer-${uuidv4()}`;
    testOrderId = `order-${uuidv4()}`;
    testStoreId = `store-${uuidv4()}`;
    
    // 設置測試數據
    setupTestData();
    
    // 初始化模擬 Firestore
    setupMockFirestore();
    
    // 注入模擬 Firestore 到通知服務
    notificationService = setupNotificationService();
  });

  beforeEach(function() {
    // 每個測試前重置所有存根
    sinon.resetHistory();
  });

  after(function() {
    // 清理測試環境
    testEnv.cleanup();
  });

  /**
   * 主測試：訂單狀態從 PENDING 到 CONFIRMED 的通知
   */
  it('當訂單狀態從 PENDING 更改為 CONFIRMED 時，應發送正確的通知', async function() {
    // 1. 模擬訂單狀態變更事件
    const beforeSnapshot = {
      data: () => ({ 
        ...mockDocData[`orders/${testOrderId}`],
        status: 'PENDING'
      })
    };
    
    const afterSnapshot = {
      data: () => ({ 
        ...mockDocData[`orders/${testOrderId}`],
        status: 'CONFIRMED'
      })
    };

    const change = {
      before: beforeSnapshot,
      after: afterSnapshot
    };

    const context = {
      params: {
        orderId: testOrderId
      }
    };

    // 2. 觸發訂單狀態變更處理函數
    // 由於我們已經注入了模擬，所以直接調用通知服務的方法
    await notificationService.sendOrderStatusNotification(
      testOrderId,
      'PENDING',
      'CONFIRMED'
    );

    // 3. 等待異步操作完成（實際環境中可能需要適當的等待策略）
    await new Promise(resolve => setTimeout(resolve, 100));

    // 4. 驗證結果
    
    // 4.1 驗證發送的 SMS 通知
    expect(mockTwilioClient.messages.create.called).to.be.true;
    const smsCallArgs = mockTwilioClient.messages.create.firstCall.args[0];
    expect(smsCallArgs.to).to.equal(testPhoneNumber);
    expect(smsCallArgs.body).to.include('已確認');
    
    // 4.2 驗證發送的電子郵件通知
    expect(mockEmailTransporter.sendMail.called).to.be.true;
    const emailCallArgs = mockEmailTransporter.sendMail.firstCall.args[0];
    expect(emailCallArgs.to).to.equal(testEmail);
    expect(emailCallArgs.subject).to.include('已確認');
    
    // 4.3 驗證 notificationLogs 的創建
    expect(mockNotificationLogsRef.doc.called).to.be.true;
    expect(mockNotificationLogsRef.doc().set.called).to.be.true;
    
    // 驗證 log 條目包含正確的通道類型和狀態
    const logSetArgs = mockNotificationLogsRef.doc().set.args.map(arg => arg[0]);
    
    // 檢查是否創建了 SMS 通知日誌
    const smsLog = logSetArgs.find(log => log.channel === NotificationChannelType.SMS);
    expect(smsLog).to.exist;
    expect(smsLog.eventType).to.equal(NotificationEventType.ORDER_CONFIRMED);
    expect(smsLog.status).to.equal(NotificationStatus.PENDING);
    expect(smsLog.userId).to.equal(testCustomerId);
    expect(smsLog.orderId).to.equal(testOrderId);
    
    // 檢查是否創建了 Email 通知日誌
    const emailLog = logSetArgs.find(log => log.channel === NotificationChannelType.EMAIL);
    expect(emailLog).to.exist;
    expect(emailLog.eventType).to.equal(NotificationEventType.ORDER_CONFIRMED);
    expect(emailLog.status).to.equal(NotificationStatus.PENDING);
    
    // 檢查 notificationLogs 的更新（狀態更新為 SENT）
    expect(mockNotificationLogsRef.doc().update.called).to.be.true;
    const logUpdateArgs = mockNotificationLogsRef.doc().update.args.map(arg => arg[0]);
    
    // 至少有一個日誌應標記為成功發送
    const sentStatusUpdate = logUpdateArgs.find(update => update.status === NotificationStatus.SENT);
    expect(sentStatusUpdate).to.exist;
    
    // 4.4 確認 App Push 通知未發送（根據用戶偏好設置）
    // 用戶偏好中禁用了 App Push，所以不應該發送
    expect(mockFCMSend.called).to.be.false;
  });

  /**
   * 輔助函數：設置測試數據
   */
  function setupTestData() {
    // 模擬當前時間戳
    const now = new Date().toISOString();
    
    // 訂單數據
    mockDocData[`orders/${testOrderId}`] = {
      id: testOrderId,
      customerId: testCustomerId,
      storeId: testStoreId,
      status: 'PENDING',
      orderNumber: 'ORD-12345',
      storeName: '測試商店',
      estimatedPickupTime: '2025-05-08T12:00:00Z',
      createdAt: now,
      items: [
        { name: '測試商品', price: 100, quantity: 2 }
      ],
      totalAmount: 200
    };

    // 用戶數據
    mockDocData[`users/${testCustomerId}`] = {
      id: testCustomerId,
      name: '測試用戶',
      phone: testPhoneNumber,
      email: testEmail,
      createdAt: now
    };

    // 用戶通知偏好
    mockDocData[`users/${testCustomerId}/settings/notificationPreferences`] = {
      userId: testCustomerId,
      channels: {
        appPush: false, // 禁用 App Push 通知
        sms: true,     // 啟用 SMS 通知
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
    };

    // 用戶設備令牌
    mockCollectionData[`users/${testCustomerId}/devices`] = {
      'device-1': {
        token: testDeviceToken,
        platform: 'android',
        active: true,
        lastUsed: now
      }
    };

    // 通知模板
    mockCollectionData['notificationTemplates'] = {
      'sms-order-confirmed': {
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
      },
      'email-order-confirmed': {
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
      },
      'app-push-order-confirmed': {
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
      }
    };
  }

  /**
   * 輔助函數：設置模擬 Firestore
   */
  function setupMockFirestore() {
    // 創建模擬文檔快照函數
    const createDocSnapshot = (path: string) => {
      const exists = !!mockDocData[path];
      return {
        exists,
        data: () => mockDocData[path],
        id: path.split('/').pop(),
        ref: {
          path
        }
      };
    };

    // 創建集合查詢結果
    const createCollectionSnapshot = (collectionPath: string) => {
      const collection = mockCollectionData[collectionPath] || {};
      const docs = Object.entries(collection).map(([id, data]) => ({
        id,
        data: () => data,
        exists: true,
        ref: {
          path: `${collectionPath}/${id}`
        }
      }));

      return {
        empty: docs.length === 0,
        docs,
        size: docs.length,
        forEach: (callback: any) => docs.forEach(callback)
      };
    };

    // 模擬 Firestore 方法
    mockNotificationLogsRef = {
      doc: sinon.stub().callsFake((id) => ({
        set: sinon.stub().resolves(),
        update: sinon.stub().resolves(),
        get: sinon.stub().resolves(createDocSnapshot(`notificationLogs/${id}`))
      }))
    };

    mockOrdersRef = {
      doc: sinon.stub().callsFake((id) => ({
        get: sinon.stub().resolves(createDocSnapshot(`orders/${id}`)),
        update: sinon.stub().resolves()
      }))
    };

    mockUserSettingsDoc = {
      get: sinon.stub().resolves(createDocSnapshot(`users/${testCustomerId}/settings/notificationPreferences`))
    };

    mockUserDevicesCollection = {
      get: sinon.stub().resolves(createCollectionSnapshot(`users/${testCustomerId}/devices`))
    };

    mockUserDoc = {
      get: sinon.stub().resolves(createDocSnapshot(`users/${testCustomerId}`)),
      collection: sinon.stub().callsFake((collName) => {
        if (collName === 'settings') {
          return {
            doc: sinon.stub().callsFake((docName) => {
              if (docName === 'notificationPreferences') {
                return mockUserSettingsDoc;
              }
              return {
                get: sinon.stub().resolves({ exists: false, data: () => null })
              };
            })
          };
        } else if (collName === 'devices') {
          return mockUserDevicesCollection;
        }
        return {
          get: sinon.stub().resolves({ empty: true, docs: [] })
        };
      })
    };

    mockUsersRef = {
      doc: sinon.stub().callsFake((id) => {
        if (id === testCustomerId) {
          return mockUserDoc;
        }
        return {
          get: sinon.stub().resolves({ exists: false, data: () => null }),
          collection: sinon.stub().returns({
            get: sinon.stub().resolves({ empty: true, docs: [] })
          })
        };
      })
    };

    // 模擬模板查詢
    mockTemplatesCollection = {
      where: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      get: sinon.stub().callsFake(() => {
        // 為簡化測試，直接返回對應事件和渠道的模板
        const templates = Object.values(mockCollectionData['notificationTemplates'])
          .filter(template => 
            template.eventType === NotificationEventType.ORDER_CONFIRMED);
            
        return Promise.resolve({
          empty: templates.length === 0,
          docs: templates.map(template => ({
            id: template.id,
            data: () => template,
            exists: true
          })),
          size: templates.length
        });
      })
    };

    mockNotificationTemplatesRef = {
      where: mockTemplatesCollection.where,
      limit: mockTemplatesCollection.limit,
      get: mockTemplatesCollection.get
    };

    // 創建主 Firestore 模擬
    mockDb = {
      collection: sinon.stub().callsFake((collName) => {
        switch (collName) {
          case 'orders':
            return mockOrdersRef;
          case 'users':
            return mockUsersRef;
          case 'notificationLogs':
            return mockNotificationLogsRef;
          case 'notificationTemplates':
            return mockNotificationTemplatesRef;
          default:
            return {
              doc: sinon.stub().returns({
                get: sinon.stub().resolves({ exists: false, data: () => null })
              }),
              get: sinon.stub().resolves({ empty: true, docs: [] })
            };
        }
      })
    };

    mockFirestore = mockDb;
  }

  /**
   * 輔助函數：設置通知服務並注入模擬的外部依賴
   */
  function setupNotificationService(): NotificationService {
    // 創建帶有模擬渠道的通知服務實例
    const service = new NotificationService();
    
    // 注入模擬的 Firestore
    (service as any).db = mockFirestore;
    
    // 創建模擬通知渠道
    const smsChannel = new SMSChannel(
      mockTwilioClient, 
      '+15551234567'  // 測試發送號碼
    );
    
    const emailChannel = new EmailChannel(
      mockEmailTransporter,
      'noreply@test.com'  // 測試發件人
    );
    
    const appPushChannel = new AppPushChannel();
    // 模擬 FCM 發送方法
    (appPushChannel as any).sendToDevice = mockFCMSend;
    
    // 注入模擬渠道到通知服務
    const mockChannels = {
      [NotificationChannelType.SMS]: smsChannel,
      [NotificationChannelType.EMAIL]: emailChannel,
      [NotificationChannelType.APP_PUSH]: appPushChannel
    };
    
    (service as any).channels = mockChannels;
    
    return service;
  }
}); 