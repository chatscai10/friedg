/**
 * 支付系統API
 * 標準化修復版本，統一使用新版Firebase Functions API
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { getUserInfoFromClaims } from '../libs/rbac';
import { hasPermission } from '../libs/rbac/core/permission';
import { linePayService } from '../libs/linepay/linepay.service';
import { PaymentMethod, PaymentStatus } from './payments.types';
import { validateData } from '../libs/validation/schema';
import {
  LinePayRequestSchema,
  LinePayConfirmSchema,
  PaymentStatusQuerySchema,
  CancelPaymentSchema
} from './schemas/payment.schema';

// 設定函數區域
const region = 'asia-east1';

/**
 * 請求 LINE Pay 支付 - 標準化API簽名
 */
export const requestLinePayment = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證並轉換請求資料
    const validatedData = validateData(data, LinePayRequestSchema);

    // 從 Firestore 獲取訂單資訊
    const firestore = admin.firestore();
    const orderDoc = await firestore.collection('orders').doc(validatedData.orderId).get();
    
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `找不到訂單: ${validatedData.orderId}`
      );
    }

    const orderData = orderDoc.data();
    
    if (!orderData) {
      throw new functions.https.HttpsError(
        'internal',
        '訂單數據為空'
      );
    }

    // 檢查訂單是否已付款
    if (orderData.paymentStatus === 'completed') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        '訂單已付款'
      );
    }

    // 檢查權限
    if (context.auth) {
      const userInfo = await getUserInfoFromClaims(context.auth.token);
      
      if (userInfo) {
        // 顧客只能支付自己的訂單
        if (userInfo.role === 'customer' && orderData.customerId !== userInfo.uid) {
          throw new functions.https.HttpsError(
            'permission-denied',
            '無權為此訂單發起支付'
          );
        }
        
        // 如果是商店員工等，檢查是否有權限處理該店鋪的訂單
        if (userInfo.role !== 'customer' && userInfo.role !== 'super_admin') {
          const permissionResult = await hasPermission(
            userInfo,
            { action: 'update', resource: 'orders', resourceId: validatedData.orderId },
            { storeId: orderData.storeId, tenantId: orderData.tenantId }
          );
          
          if (!permissionResult.granted) {
            throw new functions.https.HttpsError(
              'permission-denied',
              permissionResult.reason || '無權為此訂單發起支付'
            );
          }
        }
      }
    }

    // 準備 LINE Pay 請求參數
    const amount = orderData.total || 0;
    const productName = orderData.items?.length > 0 
      ? `${orderData.items[0].name} 等 ${orderData.items.length} 項商品`
      : '訂單商品';

    // 獲取應用配置 (跳轉 URL)
    const appConfig = (await firestore.collection('configurations').doc('app').get()).data() || {};
    const baseUrl = appConfig.baseUrl || 'https://your-domain.com';
    
    // 設定支付完成和取消後的跳轉 URL
    const confirmUrl = `${baseUrl}/payments/complete?orderId=${validatedData.orderId}`;
    const cancelUrl = `${baseUrl}/orders/${validatedData.orderId}?paymentCancelled=true`;

    // 創建支付記錄
    const paymentId = uuidv4();
    
    const paymentRecord = {
      id: paymentId,
      orderId: validatedData.orderId,
      amount,
      currency: 'TWD',
      method: PaymentMethod.LINE_PAY,
      status: PaymentStatus.PENDING,
      description: productName,
      userId: orderData.customerId,
      tenantId: orderData.tenantId,
      storeId: orderData.storeId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth?.uid || 'anonymous'
    };

    // 發起 LINE Pay 請求
    const linePayResult = await linePayService.requestPayment({
      orderId: validatedData.orderId,
      productName,
      amount,
      confirmUrl,
      cancelUrl,
      language: validatedData.language,
      orderNote: `訂單 #${validatedData.orderId}`
    });

    // 處理 LINE Pay 回應
    if (linePayResult.success && linePayResult.paymentUrl && linePayResult.transactionId) {
      // 更新支付記錄
      const updatedPaymentRecord = {
        ...paymentRecord,
        externalTransactionId: linePayResult.transactionId,
        status: PaymentStatus.PROCESSING
      };

      // 將支付記錄儲存到 Firestore
      await firestore.collection('payments').doc(paymentId).set(updatedPaymentRecord);

      // 更新訂單支付狀態
      await firestore.collection('orders').doc(validatedData.orderId).update({
        paymentMethod: PaymentMethod.LINE_PAY,
        paymentStatus: PaymentStatus.PROCESSING,
        paymentId,
        paymentTransactionId: linePayResult.transactionId,
        paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 返回成功回應
      return {
        success: true,
        paymentUrl: linePayResult.paymentUrl,
        transactionId: linePayResult.transactionId,
        orderId: validatedData.orderId
      };
    } else {
      // 更新支付記錄為失敗
      const updatedPaymentRecord = {
        ...paymentRecord,
        status: PaymentStatus.FAILED,
        failureReason: linePayResult.error || '無法獲取 LINE Pay 支付 URL'
      };

      // 將支付記錄儲存到 Firestore
      await firestore.collection('payments').doc(paymentId).set(updatedPaymentRecord);

      // 更新訂單支付狀態
      await firestore.collection('orders').doc(validatedData.orderId).update({
        paymentMethod: PaymentMethod.LINE_PAY,
        paymentStatus: PaymentStatus.FAILED,
        paymentFailureReason: linePayResult.error || '無法獲取 LINE Pay 支付 URL',
        paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 返回錯誤回應
      throw new functions.https.HttpsError(
        'internal',
        linePayResult.error || '無法獲取 LINE Pay 支付 URL'
      );
    }
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `發起 LINE Pay 支付失敗: ${errorMessage}`
    );
  }
});

/**
 * 確認 LINE Pay 支付 - 標準化API簽名
 */
export const confirmLinePayment = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證並轉換請求資料
    const validatedData = validateData(data, LinePayConfirmSchema);

    // 從 Firestore 獲取訂單和支付資訊
    const firestore = admin.firestore();
    const orderDoc = await firestore.collection('orders').doc(validatedData.orderId).get();
    
    if (!orderDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `找不到訂單: ${validatedData.orderId}`
      );
    }

    const orderData = orderDoc.data();
    
    if (!orderData) {
      throw new functions.https.HttpsError(
        'internal',
        '訂單數據為空'
      );
    }

    // 檢查訂單支付狀態
    if (orderData.paymentStatus === PaymentStatus.COMPLETED) {
      return {
        success: true,
        paymentStatus: PaymentStatus.COMPLETED,
        transactionId: validatedData.transactionId,
        orderId: validatedData.orderId
      };
    }

    // 確認交易 ID 是否匹配
    if (orderData.paymentTransactionId !== validatedData.transactionId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        '交易 ID 不匹配'
      );
    }

    // 檢查權限
    if (context.auth) {
      const userInfo = await getUserInfoFromClaims(context.auth.token);
      
      if (userInfo) {
        // 顧客只能確認自己的訂單支付
        if (userInfo.role === 'customer' && orderData.customerId !== userInfo.uid) {
          throw new functions.https.HttpsError(
            'permission-denied',
            '無權確認此訂單支付'
          );
        }
        
        // 如果是商店員工等，檢查是否有權限處理該店鋪的訂單
        if (userInfo.role !== 'customer' && userInfo.role !== 'super_admin') {
          const permissionResult = await hasPermission(
            userInfo,
            { action: 'update', resource: 'orders', resourceId: validatedData.orderId },
            { storeId: orderData.storeId, tenantId: orderData.tenantId }
          );
          
          if (!permissionResult.granted) {
            throw new functions.https.HttpsError(
              'permission-denied',
              permissionResult.reason || '無權確認此訂單支付'
            );
          }
        }
      }
    }

    // 確認 LINE Pay 交易
    const confirmResult = await linePayService.confirmPayment({
      transactionId: validatedData.transactionId,
      orderId: validatedData.orderId,
      amount: orderData.total || 0
    });

    // 處理確認結果
    if (confirmResult.success && confirmResult.paymentStatus === 'completed') {
      // 更新支付記錄
      if (orderData.paymentId) {
        await firestore.collection('payments').doc(orderData.paymentId).update({
          status: PaymentStatus.COMPLETED,
          paymentTime: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: context.auth?.uid || 'system'
        });
      }

      // 更新訂單狀態
      await firestore.collection('orders').doc(validatedData.orderId).update({
        paymentStatus: PaymentStatus.COMPLETED,
        status: 'confirmed', // 假設支付完成後訂單狀態為確認
        paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth?.uid || 'system'
      });

      // 返回成功回應
      return {
        success: true,
        paymentStatus: PaymentStatus.COMPLETED,
        transactionId: validatedData.transactionId,
        orderId: validatedData.orderId
      };
    } else {
      // 更新支付記錄為失敗
      if (orderData.paymentId) {
        await firestore.collection('payments').doc(orderData.paymentId).update({
          status: PaymentStatus.FAILED,
          failureReason: confirmResult.error || '交易確認失敗',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: context.auth?.uid || 'system'
        });
      }

      // 更新訂單支付狀態
      await firestore.collection('orders').doc(validatedData.orderId).update({
        paymentStatus: PaymentStatus.FAILED,
        paymentFailureReason: confirmResult.error || '交易確認失敗',
        paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth?.uid || 'system'
      });

      // 返回錯誤回應
      throw new functions.https.HttpsError(
        'internal',
        confirmResult.error || '交易確認失敗'
      );
    }
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `確認支付失敗: ${errorMessage}`
    );
  }
});

/**
 * 獲取支付狀態 - 標準化API簽名
 */
export const getPaymentStatus = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證並轉換請求資料
    const validatedData = validateData(data, PaymentStatusQuerySchema);

    // 從 Firestore 獲取支付資訊
    const firestore = admin.firestore();
    let paymentDoc;
    
    if (validatedData.paymentId) {
      // 如果提供了支付ID，直接獲取支付記錄
      paymentDoc = await firestore.collection('payments').doc(validatedData.paymentId).get();
    } else {
      // 如果只提供了訂單ID，獲取訂單後查詢其支付記錄
      const orderDoc = await firestore.collection('orders').doc(validatedData.orderId!).get();
      
      if (!orderDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `找不到訂單: ${validatedData.orderId}`
        );
      }
      
      const orderData = orderDoc.data();
      
      if (!orderData || !orderData.paymentId) {
        return {
          success: true,
          orderId: validatedData.orderId,
          paymentStatus: orderData?.paymentStatus || 'unknown',
          message: orderData?.paymentId ? '此訂單未關聯支付記錄' : '此訂單未執行支付'
        };
      }
      
      paymentDoc = await firestore.collection('payments').doc(orderData.paymentId).get();
    }
    
    if (!paymentDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `找不到支付記錄: ${validatedData.paymentId || '未知'}`
      );
    }
    
    const paymentData = paymentDoc.data();
    
    // 檢查權限
    if (context.auth) {
      const userInfo = await getUserInfoFromClaims(context.auth.token);
      
      if (userInfo && paymentData) {
        // 顧客只能查看自己的訂單支付
        if (userInfo.role === 'customer' && paymentData.userId !== userInfo.uid) {
          throw new functions.https.HttpsError(
            'permission-denied',
            '無權查看此支付記錄'
          );
        }
        
        // 如果是商店員工等，檢查是否有權限處理該店鋪的支付
        if (userInfo.role !== 'customer' && userInfo.role !== 'super_admin') {
          const permissionResult = await hasPermission(
            userInfo,
            { action: 'read', resource: 'payments' },
            { storeId: paymentData.storeId, tenantId: paymentData.tenantId }
          );
          
          if (!permissionResult.granted) {
            throw new functions.https.HttpsError(
              'permission-denied',
              permissionResult.reason || '無權查看此支付記錄'
            );
          }
        }
      }
    }
    
    return {
      success: true,
      paymentId: paymentDoc.id,
      orderId: paymentData?.orderId,
      paymentStatus: paymentData?.status || 'unknown',
      amount: paymentData?.amount,
      currency: paymentData?.currency,
      method: paymentData?.method,
      createdAt: paymentData?.createdAt,
      updatedAt: paymentData?.updatedAt
    };
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `獲取支付狀態失敗: ${errorMessage}`
    );
  }
});

/**
 * 取消支付 - 標準化API簽名
 */
export const cancelPayment = functions.region(region).https.onCall(async (data, context) => {
  try {
    // 驗證並轉換請求資料
    const validatedData = validateData(data, CancelPaymentSchema);
    
    // 確保用戶已認證
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '必須登入才能取消支付'
      );
    }
    
    // 獲取用戶資訊
    const userInfo = await getUserInfoFromClaims(context.auth.token);
    
    if (!userInfo) {
      throw new functions.https.HttpsError(
        'permission-denied',
        '無法獲取用戶權限資訊'
      );
    }

    // 從 Firestore 獲取支付和訂單資訊
    const firestore = admin.firestore();
    let paymentData;
    let orderData;
    let paymentId = validatedData.paymentId;
    
    if (validatedData.paymentId) {
      // 如果提供了支付ID，獲取支付記錄
      const paymentDoc = await firestore.collection('payments').doc(validatedData.paymentId).get();
      
      if (!paymentDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `找不到支付記錄: ${validatedData.paymentId}`
        );
      }
      
      paymentData = paymentDoc.data();
      
      // 獲取關聯的訂單
      if (paymentData?.orderId) {
        const orderDoc = await firestore.collection('orders').doc(paymentData.orderId).get();
        if (orderDoc.exists) {
          orderData = orderDoc.data();
        }
      }
    } else if (validatedData.orderId) {
      // 如果提供了訂單ID，獲取訂單
      const orderDoc = await firestore.collection('orders').doc(validatedData.orderId).get();
      
      if (!orderDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `找不到訂單: ${validatedData.orderId}`
        );
      }
      
      orderData = orderDoc.data();
      
      // 獲取關聯的支付記錄
      if (orderData?.paymentId) {
        const paymentDoc = await firestore.collection('payments').doc(orderData.paymentId).get();
        if (paymentDoc.exists) {
          paymentData = paymentDoc.data();
          paymentId = orderData.paymentId;
        }
      }
    }
    
    // 檢查支付狀態，只有待處理或處理中的支付可以取消
    if (paymentData && paymentData.status !== PaymentStatus.PENDING && paymentData.status !== PaymentStatus.PROCESSING) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        '只能取消待處理或處理中的支付'
      );
    }
    
    // 檢查權限
    if (orderData) {
      // 顧客只能取消自己的訂單支付
      if (userInfo.role === 'customer' && orderData.customerId !== userInfo.uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          '無權取消此支付'
        );
      }
      
      // 如果是商店員工等，檢查是否有權限處理該店鋪的訂單
      if (userInfo.role !== 'customer' && userInfo.role !== 'super_admin') {
        const permissionResult = await hasPermission(
          userInfo,
          { action: 'update', resource: 'orders', resourceId: orderData.id },
          { storeId: orderData.storeId, tenantId: orderData.tenantId }
        );
        
        if (!permissionResult.granted) {
          throw new functions.https.HttpsError(
            'permission-denied',
            permissionResult.reason || '無權取消此支付'
          );
        }
      }
      
      // 執行取消操作
      if (paymentData && paymentId) {
        // 如果是LINE Pay，呼叫LINE Pay API取消交易
        if (paymentData.method === PaymentMethod.LINE_PAY && paymentData.externalTransactionId) {
          try {
            // 這裡應該呼叫LINE Pay的取消API
            // 此處省略實際實現
            // await linePayService.cancelPayment(paymentData.externalTransactionId);
          } catch (cancelError) {
            console.error('取消LINE Pay交易失敗:', cancelError);
            // 繼續執行，因為我們仍然需要更新資料庫狀態
          }
        }
        
        // 更新支付記錄
        await firestore.collection('payments').doc(paymentId).update({
          status: PaymentStatus.CANCELLED,
          cancelReason: validatedData.reason || '用戶取消',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: userInfo.uid
        });
      }
      
      // 更新訂單狀態
      await firestore.collection('orders').doc(orderData.id).update({
        paymentStatus: PaymentStatus.CANCELLED,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userInfo.uid
      });
      
      return {
        success: true,
        message: '支付已取消',
        orderId: orderData.id,
        paymentId
      };
    } else {
      throw new functions.https.HttpsError(
        'not-found',
        '找不到有效的訂單或支付記錄'
      );
    }
  } catch (error) {
    // 定義通用錯誤訊息
    let errorMessage = "發生未知錯誤";
    // 檢查 error 是否為 Error 的實例
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      `取消支付失敗: ${errorMessage}`
    );
  }
}); 