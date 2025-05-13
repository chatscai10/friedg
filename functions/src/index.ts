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
// 核心模塊 - Roles API
import rolesRouter from './roles/roles.routes.fixed';
// 核心模塊 - Users API
// 使用require導入CommonJS模塊
const userModules = require('./users/user.routes.fixed');
const usersRouter = userModules.adminRouter;
const userProfileRouter = userModules.userProfileRouter;
// 核心模塊 - Stores API
import storesRouter from './stores/stores.routes.fixed';
// 導入 Auth API 路由
import authRouter from './auth/auth.routes';

import { withAuthentication } from './middleware/auth.middleware.fixed';

// 為模擬器環境設置對應的連接
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  console.log('檢測到函數模擬器環境，設置模擬器連接...');
  // 暫時注釋掉 Firestore 相關設置，避免依賴關係
  // process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8090';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:7099';
  // 確保 FIREBASE_AUTH_EMULATOR_HOST 也被設置為 process.env
  admin.auth().emulatorConfig = {
    host: 'localhost',
    port: 7099
  };
   // 暫時注釋掉 Firestore 相關設置，避免依賴關係
   // admin.firestore().settings({
   //  host: 'localhost:8090',
   //  ssl: false, // Emulators use unencrypted connections
   // });
}

// 啟用詳細日誌
const logRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.log(`===== 請求 ${req.method} ${req.url} =====`);
  console.log('原始URL:', req.originalUrl);
  console.log('請求路徑:', req.path);
  console.log('基本URL:', req.baseUrl);
  console.log('=================================');
  
  // 記錄響應
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`===== 響應 ${req.method} ${req.url} =====`);
    console.log('狀態碼:', res.statusCode);
    console.log('=================================');
    return originalSend.call(this, body);
  };
  
  next();
};

// 主 Express app
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

// 新增測試用戶路由 - 方便測試登入
// 這個路由不需要任何資料庫訪問，只使用 Auth 服務
app.post('/setup-test-user', async (req, res) => {
  try {
    // 檢查是否處於開發環境
    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
      return res.status(403).json({ 
        error: '只能在開發環境使用此功能' 
      });
    }

    // 創建測試用戶
    const userEmail = 'test@example.com';
    const userPassword = 'password123';
    
    try {
      // 檢查用戶是否已存在
      await admin.auth().getUserByEmail(userEmail);
      console.log(`測試用戶 ${userEmail} 已存在`);
    } catch (error) {
      // 用戶不存在，創建新用戶
      if (error.code === 'auth/user-not-found') {
        await admin.auth().createUser({
          email: userEmail,
          password: userPassword,
          displayName: '測試用戶',
          emailVerified: true
        });
        console.log(`測試用戶 ${userEmail} 創建成功`);
      } else {
        throw error;
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `測試用戶 ${userEmail} 已設置，密碼為 ${userPassword}`,
      user: {
        email: userEmail,
        password: userPassword
      }
    });
  } catch (error) {
    console.error('設置測試用戶失敗:', error);
    return res.status(500).json({
      error: '設置測試用戶失敗',
      message: error.message
    });
  }
});

// 在這裡添加一個根路徑的處理，用於健康檢查或API信息
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: '打卡系統API根路徑'
    });
});

// 將所有 /v1/ 開頭的請求路由到一個子 Express 路由器
const apiRouter = express.Router();

// 註冊所有 /v1 下的子路由
apiRouter.use('/auth', authRouter); // 認證相關路由 (包含LINE和帳密)
apiRouter.use('/roles', rolesRouter); // 角色相關路由
apiRouter.use('/users', usersRouter); // 用戶相關路由
apiRouter.use('/profile', userProfileRouter); // 用戶個人資料相關路由
apiRouter.use('/stores', storesRouter); // 店鋪相關路由

// 將這個子路由器掛載到 /v1 路徑下
app.use('/v1', apiRouter);

// 添加簡單的ping測試路由
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

// 額外添加的簡單測試端點，確保可以被訪問
app.get('/api/test', (req, res) => {
  res.status(200).send('Test API is working!');
});

// API版本端點
app.get('/version', (req, res) => {
  res.status(200).json({
    version: '1.0.2', // 更新版本號
    buildDate: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 捕獲所有未處理的路由 - 需放在所有具體路由之後
app.use('*', (req, res) => {
  console.log(`===== 未匹配的路由 =====`);
  console.log(`請求URL: ${req.url}`);
  console.log(`原始URL: ${req.originalUrl}`);
  console.log(`基本URL: ${req.baseUrl}`);
  console.log(`路徑: ${req.path}`);
  console.log(`請求方法: ${req.method}`);
  // console.log(`請求參數:`, req.params);
  // console.log(`請求查詢:`, req.query);
  // console.log(`請求頭:`, req.headers);
  console.log(`======================`);
  
  res.status(404).json({
    status: 'error',
    message: '找不到請求的資源',
    path: req.originalUrl
  });
});

// 導出API - 讓Firebase Functions觸發
// 使用 onRequest 創建一個處理所有請求的單一函數
// 區域在firebase.json中配置
export const api = functions.https.onRequest(app);

// 簡化版API導出 - 用於測試或其他特定用途 (如果需要)
// 這是一個獨立的 Functions 觸發點，不會經過上面的主 Express app
export const testApi = functions.https.onRequest((req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'Test API is running (獨立測試函數)',
    timestamp: new Date().toISOString()
  });
}); 