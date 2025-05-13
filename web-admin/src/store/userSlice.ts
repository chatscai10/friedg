import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User, UserState, UpdateUserStatusPayload, UpdateUserRolesPayload, CreateUserPayload, UpdateUserPayload, UsersResponse } from '../types/user.types';
import * as userService from '../services/userService';

// 初始狀態
const initialState: UserState = {
  users: [],
  currentUser: null,
  loading: false,
  error: null,
  saveLoading: false,
  deleteLoading: false,
  saveError: null,
  deleteError: null,
  statusUpdateLoading: false,
  rolesUpdateLoading: false,
  pagination: {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1
  }
};

// 異步 Thunks

// 獲取工作區用戶列表
export const fetchWorkspaceUsers = createAsyncThunk(
  'users/fetchWorkspaceUsers',
  async (_, { rejectWithValue }) => {
    try {
      const users = await userService.WorkspaceUsers();
      return users;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '獲取工作區用戶列表失敗');
    }
  }
);

// 獲取用戶列表（支持分頁）
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (params?: { tenantId?: string; storeId?: string; status?: string; page?: number; limit?: number; search?: string }, { rejectWithValue }) => {
    try {
      const response = await userService.fetchUsers(params);
      return response;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '獲取用戶列表失敗');
    }
  }
);

// 獲取單個用戶詳情
export const fetchUserById = createAsyncThunk(
  'users/fetchUserById',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await userService.fetchUserById(userId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '獲取用戶詳情失敗');
    }
  }
);

// 更新用戶狀態
export const updateUserStatus = createAsyncThunk(
  'users/updateUserStatus',
  async ({ userId, statusData }: { userId: string; statusData: UpdateUserStatusPayload }, { rejectWithValue }) => {
    try {
      const response = await userService.updateUserStatus(userId, statusData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '更新用戶狀態失敗');
    }
  }
);

// 更新用戶角色
export const updateUserRoles = createAsyncThunk(
  'users/updateUserRoles',
  async ({ userId, roleData }: { userId: string; roleData: UpdateUserRolesPayload }, { rejectWithValue }) => {
    try {
      const response = await userService.updateUserRoles(userId, roleData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '更新用戶角色失敗');
    }
  }
);

// 創建新用戶
export const createUser = createAsyncThunk(
  'users/createUser',
  async (payload: CreateUserPayload, { rejectWithValue }) => {
    try {
      const response = await userService.createUser(payload);
      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '創建用戶失敗');
    }
  }
);

// 更新用戶基本資料
export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ userId, userData }: { userId: string; userData: UpdateUserPayload }, { rejectWithValue }) => {
    try {
      const response = await userService.updateUser(userId, userData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '更新用戶資料失敗');
    }
  }
);

// 創建 Slice
const userSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // 清除當前選中的用戶
    clearCurrentUser: (state) => {
      state.currentUser = null;
    },
    // 清除錯誤
    clearErrors: (state) => {
      state.error = null;
      state.saveError = null;
      state.deleteError = null;
    },
    // 手動設置當前用戶（用於編輯時）
    setCurrentUser: (state, action: PayloadAction<User | null>) => {
      state.currentUser = action.payload;
    },
    // 設置當前頁碼
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.pagination.currentPage = action.payload;
    },
    // 設置每頁數量
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pagination.pageSize = action.payload;
      state.pagination.currentPage = 1; // 重置到第一頁
    }
  },
  extraReducers: (builder) => {
    // 處理 fetchWorkspaceUsers
    builder
      .addCase(fetchWorkspaceUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaceUsers.fulfilled, (state, action) => {
        state.users = action.payload;
        state.loading = false;
      })
      .addCase(fetchWorkspaceUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
    
    // 處理 fetchUsers
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        const response = action.payload as UsersResponse;
        state.users = response.data;
        if (response.pagination) {
          state.pagination = response.pagination;
        }
        state.loading = false;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
    
    // 處理 fetchUserById
      .addCase(fetchUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserById.fulfilled, (state, action) => {
        state.currentUser = action.payload;
        state.loading = false;
      })
      .addCase(fetchUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
    
    // 處理 updateUserStatus
      .addCase(updateUserStatus.pending, (state) => {
        state.statusUpdateLoading = true;
        state.saveError = null;
      })
      .addCase(updateUserStatus.fulfilled, (state, action) => {
        const index = state.users.findIndex(user => user.userId === action.payload.userId);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser && state.currentUser.userId === action.payload.userId) {
          state.currentUser = action.payload;
        }
        state.statusUpdateLoading = false;
      })
      .addCase(updateUserStatus.rejected, (state, action) => {
        state.statusUpdateLoading = false;
        state.saveError = action.payload as string;
      })
    
    // 處理 updateUserRoles
      .addCase(updateUserRoles.pending, (state) => {
        state.rolesUpdateLoading = true;
        state.saveError = null;
      })
      .addCase(updateUserRoles.fulfilled, (state, action) => {
        const index = state.users.findIndex(user => user.userId === action.payload.userId);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser && state.currentUser.userId === action.payload.userId) {
          state.currentUser = action.payload;
        }
        state.rolesUpdateLoading = false;
      })
      .addCase(updateUserRoles.rejected, (state, action) => {
        state.rolesUpdateLoading = false;
        state.saveError = action.payload as string;
      })
      
    // 處理 createUser
      .addCase(createUser.pending, (state) => {
        state.saveLoading = true;
        state.saveError = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        // 將新用戶添加到列表頂部
        state.users = [action.payload, ...state.users];
        state.saveLoading = false;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.saveLoading = false;
        state.saveError = action.payload as string;
      })
      
    // 處理 updateUser
      .addCase(updateUser.pending, (state) => {
        state.saveLoading = true;
        state.saveError = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        // 更新用戶列表中對應的用戶
        const index = state.users.findIndex(user => user.userId === action.payload.userId);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        // 如果當前正在編輯的用戶就是被更新的用戶，同時更新當前用戶
        if (state.currentUser && state.currentUser.userId === action.payload.userId) {
          state.currentUser = action.payload;
        }
        state.saveLoading = false;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.saveLoading = false;
        state.saveError = action.payload as string;
      });
  }
});

// 導出 actions 和 reducer
export const { clearCurrentUser, clearErrors, setCurrentUser, setCurrentPage, setPageSize } = userSlice.actions;
export default userSlice.reducer; 