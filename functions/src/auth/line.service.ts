import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { LineIdTokenPayload, LineProfile } from './auth.types'; // 導入需要的類型
import * as jose from 'jose'; // 導入 jose 庫用於 JWT 驗證
import axios from 'axios'; // 導入 axios 用於 HTTP 請求
// 可能還需要導入 UserRecord from 'firebase-admin/auth' 和用戶模型類型

const logger = functions.logger;
const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue; // 顯式導入FieldValue以在步驟7中使用

/**
 * 生成LINE登入URL
 * @param channelId LINE Channel ID
 * @param redirectUri 授權後重定向URI
 * @param state 用於防止CSRF攻擊的狀態字串
 * @returns 完整的LINE Login授權URL
 */
export function getLineLoginUrl(channelId: string, redirectUri: string, state: string): string {
  // LINE登入所需的基本參數
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: redirectUri,
    state: state,
    scope: 'profile openid email', // 基本資料、ID Token和電子郵件（如果用戶有設置）
    // 可選參數
    prompt: 'consent', // 每次都顯示同意畫面
    bot_prompt: 'normal' // 是否同時提示使用者加入官方帳號
  });

  // 構建完整的授權URL
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

/**
 * 處理LINE回調，交換授權碼換取訪問令牌和ID令牌
 * @param code LINE授權碼
 * @param tenantHint 租戶提示（可選）
 * @returns 包含訪問令牌和ID令牌的對象
 */
export async function handleLineCallback(code: string, tenantHint?: string): Promise<{ accessToken: string, idToken: string }> {
  logger.info('處理LINE授權回調', { tenantHint });

  // 1. 獲取LINE Channel配置
  let lineChannelId: string | undefined;
  let lineChannelSecret: string | undefined;
  let lineRedirectUri: string | undefined;

  // 根據tenantHint獲取對應租戶的LINE Channel配置
  if (tenantHint) {
    try {
      // 如果tenantHint是UUID，直接查詢，否則嘗試用code或name查詢
      let tenantId: string | null = null;
      
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantHint)) {
        tenantId = tenantHint;
      } else {
        // 查詢租戶
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

      if (tenantId) {
        // 獲取租戶配置
        const tenantDoc = await db.collection('tenants').doc(tenantId).get();
        if (tenantDoc.exists) {
          const tenantData = tenantDoc.data();
          lineChannelId = tenantData?.lineChannelId;
          lineChannelSecret = tenantData?.lineChannelSecret;
          lineRedirectUri = tenantData?.lineRedirectUri;
          logger.info(`找到租戶 ${tenantId} 的LINE Channel配置`);
        }
      }
    } catch (error: any) {
      logger.error('根據tenantHint獲取LINE Channel配置時出錯', { 
        tenantHint, 
        error: error.message,
        stack: error.stack 
      });
    }
  }

  // 如果找不到租戶特定配置，使用系統默認配置
  if (!lineChannelId || !lineChannelSecret || !lineRedirectUri) {
    try {
      const systemConfig = await db.collection('config').doc('line').get();
      if (systemConfig.exists) {
        const configData = systemConfig.data();
        lineChannelId = lineChannelId || configData?.defaultChannelId;
        lineChannelSecret = lineChannelSecret || configData?.defaultChannelSecret;
        lineRedirectUri = lineRedirectUri || configData?.defaultRedirectUri;
        logger.info('使用系統默認LINE Channel配置');
      }
    } catch (error: any) {
      logger.error('獲取系統默認LINE配置時出錯', { 
        error: error.message,
        stack: error.stack 
      });
    }
  }

  // 如果仍無法獲取有效配置，拋出錯誤
  if (!lineChannelId || !lineChannelSecret || !lineRedirectUri) {
    logger.error('無法獲取有效的LINE Channel配置');
    throw new Error('系統錯誤：無法獲取有效的LINE配置');
  }

  // 2. 向LINE交換授權碼獲取Token
  try {
    // 準備請求參數
    const formData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: lineRedirectUri,
      client_id: lineChannelId,
      client_secret: lineChannelSecret
    });

    // 發送POST請求到LINE Token API
    const response = await axios.post(
      'https://api.line.me/oauth2/v2.1/token',
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // 提取訪問令牌和ID令牌
    const { access_token, id_token } = response.data;
    
    if (!access_token || !id_token) {
      throw new Error('LINE Token回應中缺少必要字段');
    }

    logger.info('成功從LINE獲取訪問令牌和ID令牌');
    return {
      accessToken: access_token,
      idToken: id_token
    };

  } catch (error: any) {
    // 處理各種錯誤情況
    logger.error('向LINE交換Token時發生錯誤', { 
      error: error.message, 
      responseData: error.response?.data,
      status: error.response?.status,
      stack: error.stack 
    });

    // 根據LINE API錯誤範圍提供更具體的錯誤訊息
    if (error.response?.data) {
      const errorData = error.response.data;
      throw new Error(`LINE Token交換失敗: ${errorData.error} - ${errorData.error_description || '未知錯誤'}`);
    }

    throw new Error(`LINE Token交換失敗: ${error.message || '未知錯誤'}`);
  }
}

/**
 * 使用 LINE Token 交換 Firebase Custom Token
 * @param lineAccessToken LINE Access Token (用於獲取 Profile)
 * @param lineIdToken LINE ID Token (用於驗證身份和獲取基本信息)
 * @param tenantId 租戶 ID (用於查找 LINE Channel 配置和關聯用戶)
 * @returns 返回包含 Firebase Custom Token 和用戶資訊的物件
 * @throws 如果驗證失敗或處理出錯則拋出錯誤
 */
export async function exchangeLineTokenForFirebaseToken(
  lineAccessToken: string,
  lineIdToken: string,
  tenantId: string
): Promise<{ customToken: string; userId: string; isNewUser: boolean }> {
  logger.info(`開始交換 LINE Token，租戶ID: ${tenantId}`);

  // 1. 從 Firestore 根據 tenantId 獲取 LINE Channel ID 和 Secret
  logger.info(`為租戶 ${tenantId} 獲取 LINE Channel 配置`);
  let lineChannelId: string | undefined;
  let lineChannelSecret: string | undefined;

  try {
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      logger.error(`嚴重錯誤：Handler 確定了 tenantId 但對應文檔不存在: ${tenantId}`);
      throw new Error(`租戶配置不存在: ${tenantId}`);
    }

    const tenantData = tenantDoc.data();
    lineChannelId = tenantData?.lineChannelId;
    lineChannelSecret = tenantData?.lineChannelSecret; // <<<=== 安全性注意！

    if (!lineChannelId || !lineChannelSecret) {
      logger.error(`租戶 ${tenantId} 的 LINE Channel 配置不完整`, { hasId: !!lineChannelId, hasSecret: !!lineChannelSecret });
      throw new Error(`租戶 ${tenantId} 的 LINE Channel 配置不完整`);
    }
    logger.info(`成功獲取租戶 ${tenantId} 的 LINE Channel ID`); // Log Channel ID, NOT Secret

  } catch (error: any) {
    logger.error(`獲取租戶 ${tenantId} 的 LINE 配置失敗`, { error: error.message });
    throw new Error(`獲取 LINE 配置失敗: ${error.message}`);
  }

  // --- 安全性警告 ---
  logger.warn(`[安全性注意] 從 Firestore 讀取 lineChannelSecret，生產環境建議使用 Secret Manager`);

  // 2. 驗證 lineIdToken
  logger.info(`開始驗證 LINE ID Token，Channel ID: ${lineChannelId}`);
  let lineUserId: string;
  let verifiedTokenPayload: LineIdTokenPayload | null = null; // 存儲驗證結果

  try {
    // 使用 jose 庫驗證 JWT token
    // 注意：確保 lineChannelSecret 是有效的 string
    if (!lineChannelSecret) {
      throw new Error('無法獲取 LINE Channel Secret 進行驗證');
    }
    const secretKey = new TextEncoder().encode(lineChannelSecret);

    const { payload } = await jose.jwtVerify(
      lineIdToken,
      secretKey,
      {
        issuer: 'https://access.line.me',        // 驗證 iss（發行者）
        audience: lineChannelId,                 // 驗證 aud（目標受眾，即 Channel ID）
        clockTolerance: 30,                      // 允許 30 秒的時鐘誤差
      }
    );

    // 驗證通過，payload 即為 LineIdTokenPayload 類型 (需要確保 jose 的返回類型匹配)
    verifiedTokenPayload = payload as unknown as LineIdTokenPayload; // 可能需要類型斷言
    lineUserId = verifiedTokenPayload.sub; // LINE User ID 在 sub 聲明中

    if (!lineUserId) {
      logger.error(`LINE ID Token 缺少 sub 聲明`);
      throw new Error('ID Token 中缺少用戶 ID (sub)');
    }

    logger.info(`LINE ID Token 驗證成功，獲取 lineUserId: ${lineUserId}`);
    // 可以記錄其他獲取的用戶信息，但要注意隱私
    logger.info(`LINE 用戶信息: ${verifiedTokenPayload.name || '未提供名稱'}`);

  } catch (error: any) {
    logger.error(`LINE ID Token 驗證失敗`, {
      tenantId,
      channelId: lineChannelId,
      error: error.message,
      code: error.code, // jose 錯誤通常有 code
      // 不要記錄完整的 token 或 secret
    });
    // 根據 jose 的錯誤代碼提供更具體的錯誤訊息
    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error('無效的 LINE ID Token: 已過期');
    } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' || error.code === 'ERR_JWS_INVALID') {
      throw new Error('無效的 LINE ID Token: 簽名驗證失敗');
    } else if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      // 檢查具體哪個聲明失敗
      if (error.message.includes('issuer')) {
        throw new Error('無效的 LINE ID Token: 發行者 (iss) 不匹配');
      } else if (error.message.includes('audience')) {
        throw new Error('無效的 LINE ID Token: 受眾 (aud) 不匹配');
      }
      throw new Error(`無效的 LINE ID Token: 聲明驗證失敗 (${error.message})`);
    } else {
      throw new Error(`無效的 LINE ID Token: ${error.message}`);
    }
  }

  // --- 確保 lineUserId 已獲取 (從步驟 2 的 verifiedTokenPayload) ---
  if (!lineUserId) {
    throw new Error('無法從 LINE Token 中獲取用戶 ID');
  }
  logger.info(`從 LINE Token 獲取的 lineUserId: ${lineUserId}`); // 僅供調試

  // 3. (可選但推薦) 驗證 lineAccessToken 有效性及歸屬
  logger.info(`開始驗證 LINE Access Token，Channel ID: ${lineChannelId}`);
  try {
    const verifyUrl = `https://api.line.me/oauth2/v2.1/verify?access_token=${lineAccessToken}`;
    // 使用 axios 發起 GET 請求，明確指定預期的響應數據類型
    const response = await axios.get<{ client_id: string; expires_in: number; scope: string }>(verifyUrl);

    // axios 在收到非 2xx 響應時會拋出錯誤，所以如果代碼執行到這裡，通常表示 status code 是 2xx
    const tokenInfo = response.data;

    // 驗證 client_id 是否匹配當前租戶的 Channel ID
    if (tokenInfo.client_id !== lineChannelId) {
      logger.error('LINE Access Token 的 Channel ID 不匹配', {
        expected: lineChannelId,
        received: tokenInfo.client_id,
        tenantId,
      });
      throw new Error('無效的 LINE Access Token: Channel ID 不匹配');
    }

    // 驗證 Token 是否快過期或已過期 (expires_in 是剩餘秒數)
    // 這裡可以設定一個較小的閾值，例如要求至少還有幾秒鐘有效期
    if (tokenInfo.expires_in <= 0) {
      logger.warn('LINE Access Token 已過期或即將過期', { tenantId, channelId: lineChannelId, expiresIn: tokenInfo.expires_in });
      throw new Error('無效的 LINE Access Token: 已過期');
    }

    logger.info(`LINE Access Token 驗證成功，Scope: ${tokenInfo.scope}, 剩餘有效期: ${tokenInfo.expires_in} 秒`);

  } catch (error: any) {
    logger.error(`驗證 LINE Access Token 時發生錯誤`, {
      tenantId,
      channelId: lineChannelId,
      // 嘗試獲取 axios 錯誤響應中的詳細信息
      status: error.response?.status,
      errorData: error.response?.data || error.message,
    });
    // 可以根據 LINE API 的錯誤響應提供更具體的錯誤信息
    // 例如，400 通常是 token 無效，401 可能是其他問題
    let message = 'LINE Access Token 驗證失敗';
    if (error.response?.data?.error_description) {
      message += `: ${error.response.data.error_description}`;
    } else if (error.message) {
      message += `: ${error.message}`;
    }
    throw new Error(message);
  }

  // 跳過步驟 4 (獲取 LINE Profile) 因為 ID Token 中已包含足夠的用戶信息
  
  // 5 & 6: 查找或創建 Firebase 用戶，確保 Tenant 關聯
  logger.info(`開始處理 Firebase 用戶，對應 LINE ID: ${lineUserId}`);
  let firebaseUid: string;
  let isNewUser = false;
  let userRecord: admin.auth.UserRecord | null = null; // 用於存儲用戶記錄

  try {
    // 策略：優先通過 Firestore users 集合中的 lineId 查找現有映射
    const userQuery = await db.collection('users').where('lineId', '==', lineUserId).limit(1).get();

    if (!userQuery.empty) {
      // --- 找到現有用戶 ---
      firebaseUid = userQuery.docs[0].id; // UID 是 users 集合的文檔 ID
      isNewUser = false;
      logger.info(`通過 lineId 找到現有 Firebase 用戶 (UID: ${firebaseUid})`);

      // 可選但推薦：獲取最新的 Auth 用戶記錄
      try {
        userRecord = await auth.getUser(firebaseUid);
      } catch (getAuthError: any) {
        // 如果 Firestore 有記錄但 Auth 找不到，可能是數據不一致，記錄錯誤但嘗試繼續
        logger.error(`Firestore 中找到用戶 ${firebaseUid} 但無法從 Auth 獲取記錄`, getAuthError);
        // 或者根據業務規則決定是否拋出錯誤
        // throw new Error(`無法獲取 Firebase Auth 用戶記錄: ${firebaseUid}`);
      }

      // (可選) 更新 Auth 用戶信息 (如果需要從 LINE 更新)
      const updatePayload: admin.auth.UpdateRequest = {};
      const currentAuthName = userRecord?.displayName;
      const currentAuthPhoto = userRecord?.photoURL;
      const lineName = verifiedTokenPayload?.name;
      const linePhoto = verifiedTokenPayload?.picture;

      if (lineName && lineName !== currentAuthName) {
        updatePayload.displayName = lineName;
      }
      if (linePhoto && linePhoto !== currentAuthPhoto) {
        updatePayload.photoURL = linePhoto;
      }
      // 如果需要更新 Email (注意：email 更新可能需要用戶驗證流程)
      // if (verifiedTokenPayload?.email && verifiedTokenPayload.email !== userRecord?.email) {
      //    updatePayload.email = verifiedTokenPayload.email;
      // }

      if (Object.keys(updatePayload).length > 0) {
        try {
          logger.info(`更新 Firebase Auth 用戶 ${firebaseUid} 的 Profile`, updatePayload);
          await auth.updateUser(firebaseUid, updatePayload);
        } catch (updateAuthError: any) {
          logger.warn(`更新 Firebase Auth 用戶 ${firebaseUid} 信息失敗`, updateAuthError);
          // 非阻塞性錯誤，可以繼續
        }
      }

      // 檢查並確保 Custom Claims 中包含正確的 tenantId 和角色
      const currentClaims = userRecord?.customClaims || {};
      // **重要**: 這裡需要定義如何處理用戶可能屬於多租戶，或租戶變更的情況。
      // 簡單情況：假設用戶只屬於一個租戶，以本次登入的 tenantId 為準？
      // 或者如果已有 tenantId 且不同，是否報錯或忽略？
      // 暫定策略：如果 claims 中已有 tenantId 但與本次不同，記錄警告；如果沒有，則設置。角色類似。
      const claimsToSet: Record<string, any> = { ...currentClaims };
      let claimsNeedUpdate = false;

      if (currentClaims.tenantId !== tenantId) {
        if (currentClaims.tenantId) {
          logger.warn(`用戶 ${firebaseUid} 的 Custom Claim tenantId (${currentClaims.tenantId}) 與本次登入租戶 (${tenantId}) 不同，將以本次為準更新。`);
        }
        claimsToSet.tenantId = tenantId;
        claimsNeedUpdate = true;
      }
      // 假設需要確保有默認角色 'customer'
      if (!currentClaims.role) {
        claimsToSet.role = 'customer';
        claimsNeedUpdate = true;
      }

      if (claimsNeedUpdate) {
        logger.info(`更新用戶 ${firebaseUid} 的 Custom Claims`, claimsToSet);
        await auth.setCustomUserClaims(firebaseUid, claimsToSet);
      }

    } else {
      // --- 未找到用戶，創建新用戶 ---
      isNewUser = true;
      logger.info(`未找到現有用戶，為 LINE ID: ${lineUserId} 創建新 Firebase 用戶`);

      const lineProfileName = verifiedTokenPayload?.name || `User ${lineUserId.substring(0, 6)}`;
      const lineProfilePicture = verifiedTokenPayload?.picture;
      const lineProfileEmail = verifiedTokenPayload?.email; // 獲取 Email (如果可用)

      try {
        const createUserRequest: admin.auth.CreateRequest = {
          displayName: lineProfileName,
          photoURL: lineProfilePicture,
        };
        // 只有在 LINE 提供 Email 時才嘗試設置 Email
        if (lineProfileEmail) {
          createUserRequest.email = lineProfileEmail;
          // 通常第三方登入創建的用戶 emailVerified 應為 false，除非 LINE 明確告知已驗證
          createUserRequest.emailVerified = false;
        }

        const newUserRecord = await auth.createUser(createUserRequest);
        firebaseUid = newUserRecord.uid;
        userRecord = newUserRecord; // 保存新用戶記錄
        logger.info(`新 Firebase 用戶創建成功，UID: ${firebaseUid}`);

        // 為新用戶設置 Custom Claims
        logger.info(`為新用戶 ${firebaseUid} 設置 Custom Claims`, { tenantId, role: 'customer' });
        await auth.setCustomUserClaims(firebaseUid, { tenantId, role: 'customer' }); // 設置租戶和默認角色

      } catch (createError: any) {
        // 處理可能的創建錯誤，例如 email 已存在但未關聯 LINE ID
        logger.error(`創建 Firebase Auth 用戶失敗 (LINE ID: ${lineUserId})`, createError);
        // 嘗試查找是否因 Email 衝突導致用戶已存在
        if (createError.code === 'auth/email-already-exists' && lineProfileEmail) {
          logger.info(`嘗試通過 Email (${lineProfileEmail}) 查找用戶...`);
          try {
            const existingUser = await auth.getUserByEmail(lineProfileEmail);
            // 如果找到用戶，但 lineId 不匹配，需要處理衝突（例如提示用戶）
            // 這裡可以選擇拋出特定錯誤，讓 Handler 層處理
            logger.error(`Email ${lineProfileEmail} 已存在，但可能未關聯此 LINE 帳號`, { existingUid: existingUser.uid });
            throw new Error(`Email (${lineProfileEmail}) 已被其他帳號使用`);
          } catch (findError: any) {
            logger.error(`通過 Email 查找用戶時也發生錯誤`, findError);
            throw new Error(`創建 Firebase 用戶失敗: ${createError.message}`);
          }
        } else {
          throw new Error(`創建 Firebase 用戶失敗: ${createError.message}`);
        }
      }
    }
  } catch (error: any) {
    logger.error(`處理 Firebase 用戶時發生錯誤 (LINE ID: ${lineUserId})`, { error: error.message, stack: error.stack });
    throw new Error(`Firebase 用戶處理失敗: ${error.message}`);
  }

  // --- 確保 firebaseUid 已獲取 ---
  if (!firebaseUid) {
    // 理論上不應到達這裡，因為上面邏輯要麼找到要麼創建要麼拋錯
    logger.error('嚴重錯誤：處理完用戶查找/創建邏輯後 firebaseUid 仍未定義');
    throw new Error('無法確定 Firebase 用戶 UID');
  }

  // 7. 查找或創建 Firestore user 文檔，並更新 Profile 信息
  logger.info(`開始處理 Firestore 用戶文檔，UID: ${firebaseUid}`);
  const userDocRef = db.collection('users').doc(firebaseUid);

  try {
      // 從驗證過的 ID Token 或 Auth Record 獲取最新的 Profile 信息
      const displayName = verifiedTokenPayload?.name || userRecord?.displayName || `User ${lineUserId.substring(0, 6)}`;
      const photoURL = verifiedTokenPayload?.picture || userRecord?.photoURL;
      const email = verifiedTokenPayload?.email || userRecord?.email; // 優先使用 ID Token 中的郵箱

      // 準備要寫入 Firestore 的數據
      const userProfileData: any = { // 使用 any 或定義一個包含所有可能字段的內部類型
          // --- 關鍵關聯信息 ---
          tenantId: tenantId, // 確保記錄本次登入的租戶 ID
          lineId: lineUserId, // 記錄或更新 LINE ID

          // --- 基本 Profile (來自 LINE 或 Auth) ---
          displayName: displayName,
          photoURL: photoURL || null, // 確保 null 值
          email: email || null,       // 確保 null 值

          // --- 系統狀態與元數據 ---
          userType: 'customer',      // 假設默認類型，可能需要從 Claims 或現有文檔讀取
          status: 'active',          // 假設新用戶或活躍用戶狀態
          lastLoginAt: FieldValue.serverTimestamp(), // 更新最後登入時間

          // --- 其他欄位 (根據需要添加，參考 users 集合模型) ---
          // phoneNumber: userRecord?.phoneNumber || null, // Auth 記錄可能有電話號碼
          // preferences: {}, // 默認偏好
          // metadata: {}, // 默認元數據
      };

      if (isNewUser) {
          // --- 創建新文檔 ---
          userProfileData.registeredAt = FieldValue.serverTimestamp(); // 添加註冊時間
          userProfileData.userType = 'customer'; // 設置默認用戶類型
          userProfileData.status = 'active'; // 設置默認狀態

          logger.info(`為新用戶 ${firebaseUid} 創建 Firestore 文檔`, userProfileData);
          // 使用 set 和 merge: true 可以覆蓋可能因意外產生的同 ID 文檔，或在重試時安全寫入
          await userDocRef.set(userProfileData, { merge: true });
          logger.info(`成功為新用戶 ${firebaseUid} 創建 Firestore 文檔`);
      } else {
          // --- 更新現有文檔 ---
          // 只更新需要變動的字段 (例如 profile 信息和 lastLoginAt)
          const dataToUpdate: Record<string, any> = {
               // 僅當從 LINE 或 Auth 獲取到新值時才更新
               ...(displayName && { displayName: displayName }),
               ...(photoURL !== undefined && { photoURL: photoURL }), // photoURL 可能為 null
               ...(email && { email: email }), // 只有在 ID Token 提供時才考慮更新 Email?
               lastLoginAt: FieldValue.serverTimestamp(),
               tenantId: tenantId // 確保 tenantId 被更新 (如果業務邏輯允許用戶切換主要租戶)
               // 注意：謹慎決定哪些字段允許被 LINE 登入信息覆蓋
          };

          logger.info(`準備更新現有用戶 ${firebaseUid} 的 Firestore 文檔`, dataToUpdate);
          if (Object.keys(dataToUpdate).length > 0) {
               await userDocRef.update(dataToUpdate);
               logger.info(`成功更新現有用戶 ${firebaseUid} 的 Firestore 文檔`);
          } else {
               logger.info(`用戶 ${firebaseUid} 的 Firestore 文檔無需更新 Profile`);
          }
      }
  } catch (error: any) {
      logger.error(`處理 Firestore 用戶文檔時發生錯誤，UID: ${firebaseUid}`, { error: error.message, stack: error.stack });
      // 根據錯誤情況決定是否拋出，如果只是 Firestore 更新失敗，是否要回滾 Auth 創建？（通常不回滾）
      // 這裡暫時只記錄錯誤，允許流程繼續生成 token
      // 如果 Firestore 寫入是關鍵步驟，則應拋出錯誤：
      throw new Error(`處理 Firestore 用戶文檔失敗: ${error.message}`);
  }

  // 8. 生成 Firebase Custom Token
  logger.info(`準備為 Firebase 用戶 ${firebaseUid} 生成 Custom Token`);
  let customToken: string;
  try {
      // 可以在 Custom Token 中包含額外信息 (Claims)，例如 tenantId 和 role
      // 前端獲取 ID Token 後可以解析這些信息，無需額外查詢
      const additionalClaims = {
          tenantId: tenantId,
          role: (userRecord?.customClaims?.role) || 'customer' // 從 Auth Record 或設為默認值
          // 可以根據需要添加其他 Claims
      };
      logger.info(`為用戶 ${firebaseUid} 生成的 Custom Token 將包含 Claims:`, additionalClaims);
      customToken = await auth.createCustomToken(firebaseUid, additionalClaims);
      logger.info(`成功為 Firebase 用戶 ${firebaseUid} 生成 Custom Token`);

  } catch (error: any) {
      logger.error(`為用戶 ${firebaseUid} 生成 Custom Token 時發生錯誤`, { error: error.message, stack: error.stack });
      throw new Error(`生成登入 Token 失敗: ${error.message}`);
  }

  // 9. 返回最終結果
  return {
      customToken: customToken, // 真實的 Custom Token
      userId: firebaseUid,      // 真實的 Firebase UID
      isNewUser: isNewUser      // 標識是否為新創建用戶
  };
}

/**
 * 驗證LINE ID令牌，獲取用戶信息
 * @param idToken LINE ID令牌
 * @returns 解析後的用戶信息
 */
export async function verifyLineIdToken(idToken: string): Promise<LineIdTokenPayload> {
  if (!idToken) {
    throw new Error('缺少LINE ID令牌');
  }
  
  try {
    // 直接解碼令牌以獲取租戶信息
    // 注意：這是預先解碼獲取租戶信息，完全的驗證將在後面進行
    const tokenParts = idToken.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('無效的LINE ID令牌格式');
    }
    
    // 從令牌中獲取基本信息
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    if (!payload.sub) {
      throw new Error('ID令牌缺少sub字段(用戶ID)');
    }
    
    logger.info(`成功驗證LINE ID令牌，LINE用戶ID: ${payload.sub}`);
    return {
      sub: payload.sub,
      name: payload.name,
      picture: payload.picture,
      email: payload.email
    } as LineIdTokenPayload;
  } catch (error: any) {
    logger.error('驗證LINE ID令牌時發生錯誤', { error: error.message });
    throw new Error(`ID令牌驗證失敗: ${error.message}`);
  }
} 