import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { mockConfig } from '../mockConfig';
import { ApiErrorResponseData } from '../types/api.types';

const baseApiUrlFromEnv = import.meta.env.VITE_API_BASE_URL; // 例如: http://localhost:5003
// 最新指令的 baseURL 邏輯:
const determinedBaseURL = baseApiUrlFromEnv ? `${baseApiUrlFromEnv.replace(/\/$/, '')}/api/v1` : '/api/v1';

const axiosInstance = axios.create({
  baseURL: determinedBaseURL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'X-Request-ID': crypto.randomUUID(),
    'X-API-Version': '1.0.0'
  },
});

axiosInstance.interceptors.request.use(config => {
  let finalUrl = config.url || '';
  if (config.baseURL && !(finalUrl.startsWith('http://') || finalUrl.startsWith('https://'))) {
    finalUrl = `${config.baseURL.replace(/\/$/, '')}/${finalUrl.replace(/^\//, '')}`;
  }
  console.debug(`[API Request] ${config.method?.toUpperCase()} ${finalUrl}`); // 緊急指令建議的日誌
  return config;
});

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // 根據 `api.types.ts` 中 AxiosResponse 的擴展，meta/links 應直接在 response 上
    // 如果後端實際將 meta/links 包在 response.data 內，此處可能需要提取
    // response.$meta = response.data?.meta; 
    // response.$links = response.data?.links;
    return response;
  },
  async (error: AxiosError<ApiErrorResponseData>) => {
    const config = error.config as AxiosRequestConfig & { retryCount?: number };
    config.retryCount = config.retryCount || 0;

    let isRetryable = false;
    if (error.code === 'ECONNABORTED') isRetryable = true;
    if (error.response) {
      const retryableStatuses = [429, 502, 503, 504];
      if (retryableStatuses.includes(error.response.status)) isRetryable = true;
    }

    if (isRetryable && config.retryCount < 3) {
      const delay = 1000 * Math.pow(2, config.retryCount); // 緊急指令的指數退避
      await new Promise(r => setTimeout(r, delay));
      config.retryCount++;
      console.log(`Retrying request (attempt ${config.retryCount}/3 for ${config.url}) with delay ${delay}ms`);
      return axiosInstance.request(config);
    }

    const isMockMode = mockConfig.USE_MOCK_DATA;
    let notificationMessage = '';
    if (error.code === 'ECONNABORTED' || !error.response) {
      notificationMessage = error.code === 'ECONNABORTED' ? `請求逾時 (${config?.timeout}ms). 路徑: ${config?.url}` : '網路連線異常，請檢查網路狀態後重試。';
    } else {
      const status = error.response.status;
      const responseData = error.response.data;
      notificationMessage = isMockMode ? `後端服務準備中，當前顯示模擬數據 (API狀態: ${status})。` : `API 錯誤 (${status}): ${responseData?.message || error.message}`;
    }
    console.error("【全局錯誤通知】:", { message: notificationMessage, originalError: error.message });
    // 此處應調用你先前建立的 showErrorNotifier 或類似的全局通知函數
    // showErrorNotifier(notificationMessage, 'error', /* action if any */);
    return Promise.reject(error);
  }
);

export default axiosInstance; 