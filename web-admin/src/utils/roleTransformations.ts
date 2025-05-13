import { PermissionItem } from '../types/role';

/**
 * 將選中的權限 ID 數組轉換為後端 API 期望的權限對象數組格式。
 *
 * @param selectedIds - 選中的權限 ID 字符串數組 (例如：['users:read', 'stores:create'])
 * @param allSystemPermissions - 包含系統中所有可用權限的 PermissionItem 對象數組
 * @returns API 期望的權限對象數組 (例如：[{ resourceType: 'users', action: 'read' }, { resourceType: 'stores', action: 'create' }])
 */
export function transformPermissionIdsToApiObjects(
  selectedIds: string[],
  allSystemPermissions: PermissionItem[]
): { resourceType: string; action: string; conditions?: Record<string, any> }[] {
  if (!selectedIds || !allSystemPermissions) {
    return [];
  }

  const apiPermissions: { resourceType: string; action: string; conditions?: Record<string, any> }[] = [];

  selectedIds.forEach(id => {
    const matchingPermission = allSystemPermissions.find(p => p.id === id);
    if (matchingPermission) {
      const apiObject: { resourceType: string; action: string; conditions?: Record<string, any> } = {
        resourceType: matchingPermission.resourceType,
        action: matchingPermission.action,
      };
      // 只有當 conditions 實際存在且有內容時才添加
      if (matchingPermission.conditions && Object.keys(matchingPermission.conditions).length > 0) {
        apiObject.conditions = matchingPermission.conditions;
      }
      apiPermissions.push(apiObject);
    }
    // 如果沒有找到匹配的權限 ID，則忽略或可以添加日誌
    // console.warn(`Permission ID "${id}" not found in allSystemPermissions.`);
  });

  return apiPermissions;
} 