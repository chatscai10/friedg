import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event'; // For Select interaction

import RoleFormModal from '../RoleFormModal';
import { Role, RoleScope, PermissionItem, ROLE_SCOPES } from '../../../types/role';
import { TenantItem } from '../../../types/tenant';
import { Store } from '../../../types/store';

// Mock the PermissionSelector child component to allow prop checking
const mockPermissionSelectorComponent = jest.fn((props) => <div data-testid="mocked-permission-selector" data-value={JSON.stringify(props.value)}>Mocked PermissionSelector</div>);
jest.mock('../PermissionSelector', () => (props: any) => mockPermissionSelectorComponent(props));

const mockOnCancel = jest.fn();
const mockOnOk = jest.fn();
const mockClearCreateError = jest.fn();
const mockClearUpdateError = jest.fn();
const mockClearTenantsError = jest.fn();
const mockOnTenantChange = jest.fn();
const mockClearStoresError = jest.fn();


const defaultPermissions: PermissionItem[] = [
  { id: 'perm1', name: 'Perm 1', resourceType: 'test', action: 'create', category: 'Test' },
  { id: 'perm2', name: 'Perm 2', resourceType: 'test', action: 'read', category: 'Test' },
  { id: 'perm3', name: 'Perm 3', resourceType: 'test', action: 'update', category: 'Test' },
];

const defaultTenants: TenantItem[] = [
  { id: 'tenant1', name: 'Tenant 1' },
  { id: 'tenant2', name: 'Tenant 2' },
];

const defaultStores: Store[] = [
  { id: 'store1', tenantId: 'tenant1', name: 'Store 1', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'store2', tenantId: 'tenant1', name: 'Store 2', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'store3', tenantId: 'tenant2', name: 'Store 3', status: 'active', createdAt: '', updatedAt: '' },
];


const defaultProps: React.ComponentProps<typeof RoleFormModal> = {
  visible: true,
  onCancel: mockOnCancel,
  onOk: mockOnOk,
  initialData: null,
  allPermissions: defaultPermissions,
  isLoading: false,
  allPermissionsLoading: false,
  allPermissionsError: null,
  createError: null,
  updateError: null,
  clearCreateError: mockClearCreateError,
  clearUpdateError: mockClearUpdateError,
  okButtonProps: {},
  tenantsList: defaultTenants,
  tenantsLoading: false,
  tenantsError: null,
  clearTenantsError: mockClearTenantsError,
  onTenantChange: mockOnTenantChange,
  storesList: defaultStores,
  storesLoading: false,
  storesError: null,
  clearStoresError: mockClearStoresError,
};

// Helper to render with Ant Design Form context
const renderWithForm = (ui: React.ReactElement, props?: Partial<React.ComponentProps<typeof RoleFormModal>>) => {
  // Reset mock call counts for PermissionSelector for each render if needed, or manage globally in beforeEach
  mockPermissionSelectorComponent.mockClear(); 
  return render(<RoleFormModal {...defaultProps} {...props} />);
};


describe('RoleFormModal', () => {
  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
    mockPermissionSelectorComponent.mockClear(); // Clear calls to the mocked component itself
  });

  describe('Modal Visibility', () => {
    test('renders modal when visible is true', () => {
      renderWithForm(<RoleFormModal {...defaultProps} visible={true} />);
      // Ant Design Modal has role "dialog"
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('創建新角色')).toBeInTheDocument(); // Default title for create mode
      expect(screen.getByLabelText('角色名稱')).toBeInTheDocument();
    });

    test('does not render modal content when visible is false', async () => {
      renderWithForm(<RoleFormModal {...defaultProps} visible={false} />);
      // When Modal is not visible, its content (including the dialog role) should not be present.
      // Note: Modal might still render a placeholder div. We check for a key element.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Modal Title', () => {
    test('displays "創建新角色" title when initialData is not provided', () => {
      renderWithForm(<RoleFormModal {...defaultProps} initialData={null} />);
      expect(screen.getByText('創建新角色')).toBeInTheDocument();
    });

    test('displays "編輯角色" title when initialData is provided', () => {
      const mockRole: Role = {
        roleId: 'role1',
        roleName: 'Editor Role',
        scope: RoleScope.TENANT,
        permissions: [],
        isSystemRole: false,
        status: 'active',
        tenantId: 'tenant1',
        roleLevel: 2
      };
      renderWithForm(<RoleFormModal {...defaultProps} initialData={mockRole} />);
      expect(screen.getByText('編輯角色')).toBeInTheDocument();
    });
  });

  describe('Form Initial Values (Create Mode)', () => {
    test('sets default scope to TENANT and status to active in create mode', async () => {
      renderWithForm(<RoleFormModal {...defaultProps} initialData={null} visible={true} />);
      
      await waitFor(() => {
        expect(screen.getByText(ROLE_SCOPES.find(s => s.value === RoleScope.TENANT)!.label)).toBeInTheDocument();
      });
      
      await waitFor(() => {
          expect(screen.getByText('啟用')).toBeInTheDocument(); // Label for 'active'
      });
    });

     test('PermissionSelector mock is rendered in create mode', () => {
      renderWithForm(<RoleFormModal {...defaultProps} visible={true} />);
      expect(screen.getByTestId('mocked-permission-selector')).toBeInTheDocument();
      expect(screen.getByText('Mocked PermissionSelector')).toBeInTheDocument();
      expect(mockPermissionSelectorComponent).toHaveBeenCalledWith(expect.objectContaining({
        value: [], // Default empty for create mode
        availablePermissions: defaultPermissions
      }));
    });
  });

  describe('Form Initial Values (Edit Mode)', () => {
    const mockEditingRole: Role = {
      roleId: 'edit-role-123',
      roleName: 'Super Editor',
      description: 'This role can edit many things',
      scope: RoleScope.STORE,
      roleLevel: 3,
      permissions: ['perm1', 'perm3'], // Array of permission IDs
      isSystemRole: false,
      status: 'inactive',
      tenantId: 'tenant2',
      storeId: 'store3',
      // createdBy, createdAt, etc. are not usually part of form values directly
    };

    test('populates form fields with initialData in edit mode', async () => {
      renderWithForm(<RoleFormModal {...defaultProps} initialData={mockEditingRole} visible={true} />);

      // Input fields
      expect(screen.getByDisplayValue(mockEditingRole.roleName)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockEditingRole.description!)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockEditingRole.roleLevel!.toString())).toBeInTheDocument();

      // Select fields - check displayed text
      await waitFor(() => {
        expect(screen.getByText(ROLE_SCOPES.find(s => s.value === mockEditingRole.scope)!.label)).toBeInTheDocument();
      });
      await waitFor(() => {
        // Status: inactive should display "禁用" (assuming these are your labels)
        // Need to ensure the label mapping for 'inactive' is known or check by value if Select allows
        expect(screen.getByText('禁用')).toBeInTheDocument(); 
      });
      await waitFor(() => {
        expect(screen.getByText(defaultTenants.find(t => t.id === mockEditingRole.tenantId)!.name)).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByText(defaultStores.find(s => s.id === mockEditingRole.storeId)!.name)).toBeInTheDocument();
      });

      // Check PermissionSelector props
      expect(mockPermissionSelectorComponent).toHaveBeenCalledTimes(1);
      expect(mockPermissionSelectorComponent).toHaveBeenCalledWith(expect.objectContaining({
        value: mockEditingRole.permissions, // Should be ['perm1', 'perm3']
        availablePermissions: defaultProps.allPermissions,
      }));
    });
  });

  describe('Conditional Rendering of TenantId and StoreId based on Scope (Edit Mode with initialData)', () => {
    test('does not render TenantId or StoreId fields when scope is GLOBAL', () => {
      const globalRole: Role = {
        roleId: 'global-role',
        roleName: 'Global Admin',
        scope: RoleScope.GLOBAL,
        permissions: [],
        roleLevel: 1,
        isSystemRole: true,
        status: 'active'
      };
      renderWithForm(<RoleFormModal {...defaultProps} initialData={globalRole} visible={true} />);
      expect(screen.queryByLabelText('租戶')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('店鋪')).not.toBeInTheDocument();
    });

    test('renders TenantId but not StoreId field when scope is TENANT', () => {
      const tenantRole: Role = {
        roleId: 'tenant-role',
        roleName: 'Tenant Manager',
        scope: RoleScope.TENANT,
        permissions: [],
        roleLevel: 2,
        tenantId: 'tenant1',
        isSystemRole: false,
        status: 'active'
      };
      renderWithForm(<RoleFormModal {...defaultProps} initialData={tenantRole} visible={true} />);
      expect(screen.getByLabelText('租戶')).toBeInTheDocument();
      expect(screen.queryByLabelText('店鋪')).not.toBeInTheDocument();
    });

    test('renders both TenantId and StoreId fields when scope is STORE', () => {
      const storeRole: Role = {
        roleId: 'store-role',
        roleName: 'Store Supervisor',
        scope: RoleScope.STORE,
        permissions: [],
        roleLevel: 3,
        tenantId: 'tenant1',
        storeId: 'store1',
        isSystemRole: false,
        status: 'active'
      };
      renderWithForm(<RoleFormModal {...defaultProps} initialData={storeRole} visible={true} />);
      expect(screen.getByLabelText('租戶')).toBeInTheDocument();
      expect(screen.getByLabelText('店鋪')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    describe('Scope Select Interaction and Conditional Rendering', () => {
      test('initially renders TenantId when scope defaults to TENANT, StoreId is hidden', async () => {
        renderWithForm(<RoleFormModal {...defaultProps} initialData={null} visible={true} />); 
        await waitFor(() => {
          expect(screen.getByLabelText('租戶')).toBeInTheDocument();
        });
        expect(screen.queryByLabelText('店鋪')).not.toBeInTheDocument();
      });

      test('changing scope to STORE shows TenantId and StoreId fields', async () => {
        const user = userEvent.setup();
        renderWithForm(<RoleFormModal {...defaultProps} initialData={null} visible={true} />); 
        
        // Default is TENANT, StoreId hidden
        await waitFor(() => expect(screen.getByLabelText('租戶')).toBeInTheDocument());
        expect(screen.queryByLabelText('店鋪')).not.toBeInTheDocument();

        // Click the scope select to open it
        const scopeSelect = screen.getByLabelText('角色範圍').closest('.ant-form-item-control-input-content')!.querySelector('.ant-select-selector');
        expect(scopeSelect).toBeInTheDocument();
        await user.click(scopeSelect!);

        // Select 'Store' scope (assuming ROLE_SCOPES has a label for STORE)
        const storeScopeLabel = ROLE_SCOPES.find(s => s.value === RoleScope.STORE)!.label;
        await user.click(screen.getByText(storeScopeLabel));
        
        await waitFor(() => {
          expect(screen.getByLabelText('租戶')).toBeInTheDocument();
          expect(screen.getByLabelText('店鋪')).toBeInTheDocument();
        });
      });

      test('changing scope to GLOBAL hides TenantId and StoreId fields', async () => {
        const user = userEvent.setup();
        // Start with STORE scope so fields are initially visible
        const initialRoleWithStoreScope: Role = {
          roleId: 'test-store', roleName: 'Test Store Role', permissions: [],
          scope: RoleScope.STORE, tenantId: 'tenant1', storeId: 'store1', status: 'active', roleLevel:1
        };
        renderWithForm(<RoleFormModal {...defaultProps} initialData={initialRoleWithStoreScope} visible={true} />); 

        await waitFor(() => {
          expect(screen.getByLabelText('租戶')).toBeInTheDocument();
          expect(screen.getByLabelText('店鋪')).toBeInTheDocument();
        });

        const scopeSelect = screen.getByLabelText('角色範圍').closest('.ant-form-item-control-input-content')!.querySelector('.ant-select-selector');
        await user.click(scopeSelect!);
        
        const globalScopeLabel = ROLE_SCOPES.find(s => s.value === RoleScope.GLOBAL)!.label;
        await user.click(screen.getByText(globalScopeLabel));

        await waitFor(() => {
          expect(screen.queryByLabelText('租戶')).not.toBeInTheDocument();
          expect(screen.queryByLabelText('店鋪')).not.toBeInTheDocument();
        });
      });

      test('changing scope back to TENANT from GLOBAL shows TenantId and hides StoreId', async () => {
        const user = userEvent.setup();
        const initialRoleWithGlobalScope: Role = {
            roleId: 'test-global', roleName: 'Test Global Role', permissions: [],
            scope: RoleScope.GLOBAL, status: 'active', roleLevel:1
        };
        renderWithForm(<RoleFormModal {...defaultProps} initialData={initialRoleWithGlobalScope} visible={true} />); 
        
        await waitFor(() => {
            expect(screen.queryByLabelText('租戶')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('店鋪')).not.toBeInTheDocument();
        });

        const scopeSelect = screen.getByLabelText('角色範圍').closest('.ant-form-item-control-input-content')!.querySelector('.ant-select-selector');
        await user.click(scopeSelect!);

        const tenantScopeLabel = ROLE_SCOPES.find(s => s.value === RoleScope.TENANT)!.label;
        await user.click(screen.getByText(tenantScopeLabel));

        await waitFor(() => {
          expect(screen.getByLabelText('租戶')).toBeInTheDocument();
          expect(screen.queryByLabelText('店鋪')).not.toBeInTheDocument();
        });
      });
    });

    describe('TenantId Select Interaction', () => {
      const initialRoleWithStoreScope: Role = {
        roleId: 'test-store-for-tenant-change', roleName: 'Test Role For Tenant Change', permissions: [],
        scope: RoleScope.STORE, tenantId: 'tenant1', storeId: 'store1', status: 'active', roleLevel: 1
      };

      test('selecting a tenant calls onTenantChange and clears storeId field value', async () => {
        const user = userEvent.setup();
        renderWithForm(<RoleFormModal {...defaultProps} initialData={initialRoleWithStoreScope} visible={true} />); 

        // Ensure fields are visible
        await waitFor(() => {
          expect(screen.getByLabelText('租戶')).toBeInTheDocument();
          expect(screen.getByLabelText('店鋪')).toBeInTheDocument();
        });
        // Initial store should be selected
        await waitFor(() => {
            expect(screen.getByText(defaultStores.find(s => s.id === initialRoleWithStoreScope.storeId)!.name)).toBeInTheDocument();
        });

        mockOnTenantChange.mockClear(); // Clear before interaction

        const tenantSelect = screen.getByLabelText('租戶').closest('.ant-form-item-control-input-content')!.querySelector('.ant-select-selector');
        await user.click(tenantSelect!);
        
        const tenantToSelect = defaultTenants.find(t => t.id === 'tenant2')!;
        await user.click(screen.getByText(tenantToSelect.name));

        expect(mockOnTenantChange).toHaveBeenCalledTimes(1);
        expect(mockOnTenantChange).toHaveBeenCalledWith(tenantToSelect.id);

        // After tenant changes, storeId field should be cleared (its value, not the field itself hidden)
        // This is hard to test directly by its displayed value if it becomes an empty select with placeholder.
        // We'll test this more robustly when we test form submission. 
        // For now, we assume the `form.setFieldsValue({ storeId: undefined });` works as intended by antd.
        // However, if there was a placeholder, we could check for that.
        // Let's assume the antd Select, when value is undefined, shows the placeholder.
        // The placeholder for StoreId might be "請選擇店鋪"
        const storeSelect = screen.getByLabelText('店鋪').closest('.ant-select');
        await waitFor(() => {
            // This test is a bit fragile as it depends on the placeholder text.
            // A more robust test would involve submitting the form and checking the values.
            // Or, if the Select component had a way to directly get its current antd form value for testing.
            const storePlaceholder = storeSelect?.querySelector('.ant-select-selection-placeholder');
            expect(storePlaceholder).toBeInTheDocument();
            expect(storePlaceholder).toHaveTextContent('請選擇店鋪');
        });
      });

      // Test for clearing tenant selection (if allowClear is true on Tenant Select)
      // This test assumes the Tenant Select has `allowClear` and that clearing it calls onTenantChange with undefined.
      // The RoleFormModal.tsx shows tenantId Select does have `allowClear`.
      test('clearing tenant selection calls onTenantChange with undefined and clears storeId', async () => {
        const user = userEvent.setup();
        // Start with a tenant and store selected
        renderWithForm(<RoleFormModal {...defaultProps} initialData={initialRoleWithStoreScope} visible={true} />); 

        await waitFor(() => {
          expect(screen.getByText(defaultTenants.find(t => t.id === initialRoleWithStoreScope.tenantId)!.name)).toBeInTheDocument();
          expect(screen.getByText(defaultStores.find(s => s.id === initialRoleWithStoreScope.storeId)!.name)).toBeInTheDocument();
        });
        
        mockOnTenantChange.mockClear();

        // Click the clear icon on the Tenant Select
        // The clear icon usually has a role or specific class, e.g., .ant-select-clear
        const tenantSelectContainer = screen.getByLabelText('租戶').closest('.ant-select');
        const clearIcon = tenantSelectContainer?.querySelector('.ant-select-clear');
        expect(clearIcon).toBeInTheDocument(); // Ensure clear icon is present
        
        await user.click(clearIcon!);

        expect(mockOnTenantChange).toHaveBeenCalledTimes(1);
        expect(mockOnTenantChange).toHaveBeenCalledWith(undefined);
        
        const storeSelect = screen.getByLabelText('店鋪').closest('.ant-select');
        await waitFor(() => {
            const storePlaceholder = storeSelect?.querySelector('.ant-select-selection-placeholder');
            expect(storePlaceholder).toBeInTheDocument();
            expect(storePlaceholder).toHaveTextContent('請選擇店鋪');
        });
      });
    });
  });

  describe('Data Loading and Error States Display', () => {
    describe('Permissions Data', () => {
      test('shows loading spinner for permissions and hides selector when allPermissionsLoading is true', () => {
        renderWithForm(<RoleFormModal {...defaultProps} visible={true} allPermissionsLoading={true} />);
        expect(screen.getByText('權限數據加載中...')).toBeInTheDocument(); // Based on Spin tip in RoleFormModal
        expect(screen.queryByTestId('mocked-permission-selector')).not.toBeInTheDocument();
      });

      test('shows error alert for permissions and hides selector when allPermissionsError is present', () => {
        const errorMsg = '權限加載出錯啦';
        renderWithForm(<RoleFormModal {...defaultProps} visible={true} allPermissionsError={errorMsg} />);
        expect(screen.getByText(`加載權限列表失敗: ${errorMsg}`)).toBeInTheDocument(); // Based on Alert message in RoleFormModal
        expect(screen.queryByTestId('mocked-permission-selector')).not.toBeInTheDocument();
      });
    });

    describe('Tenants Data', () => {
      const propsForTenantVisible = { initialData: { ...defaultProps.initialData, scope: RoleScope.TENANT } as Role, visible: true };

      test('shows loading spinner for tenants when tenantsLoading is true and scope requires tenant', () => {
        renderWithForm(<RoleFormModal {...defaultProps} {...propsForTenantVisible} tenantsLoading={true} />);
        // Assuming tenantId Form.Item is directly under a div or identifiable container
        const tenantFormItem = screen.getByLabelText('租戶').closest('.ant-form-item');
        expect(tenantFormItem).toBeInTheDocument();
        expect(within(tenantFormItem!).getByText('租戶列表加載中...')).toBeInTheDocument();
      });

      test('shows error alert for tenants when tenantsError is present and scope requires tenant', async () => {
        const user = userEvent.setup();
        const errorMsg = '租戶列表加載出錯啦';
        const clearErrorMock = jest.fn();
        renderWithForm(<RoleFormModal {...defaultProps} {...propsForTenantVisible} tenantsError={errorMsg} clearTenantsError={clearErrorMock} />);
        
        const tenantFormItem = screen.getByLabelText('租戶').closest('.ant-form-item');
        expect(tenantFormItem).toBeInTheDocument();
        const alertMessage = within(tenantFormItem!).getByText(`加載租戶列表失敗: ${errorMsg}`);
        expect(alertMessage).toBeInTheDocument();
        
        // Test closable alert
        const closeButton = alertMessage.closest('.ant-alert')?.querySelector('.ant-alert-close-icon');
        expect(closeButton).toBeInTheDocument();
        await user.click(closeButton!);
        expect(clearErrorMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('Stores Data', () => {
      const basePropsForStoreVisible: Partial<React.ComponentProps<typeof RoleFormModal>> = {
        initialData: { 
          ...defaultProps.initialData, 
          scope: RoleScope.STORE,
          tenantId: 'tenant1', // Pre-select a tenant
        } as Role,
        visible: true,
      };

      test('shows loading spinner for stores when storesLoading is true and scope is STORE with tenant selected', () => {
        renderWithForm(<RoleFormModal {...defaultProps} {...basePropsForStoreVisible} storesLoading={true} />);
        const storeFormItem = screen.getByLabelText('店鋪').closest('.ant-form-item');
        expect(storeFormItem).toBeInTheDocument();
        expect(within(storeFormItem!).getByText('店鋪列表加載中...')).toBeInTheDocument();
      });

      test('shows error alert for stores when storesError is present and scope is STORE with tenant selected', async () => {
        const user = userEvent.setup();
        const errorMsg = '店鋪列表加載出錯啦';
        const clearErrorMock = jest.fn();
        renderWithForm(<RoleFormModal {...defaultProps} {...basePropsForStoreVisible} storesError={errorMsg} clearStoresError={clearErrorMock} />); 
        
        const storeFormItem = screen.getByLabelText('店鋪').closest('.ant-form-item');
        expect(storeFormItem).toBeInTheDocument();
        const alertMessage = within(storeFormItem!).getByText(`加載店鋪列表失敗: ${errorMsg}`);
        expect(alertMessage).toBeInTheDocument();

        const closeButton = alertMessage.closest('.ant-alert')?.querySelector('.ant-alert-close-icon');
        expect(closeButton).toBeInTheDocument();
        await user.click(closeButton!);
        expect(clearErrorMock).toHaveBeenCalledTimes(1);
      });

      test('shows "Please select a tenant" alert for stores when scope is STORE and no tenant is selected', () => {
        const propsNoTenantSelected: Partial<React.ComponentProps<typeof RoleFormModal>> = {
          initialData: { 
            ...defaultProps.initialData, 
            scope: RoleScope.STORE,
            tenantId: undefined, // No tenant selected
          } as Role,
          visible: true,
        };
        renderWithForm(<RoleFormModal {...defaultProps} {...propsNoTenantSelected} />); 
        const storeFormItem = screen.getByLabelText('店鋪').closest('.ant-form-item');
        expect(storeFormItem).toBeInTheDocument();
        expect(within(storeFormItem!).getByText('請先選擇一個租戶以加載店鋪列表。')).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission, Validation and Cancellation', () => {
    test('calls onOk with form values when form is valid and submitted (Create Mode)', async () => {
      const user = userEvent.setup();
      renderWithForm(<RoleFormModal {...defaultProps} initialData={null} visible={true} />); 

      const roleNameInput = screen.getByLabelText('角色名稱');
      const roleLevelInput = screen.getByLabelText('角色等級');
      // Scope Select (default is TENANT, which is fine)
      const scopeSelectAnt = screen.getByLabelText('角色範圍').closest('.ant-form-item-control-input-content')!.querySelector('.ant-select-selector');
      // Status Select (default is active, which is fine)
      const statusSelectAnt = screen.getByLabelText('角色狀態').closest('.ant-form-item-control-input-content')!.querySelector('.ant-select-selector');
      // Tenant Select (visible because default scope is TENANT)
      const tenantSelectAnt = screen.getByLabelText('租戶').closest('.ant-form-item-control-input-content')!.querySelector('.ant-select-selector');

      await user.type(roleNameInput, '新測試角色');
      await user.type(roleLevelInput, '10');
      
      // Select a tenant (since scope is TENANT by default)
      await user.click(tenantSelectAnt!);
      await user.click(screen.getByText(defaultTenants[0].name)); // Select first tenant

      // For permissions, since it's mocked and not directly part of AntD form's required fields unless explicitly set by <Form.Item rules>,
      // we assume the form can be submitted without interacting with the mocked PermissionSelector if its Form.Item has no rules.
      // The `value` for permissions in the form will be what `PermissionSelector` provides via `onChange`, 
      // or the initial value from `initialData` or form.setFieldsValue.
      // In this create mode test, it will default to empty array [] as set by form.resetFields() and initial mock.

      const createButton = screen.getByRole('button', { name: '創建' }); // Or '確定' depending on AntD version/locale
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnOk).toHaveBeenCalledTimes(1);
      });
      
      expect(mockOnOk).toHaveBeenCalledWith(expect.objectContaining({
        roleName: '新測試角色',
        scope: RoleScope.TENANT, // Default scope
        roleLevel: 10, // AntD form might pass it as number if type="number" and transform works
        status: 'active',    // Default status
        tenantId: defaultTenants[0].id,
        permissions: [], // From mock, as it is not interacted with to change its value
      }));
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    test('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithForm(<RoleFormModal {...defaultProps} visible={true} />);
      
      const cancelButton = screen.getByRole('button', { name: '取消' });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnOk).not.toHaveBeenCalled();
    });

    test('does not call onOk and shows validation error if required field (roleName) is empty', async () => {
      const user = userEvent.setup();
      renderWithForm(<RoleFormModal {...defaultProps} initialData={null} visible={true} />); 
      
      // Do not fill roleName
      const roleLevelInput = screen.getByLabelText('角色等級');
      await user.type(roleLevelInput, '5');
       // Select a tenant (since scope is TENANT by default)
      const tenantSelectAnt = screen.getByLabelText('租戶').closest('.ant-form-item-control-input-content')!.querySelector('.ant-select-selector');
      await user.click(tenantSelectAnt!);
      await user.click(screen.getByText(defaultTenants[0].name));

      const createButton = screen.getByRole('button', { name: '創建' });
      await user.click(createButton);

      expect(mockOnOk).not.toHaveBeenCalled();
      // Check for Ant Design's validation error message
      expect(await screen.findByText('請輸入角色名稱!')).toBeInTheDocument();
    });

    test('does not call onOk and shows validation error if roleLevel is invalid', async () => {
        const user = userEvent.setup();
        renderWithForm(<RoleFormModal {...defaultProps} initialData={null} visible={true} />); 
        
        const roleNameInput = screen.getByLabelText('角色名稱');
        await user.type(roleNameInput, 'Another Role');
        // Do not fill roleLevel or provide an invalid one according to rules

        // Select a tenant (since scope is TENANT by default)
        const tenantSelectAnt = screen.getByLabelText('租戶').closest('.ant-form-item-control-input-content')!.querySelector('.ant-select-selector');
        await user.click(tenantSelectAnt!);
        await user.click(screen.getByText(defaultTenants[0].name));
  
        const createButton = screen.getByRole('button', { name: '創建' });
        await user.click(createButton);
  
        expect(mockOnOk).not.toHaveBeenCalled();
        expect(await screen.findByText('請輸入角色等級!')).toBeInTheDocument(); 
        // Or, if a value is entered that violates min:1, e.g. 0
        // const roleLevelInput = screen.getByLabelText('角色等級');
        // await user.type(roleLevelInput, '0');
        // await user.click(createButton);
        // expect(await screen.findByText('角色等級必須大於0')).toBeInTheDocument();
      });

  });

}); 