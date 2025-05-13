import { Request, Response } from 'express';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { LineTokenExchangeSchema, LineTokenExchangeInput, EmployeeLineLoginSchema } from './auth.validators'; // 導入 Schema
import { exchangeLineTokenForFirebaseToken, getLineLoginUrl, handleLineCallback } from './line.service'; // 導入 Service
import { LineTokenExchangeResponse } from './auth.types';
// 暫時註釋掉這個引用，直到我們創建了該服務
// import { getUserProfileById } from '../users/user.service'; // 假設用戶服務路徑

const logger = functions.logger;
const db = admin.firestore();

/**
 * 啟動LINE登入流程
 * GET /auth/line/login
 */
export const lineLoginHandler = async (req: Request, res: Response): Promise<Response | void> => {
  logger.info('處理 /auth/line/login 請求');

  try {
    // 獲取並驗證請求參數
    const redirectUri = req.query.redirect_uri as string;
    const state = req.query.state as string;
    const tenantHint = req.query.tenant_hint as string | undefined;

    if (!redirectUri || !state) {
      logger.error('LINE登入請求缺少必要參數', { redirectUri: !!redirectUri, state: !!state });
      return res.status(400).json({
        success: false,
        message: '請求缺少必要參數 redirect_uri 或 state'
      });
    }

    // 驗證是否為允許的redirect_uri（安全性考量）
    // TODO: 從配置或數據庫中讀取允許的重定向URI列表
    // if (!isAllowedRedirectUri(redirectUri)) {
    //   logger.error('不允許的重定向URI', { redirectUri });
    //   return res.status(400).json({
    //     success: false,
    //     message: '不允許的重定向URI'
    //   });
    // }

    // 根據tenantHint獲取租戶的LINE Channel配置
    let lineChannelId: string | undefined;
    let lineChannelRedirectUri: string | undefined;

    if (tenantHint) {
      try {
        // 查找租戶配置
        const tenantData = await getTenantLineConfig(tenantHint);
        lineChannelId = tenantData?.lineChannelId;
        lineChannelRedirectUri = tenantData?.lineRedirectUri;
      } catch (error) {
        logger.error('獲取租戶LINE配置失敗', { tenantHint, error });
        // 繼續使用默認配置或返回錯誤
      }
    }

    // 如果找不到特定租戶配置，使用默認配置
    if (!lineChannelId || !lineChannelRedirectUri) {
      try {
        const systemConfig = await db.collection('config').doc('line').get();
        const systemData = systemConfig.data();
        lineChannelId = systemData?.defaultChannelId;
        lineChannelRedirectUri = systemData?.defaultRedirectUri;
      } catch (error) {
        logger.error('獲取系統默認LINE配置失敗', { error });
      }
    }

    // 如果仍找不到有效配置，返回錯誤
    if (!lineChannelId || !lineChannelRedirectUri) {
      logger.error('無法獲取有效的LINE Channel配置');
      return res.status(500).json({
        success: false,
        message: '系統錯誤：無法獲取有效的LINE配置'
      });
    }

    // 生成LINE Login URL
    const loginUrl = getLineLoginUrl(lineChannelId, lineChannelRedirectUri, state);

    // 重定向到LINE Login頁面
    logger.info('重定向到LINE Login頁面', { channelId: lineChannelId, state });
    res.redirect(loginUrl);
  } catch (error: any) {
    logger.error('處理LINE登入請求時發生錯誤', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: '處理LINE登入請求時發生錯誤',
      error: error.message || '未知服務器錯誤'
    });
  }
};

/**
 * 處理LINE登入回調
 * GET /auth/line/callback
 */
export const lineCallbackHandler = async (req: Request, res: Response): Promise<Response | void> => {
  logger.info('處理 /auth/line/callback 請求');

  try {
    // 獲取並驗證請求參數
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string | undefined;
    const errorDescription = req.query.error_description as string | undefined;

    // 檢查是否有錯誤
    if (error) {
      logger.error('LINE授權失敗', { error, errorDescription });
      // 構建重定向URL，帶錯誤參數
      const redirectUrl = getRedirectUrlWithError(state, error, errorDescription);
      return res.redirect(redirectUrl);
    }

    // 驗證必要參數
    if (!code || !state) {
      logger.error('LINE回調缺少必要參數', { code: !!code, state: !!state });
      const errorRedirectUrl = getRedirectUrlWithError(state || 'invalid_state', 'missing_params', '缺少必要參數');
      return res.redirect(errorRedirectUrl);
    }

    // 解析state參數（通常包含原始重定向URI和其他數據）
    // state格式範例: redirect_uri=http://example.com/auth&tenant=tenant_a
    const stateParams = parseStateParam(state);
    const redirectUri = stateParams.redirect_uri;
    const tenantHint = stateParams.tenant_hint;

    if (!redirectUri) {
      logger.error('無法從state參數中獲取redirect_uri', { state });
      return res.status(400).json({
        success: false,
        message: '回調處理失敗：無法獲取重定向URI'
      });
    }

    // 處理LINE授權碼，獲取訪問令牌和ID令牌
    const { accessToken, idToken } = await handleLineCallback(code, tenantHint);

    // 構建帶有令牌的重定向URL
    const successRedirectUrl = `${redirectUri}?access_token=${encodeURIComponent(accessToken)}&id_token=${encodeURIComponent(idToken)}&state=${encodeURIComponent(state)}`;

    // 重定向到前端應用
    logger.info('LINE授權成功，重定向到前端', { state });
    res.redirect(successRedirectUrl);
  } catch (error: any) {
    logger.error('處理LINE回調時發生錯誤', { error: error.message, stack: error.stack });
    
    // 嘗試從URL參數中獲取redirect_uri
    const state = req.query.state as string || '';
    const stateParams = parseStateParam(state);
    const redirectUri = stateParams.redirect_uri;
    
    if (redirectUri) {
      // 構建錯誤重定向URL
      const errorRedirectUrl = getRedirectUrlWithError(state, 'server_error', error.message || '處理授權回調時發生錯誤');
      return res.redirect(errorRedirectUrl);
    } else {
      // 如果無法獲取重定向URI，直接返回錯誤
      return res.status(500).json({
        success: false,
        message: '處理LINE回調時發生錯誤',
        error: error.message || '未知服務器錯誤'
      });
    }
  }
};

/**
 * 交換LINE Token獲取Firebase自定義Token
 * POST /auth/line/token-exchange
 */
export const lineTokenExchangeHandler = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理 /auth/line/token-exchange 請求');

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

    // 3. 獲取用戶在我們系統中的完整資訊
    let userProfile = null;
    try {
      // 嘗試獲取用戶資訊
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        userProfile = userDoc.data();
      }
    } catch (profileError) {
      logger.error('獲取用戶Profile失敗，但Token交換仍成功', { userId, error: profileError });
    }

    // 4. 返回成功響應（符合API規範格式）
    return res.status(200).json({
      success: true,
      message: 'LINE登入成功',
      data: {
        customToken,
        userId,
        isNewUser,
        user: userProfile || {
          uid: userId,
          displayName: null,
          email: null,
          photoURL: null,
          lineId: null,
          tenantId
        }
      }
    });

  } catch (error: any) {
    logger.error('LINE Token 交換或 Firebase 處理過程中發生錯誤', {
      tenantId,
      error: error.message,
      stack: error.stack,
    });
    
    // 根據錯誤類型返回適當的狀態碼
    if (error.message && (error.message.includes('LINE ID Token 驗證失敗') || error.message.includes('無效的 LINE'))) {
      return res.status(401).json({
        success: false,
        message: 'LINE驗證失敗',
        error: error.message || '無效的LINE Token'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'LINE登入處理失敗',
      error: error.message || '未知服務器錯誤'
    });
  }
};

/**
 * 員工LINE登入
 * POST /auth/employee-line-login
 */
export const employeeLineLoginHandler = async (req: Request, res: Response): Promise<Response> => {
  logger.info('處理 /auth/employee-line-login 請求');

  // 1. 驗證請求體
  const validationResult = EmployeeLineLoginSchema.safeParse(req.body);
  if (!validationResult.success) {
    logger.error('員工LINE登入請求驗證失敗', { errors: validationResult.error.format() });
    return res.status(400).json({
      success: false,
      message: '請求數據驗證失敗',
      errors: validationResult.error.format(),
    });
  }

  const { lineAccessToken, lineIdToken, tenantHint, storeId } = validationResult.data;

  // 2. 確定租戶ID（使用與lineTokenExchangeHandler相同的邏輯）
  let tenantId = await determineTenantId(tenantHint, req.headers.host);

  // 如果最終無法確定租戶ID，返回錯誤
  if (!tenantId) {
    logger.error('無法確定租戶ID', { tenantHint, host: req.headers.host });
    return res.status(400).json({ 
      success: false, 
      message: '無法確定目標租戶，請提供有效的租戶提示或通過正確的租戶網址訪問' 
    });
  }

  try {
    // 3. 進行LINE Token交換，獲取Firebase身份
    const { customToken, userId, isNewUser } = await exchangeLineTokenForFirebaseToken(
      lineAccessToken,
      lineIdToken,
      tenantId
    );

    // 4. 查找員工記錄
    let employeeId = null;
    let employeeRole = null;
    let employeeStoreId = storeId;

    // 根據LINE用戶ID查詢員工記錄
    const employeesRef = db.collection('employees');
    const employeeQuery = await employeesRef
      .where('tenantId', '==', tenantId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (employeeQuery.empty) {
      logger.error('找不到對應的員工記錄', { userId, tenantId });
      return res.status(401).json({
        success: false,
        message: '員工身份驗證失敗：找不到對應的員工記錄'
      });
    }

    // 獲取員工信息
    const employeeDoc = employeeQuery.docs[0];
    employeeId = employeeDoc.id;
    const employeeData = employeeDoc.data();
    employeeRole = employeeData.role;

    // 5. 如果員工屬於多個店鋪，但沒有指定storeId，返回錯誤
    if (employeeData.storeIds && employeeData.storeIds.length > 1 && !storeId) {
      logger.error('員工屬於多個店鋪，但未指定storeId', { employeeId, storeIds: employeeData.storeIds });
      return res.status(400).json({
        success: false,
        message: '請選擇您要登入的店鋪',
        data: {
          requireStoreSelection: true,
          storeIds: employeeData.storeIds
        }
      });
    }

    // 6. 如果員工只屬於一個店鋪或未設置storeId，使用默認店鋪
    if (!storeId && employeeData.storeIds && employeeData.storeIds.length === 1) {
      employeeStoreId = employeeData.storeIds[0];
    }

    // 7. 驗證指定的storeId是否合法（員工必須屬於該店鋪）
    if (storeId && employeeData.storeIds && !employeeData.storeIds.includes(storeId)) {
      logger.error('員工不屬於指定的店鋪', { employeeId, storeId, allowedStores: employeeData.storeIds });
      return res.status(403).json({
        success: false,
        message: '未授權：您沒有權限訪問指定的店鋪'
      });
    }

    // 8. 驗證店鋪存在且屬於正確的租戶
    if (employeeStoreId) {
      const storeDoc = await db.collection('stores').doc(employeeStoreId).get();
      if (!storeDoc.exists || storeDoc.data()?.tenantId !== tenantId) {
        logger.error('指定的店鋪不存在或不屬於正確的租戶', { storeId: employeeStoreId, tenantId });
        return res.status(404).json({
          success: false,
          message: '找不到指定的店鋪或店鋪不屬於當前租戶'
        });
      }
    }

    // 9. 返回成功響應
    logger.info('員工LINE登入成功', { userId, employeeId, storeId: employeeStoreId, role: employeeRole });
    return res.status(200).json({
      success: true,
      message: '員工LINE登入成功',
      data: {
        customToken,
        userId,
        employeeId,
        storeId: employeeStoreId,
        role: employeeRole
      }
    });

  } catch (error: any) {
    logger.error('員工LINE登入處理過程中發生錯誤', {
      tenantId,
      error: error.message,
      stack: error.stack,
    });
    
    // 根據錯誤類型返回適當的狀態碼
    if (error.message && (error.message.includes('LINE ID Token 驗證失敗') || error.message.includes('無效的 LINE'))) {
      return res.status(401).json({
        success: false,
        message: 'LINE驗證失敗',
        error: error.message || '無效的LINE Token'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: '員工LINE登入處理失敗',
      error: error.message || '未知服務器錯誤'
    });
  }
};

// 保留原來的lineAuthHandler作為legacy支持
export const lineAuthHandler = lineTokenExchangeHandler;

// 輔助函數

/**
 * 根據租戶提示獲取LINE Channel配置
 */
async function getTenantLineConfig(tenantHint: string): Promise<{lineChannelId?: string, lineChannelSecret?: string, lineRedirectUri?: string} | null> {
  let tenantId: string | null = null;
  
  // 如果tenantHint是UUID，直接使用
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantHint)) {
    tenantId = tenantHint;
  } else {
    // 嘗試用code或name查詢
    const tenantsRef = db.collection('tenants');
    const codeSnapshot = await tenantsRef.where('code', '==', tenantHint).limit(1).get();
    
    if (!codeSnapshot.empty) {
      tenantId = codeSnapshot.docs[0].id;
    } else {
      const nameSnapshot = await tenantsRef.where('name', '==', tenantHint).limit(1).get();
      if (!nameSnapshot.empty) {
        tenantId = nameSnapshot.docs[0].id;
      }
    }
  }
  
  if (!tenantId) return null;
  
  // 獲取租戶配置
  const tenantDoc = await db.collection('tenants').doc(tenantId).get();
  if (!tenantDoc.exists) return null;
  
  const tenantData = tenantDoc.data();
  return {
    lineChannelId: tenantData?.lineChannelId,
    lineChannelSecret: tenantData?.lineChannelSecret,
    lineRedirectUri: tenantData?.lineRedirectUri
  };
}

/**
 * 解析state參數，提取redirect_uri和tenant_hint
 */
function parseStateParam(state: string): {redirect_uri?: string, tenant_hint?: string} {
  try {
    // 如果state是JSON字串，直接解析
    if (state.startsWith('{') && state.endsWith('}')) {
      return JSON.parse(state);
    }
    
    // 如果state是URL編碼的參數字串
    const params: {[key: string]: string} = {};
    state.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[key] = decodeURIComponent(value);
      }
    });
    
    return {
      redirect_uri: params.redirect_uri,
      tenant_hint: params.tenant_hint
    };
  } catch (error) {
    logger.error('解析state參數失敗', { state, error });
    return {};
  }
}

/**
 * 構建帶有錯誤參數的重定向URL
 */
function getRedirectUrlWithError(state: string, error: string, errorDescription?: string): string {
  try {
    // 嘗試從state中提取redirect_uri
    const stateParams = parseStateParam(state);
    const redirectUri = stateParams.redirect_uri;
    
    if (!redirectUri) {
      // 如果無法獲取redirect_uri，返回默認錯誤頁面
      return `/error?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`;
    }
    
    // 構建帶有錯誤參數的重定向URL
    return `${redirectUri}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}&state=${encodeURIComponent(state)}`;
  } catch (error) {
    logger.error('構建錯誤重定向URL失敗', { state, error });
    return `/error?error=server_error&error_description=處理授權回調時發生錯誤`;
  }
}

/**
 * 確定租戶ID
 */
async function determineTenantId(tenantHint?: string, host?: string): Promise<string | null> {
  let tenantId: string | null = null;

  // 1. 首先嘗試從tenantHint直接獲取，如果它本身就是有效的tenantId（假設是UUID格式）
  if (tenantHint && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantHint)) {
    tenantId = tenantHint;
    logger.info(`使用請求中的tenantHint作為tenantId: ${tenantId}`);
  } 
  // 2. 如果tenantHint是租戶代碼或名稱，則查詢對應的tenantId
  else if (tenantHint) {
    try {
      const tenantsRef = db.collection('tenants');
      
      // 先嘗試用code查詢
      const codeSnapshot = await tenantsRef.where('code', '==', tenantHint).limit(1).get();
      
      if (!codeSnapshot.empty) {
        tenantId = codeSnapshot.docs[0].id;
        logger.info(`根據租戶代碼${tenantHint}找到tenantId: ${tenantId}`);
      } else {
        // 再嘗試用name查詢
        const nameSnapshot = await tenantsRef.where('name', '==', tenantHint).limit(1).get();
        if (!nameSnapshot.empty) {
          tenantId = nameSnapshot.docs[0].id;
          logger.info(`根據租戶名稱${tenantHint}找到tenantId: ${tenantId}`);
        }
      }
    } catch (error: any) {
      logger.error(`根據tenantHint查詢租戶時出錯`, { 
        tenantHint, 
        error: error.message
      });
    }
  }

  // 3. 如果前兩種方法都沒有確定tenantId，嘗試從請求頭Host中提取
  if (!tenantId && host) {
    const hostLower = host.toLowerCase();
    // 提取子域名(例如從"tenant-a.friedg.com"提取"tenant-a")
    const subdomain = hostLower.split('.')[0];
    
    if (subdomain && subdomain !== 'api' && subdomain !== 'www') {
      try {
        const tenantsRef = db.collection('tenants');
        const snapshot = await tenantsRef.where('subdomain', '==', subdomain).limit(1).get();
        
        if (!snapshot.empty) {
          tenantId = snapshot.docs[0].id;
          logger.info(`根據子域名${subdomain}找到tenantId: ${tenantId}`);
        }
      } catch (error: any) {
        logger.error(`根據子域名查詢租戶時出錯`, { 
          subdomain, 
          error: error.message
        });
      }
    }
  }

  // 4. 如果前三種方法都失敗，嘗試使用系統默認租戶（如果存在）
  if (!tenantId) {
    try {
      const systemConfig = await db.collection('config').doc('system').get();
      if (systemConfig.exists && systemConfig.data()?.defaultTenantId) {
        tenantId = systemConfig.data()?.defaultTenantId;
        logger.info(`使用系統默認tenantId: ${tenantId}`);
      }
    } catch (error: any) {
      logger.error(`獲取默認租戶時出錯`, { 
        error: error.message
      });
    }
  }

  return tenantId;
} 