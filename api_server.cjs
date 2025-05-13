const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;

// 讀取 JSON 文件
function readJsonFile(filename) {
  try {
    const filePath = path.join(__dirname, filename);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`讀取文件 ${filename} 失敗:`, error);
    return { data: [], meta: { totalItems: 0 } };
  }
}

// 創建 HTTP 服務器
const server = http.createServer((req, res) => {
  // 設置 CORS 標頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 處理 OPTIONS 請求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // API 路由處理
  if (req.url.startsWith('/api/v1/menus/categories') && req.method === 'GET') {
    const data = readJsonFile('menuCategories.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } 
  else if (req.url.startsWith('/api/v1/admin/loyalty/tiers') && req.method === 'GET') {
    const data = readJsonFile('loyaltyTiers.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
  else if (req.url.startsWith('/api/v1/admin/coupons/templates') && req.method === 'GET') {
    const data = readJsonFile('couponTemplates.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
  else if (req.url.startsWith('/api/menus/fix-menu') && req.method === 'GET') {
    // 模擬修復菜單的響應
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: '菜單修復成功',
      timestamp: new Date().toISOString()
    }));
  }
  else if (req.url.startsWith('/api/admin/loyalty/rewards') && req.method === 'GET') {
    // 模擬忠誠度獎勵數據
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      data: [
        {
          id: 'reward1',
          name: '生日優惠',
          description: '會員生日可獲得的優惠',
          pointsRequired: 100,
          isActive: true
        },
        {
          id: 'reward2',
          name: '積分兌換飲品',
          description: '使用積分兌換指定飲品',
          pointsRequired: 200,
          isActive: true
        }
      ],
      meta: {
        totalItems: 2,
        currentPage: 1,
        itemsPerPage: 10,
        totalPages: 1
      }
    }));
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
  console.log('- GET /api/v1/menus/categories');
  console.log('- GET /api/v1/admin/loyalty/tiers');
  console.log('- GET /api/v1/admin/coupons/templates');
  console.log('- GET /api/menus/fix-menu');
  console.log('- GET /api/admin/loyalty/rewards');
}); 