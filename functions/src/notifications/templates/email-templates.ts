import { NotificationEventType, NotificationChannelType, NotificationTemplate } from '../notification.types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Email通知模板集合
 * 這些模板將在系統初始化時導入到Firestore
 */
export const emailTemplates: NotificationTemplate[] = [
  // 訂單確認通知
  {
    id: 'order-confirmed-email',
    eventType: NotificationEventType.ORDER_CONFIRMED,
    channel: NotificationChannelType.EMAIL,
    language: 'zh-TW',
    title: '您的訂單已確認',
    content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 10px; text-align: center; }
    .content { padding: 20px; border: 1px solid #ddd; }
    .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
    .button { background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>訂單已確認</h2>
    </div>
    <div class="content">
      <p>親愛的顧客您好，</p>
      <p>您的訂單 #{{orderNumber}} 已確認，我們正在為您準備中。</p>
      <p><strong>預計取餐時間：</strong> {{estimatedTime}}</p>
      <p>您可以點擊下方按鈕查看訂單詳情：</p>
      <p style="text-align: center;">
        <a href="{{orderUrl}}" class="button">查看訂單</a>
      </p>
      <p>若有任何問題，請隨時與我們聯繫。</p>
      <p>謝謝您的惠顧！</p>
    </div>
    <div class="footer">
      <p>此為系統自動發送郵件，請勿直接回覆</p>
      <p>© {{currentYear}} {{storeName}}. 版權所有。</p>
    </div>
  </div>
</body>
</html>`,
    variables: ['orderNumber', 'estimatedTime', 'orderUrl', 'currentYear', 'storeName'],
    active: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  
  // 訂單準備完成通知
  {
    id: 'order-ready-email',
    eventType: NotificationEventType.ORDER_READY,
    channel: NotificationChannelType.EMAIL,
    language: 'zh-TW',
    title: '您的訂單已備妥',
    content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2196F3; color: white; padding: 10px; text-align: center; }
    .content { padding: 20px; border: 1px solid #ddd; }
    .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
    .button { background-color: #2196F3; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>訂單已備妥</h2>
    </div>
    <div class="content">
      <p>親愛的顧客您好，</p>
      <p>您在 <strong>{{storeName}}</strong> 的訂單 #{{orderNumber}} 已準備完成，請盡快到店取餐。</p>
      <p>您的訂單已在櫃檯等候您了！</p>
      <p>若有任何問題，請隨時與我們聯繫。</p>
      <p>謝謝您的惠顧！</p>
    </div>
    <div class="footer">
      <p>此為系統自動發送郵件，請勿直接回覆</p>
      <p>© {{currentYear}} {{storeName}}. 版權所有。</p>
    </div>
  </div>
</body>
</html>`,
    variables: ['orderNumber', 'storeName', 'currentYear'],
    active: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  
  // 訂單已取消通知
  {
    id: 'order-cancelled-email',
    eventType: NotificationEventType.ORDER_CANCELLED,
    channel: NotificationChannelType.EMAIL,
    language: 'zh-TW',
    title: '您的訂單已取消',
    content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #F44336; color: white; padding: 10px; text-align: center; }
    .content { padding: 20px; border: 1px solid #ddd; }
    .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
    .button { background-color: #607D8B; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>訂單已取消</h2>
    </div>
    <div class="content">
      <p>親愛的顧客您好，</p>
      <p>您的訂單 #{{orderNumber}} 已被取消。</p>
      <p><strong>取消原因：</strong> {{reason}}</p>
      <p>若您有任何疑問，請與我們的客服團隊聯繫，或點擊下方按鈕重新下單：</p>
      <p style="text-align: center;">
        <a href="{{reorderUrl}}" class="button">重新訂購</a>
      </p>
      <p>感謝您的理解與支持。</p>
    </div>
    <div class="footer">
      <p>此為系統自動發送郵件，請勿直接回覆</p>
      <p>© {{currentYear}} {{storeName}}. 版權所有。</p>
    </div>
  </div>
</body>
</html>`,
    variables: ['orderNumber', 'reason', 'reorderUrl', 'currentYear', 'storeName'],
    active: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  
  // 訂單開始配送通知
  {
    id: 'order-delivering-email',
    eventType: NotificationEventType.ORDER_DELIVERING,
    channel: NotificationChannelType.EMAIL,
    language: 'zh-TW',
    title: '您的訂單正在配送中',
    content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #FF9800; color: white; padding: 10px; text-align: center; }
    .content { padding: 20px; border: 1px solid #ddd; }
    .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
    .courier-info { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .button { background-color: #FF9800; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>訂單配送中</h2>
    </div>
    <div class="content">
      <p>親愛的顧客您好，</p>
      <p>您的訂單 #{{orderNumber}} 正在配送中。</p>
      <div class="courier-info">
        <p><strong>配送員：</strong> {{courierName}}</p>
        <p><strong>預計送達時間：</strong> {{estimatedDeliveryTime}}</p>
      </div>
      <p>您可以點擊下方按鈕查看配送狀態：</p>
      <p style="text-align: center;">
        <a href="{{trackingUrl}}" class="button">追蹤訂單</a>
      </p>
      <p>感謝您的惠顧！</p>
    </div>
    <div class="footer">
      <p>此為系統自動發送郵件，請勿直接回覆</p>
      <p>© {{currentYear}} {{storeName}}. 版權所有。</p>
    </div>
  </div>
</body>
</html>`,
    variables: ['orderNumber', 'courierName', 'estimatedDeliveryTime', 'trackingUrl', 'currentYear', 'storeName'],
    active: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }
];

/**
 * 獲取所有Email模板
 * @returns Email模板數組
 */
export function getEmailTemplates(): NotificationTemplate[] {
  return emailTemplates;
}

/**
 * 根據事件類型和語言獲取Email模板
 * @param eventType 事件類型
 * @param language 語言代碼
 * @returns 對應的通知模板，如果找不到則返回null
 */
export function getEmailTemplateByEvent(
  eventType: NotificationEventType,
  language: string = 'zh-TW'
): NotificationTemplate | null {
  return emailTemplates.find(
    template => template.eventType === eventType && 
                template.language === language && 
                template.active
  ) || null;
} 