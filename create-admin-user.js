const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function createAdminUser() {
  try {
    // 創建用戶
    const userRecord = await admin.auth().createUser({
      email: 'admin@friedg-dev.com',
      password: 'Test123!',
      displayName: 'Admin User'
    });
    
    // 設置自定義聲明
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'admin',
      storeId: 'default_store'
    });
    
    console.log('成功創建管理員用戶:', userRecord.uid);
  } catch (error) {
    console.error('創建用戶失敗:', error);
  }
}

createAdminUser(); 