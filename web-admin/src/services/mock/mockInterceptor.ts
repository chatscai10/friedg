import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { mockMenuData } from './mockMenuData';
import { mockLoyaltyData } from './mockLoyaltyData';
import { mockCouponData } from './mockCouponData';

// 模擬網絡延遲時間範圍(毫秒)
const MIN_DELAY = 300;
const MAX_DELAY = 1200;

// 生成隨機延遲時間，模擬實際網絡環境
const getRandomDelay = () => {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY);
};

// API路徑與模擬數據處理函數對應表
const mockHandlers: Record<string, (config: AxiosRequestConfig) => any> = {
  // 菜單管理相關
  '/menus/categories': mockMenuData.getCategories,
  '/menus/categories/([^/]+)': mockMenuData.getCategoryById,
  '/menus/items': mockMenuData.getItems,
  '/menus/items/([^/]+)': mockMenuData.getItemById,
  
  // 忠誠度計畫相關
  '/admin/loyalty/tiers': mockLoyaltyData.getTierRules,
  '/admin/loyalty/tiers/([^/]+)': mockLoyaltyData.getTierRuleById,
  '/admin/loyalty/rewards': mockLoyaltyData.getRewards,
  '/admin/loyalty/rewards/([^/]+)': mockLoyaltyData.getRewardById,
  
  // 優惠券模板相關
  '/admin/coupons/templates': mockCouponData.getTemplates,
  '/admin/coupons/templates/([^/]+)': mockCouponData.getTemplateById
};

// 設置模擬數據攔截器
export const setupMockInterceptor = (apiClient: AxiosInstance): void => {
  const mockInterceptor = apiClient.interceptors.request.use(
    async (config) => {
      // 檢查是否啟用了模擬數據環境變數
      if (import.meta.env.VITE_USE_MOCK_DATA !== 'true') {
        return config;
      }
      
      // 獲取請求URL的相對路徑
      const url = config.url || '';
      const baseURL = config.baseURL || '';
      const fullUrl = url.startsWith('http') ? url : baseURL + url;
      
      let isMocked = false;
      let mockResponse;
      
      // 檢查URL是否匹配任何模擬處理函數
      for (const pattern in mockHandlers) {
        const regex = new RegExp(`^${baseURL}${pattern}$`);
        if (regex.test(fullUrl)) {
          // 模擬網絡延遲
          await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
          
          try {
            // 調用相應的模擬數據處理函數
            mockResponse = mockHandlers[pattern](config);
            isMocked = true;
            
            // 提供模擬數據攔截信息
            console.info(`[模擬數據] 攔截請求: ${config.method?.toUpperCase()} ${url}`);
            break;
          } catch (err) {
            console.error(`[模擬數據] 處理錯誤:`, err);
            // 返回模擬錯誤
            throw {
              isAxiosError: true,
              response: {
                status: 500,
                statusText: 'Internal Server Error',
                data: { message: '模擬數據處理發生錯誤' }
              }
            };
          }
        }
      }
      
      // 如果有匹配的模擬處理函數
      if (isMocked) {
        // 創建模擬的Axios響應對象
        const mockAxiosResponse: AxiosResponse = {
          data: mockResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: config
        };
        
        // 取消實際請求並返回模擬響應
        const error = new axios.Cancel('模擬數據攔截');
        (error as any).response = mockAxiosResponse;
        throw error;
      }
      
      // 如果沒有匹配的模擬數據，繼續實際請求
      return config;
    },
    (error) => Promise.reject(error)
  );
  
  // 攔截響應以處理模擬數據
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      // 檢查是否為我們取消的請求且附帶了模擬響應
      if (axios.isCancel(error) && (error as any).response) {
        return Promise.resolve((error as any).response);
      }
      
      // 其他錯誤情況正常拒絕
      return Promise.reject(error);
    }
  );
};

// 移除模擬數據攔截器
export const removeMockInterceptor = (apiClient: AxiosInstance, interceptorId: number): void => {
  apiClient.interceptors.request.eject(interceptorId);
}; 