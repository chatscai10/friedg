import * as functions from 'firebase-functions';
import * as express from 'express';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { LinePayRequestDto, LinePayConfirmDto, PaymentMethod, PaymentStatus } from './payments.types';
import { linePayService } from '../libs/linepay/linepay.service';

/**
 * 發起 LINE Pay 支付請求
 * 
 * @param req Express 請求
 * @param res Express 回應
 */
export const requestLinePayPayment = async (req: functions.https.Request, res: express.Response) => {
  try {
    const { orderId, language = 'zh-TW' } = req.body as LinePayRequestDto;
    
    // 驗證請求
    if (!orderId) {
      console.error('缺少必要參數: orderId');
      return res.status(400).json({
        success: false,
        error: '缺少必要參數: orderId'
      });
    }

    // 從 Firestore 獲取訂單資訊
    const firestore = admin.firestore();
    const orderDoc = await firestore.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      console.error(`找不到訂單 ID: ${orderId}`);
      return res.status(404).json({
        success: false,
        error: `找不到訂單: ${orderId}`
      });
    }

    const orderData = orderDoc.data();
    
    if (!orderData) {
      console.error(`訂單數據為空: ${orderId}`);
      return res.status(500).json({
        success: false,
        error: '訂單數據為空'
      });
    }

    // 檢查訂單是否已付款
    if (orderData.paymentStatus === 'completed') {
      console.error(`訂單已付款: ${orderId}`);
      return res.status(400).json({
        success: false,
        error: '訂單已付款'
      });
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
    const confirmUrl = `${baseUrl}/payments/complete?orderId=${orderId}`;
    const cancelUrl = `${baseUrl}/orders/${orderId}?paymentCancelled=true`;

    // 創建支付記錄
    const paymentId = uuidv4();
    
    const paymentRecord = {
      id: paymentId,
      orderId,
      amount,
      currency: 'TWD',
      method: PaymentMethod.LINE_PAY,
      status: PaymentStatus.PENDING,
      description: productName,
      userId: orderData.userId,
      tenantId: orderData.tenantId,
      storeId: orderData.storeId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 發起 LINE Pay 請求
    const linePayResult = await linePayService.requestPayment({
      orderId,
      productName,
      amount,
      confirmUrl,
      cancelUrl,
      language,
      orderNote: `訂單 #${orderId}`
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
      await firestore.collection('orders').doc(orderId).update({
        paymentMethod: PaymentMethod.LINE_PAY,
        paymentStatus: PaymentStatus.PROCESSING,
        paymentId,
        paymentTransactionId: linePayResult.transactionId,
        paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 返回成功回應
      return res.status(200).json({
        success: true,
        paymentUrl: linePayResult.paymentUrl,
        transactionId: linePayResult.transactionId,
        orderId
      });
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
      await firestore.collection('orders').doc(orderId).update({
        paymentMethod: PaymentMethod.LINE_PAY,
        paymentStatus: PaymentStatus.FAILED,
        paymentFailureReason: linePayResult.error || '無法獲取 LINE Pay 支付 URL',
        paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 返回錯誤回應
      console.error('LINE Pay 請求失敗:', linePayResult.error);
      return res.status(500).json({
        success: false,
        error: linePayResult.error || '無法獲取 LINE Pay 支付 URL'
      });
    }
  } catch (error) {
    // 處理例外
    console.error('處理 LINE Pay 請求時發生錯誤:', error);
    
    let errorMessage = '處理支付請求時發生未知錯誤';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};

/**
 * 確認 LINE Pay 支付
 * 
 * @param req Express 請求
 * @param res Express 回應
 */
export const confirmLinePayPayment = async (req: functions.https.Request, res: express.Response) => {
  try {
    const { transactionId, orderId } = req.query as unknown as LinePayConfirmDto;
    
    // 驗證請求
    if (!transactionId || !orderId) {
      console.error('缺少必要參數: transactionId 或 orderId');
      return res.status(400).json({
        success: false,
        error: '缺少必要參數: transactionId 或 orderId'
      });
    }

    // 從 Firestore 獲取訂單和支付資訊
    const firestore = admin.firestore();
    const orderDoc = await firestore.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      console.error(`找不到訂單 ID: ${orderId}`);
      return res.status(404).json({
        success: false,
        error: `找不到訂單: ${orderId}`
      });
    }

    const orderData = orderDoc.data();
    
    if (!orderData) {
      console.error(`訂單數據為空: ${orderId}`);
      return res.status(500).json({
        success: false,
        error: '訂單數據為空'
      });
    }

    // 檢查訂單支付狀態
    if (orderData.paymentStatus === PaymentStatus.COMPLETED) {
      console.log(`訂單已完成支付: ${orderId}`);
      return res.status(200).json({
        success: true,
        paymentStatus: PaymentStatus.COMPLETED,
        transactionId,
        orderId
      });
    }

    // 確認交易 ID 是否匹配
    if (orderData.paymentTransactionId !== transactionId) {
      console.error(`交易 ID 不匹配: ${transactionId} vs ${orderData.paymentTransactionId}`);
      return res.status(400).json({
        success: false,
        error: '交易 ID 不匹配'
      });
    }

    // 確認 LINE Pay 交易
    const confirmResult = await linePayService.confirmPayment({
      transactionId,
      orderId,
      amount: orderData.total || 0
    });

    // 處理確認結果
    if (confirmResult.success && confirmResult.paymentStatus === 'completed') {
      // 更新支付記錄
      if (orderData.paymentId) {
        await firestore.collection('payments').doc(orderData.paymentId).update({
          status: PaymentStatus.COMPLETED,
          paymentTime: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 更新訂單狀態
      await firestore.collection('orders').doc(orderId).update({
        paymentStatus: PaymentStatus.COMPLETED,
        status: 'confirmed', // 假設支付完成後訂單狀態為確認
        paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 返回成功回應
      return res.status(200).json({
        success: true,
        paymentStatus: PaymentStatus.COMPLETED,
        transactionId,
        orderId
      });
    } else {
      // 更新支付記錄為失敗
      if (orderData.paymentId) {
        await firestore.collection('payments').doc(orderData.paymentId).update({
          status: PaymentStatus.FAILED,
          failureReason: confirmResult.error || '交易確認失敗',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 更新訂單支付狀態
      await firestore.collection('orders').doc(orderId).update({
        paymentStatus: PaymentStatus.FAILED,
        paymentFailureReason: confirmResult.error || '交易確認失敗',
        paymentUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 返回錯誤回應
      console.error('LINE Pay 確認失敗:', confirmResult.error);
      return res.status(500).json({
        success: false,
        error: confirmResult.error || '交易確認失敗',
        transactionId,
        orderId
      });
    }
  } catch (error) {
    // 處理例外
    console.error('處理 LINE Pay 確認時發生錯誤:', error);
    
    let errorMessage = '處理交易確認時發生未知錯誤';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}; 