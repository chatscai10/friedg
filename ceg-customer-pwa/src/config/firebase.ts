// Import the functions you need from the SDKs you need
import { initializeApp, getApp } from "firebase/app";
import { getMessaging, onMessage, getToken as getFcmToken } from "firebase/messaging"; // getToken 重命名以避免與 Auth 的 getToken 衝突
import { getAuth } from "firebase/auth";
import { getFirestore, doc, updateDoc, arrayUnion } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // <-- 【使用者操作】請填入真實值
  authDomain: "YOUR_AUTH_DOMAIN", // <-- 【使用者操作】請填入真實值
  projectId: "YOUR_PROJECT_ID", // <-- 【使用者操作】請填入真實值
  storageBucket: "YOUR_STORAGE_BUCKET", // <-- 【使用者操作】請填入真實值
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // <-- 【使用者操作】請填入真實值
  appId: "YOUR_APP_ID", // <-- 【使用者操作】請填入真實值
  measurementId: "YOUR_MEASUREMENT_ID" // Optional, <-- 【使用者操作】請填入真實值
};

// Initialize Firebase
let app;
try {
  app = getApp();
} catch (e) {
  app = initializeApp(firebaseConfig);
}

const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);

// 處理前台消息
// 此函數將在 ForegroundMessageHandler 組件中被調用
const setupForegroundMessageHandler = (showAppNotification: (message: string, severity: import('@mui/material').AlertColor, title?: string) => void) => {
  onMessage(messaging, (payload) => {
    console.log("Message received in foreground. ", payload);
    if (payload.notification) {
      showAppNotification(payload.notification.body || '您有一條新消息', 'info', payload.notification.title || '新通知');
    }
    // 如果需要處理 payload.data 中的內容，可以在此處添加邏輯
  });
};

// 請求通知權限並獲取/刷新 token
// 此函數將在 AuthContext 中被調用
const getAndRegisterFcmToken = async (userId: string): Promise<string | null> => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("Notification permission granted.");
      // 【重要】VAPID 金鑰應存儲在環境變量中，例如 .env 文件中的 REACT_APP_FIREBASE_VAPID_KEY
      // 並在此處讀取: process.env.REACT_APP_FIREBASE_VAPID_KEY
      // 請確保已在 Firebase Console > 專案設定 > Cloud Messaging > Web Push 憑證 中生成金鑰組
      const vapidKeyFromEnv = process.env.REACT_APP_FIREBASE_VAPID_KEY || "YOUR_VAPID_KEY"; // <-- 【使用者操作】若不使用環境變數，請確保此處為真實 VAPID 公鑰，但強烈建議使用環境變數
      
      if (vapidKeyFromEnv === "YOUR_VAPID_KEY") {
        console.warn("VAPID key is still a placeholder. Please configure it in your environment variables (REACT_APP_FIREBASE_VAPID_KEY) or directly in the code (not recommended).");
      }

      const currentToken = await getFcmToken(messaging, { vapidKey: vapidKeyFromEnv }); 
      if (currentToken) {
        console.log("FCM Token: ", currentToken);
        // 將 token 保存到 Firestore
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
          fcmTokens: arrayUnion(currentToken) // 使用 arrayUnion 避免重複
        });
        console.log("FCM token saved to Firestore for user: ", userId);
        return currentToken;
      } else {
        console.log("No registration token available. Request permission to generate one.");
        return null;
      }
    } else {
      console.log("Unable to get permission to notify.");
      return null;
    }
  } catch (err) {
    console.error("An error occurred while retrieving token. ", err);
    return null;
  }
};

export { app, auth, db, messaging, setupForegroundMessageHandler, getAndRegisterFcmToken }; // 導出 setupForegroundMessageHandler 