// LINE Pay 支付處理模塊
// 此模塊將在後續階段實現 

import * as functions from 'firebase-functions';
import axios from 'axios';
import * as crypto from 'crypto';
import { PayoutRecord, PayoutStatus } from '../types';
import { updatePayoutStatus, updateOriginalRecordStatus } from '../service';
import * as admin from 'firebase-admin';

// 確保 Firebase Admin 被初始化 - 不應在此初始化，應使用 index.ts 中初始化的實例
// try {
//   admin.app();
//   console.log('Firebase已初始化，payments/linepay模組將使用該實例');
// } catch (error) {
//   // 如果未初始化，則在此初始化
//   console.log('Firebase應用尚未初始化，payments/linepay模組將初始化新實例');
//   admin.initializeApp();
// }

// LINE Pay API 設定
const LINE_PAY_API_URL = 'https://api-pay.line.me/v3/payments/transfer';
const db = admin.firestore();

/**
 * 從安全存儲取得 LINE Pay API 密鑰
 * 注意：正式環境應使用 Secret Manager 或環境變數
 */
function getLinePayCredentials() {
  // 在正式環境應使用 Secret Manager 或 Firebase Config
  // 例如：const channelId = functions.config().linepay?.channel_id;
  
  // 模擬用於開發的方法，實際應從安全存儲中獲取
  const channelId = process.env.LINEPAY_CHANNEL_ID || '1234567890';  // 假設的 Channel ID
  const channelSecret = process.env.LINEPAY_CHANNEL_SECRET || 'abcdef1234567890abcdef1234567890'; // 假設的 Secret
  
  // 如果未設置，則記錄警告
  if (channelId === '1234567890' || channelSecret === 'abcdef1234567890abcdef1234567890') {
    console.warn('警告：使用開發用 LINE Pay 憑證，請在生產環境中配置實際憑證');
  }
  
  return { channelId, channelSecret };
}

/**
 * 生成 LINE Pay API 請求所需的簽章
 * @param secret Channel Secret
 * @param nonce 隨機字串
 * @param requestBody 請求主體
 * @returns 簽章字串
 */
function generateSignature(secret: string, nonce: string, requestBody: string): string {
  // 按照 LINE Pay API v3 文檔要求生成簽章：HMAC-SHA256(channelSecret, nonce + requestBody)
  const signatureData = nonce + requestBody;
  const signature = crypto.createHmac('sha256', secret)
                          .update(signatureData)
                          .digest('base64');
  return signature;
}

/**
 * 處理 LINE Pay 支付
 * @param payout 支付記錄
 * @returns 支付處理結果
 */
export async function processLinePayPayout(payout: PayoutRecord): Promise<boolean> {
  try {
    console.log(`開始處理 LINE Pay 支付: ${payout.id}`);
    
    // 確認支付方法是 LINE_PAY
    if (payout.method !== 'LINE_PAY') {
      throw new Error(`不支持的支付方法: ${payout.method}`);
    }
    
    // 獲取 LINE Pay 憑證
    const { channelId, channelSecret } = getLinePayCredentials();
    
    // 生成請求nonce (隨機字串)
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // 構建請求主體
    const requestBody = {
      amount: payout.amount,
      currency: 'TWD',  // 台幣
      orderId: payout.id, // 使用支付記錄ID作為訂單ID
      receiverType: 'USER_ID',
      receiverId: payout.targetIdentifier, // LINE Pay 用戶ID
      description: payout.description || `支付給 ${payout.employeeId}`,
    };
    
    // 將請求主體轉為JSON字串
    const requestBodyString = JSON.stringify(requestBody);
    
    // 生成簽章
    const signature = generateSignature(channelSecret, nonce, requestBodyString);
    
    // 設置請求頭
    const headers = {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': channelId,
      'X-LINE-Authorization-Nonce': nonce,
      'X-LINE-Authorization': signature
    };
    
    // 記錄請求信息（開發調試用，生產環境應移除敏感信息）
    console.log(`LINE Pay 請求信息：${LINE_PAY_API_URL}，訂單ID: ${payout.id}，金額: ${payout.amount}`);
    
    // 發送 API 請求
    const response = await axios.post(LINE_PAY_API_URL, requestBody, { headers });
    
    // 處理響應
    const responseData = response.data;
    
    if (responseData.returnCode === '0000') {
      // 支付成功
      const transactionId = responseData.info.transactionId;
      console.log(`LINE Pay 支付成功，交易ID: ${transactionId}`);
      
      // 更新支付記錄狀態
      await updatePayoutStatus(
        payout.id, 
        PayoutStatus.COMPLETED, 
        `支付成功，交易ID: ${transactionId}`,
        {
          providerPayoutId: transactionId,
          providerResponse: responseData,
          completionTime: new Date()
        }
      );
      
      // 更新原始記錄狀態
      await updateOriginalRecordStatus(payout, 'completed');
      
      return true;
    } else {
      // 支付失敗
      const errorCode = responseData.returnCode;
      const errorMessage = `LINE Pay 支付失敗: ${responseData.returnCode} - ${responseData.returnMessage}`;
      console.error(errorMessage);
      
      // 更新支付記錄狀態
      await updatePayoutStatus(
        payout.id, 
        PayoutStatus.FAILED, 
        errorMessage,
        {
          providerResponse: responseData,
          failureReason: errorMessage
        }
      );
      
      // 更新原始記錄狀態
      await updateOriginalRecordStatus(payout, 'failed');
      
      return false;
    }
  } catch (error) {
    // 處理意外錯誤
    const errorMessage = error instanceof Error 
      ? `LINE Pay 處理錯誤: ${error.message}` 
      : '未知 LINE Pay 處理錯誤';
    console.error(errorMessage);
    
    // 更新支付記錄狀態
    await updatePayoutStatus(
      payout.id, 
      PayoutStatus.FAILED, 
      errorMessage,
      {
        failureReason: errorMessage
      }
    );
    
    // 更新原始記錄狀態
    await updateOriginalRecordStatus(payout, 'failed');
    
    return false;
  }
} 