"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuItemIdParamsSchema = exports.ListMenuItemsQuerySchema = exports.MenuItemStatusUpdateSchema = exports.UpdateMenuItemInputSchema = exports.MenuItemInputSchema = exports.NutritionInfoSchema = exports.MenuItemOptionGroupSchema = exports.MenuItemOptionChoiceSchema = void 0;
var zod_1 = require("zod");
/**
 * 菜單選項選擇項 schema
 */
exports.MenuItemOptionChoiceSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '選項名稱不能為空').max(50, '選項名稱不能超過50個字元'),
    description: zod_1.z.string().max(200, '選項描述不能超過200個字元').optional(),
    priceAdjustment: zod_1.z.number().default(0),
    isDefault: zod_1.z.boolean().optional(),
});
/**
 * 菜單選項組 schema
 */
exports.MenuItemOptionGroupSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '選項組名稱不能為空').max(50, '選項組名稱不能超過50個字元'),
    description: zod_1.z.string().max(200, '選項組描述不能超過200個字元').optional(),
    required: zod_1.z.boolean().default(false),
    multiSelect: zod_1.z.boolean().default(false),
    minSelect: zod_1.z.number().int().min(0, '最小選擇數不能為負數').default(0),
    maxSelect: zod_1.z.number().int().min(1, '最大選擇數必須大於0').default(1),
    choices: zod_1.z.array(exports.MenuItemOptionChoiceSchema).min(1, '選項組必須包含至少一個選項'),
});
/**
 * 營養資訊 schema
 */
exports.NutritionInfoSchema = zod_1.z.object({
    calories: zod_1.z.number().min(0, '熱量不能為負數').optional(),
    protein: zod_1.z.number().min(0, '蛋白質不能為負數').optional(),
    carbs: zod_1.z.number().min(0, '碳水化合物不能為負數').optional(),
    fat: zod_1.z.number().min(0, '脂肪不能為負數').optional(),
    allergens: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * 菜單品項輸入 schema
 */
exports.MenuItemInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, '菜單品項名稱不能為空').max(100, '菜單品項名稱不能超過100個字元'),
    description: zod_1.z.string().max(500, '描述不能超過500個字元').optional(),
    categoryId: zod_1.z.string().min(1, '必須指定菜單分類ID'),
    price: zod_1.z.number().min(0, '價格不能為負數'),
    discountPrice: zod_1.z.number().min(0, '折扣價格不能為負數').optional(),
    costPrice: zod_1.z.number().min(0, '成本價格不能為負數').optional(),
    imageUrl: zod_1.z.string().url('圖片URL格式不正確').optional(),
    thumbnailUrl: zod_1.z.string().url('縮略圖URL格式不正確').optional(),
    stockStatus: zod_1.z.enum(['in_stock', 'low_stock', 'out_of_stock'], {
        errorMap: function () { return ({ message: '庫存狀態必須是有效的選項' }); }
    }).default('in_stock'),
    stockQuantity: zod_1.z.number().int().min(0, '庫存數量不能為負數').optional(),
    unit: zod_1.z.string().max(20, '單位不能超過20個字元').optional(),
    preparationTime: zod_1.z.number().int().min(0, '準備時間不能為負數').optional(),
    displayOrder: zod_1.z.number().int().min(0, '顯示順序不能為負數').optional().default(0),
    isRecommended: zod_1.z.boolean().default(false),
    isSpecial: zod_1.z.boolean().default(false),
    isActive: zod_1.z.boolean().default(true),
    nutritionInfo: exports.NutritionInfoSchema.optional(),
    optionGroups: zod_1.z.array(exports.MenuItemOptionGroupSchema).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
}).strict();
/**
 * 更新菜單品項輸入 schema
 * 所有字段均為可選，用於部分更新
 */
exports.UpdateMenuItemInputSchema = exports.MenuItemInputSchema.partial();
/**
 * 菜單品項狀態更新 schema
 */
exports.MenuItemStatusUpdateSchema = zod_1.z.object({
    isActive: zod_1.z.boolean().optional(),
    stockStatus: zod_1.z.enum(['in_stock', 'low_stock', 'out_of_stock'], {
        errorMap: function () { return ({ message: '庫存狀態必須是有效的選項' }); }
    }).optional(),
    stockQuantity: zod_1.z.number().int().min(0, '庫存數量不能為負數').optional(),
    isRecommended: zod_1.z.boolean().optional(),
    isSpecial: zod_1.z.boolean().optional(),
}).strict();
/**
 * 查詢菜單品項列表的參數 schema
 */
exports.ListMenuItemsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    sort: zod_1.z.enum(['name', 'price', 'createdAt', 'updatedAt']).default('createdAt'),
    order: zod_1.z.enum(['asc', 'desc']).default('desc'),
    categoryId: zod_1.z.string().optional(),
    isActive: zod_1.z.preprocess(function (val) { return val === 'true' ? true : val === 'false' ? false : undefined; }, zod_1.z.boolean().optional()),
    isRecommended: zod_1.z.preprocess(function (val) { return val === 'true' ? true : val === 'false' ? false : undefined; }, zod_1.z.boolean().optional()),
    isSpecial: zod_1.z.preprocess(function (val) { return val === 'true' ? true : val === 'false' ? false : undefined; }, zod_1.z.boolean().optional()),
    stockStatus: zod_1.z.enum(['in_stock', 'low_stock', 'out_of_stock']).optional(),
    query: zod_1.z.string().optional(),
    tags: zod_1.z.string().transform(function (str) { return str.split(','); }).optional()
}).strict();
/**
 * 菜單品項ID路徑參數 schema
 */
exports.MenuItemIdParamsSchema = zod_1.z.object({
    itemId: zod_1.z.string().min(1, '菜單品項ID不能為空')
}).strict();
