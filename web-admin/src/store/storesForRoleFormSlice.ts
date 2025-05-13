import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Store, StoresForRoleFormState } from '../types/store';
import { getStoresByTenantId, ApiError } from '../services/storeService';
import type { RootState } from './index';

const initialState: StoresForRoleFormState = {
  storesList: [],
  loading: false,
  error: null,
  selectedTenantId: null,
};

export const fetchStoresByTenantId = createAsyncThunk<
  Store[], // Return type of the payload creator
  string,  // First argument to the payload creator (tenantId)
  { 
    rejectValue: string; // Type for thunkAPI.rejectWithValue
    state: RootState;    // Type for thunkAPI.getState
  }
>(
  'storesForRoleForm/fetchByTenantId',
  async (tenantId: string, thunkAPI) => {
    // Optional: Check if we need to fetch
    // const { storesForRoleForm } = thunkAPI.getState();
    // if (storesForRoleForm.selectedTenantId === tenantId && storesForRoleForm.storesList.length > 0 && !storesForRoleForm.loading) {
    //   return storesForRoleForm.storesList; // Or thunkAPI.rejectWithValue with a specific reason if needed
    // }
    try {
      const stores = await getStoresByTenantId(tenantId);
      return stores;
    } catch (error) {
      if (error instanceof ApiError) {
        return thunkAPI.rejectWithValue(error.message);
      }
      return thunkAPI.rejectWithValue((error as Error).message || 'Failed to fetch stores for the selected tenant.');
    }
  }
  // Optional: condition to prevent unnecessary fetches
  // ,
  // {
  //   condition: (tenantId, { getState }) => {
  //     const { storesForRoleForm } = getState() as RootState;
  //     if (storesForRoleForm.loading && storesForRoleForm.selectedTenantId === tenantId) {
  //       return false; // Already loading for this tenantId
  //     }
  //     return true;
  //   },
  // }
);

const storesForRoleFormSlice = createSlice({
  name: 'storesForRoleForm',
  initialState,
  reducers: {
    clearStoresForRoleFormError(state) {
      state.error = null;
    },
    resetStoresForRoleForm(state) {
      state.storesList = [];
      state.error = null;
      state.loading = false;
      state.selectedTenantId = null;
    },
    // Optionally, a reducer to manually set stores if needed, e.g., from another source
    // setStoresForTenant(state, action: PayloadAction<{ tenantId: string, stores: Store[] }>) {
    //   state.storesList = action.payload.stores;
    //   state.selectedTenantId = action.payload.tenantId;
    //   state.loading = false;
    //   state.error = null;
    // }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStoresByTenantId.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.selectedTenantId = action.meta.arg; // tenantId is in action.meta.arg
        state.storesList = []; // Clear previous list while new one is loading
      })
      .addCase(fetchStoresByTenantId.fulfilled, (state, action: PayloadAction<Store[]>) => {
        state.loading = false;
        state.storesList = action.payload;
        // Ensure selectedTenantId still matches the one this data was fetched for
        // This should be guaranteed by the pending state setting action.meta.arg,
        // but a check could be added if there's a complex race condition possibility.
        // if (state.selectedTenantId === action.meta.arg) {
        //   state.storesList = action.payload;
        // }
      })
      .addCase(fetchStoresByTenantId.rejected, (state, action) => {
        state.loading = false;
        // Only set error if the rejection was for the currently selected tenant
        // This helps avoid overriding a successful fetch with a stale rejection error if tenantId changed quickly
        if (state.selectedTenantId === action.meta.arg) {
          state.error = action.payload ?? 'Failed to fetch stores.'; // action.payload is string (rejectValue)
          state.storesList = []; // Clear list on error for this tenant
        }
      });
  },
});

export const { clearStoresForRoleFormError, resetStoresForRoleForm } = storesForRoleFormSlice.actions;

export const selectStoresForRoleFormList = (state: RootState): Store[] => state.storesForRoleForm.storesList;
export const selectStoresForRoleFormLoading = (state: RootState): boolean => state.storesForRoleForm.loading;
export const selectStoresForRoleFormError = (state: RootState): string | null => state.storesForRoleForm.error;
export const selectStoresForRoleFormSelectedTenantId = (state: RootState): string | null | undefined => state.storesForRoleForm.selectedTenantId;

export default storesForRoleFormSlice.reducer; 