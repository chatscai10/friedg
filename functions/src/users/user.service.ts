import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { UserProfile, UpdateUserProfileInput } from './user.types'; // 導入類型

const logger = functions.logger;
const db = admin.firestore();
const auth = admin.auth(); // 可能需要更新 Auth profile

/**
 * 根據 Firebase UID 獲取用戶 Profile
 * @param userId Firebase 用戶 UID
 * @returns UserProfile 對象或 null
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  logger.info(`開始獲取用戶 Profile，UID: ${userId}`);
  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.warn(`用戶文檔未找到，UID: ${userId}`);
      return null;
    }

    const userData = userDoc.data();
    if (!userData) {
      logger.warn(`用戶文檔數據為空，UID: ${userId}`);
      return null;
    }

    // 構建 UserProfile，只包含允許返回的字段
    const userProfile: UserProfile = {
      uid: userId,
      email: userData.email || null,
      displayName: userData.displayName || null,
      photoURL: userData.photoURL || null,
      phoneNumber: userData.phoneNumber || null,
      // 添加其他需要返回的字段...
    };

    logger.info(`成功獲取用戶 Profile，UID: ${userId}`);
    return userProfile;

  } catch (error: any) {
    logger.error(`獲取用戶 Profile 時發生錯誤，UID: ${userId}`, { error: error.message, stack: error.stack });
    throw new Error(`獲取用戶 Profile 失敗: ${error.message}`);
  }
}

/**
 * 更新用戶 Profile
 * @param userId Firebase 用戶 UID
 * @param profileData 包含要更新欄位的對象
 * @returns Promise<void>
 */
export async function updateUserProfile(userId: string, profileData: UpdateUserProfileInput): Promise<void> {
  logger.info(`開始更新用戶 Profile，UID: ${userId}`, { data: profileData });
  try {
    const userDocRef = db.collection('users').doc(userId);

    // 準備要更新到 Firestore 的數據 (只包含有效欄位)
    const dataToUpdate: Record<string, any> = {};
    if (profileData.displayName !== undefined) {
      dataToUpdate.displayName = profileData.displayName;
    }
    if (profileData.photoURL !== undefined) {
      dataToUpdate.photoURL = profileData.photoURL;
    }
    if (profileData.phoneNumber !== undefined) {
      dataToUpdate.phoneNumber = profileData.phoneNumber;
    }
    // 添加其他允許更新的欄位...

    // 添加 updatedAt 時間戳
    dataToUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    if (Object.keys(dataToUpdate).length > 1) { // 至少有 updatedAt
      logger.info(`準備更新 Firestore 用戶文檔 ${userId}`, dataToUpdate);
      await userDocRef.update(dataToUpdate);
      logger.info(`成功更新 Firestore 用戶文檔 ${userId}`);

      // (可選) 同步更新 Firebase Auth 中的 displayName 和 photoURL
      const authUpdatePayload: admin.auth.UpdateRequest = {};
      if (profileData.displayName !== undefined) {
        authUpdatePayload.displayName = profileData.displayName;
      }
      if (profileData.photoURL !== undefined) {
        authUpdatePayload.photoURL = profileData.photoURL;
      }
      if (Object.keys(authUpdatePayload).length > 0) {
        try {
          logger.info(`同步更新 Firebase Auth 用戶 ${userId}`, authUpdatePayload);
          await auth.updateUser(userId, authUpdatePayload);
        } catch (authError: any) {
          logger.warn(`同步更新 Firebase Auth 用戶 ${userId} 信息失敗`, authError);
          // 通常不應阻塞主流程
        }
      }

    } else {
      logger.info(`沒有需要更新的用戶 Profile 字段，UID: ${userId}`);
    }

  } catch (error: any) {
    // 增加對文檔不存在的檢查 (雖然理論上用戶已登入，文檔應存在)
    if (error.code === 5) { // Firestore NOT_FOUND error code
      logger.error(`嘗試更新不存在的用戶文檔，UID: ${userId}`, profileData);
      throw new Error(`用戶不存在: ${userId}`);
    }
    logger.error(`更新用戶 Profile 時發生錯誤，UID: ${userId}`, { error: error.message, stack: error.stack });
    throw new Error(`更新用戶 Profile 失敗: ${error.message}`);
  }
} 