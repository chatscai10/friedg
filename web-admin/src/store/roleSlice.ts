import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Role, RoleState, RoleRequest, CreateRolePayload, UpdateRolePayload, RolesResponse } from '../types/role';
import * as roleService from '../services/roleService';

// 初始狀態
const initialState: RoleState = {
  roles: [],
  currentRole: null,
  loading: false,
  error: null,
  deleteLoading: false,
  deleteError: null,
  createLoading: false,
  createError: null,
  updateLoading: false,
  updateError: null,
  pagination: {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1
  },
  searchTerm: '',
  scopeFilter: '',
  statusFilter: '',
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
      const errorMessage = error instanceof Error ? error.message : '創建角色失敗，請稍後再試。';
      if ((error as any).response?.data?.message) {
        return rejectWithValue((error as any).response.data.message);
      }
      return rejectWithValue(errorMessage);
    }
  }
);

// 更新現有角色
export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async (data: UpdateRolePayload & { roleId: string }, { rejectWithValue }) => {
    try {
      const { roleId, ...roleData } = data;
      const response = await roleService.updateRole(roleId, roleData);
      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新角色失敗，請稍後再試。';
      if ((error as any).response?.data?.message) {
        return rejectWithValue((error as any).response.data.message);
      }
      return rejectWithValue(errorMessage);
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
      const errorMessage = error instanceof Error ? error.message : '刪除角色失敗，請稍後再試。';
      if ((error as any).response?.data?.message) {
        return rejectWithValue((error as any).response.data.message);
      }
      return rejectWithValue(errorMessage);
    }
  }
);

// 創建 Slice
const roleSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    clearCurrentRole: (state) => {
      state.currentRole = null;
    },
    setCurrentRole: (state, action: PayloadAction<Role | null>) => {
      state.currentRole = action.payload;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.pagination.currentPage = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pagination.pageSize = action.payload;
      state.pagination.currentPage = 1;
    },
    clearCreateError: (state) => {
      state.createError = null;
    },
    clearUpdateError: (state) => {
      state.updateError = null;
    },
    clearDeleteError: (state) => {
      state.deleteError = null;
    },
    clearGeneralError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
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
    
    .addCase(fetchRoles.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(fetchRoles.fulfilled, (state, action: PayloadAction<RolesResponse>) => {
      state.roles = action.payload.data;
      if (action.payload.pagination) {
        state.pagination = action.payload.pagination;
      }
      state.loading = false;
    })
    .addCase(fetchRoles.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    })
    
    .addCase(fetchRoleById.pending, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(fetchRoleById.fulfilled, (state, action: PayloadAction<Role>) => {
      state.currentRole = action.payload;
      state.loading = false;
    })
    .addCase(fetchRoleById.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    })
    
    .addCase(createRole.pending, (state) => {
      state.createLoading = true;
      state.createError = null;
    })
    .addCase(createRole.fulfilled, (state, action: PayloadAction<Role>) => {
      state.createLoading = false;
    })
    .addCase(createRole.rejected, (state, action) => {
      state.createLoading = false;
      state.createError = action.payload as string;
    })
    
    .addCase(updateRole.pending, (state) => {
      state.updateLoading = true;
      state.updateError = null;
    })
    .addCase(updateRole.fulfilled, (state, action: PayloadAction<Role>) => {
      const index = state.roles.findIndex(role => role.roleId === action.payload.roleId);
      if (index !== -1) {
        state.roles[index] = action.payload;
      }
      if (state.currentRole && state.currentRole.roleId === action.payload.roleId) {
        state.currentRole = action.payload;
      }
      state.updateLoading = false;
    })
    .addCase(updateRole.rejected, (state, action) => {
      state.updateLoading = false;
      state.updateError = action.payload as string;
    })
    
    .addCase(deleteRole.pending, (state) => {
      state.deleteLoading = true;
      state.deleteError = null;
    })
    .addCase(deleteRole.fulfilled, (state, action: PayloadAction<string>) => {
      state.deleteLoading = false;
      state.deleteError = null;
    })
    .addCase(deleteRole.rejected, (state, action) => {
      state.deleteLoading = false;
      state.deleteError = action.payload as string;
    });
  }
});

export const { 
  clearCurrentRole, 
  setCurrentRole, 
  setCurrentPage, 
  setPageSize,
  clearCreateError,
  clearUpdateError,
  clearDeleteError,
  clearGeneralError
} = roleSlice.actions;

export default roleSlice.reducer; 