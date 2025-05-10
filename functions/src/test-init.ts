import * as admin from 'firebase-admin';

// 嘗試初始化 Firebase Admin SDK
console.log('開始初始化 Firebase Admin SDK...');

try {
  if (admin.apps.length === 0) {
    console.log('Firebase Admin 尚未初始化，執行初始化...');
    // 使用明確的項目 ID 和服務帳戶憑證初始化（模擬器模式）
    admin.initializeApp({
      projectId: 'friedg',  // 使用你的 Firebase 項目 ID
      databaseURL: 'localhost:8080', // 指向本地模擬器
    });
    console.log('Firebase Admin 初始化成功！');
  } else {
    console.log('Firebase Admin 已經初始化，應用程序數量:', admin.apps.length);
    console.log('當前應用程序名稱:', admin.app().name);
  }
  
  // 設置 Firestore 模擬器
  console.log('設置 Firestore 模擬器連接...');
  // 設置 FIRESTORE_EMULATOR_HOST 環境變數
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9898';
  const db = admin.firestore();
  console.log('Firestore 實例已創建，連接到模擬器');
  
  // 列出所有集合
  db.listCollections().then(collections => {
    console.log('成功獲取集合列表，數量:', collections.length);
    collections.forEach(collection => {
      console.log('集合名稱:', collection.id);
    });
  }).catch(error => {
    console.error('無法列出集合:', error);
  });
  
} catch (error) {
  console.error('Firebase Admin 初始化或操作失敗:', error);
} 