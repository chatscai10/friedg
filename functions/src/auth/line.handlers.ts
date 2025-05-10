import { Request, Response } from 'express';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { LineTokenExchangeSchema, LineTokenExchangeInput } from './auth.validators'; // 導入 Schema
import { exchangeLineTokenForFirebaseToken } from './line.service'; // 導入 Service
// 暫時註釋掉這個引用，直到我們創建了該服務
// import { getUserProfileById } from '../users/user.service'; // 假設用戶服務路徑

const logger = functions.logger;
const db = admin.firestore();

export const lineAuthHandler = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理 /api/auth/line 請求');

  // 1. 驗證請求體
  const validationResult = LineTokenExchangeSchema.safeParse(req.body);
  if (!validationResult.success) {
    logger.error('LINE Token 交換請求驗證失敗', { errors: validationResult.error.format() });
    return res.status(400).json({
      success: false,
      message: '請求數據驗證失敗',
      errors: validationResult.error.format(),
    });
  }

  const { lineAccessToken, lineIdToken, tenantHint } = validationResult.data;

  // 多層次租戶 ID 確定邏輯
  let tenantId: string | null = null;

  // 1. 首先嘗試從 tenantHint 直接獲取，如果它本身就是有效的 tenantId（假設是 UUID 格式）
  if (tenantHint && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantHint)) {
    // tenantHint 看起來像一個 UUID，直接用作 tenantId
    tenantId = tenantHint;
    logger.info(`使用請求中的 tenantHint 作為 tenantId: ${tenantId}`);
  } 
  // 2. 如果 tenantHint 是租戶代碼或名稱，則查詢對應的 tenantId
  else if (tenantHint) {
    try {
      const tenantsRef = db.collection('tenants');
      
      // 先嘗試用 code 查詢
      const codeSnapshot = await tenantsRef.where('code', '==', tenantHint).limit(1).get();
      
      if (!codeSnapshot.empty) {
        tenantId = codeSnapshot.docs[0].id;
        logger.info(`根據租戶代碼 ${tenantHint} 找到 tenantId: ${tenantId}`);
      } else {
        // 再嘗試用 name 查詢
        const nameSnapshot = await tenantsRef.where('name', '==', tenantHint).limit(1).get();
        if (!nameSnapshot.empty) {
          tenantId = nameSnapshot.docs[0].id;
          logger.info(`根據租戶名稱 ${tenantHint} 找到 tenantId: ${tenantId}`);
        } else {
          logger.warn(`無法根據 tenantHint 找到對應的租戶`, { tenantHint });
        }
      }
    } catch (error: any) {
      logger.error(`根據 tenantHint 查詢租戶時出錯`, { 
        tenantHint, 
        error: error.message,
        stack: error.stack 
      });
    }
  }

  // 3. 如果前兩種方法都沒有確定 tenantId，嘗試從請求頭 Host 中提取
  if (!tenantId && req.headers.host) {
    const host = req.headers.host.toLowerCase();
    // 提取子域名 (例如 從 "tenant-a.friedg.com" 提取 "tenant-a")
    const subdomain = host.split('.')[0];
    
    if (subdomain && subdomain !== 'api' && subdomain !== 'www') {
      try {
        const tenantsRef = db.collection('tenants');
        const snapshot = await tenantsRef.where('subdomain', '==', subdomain).limit(1).get();
        
        if (!snapshot.empty) {
          tenantId = snapshot.docs[0].id;
          logger.info(`根據子域名 ${subdomain} 找到 tenantId: ${tenantId}`);
        } else {
          logger.warn(`無法根據子域名找到對應的租戶`, { subdomain });
        }
      } catch (error: any) {
        logger.error(`根據子域名查詢租戶時出錯`, { 
          subdomain, 
          error: error.message,
          stack: error.stack 
        });
      }
    }
  }

  // 4. 如果前三種方法都失敗，嘗試使用系統默認租戶（如果存在）
  if (!tenantId) {
    try {
      // 嘗試獲取系統默認租戶（若存在這種設計）
      const systemConfig = await db.collection('config').doc('system').get();
      if (systemConfig.exists && systemConfig.data()?.defaultTenantId) {
        tenantId = systemConfig.data()?.defaultTenantId;
        logger.info(`使用系統默認 tenantId: ${tenantId}`);
      } else {
        logger.warn('找不到系統默認租戶');
      }
    } catch (error: any) {
      logger.error(`獲取默認租戶時出錯`, { 
        error: error.message,
        stack: error.stack 
      });
    }
  }

  // 如果最終無法確定租戶 ID，返回錯誤
  if (!tenantId) {
    logger.error('無法確定租戶 ID', { tenantHint, host: req.headers.host });
    return res.status(400).json({ 
      success: false, 
      message: '無法確定目標租戶，請提供有效的租戶提示或通過正確的租戶網址訪問' 
    });
  }
  
  logger.info(`確定租戶 ID: ${tenantId}，準備進行 Token 交換`, { tenantHint });

  try {
    // 2. 調用 Service 進行 Token 交換和 Firebase 登入/註冊
    const { customToken, userId, isNewUser } = await exchangeLineTokenForFirebaseToken(
      lineAccessToken,
      lineIdToken,
      tenantId
    );

    logger.info('LINE Token 交換成功，生成 Firebase Custom Token', { userId, tenantId, isNewUser });

    // 3. （可選但推薦）獲取用戶在我們系統中的完整 Profile 信息返回給前端
    //    這可以避免前端拿到 custom token 登入後還需要立刻再請求一次用戶數據
    // let userProfile = null;
    // try {
    //   userProfile = await getUserProfileById(userId); // 需要實現 getUserProfileById
    // } catch (profileError) {
    //   logger.error('獲取用戶 Profile 失敗，但 Token 交換仍成功', { userId, error: profileError });
    // }

    // 4. 返回成功響應
    return res.status(200).json({
      success: true,
      message: 'LINE 登入成功',
      data: {
        customToken, // Firebase Custom Token
        userId,      // 用戶ID
        isNewUser    // 是否新用戶
        // user: userProfile // 可以包含用戶 Profile
      }
    });

  } catch (error: any) {
    logger.error('LINE Token 交換或 Firebase 處理過程中發生錯誤', {
      tenantId,
      error: error.message,
      stack: error.stack,
    });
    // TODO: 更細緻的錯誤處理，例如區分 LINE 驗證失敗和 Firebase 處理失敗
    return res.status(500).json({
      success: false,
      message: 'LINE 登入處理失敗',
      error: error.message || '未知服務器錯誤',
    });
  }
}; 