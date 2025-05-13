const http = require('http');

const port = 3000;

// 菜單分類數據
const menuCategoriesData = {
  data: [
    { 
      categoryId: 'cat001', 
      name: '熱門飲品', 
      status: 'active', 
      displayOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    { 
      categoryId: 'cat002', 
      name: '季節限定', 
      status: 'active', 
      displayOrder: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    { 
      categoryId: 'cat003', 
      name: '經典咖啡', 
      status: 'active', 
      displayOrder: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  meta: {
    totalItems: 3,
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1
  }
};

// 會員等級數據
const loyaltyTiersData = {
  data: [
    {
      tierId: 'tier001',
      name: '一般會員',
      threshold: 0,
      benefits: ['免費生日飲品'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      tierId: 'tier002',
      name: '銀卡會員',
      threshold: 5000,
      benefits: ['免費生日飲品', '消費9折'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      tierId: 'tier003',
      name: '金卡會員',
      threshold: 15000,
      benefits: ['免費生日飲品', '消費8折', '專屬活動'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  meta: {
    totalItems: 3,
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1
  }
};

// 優惠券模板數據
const couponTemplatesData = {
  data: [
    {
      templateId: 'tpl001',
      name: '新會員優惠',
      discount: 100,
      type: 'fixed',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      templateId: 'tpl002',
      name: '週年慶特惠',
      discount: 20,
      type: 'percentage',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  meta: {
    totalItems: 2,
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1
  }
};

// 創建 HTTP 服務器
const server = http.createServer((req, res) => {
  // 設置CORS標頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 日誌記錄請求
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // 處理選項請求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // 路由處理
  if (req.url === '/api/v1/menus/categories' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(menuCategoriesData));
  } 
  else if (req.url === '/api/v1/admin/loyalty/tiers' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loyaltyTiersData));
  }
  else if (req.url === '/api/v1/admin/coupons/templates' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(couponTemplatesData));
  }
  else {
    // 未找到路由
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'error',
      message: '找不到請求的資源',
      path: req.url
    }));
  }
});

// 啟動服務器
server.listen(port, () => {
  console.log(`API 模擬服務器運行在 http://localhost:${port}`);
  console.log('可用的測試端點:');
  console.log('- GET http://localhost:3000/api/v1/menus/categories');
  console.log('- GET http://localhost:3000/api/v1/admin/loyalty/tiers');
  console.log('- GET http://localhost:3000/api/v1/admin/coupons/templates');
}); 