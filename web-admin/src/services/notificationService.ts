import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { NotificationPreferences } from '../types/notification.types';

/**
 * 通知服務 - 負責處理與通知偏好相關的API調用
 */
class NotificationService {
  /**
   * 獲取當前用戶的通知偏好設置
   * @returns Promise<NotificationPreferences> 用戶通知偏好設置
   */
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      const getPreferencesFunc = httpsCallable(functions, 'getNotificationPreferences');
      const result = await getPreferencesFunc();
      return result.data as NotificationPreferences;
    } catch (error) {
      console.error('獲取通知偏好設置失敗:', error);
      throw error;
    }
  }

  /**
   * 更新用戶的通知偏好設置
   * @param preferences 要更新的通知偏好設置
   * @returns Promise<{success: boolean, message: string}> 更新結果
   */
  async updateNotificationPreferences(preferences: Omit<NotificationPreferences, 'userId' | 'updatedAt'>): Promise<{success: boolean, message: string}> {
    try {
      const updatePreferencesFunc = httpsCallable(functions, 'updateNotificationPreferences');
      const result = await updatePreferencesFunc(preferences);
      return result.data as {success: boolean, message: string};
    } catch (error) {
      console.error('更新通知偏好設置失敗:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService(); 