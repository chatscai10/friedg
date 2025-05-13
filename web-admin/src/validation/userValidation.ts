import { z } from 'zod';
import { UserStatus } from '../types/user.types';

/**
 * 創建用戶表單的驗證schema
 */
export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, { message: "電子郵件不能為空" })
    .email({ message: "不是有效的電子郵件格式" }),
  
  password: z
    .string()
    .min(8, { message: "密碼長度至少8個字符" })
    .regex(/[a-z]/, { message: "密碼需包含小寫字母" })
    .regex(/[A-Z]/, { message: "密碼需包含大寫字母" })
    .regex(/[0-9]/, { message: "密碼需包含數字" }),
  
  confirmPassword: z
    .string()
    .min(1, { message: "請確認密碼" }),
  
  displayName: z
    .string()
    .optional(),
  
  firstName: z
    .string()
    .optional(),
  
  lastName: z
    .string()
    .optional(),
  
  roles: z
    .array(z.string())
    .min(1, { message: "請至少選擇一個角色" }),
  
  status: z
    .enum(['active', 'inactive', 'suspended'] as [UserStatus, ...UserStatus[]])
    .default('active')
    .optional(),
  
  tenantId: z
    .string()
    .optional(),
  
  storeId: z
    .string()
    .optional()
}).refine(data => data.password === data.confirmPassword, {
  message: "密碼與確認密碼不一致",
  path: ["confirmPassword"]
});

/**
 * 創建用戶表單的數據類型
 */
export type CreateUserFormData = z.infer<typeof createUserSchema>;

/**
 * 更新用戶狀態表單的驗證schema
 */
export const updateUserStatusSchema = z.object({
  status: z
    .enum(['active', 'inactive', 'suspended'] as [UserStatus, ...UserStatus[]])
    .min(1, { message: "請選擇用戶狀態" }),
  
  reason: z
    .string()
    .optional()
});

/**
 * 更新用戶狀態表單的數據類型
 */
export type UpdateUserStatusFormData = z.infer<typeof updateUserStatusSchema>;

/**
 * 更新用戶角色表單的驗證schema
 */
export const updateUserRolesSchema = z.object({
  roles: z
    .array(z.string())
    .min(1, { message: "請至少選擇一個角色" })
});

/**
 * 更新用戶角色表單的數據類型
 */
export type UpdateUserRolesFormData = z.infer<typeof updateUserRolesSchema>;

/**
 * 更新用戶資料表單的驗證schema
 */
export const updateUserSchema = z.object({
  displayName: z
    .string()
    .optional(),
  
  firstName: z
    .string()
    .optional(),
  
  lastName: z
    .string()
    .optional(),
    
  email: z
    .string()
    .email({ message: "不是有效的電子郵件格式" })
    .optional()
});

/**
 * 更新用戶資料表單的數據類型
 */
export type UpdateUserFormData = z.infer<typeof updateUserSchema>; 