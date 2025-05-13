import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import roleReducer from './roleSlice';
import userReducer from './userSlice';
import storeReducer from './storeSlice';

// 配置 Redux store
export const store = configureStore({
  reducer: {
    auth: authReducer,
    roles: roleReducer,
    users: userReducer,
    stores: storeReducer,
    // 後續可添加其他 reducers
  },
  // 可選配置
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 忽略 Date 類型序列化檢查警告
        ignoredActionPaths: ['payload.user.lastLogin', 'payload.user.createdAt'],
        ignoredPaths: ['auth.user.lastLogin', 'auth.user.createdAt'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// 導出 RootState 和 AppDispatch 類型
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 