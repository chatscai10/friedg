const admin = require('firebase-admin');

// !!! 請將 'path/to/your/serviceAccountKey.json' 替換為您的服務帳號金鑰檔案的實際路徑 !!!
// !!! 切勿將金鑰檔案直接包含在程式碼中或提交到版本控制 !!!
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'D:/friedg-firebase-adminsdk-fbsvc-aadd5082dd.json';

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath)
  });
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  if (error.code !== 'app/duplicate-app') {
    console.error('Firebase Admin initialization error:', error);
    process.exit(1);
  } else {
    console.log('Firebase Admin SDK already initialized.');
    // If already initialized, get the existing app instance
    // admin = admin.app(); // No need to reassign if using default app
  }
}

// 要設置 Custom Claims 的使用者 Email
const userEmail = 'admin@test.com';
// 要設置的 Custom Claims (您可以根據需要修改 storeId)
const customClaims = {
  role: 'admin',
  storeId: 'default_store' // 使用預設的 storeId
};

async function setClaims() {
  console.log(`Attempting to set claims for: ${userEmail}`);
  try {
    // 1. 根據 Email 獲取使用者 UID
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    const userId = userRecord.uid;
    console.log(`Found user: ${userId} (${userEmail})`);

    // 2. 設置 Custom Claims
    await admin.auth().setCustomUserClaims(userId, customClaims);
    console.log(`Successfully set custom claims for user ${userId}:`, customClaims);

    // 3. 驗證 Claims 是否已設置 (查詢最新的使用者紀錄)
    // Short delay might sometimes help ensure propagation in emulators, though not guaranteed needed.
    // await new Promise(resolve => setTimeout(resolve, 500));
    const updatedUser = await admin.auth().getUser(userId);
    console.log('Verified custom claims:', updatedUser.customClaims);

  } catch (error) {
    if (error.code === 'auth/user-not-found') {
       console.error(`Error: User with email ${userEmail} not found in Firebase Auth.`);
       console.error('Please ensure the user exists in the Auth Emulator (http://127.0.0.1:4000/auth) before running this script.');
    } else {
      console.error('Error setting or verifying custom claims:', error);
    }
  } finally {
    // Optional: Explicitly delete the app if the script is meant to run standalone and exit.
    // Be cautious if other parts of your backend might rely on the default app instance.
    // admin.app().delete().then(() => console.log('Admin SDK app deleted.')).catch(err => console.error('Error deleting admin app:', err));
  }
}

setClaims(); 