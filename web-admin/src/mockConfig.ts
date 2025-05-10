/**
 * 模擬數據配置文件
 * 此文件集中管理所有與模擬數據相關的配置
 */

// 模擬數據全局配置
export const mockConfig = {
  // 是否啟用模擬數據 (由環境變量控制)
  USE_MOCK_DATA: import.meta.env.VITE_USE_MOCK_DATA === 'true',
  
  // 模擬網絡延遲範圍 (毫秒)
  NETWORK_DELAY: {
    MIN: 300,
    MAX: 800
  },
  
  // 需要模擬的API端點
  ENDPOINTS: {
    MENU: {
      CATEGORIES: '/menus/categories',
      ITEMS: '/menus/items'
    },
    LOYALTY: {
      TIERS: '/admin/loyalty/tiers',
      REWARDS: '/admin/loyalty/rewards'
    },
    COUPON: {
      TEMPLATES: '/admin/coupons/templates'
    }
  },
  
  // 日誌設定
  LOGGING: {
    // 是否顯示模擬數據日誌
    ENABLED: true,
    // 日誌前綴
    PREFIX: '[模擬數據]'
  }
};

/**
 * 模擬網絡延遲
 * 在指定的最小和最大延遲時間內隨機生成延遲
 */
export const simulateNetworkDelay = async (): Promise<void> => {
  if (!mockConfig.USE_MOCK_DATA) return; // 只在啟用模擬數據時模擬延遲
  
  const { MIN, MAX } = mockConfig.NETWORK_DELAY;
  const delay = Math.floor(Math.random() * (MAX - MIN + 1) + MIN);
  
  // 模擬網絡延遲
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // 日誌輸出
  if (mockConfig.LOGGING.ENABLED) {
    console.info(`${mockConfig.LOGGING.PREFIX} 網絡延遲: ${delay}ms`);
  }
};

/**
 * 模擬數據日誌函數
 * 在啟用日誌時輸出模擬數據相關的日誌信息
 */
export const mockLog = (message: string, data?: any): void => {
  if (!mockConfig.LOGGING.ENABLED) return;
  
  console.info(`${mockConfig.LOGGING.PREFIX} ${message}`);
  if (data !== undefined && import.meta.env.DEV) {
    console.debug(`${mockConfig.LOGGING.PREFIX} Data:`, data);
  }
};

/**
 * 檢查指定端點是否需要模擬
 * 用於在服務檔案中快速判斷特定API是否屬於需要模擬的範圍
 */
export const shouldMockEndpoint = (endpoint: string): boolean => {
  if (!mockConfig.USE_MOCK_DATA) return false;
  
  // 檢查是否匹配任一需要模擬的端點
  const endpointCategories = Object.values(mockConfig.ENDPOINTS);
  for (const category of endpointCategories) {
    const endpoints = Object.values(category);
    if (endpoints.some(e => endpoint.includes(e))) {
      return true;
    }
  }
  
  return false;
}; 