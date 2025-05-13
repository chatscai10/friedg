import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { PermissionItem, PermissionState } from '../types/permission';
import * as permissionService from '../services/permissionService';
import { RootState } from './index'; // 假设 RootState 在 store/index.ts 或 store.ts

const initialState: PermissionState = {
  permissionsList: [],
  loading: false,
  error: null,
};

/**
 * Async Thunk to fetch all available application permissions.
 */
export const fetchAppPermissions = createAsyncThunk(
  'permissions/fetchAppPermissions',
  async (_, { rejectWithValue }) => {
    try {
      const permissions = await permissionService.getAllPermissions();
      return permissions; // Should return PermissionItem[]
    } catch (error: any) {
      // The error from permissionService.getAllPermissions (if it's an ApiError or a basic Error)
      // will be caught here. We want to pass a serializable error message to the reducer.
      const errorMessage = error.message || '獲取所有權限列表時發生未知錯誤';
      return rejectWithValue(errorMessage);
    }
  }
);

const permissionSlice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {
    clearPermissionsError: (state) => {
      state.error = null;
    },
    // Example: Manually set permissions if needed for testing or other scenarios
    // setPermissions: (state, action: PayloadAction<PermissionItem[]>) => {
    //   state.permissionsList = action.payload;
    //   state.loading = false;
    //   state.error = null;
    // },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppPermissions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAppPermissions.fulfilled, (state, action: PayloadAction<PermissionItem[]>) => {
        state.permissionsList = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchAppPermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string; // Error message from rejectWithValue
        state.permissionsList = []; // Clear list on error
      });
  },
});

// Action creators are generated for each case reducer function
export const { clearPermissionsError } = permissionSlice.actions;

// Selectors
export const selectAllPermissions = (state: RootState): PermissionItem[] => state.permissions.permissionsList;
export const selectPermissionsLoading = (state: RootState): boolean => state.permissions.loading;
export const selectPermissionsError = (state: RootState): string | null => state.permissions.error;

export default permissionSlice.reducer; 