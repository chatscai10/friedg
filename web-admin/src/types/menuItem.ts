// 菜單項目類型定義
import { PaginationMeta } from './api.types';

// 菜單分類類型
export type MenuCategoryType = 'STANDARD' | 'main_dish' | 'side_dish' | 'drink' | 'dessert' | 'combo' | 'seasonal';

// 菜單分類
export interface MenuCategory {
  categoryId: string;
  name: string;
  description?: string;
  sortOrder: number;
  type: MenuCategoryType;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 標準API响應類型 - 菜單分類列表
export interface MenuCategoriesResponse {
  data: MenuCategory[];
  meta: PaginationMeta;
}

// 菜單選項組 (例如：辣度、加料等)
export interface MenuOptionGroup {
  id: string;
  name: string;
  description?: string;
  required: boolean; // 是否必選
  multiSelect: boolean; // 是否可多選
  minSelect: number; // 最少選擇數量
  maxSelect: number; // 最多選擇數量
  options: MenuOption[];
}

// 菜單選項
export interface MenuOption {
  id: string;
  name: string;
  description?: string;
  price: number; // 附加價格
  isDefault?: boolean; // 是否為預設選項
}

// 菜單項目的庫存狀態
export type MenuItemStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

// 菜單項目
export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName: string; // 冗餘欄位，便於顯示
  price: number;
  discountPrice?: number;
  costPrice?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  stockStatus: MenuItemStockStatus;
  stockQuantity?: number;
  unit?: string; // 計量單位
  preparationTime?: number; // 準備時間 (分鐘)
  isRecommended: boolean; // 是否推薦
  isSpecial: boolean; // 是否特選
  isActive: boolean; // 是否啟用
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    allergens?: string[];
  };
  optionGroups?: MenuOptionGroup[];
  tags?: string[]; // 標籤 (熱門、新品等)
  createdAt: string;
  updatedAt: string;
} 