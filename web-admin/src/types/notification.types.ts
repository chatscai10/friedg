import { Timestamp } from 'firebase/firestore';

/**
 * 通知偏好設置接口
 */
export interface NotificationPreferences {
  /**
   * 用戶ID
   */
  userId: string;
  
  /**
   * 各通知渠道設置
   */
  channels: {
    /**
     * 是否啟用App推送
     */
    appPush: boolean;
    
    /**
     * 是否啟用SMS
     */
    sms: boolean;
    
    /**
     * 是否啟用Email
     */
    email: boolean;
  };
  
  /**
   * 是否接收訂單更新通知
   */
  orderUpdates: boolean;
  
  /**
   * 是否接收促銷通知
   */
  promotions: boolean;
  
  /**
   * 勿擾時段
   */
  quietHours: {
    /**
     * 是否啟用勿擾時段
     */
    enabled: boolean;
    
    /**
     * 開始時間, "22:00"
     */
    startTime: string;
    
    /**
     * 結束時間, "08:00"
     */
    endTime: string;
  };
  
  /**
   * 更新時間
   */
  updatedAt: Timestamp;
} 