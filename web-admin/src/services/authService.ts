import firebase from "firebase/compat/app";
import {
  // Auth, // Type not explicitly needed here
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  connectAuthEmulator, // Import emulator connector
  getIdToken,
  IdTokenResult, // Import IdTokenResult
  signInWithCustomToken
} from "firebase/auth";
import { auth } from "../firebaseConfig"; // Import the configured auth instance
import axios from "axios";

// Helper type for internal flag check (use carefully)
type AuthWithEmulatorFlag = typeof auth & { _isEmulated?: boolean };

// Connect to the Auth emulator if in development
// NOTE: This needs to be called BEFORE any auth operations
if (import.meta.env.DEV) {
  try {
    // Check if already connected (Firebase throws error if connected multiple times)
    // A simple check like this might not be foolproof in HMR scenarios,
    // but it prevents the most common connection errors during development.
    if (!auth._hasConnectedEmulator) { // Use Compat version's flag
        console.log("Connecting to Auth Emulator at http://localhost:9099...");
        auth.useEmulator("http://localhost:9099");
        console.log("Auth Emulator connected.");
    } else {
        console.log("Auth Emulator connection already established.")
    }
  } catch (error) {
    console.error("Error connecting to Auth Emulator: ", error);
  }
}

/**
 * 使用電子郵件和密碼登錄用戶。
 * @param email 用戶的電子郵件。
 * @param password 用戶的密碼。
 * @returns 成功時解析為 User 的 Promise。
 */
const login = async (email: string, password: string): Promise<firebase.User | null> => {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    // 登錄成功後強制刷新令牌以獲取最新的聲明
    if (userCredential.user) {
      await userCredential.user.getIdToken(true);
      console.log("登錄成功，令牌已刷新。");
      // 可選在登錄後立即獲取並記錄聲明
      const tokenResult = await getIdTokenResult(false); // 不需要立即再次強制刷新
      console.log("登錄後的聲明:", tokenResult?.claims);
      return userCredential.user;
    }
    return null;
  } catch (error) {
    console.error("登錄失敗:", error);
    throw error; // 重新拋出錯誤，由調用組件處理
  }
};

/**
 * 登出當前用戶。
 * @returns 登出完成時解析的 Promise。
 */
const logout = (): Promise<void> => {
  return auth.signOut();
};

/**
 * 監聽用戶身份驗證狀態的變化。
 * @param callback 當身份驗證狀態變化時調用的函數。
 *                它接收 User 對象或 null。
 * @returns 取消監聽的函數。
 */
const onAuthStateChange = (callback: (user: firebase.User | null) => void) => {
  return auth.onAuthStateChanged(callback);
};

/**
 * 獲取當前已登錄的用戶。
 * @returns 當前 User 對象或 null。
 */
const getCurrentUser = (): firebase.User | null => {
  return auth.currentUser;
};

/**
 * 獲取當前用戶的認證Token
 * @returns 認證Token字符串
 */
export const getAuthToken = async (): Promise<string> => {
  const currentUser = firebase.auth().currentUser;
  
  if (!currentUser) {
    throw new Error('未登入，請先登入系統');
  }
  
  try {
    const token = await currentUser.getIdToken(true);
    return token;
  } catch (error) {
    console.error('獲取認證Token失敗:', error);
    throw new Error('獲取認證Token失敗，請重試或重新登入');
  }
};

/**
 * 檢查用戶是否已登入
 * @returns 是否已登入
 */
export const isAuthenticated = (): boolean => {
  return !!firebase.auth().currentUser;
};

/**
 * 獲取當前登入用戶的ID
 * @returns 用戶ID
 */
export const getCurrentUserId = (): string | null => {
  const currentUser = firebase.auth().currentUser;
  return currentUser ? currentUser.uid : null;
};

/**
 * 獲取當前已登錄用戶的自定義聲明。
 * @returns 解析為自定義聲明對象的 Promise，如果未登錄用戶或令牌解析失敗則為 null。
 */
const getUserClaims = async (): Promise<Record<string, unknown> | null> => {
  const user = getCurrentUser();
  if (user) {
    try {
      const idTokenResult = await user.getIdTokenResult(false);
      return idTokenResult.claims;
    } catch (error) {
      console.error("獲取用戶聲明時出錯:", error);
      // 檢查錯誤是否為具有 'code' 屬性的對象
      if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-token-expired') {
        console.warn("獲取聲明時用戶令牌已過期，需要刷新/重新登錄。");
      }
      return null;
    }
  } else {
    return null;
  }
};

/**
 * 獲取當前用戶的 ID 令牌結果（包括聲明）
 * @param forceRefresh 如果為 true，強制刷新令牌
 * @returns 解析為 ID 令牌結果的 Promise
 */
const getIdTokenResult = async (forceRefresh: boolean = false): Promise<firebase.auth.IdTokenResult | null> => {
  const user = auth.currentUser;
  if (user) {
    try {
      console.log(`獲取 ID 令牌結果 (強制刷新: ${forceRefresh})`);
      const tokenResult = await user.getIdTokenResult(forceRefresh);
      console.log("從 getIdTokenResult 獲取的用戶聲明:", tokenResult.claims);
      return tokenResult;
    } catch (error) {
      console.error("獲取 ID 令牌結果時出錯:", error);
      // FirebaseError 的類型保護
      if (error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-token-expired') {
        console.warn("用戶令牌已過期，嘗試為結果刷新...");
        try {
          const refreshedTokenResult = await user.getIdTokenResult(true);
          console.log("已刷新的用戶聲明:", refreshedTokenResult.claims);
          return refreshedTokenResult;
        } catch (refreshError) {
          console.error("為結果刷新過期令牌時出錯:", refreshError);
          return null;
        }
      }
      return null;
    }
  }
  return null;
};

/**
 * 獲取當前用戶聲明（可能已刷新）
 * @returns 用戶聲明或 null
 */
const getCurrentUserClaims = async (): Promise<Record<string, unknown> | null> => {
  // 在明確請求當前聲明時始終強制刷新
  const tokenResult = await getIdTokenResult(true);
  return tokenResult ? tokenResult.claims : null;
};

/**
 * 獲取LINE登入URL
 * @param redirectUri 授權後的重定向URI
 * @param tenantHint 可選的租戶提示
 * @returns LINE登入URL
 */
const getLineLoginUrl = (redirectUri: string, tenantHint?: string): string => {
  // 生成隨機state參數用於CSRF保護
  const state = btoa(JSON.stringify({
    redirect_uri: redirectUri,
    tenant_hint: tenantHint,
    timestamp: Date.now()
  }));
  
  // 構建API URL，請求LINE登入
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002/api';
  let url = `${baseUrl}/auth/line/login?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  
  if (tenantHint) {
    url += `&tenant_hint=${encodeURIComponent(tenantHint)}`;
  }
  
  return url;
};

/**
 * 處理LINE登入回調，使用獲取的tokens交換Firebase自定義token並完成登入
 * @param accessToken LINE access token
 * @param idToken LINE ID token
 * @param tenantHint 可選的租戶提示
 * @returns 登入的Firebase用戶
 */
const handleLineCallback = async (
  accessToken: string, 
  idToken: string, 
  tenantHint?: string
): Promise<firebase.User | null> => {
  try {
    // 發送請求交換Firebase自定義token
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002/api';
    const response = await axios.post(`${baseUrl}/auth/line/token-exchange`, {
      lineAccessToken: accessToken,
      lineIdToken: idToken,
      tenantHint
    });
    
    const { customToken, userId, isNewUser } = response.data;
    
    if (!customToken) {
      throw new Error('未能獲取Firebase自定義token');
    }
    
    // 使用自定義token登入Firebase
    const userCredential = await auth.signInWithCustomToken(customToken);
    
    if (userCredential.user) {
      // 強制刷新token獲取最新的自定義聲明
      await userCredential.user.getIdToken(true);
      console.log(`LINE登入成功${isNewUser ? ' (新用戶)' : ''}，用戶ID: ${userId}`);
      return userCredential.user;
    }
    
    return null;
  } catch (error) {
    console.error('LINE登入處理失敗:', error);
    throw error;
  }
};

/**
 * 使用LINE登入
 * @param tenantHint 可選的租戶提示
 * @returns Promise<void>
 */
const loginWithLine = (tenantHint?: string): void => {
  try {
    // 構建回調URL，應為當前網站的特定路徑用於處理LINE回調
    const callbackUrl = `${window.location.origin}/line-callback`;
    
    // 獲取並導向至LINE登入URL
    const lineLoginUrl = getLineLoginUrl(callbackUrl, tenantHint);
    window.location.href = lineLoginUrl;
  } catch (error) {
    console.error('LINE登入初始化失敗:', error);
    throw error;
  }
};

export const authService = {
  login,
  logout,
  onAuthStateChange,
  getCurrentUser,
  getAuthToken,
  getUserClaims,
  getIdTokenResult,
  getCurrentUserClaims,
  isAuthenticated,
  getCurrentUserId,
  loginWithLine,
  handleLineCallback
}; 