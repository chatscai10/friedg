/**
 * Jest全局設置文件
 * 用於在測試執行前進行環境準備工作
 */

import * as admin from 'firebase-admin';

// 避免重複初始化的檢查
let isInitialized = false;

/**
 * 初始化Firebase Admin
 * 使用模擬憑證，僅用於測試
 */
export function initFirebaseAdminForTesting() {
  // 避免重複初始化
  if (isInitialized) {
    return;
  }

  try {
    // 使用測試專用配置初始化Firebase Admin
    admin.initializeApp({
      // 模擬專案設置
      projectId: 'friedg-testing',
      // 模擬憑證 (僅用於測試)
      credential: admin.credential.cert({
        projectId: 'friedg-testing',
        clientEmail: 'firebase-adminsdk-testing@friedg-testing.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEMOCKKEYMOCKKEYMOCKKEY\n-----END PRIVATE KEY-----\n'
      } as any),
      // 使用本地模擬器
      databaseURL: 'localhost:8090'
    });

    console.log('⚡ Firebase Admin 成功初始化於測試環境');
    isInitialized = true;
  } catch (error) {
    // 處理可能的初始化失敗
    console.error('❌ Firebase Admin 測試環境初始化失敗:', error);
    
    // 檢查是否為重複初始化錯誤
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('⚠️ Firebase Admin 已經初始化，忽略重複初始化錯誤');
      isInitialized = true;
    } else {
      // 其他未預期的錯誤
      throw error;
    }
  }
}

// 在測試開始前自動初始化
beforeAll(() => {
  // 設置測試環境
  process.env.NODE_ENV = 'test';
  process.env.FUNCTIONS_EMULATOR = 'true';
  
  // 初始化Firebase Admin
  initFirebaseAdminForTesting();
  
  // 其他全局設置...
});

// 在所有測試結束後清理
afterAll(() => {
  // 清理操作
}); 