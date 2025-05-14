/**
 * RBAC權限測試
 * 測試RBAC函式庫的權限檢查功能
 */

import { hasPermission, isRoleAtLeast, getMinimumRoleForAction } from '../core/permissionResolver';
import { RoleLevel, UserInfo, PermissionQuery, PermissionContext } from '../types';
import { ROLE_PERMISSIONS_MAP, RESOURCE_ACCESS_SCOPE } from '../constants';

// 模擬用戶資訊
const createMockUser = (role: string, tenantId: string, storeId?: string): UserInfo => ({
  uid: `user-${role}-${Math.random().toString(36).substring(2, 9)}`,
  role: role as any,
  roleLevel: RoleLevel[role.toUpperCase() as keyof typeof RoleLevel] || RoleLevel.CUSTOMER,
  tenantId,
  storeId,
  displayName: `Test ${role}`,
  email: `test-${role}@example.com`
});

// 超級管理員
const superAdmin = createMockUser('super_admin', 'system');
// 租戶管理員
const tenantAdmin = createMockUser('tenant_admin', 'tenant-1');
// 店長
const storeManager = createMockUser('store_manager', 'tenant-1', 'store-1');
// 班長
const shiftLeader = createMockUser('shift_leader', 'tenant-1', 'store-1');
// 資深員工
const seniorStaff = createMockUser('senior_staff', 'tenant-1', 'store-1');
// 一般員工
const staff = createMockUser('staff', 'tenant-1', 'store-1');
// 實習員工
const trainee = createMockUser('trainee', 'tenant-1', 'store-1');
// 顧客
const customer = createMockUser('customer', 'tenant-1');

// 不同租戶的用戶
const otherTenantAdmin = createMockUser('tenant_admin', 'tenant-2');
const otherStoreManager = createMockUser('store_manager', 'tenant-1', 'store-2');

describe('RBAC權限測試', () => {
  describe('isRoleAtLeast函數', () => {
    test('超級管理員應該高於所有角色', () => {
      expect(isRoleAtLeast(superAdmin, 'super_admin')).toBe(true);
      expect(isRoleAtLeast(superAdmin, 'tenant_admin')).toBe(true);
      expect(isRoleAtLeast(superAdmin, 'store_manager')).toBe(true);
      expect(isRoleAtLeast(superAdmin, 'shift_leader')).toBe(true);
      expect(isRoleAtLeast(superAdmin, 'senior_staff')).toBe(true);
      expect(isRoleAtLeast(superAdmin, 'staff')).toBe(true);
      expect(isRoleAtLeast(superAdmin, 'trainee')).toBe(true);
    });

    test('租戶管理員應該高於店長及以下角色', () => {
      expect(isRoleAtLeast(tenantAdmin, 'super_admin')).toBe(false);
      expect(isRoleAtLeast(tenantAdmin, 'tenant_admin')).toBe(true);
      expect(isRoleAtLeast(tenantAdmin, 'store_manager')).toBe(true);
      expect(isRoleAtLeast(tenantAdmin, 'shift_leader')).toBe(true);
      expect(isRoleAtLeast(tenantAdmin, 'senior_staff')).toBe(true);
      expect(isRoleAtLeast(tenantAdmin, 'staff')).toBe(true);
      expect(isRoleAtLeast(tenantAdmin, 'trainee')).toBe(true);
    });

    test('店長應該高於班長及以下角色', () => {
      expect(isRoleAtLeast(storeManager, 'super_admin')).toBe(false);
      expect(isRoleAtLeast(storeManager, 'tenant_admin')).toBe(false);
      expect(isRoleAtLeast(storeManager, 'store_manager')).toBe(true);
      expect(isRoleAtLeast(storeManager, 'shift_leader')).toBe(true);
      expect(isRoleAtLeast(storeManager, 'senior_staff')).toBe(true);
      expect(isRoleAtLeast(storeManager, 'staff')).toBe(true);
      expect(isRoleAtLeast(storeManager, 'trainee')).toBe(true);
    });

    test('一般員工應該只高於實習員工', () => {
      expect(isRoleAtLeast(staff, 'super_admin')).toBe(false);
      expect(isRoleAtLeast(staff, 'tenant_admin')).toBe(false);
      expect(isRoleAtLeast(staff, 'store_manager')).toBe(false);
      expect(isRoleAtLeast(staff, 'shift_leader')).toBe(false);
      expect(isRoleAtLeast(staff, 'senior_staff')).toBe(false);
      expect(isRoleAtLeast(staff, 'staff')).toBe(true);
      expect(isRoleAtLeast(staff, 'trainee')).toBe(true);
    });
  });

  describe('hasPermission函數', () => {
    // 測試基本權限檢查
    test('超級管理員應該有所有權限', async () => {
      const query: PermissionQuery = { action: 'create', resource: 'stores' };
      const result = await hasPermission(superAdmin, query);
      expect(result.granted).toBe(true);
    });

    test('租戶管理員應該有自己租戶的權限', async () => {
      const query: PermissionQuery = { action: 'create', resource: 'stores' };
      const context: PermissionContext = {
        tenantId: 'tenant-1',
        additionalData: { tenantId: 'tenant-1' }
      };
      const result = await hasPermission(tenantAdmin, query, context);
      expect(result.granted).toBe(true);
    });

    test('租戶管理員不應該有其他租戶的權限', async () => {
      const query: PermissionQuery = { action: 'create', resource: 'stores' };
      const context: PermissionContext = {
        tenantId: 'tenant-2',
        additionalData: { tenantId: 'tenant-2' }
      };
      const result = await hasPermission(tenantAdmin, query, context);
      expect(result.granted).toBe(false);
    });

    test('店長應該有自己店鋪的權限', async () => {
      const query: PermissionQuery = { action: 'update', resource: 'orders' };
      const context: PermissionContext = {
        tenantId: 'tenant-1',
        storeId: 'store-1',
        additionalData: { tenantId: 'tenant-1', storeId: 'store-1' }
      };
      const result = await hasPermission(storeManager, query, context);
      expect(result.granted).toBe(true);
    });

    test('店長不應該有其他店鋪的權限', async () => {
      const query: PermissionQuery = { action: 'update', resource: 'orders' };
      const context: PermissionContext = {
        tenantId: 'tenant-1',
        storeId: 'store-2',
        additionalData: { tenantId: 'tenant-1', storeId: 'store-2' }
      };
      const result = await hasPermission(storeManager, query, context);
      expect(result.granted).toBe(false);
    });

    test('顧客應該只能讀取自己的訂單', async () => {
      const query: PermissionQuery = { action: 'read', resource: 'orders' };
      const context: PermissionContext = {
        tenantId: 'tenant-1',
        additionalData: { tenantId: 'tenant-1', customerId: customer.uid }
      };
      const result = await hasPermission(customer, query, context);
      expect(result.granted).toBe(true);
    });

    test('顧客不應該能讀取其他人的訂單', async () => {
      const query: PermissionQuery = { action: 'read', resource: 'orders' };
      const context: PermissionContext = {
        tenantId: 'tenant-1',
        additionalData: { tenantId: 'tenant-1', customerId: 'other-customer-id' }
      };
      const result = await hasPermission(customer, query, context);
      expect(result.granted).toBe(false);
    });
  });

  describe('getMinimumRoleForAction函數', () => {
    test('應該返回正確的最低角色要求', () => {
      expect(getMinimumRoleForAction('create', 'tenants')).toBe('super_admin');
      expect(getMinimumRoleForAction('create', 'stores')).toBe('tenant_admin');
      expect(getMinimumRoleForAction('update', 'orders')).toBe('staff');
      expect(getMinimumRoleForAction('delete', 'orders')).toBe('store_manager');
    });
  });
});
