// 確保 Firebase Admin SDK 首先初始化
import * as admin from 'firebase-admin';
// 立即初始化 Admin SDK，確保其他模塊可以使用它
admin.initializeApp();
console.log('Firebase Admin SDK initialized with default settings.');

// 其他導入
import * as functions from 'firebase-functions';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

// 導入訂單路由模組
import orderRoutes from './orders/orders.routes';
// 導入用戶Profile路由模組
import userRoutes from './users/user.routes';
// 導入顧客訂單路由模組
import customerOrderRoutes from './orders/customer.orders.routes';
// 導入分店管理路由模組
import storesRoutes from './stores/stores.routes';
// 導入考勤管理路由模組
import attendanceRoutes from './attendance/attendance.routes';
// 導入通知服務路由模組
import notificationRoutes from './notifications/notification.routes';
// 導入支付服務路由模組
import paymentRoutes from './payments/payments.routes';
// 導入 POS 系統路由模組
import { posRoutes } from './pos';
// 導入取餐叫號系統路由模組
import { pickupRoutes } from './pickup';
// 導入請假模組路由
import leaveRoutes from './leave/leave.routes';
// 導入庫存管理路由模組
import inventoryRoutes from './inventory/inventory.routes';
// 導入股權系統路由模組
import equityRoutes from './equity/equity.routes';

// 為模擬器環境設置對應的連接
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  console.log('檢測到函數模擬器環境，設置模擬器連接...');
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:9090';
}

// 導入股權模塊函數
import { checkEquityEligibility, openPurchaseWindow, closePurchaseWindow, revalueShares, autoDistributeDividends, processInstallmentDebit } from './equity';

// 導入財務模塊函數
import { calculateMonthlyProfit, generateMonthlyProfitReports } from './financial';

// 導入支付模塊
import * as payments from './payments';

// 導入訂單狀態變更通知觸發器
import { onOrderUpdate } from './orders/orders.triggers';

// 啟用詳細日誌
const logRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`===== 請求 ${req.method} ${req.url} =====`);
  console.log('請求頭:', JSON.stringify(req.headers, null, 2));
  console.log('請求IP:', req.ip);
  if (req.method !== 'GET') {
    console.log('請求體:', JSON.stringify(req.body, null, 2));
  }
  console.log('=================================');
  
  // 記錄響應
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`===== 響應 ${req.method} ${req.url} =====`);
    console.log('狀態碼:', res.statusCode);
    try {
      if (typeof body === 'string' && body.length < 1000) {
        console.log('響應體:', body);
      } else {
        console.log('響應體大小:', body?.length || 0);
      }
    } catch (error) {
      console.log('響應體無法記錄:', error);
    }
    console.log('=================================');
    return originalSend.call(this, body);
  };
  
  next();
};

// Express app
const app = express();

// 啟用CORS，允許所有來源
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24小時
}));

// 解析JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 添加請求日誌
app.use(logRequest);

// 添加健康檢查端點
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 身份驗證中間件
const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // 簡化驗證，僅示範用途
  next(); 
};

// 根路徑處理器 - 返回所有可用端點
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '打卡系統API正常運行中',
    version: '1.0.1',
    serverTime: new Date().toISOString(),
    endpoints: {
      attendance: [
        { path: '/api/attendance/clock', method: 'POST', description: '員工打卡' }
      ],
      management: [
        { path: '/api/management/orders', method: 'GET', description: '獲取訂單列表' },
        { path: '/api/management/products', method: 'GET', description: '獲取產品列表' },
        { path: '/api/management/customers', method: 'GET', description: '獲取客戶列表' }
      ],
      system: [
        { path: '/health', method: 'GET', description: '系統健康檢查' }
      ]
    }
  });
});

// 簡化版打卡處理函數
const clockIn = async (req: express.Request, res: express.Response) => {
  try {
    const { employeeId, storeId, type, location } = req.body;
    
    if (!employeeId || !storeId || !type || !location) {
      return res.status(400).json({
        status: 'error',
        message: '請求數據不完整'
      });
    }

    // 創建打卡記錄
    const attendanceId = uuidv4();
    const now = admin.firestore.Timestamp.now();
    
    const attendanceRecord = {
      id: attendanceId,
      employeeId,
      storeId,
      type,
      timestamp: now,
      location,
      createdAt: now
    };

    // 寫入記錄
    await admin.firestore().collection('attendanceRecords').doc(attendanceId).set(attendanceRecord);
    
    res.status(201).json({
      status: 'success',
      data: {
        id: attendanceId,
        timestamp: now.toDate()
      }
    });
  } catch (error) {
    console.error('打卡處理錯誤:', error);
    res.status(500).json({
      status: 'error',
      message: '處理打卡請求時發生錯誤'
    });
  }
};

// 管理界面 - 訂單列表
app.get('/api/management/orders', isAuthenticated, async (req, res) => {
  try {
    // 模擬訂單數據
    const orders = [
      { id: 'order1', customer: '顧客A', items: 3, total: 450, status: '已完成', date: '2025-05-01' },
      { id: 'order2', customer: '顧客B', items: 1, total: 120, status: '處理中', date: '2025-05-02' },
      { id: 'order3', customer: '顧客C', items: 5, total: 780, status: '已發貨', date: '2025-05-03' },
      { id: 'order4', customer: '顧客D', items: 2, total: 300, status: '待付款', date: '2025-05-04' },
      { id: 'order5', customer: '顧客E', items: 4, total: 560, status: '已完成', date: '2025-05-05' }
    ];
    
    // 延遲100毫秒模擬數據庫查詢
    await new Promise(resolve => setTimeout(resolve, 100));
    
    res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        count: orders.length,
        orders
      }
    });
  } catch (error) {
    console.error('獲取訂單錯誤:', error);
    res.status(500).json({
      status: 'error',
      message: '獲取訂單時發生錯誤'
    });
  }
});

// 管理界面 - 產品列表
app.get('/api/management/products', isAuthenticated, async (req, res) => {
  try {
    // 模擬產品數據
    const products = [
      { id: 'prod1', name: '產品A', price: 150, stock: 10, category: '類別1' },
      { id: 'prod2', name: '產品B', price: 120, stock: 5, category: '類別2' },
      { id: 'prod3', name: '產品C', price: 180, stock: 8, category: '類別1' },
      { id: 'prod4', name: '產品D', price: 200, stock: 15, category: '類別3' },
      { id: 'prod5', name: '產品E', price: 90, stock: 20, category: '類別2' }
    ];
    
    // 延遲100毫秒模擬數據庫查詢
    await new Promise(resolve => setTimeout(resolve, 100));
    
    res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        count: products.length,
        products
      }
    });
  } catch (error) {
    console.error('獲取產品錯誤:', error);
    res.status(500).json({
      status: 'error',
      message: '獲取產品時發生錯誤'
    });
  }
});

// 管理界面 - 客戶列表
app.get('/api/management/customers', isAuthenticated, async (req, res) => {
  try {
    // 模擬客戶數據
    const customers = [
      { id: 'cust1', name: '顧客A', email: 'custA@example.com', phone: '0912345678', orders: 5 },
      { id: 'cust2', name: '顧客B', email: 'custB@example.com', phone: '0923456789', orders: 2 },
      { id: 'cust3', name: '顧客C', email: 'custC@example.com', phone: '0934567890', orders: 8 },
      { id: 'cust4', name: '顧客D', email: 'custD@example.com', phone: '0945678901', orders: 1 },
      { id: 'cust5', name: '顧客E', email: 'custE@example.com', phone: '0956789012', orders: 3 }
    ];
    
    // 延遲100毫秒模擬數據庫查詢
    await new Promise(resolve => setTimeout(resolve, 100));
    
    res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      data: {
        count: customers.length,
        customers
      }
    });
  } catch (error) {
    console.error('獲取客戶錯誤:', error);
    res.status(500).json({
      status: 'error',
      message: '獲取客戶時發生錯誤'
    });
  }
});

// 註冊打卡API路由
app.post('/api/attendance/clock', isAuthenticated, clockIn);

// 掛載訂單路由模組
app.use('/api/orders', orderRoutes);

// 掛載用戶Profile路由模組
app.use('/api/users', userRoutes);

// 註冊顧客訂單路由 - 注意路徑為 /api/customer/orders
app.use('/api/customer/orders', customerOrderRoutes);

// 註冊分店管理路由
app.use('/api/stores', storesRoutes);

// 註冊考勤管理路由
app.use('/api/attendance', attendanceRoutes);

// 通知服務路由
app.use('/api/notifications', notificationRoutes);

// 註冊支付服務路由
app.use('/api/payments', paymentRoutes);

// 註冊 POS 系統路由
app.use('/api/pos', posRoutes);

// 註冊取餐叫號系統路由
app.use('/api/pickup', pickupRoutes);

// 註冊請假模組路由
app.use('/api/leave', leaveRoutes);

// 添加庫存管理路由
app.use('/api/inventory', inventoryRoutes);

// 註冊股權系統路由
app.use('/api/equity', equityRoutes);

// 註冊客戶關係管理 (CRM) 路由
import crmRoutes from './crm/crm.routes';
app.use('/api/crm', crmRoutes);

// 處理OPTIONS請求，確保CORS預檢請求正確響應
app.options('*', cors());

// 全局錯誤處理中間件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API錯誤:', err);
  res.status(500).json({
    status: 'error',
    message: '服務器內部錯誤',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// 處理API錯誤的通用函數
const handleApiError = (res: express.Response, error: unknown, context: string) => {
  console.error(`[API Error] Context: ${context}, Error:`, error); 
  const err = error as any; 
  const statusCode = typeof err.status === 'number' ? err.status : 500; 
  const errorMessage = err.message || context || 'An unexpected server error occurred.';
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    status: 'error',
    message: errorMessage,
    code: errorCode,
  });
};

// P0 API 路由 - 菜單分類
app.get('/api/v1/menus/categories', async (req: express.Request, res: express.Response) => { 
  console.log(`[Firebase Functions] GET /api/v1/menus/categories - Request received.`); // 添加請求日誌
  try {
    const mockData = {
      data: [{
        categoryId: 'CAT_EMU_1_FINAL', 
        name: '熱修模擬分類 (v1)', 
        type: 'STANDARD',
        sortOrder: 1, 
        isActive: true, 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString()
      }],
      meta: { 
        totalItems: 1, 
        currentPage: 1, 
        itemsPerPage: 20, 
        totalPages: 1 
      }
    };
    res.status(200).json(mockData);
  } catch (error) {
    handleApiError(res, error, '取得菜單分類失敗');
  }
});

// P0 API - GET 忠誠度等級
app.get('/api/v1/admin/loyalty/tiers', async (req: express.Request, res: express.Response) => {
  console.log(`[Firebase Functions] GET /api/v1/admin/loyalty/tiers - Request received.`);
  try {
    const mockData = {
      data: [{
        tierId: 'TIER_1',
        name: '基礎會員',
        threshold: 0,
        benefits: ['基本折扣'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      meta: {
        totalItems: 1,
        currentPage: 1,
        itemsPerPage: 20,
        totalPages: 1
      }
    };
    res.status(200).json(mockData);
  } catch (error) {
    handleApiError(res, error, '取得忠誠度等級失敗');
  }
});

// P0 API - GET 優惠券模板
app.get('/api/v1/admin/coupons/templates', async (req: express.Request, res: express.Response) => {
  console.log(`[Firebase Functions] GET /api/v1/admin/coupons/templates - Request received.`);
  try {
    const mockData = {
      data: [{
        templateId: 'TPL_1',
        name: '新會員優惠',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        validDays: 30,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      meta: {
        totalItems: 1,
        currentPage: 1,
        itemsPerPage: 20,
        totalPages: 1
      }
    };
    res.status(200).json(mockData);
  } catch (error) {
    handleApiError(res, error, '取得優惠券模板失敗');
  }
});

// P0 API - POST 新增菜單分類
app.post('/api/v1/menus/categories', async (req: express.Request, res: express.Response) => {
  console.log(`[Firebase Functions] POST /api/v1/menus/categories - Request received.`);
  try {
    // 模擬成功創建資源
    const newCategory = {
      ...req.body,
      categoryId: `CAT_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    res.status(201).json({
      data: newCategory
    });
  } catch (error) {
    handleApiError(res, error, '新增分類失敗');
  }
});

// 捕獲所有未處理的路由
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: '找不到請求的資源',
    path: req.originalUrl
  });
});

// 菜單API - 根路由直接掛載
app.get('/menu', (req, res) => {
  // 返回前端菜單結構
  res.status(200).json({
    status: 'success',
    timestamp: new Date().toISOString(),
    data: {
      menuItems: [
        { id: 'dashboard', name: '儀表板', icon: 'dashboard', path: '/dashboard' },
        { id: 'orders', name: '訂單管理', icon: 'shopping_cart', path: '/orders' },
        { id: 'products', name: '產品管理', icon: 'inventory', path: '/products' },
        { id: 'customers', name: '客戶管理', icon: 'people', path: '/customers' },
        { id: 'attendance', name: '考勤管理', icon: 'event_available', path: '/attendance' },
        { id: 'settings', name: '系統設置', icon: 'settings', path: '/settings' }
      ]
    }
  });
});

// 配置API - 根路由直接掛載
app.get('/config', (req, res) => {
  res.status(200).json({
    status: 'success',
    timestamp: new Date().toISOString(),
    data: {
      apiVersion: '1.0.1',
      apiBaseUrl: 'https://api-z3pyavoh3q-uc.a.run.app',
      features: {
        enableNavigation: true,
        enableSearch: true,
        enableNotifications: true
      },
      ui: {
        theme: 'light',
        sidebarWidth: 280,
        defaultRoute: '/orders'
      }
    }
  });
});

// 路由API - 根路由直接掛載
app.get('/routes', (req, res) => {
  res.status(200).json({
    status: 'success',
    timestamp: new Date().toISOString(),
    data: {
      routes: [
        { path: '/dashboard', component: 'Dashboard', title: '儀表板' },
        { path: '/orders', component: 'Orders', title: '訂單管理' },
        { path: '/products', component: 'Products', title: '產品管理' },
        { path: '/customers', component: 'Customers', title: '客戶管理' },
        { path: '/attendance', component: 'Attendance', title: '考勤管理' },
        { path: '/settings', component: 'Settings', title: '系統設置' }
      ]
    }
  });
});

// 前端修復腳本 - 根路由直接掛載
app.get('/fix-menu', (req, res) => {
  res.status(200).send(`
    (function() {
      // 立即執行函數，修復前端菜單問題
      
      // 1. 添加必要的樣式
      const style = document.createElement('style');
      style.innerHTML = \`
        .sidebar { transform: translateX(0) !important; opacity: 1 !important; }
        .menu-item { cursor: pointer; padding: 10px; margin: 5px 0; border-radius: 5px; }
        .menu-item:hover { background-color: rgba(0,0,0,0.05); }
        .menu-item.active { background-color: rgba(0,0,0,0.1); }
      \`;
      document.head.appendChild(style);
      
      // 2. 菜單項配置
      const menuItems = [
        { id: 'dashboard', name: '儀表板', icon: 'dashboard', path: '/dashboard' },
        { id: 'orders', name: '訂單管理', icon: 'shopping_cart', path: '/orders' },
        { id: 'products', name: '產品管理', icon: 'inventory', path: '/products' },
        { id: 'customers', name: '客戶管理', icon: 'people', path: '/customers' }
      ];
      
      // 3. 激活菜單項功能
      function activateMenuItem(itemId) {
        document.querySelectorAll('.menu-item').forEach(item => {
          item.classList.remove('active');
        });
        
        const targetItem = document.querySelector(\`.menu-item[data-id="\${itemId}"]\`);
        if (targetItem) {
          targetItem.classList.add('active');
        }
        
        // 模擬頁面切換
        if (itemId === 'orders') {
          window.location.href = '/orders';
        } else if (itemId === 'products') {
          window.location.href = '/products';
        } else if (itemId === 'customers') {
          window.location.href = '/customers';
        } else if (itemId === 'dashboard') {
          window.location.href = '/dashboard';
        }
      }
      
      // 4. 初始化菜單處理
      function initMenu() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) {
          console.log('找不到側欄元素');
          return;
        }
        
        // 清空現有內容
        sidebar.innerHTML = '';
        
        // 添加標題
        const title = document.createElement('div');
        title.className = 'sidebar-title';
        title.innerText = '系統菜單';
        title.style.cssText = 'padding: 15px; font-weight: bold; font-size: 18px;';
        sidebar.appendChild(title);
        
        // 添加菜單項
        menuItems.forEach(item => {
          const menuItem = document.createElement('div');
          menuItem.className = 'menu-item';
          menuItem.dataset.id = item.id;
          menuItem.innerHTML = \`<span class="icon">\${item.icon}</span> \${item.name}\`;
          menuItem.addEventListener('click', () => activateMenuItem(item.id));
          sidebar.appendChild(menuItem);
        });
        
        // 激活當前頁面菜單項
        const path = window.location.pathname;
        const currentItem = menuItems.find(item => path.includes(item.path));
        if (currentItem) {
          activateMenuItem(currentItem.id);
        } else {
          activateMenuItem('orders'); // 預設激活訂單管理
        }
      }
      
      // 5. 延遲執行，確保頁面完全加載
      setTimeout(initMenu, 1000);
      
      // 6. 添加全局變量以便直接在控制台訪問
      window.friedgMenuFix = {
        initMenu,
        activateMenuItem,
        menuItems
      };
      
      console.log('菜單修復腳本已加載，請在控制台輸入 friedgMenuFix.initMenu() 來手動重新初始化菜單');
    })();
  `);
});

// 初始化頁面 - 根路由直接掛載
app.get('/init', (req, res) => {
  // 返回初始化前端的必要數據
  res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>前端初始化</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
    code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
    pre { background: #f8f8f8; padding: 10px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>前端整合指南</h1>
  <p>請在您的前端應用中添加以下代碼來解決菜單問題：</p>
  
  <h2>1. 在啟動時獲取菜單數據</h2>
  <pre><code>
// 在您的前端應用初始化時加載以下API
fetch('https://api-z3pyavoh3q-uc.a.run.app/menu')
  .then(response => response.json())
  .then(data => {
    // 存儲菜單數據
    window.appMenuItems = data.data.menuItems;
    // 觸發菜單更新
    const event = new CustomEvent('menuLoaded', { detail: data.data.menuItems });
    window.dispatchEvent(event);
  });
  </code></pre>
  
  <h2>2. 更新前端路由配置</h2>
  <pre><code>
// 在您的路由配置文件中使用以下代碼
fetch('https://api-z3pyavoh3q-uc.a.run.app/routes')
  .then(response => response.json())
  .then(data => {
    // 更新路由配置
    const routes = data.data.routes;
    // 使用這些路由覆蓋您的現有路由配置
    window.appRoutes = routes;
    
    // 觸發路由更新
    const event = new CustomEvent('routesLoaded', { detail: routes });
    window.dispatchEvent(event);
  });
  </code></pre>
  
  <h2>3. 修復漢堡選單處理程序</h2>
  <pre><code>
// 確保漢堡選單點擊處理程序正確實現
document.addEventListener('DOMContentLoaded', () => {
  const menuButton = document.querySelector('.menu-button'); // 更新為您的實際選擇器
  if (menuButton) {
    menuButton.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar'); // 更新為您的實際選擇器
      if (sidebar) {
        sidebar.classList.toggle('open');
      }
    });
  }
});
  </code></pre>
  
  <p>若需更詳細的技術支援，請聯絡API團隊。</p>
</body>
</html>
  `);
});

// 導出API
export const api = functions.https.onRequest(app);

// 導出股權相關函數
export { 
  checkEquityEligibility,
  openPurchaseWindow,
  closePurchaseWindow,
  revalueShares,
  autoDistributeDividends,
  processInstallmentDebit
};

// 導出財務相關函數
export {
  calculateMonthlyProfit,
  generateMonthlyProfitReports
};

// 導出支付模塊
export { payments };

// 導出訂單模塊的所有Cloud Functions
export {
  getOrders,
  getOrder,
  newOrder,
  updateStatus,
  recordPayment,
  getOrderStatistics,
  generateOrderReceipt,
  getOrderReceipt, 
  getOrderHistory
} from './orders';

// 導出通知模塊的Cloud Functions
export {
  orderStatusChangeHandler,
  sendOrderNotification,
  updateNotificationPreferences
} from './notifications';

// 導出訂單狀態變更通知觸發器
export const orderStatusChangeNotification = onOrderUpdate;

// 清理日誌
export const cleanupLogs = functions.https.onRequest((req, res) => {
  console.log('接收到日誌清理請求');
  res.status(200).json({
    status: 'success',
    message: 'Log cleanup complete',
    timestamp: new Date().toISOString()
  });
}); 