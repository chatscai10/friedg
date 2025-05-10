import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { checkTenantAccess, checkStoreAccess } from '../tenant.middleware';
import { hasPermission } from '../../libs/rbac';
import { UserInfo, RoleLevel, PermissionResult, ActionType } from '../../libs/rbac/types';

// --- Mocks ---

// Mock the RBAC hasPermission function
jest.mock('../../libs/rbac', () => ({
    hasPermission: jest.fn(),
}));

// Mock firebase-admin for store lookup in checkStoreAccess
const mockFbGet = jest.fn();
const mockFbDoc = jest.fn(() => ({ get: mockFbGet }));
const mockFbCollection = jest.fn(() => ({ doc: mockFbDoc }));
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    firestore: () => ({
        collection: mockFbCollection,
    }),
}));

// Helper to create mock Express objects
const createMockReqResNext = (user: any, body?: any, query?: any, method?: string) => {
    const req = {
        user,
        body: body || {},
        query: query || {},
        method: method || 'POST',
    } as unknown as Request;
    const res = {
        status: jest.fn(() => res),
        json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;
    return { req, res, next };
};

// Mock User Data
const mockSuperAdmin: Partial<UserInfo> = { uid: 'sa-1', role: 'super_admin', roleLevel: RoleLevel.SUPER_ADMIN };
const mockTenantAdminT1: Partial<UserInfo> = { uid: 'ta-1', role: 'tenant_admin', roleLevel: RoleLevel.TENANT_ADMIN, tenantId: 't-1' };
const mockStaffUserT1S1: Partial<UserInfo> = { uid: 'st-1', role: 'staff', roleLevel: RoleLevel.STAFF, tenantId: 't-1', storeId: 's-1' };
const mockStaffUserT2S2: Partial<UserInfo> = { uid: 'st-2', role: 'staff', roleLevel: RoleLevel.STAFF, tenantId: 't-2', storeId: 's-2' };
const mockUserWithoutTenantId: Partial<UserInfo> = { uid: 'no-t-1', role: 'staff', roleLevel: RoleLevel.STAFF, tenantId: undefined };
const mockUserWithoutStoreId: Partial<UserInfo> = { uid: 'no-s-1', role: 'staff', roleLevel: RoleLevel.STAFF, tenantId: 't-1', storeId: undefined };

// --- Tests ---
describe('Tenant/Store Access Middleware', () => {

    beforeEach(() => {
        // Clear mocks before each test
        (hasPermission as jest.Mock).mockClear();
        mockFbGet.mockClear();
        mockFbDoc.mockClear();
        mockFbCollection.mockClear();
    });

    describe('checkTenantAccess', () => {
        test('should return 401 if req.user is missing', async () => {
            const { req, res, next } = createMockReqResNext(null); // No user
            await checkTenantAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'AUTH_REQUIRED' }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should return 403 if tenantId cannot be determined', async () => {
            // User has no tenantId, and none in body/query
            const { req, res, next } = createMockReqResNext(mockUserWithoutTenantId);
            await checkTenantAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'NO_TENANT_SPECIFIED' }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should call next() for super_admin and set targetTenantId from body', async () => {
            const { req, res, next } = createMockReqResNext(mockSuperAdmin, { tenantId: 't-body' });
            await checkTenantAccess(req, res, next);
            expect((req as any).targetTenantId).toBe('t-body');
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith(); // Called with no error
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should call next() for super_admin and set targetTenantId from query', async () => {
            const { req, res, next } = createMockReqResNext(mockSuperAdmin, {}, { tenantId: 't-query' });
            await checkTenantAccess(req, res, next);
            expect((req as any).targetTenantId).toBe('t-query');
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });

         test('should call next() for super_admin and set targetTenantId from user if not in body/query', async () => {
            // Super admin doesn't usually have a tenantId, but testing the logic path
            const superAdminWithTenant = { ...mockSuperAdmin, tenantId: 't-sa-user' };
            const { req, res, next } = createMockReqResNext(superAdminWithTenant);
            await checkTenantAccess(req, res, next);
            expect((req as any).targetTenantId).toBe('t-sa-user'); // Falls back to user's tenantId
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
        });

        test('should return 403 if user tenantId does not match targetTenantId', async () => {
            const { req, res, next } = createMockReqResNext(mockStaffUserT1S1, { tenantId: 't-2' }); // User in t-1, target t-2
            await checkTenantAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'TENANT_ACCESS_DENIED' }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should call hasPermission if tenantId matches (action write for POST)', async () => {
            const { req, res, next } = createMockReqResNext(mockTenantAdminT1, { tenantId: 't-1' }, {}, 'POST');
            (hasPermission as jest.Mock).mockResolvedValueOnce({ granted: true });
            await checkTenantAccess(req, res, next);
            expect(hasPermission).toHaveBeenCalledWith(
                expect.objectContaining({ uid: mockTenantAdminT1.uid, role: mockTenantAdminT1.role }),
                expect.objectContaining({ action: 'write', resource: 'tenantData' }),
                { tenantId: 't-1' }
            );
            expect(next).toHaveBeenCalledTimes(1);
        });

        test('should determine action as \'read\' for GET request in hasPermission check', async () => {
            const { req, res, next } = createMockReqResNext(mockTenantAdminT1, {}, { tenantId: 't-1' }, 'GET');
            (hasPermission as jest.Mock).mockResolvedValueOnce({ granted: true });
            await checkTenantAccess(req, res, next);
            expect(hasPermission).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ action: 'read', resource: 'tenantData' }),
                expect.any(Object)
            );
            expect(next).toHaveBeenCalledTimes(1);
        });

        test('should return 403 if hasPermission returns granted: false', async () => {
            const { req, res, next } = createMockReqResNext(mockTenantAdminT1, { tenantId: 't-1' });
            const permissionResult: PermissionResult = { granted: false, reason: 'Insufficient role' };
            (hasPermission as jest.Mock).mockResolvedValueOnce(permissionResult);
            await checkTenantAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                errorCode: 'PERMISSION_DENIED',
                message: expect.stringContaining(permissionResult.reason!),
            }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should call next() and set targetTenantId if tenant matches and hasPermission is granted', async () => {
            const { req, res, next } = createMockReqResNext(mockStaffUserT1S1, {}, { tenantId: 't-1' }); // Target user's tenant via query
            (hasPermission as jest.Mock).mockResolvedValueOnce({ granted: true });
            await checkTenantAccess(req, res, next);
            expect(hasPermission).toHaveBeenCalled();
            expect((req as any).targetTenantId).toBe('t-1');
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should return 500 if hasPermission throws an error', async () => {
            const { req, res, next } = createMockReqResNext(mockTenantAdminT1, { tenantId: 't-1' });
            const error = new Error('RBAC error');
            (hasPermission as jest.Mock).mockRejectedValueOnce(error);
             // Mock console.error
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            await checkTenantAccess(req, res, next);

            expect(hasPermission).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'INTERNAL_ERROR' }));
            expect(next).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('租戶訪問檢查發生錯誤:', error);
            consoleErrorSpy.mockRestore();
        });
    });

    describe('checkStoreAccess', () => {
        test('should return 401 if req.user is missing', async () => {
            const { req, res, next } = createMockReqResNext(null);
            await checkStoreAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'AUTH_REQUIRED' }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should return 403 if storeId cannot be determined', async () => {
            const { req, res, next } = createMockReqResNext(mockUserWithoutStoreId);
            await checkStoreAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'NO_STORE_SPECIFIED' }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should call next() for super_admin and set targetStoreId', async () => {
            const { req, res, next } = createMockReqResNext(mockSuperAdmin, { storeId: 's-body' });
            await checkStoreAccess(req, res, next);
            expect((req as any).targetStoreId).toBe('s-body');
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
        });

        test('should call next() for tenant_admin if store exists in their tenant', async () => {
            const { req, res, next } = createMockReqResNext(mockTenantAdminT1, { storeId: 's-in-tenant' });
            // Mock Firestore response: store exists and belongs to tenant t-1
            mockFbGet.mockResolvedValueOnce({ exists: true, data: () => ({ tenantId: 't-1' }) });
            await checkStoreAccess(req, res, next);
            expect(mockFbCollection).toHaveBeenCalledWith('stores');
            expect(mockFbDoc).toHaveBeenCalledWith('s-in-tenant');
            expect((req as any).targetStoreId).toBe('s-in-tenant');
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
        });

        test('should return 404 for tenant_admin if target store does not exist', async () => {
            const { req, res, next } = createMockReqResNext(mockTenantAdminT1, { storeId: 's-non-existent' });
            mockFbGet.mockResolvedValueOnce({ exists: false }); // Store not found
            await checkStoreAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'STORE_NOT_FOUND' }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should return 500 for tenant_admin if Firestore lookup fails', async () => {
            const { req, res, next } = createMockReqResNext(mockTenantAdminT1, { storeId: 's-error' });
            const dbError = new Error('DB Error');
            mockFbGet.mockRejectedValueOnce(dbError);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await checkStoreAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'INTERNAL_ERROR' }));
            expect(next).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('檢查商店所屬租戶時發生錯誤:', dbError);
            consoleErrorSpy.mockRestore();
        });

        // Note: The original code for tenant_admin access check seems incomplete.
        // It should deny access if storeData.tenantId !== user.tenantId.
        // Adding a test for that scenario assuming the logic *should* be there.
        test('should return 403 for tenant_admin if target store exists but in different tenant', async () => {
            const { req, res, next } = createMockReqResNext(mockTenantAdminT1, { storeId: 's-in-other-tenant' });
            mockFbGet.mockResolvedValueOnce({ exists: true, data: () => ({ tenantId: 't-2' }) }); // Store belongs to t-2
            await checkStoreAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'TENANT_MISMATCH_FOR_STORE' }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should return 403 if user storeId does not match targetStoreId (non-admin)', async () => {
            const { req, res, next } = createMockReqResNext(mockStaffUserT1S1, { storeId: 's-2' }); // User in s-1, target s-2
            await checkStoreAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'STORE_ACCESS_DENIED' }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should call hasPermission if storeId matches (non-admin)', async () => {
            const { req, res, next } = createMockReqResNext(mockStaffUserT1S1, { storeId: 's-1' });
            (hasPermission as jest.Mock).mockResolvedValueOnce({ granted: true });
            await checkStoreAccess(req, res, next);
            expect(hasPermission).toHaveBeenCalledWith(
                expect.objectContaining({ uid: mockStaffUserT1S1.uid }),
                expect.objectContaining({ action: 'write', resource: 'storeData' }),
                { tenantId: 't-1', storeId: 's-1' }
            );
            expect(next).toHaveBeenCalledTimes(1);
        });

        test('should return 403 if hasPermission returns false (non-admin)', async () => {
            const { req, res, next } = createMockReqResNext(mockStaffUserT1S1, { storeId: 's-1' });
            (hasPermission as jest.Mock).mockResolvedValueOnce({ granted: false, reason: 'Action denied' });
            await checkStoreAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'PERMISSION_DENIED' }));
            expect(next).not.toHaveBeenCalled();
        });

        test('should call next() and set targetStoreId if store matches and permission granted', async () => {
            const { req, res, next } = createMockReqResNext(mockStaffUserT1S1, {}, { storeId: 's-1' }); // Target via query
            (hasPermission as jest.Mock).mockResolvedValueOnce({ granted: true });
            await checkStoreAccess(req, res, next);
            expect((req as any).targetStoreId).toBe('s-1');
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith();
        });

         test('should return 500 if hasPermission throws an error (non-admin)', async () => {
            const { req, res, next } = createMockReqResNext(mockStaffUserT1S1, { storeId: 's-1' });
            const rbacError = new Error('RBAC check failed');
            (hasPermission as jest.Mock).mockRejectedValueOnce(rbacError);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await checkStoreAccess(req, res, next);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'INTERNAL_ERROR' }));
            expect(next).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('商店訪問權限檢查中 RBAC 發生錯誤:', rbacError);
            consoleErrorSpy.mockRestore();
        });
    });
}); 