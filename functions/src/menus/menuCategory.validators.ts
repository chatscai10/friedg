import { z } from 'zod';

/**
 * 菜單分類輸入數據的Zod驗證模式
 * 用於創建新的菜單分類時驗證請求體
 */
export const MenuCategoryInputSchema = z.object({
  name: z.string()
    .min(1, '分類名稱不能為空')
    .max(50, '分類名稱不能超過50個字符'),
  description: z.string()
    .max(200, '描述不能超過200個字符')
    .optional(),
  displayOrder: z.number()
    .int('顯示順序必須是整數')
    .default(0),
  type: z.enum(['main_dish', 'side_dish', 'drink', 'dessert', 'combo', 'seasonal'], {
    errorMap: () => ({ message: '分類類型必須是有效的選項' }),
  }),
  imageUrl: z.string()
    .url('圖片URL格式不正確')
    .optional(),
  isActive: z.boolean()
    .default(true),
}).strict();

/**
 * 用於更新菜單分類的Zod驗證模式
 * 所有欄位都是可選的，用於部分更新操作
 */
export const UpdateMenuCategorySchema = z.object({
  name: z.string()
    .min(1, '分類名稱不能為空')
    .max(50, '分類名稱不能超過50個字符')
    .optional(),
  description: z.string()
    .max(200, '描述不能超過200個字符')
    .optional(),
  displayOrder: z.number()
    .int('顯示順序必須是整數')
    .optional(),
  type: z.enum(['main_dish', 'side_dish', 'drink', 'dessert', 'combo', 'seasonal'], {
    errorMap: () => ({ message: '分類類型必須是有效的選項' }),
  }).optional(),
  imageUrl: z.string()
    .url('圖片URL格式不正確')
    .optional(),
  isActive: z.boolean()
    .optional(),
}).strict();

/**
 * 定義菜單分類類型的枚舉
 */
export const MenuCategoryTypes = ['main_dish', 'side_dish', 'drink', 'dessert', 'combo', 'seasonal'] as const;
export type MenuCategoryType = typeof MenuCategoryTypes[number];

/**
 * 用於獲取菜單分類列表的查詢參數驗證模式
 */
export const MenuCategoryQueryParamsSchema = z.object({
  isActive: z.enum(['true', 'false', 'all'])
    .optional()
    .default('true')
    .transform(val => {
      if (val === 'all') return val;
      return val === 'true';
    }),
  type: z.string()
    .optional()
    .transform(val => {
      if (!val) return undefined;
      
      // 處理多個類型（以逗號分隔）
      const types = val.split(',');
      
      // 驗證每個類型是否有效
      const validTypes = types.filter(t => MenuCategoryTypes.includes(t as MenuCategoryType));
      
      // 如果沒有有效類型，返回undefined
      if (validTypes.length === 0) return undefined;
      
      // 如果只有一個類型，返回字符串；否則返回數組
      return validTypes.length === 1 ? validTypes[0] : validTypes;
    }),
}).strict();

/**
 * MenuCategory完整數據模型類型（用於TypeScript類型檢查）
 */
export type MenuCategory = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  displayOrder: number;
  type: 'main_dish' | 'side_dish' | 'drink' | 'dessert' | 'combo' | 'seasonal';
  imageUrl?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
};

/**
 * MenuCategoryInput類型（用於TypeScript類型檢查）
 * 從Zod schema中推導
 */
export type MenuCategoryInput = z.infer<typeof MenuCategoryInputSchema>;

/**
 * UpdateMenuCategoryInput類型（用於TypeScript類型檢查）
 * 從Zod schema中推導
 */
export type UpdateMenuCategoryInput = z.infer<typeof UpdateMenuCategorySchema>;

/**
 * MenuCategoryQueryParams類型（用於TypeScript類型檢查）
 * 從Zod schema中推導
 */
export type MenuCategoryQueryParams = z.infer<typeof MenuCategoryQueryParamsSchema>;

/**
 * 驗證菜單分類ID路徑參數
 */
export const CategoryIdParamsSchema = z.object({
  categoryId: z.string().uuid({
    message: "分類ID必須是有效的UUID格式"
  }),
}).strict();

/**
 * 類型定義：菜單分類ID路徑參數
 */
export type CategoryIdParams = z.infer<typeof CategoryIdParamsSchema>; 