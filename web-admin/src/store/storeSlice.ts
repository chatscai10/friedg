import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  Store, 
  StoreState, 
  FetchStoresParams,
  CreateStorePayload,
  UpdateStorePayload,
  UpdateStoreAttendanceSettingsPayload
} from '../types/store';
import {
  fetchStores,
  fetchStoreById,
  createStore,
  updateStore,
  deleteStore,
  updateStoreAttendanceSettings
} from '../services/storeService';

// 初始狀態
const initialState: StoreState = {
  stores: [],
  currentStore: null,
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
    totalPages: 0
  },
  filters: {
    search: '',
    status: ''
  }
};

// 獲取店鋪列表的異步 Action
export const fetchStoresThunk = createAsyncThunk(
  'stores/fetchStores',
  async (params: FetchStoresParams, { rejectWithValue }) => {
    try {
      const response = await fetchStores(params);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '獲取店鋪列表失敗');
    }
  }
);

// 獲取單個店鋪詳情的異步 Action
export const fetchStoreByIdThunk = createAsyncThunk(
  'stores/fetchStoreById',
  async (storeId: string, { rejectWithValue }) => {
    try {
      const response = await fetchStoreById(storeId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '獲取店鋪詳情失敗');
    }
  }
);

// 創建店鋪的異步 Action
export const createStoreThunk = createAsyncThunk(
  'stores/createStore',
  async (storeData: CreateStorePayload, { rejectWithValue }) => {
    try {
      const response = await createStore(storeData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '創建店鋪失敗');
    }
  }
);

// 更新店鋪的異步 Action
export const updateStoreThunk = createAsyncThunk(
  'stores/updateStore',
  async ({ storeId, storeData }: { storeId: string; storeData: UpdateStorePayload }, { rejectWithValue }) => {
    try {
      const response = await updateStore(storeId, storeData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '更新店鋪失敗');
    }
  }
);

// 刪除店鋪的異步 Action
export const deleteStoreThunk = createAsyncThunk(
  'stores/deleteStore',
  async (storeId: string, { rejectWithValue }) => {
    try {
      await deleteStore(storeId);
      return storeId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '刪除店鋪失敗');
    }
  }
);

// 更新店鋪考勤設定的異步 Action
export const updateStoreAttendanceSettingsThunk = createAsyncThunk(
  'stores/updateStoreAttendanceSettings',
  async ({ storeId, attendanceData }: { storeId: string; attendanceData: UpdateStoreAttendanceSettingsPayload }, { rejectWithValue }) => {
    try {
      const response = await updateStoreAttendanceSettings(storeId, attendanceData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || '更新店鋪考勤設定失敗');
    }
  }
);

// 創建 Slice
const storeSlice = createSlice({
  name: 'stores',
  initialState,
  reducers: {
    // 設置當前頁
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.pagination.currentPage = action.payload;
    },
    // 設置每頁數量
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pagination.pageSize = action.payload;
      state.pagination.currentPage = 1; // 重置到第一頁
    },
    // 設置搜索條件
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.filters.search = action.payload;
    },
    // 設置狀態篩選
    setStatusFilter: (state, action: PayloadAction<string>) => {
      state.filters.status = action.payload;
    },
    // 清除當前店鋪
    clearCurrentStore: (state) => {
      state.currentStore = null;
    },
    // 清除錯誤信息
    clearErrors: (state) => {
      state.error = null;
      state.saveError = null;
      state.deleteError = null;
    }
  },
  extraReducers: (builder) => {
    // 處理獲取店鋪列表
    builder
      .addCase(fetchStoresThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStoresThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.stores = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchStoresThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
    
    // 處理獲取單個店鋪詳情
    builder
      .addCase(fetchStoreByIdThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStoreByIdThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.currentStore = action.payload;
      })
      .addCase(fetchStoreByIdThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
    
    // 處理創建店鋪
    builder
      .addCase(createStoreThunk.pending, (state) => {
        state.saveLoading = true;
        state.saveError = null;
      })
      .addCase(createStoreThunk.fulfilled, (state, action) => {
        state.saveLoading = false;
        state.stores.push(action.payload);
        state.currentStore = action.payload;
      })
      .addCase(createStoreThunk.rejected, (state, action) => {
        state.saveLoading = false;
        state.saveError = action.payload as string;
      });
    
    // 處理更新店鋪
    builder
      .addCase(updateStoreThunk.pending, (state) => {
        state.saveLoading = true;
        state.saveError = null;
      })
      .addCase(updateStoreThunk.fulfilled, (state, action) => {
        state.saveLoading = false;
        // 更新 stores 數組中的對應項
        const index = state.stores.findIndex(store => store.id === action.payload.id);
        if (index !== -1) {
          state.stores[index] = action.payload;
        }
        // 如果是當前正在編輯的店鋪，也更新 currentStore
        if (state.currentStore && state.currentStore.id === action.payload.id) {
          state.currentStore = action.payload;
        }
      })
      .addCase(updateStoreThunk.rejected, (state, action) => {
        state.saveLoading = false;
        state.saveError = action.payload as string;
      });
    
    // 處理更新店鋪考勤設定
    builder
      .addCase(updateStoreAttendanceSettingsThunk.pending, (state) => {
        state.saveLoading = true;
        state.saveError = null;
      })
      .addCase(updateStoreAttendanceSettingsThunk.fulfilled, (state, action) => {
        state.saveLoading = false;
        // 更新 stores 數組中的對應項
        const index = state.stores.findIndex(store => store.id === action.payload.id);
        if (index !== -1) {
          state.stores[index] = action.payload;
        }
        // 如果是當前正在編輯的店鋪，也更新 currentStore
        if (state.currentStore && state.currentStore.id === action.payload.id) {
          state.currentStore = action.payload;
        }
      })
      .addCase(updateStoreAttendanceSettingsThunk.rejected, (state, action) => {
        state.saveLoading = false;
        state.saveError = action.payload as string;
      });
    
    // 處理刪除店鋪
    builder
      .addCase(deleteStoreThunk.pending, (state) => {
        state.deleteLoading = true;
        state.deleteError = null;
      })
      .addCase(deleteStoreThunk.fulfilled, (state, action) => {
        state.deleteLoading = false;
        // 從 stores 數組中移除被刪除的店鋪
        state.stores = state.stores.filter(store => store.id !== action.payload);
        // 如果刪除的是當前正在查看的店鋪，清除 currentStore
        if (state.currentStore && state.currentStore.id === action.payload) {
          state.currentStore = null;
        }
      })
      .addCase(deleteStoreThunk.rejected, (state, action) => {
        state.deleteLoading = false;
        state.deleteError = action.payload as string;
      });
  }
});

// 導出 actions
export const { 
  setCurrentPage, 
  setPageSize, 
  setSearchTerm, 
  setStatusFilter,
  clearCurrentStore,
  clearErrors
} = storeSlice.actions;

// 導出 reducer
export default storeSlice.reducer; 