import { z } from 'zod';
import { isValidPermission } from '../config/permissionConfig';

// 基本的角色表單字段驗證
export const createRoleSchema = z.object({
  roleName: z
    .string()
    .min(2, { message: '角色名稱至少需要2個字符' })
    .max(50, { message: '角色名稱不能超過50個字符' }),
  
  description: z
    .string()
    .max(200, { message: '描述不能超過200個字符' })
    .optional(),
  
  scope: z
    .enum(['global', 'tenant'], { 
      errorMap: () => ({ message: '角色範圍必須是全局(global)或租戶(tenant)' })
    }),
  
  roleLevel: z
    .number()
    .int()
    .min(1, { message: '角色等級必須大於0' })
    .max(100, { message: '角色等級不能超過100' })
    .optional()
    .default(10),
  
  tenantId: z
    .string()
    .optional(),
  
  isActive: z
    .boolean()
    .optional()
    .default(true),
  
  permissions: z
    .array(
      z.object({
        resource: z.string(),
        action: z.string()
      })
    )
    .min(1, { message: '至少需要選擇一個權限' })
    .refine(
      (permissions) => permissions.every(p => isValidPermission(p.resource, p.action)),
      { message: '包含無效的權限' }
    )
});

// 更新角色的表單字段驗證，更寬鬆，所有字段都是可選的
export const updateRoleSchema = z.object({
  roleName: z
    .string()
    .min(2, { message: '角色名稱至少需要2個字符' })
    .max(50, { message: '角色名稱不能超過50個字符' })
    .optional(),
  
  description: z
    .string()
    .max(200, { message: '描述不能超過200個字符' })
    .optional(),
  
  roleLevel: z
    .number()
    .int()
    .min(1, { message: '角色等級必須大於0' })
    .max(100, { message: '角色等級不能超過100' })
    .optional(),
  
  isActive: z
    .boolean()
    .optional(),
  
  permissions: z
    .array(
      z.object({
        resource: z.string(),
        action: z.string()
      })
    )
    .min(1, { message: '至少需要選擇一個權限' })
    .refine(
      (permissions) => permissions.every(p => isValidPermission(p.resource, p.action)),
      { message: '包含無效的權限' }
    )
    .optional()
});

// 導出類型
export type CreateRoleFormData = z.infer<typeof createRoleSchema>;
export type UpdateRoleFormData = z.infer<typeof updateRoleSchema>; 