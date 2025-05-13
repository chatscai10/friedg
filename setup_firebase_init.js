/**
 * Firebase 專案初始化腳本
 * 用於設定系統所需的基本集合，包括:
 * - 超級管理員帳號
 * - 基本租戶資料
 * - 基本角色設定
 * - 系統設定值
 * 
 * 使用方式:
 * 1. 確保已安裝 firebase-tools 並登入
 * 2. 執行 node setup_firebase_init.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // 請先下載 Firebase 專案的服務帳號金鑰

// 初始化 Firebase Admin SDK
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error('Firebase Admin SDK 初始化失敗:', e);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

// 超級管理員帳號設定
const SUPER_ADMIN_EMAIL = 'admin@friedg.com';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin123!'; // 請在生產環境更改為強密碼

// 基本角色設定
const SYSTEM_ROLES = [
  {
    id: 'super_admin',
    name: '超級管理員',
    description: '系統最高權限管理員',
    level: 1,
    permissions: ['*'],
    isSystemRole: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'tenant_admin',
    name: '租戶管理員',
    description: '租戶最高權限管理員',
    level: 2,
    permissions: [
      'tenant.read', 'tenant.update',
      'store.create', 'store.read', 'store.update', 'store.delete',
      'employee.create', 'employee.read', 'employee.update', 'employee.delete',
      'menu.create', 'menu.read', 'menu.update', 'menu.delete',
      'order.create', 'order.read', 'order.update',
      'report.read'
    ],
    isSystemRole: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'store_manager',
    name: '店長',
    description: '分店管理者',
    level: 3,
    permissions: [
      'store.read',
      'employee.read', 'employee.update',
      'menu.read',
      'order.create', 'order.read', 'order.update',
      'report.read'
    ],
    isSystemRole: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'shift_leader',
    name: '班長',
    description: '班次負責人',
    level: 4,
    permissions: [
      'store.read',
      'employee.read',
      'menu.read',
      'order.create', 'order.read', 'order.update'
    ],
    isSystemRole: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'senior_staff',
    name: '資深員工',
    description: '有經驗的員工',
    level: 5,
    permissions: [
      'menu.read',
      'order.create', 'order.read'
    ],
    isSystemRole: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'staff',
    name: '一般員工',
    description: '基本員工',
    level: 6,
    permissions: [
      'menu.read',
      'order.create', 'order.read'
    ],
    isSystemRole: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'customer',
    name: '顧客',
    description: '普通會員',
    level: 10,
    permissions: [
      'menu.read',
      'order.create', 'order.read'
    ],
    isSystemRole: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// 系統設定
const SYSTEM_SETTINGS = {
  version: '1.0.0',
  maintenance: false,
  maintenanceMessage: '',
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
};

// 範例租戶資料
const DEMO_TENANT = {
  id: 'demo-tenant',
  name: '示範餐廳',
  description: '系統展示用的示範租戶',
  active: true,
  plan: 'free',
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  limits: {
    maxStores: 3,
    maxEmployees: 20,
    maxMenuItems: 100,
    features: {
      pos: true,
      inventory: true,
      employees: true,
      scheduling: true,
      reports: true,
      loyalty: true,
      promotions: false
    }
  }
};

// 範例分店資料
const DEMO_STORE = {
  id: 'demo-store-1',
  tenantId: 'demo-tenant',
  name: '示範分店',
  address: '台北市信義區松高路1號',
  phone: '02-12345678',
  latitude: 25.0338,
  longitude: 121.5646,
  active: true,
  businessHours: [
    {day: 0, open: '10:00', close: '21:00', isOpen: true},
    {day: 1, open: '10:00', close: '21:00', isOpen: true},
    {day: 2, open: '10:00', close: '21:00', isOpen: true},
    {day: 3, open: '10:00', close: '21:00', isOpen: true},
    {day: 4, open: '10:00', close: '21:00', isOpen: true},
    {day: 5, open: '10:00', close: '22:00', isOpen: true},
    {day: 6, open: '10:00', close: '22:00', isOpen: true}
  ],
  createdAt: admin.firestore.FieldValue.serverTimestamp()
};

/**
 * 初始化超級管理員帳號
 */
async function setupSuperAdmin() {
  try {
    // 檢查是否已經存在
    try {
      const userRecord = await auth.getUserByEmail(SUPER_ADMIN_EMAIL);
      console.log('超級管理員帳號已存在:', userRecord.uid);
      return userRecord.uid;
    } catch (e) {
      // 不存在，建立新帳號
      const userRecord = await auth.createUser({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
        displayName: '系統管理員',
        emailVerified: true
      });
      
      console.log('已建立超級管理員帳號:', userRecord.uid);
      
      // 設定自定義權限聲明
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: 'super_admin',
        roleLevel: 1,
        permissions: ['*']
      });
      
      console.log('已設定超級管理員權限');
      return userRecord.uid;
    }
  } catch (e) {
    console.error('設定超級管理員失敗:', e);
    throw e;
  }
}

/**
 * 初始化系統角色
 */
async function setupSystemRoles() {
  try {
    const rolesRef = db.collection('roles');
    const batch = db.batch();
    
    for (const role of SYSTEM_ROLES) {
      const docRef = rolesRef.doc(role.id);
      batch.set(docRef, role);
    }
    
    await batch.commit();
    console.log('已設定基本角色:', SYSTEM_ROLES.length, '個角色');
  } catch (e) {
    console.error('設定系統角色失敗:', e);
    throw e;
  }
}

/**
 * 初始化系統設定
 */
async function setupSystemSettings() {
  try {
    await db.collection('system').doc('settings').set(SYSTEM_SETTINGS);
    console.log('已設定系統參數');
  } catch (e) {
    console.error('設定系統參數失敗:', e);
    throw e;
  }
}

/**
 * 初始化示範租戶與分店
 */
async function setupDemoTenant() {
  try {
    // 設定租戶
    await db.collection('tenants').doc(DEMO_TENANT.id).set(DEMO_TENANT);
    console.log('已設定示範租戶:', DEMO_TENANT.id);
    
    // 設定分店
    await db.collection('stores').doc(DEMO_STORE.id).set(DEMO_STORE);
    console.log('已設定示範分店:', DEMO_STORE.id);
  } catch (e) {
    console.error('設定示範租戶失敗:', e);
    throw e;
  }
}

/**
 * 主函數
 */
async function main() {
  console.log('======= Firebase 專案初始化開始 =======');
  
  try {
    // 建立超級管理員
    const adminUid = await setupSuperAdmin();
    
    // 設定系統角色
    await setupSystemRoles();
    
    // 設定系統參數
    await setupSystemSettings();
    
    // 設定示範租戶與分店
    await setupDemoTenant();
    
    console.log('======= Firebase 專案初始化完成 =======');
  } catch (e) {
    console.error('Firebase 專案初始化失敗:', e);
    process.exit(1);
  }
}

// 執行主函數
main(); 