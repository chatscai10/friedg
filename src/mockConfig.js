// 強制啟用模擬數據模式
export const USE_MOCK_DATA = true;

// 模擬API基礎地址
export const MOCK_API_BASE_URL = 'http://localhost:3000/api';

// 模擬數據延遲時間範圍（毫秒）
export const MOCK_DELAY = {
  MIN: 200,
  MAX: 800,
};

// 模擬API響應行為配置
export const MOCK_BEHAVIOR = {
  // 是否模擬隨機錯誤 (為了測試錯誤處理)
  RANDOM_ERRORS: false,
  // 隨機錯誤的概率 (範圍: 0-1)
  ERROR_RATE: 0.1,
};

// 模擬用戶配置
export const MOCK_USERS = {
  ADMIN: {
    id: 'admin-user-id',
    email: 'admin@example.com',
    name: '系統管理員',
    role: 'admin',
  },
  MANAGER: {
    id: 'manager-user-id',
    email: 'manager@example.com',
    name: '店舖經理',
    role: 'manager',
  },
  STAFF: {
    id: 'staff-user-id',
    email: 'staff@example.com',
    name: '一般員工',
    role: 'staff',
  },
};

// 導出配置
export default {
  USE_MOCK_DATA,
  MOCK_API_BASE_URL,
  MOCK_DELAY,
  MOCK_BEHAVIOR,
  MOCK_USERS,
};
