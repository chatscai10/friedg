import roleReducer, {
  initialState,
  setCurrentPage,
  setPageSize,
  setSearchQuery,
  setSortModel,
  clearFetchRolesError,
  clearCreateError,
  clearUpdateError,
  clearDeleteError,
  setCurrentRole,
  clearCurrentRole,
  clearRoleState,
  fetchRoles,
  fetchRoleById,
  createRole,
  updateRole,
  deleteRole,
} from '../roleSlice';
import {
  RoleState,
  Role,
  RolesResponse,
  RoleScope,
  SortDirection,
  RoleStatus,
  PermissionItem
} from '../../../types/role';
import * as roleService from '../../../services/roleService';

// Mock the roleService module
// The path should be relative to this test file: web-admin/src/store/__tests__/roleSlice.test.ts
// Service file is at: web-admin/src/services/roleService.ts
jest.mock('../../../services/roleService');

// Typed mock for roleService
const mockedRoleService = roleService as jest.Mocked<typeof roleService>;

describe('roleSlice', () => {
  let testInitialState: RoleState;

  beforeEach(() => {
    // Deep copy of initialState before each test to ensure test isolation
    testInitialState = JSON.parse(JSON.stringify(initialState));
    // Reset mocks before each test to clear call counts, etc.
    jest.clearAllMocks();
  });

  describe('reducers', () => {
    test('should return the initial state on first run', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nextState = roleReducer(undefined, {} as any);
      expect(nextState).toEqual(initialState);
    });

    describe('synchronous actions', () => {
      test('setCurrentPage should update pagination.currentPage', () => {
        const newPage = 5;
        const nextState = roleReducer(testInitialState, setCurrentPage(newPage));
        expect(nextState.pagination.currentPage).toEqual(newPage);
        expect(nextState.pagination.pageSize).toEqual(testInitialState.pagination.pageSize);
      });

      test('clearCreateError should set createError to null', () => {
        const stateWithError: RoleState = {
          ...testInitialState,
          createError: 'Some creation error',
        };
        const nextState = roleReducer(stateWithError, clearCreateError());
        expect(nextState.createError).toBeNull();
        expect(nextState.createLoading).toEqual(stateWithError.createLoading);
      });

      test('setCurrentRole should set currentRole', () => {
        const mockPermissions: PermissionItem[] = [
          { id: 'p1', name: 'Perm 1', resourceType: 'res', action: 'act', category: 'cat1' },
        ];
        const mockRole: Role = {
          roleId: 'role-123',
          roleName: 'Test Role',
          scope: RoleScope.TENANT,
          roleLevel: 1,
          permissions: ['p1'],
          isSystemRole: false,
          status: RoleStatus.ACTIVE,
          tenantId: 'tenant-abc',
          description: 'A test role',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        };
        const nextState = roleReducer(testInitialState, setCurrentRole(mockRole));
        expect(nextState.currentRole).toEqual(mockRole);
        expect(nextState.loadingById).toBe(false);
        expect(nextState.errorById).toBeNull();
      });
      
      test('clearCurrentRole should set currentRole to null and reset related states', () => {
        const mockRole: Role = { roleId: 'role-123', roleName: 'Test Role', scope: RoleScope.GLOBAL, permissions: [], isSystemRole: false, status: RoleStatus.ACTIVE, roleLevel: 1 }; 
        const stateWithCurrentRole: RoleState = {
            ...testInitialState,
            currentRole: mockRole,
            loadingById: false,
            errorById: 'some error'
        };
        const nextState = roleReducer(stateWithCurrentRole, clearCurrentRole());
        expect(nextState.currentRole).toBeNull();
        expect(nextState.loadingById).toBe(false);
        expect(nextState.errorById).toBeNull();
    });

      test('setSearchQuery should update searchQuery', () => {
        const query = 'admin';
        const nextState = roleReducer(testInitialState, setSearchQuery(query));
        expect(nextState.searchQuery).toEqual(query);
      });
  
      test('setPageSize should update pagination.pageSize and reset currentPage to 1', () => {
          const newPageSize = 25;
          const stateWithPageTwo: RoleState = {
              ...testInitialState,
              pagination: {
                  ...testInitialState.pagination,
                  currentPage: 2,
              }
          };
          const nextState = roleReducer(stateWithPageTwo, setPageSize(newPageSize));
          expect(nextState.pagination.pageSize).toEqual(newPageSize);
          expect(nextState.pagination.currentPage).toEqual(1);
      });
  
      test('clearFetchRolesError should set error to null', () => {
          const stateWithError: RoleState = {
              ...testInitialState,
              error: 'Error fetching roles',
          };
          const nextState = roleReducer(stateWithError, clearFetchRolesError());
          expect(nextState.error).toBeNull();
      });
  
      test('clearUpdateError should set updateError to null', () => {
          const stateWithError: RoleState = {
              ...testInitialState,
              updateError: 'Error updating role',
          };
          const nextState = roleReducer(stateWithError, clearUpdateError());
          expect(nextState.updateError).toBeNull();
      });
      
      test('clearDeleteError should set deleteError to null', () => {
          const stateWithError: RoleState = {
              ...testInitialState,
              deleteError: 'Error deleting role',
          };
          const nextState = roleReducer(stateWithError, clearDeleteError());
          expect(nextState.deleteError).toBeNull();
      });
  
      test('clearRoleState should reset the state to initial state', () => {
          const modifiedState: RoleState = {
              ...testInitialState,
              roles: [{ roleId: '1', roleName: 'Test Role', scope: RoleScope.GLOBAL, permissions: [], isSystemRole: false, status: RoleStatus.ACTIVE, roleLevel:1 }],
              loading: true,
              error: 'Some error',
              pagination: { currentPage: 5, pageSize: 50, totalCount: 100, totalPages: 2 },
              searchQuery: 'test',
              createLoading: true,
              createError: 'create error test'
          };
          const nextState = roleReducer(modifiedState, clearRoleState());
          expect(nextState).toEqual(initialState);
      });
  
      test('setSortModel should update sortModel', () => {
          const newSortModel = [{ field: 'roleName', sort: SortDirection.ASC }];
          const nextState = roleReducer(testInitialState, setSortModel(newSortModel));
          expect(nextState.sortModel).toEqual(newSortModel);
        });
    });
  });

  describe('async thunks', () => {
    describe('fetchRoles (WorkspaceRoles)', () => {
      test('fetchRoles.pending sets loading to true and error to null', () => {
        const action = { type: fetchRoles.pending.type };
        const state = roleReducer(testInitialState, action);
        expect(state.loading).toBe(true);
        expect(state.error).toBeNull();
      });

      test('fetchRoles.fulfilled updates state correctly on successful fetch', () => {
        const mockRoleData: Role[] = [
          { roleId: 'role1', roleName: 'Admin Role', scope: RoleScope.GLOBAL, permissions: [], isSystemRole: true, status: RoleStatus.ACTIVE, roleLevel: 0 },
          { roleId: 'role2', roleName: 'Tenant Admin', scope: RoleScope.TENANT, tenantId: 't1', permissions: [], isSystemRole: false, status: RoleStatus.ACTIVE, roleLevel: 1 },
        ];
        const mockResponse: RolesResponse = {
          data: mockRoleData,
          pagination: {
            currentPage: 1,
            pageSize: 10,
            totalCount: 2,
            totalPages: 1,
          },
          message: 'Roles fetched successfully'
        };
        const action = { type: fetchRoles.fulfilled.type, payload: mockResponse };
        const state = roleReducer(testInitialState, action);

        expect(state.loading).toBe(false);
        expect(state.roles).toEqual(mockRoleData);
        expect(state.pagination).toEqual(mockResponse.pagination);
        expect(state.error).toBeNull();
      });

      test('fetchRoles.rejected sets loading to false and updates error', () => {
        const mockError = { message: 'Failed to fetch roles' };
        const action = { type: fetchRoles.rejected.type, payload: mockError, error: { message: 'Failed to fetch roles'} };
        const state = roleReducer(testInitialState, action);

        expect(state.loading).toBe(false);
        expect(state.error).toEqual(mockError.message);
        expect(state.roles).toEqual(testInitialState.roles);
      });
    });

    // TODO: Add tests for fetchRoleById (pending, fulfilled, rejected)
    // TODO: Add tests for createRole (pending, fulfilled, rejected)
    // TODO: Add tests for updateRole (pending, fulfilled, rejected)
    // TODO: Add tests for deleteRole (pending, fulfilled, rejected)
  });
}); 