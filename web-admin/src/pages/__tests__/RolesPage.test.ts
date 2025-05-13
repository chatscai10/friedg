import { PermissionItem } from '../../types/permission'; // Assuming path to PermissionItem
import { transformPermissionIdsToApiObjects } from '../../utils/roleUtils'; // <--- ADD THIS IMPORT

// Copied from RolesPage.tsx for isolated testing
// TODO: Consider extracting this function to a shared utils file and importing it instead.
// const transformPermissionIdsToApiObjects = (
//   permissionIds: string[],
//   allPermissionsData: PermissionItem[]
// ): Array<{ resourceType: string; action: string; conditions?: Record<string, any> }> => {
//   if (!allPermissionsData || allPermissionsData.length === 0) {
//     return [];
//   }
//   return permissionIds
//     .map(id => {
//       const foundPermission = allPermissionsData.find(p => p.id === id);
//       if (!foundPermission) {
//         // In a real scenario, you might want to log this or handle it differently.
//         // For this function, as per original behavior, we just filter it out.
//         console.warn(`Permission with id "${id}" not found in allPermissions list.`);
//         return null;
//       }
//       const apiPermissionObject: { resourceType: string; action: string; conditions?: Record<string, any> } = {
//         resourceType: foundPermission.resourceType,
//         action: foundPermission.action,
//       };
//       if (foundPermission.conditions) {
//         apiPermissionObject.conditions = foundPermission.conditions;
//       }
//       return apiPermissionObject;
//     })
//     .filter(p => p !== null) as Array<{ resourceType: string; action: string; conditions?: Record<string, any> }>;
// };


describe('transformPermissionIdsToApiObjects', () => {
  const MOCK_ALL_PERMISSIONS: PermissionItem[] = [
    { id: 'p1', name: 'Create User', resourceType: 'user', action: 'create', category: 'User Management' },
    { id: 'p2', name: 'Read Product', resourceType: 'product', action: 'read', category: 'Inventory' },
    { id: 'p3', name: 'Update Order', resourceType: 'order', action: 'update', category: 'Orders', conditions: { ownOrder: true } },
    { id: 'p4', name: 'Delete Store', resourceType: 'store', action: 'delete', category: 'Store Management', conditions: { storeId: 'store-123' } },
    { id: 'p5', name: 'Manage All', resourceType: 'system', action: 'manage', category: 'System'},
  ];

  beforeEach(() => {
    // Suppress console.warn during tests for cleaner output, can be asserted if needed
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return an empty array if permissionIds is empty', () => {
    const result = transformPermissionIdsToApiObjects([], MOCK_ALL_PERMISSIONS);
    expect(result).toEqual([]);
  });

  test('should return an empty array if allPermissionsData is empty', () => {
    const result = transformPermissionIdsToApiObjects(['p1', 'p2'], []);
    expect(result).toEqual([]);
  });

  test('should return an empty array if allPermissionsData is null or undefined', () => {
    expect(transformPermissionIdsToApiObjects(['p1'], null as any)).toEqual([]);
    expect(transformPermissionIdsToApiObjects(['p1'], undefined as any)).toEqual([]);
  });

  test('should correctly transform permission IDs that are found in allPermissionsData', () => {
    const permissionIds = ['p1', 'p2'];
    const expected = [
      { resourceType: 'user', action: 'create' },
      { resourceType: 'product', action: 'read' },
    ];
    const result = transformPermissionIdsToApiObjects(permissionIds, MOCK_ALL_PERMISSIONS);
    expect(result).toEqual(expected);
  });

  test('should include conditions if they exist on the permission item', () => {
    const permissionIds = ['p3', 'p4'];
    const expected = [
      { resourceType: 'order', action: 'update', conditions: { ownOrder: true } },
      { resourceType: 'store', action: 'delete', conditions: { storeId: 'store-123' } },
    ];
    const result = transformPermissionIdsToApiObjects(permissionIds, MOCK_ALL_PERMISSIONS);
    expect(result).toEqual(expected);
  });

  test('should only return transformed objects for found permission IDs, ignoring not found ones', () => {
    const permissionIds = ['p1', 'p-not-found', 'p3', 'p-another-not-found'];
    const expected = [
      { resourceType: 'user', action: 'create' },
      { resourceType: 'order', action: 'update', conditions: { ownOrder: true } },
    ];
    const result = transformPermissionIdsToApiObjects(permissionIds, MOCK_ALL_PERMISSIONS);
    expect(result).toEqual(expected);
    expect(console.warn).toHaveBeenCalledWith('Permission with id "p-not-found" not found in allPermissions list.');
    expect(console.warn).toHaveBeenCalledWith('Permission with id "p-another-not-found" not found in allPermissions list.');
  });

  test('should return an empty array if all permissionIds are not found in allPermissionsData', () => {
    const permissionIds = ['p-not-found-1', 'p-not-found-2'];
    const result = transformPermissionIdsToApiObjects(permissionIds, MOCK_ALL_PERMISSIONS);
    expect(result).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith('Permission with id "p-not-found-1" not found in allPermissions list.');
    expect(console.warn).toHaveBeenCalledWith('Permission with id "p-not-found-2" not found in allPermissions list.');
  });
  
  test('should handle a mix of permissions with and without conditions', () => {
    const permissionIds = ['p1', 'p3', 'p5'];
    const expected = [
      { resourceType: 'user', action: 'create' },
      { resourceType: 'order', action: 'update', conditions: { ownOrder: true } },
      { resourceType: 'system', action: 'manage' },
    ];
    const result = transformPermissionIdsToApiObjects(permissionIds, MOCK_ALL_PERMISSIONS);
    expect(result).toEqual(expected);
  });
}); 