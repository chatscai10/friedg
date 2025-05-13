// 確保 Firebase Admin SDK 首先初始化
import * as admin from 'firebase-admin';
// 立即初始化 Admin SDK，確保其他模塊可以使用它
admin.initializeApp();
console.log('Firebase Admin SDK initialized with default settings.');

// 其他導入
import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';

// 導入API路由
// 核心模塊 - Roles API (使用簡化版)
import rolesRouter from './roles/roles.routes.fixed';
// 核心模塊 - Users API (使用CommonJS型式的簡化版)
// 使用require導入CommonJS模塊
const userModules = require('./users/user.routes.fixed');
const usersRouter = userModules.adminRouter;
const userProfileRouter = userModules.userProfileRouter;
// 核心模塊 - Stores API (使用簡化版)
import storesRouter from './stores/stores.routes.fixed';

import { withAuthentication } from './middleware/auth.middleware.fixed';

// 為模擬器環境設置對應的連接
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  console.log('檢測到函數模擬器環境，設置模擬器連接...');
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8090';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:7099';
}

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

// 添加簡單的ping測試路由 - 調整為/v1/ping以保持一致性
app.get('/v1/ping', (req, res) => {
  functions.logger.info('Ping received!');
  console.log('接收到ping請求');
  res.status(200).send('Pong!');
});

// 添加健康檢查端點
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 根路徑處理器 - 返回所有可用端點
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '打卡系統API正常運行中',
    version: '1.0.1',
    serverTime: new Date().toISOString(),
    endpoints: {
      system: [
        { path: '/v1/ping', method: 'GET', description: '簡單測試端點' },
        { path: '/health', method: 'GET', description: '系統健康檢查' },
        { path: '/test', method: 'GET', description: 'API測試端點' }
      ],
      api: [
        { path: '/v1/roles', method: 'GET', description: '獲取角色列表' },
        { path: '/v1/users', method: 'GET', description: '獲取用戶列表' },
        { path: '/v1/stores', method: 'GET', description: '獲取店鋪列表' }
      ]
    }
  });
});

// 註冊API路由
// Roles API
app.use('/v1/roles', rolesRouter);

// Users API
console.log('註冊 Users API 路由 - 用戶管理和用戶個人資料');
app.use('/v1/users', usersRouter);
app.use('/v1/profile', userProfileRouter);

// Stores API
console.log('註冊 Stores API 路由 - 店鋪管理');
app.use('/v1/stores', storesRouter);

// 測試API連接的端點
app.get('/test', (req, res) => {
  console.log('接收到測試請求 /test');
  res.status(200).json({
    status: 'success',
    message: 'API連接測試成功 - /test',
    timestamp: new Date().toISOString(),
    requestInfo: {
      url: req.url,
      path: req.path,
      method: req.method,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      ip: req.ip
    }
  });
});

// API版本端點，用於獲取當前API版本
app.get('/version', (req, res) => {
  res.status(200).json({
    version: '1.0.1',
    buildDate: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 額外添加的簡單測試端點，確保可以被訪問
app.get('/api/test', (req, res) => {
  res.status(200).send('Test API is working!');
});

// 捕獲所有未處理的路由 - 需放在所有具體路由之後
app.use('*', (req, res) => {
  console.log(`===== 未匹配的路由 =====`);
  console.log(`請求URL: ${req.url}`);
  console.log(`原始URL: ${req.originalUrl}`);
  console.log(`基本URL: ${req.baseUrl}`);
  console.log(`路徑: ${req.path}`);
  console.log(`請求方法: ${req.method}`);
  console.log(`請求參數:`, req.params);
  console.log(`請求查詢:`, req.query);
  console.log(`請求頭:`, req.headers);
  console.log(`======================`);
  
  res.status(404).json({
    status: 'error',
    message: '找不到請求的資源',
    path: req.originalUrl
  });
});

// 導出API - asia-east1區域
export const api = functions.https.onRequest(app);
// 注意：現在由firebase.json中的配置決定區域，而不是在代碼中硬編碼

// 簡化版API導出 - 用於測試
export const testApi = functions.https.onRequest((req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'Test API is running',
    timestamp: new Date().toISOString()
  });
}); 