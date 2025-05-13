/**
 * 身份驗證相關類型定義
 */

/**
 * LINE Token 交換請求體
 */
export interface LineTokenExchangeRequest {
  lineAccessToken: string;
  lineIdToken: string;
  tenantHint?: string;
}

/**
 * LINE Token 交換響應
 */
export interface LineTokenExchangeResponse {
  customToken: string;
  user: {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    lineId: string;
    tenantId: string | null;
    isNewUser: boolean;
  };
}

/**
 * LINE Profile 資訊
 */
export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  email?: string;
}

/**
 * 從 LINE 取得的 Token 資訊
 */
export interface LineTokenInfo {
  client_id: string;
  expires_in: number;
  scope: string;
}

/**
 * 從 LINE ID Token 解析出的使用者資訊
 */
export interface LineIdTokenPayload {
  iss: string;
  sub: string; // LINE user ID
  aud: string; // Channel ID
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
  email?: string;
} 