import axios from 'axios';
import { getAuth } from 'firebase/auth';
import { handleApiError } from '../utils/errorHandler';
import { setupMockInterceptor } from './mock/mockInterceptor';

// 創建一個全局的錯誤通知函數，將在攔截器中進行初始化
let showErrorNotification: ((message: string) => void) | null = null;

// 設置錯誤通知函數的方法，由App組件在初始化時調用
export const setupErrorNotification = (notifyFn: (message: string) => void) => {
  showErrorNotification = notifyFn;
  console.log('API錯誤通知系統已設置');
};

// 創建API客戶端實例
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5003/friedg/us-central1/api', // 從環境變量獲取API基礎URL
  timeout: 15000, // 請求超時時間
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器 - 添加認證Token
apiClient.interceptors.request.use(
  async (config) => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 響應攔截器 - 處理錯誤
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 使用errorHandler獲取格式化的錯誤訊息
    const errorMessage = handleApiError(error);
    
    // 如果已設置通知函數，顯示錯誤通知
    if (showErrorNotification) {
      showErrorNotification(errorMessage);
    } else {
      // 如果通知系統尚未設置，則在控制台輸出警告
      console.warn('API錯誤通知系統尚未設置，錯誤訊息:', errorMessage);
    }
    
    // 根據開發環境提供額外的調試信息
    if (import.meta.env.DEV) {
      // 處理401未授權錯誤
      if (error.response && error.response.status === 401) {
        console.warn('授權失敗: 用戶未登入或憑證失效');
      }
      
      // 處理404錯誤 - 特別針對API端點未實現的情況
      if (error.response && error.response.status === 404) {
        console.warn('API端點不存在:', error.config?.url);
        console.info('提示: 這很可能是因為該功能的後端API尚未實現');
        console.info('您可以考慮以下解決方案:');
        console.info('1. 啟用模擬數據來測試前端 (VITE_USE_MOCK_DATA=true)');
        console.info('2. 等待後端API開發完成');
        console.info('3. 為此API端點創建一個臨時的Firebase Functions模擬');
        
        // 如果是模擬器環境，提供更具體的建議
        if (import.meta.env.VITE_USE_EMULATOR === 'true') {
          console.info('您正在使用Firebase模擬器，可嘗試在functions目錄下創建對應的端點');
        }
      }
      
      // 如果出現網絡錯誤
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout') || !error.response) {
        console.warn('網絡錯誤或請求超時:', error.message);
        console.info('請檢查網絡連接或Firebase模擬器是否運行');
      }
      
      // 對於所有HTTP 500系列錯誤，提供更多調試信息
      if (error.response && error.response.status >= 500) {
        console.error('伺服器錯誤:', error.response.status, error.response.statusText);
        console.info('錯誤詳情:', error.response.data);
      }
    }
    
    return Promise.reject(error);
  }
);

// 設置模擬數據攔截（如果環境變量啟用）
if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
  setupMockInterceptor(apiClient);
  console.info('======================================');
  console.info('| 模擬數據模式已啟用                 |');
  console.info('| VITE_USE_MOCK_DATA=true           |');
  console.info('| API請求將返回模擬數據             |');
  console.info('======================================');
} else {
  console.info('模擬數據模式未啟用，使用實際API請求');
  console.info('若要啟用模擬數據，請設置環境變量 VITE_USE_MOCK_DATA=true');
}

// 用於測試錯誤處理的輔助函數
export const testErrorHandling = () => {
  if (showErrorNotification) {
    showErrorNotification('這是一個測試錯誤通知');
    return true;
  }
  return false;
};

export default apiClient; 