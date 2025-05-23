import apiClient from './api'; // Import the configured Axios instance
import { MenuCategory, MenuItem, MenuOptionGroup, MenuItemStockStatus } from '../types/menuItem'; // Correct type path
import { mockConfig, simulateNetworkDelay, mockLog } from '../mockConfig';
import { getMockMenuCategories, getMockMenuItems, getMockMenuCategoryById, getMockMenuItemById } from '../mock-data/menuMockData';
// Removed Store type import as it wasn't used in the provided context

// API端點 - 相對路徑即可
const API_ENDPOINTS = {
  MENU_CATEGORIES: `/menus/categories`,
  MENU_ITEMS: `/menus/items`,
  MENU_OPTIONS: `/menus/options`,
  UPLOAD_IMAGE: `/menus/items/images/upload`, // Assuming this was the intended path
  FIX_MENU: `/menus/fix-menu` // 添加修復菜單的端點
};

// Interface definitions matching the previous context (adjust if needed)
interface GetMenuItemsParams {
  categoryId?: string;
  storeId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

interface GetMenuItemsResponse {
  data: MenuItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

// Use Omit directly inline or define specific input types if preferred
// interface MenuItemInput extends Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt' | 'imageUrl' | 'thumbnailUrl' | 'stockStatus'> { }

interface MenuItemStatusUpdate {
  isActive?: boolean;
  stockStatus?: MenuItemStockStatus;
}

interface GetMenuCategoriesParams {
  storeId?: string;
  isActive?: boolean;
}

// interface MenuCategoryInput extends Omit<MenuCategory, 'id' | 'createdAt' | 'updatedAt'> { }

// --- API 函數 --- //

// Menu Items
export const getMenuItems = async (params?: GetMenuItemsParams): Promise<GetMenuItemsResponse> => {
  try {
    // 檢查是否使用模擬數據
    if (mockConfig.USE_MOCK_DATA) {
      mockLog(`獲取菜單項目列表 (模擬數據)`, params);
      await simulateNetworkDelay();
      return getMockMenuItems(params);
    }

    // 使用真實API
    const response = await apiClient.get<GetMenuItemsResponse>(API_ENDPOINTS.MENU_ITEMS, { params });
    return response.data; // Assuming API returns { data: [], pagination: {...} }
  } catch (error) {
    console.error('獲取菜單項目列表失敗:', error);
    throw error;
  }
};

export const getMenuItemById = async (id: string): Promise<MenuItem> => {
  try {
    // 檢查是否使用模擬數據
    if (mockConfig.USE_MOCK_DATA) {
      mockLog(`獲取菜單項目詳情 ID: ${id} (模擬數據)`);
      await simulateNetworkDelay();
      const item = getMockMenuItemById(id);
      if (!item) {
        throw new Error(`菜單項目不存在: ${id}`);
      }
      return item;
    }

    // 使用真實API
    const response = await apiClient.get<MenuItem>(`${API_ENDPOINTS.MENU_ITEMS}/${id}`);
    return response.data;
  } catch (error) {
    console.error(`獲取菜單項目(ID: ${id})失敗:`, error);
    throw error;
  }
};

// Assuming MenuItemInput matches the backend expectation (excluding generated fields)
export const createMenuItem = async (menuItemData: Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt' | 'imageUrl' | 'thumbnailUrl' | 'stockStatus'>): Promise<MenuItem> => {
  try {
    // Use apiClient
    const response = await apiClient.post<MenuItem>(API_ENDPOINTS.MENU_ITEMS, menuItemData);
    return response.data;
  } catch (error) {
    console.error('創建菜單項目失敗:', error);
    throw error;
  }
};

export const updateMenuItem = async (id: string, menuItemData: Partial<Omit<MenuItem, 'id' | 'createdAt' | 'updatedAt' | 'imageUrl' | 'thumbnailUrl' | 'stockStatus'>>): Promise<MenuItem> => {
  try {
    // Use apiClient
    const response = await apiClient.put<MenuItem>(`${API_ENDPOINTS.MENU_ITEMS}/${id}`, menuItemData);
    return response.data;
  } catch (error) {
    console.error(`更新菜單項目(ID: ${id})失敗:`, error);
    throw error;
  }
};

export const updateMenuItemStatus = async (id: string, statusData: MenuItemStatusUpdate): Promise<MenuItem> => {
  try {
    // Use apiClient
    const response = await apiClient.patch<MenuItem>(`${API_ENDPOINTS.MENU_ITEMS}/${id}/status`, statusData);
    return response.data;
  } catch (error) {
    console.error(`更新菜單項目狀態(ID: ${id})失敗:`, error);
    throw error;
  }
};

export const deleteMenuItem = async (id: string): Promise<{ success: boolean }> => {
  try {
    // Use apiClient
    const response = await apiClient.delete<{ success: boolean }>(`${API_ENDPOINTS.MENU_ITEMS}/${id}`);
    return response.data; // Assuming backend returns { success: true/false }
  } catch (error) {
    console.error(`刪除菜單項目(ID: ${id})失敗:`, error);
    throw error;
  }
};

// Menu Categories
export const getMenuCategories = async (params?: GetMenuCategoriesParams): Promise<{ data: MenuCategory[], pagination: { total: number } }> => {
  try {
    // 檢查是否使用模擬數據
    if (mockConfig.USE_MOCK_DATA) {
      mockLog(`獲取菜單分類列表 (模擬數據)`);
      await simulateNetworkDelay();
      return getMockMenuCategories(params);
    }

    // 使用真實API
    const response = await apiClient.get<{ data: MenuCategory[], pagination: { total: number } }>(API_ENDPOINTS.MENU_CATEGORIES, { params });
    return response.data;
  } catch (error) {
    console.error('獲取菜單分類列表失敗:', error);
    throw error;
  }
};

export const getMenuCategoryById = async (id: string): Promise<MenuCategory> => {
  try {
    // 檢查是否使用模擬數據
    if (mockConfig.USE_MOCK_DATA) {
      mockLog(`獲取菜單分類詳情 ID: ${id} (模擬數據)`);
      await simulateNetworkDelay();
      const category = getMockMenuCategoryById(id);
      if (!category) {
        throw new Error(`菜單分類不存在: ${id}`);
      }
      return category;
    }

    // 使用真實API
    const response = await apiClient.get<MenuCategory>(`${API_ENDPOINTS.MENU_CATEGORIES}/${id}`);
    return response.data;
  } catch (error) {
    console.error(`獲取菜單分類(ID: ${id})失敗:`, error);
    throw error;
  }
};

export const createMenuCategory = async (categoryData: Omit<MenuCategory, 'id' | 'createdAt' | 'updatedAt'>): Promise<MenuCategory> => {
  try {
    // Use apiClient
    const response = await apiClient.post<MenuCategory>(API_ENDPOINTS.MENU_CATEGORIES, categoryData);
    return response.data;
  } catch (error) {
    console.error('創建菜單分類失敗:', error);
    throw error;
  }
};

export const updateMenuCategory = async (id: string, categoryData: Partial<Omit<MenuCategory, 'id' | 'createdAt' | 'updatedAt'>>): Promise<MenuCategory> => {
  try {
    // Use apiClient
    const response = await apiClient.put<MenuCategory>(`${API_ENDPOINTS.MENU_CATEGORIES}/${id}`, categoryData);
    return response.data;
  } catch (error) {
    console.error(`更新菜單分類(ID: ${id})失敗:`, error);
    throw error;
  }
};

export const deleteMenuCategory = async (id: string): Promise<{ success: boolean }> => {
  try {
    // Use apiClient
    const response = await apiClient.delete<{ success: boolean }>(`${API_ENDPOINTS.MENU_CATEGORIES}/${id}`);
    return response.data; // Assuming backend returns { success: true/false }
  } catch (error) {
    console.error(`刪除菜單分類(ID: ${id})失敗:`, error);
    throw error;
  }
};

// Menu Options (Using Option Group from original types)
export const getMenuOptions = async (params?: { tenantId?: string, storeId?: string }): Promise<{ data: MenuOptionGroup[] }> => {
  try {
    // 菜單選項目前不提供模擬數據，使用真實API
    const response = await apiClient.get<{ data: MenuOptionGroup[] }>(API_ENDPOINTS.MENU_OPTIONS, { params });
    return response.data;
  } catch (error) {
    console.error('獲取菜單選項組失敗:', error);
    throw error;
  }
};

// Image Upload (Using previous logic)
export const uploadMenuItemImage = async (itemId: string, file: File): Promise<{ imageUrl: string; thumbnailUrl?: string }> => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      // Use apiClient
      const response = await apiClient.post<{ imageUrl: string; thumbnailUrl?: string }>(
        // Pass itemId as query parameter if backend expects it this way
        `${API_ENDPOINTS.UPLOAD_IMAGE}?itemId=${itemId}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(`上傳菜單項目圖片(ID: ${itemId})失敗:`, error);
      throw error;
    }
};

// 修復菜單的 API 函數
export const fixMenu = async (): Promise<{ success: boolean; message: string; script: string }> => {
  try {
    console.log('調用修復菜單API');
    
    // 檢查是否使用模擬數據
    if (mockConfig.USE_MOCK_DATA) {
      mockLog(`修復菜單 (模擬數據)`);
      await simulateNetworkDelay();
      // 返回模擬的修復結果
      return {
        success: true,
        message: '菜單修復成功 (模擬數據)',
        script: '// 這是模擬的修復腳本\nconsole.log("菜單已修復");'
      };
    }
    
    const response = await apiClient.get<{ success: boolean; message: string; script: string }>(API_ENDPOINTS.FIX_MENU);
    return response.data;
  } catch (error) {
    console.error('修復菜單失敗:', error);
    throw error;
  }
};

// The functions below were likely from backend handlers or duplicated.
// Removing the potential duplicate block.
// If these functions were intended, they should be defined uniquely.

/* Potential duplicate block removed:
export const updateMenuCategory = ...
export const deleteMenuCategory = ...
export const updateMenuItem = ...
export const deleteMenuItem = ...
*/
