import { z } from 'zod';
import { RoleScope } from './roles.types';

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
  roleLevel: z.number().int().min(1, '權限等級不能小於1').max(10, '權限等級不能大於10'),
  scope: z.enum(['global', 'tenant', 'store'] as const, {
    errorMap: () => ({ message: '角色範圍必須是 global、tenant 或 store' })
  }),
  permissions: z.record(PermissionSchema).optional(),
  isSystemRole: z.boolean().optional(),
  isActive: z.boolean().optional(),
  tenantId: z.string().min(1, '租戶ID不能為空')
});

// 更新角色請求體驗證模式 (所有欄位均為可選)
export const UpdateRoleSchema = z.object({
  roleName: z.string().min(2, '角色名稱至少需要2個字元').max(50, '角色名稱不能超過50個字元').optional(),
  description: z.string().max(200, '描述不能超過200個字元').optional(),
  roleLevel: z.number().int().min(1, '權限等級不能小於1').max(10, '權限等級不能大於10').optional(),
  scope: z.enum(['global', 'tenant', 'store'] as const, {
    errorMap: () => ({ message: '角色範圍必須是 global、tenant 或 store' })
  }).optional(),
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
  // 如果是系統角色 (isSystemRole === true)，則scope必須是'global'
  if (data.isSystemRole === true && data.scope !== 'global') {
    return {
      isValid: false,
      error: '系統角色必須是全域範圍(scope=global)'
    };
  }

  // 如果是系統角色 (isSystemRole === true)，則租戶ID必須為null或空值
  if (data.isSystemRole === true && data.tenantId) {
    return {
      isValid: false,
      error: '系統角色不能指定租戶ID'
    };
  }

  // 如果不是系統角色 (isSystemRole === false 或未設定)且非全域範圍，則租戶ID為必須
  if ((data.isSystemRole === false || data.isSystemRole === undefined) && 
      data.scope !== 'global' && !data.tenantId) {
    return {
      isValid: false,
      error: '非全域範圍的租戶角色必須指定租戶ID'
    };
  }

  // 範圍與租戶ID的關係驗證
  if (data.scope === 'global' && data.tenantId) {
    return {
      isValid: false,
      error: '全域範圍角色不應指定租戶ID'
    };
  }

  if ((data.scope === 'tenant' || data.scope === 'store') && !data.tenantId) {
    return {
      isValid: false,
      error: `${data.scope === 'tenant' ? '租戶' : '店鋪'}範圍角色必須指定租戶ID`
    };
  }
  
  // 角色名稱格式驗證 (若有特殊需求)
  if (data.roleName && !/^[\w\u4e00-\u9fa5\s-]+$/.test(data.roleName)) {
    return {
      isValid: false,
      error: '角色名稱只能包含字母、數字、漢字、空格、連字符和下劃線'
    };
  }
  
  // 角色等級與範圍的合理性驗證 
  // 例如，若scope是全域的，roleLevel可能有最小值要求
  if (data.scope === 'global' && data.roleLevel > 5) {
    return {
      isValid: false,
      error: '全域範圍角色的權限等級不能高於5'
    };
  }

  return { isValid: true };
}; 