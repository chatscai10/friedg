import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { AuthenticatedUser } from '../types/user.types';
import { authService } from '../services/authService';
import firebase from 'firebase/compat/app';

// 身份驗證狀態接口
export interface AuthState {
  isAuthenticated: boolean;
  user: AuthenticatedUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

// 初始狀態
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null
};

// 異步 Thunk Actions

// 登入操作
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      // 呼叫 authService 的登入方法
      await authService.login(email, password);
      
      // 獲取用戶
      const user = firebase.auth().currentUser;
      if (!user) {
        throw new Error('登入失敗：未能獲取用戶信息');
      }
      
      // 強制刷新並獲取 token 和 claims
      const idTokenResult = await user.getIdTokenResult(true);
      
      // 從 claims 中提取角色、權限等信息
      const claims = idTokenResult.claims;
      
      // 構建 AuthenticatedUser 物件
      const authenticatedUser: AuthenticatedUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        roles: claims.roles ? (Array.isArray(claims.roles) ? claims.roles : [claims.roles]) : [],
        permissions: claims.permissions ? (Array.isArray(claims.permissions) ? claims.permissions : [claims.permissions]) : [],
        tenantId: claims.tenantId || null,
        storeId: claims.storeId || null,
        additionalStoreIds: claims.additionalStoreIds || [],
        roleLevel: claims.roleLevel || 999, // 默認值為最低權限
        customClaims: { ...claims }, // 存儲所有 custom claims
        lastLogin: new Date(),
      };
      
      return {
        user: authenticatedUser,
        token: idTokenResult.token
      };
    } catch (error) {
      console.error('登入失敗:', error);
      return rejectWithValue(error instanceof Error ? error.message : '登入失敗，請稍後再試');
    }
  }
);

// 登出操作
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      return true;
    } catch (error) {
      console.error('登出失敗:', error);
      return rejectWithValue(error instanceof Error ? error.message : '登出失敗，請稍後再試');
    }
  }
);

// 從 Firebase 獲取當前用戶狀態
export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = firebase.auth().currentUser;
      
      if (!user) {
        return { user: null, token: null };
      }
      
      // 強制刷新並獲取 token 和 claims
      const idTokenResult = await user.getIdTokenResult(true);
      
      // 從 claims 中提取角色、權限等信息
      const claims = idTokenResult.claims;
      
      // 構建 AuthenticatedUser 物件
      const authenticatedUser: AuthenticatedUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        roles: claims.roles ? (Array.isArray(claims.roles) ? claims.roles : [claims.roles]) : [],
        permissions: claims.permissions ? (Array.isArray(claims.permissions) ? claims.permissions : [claims.permissions]) : [],
        tenantId: claims.tenantId || null,
        storeId: claims.storeId || null,
        additionalStoreIds: claims.additionalStoreIds || [],
        roleLevel: claims.roleLevel || 999, // 默認值為最低權限
        customClaims: { ...claims }, // 存儲所有 custom claims
        lastLogin: new Date(),
      };
      
      return {
        user: authenticatedUser,
        token: idTokenResult.token
      };
    } catch (error) {
      console.error('獲取當前用戶失敗:', error);
      return rejectWithValue(error instanceof Error ? error.message : '獲取用戶信息失敗');
    }
  }
);

// 創建 Auth Slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // 清除錯誤
    clearAuthError: (state) => {
      state.error = null;
    },
    
    // 手動設置用戶（用於開發/測試）
    setUser: (state, action: PayloadAction<{ user: AuthenticatedUser | null, token: string | null }>) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = !!user;
      state.loading = false;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // 處理登入操作
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.loading = false;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.loading = false;
        state.error = action.payload as string;
      })
    
    // 處理登出操作
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.loading = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
    // 處理獲取當前用戶操作
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        if (action.payload.user) {
          state.isAuthenticated = true;
          state.user = action.payload.user;
          state.token = action.payload.token;
        } else {
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

// 導出 actions
export const { clearAuthError, setUser } = authSlice.actions;

// 導出 reducer
export default authSlice.reducer; 