// 使用 Firebase v9 Compat 版本進行導入 (根據專案規劃書要求)
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore"; // 若需要 Firestore 請取消註解
import "firebase/compat/functions"; // 若需要 Functions 請取消註解

// 您的 Firebase 配置
// 重要：使用環境變數替代實際配置值，如果環境變數不可用時使用硬編碼備用值
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCzkED3TQvitXEI4wSfA8z2Q5UG3cX38tE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'friedg.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'friedg',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'friedg.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '468102161475',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:468102161475:web:8da3b942900109da12e0f6'
};

// 判斷目前環境
const isTestingEnv = import.meta.env.VITE_ENV_MODE === 'testing';
const isDevelopment = import.meta.env.DEV;
const isUsingEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';
const currentEnv = import.meta.env.VITE_ENV_MODE || (isDevelopment ? 'development' : 'production');

// 輸出Firebase配置信息，用於調試 - 移除實際值顯示，僅顯示是否存在
console.log("Firebase環境變數檢查:");
console.log("目前環境:", currentEnv);
console.log("是否使用模擬器:", isUsingEmulator || isDevelopment);
console.log("VITE_FIREBASE_API_KEY 存在:", !!import.meta.env.VITE_FIREBASE_API_KEY);
console.log("VITE_FIREBASE_AUTH_DOMAIN 存在:", !!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
console.log("VITE_FIREBASE_PROJECT_ID 存在:", !!import.meta.env.VITE_FIREBASE_PROJECT_ID);
console.log("VITE_FIREBASE_APP_ID 存在:", !!import.meta.env.VITE_FIREBASE_APP_ID);
console.log("API 基礎URL:", import.meta.env.VITE_API_BASE_URL);

// 初始化 Firebase
// 使用單例模式確保 Firebase 實例只被初始化一次
let app: firebase.app.App;
try {
  app = firebase.app();
  console.log("Firebase已經初始化，使用現有實例");
} catch {
  console.log("初始化新的Firebase實例");
  app = firebase.initializeApp(firebaseConfig);
}

// 初始化 Firebase 服務
const auth = firebase.auth();
const firestore = firebase.firestore(); // 若需要請取消註解
const functions = firebase.functions(); // 若需要請取消註解

// 用於標記是否已連接模擬器的變數
let isEmulatorConnected = false;

// 根據環境決定是否連接模擬器
// Auth 模擬器的連接已移至 authService.ts，避免重複連接
if ((isDevelopment || isUsingEmulator) && !isEmulatorConnected) {
  try {
    console.log("正在連接 Firebase 模擬器 (Functions)...");
    // Auth 模擬器連接已經移到 authService.ts
    // 暫時禁用 Firestore 模擬器連接，避免崩潰
    // firestore.useEmulator('127.0.0.1', 8090);
    functions.useEmulator('127.0.0.1', 5002);
    isEmulatorConnected = true;
    console.log("Firebase 模擬器已連接：functions=5002");
  } catch (error) {
    console.error("連接 Firebase 模擬器時出錯：", error);
    console.warn("將嘗試使用生產環境配置...");
  }
} else {
  console.log("未啟用模擬器連接，使用正式Firebase配置");
}

// 輸出環境信息，用於調試
console.log("Firebase 配置加載完成");

export { app, auth, firestore, functions }; // 導出必要的實例 