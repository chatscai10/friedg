import { NotificationEventType, NotificationChannelType, NotificationTemplate } from '../notification.types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * SMS通知模板集合
 * 這些模板將在系統初始化時導入到Firestore
 */
export const smsTemplates: NotificationTemplate[] = [
  // 訂單確認通知
  {
    id: 'order-confirmed-sms',
    eventType: NotificationEventType.ORDER_CONFIRMED,
    channel: NotificationChannelType.SMS,
    language: 'zh-TW',
    title: '訂單確認', // SMS沒有標題，但為了保持一致性我們仍然定義它
    content: '您好！您的訂單 #{{orderNumber}} 已被確認，正在準備中。預計取餐時間：{{estimatedTime}}。如有疑問請與店家聯繫。',
    variables: ['orderNumber', 'estimatedTime'],
    active: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  
  // 訂單準備完成通知
  {
    id: 'order-ready-sms',
    eventType: NotificationEventType.ORDER_READY,
    channel: NotificationChannelType.SMS,
    language: 'zh-TW',
    title: '訂單已備妥',
    content: '您好！您在{{storeName}}的訂單 #{{orderNumber}} 已準備完成，請盡快到店取餐。謝謝！',
    variables: ['orderNumber', 'storeName'],
    active: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  
  // 訂單已取消通知
  {
    id: 'order-cancelled-sms',
    eventType: NotificationEventType.ORDER_CANCELLED,
    channel: NotificationChannelType.SMS,
    language: 'zh-TW',
    title: '訂單已取消',
    content: '您好！您的訂單 #{{orderNumber}} 已被取消，原因：{{reason}}。如有疑問，請聯繫客服。',
    variables: ['orderNumber', 'reason'],
    active: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  
  // 訂單開始配送通知
  {
    id: 'order-delivering-sms',
    eventType: NotificationEventType.ORDER_DELIVERING,
    channel: NotificationChannelType.SMS,
    language: 'zh-TW',
    title: '訂單配送中',
    content: '您好！您的訂單 #{{orderNumber}} 正由配送員{{courierName}}送往您的地址。預計送達時間：{{estimatedDeliveryTime}}。',
    variables: ['orderNumber', 'courierName', 'estimatedDeliveryTime'],
    active: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }
];

/**
 * 獲取所有SMS模板
 * @returns SMS模板數組
 */
export function getSMSTemplates(): NotificationTemplate[] {
  return smsTemplates;
}

/**
 * 根據事件類型和語言獲取SMS模板
 * @param eventType 事件類型
 * @param language 語言代碼
 * @returns 對應的通知模板，如果找不到則返回null
 */
export function getSMSTemplateByEvent(
  eventType: NotificationEventType,
  language: string = 'zh-TW'
): NotificationTemplate | null {
  return smsTemplates.find(
    template => template.eventType === eventType && 
                template.language === language && 
                template.active
  ) || null;
} 