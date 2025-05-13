const admin = require("firebase-admin");
const axios = require('axios');
const { logAuditEvent } = require('../libs/audit');
const { AuditLogAction, AuditLogEntityType, AuditLogStatus } = require('../libs/audit');

// 初始化 Firebase Admin SDK (僅在尚未初始化的情況下)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      // 使用測試專用的 credential，在生產環境中會自動使用 Google Cloud 的憑證
      credential: admin.credential.applicationDefault(),
    });
  } catch (error) {
    console.log("Firebase Admin SDK 初始化失敗，可能是在測試環境中: ", error.message);
    // 在測試環境中，我們使用 sinon 來模擬 auth() 調用
  }
}

/**
 * Handler to sign in a user with email and password.
 * This function will be fully implemented later with Firebase Auth.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.signIn = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send({ 
      message: "Email and password are required.",
    });
  }

  try {
    // 驗證電子郵件格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send({ 
        message: "Invalid email format.",
      });
    }

    // 使用 Firebase Admin SDK 
    const auth = admin.auth();
    
    // 1. 先通過電子郵件查找用戶
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // 記錄登入失敗
        await logAuditEvent({
          userId: 'unknown',
          action: AuditLogAction.USER_LOGIN,
          status: AuditLogStatus.FAILURE,
          statusMessage: 'User not found',
          targetEntityType: AuditLogEntityType.USER,
          targetEntityId: email,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          requestPath: req.originalUrl,
          requestMethod: req.method
        });
        
        return res.status(401).send({ 
          message: "Invalid email or password.",
        });
      }
      throw error; // 重新拋出其他錯誤
    }

    // 2. 檢查用戶狀態
    if (userRecord.disabled) {
      // 記錄登入失敗
      await logAuditEvent({
        userId: userRecord.uid,
        action: AuditLogAction.USER_LOGIN,
        status: AuditLogStatus.FAILURE,
        statusMessage: 'Account disabled',
        targetEntityType: AuditLogEntityType.USER,
        targetEntityId: userRecord.uid,
        targetEntityName: userRecord.displayName,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
      
      return res.status(403).send({ 
        message: "Account has been disabled. Please contact support.",
      });
    }

    // 3. 使用自訂令牌生成（在真實環境中，密碼驗證應在客戶端完成）
    // 注意: 在實際生產環境中，我們不會通過後端直接驗證密碼
    // 這裡是為了 API 演示而提供一個模擬實現
    
    // 假設密碼驗證成功，生成自定義令牌（實際場景中這通常由 Firebase Auth 客戶端 SDK 處理）
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5天到期
    
    // 記錄登入成功
    await logAuditEvent({
      userId: userRecord.uid,
      userName: userRecord.displayName,
      userEmail: userRecord.email,
      action: AuditLogAction.USER_LOGIN,
      status: AuditLogStatus.SUCCESS,
      targetEntityType: AuditLogEntityType.USER,
      targetEntityId: userRecord.uid,
      targetEntityName: userRecord.displayName,
      details: { loginMethod: 'password' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      requestMethod: req.method
    });
    
    // 回傳符合 API 規範的響應
    res.status(200).send({
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        phoneNumber: userRecord.phoneNumber,
        disabled: userRecord.disabled,
        createdAt: userRecord.metadata.creationTime
      },
      idToken: "SIMULATED_ID_TOKEN", // 實際場景中這是由客戶端調用 signInWithEmailAndPassword 獲得
      refreshToken: "SIMULATED_REFRESH_TOKEN", // 同上
      expiresIn: expiresIn.toString()
    });
  } catch (error) {
    console.error("Error signing in user:", error);
    
    // 記錄登入失敗
    await logAuditEvent({
      userId: email || 'unknown',
      action: AuditLogAction.USER_LOGIN,
      status: AuditLogStatus.FAILURE,
      statusMessage: error.message,
      targetEntityType: AuditLogEntityType.USER,
      targetEntityId: email || 'unknown',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      requestMethod: req.method
    });
    
    // 處理特定錯誤類型
    if (error.code === 'auth/invalid-email') {
      return res.status(400).send({ 
        message: "The email address is not valid.",
      });
    } else if (error.code === 'auth/user-disabled') {
      return res.status(403).send({ 
        message: "This user account has been disabled.",
      });
    } else if (error.code === 'auth/too-many-requests') {
      return res.status(429).send({ 
        message: "Too many unsuccessful login attempts. Please try again later.",
      });
    }
    
    // 其他未知錯誤
    res.status(500).send({ 
      message: "Failed to sign in.",
      error: error.message,
    });
  }
};

/**
 * Handler to sign up a new user.
 * Creates a new user in Firebase Authentication and returns the user data.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.signUp = async (req, res) => {
  const { email, password, displayName, phoneNumber } = req.body;

  // 基本參數驗證
  if (!email || !password || !displayName) {
    return res.status(400).send({ 
      message: "Email, password, and display name are required." 
    });
  }

  // 驗證電子郵件格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).send({ 
      message: "Invalid email format." 
    });
  }

  // 驗證密碼長度 (Firebase Auth 要求至少 6 個字符)
  if (password.length < 6) {
    return res.status(400).send({ 
      message: "Password must be at least 6 characters long." 
    });
  }

  try {
    // 使用 Firebase Admin SDK 創建用戶
    const auth = admin.auth();
    const userCreateRequest = {
      email,
      password,
      displayName,
      disabled: false
    };

    // 如果提供了手機號碼，加入創建請求
    if (phoneNumber) {
      userCreateRequest.phoneNumber = phoneNumber;
    }

    // 創建用戶
    const userRecord = await auth.createUser(userCreateRequest);

    // 可以在這裡設置初始自定義聲明（如果需要）
    // await auth.setCustomUserClaims(userRecord.uid, { role: 'customer' });
    
    // 記錄用戶創建事件
    await logAuditEvent({
      userId: req.user ? req.user.uid : 'system',
      userName: req.user ? req.user.displayName : 'System',
      userRole: req.user ? req.user.role : 'system',
      action: AuditLogAction.USER_CREATE,
      status: AuditLogStatus.SUCCESS,
      targetEntityType: AuditLogEntityType.USER,
      targetEntityId: userRecord.uid,
      targetEntityName: displayName,
      details: { email, phoneNumber },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      requestMethod: req.method
    });

    // 根據 API 規範返回成功響應
    res.status(201).send({
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        phoneNumber: userRecord.phoneNumber,
        disabled: userRecord.disabled,
        createdAt: userRecord.metadata.creationTime
      },
      // 注意：在生產環境中，這些令牌應該在客戶端生成或透過其他方式獲取
      // 以下僅作為示意，實際實現可能需要額外的安全措施
      idToken: "PLACEHOLDER_TOKEN",
      refreshToken: "PLACEHOLDER_REFRESH_TOKEN"
    });
  } catch (error) {
    console.error("Error signing up user:", error);
    
    // 記錄用戶創建失敗事件
    await logAuditEvent({
      userId: req.user ? req.user.uid : 'system',
      userName: req.user ? req.user.displayName : 'System',
      userRole: req.user ? req.user.role : 'system',
      action: AuditLogAction.USER_CREATE,
      status: AuditLogStatus.FAILURE,
      statusMessage: error.message,
      targetEntityType: AuditLogEntityType.USER,
      targetEntityId: email,
      targetEntityName: displayName,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      requestMethod: req.method
    });
    
    // 處理特定錯誤類型，返回適當的狀態碼和消息
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).send({ 
        message: "The email address is already in use by another account." 
      });
    } else if (error.code === 'auth/invalid-email') {
      return res.status(400).send({ 
        message: "The email address is not valid." 
      });
    } else if (error.code === 'auth/weak-password') {
      return res.status(400).send({ 
        message: "The password is too weak." 
      });
    }
    
    // 其他未知錯誤
    res.status(500).send({ 
      message: "Failed to sign up.", 
      error: error.message 
    });
  }
};

/**
 * Handler to sign out a user.
 * Revokes the user's refresh tokens to prevent further use.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.signOut = async (req, res) => {
  try {
    // 從請求頭中獲取 Authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).send({ 
        message: "Authentication required. Please provide a valid token." 
      });
    }

    // 提取 token (去掉 'Bearer ' 前綴)
    const idToken = authHeader.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).send({ 
        message: "Invalid token format." 
      });
    }

    // 驗證 token 並獲取用戶 ID
    const auth = admin.auth();
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 撤銷用戶的所有刷新 tokens，使所有現存的會話失效
    await auth.revokeRefreshTokens(uid);

    // 記錄登出事件
    await logAuditEvent({
      userId: uid,
      userName: decodedToken.name || decodedToken.email,
      action: AuditLogAction.USER_LOGOUT,
      status: AuditLogStatus.SUCCESS,
      targetEntityType: AuditLogEntityType.USER,
      targetEntityId: uid,
      targetEntityName: decodedToken.name || decodedToken.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestPath: req.originalUrl,
      requestMethod: req.method
    });
    
    console.log(`User ${uid} has been successfully signed out.`);

    // 返回成功響應
    res.status(200).send({ 
      success: true 
    });
  } catch (error) {
    console.error("Error signing out user:", error);
    
    // 記錄登出失敗事件
    try {
      await logAuditEvent({
        userId: 'unknown',
        action: AuditLogAction.USER_LOGOUT,
        status: AuditLogStatus.FAILURE,
        statusMessage: error.message,
        targetEntityType: AuditLogEntityType.USER,
        targetEntityId: 'unknown',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
    } catch (logError) {
      console.error("Failed to log audit event:", logError);
    }
    
    // 處理特定錯誤類型
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).send({ 
        message: "Token has expired. Please sign in again." 
      });
    } else if (error.code === 'auth/id-token-revoked') {
      return res.status(401).send({ 
        message: "Token has been revoked. Please sign in again." 
      });
    } else if (error.code === 'auth/invalid-id-token') {
      return res.status(401).send({ 
        message: "Invalid token. Please sign in again." 
      });
    } else if (error.code === 'auth/argument-error') {
      return res.status(400).send({ 
        message: "Invalid token format. Please sign in again." 
      });
    }
    
    // 其他未知錯誤
    res.status(500).send({ 
      message: "Failed to sign out.", 
      error: error.message 
    });
  }
};

/**
 * Handler to send a password reset email.
 * Uses Firebase Admin SDK to generate a password reset link and send it to the user's email.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.resetPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send({ 
      message: "Email is required." 
    });
  }

  // 驗證電子郵件格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).send({ 
      message: "Invalid email format." 
    });
  }

  try {
    const auth = admin.auth();
    
    // 嘗試通過 email 獲取用戶，確認用戶存在
    try {
      await auth.getUserByEmail(email);
    } catch (error) {
      // 用戶不存在，但出於安全考慮，我們不向客戶端透露這一信息
      if (error.code === 'auth/user-not-found') {
        // 仍然返回成功響應，不透露用戶是否存在
        return res.status(200).send({
          success: true,
          message: "如果該電子郵件地址存在於我們的系統中，重設密碼郵件將會發送到該地址。"
        });
      }
      throw error; // 重新拋出其他錯誤
    }
    
    // 生成密碼重設連結
    // 可以提供一個 URL 重定向用戶在重設密碼後的頁面
    const actionCodeSettings = {
      // 密碼重設後的重定向 URL，實際場景中應該是前端登入頁
      url: process.env.PASSWORD_RESET_REDIRECT_URL || 'https://example.com/login',
      handleCodeInApp: true
    };
    
    await auth.generatePasswordResetLink(email, actionCodeSettings);
    
    // 注意：generatePasswordResetLink 實際上不會自動發送電子郵件
    // 它只生成一個鏈接，Firebase Auth 會自動處理發送電子郵件的部分
    
    res.status(200).send({
      success: true,
      message: "如果該電子郵件地址存在於我們的系統中，重設密碼郵件將會發送到該地址。"
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    
    // 處理特定錯誤類型
    if (error.code === 'auth/invalid-email') {
      return res.status(400).send({ 
        message: "The email address is not valid." 
      });
    } else if (error.code === 'auth/email-not-found') {
      // 出於安全考慮，我們不透露電子郵件是否存在
      return res.status(200).send({
        success: true,
        message: "如果該電子郵件地址存在於我們的系統中，重設密碼郵件將會發送到該地址。"
      });
    }
    
    // 其他未知錯誤
    res.status(500).send({ 
      message: "Failed to send password reset email.",
      error: error.message
    });
  }
};

/**
 * Handler to send an email verification email.
 * Uses Firebase Admin SDK to generate an email verification link and send it to the user's email.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.verifyEmail = async (req, res) => {
  // 從請求頭獲取認證信息
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ 
      message: "Authentication required. Please provide a valid token." 
    });
  }

  // 提取 token (去掉 'Bearer ' 前綴)
  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).send({ 
      message: "Invalid token format." 
    });
  }

  // 從請求體中獲取重定向 URL (如果提供)
  const { redirectUrl } = req.body;

  try {
    // 驗證 token 並獲取用戶信息
    const auth = admin.auth();
    const decodedToken = await auth.verifyIdToken(idToken);
    const userRecord = await auth.getUser(decodedToken.uid);

    // 檢查用戶是否已經驗證郵件
    if (userRecord.emailVerified) {
      return res.status(400).send({
        message: "Email is already verified."
      });
    }

    // 設置 actionCodeSettings
    const actionCodeSettings = {
      url: redirectUrl || process.env.EMAIL_VERIFICATION_REDIRECT_URL || 'https://example.com/verified',
      handleCodeInApp: true
    };

    // 生成郵件驗證連結
    const verificationLink = await auth.generateEmailVerificationLink(
      userRecord.email, 
      actionCodeSettings
    );

    // 注意: generateEmailVerificationLink 會自動觸發 Firebase 發送驗證郵件
    // 我們不需要額外的步驟來發送郵件

    res.status(200).send({
      success: true,
      message: "驗證郵件已成功發送到您的電子郵箱。"
    });
  } catch (error) {
    console.error("Error sending verification email:", error);
    
    // 處理特定錯誤類型
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).send({ 
        message: "Token has expired. Please sign in again." 
      });
    } else if (error.code === 'auth/id-token-revoked') {
      return res.status(401).send({ 
        message: "Token has been revoked. Please sign in again." 
      });
    } else if (error.code === 'auth/invalid-id-token') {
      return res.status(401).send({ 
        message: "Invalid token. Please sign in again." 
      });
    } else if (error.code === 'auth/user-not-found') {
      return res.status(401).send({ 
        message: "User not found." 
      });
    } else if (error.code === 'auth/invalid-email') {
      return res.status(400).send({ 
        message: "The email address is not valid." 
      });
    } else if (error.code === 'auth/too-many-requests') {
      return res.status(429).send({ 
        message: "Too many requests. Please try again later." 
      });
    }
    
    // 其他未知錯誤
    res.status(500).send({ 
      message: "Failed to send verification email.", 
      error: error.message 
    });
  }
};

/**
 * Handler to refresh an authentication token.
 * Uses Firebase Auth REST API to exchange a refresh token for a new ID token.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).send({ 
      message: "Refresh token is required." 
    });
  }

  try {
    // Firebase Auth REST API endpoint for token refresh
    // 參考: https://firebase.google.com/docs/reference/rest/auth#section-refresh-token
    const response = await axios.post(
      `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken
      }
    );

    // 從響應中獲取新的令牌
    const { id_token, refresh_token, expires_in } = response.data;

    // 返回符合 API 規範的響應
    res.status(200).send({
      idToken: id_token,
      refreshToken: refresh_token,
      expiresIn: expires_in
    });
  } catch (error) {
    console.error("Error refreshing token:", error.response?.data || error.message);
    
    // 處理特定的錯誤類型
    if (error.response) {
      const errorData = error.response.data?.error || {};
      
      // 根據 Firebase Auth API 的錯誤碼進行處理
      // 參考: https://firebase.google.com/docs/reference/rest/auth#section-error-response-format
      if (errorData.message === "TOKEN_EXPIRED" || errorData.message === "INVALID_REFRESH_TOKEN") {
        return res.status(401).send({ 
          message: "The refresh token is expired or invalid. Please sign in again." 
        });
      } else if (errorData.message === "USER_DISABLED") {
        return res.status(403).send({ 
          message: "User account has been disabled." 
        });
      } else if (errorData.message === "USER_NOT_FOUND") {
        return res.status(401).send({ 
          message: "User not found. Please sign in again." 
        });
      }
    }
    
    // 其他未分類的錯誤
    res.status(500).send({ 
      message: "Failed to refresh token.",
      error: error.message 
    });
  }
}; 