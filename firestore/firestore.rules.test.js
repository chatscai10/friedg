/**
 * Firestore安全規則測試
 * 測試資料隔離和權限控制
 */

const firebase = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

// 測試專案ID
const PROJECT_ID = 'fried-chicken-pos-test';

// 測試用戶
const ADMIN_USER = { uid: 'admin-user', email: 'admin@example.com' };
const TENANT_ADMIN_USER = { uid: 'tenant-admin-user', email: 'tenant-admin@example.com' };
const STORE_MANAGER_USER = { uid: 'store-manager-user', email: 'store-manager@example.com' };
const EMPLOYEE_USER = { uid: 'employee-user', email: 'employee@example.com' };
const CUSTOMER_USER = { uid: 'customer-user', email: 'customer@example.com' };
const UNAUTHENTICATED = null;

// 測試租戶和店鋪
const TENANT_ID = 'test-tenant';
const STORE_ID = 'test-store';

// 測試數據
const TEST_USER_DATA = {
  uid: EMPLOYEE_USER.uid,
  email: EMPLOYEE_USER.email,
  displayName: 'Test Employee',
  role: 'employee',
  tenantId: TENANT_ID,
  storeId: STORE_ID,
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
};

const TEST_STORE_DATA = {
  id: STORE_ID,
  name: 'Test Store',
  tenantId: TENANT_ID,
  address: '123 Test St',
  phone: '123-456-7890',
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
};

const TEST_ORDER_DATA = {
  id: 'test-order',
  storeId: STORE_ID,
  tenantId: TENANT_ID,
  customerId: CUSTOMER_USER.uid,
  employeeId: EMPLOYEE_USER.uid,
  items: [
    { id: 'item1', name: 'Test Item 1', price: 100, quantity: 2 }
  ],
  totalAmount: 200,
  status: 'pending',
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
};

/**
 * 創建測試應用
 * @param {Object} auth 認證信息
 * @param {Object} data 初始數據
 * @returns {Object} 測試應用
 */
function createTestApp(auth = null, data = {}) {
  // 創建測試應用
  const app = firebase.initializeTestApp({
    projectId: PROJECT_ID,
    auth
  });
  
  // 創建管理員應用
  const adminApp = firebase.initializeAdminApp({
    projectId: PROJECT_ID
  });
  
  // 初始化數據
  const adminDb = adminApp.firestore();
  
  // 返回測試應用和管理員應用
  return { app, adminApp, adminDb };
}

/**
 * 設置測試數據
 * @param {Object} adminDb 管理員數據庫
 */
async function setupTestData(adminDb) {
  // 設置用戶數據
  await adminDb.collection('users').doc(ADMIN_USER.uid).set({
    uid: ADMIN_USER.uid,
    email: ADMIN_USER.email,
    displayName: 'Admin User',
    role: 'admin',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  await adminDb.collection('users').doc(TENANT_ADMIN_USER.uid).set({
    uid: TENANT_ADMIN_USER.uid,
    email: TENANT_ADMIN_USER.email,
    displayName: 'Tenant Admin User',
    role: 'tenant_admin',
    tenantId: TENANT_ID,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  await adminDb.collection('users').doc(STORE_MANAGER_USER.uid).set({
    uid: STORE_MANAGER_USER.uid,
    email: STORE_MANAGER_USER.email,
    displayName: 'Store Manager User',
    role: 'store_manager',
    tenantId: TENANT_ID,
    storeId: STORE_ID,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  await adminDb.collection('users').doc(EMPLOYEE_USER.uid).set(TEST_USER_DATA);
  
  await adminDb.collection('users').doc(CUSTOMER_USER.uid).set({
    uid: CUSTOMER_USER.uid,
    email: CUSTOMER_USER.email,
    displayName: 'Customer User',
    role: 'customer',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  // 設置租戶數據
  await adminDb.collection('tenants').doc(TENANT_ID).set({
    id: TENANT_ID,
    name: 'Test Tenant',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  
  // 設置店鋪數據
  await adminDb.collection('stores').doc(STORE_ID).set(TEST_STORE_DATA);
  
  // 設置訂單數據
  await adminDb.collection('orders').doc(TEST_ORDER_DATA.id).set(TEST_ORDER_DATA);
}

/**
 * 清理測試環境
 */
async function cleanup() {
  await Promise.all(firebase.apps().map(app => app.delete()));
}

/**
 * 加載Firestore規則
 */
async function loadFirestoreRules() {
  const rulesPath = path.join(__dirname, 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');
  
  await firebase.loadFirestoreRules({
    projectId: PROJECT_ID,
    rules
  });
}

// 測試套件
describe('Firestore Security Rules', () => {
  // 在所有測試之前加載規則
  beforeAll(async () => {
    await loadFirestoreRules();
  });
  
  // 在每個測試之後清理環境
  afterEach(async () => {
    await cleanup();
  });
  
  // 測試用戶集合
  describe('Users Collection', () => {
    test('未認證用戶不能讀取用戶數據', async () => {
      const { app } = createTestApp();
      const db = app.firestore();
      
      await firebase.assertFails(db.collection('users').get());
    });
    
    test('用戶可以讀取自己的數據', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(db.collection('users').doc(EMPLOYEE_USER.uid).get());
    });
    
    test('普通用戶不能讀取其他用戶的數據', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertFails(db.collection('users').doc(CUSTOMER_USER.uid).get());
    });
    
    test('管理員可以讀取所有用戶數據', async () => {
      const { app, adminDb } = createTestApp(ADMIN_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(db.collection('users').get());
    });
    
    test('租戶管理員只能讀取自己租戶的用戶數據', async () => {
      const { app, adminDb } = createTestApp(TENANT_ADMIN_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      // 可以讀取自己租戶的用戶
      await firebase.assertSucceeds(
        db.collection('users')
          .where('tenantId', '==', TENANT_ID)
          .get()
      );
      
      // 不能讀取所有用戶
      await firebase.assertFails(db.collection('users').get());
    });
    
    test('用戶可以更新自己的非敏感數據', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(
        db.collection('users').doc(EMPLOYEE_USER.uid).update({
          displayName: 'Updated Name'
        })
      );
    });
    
    test('用戶不能更新自己的角色', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertFails(
        db.collection('users').doc(EMPLOYEE_USER.uid).update({
          role: 'admin'
        })
      );
    });
    
    test('管理員可以更新用戶角色', async () => {
      const { app, adminDb } = createTestApp(ADMIN_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(
        db.collection('users').doc(EMPLOYEE_USER.uid).update({
          role: 'store_manager'
        })
      );
    });
  });
  
  // 測試店鋪集合
  describe('Stores Collection', () => {
    test('未認證用戶不能讀取店鋪數據', async () => {
      const { app } = createTestApp();
      const db = app.firestore();
      
      await firebase.assertFails(db.collection('stores').get());
    });
    
    test('員工可以讀取自己店鋪的數據', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(db.collection('stores').doc(STORE_ID).get());
    });
    
    test('員工不能讀取其他店鋪的數據', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      // 創建另一個店鋪
      await adminDb.collection('stores').doc('other-store').set({
        id: 'other-store',
        name: 'Other Store',
        tenantId: TENANT_ID,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      await firebase.assertFails(db.collection('stores').doc('other-store').get());
    });
    
    test('租戶管理員可以讀取自己租戶的所有店鋪', async () => {
      const { app, adminDb } = createTestApp(TENANT_ADMIN_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(
        db.collection('stores')
          .where('tenantId', '==', TENANT_ID)
          .get()
      );
    });
    
    test('店長可以更新自己店鋪的數據', async () => {
      const { app, adminDb } = createTestApp(STORE_MANAGER_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(
        db.collection('stores').doc(STORE_ID).update({
          name: 'Updated Store Name'
        })
      );
    });
    
    test('員工不能更新店鋪數據', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertFails(
        db.collection('stores').doc(STORE_ID).update({
          name: 'Updated Store Name'
        })
      );
    });
  });
  
  // 測試訂單集合
  describe('Orders Collection', () => {
    test('未認證用戶不能讀取訂單數據', async () => {
      const { app } = createTestApp();
      const db = app.firestore();
      
      await firebase.assertFails(db.collection('orders').get());
    });
    
    test('員工可以讀取自己店鋪的訂單', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(
        db.collection('orders')
          .where('storeId', '==', STORE_ID)
          .get()
      );
    });
    
    test('顧客只能讀取自己的訂單', async () => {
      const { app, adminDb } = createTestApp(CUSTOMER_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(
        db.collection('orders')
          .where('customerId', '==', CUSTOMER_USER.uid)
          .get()
      );
      
      await firebase.assertFails(db.collection('orders').get());
    });
    
    test('員工可以創建訂單', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      const newOrder = {
        storeId: STORE_ID,
        tenantId: TENANT_ID,
        customerId: CUSTOMER_USER.uid,
        employeeId: EMPLOYEE_USER.uid,
        items: [
          { id: 'item1', name: 'Test Item 1', price: 100, quantity: 1 }
        ],
        totalAmount: 100,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      await firebase.assertSucceeds(
        db.collection('orders').add(newOrder)
      );
    });
    
    test('員工不能創建其他店鋪的訂單', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      const newOrder = {
        storeId: 'other-store',
        tenantId: TENANT_ID,
        customerId: CUSTOMER_USER.uid,
        employeeId: EMPLOYEE_USER.uid,
        items: [
          { id: 'item1', name: 'Test Item 1', price: 100, quantity: 1 }
        ],
        totalAmount: 100,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      await firebase.assertFails(
        db.collection('orders').add(newOrder)
      );
    });
    
    test('員工可以更新自己店鋪的訂單狀態', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertSucceeds(
        db.collection('orders').doc(TEST_ORDER_DATA.id).update({
          status: 'completed'
        })
      );
    });
    
    test('員工不能更新訂單的金額', async () => {
      const { app, adminDb } = createTestApp(EMPLOYEE_USER);
      const db = app.firestore();
      
      await setupTestData(adminDb);
      
      await firebase.assertFails(
        db.collection('orders').doc(TEST_ORDER_DATA.id).update({
          totalAmount: 300
        })
      );
    });
  });
});
