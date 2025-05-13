import { PermissionItem } from '../types/permission';

/**
 * Transforms an array of permission IDs into an array of API-compatible permission objects.
 * It filters out any permission IDs not found in the allPermissionsData and logs a warning for them.
 * @param permissionIds - An array of permission ID strings.
 * @param allPermissionsData - An array of PermissionItem objects to look up against.
 * @returns An array of objects, each with resourceType, action, and optional conditions.
 */
export const transformPermissionIdsToApiObjects = (
  permissionIds: string[],
  allPermissionsData: PermissionItem[]
): Array<{ resourceType: string; action: string; conditions?: Record<string, any> }> => {
  if (!allPermissionsData || allPermissionsData.length === 0) {
    return [];
  }
  return permissionIds
    .map(id => {
      const foundPermission = allPermissionsData.find(p => p.id === id);
      if (!foundPermission) {
        console.warn(`Permission with id "${id}" not found in allPermissions list.`);
        return null;
      }
      const apiPermissionObject: { resourceType: string; action: string; conditions?: Record<string, any> } = {
        resourceType: foundPermission.resourceType,
        action: foundPermission.action,
      };
      if (foundPermission.conditions) {
        apiPermissionObject.conditions = foundPermission.conditions;
      }
      return apiPermissionObject;
    })
    .filter(p => p !== null) as Array<{ resourceType: string; action: string; conditions?: Record<string, any> }>;
}; 