import * as functions from 'firebase-functions';
import { UserInfo, RoleType, RoleLevel, CallableContext } from '../../libs/rbac/types';
import {
    withAuthentication,
    withTenantIsolation,
    withStoreIsolation,
    withRole,
    withMockAuthentication,
} from '../auth.middleware';
import { getUserInfoFromClaims } from '../../libs/rbac';
import { validateRoleType } from '../../libs/rbac/utils/validators';

// --- Mocks ---

// Mock firebase-functions HttpsError
jest.mock('firebase-functions', () => ({
    https: {
        HttpsError: class extends Error {
            code: functions.https.FunctionsErrorCode;
            details: any;
            constructor(code: functions.https.FunctionsErrorCode, message?: string, details?: any) {
                super(message || '');
                this.code = code;
                this.details = details;
                // Ensure the name property is set correctly for error type checking
                this.name = 'HttpsError';
            }
        }
    }
}));

// Mock dependencies
jest.mock('../../libs/rbac', () => ({
    getUserInfoFromClaims: jest.fn(),
}));

jest.mock('../../libs/rbac/utils/validators', () => ({
    validateRoleType: jest.fn(),
}));

// Mock User Data for testing
const mockSuperAdmin: UserInfo = { uid: 'sa-1', role: 'super_admin', roleLevel: RoleLevel.SUPER_ADMIN, tenantId: undefined, storeId: undefined };
const mockTenantAdmin: UserInfo = { uid: 'ta-1', role: 'tenant_admin', roleLevel: RoleLevel.TENANT_ADMIN, tenantId: 't-1', storeId: undefined };
const mockStoreManager: UserInfo = { uid: 'sm-1', role: 'store_manager', roleLevel: RoleLevel.STORE_MANAGER, tenantId: 't-1', storeId: 's-1' };
const mockStaff: UserInfo = { uid: 'st-1', role: 'staff', roleLevel: RoleLevel.STAFF, tenantId: 't-1', storeId: 's-1' };
const mockStaffS2: UserInfo = { uid: 'st-2', role: 'staff', roleLevel: RoleLevel.STAFF, tenantId: 't-1', storeId: 's-2' };
const mockStaffT2: UserInfo = { uid: 'st-3', role: 'staff', roleLevel: RoleLevel.STAFF, tenantId: 't-2', storeId: 's-3' };
const mockStaffWithAddStores: UserInfo = { uid: 'st-4', role: 'staff', roleLevel: RoleLevel.STAFF, tenantId: 't-1', storeId: 's-1', additionalStoreIds: ['s-2'] };
const mockUserNoTenant: UserInfo = { uid: 'ut-1', role: 'customer', roleLevel: RoleLevel.CUSTOMER, tenantId: undefined, storeId: undefined };
const mockUserNoStore: UserInfo = { uid: 'us-1', role: 'tenant_admin', roleLevel: RoleLevel.TENANT_ADMIN, tenantId: 't-1', storeId: undefined };

// Mock CallableContext
const mockContextAuthenticated = (userInfo: UserInfo): CallableContext => ({
    auth: {
        uid: userInfo.uid,
        token: { /* mock token claims if needed, like userInfo */ ...userInfo },
    },
    instanceToken: 'mock-instance-token',
    rawRequest: {},
});

const mockContextUnauthenticated: CallableContext = {
    auth: undefined,
    instanceToken: 'mock-instance-token',
    rawRequest: {},
};

const mockEmptyContext: CallableContext = { auth: undefined, instanceToken: 'mock-instance-token', rawRequest: {} }; // Context for mock auth

// Helper handler for testing middleware
const mockHandler = jest.fn();

// --- Tests ---
describe('Authentication Middleware', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Clear mocks before each test
        (getUserInfoFromClaims as jest.Mock).mockClear();
        (validateRoleType as unknown as jest.Mock).mockClear();
        mockHandler.mockClear();
        // Reset environment variables
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        // Restore original environment variables
        process.env = originalEnv;
    });

    describe('withAuthentication', () => {
        test('should throw unauthenticated error if context.auth is missing', async () => {
            const wrappedHandler = withAuthentication(mockHandler);
            await expect(wrappedHandler({}, mockContextUnauthenticated)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, mockContextUnauthenticated)).rejects.toMatchObject({
                code: 'unauthenticated',
                message: '需要登入才能執行此操作',
            });
            expect(getUserInfoFromClaims).not.toHaveBeenCalled();
            expect(mockHandler).not.toHaveBeenCalled();
        });

        test('should throw permission-denied if getUserInfoFromClaims returns null', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(null);
            const wrappedHandler = withAuthentication(mockHandler);
            const context = mockContextAuthenticated(mockStaff); // Use any authenticated context

            await expect(wrappedHandler({}, context)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, context)).rejects.toMatchObject({
                code: 'permission-denied',
                message: '無法獲取用戶權限資訊，請確認帳號權限或重新登入',
            });
            expect(getUserInfoFromClaims).toHaveBeenCalledWith(context.auth?.token);
            expect(mockHandler).not.toHaveBeenCalled();
        });

        test('should call handler with user info if authentication succeeds', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockStaff);
            const wrappedHandler = withAuthentication(mockHandler);
            const context = mockContextAuthenticated(mockStaff);
            const data = { input: 'test' };

            mockHandler.mockResolvedValueOnce({ success: true }); // Mock handler response

            const result = await wrappedHandler(data, context);

            expect(getUserInfoFromClaims).toHaveBeenCalledWith(context.auth?.token);
            expect(mockHandler).toHaveBeenCalledWith(data, context, mockStaff);
            expect(result).toEqual({ success: true });
        });

        test('should throw internal error if getUserInfoFromClaims throws an unexpected error', async () => {
            const unexpectedError = new Error('Unexpected DB failure');
            (getUserInfoFromClaims as jest.Mock).mockRejectedValueOnce(unexpectedError);
            const wrappedHandler = withAuthentication(mockHandler);
            const context = mockContextAuthenticated(mockStaff);

            await expect(wrappedHandler({}, context)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, context)).rejects.toMatchObject({
                code: 'internal',
                message: `身份驗證時發生內部錯誤: ${unexpectedError.message}`,
            });
            expect(mockHandler).not.toHaveBeenCalled();
        });
    });

    describe('withTenantIsolation', () => {
        test('should bypass isolation for super_admin', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockSuperAdmin);
            const wrappedHandler = withTenantIsolation(mockHandler);
            const context = mockContextAuthenticated(mockSuperAdmin);
            const data = { tenantId: 't-other' }; // Different tenant ID
            await wrappedHandler(data, context);
            // Expect handler to be called with original data and super admin user
            expect(mockHandler).toHaveBeenCalledWith(data, context, mockSuperAdmin);
        });

        test('should throw permission-denied if user has no tenantId (and not super_admin)', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockUserNoTenant);
            const wrappedHandler = withTenantIsolation(mockHandler);
            const context = mockContextAuthenticated(mockUserNoTenant);
            await expect(wrappedHandler({}, context)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, context)).rejects.toMatchObject({
                code: 'permission-denied',
                message: '用戶未關聯到任何租戶',
            });
            expect(mockHandler).not.toHaveBeenCalled();
        });

        test('should throw permission-denied if data.tenantId mismatches user.tenantId', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockTenantAdmin); // User is in t-1
            const wrappedHandler = withTenantIsolation(mockHandler);
            const context = mockContextAuthenticated(mockTenantAdmin);
            const data = { tenantId: 't-2' }; // Data targets t-2
            await expect(wrappedHandler(data, context)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler(data, context)).rejects.toMatchObject({
                code: 'permission-denied',
                message: '無法訪問其他租戶的資源',
            });
            expect(mockHandler).not.toHaveBeenCalled();
        });

        test('should call handler with enhanced data (user tenantId) if data has no tenantId', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockTenantAdmin); // User is in t-1
            const wrappedHandler = withTenantIsolation(mockHandler);
            const context = mockContextAuthenticated(mockTenantAdmin);
            const data = { otherData: 'value' }; // No tenantId in data
            const expectedEnhancedData = { ...data, tenantId: mockTenantAdmin.tenantId };
            await wrappedHandler(data, context);
            expect(mockHandler).toHaveBeenCalledWith(expectedEnhancedData, context, mockTenantAdmin);
        });

        test('should call handler with original data if data.tenantId matches user.tenantId', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockTenantAdmin); // User is in t-1
            const wrappedHandler = withTenantIsolation(mockHandler);
            const context = mockContextAuthenticated(mockTenantAdmin);
            const data = { tenantId: 't-1', otherData: 'value' }; // Matching tenantId
            await wrappedHandler(data, context);
            expect(mockHandler).toHaveBeenCalledWith(data, context, mockTenantAdmin);
        });

        // Test underlying withAuthentication failure propagation
        test('should propagate unauthenticated error from withAuthentication', async () => {
            const wrappedHandler = withTenantIsolation(mockHandler);
            // No need to mock getUserInfoFromClaims as it won't be reached
            await expect(wrappedHandler({}, mockContextUnauthenticated)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, mockContextUnauthenticated)).rejects.toMatchObject({ code: 'unauthenticated' });
        });
    });

    describe('withStoreIsolation', () => {
        test('should bypass isolation for super_admin', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockSuperAdmin);
            const wrappedHandler = withStoreIsolation(mockHandler);
            const context = mockContextAuthenticated(mockSuperAdmin);
            const data = { storeId: 's-other' };
            await wrappedHandler(data, context);
            expect(mockHandler).toHaveBeenCalledWith(data, context, mockSuperAdmin);
        });

        test('should bypass isolation for tenant_admin', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockTenantAdmin);
            const wrappedHandler = withStoreIsolation(mockHandler);
            const context = mockContextAuthenticated(mockTenantAdmin);
            const data = { storeId: 's-other' }; // Should be allowed access within their tenant
            await wrappedHandler(data, context);
            expect(mockHandler).toHaveBeenCalledWith(data, context, mockTenantAdmin);
        });

        test('should throw permission-denied if user has no storeId (and not SA/TA)', async () => {
            const userWithoutStore: UserInfo = { ...mockStaff, storeId: undefined };
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(userWithoutStore);
            const wrappedHandler = withStoreIsolation(mockHandler);
            const context = mockContextAuthenticated(userWithoutStore);
            await expect(wrappedHandler({}, context)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, context)).rejects.toMatchObject({
                code: 'permission-denied',
                message: '用戶未關聯到任何店鋪',
            });
            expect(mockHandler).not.toHaveBeenCalled();
        });

        test('should throw permission-denied if data.storeId mismatches user stores', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockStaff); // User in s-1
            const wrappedHandler = withStoreIsolation(mockHandler);
            const context = mockContextAuthenticated(mockStaff);
            const data = { storeId: 's-3' }; // Target different store
            await expect(wrappedHandler(data, context)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler(data, context)).rejects.toMatchObject({
                code: 'permission-denied',
                message: '無法訪問非授權店鋪的資源',
            });
            expect(mockHandler).not.toHaveBeenCalled();
        });

        test('should call handler if data.storeId matches user.storeId', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockStaff); // User in s-1
            const wrappedHandler = withStoreIsolation(mockHandler);
            const context = mockContextAuthenticated(mockStaff);
            const data = { storeId: 's-1' };
            await wrappedHandler(data, context);
            expect(mockHandler).toHaveBeenCalledWith(data, context, mockStaff);
        });

        test('should call handler if data.storeId matches user.additionalStoreIds', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockStaffWithAddStores); // User in s-1, additional s-2
            const wrappedHandler = withStoreIsolation(mockHandler);
            const context = mockContextAuthenticated(mockStaffWithAddStores);
            const data = { storeId: 's-2' }; // Target additional store
            await wrappedHandler(data, context);
            expect(mockHandler).toHaveBeenCalledWith(data, context, mockStaffWithAddStores);
        });

        test('should call handler with enhanced data (user storeId) if data has no storeId', async () => {
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockStaff); // User in s-1
            const wrappedHandler = withStoreIsolation(mockHandler);
            const context = mockContextAuthenticated(mockStaff);
            const data = { other: 'info' }; // No storeId
            const expectedEnhancedData = { ...data, storeId: mockStaff.storeId };
            await wrappedHandler(data, context);
            expect(mockHandler).toHaveBeenCalledWith(expectedEnhancedData, context, mockStaff);
        });

        // Test underlying withTenantIsolation failure propagation
        test('should propagate tenant isolation error', async () => {
            // Simulate a user from tenant t-2 trying to access through this middleware
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockStaffT2); // User in t-2
            const wrappedHandler = withStoreIsolation(mockHandler);
            const context = mockContextAuthenticated(mockStaffT2);
            const data = { tenantId: 't-1' }; // Forcing tenant mismatch in underlying check

            await expect(wrappedHandler(data, context)).rejects.toThrow(functions.https.HttpsError);
            // The error should come from withTenantIsolation
            await expect(wrappedHandler(data, context)).rejects.toMatchObject({
                code: 'permission-denied',
                message: '無法訪問其他租戶的資源', // Message from withTenantIsolation
            });
        });
    });

    describe('withRole', () => {
        test('should throw invalid-argument if requiredRole is invalid', async () => {
            (validateRoleType as unknown as jest.Mock).mockReturnValueOnce(false); // Mock validator to return false
            // We expect the error during the middleware creation/wrapping phase, not during execution
            try {
                withRole('invalidRole' as RoleType, mockHandler);
                // If no error is thrown, fail the test
                throw new Error('Middleware creation did not throw with invalid role');
            } catch (error: any) {
                 // Check if the caught error is the expected HttpsError
                 // Note: This check happens *outside* the async wrappedHandler call
                 expect(error).toBeInstanceOf(functions.https.HttpsError);
                 expect(error.code).toBe('invalid-argument');
                 expect(error.message).toContain('角色類型 \'invalidRole\' 無效');
            }
            // Ensure validator was called during middleware setup
            expect(validateRoleType).toHaveBeenCalledWith('invalidRole');
            // Handler should not be called if setup fails
            expect(mockHandler).not.toHaveBeenCalled();
        });

        test('should call handler if user role level is sufficient (equal)', async () => {
            (validateRoleType as unknown as jest.Mock).mockReturnValueOnce(true); // Required role is valid
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockStoreManager); // User is Store Manager (level 2)
            const wrappedHandler = withRole('store_manager', mockHandler);
            const context = mockContextAuthenticated(mockStoreManager);
            const data = { action: 'someAction' };
            await wrappedHandler(data, context);
            expect(mockHandler).toHaveBeenCalledWith(data, context, mockStoreManager);
        });

        test('should call handler if user role level is sufficient (higher)', async () => {
            (validateRoleType as unknown as jest.Mock).mockReturnValueOnce(true);
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockTenantAdmin); // User is Tenant Admin (level 1)
            const wrappedHandler = withRole('store_manager', mockHandler); // Require Store Manager (level 2)
            const context = mockContextAuthenticated(mockTenantAdmin);
            const data = { action: 'someAction' };
            await wrappedHandler(data, context);
            // User level 1 <= Required level 2 (remember lower number is higher role)
            expect(mockHandler).toHaveBeenCalledWith(data, context, mockTenantAdmin);
        });

        test('should throw permission-denied if user role level is insufficient', async () => {
            (validateRoleType as unknown as jest.Mock).mockReturnValueOnce(true);
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(mockStaff); // User is Staff (level 4)
            const wrappedHandler = withRole('store_manager', mockHandler); // Require Store Manager (level 2)
            const context = mockContextAuthenticated(mockStaff);
            await expect(wrappedHandler({}, context)).rejects.toThrow(functions.https.HttpsError);
            // User level 4 > Required level 2
            await expect(wrappedHandler({}, context)).rejects.toMatchObject({
                code: 'permission-denied',
                message: "此操作需要 'store_manager' 或更高權限的角色",
            });
            expect(mockHandler).not.toHaveBeenCalled();
        });

        // Test underlying withAuthentication failure propagation
        test('should propagate authentication errors', async () => {
            (validateRoleType as unknown as jest.Mock).mockReturnValueOnce(true);
            const wrappedHandler = withRole('staff', mockHandler);
            // Test unauthenticated
            await expect(wrappedHandler({}, mockContextUnauthenticated)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, mockContextUnauthenticated)).rejects.toMatchObject({ code: 'unauthenticated' });

            // Test permission denied during user info fetch
            (getUserInfoFromClaims as jest.Mock).mockResolvedValueOnce(null);
            const context = mockContextAuthenticated(mockStaff);
            await expect(wrappedHandler({}, context)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, context)).rejects.toMatchObject({ code: 'permission-denied' });
        });
    });

    describe('withMockAuthentication', () => {
        test('should throw failed-precondition if not in test or emulator environment', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.FUNCTIONS_EMULATOR;
            const wrappedHandler = withMockAuthentication(mockHandler);
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toMatchObject({
                code: 'failed-precondition',
                message: '模擬身份驗證中間件只能在測試環境中使用',
            });
        });

        test('should call handler with mock user info from env vars in test env', async () => {
            process.env.NODE_ENV = 'test';
            process.env.MOCK_ROLE = 'store_manager';
            process.env.MOCK_TENANT_ID = 'mock-tenant-1';
            process.env.MOCK_STORE_ID = 'mock-store-1';
            process.env.MOCK_UID = 'mock-user-1';
            (validateRoleType as unknown as jest.Mock).mockReturnValue(true); // Assume role is valid

            const wrappedHandler = withMockAuthentication(mockHandler);
            const data = { some: 'data' };
            await wrappedHandler(data, mockEmptyContext);

            expect(validateRoleType).toHaveBeenCalledWith('store_manager');
            expect(mockHandler).toHaveBeenCalledWith(data, mockEmptyContext, expect.objectContaining({
                uid: 'mock-user-1',
                role: 'store_manager',
                roleLevel: 5, // Current implementation defaults to 5, should ideally use RoleLevelMap
                tenantId: 'mock-tenant-1',
                storeId: 'mock-store-1',
                additionalStoreIds: [],
                permissions: { canDiscount: false, canRefund: false },
            }));
        });

        test('should call handler with mock user info from env vars in emulator env', async () => {
            process.env.NODE_ENV = 'production'; // Not test, but emulator is set
            process.env.FUNCTIONS_EMULATOR = 'true';
            process.env.MOCK_ROLE = 'tenant_admin';
            // Use defaults for other env vars
            delete process.env.MOCK_TENANT_ID;
            delete process.env.MOCK_STORE_ID;
            delete process.env.MOCK_UID;
            (validateRoleType as unknown as jest.Mock).mockReturnValue(true);

            const wrappedHandler = withMockAuthentication(mockHandler);
            await wrappedHandler({}, mockEmptyContext);

            expect(validateRoleType).toHaveBeenCalledWith('tenant_admin');
            expect(mockHandler).toHaveBeenCalledWith({}, mockEmptyContext, expect.objectContaining({
                uid: 'test-user-123', // Default MOCK_UID
                role: 'tenant_admin',
                tenantId: 'tenant-123', // Default MOCK_TENANT_ID
                storeId: 'store-123', // Default MOCK_STORE_ID
            }));
        });

        test('should default to staff role if MOCK_ROLE is invalid', async () => {
            process.env.NODE_ENV = 'test';
            process.env.MOCK_ROLE = 'invalid-role';
            (validateRoleType as unknown as jest.Mock).mockReturnValue(false); // Role is invalid

            const wrappedHandler = withMockAuthentication(mockHandler);
            await wrappedHandler({}, mockEmptyContext);

            expect(validateRoleType).toHaveBeenCalledWith('invalid-role');
            expect(mockHandler).toHaveBeenCalledWith({}, mockEmptyContext, expect.objectContaining({
                role: 'staff', // Should default to staff
            }));
        });

        test('should default to staff role if MOCK_ROLE is not set', async () => {
            process.env.NODE_ENV = 'test';
            delete process.env.MOCK_ROLE;
            (validateRoleType as unknown as jest.Mock).mockReturnValue(false); // Mock validator for the default role 'staff'

            const wrappedHandler = withMockAuthentication(mockHandler);
            await wrappedHandler({}, mockEmptyContext);

            expect(validateRoleType).toHaveBeenCalledWith('staff'); // Called with default
            expect(mockHandler).toHaveBeenCalledWith({}, mockEmptyContext, expect.objectContaining({
                role: 'staff',
            }));
        });

        test('should propagate HttpsError from the handler', async () => {
            process.env.NODE_ENV = 'test';
            const handlerError = new functions.https.HttpsError('not-found', 'Resource not available');
            mockHandler.mockRejectedValueOnce(handlerError);
            (validateRoleType as unknown as jest.Mock).mockReturnValue(true);

            const wrappedHandler = withMockAuthentication(mockHandler);
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toMatchObject({
                code: 'not-found',
                message: 'Resource not available',
            });
        });

        test('should wrap non-HttpsError from the handler in an internal HttpsError', async () => {
            process.env.NODE_ENV = 'test';
            const handlerError = new Error('Something broke');
            mockHandler.mockRejectedValueOnce(handlerError);
            (validateRoleType as unknown as jest.Mock).mockReturnValue(true);

            const wrappedHandler = withMockAuthentication(mockHandler);
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toMatchObject({
                code: 'internal',
                message: `內部錯誤: ${handlerError.message}`,
            });
        });
    });

    describe('Enhanced withMockAuthentication', () => {
        beforeEach(() => {
            // 重置驗證函數的mock
            (validateRoleType as unknown as jest.Mock).mockImplementation(role => 
                ['super_admin', 'tenant_admin', 'store_manager', 'staff', 'customer'].includes(role)
            );
            // 清除所有console方法的mock
            jest.spyOn(console, 'log').mockImplementation();
        });

        test('應該拒絕在非測試環境中使用模擬身份', async () => {
            // 設置非測試環境
            process.env.NODE_ENV = 'production';
            process.env.FUNCTIONS_EMULATOR = 'false';

            const wrappedHandler = withMockAuthentication(mockHandler);
            
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toMatchObject({
                code: 'failed-precondition',
                message: '模擬身份驗證中間件只能在測試環境中使用'
            });
            
            expect(mockHandler).not.toHaveBeenCalled();
        });

        test('在測試環境中應該使用預設模擬值', async () => {
            // 設置測試環境
            process.env.NODE_ENV = 'test';
            
            const wrappedHandler = withMockAuthentication(mockHandler);
            mockHandler.mockResolvedValueOnce({ success: true });
            
            const result = await wrappedHandler({}, mockEmptyContext);
            
            expect(mockHandler).toHaveBeenCalledWith(
                expect.any(Object), 
                mockEmptyContext, 
                expect.objectContaining({
                    uid: 'test-user-123',
                    role: 'staff',
                    tenantId: 'tenant-123',
                    storeId: 'store-123'
                })
            );
            
            expect(result).toEqual({ success: true });
        });

        test('應該從請求數據中獲取模擬屬性', async () => {
            // 設置測試環境
            process.env.FUNCTIONS_EMULATOR = 'true';
            
            const customMockData = {
                __mockRole: 'store_manager',
                __mockTenantId: 'custom-tenant',
                __mockStoreId: 'custom-store',
                __mockUid: 'custom-user',
                __mockAdditionalStoreIds: ['store-1', 'store-2'],
                actualData: 'value'
            };
            
            const wrappedHandler = withMockAuthentication(mockHandler);
            mockHandler.mockResolvedValueOnce({ success: true });
            
            await wrappedHandler(customMockData, mockEmptyContext);
            
            // 驗證處理函數收到了正確的user對象和清除了模擬屬性的數據
            expect(mockHandler).toHaveBeenCalledWith(
                { actualData: 'value' },  // 模擬屬性應已被移除
                mockEmptyContext,
                expect.objectContaining({
                    uid: 'custom-user',
                    role: 'store_manager',
                    tenantId: 'custom-tenant',
                    storeId: 'custom-store',
                    additionalStoreIds: ['store-1', 'store-2']
                })
            );
        });

        test('應該在角色無效時使用預設角色', async () => {
            // 模擬角色驗證失敗
            (validateRoleType as unknown as jest.Mock).mockReturnValue(false);
            
            // 設置測試環境
            process.env.NODE_ENV = 'test';
            
            const invalidRoleData = { __mockRole: 'invalid_role' };
            
            const wrappedHandler = withMockAuthentication(mockHandler);
            await wrappedHandler(invalidRoleData, mockEmptyContext);
            
            // 驗證處理函數接收到了預設的staff角色
            expect(mockHandler).toHaveBeenCalledWith(
                expect.any(Object),
                mockEmptyContext,
                expect.objectContaining({ role: 'staff' })
            );
        });

        test('應該根據角色設置合適的權限', async () => {
            // 測試不同角色的權限設置
            process.env.NODE_ENV = 'test';
            
            // 測試租戶管理員的權限
            const tenantAdminData = { __mockRole: 'tenant_admin' };
            const wrappedHandlerTA = withMockAuthentication(mockHandler);
            mockHandler.mockReset();
            await wrappedHandlerTA(tenantAdminData, mockEmptyContext);
            expect(mockHandler).toHaveBeenCalledWith(
                expect.any(Object),
                mockEmptyContext,
                expect.objectContaining({ 
                    role: 'tenant_admin',
                    permissions: expect.objectContaining({
                        canDiscount: true,
                        canRefund: true,
                        maxDiscountPercentage: 100
                    })
                })
            );
            
            // 測試店長的權限
            mockHandler.mockReset();
            const storeManagerData = { __mockRole: 'store_manager' };
            const wrappedHandlerSM = withMockAuthentication(mockHandler);
            await wrappedHandlerSM(storeManagerData, mockEmptyContext);
            expect(mockHandler).toHaveBeenCalledWith(
                expect.any(Object),
                mockEmptyContext,
                expect.objectContaining({ 
                    role: 'store_manager',
                    permissions: expect.objectContaining({
                        canDiscount: true,
                        canRefund: true,
                        maxDiscountPercentage: 50
                    })
                })
            );
            
            // 測試普通員工的權限
            mockHandler.mockReset();
            const staffData = { __mockRole: 'staff' };
            const wrappedHandlerST = withMockAuthentication(mockHandler);
            await wrappedHandlerST(staffData, mockEmptyContext);
            expect(mockHandler).toHaveBeenCalledWith(
                expect.any(Object),
                mockEmptyContext,
                expect.objectContaining({ 
                    role: 'staff',
                    permissions: expect.objectContaining({
                        canDiscount: false,
                        canRefund: false,
                        maxDiscountPercentage: 0
                    })
                })
            );
        });

        test('應該正確處理模擬函數中的錯誤', async () => {
            process.env.NODE_ENV = 'test';
            
            // 模擬處理函數拋出錯誤
            const testError = new Error('Test error in handler');
            mockHandler.mockRejectedValueOnce(testError);
            
            const wrappedHandler = withMockAuthentication(mockHandler);
            
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toThrow(functions.https.HttpsError);
            await expect(wrappedHandler({}, mockEmptyContext)).rejects.toMatchObject({
                code: 'internal',
                message: expect.stringContaining('Test error in handler')
            });
        });

        test('應該記錄模擬身份的使用情況', async () => {
            process.env.NODE_ENV = 'test';
            
            // 監視console.log
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            
            const customMockData = {
                __mockRole: 'tenant_admin',
                __mockUid: 'mock-testing-user'
            };
            
            const wrappedHandler = withMockAuthentication(mockHandler);
            await wrappedHandler(customMockData, mockEmptyContext);
            
            // 驗證是否記錄了模擬身份的使用
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('[TEST] 使用模擬身份: mock-testing-user')
            );
            
            consoleLogSpy.mockRestore();
        });
    });
}); 