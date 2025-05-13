import { z } from 'zod';
import { UpdateUserProfileInput } from './user.types';

/**
 * 用戶資料更新請求體的驗證 Schema
 * 使用 Zod 進行請求驗證，確保更新資料符合業務規則
 */
export const UpdateProfileSchema = z.object({
  // 顯示名稱：1-50字元，可為null或省略
  displayName: z.string()
    .min(1, "顯示名稱不得為空")
    .max(50, "顯示名稱過長")
    .nullable()
    .optional(),
  
  // 頭像URL：有效URL格式，可為null或省略
  photoURL: z.string()
    .url("頭像必須是有效的 URL")
    .nullable()
    .optional(),
  
  // 電話號碼：簡單格式驗證，可為null或省略
  phoneNumber: z.string()
    .regex(/^\+?[0-9\s\-\(\)]{7,20}$/, "無效的電話號碼格式")
    .nullable()
    .optional(),
  
  // 添加其他未來可能允許修改的欄位...
  // email通常不允許透過此API更新，因為需要特殊驗證流程
}).strict(); // 使用strict模式確保不接受schema未定義的欄位

// 導出Zod驗證後的類型
export type UpdateProfileInputZod = z.infer<typeof UpdateProfileSchema>; 