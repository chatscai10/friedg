import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Role, RoleState, RoleRequest, CreateRolePayload, UpdateRolePayload, RolesResponse } from '../types/role';
import * as roleService from '../services/roleService';

// 初始狀態
const initialState: RoleState = {
  roles: [],
  currentRole: null,
  loading: false,
  error: null,
  saveLoading: false,
  deleteLoading: false,
  saveError: null,
  deleteError: null,
  pagination: {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1
  }
};

// 異步 Thunks

// 獲取工作區角色列表
export const fetchWorkspaceRoles = createAsyncThunk(
  'roles/fetchWorkspaceRoles',
  async (_, { rejectWithValue }) => {
    try {
      const roles = await roleService.WorkspaceRoles();
      return roles;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '獲取工作區角色列表失敗');
    }
  }
);

// 獲取角色列表（支持分頁）
export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async (params?: { scope?: string; tenantId?: string; page?: number; limit?: number; search?: string }, { rejectWithValue }) => {
    try {
      const response = await roleService.fetchRoles(params);
      return response;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '獲取角色列表失敗');
    }
  }
);

// 獲取單個角色詳情
export const fetchRoleById = createAsyncThunk(
  'roles/fetchRoleById',
  async (roleId: string, { rejectWithValue }) => {
    try {
      const response = await roleService.fetchRoleById(roleId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '獲取角色詳情失敗');
    }
  }
);

// 創建新角色
export const createRole = createAsyncThunk(
  'roles/createRole',
  async (roleData: CreateRolePayload, { rejectWithValue }) => {
    try {
      const response = await roleService.createRole(roleData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '創建角色失敗');
    }
  }
);

// 更新現有角色
export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async ({ roleId, roleData }: { roleId: string; roleData: UpdateRolePayload }, { rejectWithValue }) => {
    try {
      const response = await roleService.updateRole(roleId, roleData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '更新角色失敗');
    }
  }
);

// 刪除角色
export const deleteRole = createAsyncThunk(
  'roles/deleteRole',
  async (roleId: string, { rejectWithValue }) => {
    try {
      await roleService.deleteRole(roleId);
      return roleId;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : '刪除角色失敗');
    }
  }
);

// 創建 Slice
const roleSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    // 清除當前選中的角色
    clearCurrentRole: (state) => {
      state.currentRole = null;
    },
    // 清除錯誤
    clearErrors: (state) => {
      state.error = null;
      state.saveError = null;
      state.deleteError = null;
    },
    // 手動設置當前角色（用於編輯時）
    setCurrentRole: (state, action: PayloadAction<Role | null>) => {
      state.currentRole = action.payload;
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
    // 處理 fetchWorkspaceRoles
    builder
      .addCase(fetchWorkspaceRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaceRoles.fulfilled, (state, action) => {
        state.roles = action.payload;
        state.loading = false;
      })
      .addCase(fetchWorkspaceRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
    
    // 處理 fetchRoles
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        const response = action.payload as RolesResponse;
        state.roles = response.data;
        if (response.pagination) {
          state.pagination = response.pagination;
        }
        state.loading = false;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
    
    // 處理 fetchRoleById
      .addCase(fetchRoleById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoleById.fulfilled, (state, action) => {
        state.currentRole = action.payload;
        state.loading = false;
      })
      .addCase(fetchRoleById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
    
    // 處理 createRole
      .addCase(createRole.pending, (state) => {
        state.saveLoading = true;
        state.saveError = null;
      })
      .addCase(createRole.fulfilled, (state, action) => {
        state.roles.push(action.payload);
        state.currentRole = action.payload;
        state.saveLoading = false;
      })
      .addCase(createRole.rejected, (state, action) => {
        state.saveLoading = false;
        state.saveError = action.payload as string;
      })
    
    // 處理 updateRole
      .addCase(updateRole.pending, (state) => {
        state.saveLoading = true;
        state.saveError = null;
      })
      .addCase(updateRole.fulfilled, (state, action) => {
        const index = state.roles.findIndex(role => role.roleId === action.payload.roleId);
        if (index !== -1) {
          state.roles[index] = action.payload;
        }
        state.currentRole = action.payload;
        state.saveLoading = false;
      })
      .addCase(updateRole.rejected, (state, action) => {
        state.saveLoading = false;
        state.saveError = action.payload as string;
      })
    
    // 處理 deleteRole
      .addCase(deleteRole.pending, (state) => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.roles = state.roles.filter(role => role.roleId !== action.payload);
        if (state.currentRole && state.currentRole.roleId === action.payload) {
          state.currentRole = null;
        }
        state.deleteLoading = false;
      })
      .addCase(deleteRole.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload as string;
      });
  }
});

// 導出 actions 和 reducer
export const { clearCurrentRole, clearErrors, setCurrentRole, setCurrentPage, setPageSize } = roleSlice.actions;
export default roleSlice.reducer; 