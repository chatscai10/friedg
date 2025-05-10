/**
 * 吃雞排找不早系統 - RBAC函式庫
 * 驗證工具函數的單元測試
 */

import {
  validateRoleType,
  validateResourceType,
  validateActionType,
  validateId,
  validateUUID,
  validateTenantId,
  validateStoreId
} from '../../../src/libs/rbac/utils/validators';

describe('RBAC - 驗證工具函數', () => {
  describe('validateRoleType', () => {
    it('應該正確驗證有效的角色類型', () => {
      const validRoles = [
        'super_admin', 'tenant_admin', 'store_manager', 
        'shift_leader', 'senior_staff', 'staff', 'trainee', 'customer'
      ];
      
      validRoles.forEach(role => {
        expect(validateRoleType(role)).toBe(true);
      });
    });
    
    it('應該拒絕無效的角色類型', () => {
      const invalidRoles = [
        'admin', 'user', 'manager', 'guest', 
        123, null, undefined, {}, [], true, false
      ];
      
      invalidRoles.forEach(role => {
        expect(validateRoleType(role)).toBe(false);
      });
    });
  });
  
  describe('validateResourceType', () => {
    it('應該正確驗證有效的資源類型', () => {
      const validResources = [
        'tenants', 'stores', 'users', 'employees', 
        'menuItems', 'orders', 'pickupNumbers'
      ];
      
      validResources.forEach(resource => {
        expect(validateResourceType(resource)).toBe(true);
      });
    });
    
    it('應該拒絕無效的資源類型', () => {
      const invalidResources = [
        'tenant', 'store', 'user', 'employee', 
        123, null, undefined, {}, [], true, false
      ];
      
      invalidResources.forEach(resource => {
        expect(validateResourceType(resource)).toBe(false);
      });
    });
  });
  
  describe('validateActionType', () => {
    it('應該正確驗證有效的操作類型', () => {
      const validActions = [
        'create', 'read', 'update', 'delete', 
        'approve', 'reject', 'cancel', 'complete', 
        'print', 'export', 'discount', 'refund'
      ];
      
      validActions.forEach(action => {
        expect(validateActionType(action)).toBe(true);
      });
    });
    
    it('應該拒絕無效的操作類型', () => {
      const invalidActions = [
        'view', 'save', 'remove', 'insert', 
        123, null, undefined, {}, [], true, false
      ];
      
      invalidActions.forEach(action => {
        expect(validateActionType(action)).toBe(false);
      });
    });
  });
  
  describe('validateId', () => {
    it('應該正確驗證有效的ID字符串', () => {
      const validIds = [
        'abc123', '12345', 'user-123', 'tenant_456'
      ];
      
      validIds.forEach(id => {
        expect(validateId(id)).toBe(true);
      });
    });
    
    it('應該拒絕無效的ID字符串', () => {
      const invalidIds = [
        '', '   ', 123, null, undefined, {}, [], true, false
      ];
      
      invalidIds.forEach(id => {
        expect(validateId(id)).toBe(false);
      });
    });
  });
  
  describe('validateUUID', () => {
    it('應該正確驗證有效的UUID格式', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        '123E4567-E89B-12D3-A456-426614174000', // 大寫也有效
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
      ];
      
      validUUIDs.forEach(uuid => {
        expect(validateUUID(uuid)).toBe(true);
      });
    });
    
    it('應該拒絕無效的UUID格式', () => {
      const invalidUUIDs = [
        '123456789',
        '123e4567-e89b-12d3-a456-42661417400', // 太短
        '123e4567-e89b-12d3-a456-4266141740000', // 太長
        '123e4567-e89b-X2d3-a456-426614174000', // 包含非法字符
        '123e4567e89b12d3a456426614174000', // 缺少連字符
        123, null, undefined, {}, [], true, false
      ];
      
      invalidUUIDs.forEach(uuid => {
        expect(validateUUID(uuid)).toBe(false);
      });
    });
  });
  
  describe('validateTenantId 和 validateStoreId', () => {
    it('應該將驗證委託給validateUUID', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUID = '123456789';
      
      expect(validateTenantId(validUUID)).toBe(true);
      expect(validateTenantId(invalidUUID)).toBe(false);
      
      expect(validateStoreId(validUUID)).toBe(true);
      expect(validateStoreId(invalidUUID)).toBe(false);
    });
  });
}); 