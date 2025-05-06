/**
 * 初始化測試數據腳本
 * 用於在Firebase模擬器中創建測試用戶、測試商店和測試菜單項目
 */

const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, collection, doc, setDoc } = require('firebase/firestore');

// Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyDummyApiKeyForEmulator",
  authDomain: "friedg-dev.firebaseapp.com",
  projectId: "friedg-dev",
  storageBucket: "friedg-dev.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890",
  measurementId: "G-ABCDEFGHIJ"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 連接模擬器
connectAuthEmulator(auth, "http://localhost:9199");
connectFirestoreEmulator(db, "localhost", 9283);

// 測試用戶數據
const testUsers = [
  {
    email: 'store_manager@test.com',
    password: 'password123',
    displayName: '測試店長',
    role: 'store_manager',
    tenantId: 'tenant001',
    storeId: 'store001'
  },
  {
    email: 'admin@test.com',
    password: 'admin123',
    displayName: '系統管理員',
    role: 'admin',
    tenantId: 'tenant001'
  },
  {
    email: 'customer@test.com',
    password: 'customer123',
    displayName: '測試顧客',
    role: 'customer'
  }
];

// 測試店鋪數據
const testStores = [
  {
    id: 'store001',
    name: '台北信義店',
    tenantId: 'tenant001',
    address: '台北市信義區松高路100號',
    phone: '02-12345678',
    taxId: '12345678',
    taxRate: 0.05,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// 測試菜單項目數據
const testMenuItems = [
  {
    id: 'item001',
    name: '黃金炸雞排',
    description: '金黃酥脆，外酥內嫩的招牌雞排',
    categoryId: 'cat001',
    price: 80,
    imageUrl: 'https://example.com/images/chicken.jpg',
    status: 'active',
    trackInventory: true,
    inventoryCount: 100,
    isSpicy: true,
    spicyLevel: 2,
    tags: ['招牌', '熱門'],
    nutritionInfo: {
      calories: 450,
      protein: 30,
      carbs: 40,
      fat: 20
    },
    storeId: 'store001',
    tenantId: 'tenant001',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'item002',
    name: '香酥雞腿飯',
    description: '香酥多汁的雞腿佐以特製醬汁，搭配白飯',
    categoryId: 'cat002',
    price: 120,
    imageUrl: 'https://example.com/images/rice.jpg',
    status: 'active',
    trackInventory: true,
    inventoryCount: 50,
    isSpicy: false,
    tags: ['套餐', '飯類'],
    nutritionInfo: {
      calories: 650,
      protein: 40,
      carbs: 80,
      fat: 25
    },
    storeId: 'store001',
    tenantId: 'tenant001',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// 創建測試用戶
async function createTestUsers() {
  console.log('正在創建測試用戶...');
  
  for (const userData of testUsers) {
    try {
      // 創建用戶
      const { email, password, displayName, role, tenantId, storeId } = userData;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      // 存儲用戶附加信息到Firestore
      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        displayName,
        role,
        tenantId,
        storeId,
        emailVerified: true,
        isDisabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`已創建用戶: ${email} (${role})`);
    } catch (error) {
      console.error(`創建用戶 ${userData.email} 失敗:`, error);
    }
  }
  
  console.log('測試用戶創建完成');
}

// 創建測試店鋪
async function createTestStores() {
  console.log('正在創建測試店鋪...');
  
  for (const storeData of testStores) {
    try {
      await setDoc(doc(db, 'stores', storeData.id), storeData);
      console.log(`已創建店鋪: ${storeData.name}`);
    } catch (error) {
      console.error(`創建店鋪 ${storeData.name} 失敗:`, error);
    }
  }
  
  console.log('測試店鋪創建完成');
}

// 創建測試菜單項目
async function createTestMenuItems() {
  console.log('正在創建測試菜單項目...');
  
  for (const itemData of testMenuItems) {
    try {
      await setDoc(doc(db, 'menuItems', itemData.id), itemData);
      console.log(`已創建菜單項目: ${itemData.name}`);
    } catch (error) {
      console.error(`創建菜單項目 ${itemData.name} 失敗:`, error);
    }
  }
  
  console.log('測試菜單項目創建完成');
}

// 創建菜單分類
async function createMenuCategories() {
  console.log('正在創建菜單分類...');
  
  const categories = [
    {
      id: 'cat001',
      name: '單點類',
      description: '各式雞排單點',
      sortOrder: 1,
      status: 'active',
      storeId: 'store001',
      tenantId: 'tenant001',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'cat002',
      name: '套餐類',
      description: '飯類與套餐',
      sortOrder: 2,
      status: 'active',
      storeId: 'store001',
      tenantId: 'tenant001',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  for (const categoryData of categories) {
    try {
      await setDoc(doc(db, 'menuCategories', categoryData.id), categoryData);
      console.log(`已創建菜單分類: ${categoryData.name}`);
    } catch (error) {
      console.error(`創建菜單分類 ${categoryData.name} 失敗:`, error);
    }
  }
  
  console.log('菜單分類創建完成');
}

// 主函數：初始化所有測試數據
async function initializeTestData() {
  try {
    await createTestUsers();
    await createTestStores();
    await createMenuCategories();
    await createTestMenuItems();
    
    console.log('所有測試數據初始化完成！');
  } catch (error) {
    console.error('初始化測試數據失敗:', error);
  }
}

// 執行初始化
initializeTestData().then(() => {
  console.log('初始化腳本執行完畢');
  process.exit(0);
}).catch(err => {
  console.error('初始化腳本執行失敗:', err);
  process.exit(1);
}); 