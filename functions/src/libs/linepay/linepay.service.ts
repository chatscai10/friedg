import * as functions from 'firebase-functions';
import axios, { AxiosResponse } from 'axios';
import * as CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';

/**
 * LINE Pay API 版本
 */
export const LINE_PAY_API_VERSION = 'v3';

/**
 * LINE Pay 環境
 */
export enum LinePayEnvironment {
  SANDBOX = 'sandbox',
  PRODUCTION = 'production'
}

/**
 * LINE Pay 訂單請求選項
 */
export interface LinePayRequestOptions {
  /**
   * 訂單ID
   */
  orderId: string;

  /**
   * 商品名稱
   */
  productName: string;

  /**
   * 交易金額
   */
  amount: number;

  /**
   * 交易貨幣 (預設 TWD)
   */
  currency?: string;

  /**
   * 付款完成後的確認URL
   */
  confirmUrl: string;

  /**
   * 付款取消後的取消URL
   */
  cancelUrl: string;

  /**
   * 付款頁面語言
   */
  language?: string;

  /**
   * 訂單備註
   */
  orderNote?: string;

  /**
   * 付款過期時間 (分鐘)
   */
  paymentExpiryMinutes?: number;
}

/**
 * LINE Pay 請求結果
 */
export interface LinePayRequestResult {
  /**
   * 請求是否成功
   */
  success: boolean;

  /**
   * 支付URL (如果成功)
   */
  paymentUrl?: string;

  /**
   * 交易ID (如果成功)
   */
  transactionId?: string;

  /**
   * 錯誤訊息 (如果失敗)
   */
  error?: string;

  /**
   * LINE Pay 原始回應
   */
  response?: any;
}

/**
 * LINE Pay 確認交易選項
 */
export interface LinePayConfirmOptions {
  /**
   * 交易ID
   */
  transactionId: string;

  /**
   * 訂單ID
   */
  orderId: string;

  /**
   * 交易金額
   */
  amount: number;

  /**
   * 交易貨幣 (預設 TWD)
   */
  currency?: string;
}

/**
 * LINE Pay 確認結果
 */
export interface LinePayConfirmResult {
  /**
   * 確認是否成功
   */
  success: boolean;

  /**
   * 付款狀態
   */
  paymentStatus?: string;

  /**
   * 交易ID
   */
  transactionId?: string;

  /**
   * 訂單ID
   */
  orderId?: string;

  /**
   * 錯誤訊息 (如果失敗)
   */
  error?: string;

  /**
   * LINE Pay 原始回應
   */
  response?: any;
}

/**
 * LINE Pay 服務
 * 
 * 實作與 LINE Pay API 的互動
 */
export class LinePayService {
  private readonly baseUrl: string;
  private readonly channelId: string;
  private readonly channelSecretKey: string;

  /**
   * 建構函數
   */
  constructor(
    channelId: string,
    channelSecretKey: string,
    environment: LinePayEnvironment = LinePayEnvironment.SANDBOX
  ) {
    this.channelId = channelId;
    this.channelSecretKey = channelSecretKey;
    
    // 設定 API 基礎 URL
    if (environment === LinePayEnvironment.PRODUCTION) {
      this.baseUrl = `https://api-pay.line.me/${LINE_PAY_API_VERSION}`;
    } else {
      this.baseUrl = `https://sandbox-api-pay.line.me/${LINE_PAY_API_VERSION}`;
    }
  }

  /**
   * 獲取 LINE Pay 服務實例
   */
  static getInstance(environment: LinePayEnvironment = LinePayEnvironment.SANDBOX): LinePayService {
    try {
      const linePayConfig = functions.config().linepay || {};
      const channelId = linePayConfig.channel_id || '';
      const channelSecretKey = linePayConfig.channel_secret || '';

      if (!channelId || !channelSecretKey) {
        throw new Error('LINE Pay 配置不完整，請檢查 Firebase Functions 配置中的 linepay.channel_id 和 linepay.channel_secret');
      }

      return new LinePayService(channelId, channelSecretKey, environment);
    } catch (error) {
      console.error('初始化 LINE Pay 服務失敗:', error);
      throw error;
    }
  }

  /**
   * 建立 LINE Pay 請求 (Request API)
   * 
   * @param options 請求選項
   * @returns 請求結果
   */
  async requestPayment(options: LinePayRequestOptions): Promise<LinePayRequestResult> {
    try {
      // 設定預設值
      const { 
        orderId, 
        productName, 
        amount, 
        currency = 'TWD', 
        confirmUrl, 
        cancelUrl,
        language = 'zh-TW',
        orderNote = '',
        paymentExpiryMinutes = 60
      } = options;

      // 準備請求資料
      const requestUri = '/payments/request';
      const apiUrl = `${this.baseUrl}${requestUri}`;
      
      // 生成過期時間
      const paymentExpiry = new Date();
      paymentExpiry.setMinutes(paymentExpiry.getMinutes() + paymentExpiryMinutes);
      
      // 建立請求體
      const requestBody = {
        amount,
        currency,
        orderId,
        packages: [
          {
            id: orderId,
            amount,
            name: productName,
            products: [
              {
                name: productName,
                quantity: 1,
                price: amount
              }
            ]
          }
        ],
        redirectUrls: {
          confirmUrl,
          cancelUrl
        },
        options: {
          payment: {
            paymentExpiry: {
              type: 'ABSOLUTE',
              date: paymentExpiry.toISOString()
            }
          },
          display: {
            locale: language
          }
        },
        orderNote
      };

      // 生成簽名
      const nonce = uuidv4();
      const requestBodyString = JSON.stringify(requestBody);
      const signature = this.generateSignature(requestUri, requestBodyString, nonce);

      // 設定請求頭
      const headers = {
        'Content-Type': 'application/json',
        'X-LINE-ChannelId': this.channelId,
        'X-LINE-Authorization-Nonce': nonce,
        'X-LINE-Authorization': signature
      };

      // 發送請求
      console.log(`發送 LINE Pay 請求：${apiUrl}`, { orderId, amount });
      const response = await axios.post(apiUrl, requestBody, { headers });
      
      // 處理回應
      if (response.data.returnCode === '0000') {
        // 成功
        const info = response.data.info;
        const webPaymentUrl = info.paymentUrl.web;
        const transactionId = info.transactionId;
        
        console.log(`LINE Pay 請求成功: ${transactionId}`, { orderId });
        
        return {
          success: true,
          paymentUrl: webPaymentUrl,
          transactionId: transactionId.toString(),
          response: response.data
        };
      } else {
        // 失敗
        console.error(`LINE Pay 請求失敗: ${response.data.returnCode}`, response.data.returnMessage);
        
        return {
          success: false,
          error: `${response.data.returnCode}: ${response.data.returnMessage}`,
          response: response.data
        };
      }
    } catch (error) {
      // 處理例外
      console.error('LINE Pay 請求過程中發生錯誤:', error);
      
      let errorMessage = '處理 LINE Pay 請求時發生未知錯誤';
      
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = `LINE Pay API 錯誤: ${error.response.status} ${error.response.statusText}`;
        
        if (error.response.data) {
          errorMessage += ` - ${JSON.stringify(error.response.data)}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 確認 LINE Pay 交易 (Confirm API)
   * 
   * @param options 確認選項
   * @returns 確認結果
   */
  async confirmPayment(options: LinePayConfirmOptions): Promise<LinePayConfirmResult> {
    try {
      // 設定預設值
      const { 
        transactionId, 
        orderId, 
        amount, 
        currency = 'TWD'
      } = options;

      // 準備請求資料
      const requestUri = `/payments/${transactionId}/confirm`;
      const apiUrl = `${this.baseUrl}${requestUri}`;
      
      // 建立請求體
      const requestBody = {
        amount,
        currency
      };

      // 生成簽名
      const nonce = uuidv4();
      const requestBodyString = JSON.stringify(requestBody);
      const signature = this.generateSignature(requestUri, requestBodyString, nonce);

      // 設定請求頭
      const headers = {
        'Content-Type': 'application/json',
        'X-LINE-ChannelId': this.channelId,
        'X-LINE-Authorization-Nonce': nonce,
        'X-LINE-Authorization': signature
      };

      // 發送請求
      console.log(`確認 LINE Pay 交易：${apiUrl}`, { transactionId, orderId, amount });
      const response = await axios.post(apiUrl, requestBody, { headers });
      
      // 處理回應
      if (response.data.returnCode === '0000') {
        // 成功
        const info = response.data.info;
        const paymentStatus = info.payInfo?.method ? 'completed' : 'failed';
        
        console.log(`LINE Pay 確認成功: ${transactionId}`, { orderId, paymentStatus });
        
        return {
          success: true,
          paymentStatus,
          transactionId: transactionId.toString(),
          orderId,
          response: response.data
        };
      } else {
        // 失敗
        console.error(`LINE Pay 確認失敗: ${response.data.returnCode}`, response.data.returnMessage);
        
        return {
          success: false,
          error: `${response.data.returnCode}: ${response.data.returnMessage}`,
          transactionId: transactionId.toString(),
          orderId,
          response: response.data
        };
      }
    } catch (error) {
      // 處理例外
      console.error('LINE Pay 確認過程中發生錯誤:', error);
      
      let errorMessage = '處理 LINE Pay 確認時發生未知錯誤';
      
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = `LINE Pay API 錯誤: ${error.response.status} ${error.response.statusText}`;
        
        if (error.response.data) {
          errorMessage += ` - ${JSON.stringify(error.response.data)}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
        transactionId: options.transactionId,
        orderId: options.orderId
      };
    }
  }

  /**
   * 生成 LINE Pay API 簽名
   * 
   * @param uri 請求 URI
   * @param body 請求體字串
   * @param nonce 隨機 nonce 值
   * @returns HMAC-SHA256 簽名
   */
  private generateSignature(uri: string, body: string, nonce: string): string {
    // 組合簽名字串: ChannelSecret + URI + RequestBody + Nonce
    const signatureBase = this.channelSecretKey + uri + body + nonce;
    
    // 使用 HMAC-SHA256 算法生成簽名
    const signature = CryptoJS.HmacSHA256(signatureBase, this.channelSecretKey);
    
    // 轉換為 Base64 字串
    return CryptoJS.enc.Base64.stringify(signature);
  }
}

// 導出 LINE Pay 服務單例
export const linePayService = LinePayService.getInstance(); 