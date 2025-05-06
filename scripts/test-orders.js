/**
 * 訂單管理功能測試腳本
 * 用於快速測試訂單創建、支付和收據生成功能
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFunctions, httpsCallable, connectFunctionsEmulator } = require('firebase/functions');

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
const functions = getFunctions(app);

// 連接模擬器
connectFunctionsEmulator(functions, "localhost", 5101);

// 測試使用者憑證
const testUserEmail = 'store_manager@test.com';
const testUserPassword = 'password123';

// 測試資料
const testStore = {
  id: 'store001',
  name: '台北信義店',
  taxRate: 0.05
};

const testMenuItem = {
  id: 'item001',
  name: '黃金炸雞排',
  price: 80
};

// 模擬創建訂單
async function createTestOrder() {
  try {
    // 登入測試使用者
    console.log('正在登入測試使用者...');
    await signInWithEmailAndPassword(auth, testUserEmail, testUserPassword);
    console.log('登入成功！');

    // 獲取訂單Cloud Function引用
    const newOrderFunction = httpsCallable(functions, 'newOrder');

    // 準備訂單數據
    const orderData = {
      storeId: testStore.id,
      customerName: '測試顧客',
      customerPhone: '0912345678',
      customerEmail: 'test@example.com',
      customerTaxId: '12345678',
      orderType: 'takeout',
      specialInstructions: '測試訂單，請勿出餐',
      items: [
        {
          menuItemId: testMenuItem.id,
          quantity: 2,
          unitPrice: testMenuItem.price,
          specialInstructions: '不要辣'
        }
      ],
      taxIncluded: true
    };

    // 創建訂單
    console.log('正在創建測試訂單...');
    const result = await newOrderFunction(orderData);
    const order = result.data;
    
    console.log('訂單創建成功！訂單ID：', order.id);
    console.log('訂單明細：', JSON.stringify(order, null, 2));
    
    return order;
    
  } catch (error) {
    console.error('創建訂單失敗：', error);
    throw error;
  }
}

// 模擬支付訂單
async function payTestOrder(orderId) {
  try {
    // 獲取支付Cloud Function引用
    const recordPaymentFunction = httpsCallable(functions, 'recordPayment');
    
    // 準備支付數據
    const paymentData = {
      orderId,
      paymentMethod: 'cash',
      amount: 168, // 訂單總額
      notes: '測試支付'
    };
    
    // 記錄支付
    console.log('正在記錄訂單支付...');
    const result = await recordPaymentFunction(paymentData);
    const updatedOrder = result.data;
    
    console.log('支付記錄成功！支付狀態：', updatedOrder.paymentStatus);
    
    return updatedOrder;
    
  } catch (error) {
    console.error('記錄支付失敗：', error);
    throw error;
  }
}

// 生成訂單收據
async function generateTestReceipt(orderId) {
  try {
    // 獲取收據Cloud Function引用
    const generateReceiptFunction = httpsCallable(functions, 'generateOrderReceipt');
    
    // 生成收據
    console.log('正在生成訂單收據...');
    const result = await generateReceiptFunction({ orderId });
    const receipt = result.data;
    
    console.log('收據生成成功！收據編號：', receipt.receiptNumber);
    console.log('收據明細：', JSON.stringify(receipt, null, 2));
    
    return receipt;
    
  } catch (error) {
    console.error('生成收據失敗：', error);
    throw error;
  }
}

// 主要測試流程
async function runOrderTest() {
  try {
    // 步驟1：創建訂單
    const order = await createTestOrder();
    
    // 步驟2：支付訂單
    const paidOrder = await payTestOrder(order.id);
    
    // 步驟3：生成收據
    const receipt = await generateTestReceipt(order.id);
    
    console.log('訂單測試完成！');
    
  } catch (error) {
    console.error('測試過程中發生錯誤：', error);
  } finally {
    // 登出
    await signOut(auth);
    console.log('已登出測試使用者');
  }
}

// 執行測試
runOrderTest().then(() => {
  console.log('測試流程已完成');
}).catch(err => {
  console.error('測試執行失敗：', err);
}); 