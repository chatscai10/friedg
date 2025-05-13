import { z } from 'zod';

/**
 * 菜單選項選擇項 schema
 */
export const MenuItemOptionChoiceSchema = z.object({
  name: z.string().min(1, '選項名稱不能為空').max(50, '選項名稱不能超過50個字元'),
  description: z.string().max(200, '選項描述不能超過200個字元').optional(),
  priceAdjustment: z.number().default(0),
  isDefault: z.boolean().optional(),
});

export type MenuItemOptionChoice = z.infer<typeof MenuItemOptionChoiceSchema>;

/**
 * 菜單選項組 schema
 */
export const MenuItemOptionGroupSchema = z.object({
  name: z.string().min(1, '選項組名稱不能為空').max(50, '選項組名稱不能超過50個字元'),
  description: z.string().max(200, '選項組描述不能超過200個字元').optional(),
  required: z.boolean().default(false),
  multiSelect: z.boolean().default(false),
  minSelect: z.number().int().min(0, '最小選擇數不能為負數').default(0),
  maxSelect: z.number().int().min(1, '最大選擇數必須大於0').default(1),
  choices: z.array(MenuItemOptionChoiceSchema).min(1, '選項組必須包含至少一個選項'),
});

export type MenuItemOptionGroup = z.infer<typeof MenuItemOptionGroupSchema>;

/**
 * 營養資訊 schema
 */
export const NutritionInfoSchema = z.object({
  calories: z.number().min(0, '熱量不能為負數').optional(),
  protein: z.number().min(0, '蛋白質不能為負數').optional(),
  carbs: z.number().min(0, '碳水化合物不能為負數').optional(),
  fat: z.number().min(0, '脂肪不能為負數').optional(),
  allergens: z.array(z.string()).optional(),
});

export type NutritionInfo = z.infer<typeof NutritionInfoSchema>;

/**
 * 菜單品項輸入 schema
 */
export const MenuItemInputSchema = z.object({
  name: z.string().min(1, '菜單品項名稱不能為空').max(100, '菜單品項名稱不能超過100個字元'),
  description: z.string().max(500, '描述不能超過500個字元').optional(),
  categoryId: z.string().min(1, '必須指定菜單分類ID'),
  price: z.number().min(0, '價格不能為負數'),
  discountPrice: z.number().min(0, '折扣價格不能為負數').optional(),
  costPrice: z.number().min(0, '成本價格不能為負數').optional(),
  imageUrl: z.string().url('圖片URL格式不正確').optional(),
  thumbnailUrl: z.string().url('縮略圖URL格式不正確').optional(),
  stockStatus: z.enum(['in_stock', 'low_stock', 'out_of_stock'], {
    errorMap: () => ({ message: '庫存狀態必須是有效的選項' })
  }).default('in_stock'),
  stockQuantity: z.number().int().min(0, '庫存數量不能為負數').optional(),
  unit: z.string().max(20, '單位不能超過20個字元').optional(),
  preparationTime: z.number().int().min(0, '準備時間不能為負數').optional(),
  displayOrder: z.number().int().min(0, '顯示順序不能為負數').optional().default(0),
  isRecommended: z.boolean().default(false),
  isSpecial: z.boolean().default(false),
  isActive: z.boolean().default(true),
  nutritionInfo: NutritionInfoSchema.optional(),
  optionGroups: z.array(MenuItemOptionGroupSchema).optional(),
  tags: z.array(z.string()).optional(),
}).strict();

export type MenuItemInput = z.infer<typeof MenuItemInputSchema>;

/**
 * 更新菜單品項輸入 schema
 * 所有字段均為可選，用於部分更新
 */
export const UpdateMenuItemInputSchema = MenuItemInputSchema.partial();

export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemInputSchema>;

/**
 * 菜單品項狀態更新 schema
 */
export const MenuItemStatusUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  stockStatus: z.enum(['in_stock', 'low_stock', 'out_of_stock'], {
    errorMap: () => ({ message: '庫存狀態必須是有效的選項' })
  }).optional(),
  stockQuantity: z.number().int().min(0, '庫存數量不能為負數').optional(),
  isRecommended: z.boolean().optional(),
  isSpecial: z.boolean().optional(),
}).strict();

export type MenuItemStatusUpdate = z.infer<typeof MenuItemStatusUpdateSchema>;

/**
 * 查詢菜單品項列表的參數 schema
 */
export const ListMenuItemsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'price', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  categoryId: z.string().optional(),
  isActive: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : undefined,
    z.boolean().optional()
  ),
  isRecommended: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : undefined,
    z.boolean().optional()
  ),
  isSpecial: z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : undefined,
    z.boolean().optional()
  ),
  stockStatus: z.enum(['in_stock', 'low_stock', 'out_of_stock']).optional(),
  query: z.string().optional(),
  tags: z.string().transform(str => str.split(',')).optional()
}).strict();

export type ListMenuItemsQuery = z.infer<typeof ListMenuItemsQuerySchema>;

/**
 * 菜單品項ID路徑參數 schema
 */
export const MenuItemIdParamsSchema = z.object({
  itemId: z.string().min(1, '菜單品項ID不能為空')
}).strict();

export type MenuItemIdParams = z.infer<typeof MenuItemIdParamsSchema>; 