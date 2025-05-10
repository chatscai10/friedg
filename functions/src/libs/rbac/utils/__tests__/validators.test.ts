import {
    validateRoleType,
    validateResourceType,
    validateActionType,
    validateId,
    validateUUID,
    validateTenantId,
    validateStoreId,
} from '../validators';
import { RoleType, ResourceType, ActionType } from '../../types';

describe('RBAC Utils - Validators', () => {

    describe('validateRoleType', () => {
        const validRoles: RoleType[] = [
            'super_admin', 'tenant_admin', 'store_manager',
            'shift_leader', 'senior_staff', 'staff', 'trainee', 'customer'
        ];
        const invalidInputs = [null, undefined, 123, '', ' ', 'invalid_role', 'SUPER_ADMIN'];

        validRoles.forEach(role => {
            test(`should return true for valid role: ${role}`, () => {
                expect(validateRoleType(role)).toBe(true);
            });
        });

        invalidInputs.forEach(input => {
            test(`should return false for invalid input: ${input}`, () => {
                expect(validateRoleType(input)).toBe(false);
            });
        });
    });

    describe('validateResourceType', () => {
        // Add a representative sample of valid resource types
        const validResources: ResourceType[] = [
            'tenants', 'stores', 'users', 'menuItems', 'orders', 'payrolls', 'adSlots'
        ];
        const invalidInputs = [null, undefined, 456, '', ' ', 'invalid_resource', 'USERS'];

        validResources.forEach(resource => {
            test(`should return true for valid resource: ${resource}`, () => {
                expect(validateResourceType(resource)).toBe(true);
            });
        });

        invalidInputs.forEach(input => {
            test(`should return false for invalid input: ${input}`, () => {
                expect(validateResourceType(input)).toBe(false);
            });
        });
    });

    describe('validateActionType', () => {
        const validActions: ActionType[] = [
            'create', 'read', 'update', 'delete', 'approve', 'export'
        ];
        const invalidInputs = [null, undefined, 789, '', ' ', 'invalid_action', 'READ'];

        validActions.forEach(action => {
            test(`should return true for valid action: ${action}`, () => {
                expect(validateActionType(action)).toBe(true);
            });
        });

        invalidInputs.forEach(input => {
            test(`should return false for invalid input: ${input}`, () => {
                expect(validateActionType(input)).toBe(false);
            });
        });
    });

    describe('validateId', () => {
        test('should return true for valid non-empty string IDs', () => {
            expect(validateId('some-id')).toBe(true);
            expect(validateId('12345')).toBe(true);
            expect(validateId(' a b ')).toBe(true); // String with spaces is valid if not only spaces
        });

        test('should return false for invalid IDs', () => {
            expect(validateId(null)).toBe(false);
            expect(validateId(undefined)).toBe(false);
            expect(validateId('')).toBe(false);
            expect(validateId('   ')).toBe(false); // String with only spaces
            expect(validateId(123)).toBe(false);
            expect(validateId({})).toBe(false);
        });
    });

    describe('validateUUID', () => {
        const validUUIDs = [
            'f81d4fae-7dec-11d0-a765-00a0c91e6bf6', // v1
            'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', // v4
            '123e4567-e89b-12d3-a456-426614174000', // Example from regex (v1)
            '987e6543-e21b-42d3-b456-426614174001', // Example (v4)
        ];
        const invalidUUIDs = [
            'f81d4fae-7dec-11d0-a765-00a0c91e6bf', // Too short
            'f81d4fae-7dec-11d0-a765-00a0c91e6bf6X', // Invalid char
            'f81d4fae_7dec_11d0_a765_00a0c91e6bf6', // Wrong separators
            'f81d4fae-7dec-61d0-a765-00a0c91e6bf6', // Invalid version (6)
            'f81d4fae-7dec-11d0-g765-00a0c91e6bf6', // Invalid hex char (g)
            '', null, undefined, 12345
        ];

        validUUIDs.forEach(uuid => {
            test(`should return true for valid UUID: ${uuid}`, () => {
                expect(validateUUID(uuid)).toBe(true);
            });
        });

        invalidUUIDs.forEach(uuid => {
            test(`should return false for invalid UUID: ${uuid}`, () => {
                expect(validateUUID(uuid)).toBe(false);
            });
        });
    });

    // Since validateTenantId and validateStoreId directly call validateUUID,
    // we just need to ensure they pass the value correctly.
    describe('validateTenantId', () => {
        test('should return true for a valid UUID passed as tenantId', () => {
            expect(validateTenantId('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBe(true);
        });
        test('should return false for an invalid UUID passed as tenantId', () => {
            expect(validateTenantId('invalid-uuid-format')).toBe(false);
        });
        test('should return false for non-string input as tenantId', () => {
            expect(validateTenantId(123)).toBe(false);
        });
    });

    describe('validateStoreId', () => {
        test('should return true for a valid UUID passed as storeId', () => {
            expect(validateStoreId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
        });
        test('should return false for an invalid UUID passed as storeId', () => {
            expect(validateStoreId('another-invalid-format')).toBe(false);
        });
        test('should return false for non-string input as storeId', () => {
            expect(validateStoreId(null)).toBe(false);
        });
    });
}); 