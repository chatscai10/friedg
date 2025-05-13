import axios from 'axios';
import { authService } from './authService';

/**
 * LINE Pay 支付請求返回結果
 */
interface LinePayRequestResponse {
  success: boolean;
  paymentUrl?: string;
  transactionId?: string;
  error?: string;
}

/**
 * 發起 LINE Pay 支付請求
 * 
 * @param orderId 訂單ID
 * @returns 支付請求結果，包含支付URL和交易ID
 */
export const requestLinePayPayment = async (orderId: string): Promise<LinePayRequestResponse> => {
  try {
    // 獲取用戶認證 Token
    const idToken = await authService.getAuthToken(true);
    
    if (!idToken) {
      return {
        success: false,
        error: '用戶未登入或無法獲取身份認證'
      };
    }
    
    // 設置請求頭
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    };
    
    // 發送請求到後端API
    const response = await axios.post(
      '/api/payments/linepay/request',
      { orderId, language: 'zh-TW' },
      { headers }
    );
    
    // 返回處理結果
    const data = response.data;
    if (data.success && data.paymentUrl && data.transactionId) {
      return {
        success: true,
        paymentUrl: data.paymentUrl,
        transactionId: data.transactionId
      };
    } else {
      return {
        success: false,
        error: '支付請求處理失敗'
      };
    }
  } catch (error) {
    console.error('LINE Pay 支付請求發生錯誤:', error);
    
    // 格式化錯誤訊息
    let errorMessage = '處理支付請求時發生未知錯誤';
    
    if (axios.isAxiosError(error) && error.response) {
      // API 返回的錯誤
      errorMessage = error.response.data?.error || '伺服器返回錯誤';
    } else if (error instanceof Error) {
      // JavaScript 錯誤
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}; 