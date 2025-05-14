/**
 * Firebase 初始化和導出
 */

import * as admin from 'firebase-admin';

// 確保 Firebase Admin SDK 只初始化一次
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// 導出 Firestore 實例
export const firestore = admin.firestore();

// 導出 Auth 實例
export const auth = admin.auth();

// 導出 Storage 實例
export const storage = admin.storage();

// 導出 Messaging 實例
export const messaging = admin.messaging();

// 導出 Firebase Admin SDK
export default admin;
