import * as functions from 'firebase-functions/v1';
import { firestore } from 'firebase-admin';
import { notificationService } from '../notifications/notification.service';
import { NotificationChannelType } from '../notifications/notification.types';

/**
 * 訂單狀態類型
 */
enum OrderStatus {
  PENDING = 'pending',          // 待確認
  CONFIRMED = 'confirmed',      // 已確認
  PREPARING = 'preparing',      // 準備中
  READY = 'ready',              // 可取餐/待配送
  DELIVERING = 'delivering',    // 配送中
  COMPLETED = 'completed',      // 已完成
  CANCELLED = 'cancelled',      // 已取消
  REJECTED = 'rejected'         // 已拒絕
}

/**
 * 訂單狀態變更通知配置
 */
interface OrderStatusNotificationConfig {
  templateId: string;          // 通知模板ID
  notifyCustomer: boolean;     // 是否通知顧客
  notifyStore: boolean;        // 是否通知店家
  priority: 'low' | 'normal' | 'high' | 'critical'; // 通知優先級
}

/**
 * 訂單狀態變更通知配置映射表
 * 定義每種狀態變更應使用的模板ID和通知接收者
 */
const statusChangeNotificationMap: Record<string, OrderStatusNotificationConfig> = {
  // 待確認 -> 已確認
  [`${OrderStatus.PENDING}_${OrderStatus.CONFIRMED}`]: {
    templateId: 'order-confirmed',
    notifyCustomer: true,
    notifyStore: false,
    priority: 'normal'
  },
  // 已確認 -> 準備中
  [`${OrderStatus.CONFIRMED}_${OrderStatus.PREPARING}`]: {
    templateId: 'order-preparing',
    notifyCustomer: true,
    notifyStore: false,
    priority: 'normal'
  },
  // 準備中 -> 可取餐/待配送
  [`${OrderStatus.PREPARING}_${OrderStatus.READY}`]: {
    templateId: 'order-ready',
    notifyCustomer: true,
    notifyStore: false,
    priority: 'high'
  },
  // 可取餐 -> 配送中
  [`${OrderStatus.READY}_${OrderStatus.DELIVERING}`]: {
    templateId: 'order-delivering',
    notifyCustomer: true,
    notifyStore: false,
    priority: 'normal'
  },
  // 配送中 -> 已完成
  [`${OrderStatus.DELIVERING}_${OrderStatus.COMPLETED}`]: {
    templateId: 'order-completed',
    notifyCustomer: true,
    notifyStore: false,
    priority: 'normal'
  },
  // 可取餐 -> 已完成 (自取訂單)
  [`${OrderStatus.READY}_${OrderStatus.COMPLETED}`]: {
    templateId: 'order-completed',
    notifyCustomer: true,
    notifyStore: false,
    priority: 'normal'
  },
  // 任何狀態 -> 已取消
  [`any_${OrderStatus.CANCELLED}`]: {
    templateId: 'order-cancelled',
    notifyCustomer: true,
    notifyStore: true,
    priority: 'high'
  },
  // 待確認 -> 已拒絕
  [`${OrderStatus.PENDING}_${OrderStatus.REJECTED}`]: {
    templateId: 'order-rejected',
    notifyCustomer: true,
    notifyStore: false,
    priority: 'high'
  }
};

/**
 * 檢查當前時間是否在勿擾時段內
 * @param quietHours 勿擾時段設置
 * @returns 如果在勿擾時段內返回true，否則返回false
 */
function isInQuietHours(quietHours: { enabled: boolean; startTime: string; endTime: string }): boolean {
  if (!quietHours.enabled) {
    return false;
  }

  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTime = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
  
  const [startHours, startMinutes] = quietHours.startTime.split(':').map(Number);
  const [endHours, endMinutes] = quietHours.endTime.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  const currentTotalMinutes = currentHours * 60 + currentMinutes;
  
  // 處理跨夜的勿擾時段 (例如 22:00 - 08:00)
  if (startTotalMinutes > endTotalMinutes) {
    return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes;
  } else {
    return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
  }
}

/**
 * 監聽訂單狀態變更並觸發通知
 */
export const onOrderUpdate = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    try {
      const orderId = context.params.orderId;
      console.log(`訂單更新觸發: ${orderId}`);
      
      const beforeData = change.before.data();
      const afterData = change.after.data();
      
      // 檢查狀態是否發生變化
      if (beforeData.status === afterData.status) {
        console.log(`訂單 ${orderId} 的狀態未變更，跳過通知處理`);
        return null;
      }
      
      const oldStatus = beforeData.status;
      const newStatus = afterData.status;
      
      console.log(`訂單 ${orderId} 狀態從 ${oldStatus} 變更為 ${newStatus}`);
      
      // 檢查是否需要發送通知
      let statusChangeKey = `${oldStatus}_${newStatus}`;
      let notificationConfig = statusChangeNotificationMap[statusChangeKey];
      
      // 如果沒有找到特定的狀態變更配置，檢查是否有通用的 "any_" 配置
      if (!notificationConfig) {
        statusChangeKey = `any_${newStatus}`;
        notificationConfig = statusChangeNotificationMap[statusChangeKey];
      }
      
      // 如果沒有配置，則不需要發送通知
      if (!notificationConfig) {
        console.log(`訂單 ${orderId} 的狀態變更 ${oldStatus} -> ${newStatus} 無需發送通知`);
        return null;
      }
      
      // 準備通知數據
      const { userId, orderNumber, storeId, items, total, deliveryAddress, 
              pickupTime, deliveryTime, orderType, paymentMethod } = afterData;
              
      // 獲取商店信息
      const storeDoc = await firestore().collection('stores').doc(storeId).get();
      const storeData = storeDoc.exists ? storeDoc.data() : null;
      
      // 獲取用戶信息
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      
      if (!userData) {
        console.error(`找不到訂單 ${orderId} 的用戶信息，用戶ID: ${userId}`);
        return null;
      }
      
      // 檢查用戶的通知偏好設置
      const userPrefs = userData.notificationPreferences || {};
      const quietHours = userPrefs.quietHours || { enabled: false, startTime: '22:00', endTime: '08:00' };
      
      // 如果在勿擾時段，並且不是高優先級或嚴重通知，則跳過
      if (isInQuietHours(quietHours) && 
          (notificationConfig.priority !== 'high' && notificationConfig.priority !== 'critical')) {
        console.log(`訂單 ${orderId} 的狀態變更通知將延遲發送：用戶當前處於勿擾時段`);
        // 在這裡可以將通知存入一個延遲隊列，以便稍後發送
        return null;
      }
      
      // 檢查用戶是否訂閱了訂單更新通知
      if (userPrefs.orderUpdates === false) {
        console.log(`用戶 ${userId} 已關閉訂單更新通知，跳過發送`);
        return null;
      }
      
      // 發送通知給顧客
      if (notificationConfig.notifyCustomer) {
        // 準備模板數據
        const templateData = {
          userName: userData.displayName || userData.firstName || '親愛的顧客',
          orderNumber,
          orderTotal: total.toFixed(2),
          storeName: storeData ? storeData.name : '我們的店家',
          items: items.map((item: any) => `${item.name} x ${item.quantity}`).join(', '),
          pickupTime: pickupTime || '',
          deliveryTime: deliveryTime || '',
          deliveryAddress: deliveryAddress ? 
            `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.postalCode}` : '',
          orderType: orderType === 'delivery' ? '外送' : '自取',
          paymentMethod: paymentMethod === 'creditCard' ? '信用卡' : '現金',
          orderStatus: newStatus === 'confirmed' ? '已確認' : 
                       newStatus === 'preparing' ? '準備中' :
                       newStatus === 'ready' ? '可取餐' :
                       newStatus === 'delivering' ? '配送中' :
                       newStatus === 'completed' ? '已完成' :
                       newStatus === 'cancelled' ? '已取消' :
                       newStatus === 'rejected' ? '已拒絕' : newStatus,
          orderUrl: `https://yourapp.com/orders/${orderId}`,
          supportEmail: 'support@yourapp.com',
          supportPhone: '0800-123-456'
        };
        
        // 決定是否需要發送通知（基於勿擾時段和通知優先級）
        const shouldSendNotification = 
          !isInQuietHours(quietHours) || 
          ['high', 'critical'].includes(notificationConfig.priority);
          
        if (shouldSendNotification) {
          // 獲取用戶的所有通知相關信息
          const userEmail = userData.email;
          const userPhone = userData.phoneNumber || userData.contactInfo?.phone;
          const isHighPriority = ['high', 'critical'].includes(notificationConfig.priority);
          
          // 建立通知發送結果追蹤
          const notificationResults = {
            email: false,
            sms: false,
            push: false
          };
          
          // 1. 發送 Email 通知
          if (userPrefs.channels?.email !== false && userEmail) {
            try {
              // 檢查是否存在對應的 Email 模板
              const emailTemplate = await notificationService.getTemplate(
                notificationConfig.templateId,
                afterData.tenantId
              );
              
              if (emailTemplate && emailTemplate.channels.email) {
                const emailResult = await notificationService.sendEmailWithTemplate(
                  userEmail,
                  notificationConfig.templateId,
                  templateData,
                  afterData.tenantId
                );
                
                notificationResults.email = emailResult.success;
                console.log(`Email 通知狀態 (訂單 ${orderId}): ${emailResult.success ? '成功' : '失敗'}`);
              } else {
                console.log(`無法發送 Email 通知：找不到有效的 Email 模板 (${notificationConfig.templateId})`);
              }
            } catch (error) {
              console.error(`發送 Email 通知失敗:`, error);
            }
          } else {
            console.log(`跳過 Email 通知：用戶未啟用此渠道或未提供 Email (${userId})`);
          }
          
          // 2. 發送 SMS 通知
          if (userPrefs.channels?.sms !== false && userPhone) {
            try {
              // 檢查是否存在對應的 SMS 模板
              const smsTemplate = await notificationService.getTemplate(
                notificationConfig.templateId,
                afterData.tenantId
              );
              
              if (smsTemplate && smsTemplate.channels.sms) {
                const smsResult = await notificationService.sendSms(
                  userPhone,
                  notificationConfig.templateId,
                  templateData,
                  afterData.tenantId
                );
                
                notificationResults.sms = smsResult.success;
                console.log(`SMS 通知狀態 (訂單 ${orderId}): ${smsResult.success ? '成功' : '失敗'}`);
              } else {
                console.log(`無法發送 SMS 通知：找不到有效的 SMS 模板 (${notificationConfig.templateId})`);
              }
            } catch (error) {
              console.error(`發送 SMS 通知失敗:`, error);
            }
          } else {
            console.log(`跳過 SMS 通知：用戶未啟用此渠道或未提供電話號碼 (${userId})`);
          }
          
          // 3. 發送 App Push 通知
          if (userPrefs.channels?.appPush !== false) {
            try {
              // 檢查是否存在對應的 App Push 模板
              const pushTemplate = await notificationService.getTemplate(
                notificationConfig.templateId,
                afterData.tenantId
              );
              
              if (pushTemplate && pushTemplate.channels.appPush) {
                const pushResult = await notificationService.sendPushNotification(
                  userId, // 直接使用用戶ID來查找FCM令牌
                  notificationConfig.templateId,
                  templateData,
                  afterData.tenantId
                );
                
                notificationResults.push = pushResult.success;
                console.log(`App Push 通知狀態 (訂單 ${orderId}): ${pushResult.success ? '成功' : '失敗'}`);
              } else {
                console.log(`無法發送 App Push 通知：找不到有效的 Push 模板 (${notificationConfig.templateId})`);
              }
            } catch (error) {
              console.error(`發送 App Push 通知失敗:`, error);
            }
          } else {
            console.log(`跳過 App Push 通知：用戶未啟用此渠道 (${userId})`);
          }
          
          // 記錄通知發送情況
          console.log(`訂單 ${orderId} 通知發送結果: Email=${notificationResults.email}, SMS=${notificationResults.sms}, Push=${notificationResults.push}`);
          
          // 檢查是否所有通知管道都失敗了
          if (!notificationResults.email && !notificationResults.sms && !notificationResults.push) {
            console.warn(`警告：訂單 ${orderId} 的所有通知渠道均發送失敗，可能需要手動處理`);
            // 這裡可以添加緊急通知邏輯，例如通知系統管理員
          }
        } else {
          console.log(`訂單 ${orderId} 通知不發送：用戶在勿擾時段且通知優先級不高`);
        }
      }
      
      // 發送通知給店家（如果需要）
      if (notificationConfig.notifyStore && storeData) {
        // 獲取店家聯絡資訊
        try {
          // 從店家獲取管理員聯絡資訊
          const storeManagersQuery = await firestore()
            .collection('employees')
            .where('storeId', '==', storeId)
            .where('employmentInfo.roleLevel', '<=', 3) // 假設角色等級 <= 3 為管理級人員
            .where('status', '==', 'active')
            .limit(3) // 限制通知發送給前3位管理人員
            .get();
            
          if (!storeManagersQuery.empty) {
            // 為每位管理員發送通知
            const managerNotificationPromises = storeManagersQuery.docs.map(async (managerDoc) => {
              const managerData = managerDoc.data();
              const managerId = managerDoc.id;
              const managerEmail = managerData.contactInfo?.email;
              const managerPhone = managerData.contactInfo?.phone;
              
              // 準備店家端的模板數據
              const storeTemplateData = {
                userName: managerData.displayName || managerData.firstName || '店家管理員',
                managerName: managerData.displayName || managerData.firstName || '店家管理員',
                orderNumber,
                orderTotal: total.toFixed(2),
                storeName: storeData ? storeData.name : '我們的店家',
                items: items.map((item: any) => `${item.name} x ${item.quantity}`).join(', '),
                pickupTime: pickupTime || '',
                deliveryTime: deliveryTime || '',
                deliveryAddress: deliveryAddress ? 
                  `${deliveryAddress.street}, ${deliveryAddress.city}, ${deliveryAddress.postalCode}` : '',
                orderType: orderType === 'delivery' ? '外送' : '自取',
                paymentMethod: paymentMethod === 'creditCard' ? '信用卡' : '現金',
                orderStatus: newStatus === 'confirmed' ? '已確認' : 
                            newStatus === 'preparing' ? '準備中' :
                            newStatus === 'ready' ? '可取餐' :
                            newStatus === 'delivering' ? '配送中' :
                            newStatus === 'completed' ? '已完成' :
                            newStatus === 'cancelled' ? '已取消' :
                            newStatus === 'rejected' ? '已拒絕' : newStatus,
                orderDetailUrl: `https://admin.yourapp.com/orders/${orderId}`,
                supportEmail: 'support@yourapp.com',
                supportPhone: '0800-123-456'
              };
              
              // 只嘗試發送推播通知給店家管理員
              try {
                const pushTemplate = await notificationService.getTemplate(
                  notificationConfig.templateId + '-store', // 例如：'order-cancelled-store'
                  afterData.tenantId
                );
                
                if (pushTemplate && pushTemplate.channels.appPush) {
                  await notificationService.sendPushNotification(
                    managerId,
                    notificationConfig.templateId + '-store',
                    storeTemplateData,
                    afterData.tenantId
                  );
                  
                  console.log(`已發送店家 App Push 通知給管理員 ${managerId} 關於訂單 ${orderId}`);
                }
              } catch (error) {
                console.error(`發送店家通知失敗 (${managerId}):`, error);
              }
            });
            
            await Promise.all(managerNotificationPromises);
          } else {
            console.warn(`店家 ${storeId} 沒有活躍的管理人員，無法發送通知`);
          }
        } catch (error) {
          console.error(`獲取店家管理員資訊失敗:`, error);
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('處理訂單狀態變更通知時出錯:', error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });

/**
 * 在 index.ts 中導出此觸發器
 * 
 * // 在 functions/src/index.ts 中添加：
 * import { onOrderUpdate } from './orders/orders.triggers';
 * 
 * export const orderStatusChangeNotification = onOrderUpdate;
 */ 