import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TenantItem, TenantState } from '../types/tenant';
import * as tenantService from '../services/tenantService';
import { RootState } from './index'; // 假設 RootState 在 store/index.ts 或 store.ts

const initialState: TenantState = {
  tenantsList: [],
  loading: false,
  error: null,
};

/**
 * Async Thunk to fetch all available tenants.
 */
export const fetchTenants = createAsyncThunk(
  'tenants/fetchTenants',
  async (_, { rejectWithValue }) => {
    try {
      const tenants = await tenantService.getAllTenants();
      return tenants; // Should return TenantItem[]
    } catch (error: any) {
      const errorMessage = error.message || '獲取所有租戶列表時發生未知錯誤';
      return rejectWithValue(errorMessage);
    }
  }
);

const tenantSlice = createSlice({
  name: 'tenants',
  initialState,
  reducers: {
    clearTenantsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTenants.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTenants.fulfilled, (state, action: PayloadAction<TenantItem[]>) => {
        state.tenantsList = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchTenants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string; 
        state.tenantsList = []; // 清空列表以反映錯誤狀態
      });
  },
});

// Action creators are generated for each case reducer function
export const { clearTenantsError } = tenantSlice.actions;

// Selectors
export const selectAllTenants = (state: RootState): TenantItem[] => state.tenants.tenantsList;
export const selectTenantsLoading = (state: RootState): boolean => state.tenants.loading;
export const selectTenantsError = (state: RootState): string | null => state.tenants.error;

export default tenantSlice.reducer; 