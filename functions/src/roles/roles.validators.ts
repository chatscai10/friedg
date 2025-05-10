import { z } from 'zod';

// 權限模式
const PermissionSchema = z.object({
  create: z.boolean().default(false),
  read: z.boolean().default(false),
  update: z.boolean().default(false),
  delete: z.boolean().default(false)
});

// 創建角色請求體驗證模式
export const CreateRoleSchema = z.object({
  roleName: z.string().min(2, '角色名稱至少需要2個字元').max(50, '角色名稱不能超過50個字元'),
  description: z.string().max(200, '描述不能超過200個字元').optional(),
  level: z.number().int().min(0, '權限等級不能小於0').max(100, '權限等級不能大於100'),
  permissions: z.record(PermissionSchema).optional(),
  isSystemRole: z.boolean().optional(),
  isActive: z.boolean().optional(),
  tenantId: z.string().min(1, '租戶ID不能為空')
});

// 更新角色請求體驗證模式 (所有欄位均為可選)
export const UpdateRoleSchema = z.object({
  roleName: z.string().min(2, '角色名稱至少需要2個字元').max(50, '角色名稱不能超過50個字元').optional(),
  description: z.string().max(200, '描述不能超過200個字元').optional(),
  level: z.number().int().min(0, '權限等級不能小於0').max(100, '權限等級不能大於100').optional(),
  permissions: z.record(PermissionSchema).optional(),
  isActive: z.boolean().optional()
});

// 角色權限更新請求體驗證模式
export const RolePermissionsSchema = z.object({
  permissions: z.record(PermissionSchema)
});

// 分配角色請求體驗證模式
export const AssignRoleSchema = z.object({
  userId: z.string().min(1, '用戶ID不能為空')
});

// 外加的驗證邏輯可能用於特定業務規則
// 例如，檢查是否有需要相依的欄位或條件邏輯等
export const validateRoleCreation = (data: z.infer<typeof CreateRoleSchema>): { isValid: boolean; error?: string } => {
  // 如果是系統角色 (isSystemRole === true)，則租戶ID必須為null或空值
  if (data.isSystemRole === true && data.tenantId) {
    return {
      isValid: false,
      error: '系統角色不能指定租戶ID'
    };
  }

  // 如果不是系統角色 (isSystemRole === false 或未設定)，則租戶ID為必須
  if (data.isSystemRole === false && !data.tenantId) {
    return {
      isValid: false,
      error: '租戶角色必須指定租戶ID'
    };
  }

  return { isValid: true };
}; 