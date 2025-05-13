import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PermissionSelector from '../PermissionSelector';
import { PermissionItem } from '../../../types/role'; // Adjusted path

// Mock antd components used by PermissionSelector for simpler testing if needed,
// but for now, we'll test with the actual components.

// Mock constants that would be imported by PermissionSelector
// Assuming these are the structures, adjust if they are different in your actual types/role.ts
const MOCK_RESOURCE_DISPLAY_NAMES: Record<string, string> = {
  user: '使用者',
  product: '產品',
  order: '訂單',
  system: '系統',
};

const MOCK_ACTION_DISPLAY_NAMES: Record<string, string> = {
  create: '建立',
  read: '讀取',
  update: '更新',
  delete: '刪除',
  manage: '管理',
};

// Mock the module that exports these constants
jest.mock('../../../types/role', () => ({
  ...jest.requireActual('../../../types/role'), // Preserve other exports from the module
  RESOURCE_DISPLAY_NAMES: MOCK_RESOURCE_DISPLAY_NAMES,
  ACTION_DISPLAY_NAMES: MOCK_ACTION_DISPLAY_NAMES,
}));

const MOCK_AVAILABLE_PERMISSIONS: PermissionItem[] = [
  { id: 'p1', resourceType: 'user', action: 'create', name: '建立使用者', category: 'User Management' },
  { id: 'p2', resourceType: 'product', action: 'read', description: '讀取產品資訊', category: 'Inventory' },
  { id: 'p3', resourceType: 'order', action: 'update', category: 'Orders' }, // Will use display names
  { id: 'p4', resourceType: 'unknownResource', action: 'unknownAction', category: 'Other' }, // Will use raw resourceType/action
  { id: 'p5', resourceType: 'system', action: 'manage', name: '系統管理', category: 'System', conditions: { global: true } },
];

describe('PermissionSelector', () => {
  test('renders without crashing with empty props', () => {
    render(<PermissionSelector availablePermissions={[]} value={[]} onChange={jest.fn()} />);
    // Check if the main container is there
    expect(screen.getByRole('group')).toBeInTheDocument(); // Checkbox.Group has role="group"
  });

  test('displays "沒有可用的權限選項。" message when availablePermissions is empty', () => {
    render(<PermissionSelector availablePermissions={[]} value={[]} onChange={jest.fn()} />);
    expect(screen.getByText('沒有可用的權限選項。')).toBeInTheDocument();
  });

  test('renders checkboxes for each available permission', () => {
    render(<PermissionSelector availablePermissions={MOCK_AVAILABLE_PERMISSIONS} value={[]} onChange={jest.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(MOCK_AVAILABLE_PERMISSIONS.length);
  });

  test('renders correct display names for permissions', () => {
    render(<PermissionSelector availablePermissions={MOCK_AVAILABLE_PERMISSIONS} value={[]} onChange={jest.fn()} />);
    // Test based on getPermissionDisplayName logic
    expect(screen.getByText('建立使用者')).toBeInTheDocument(); // Uses name
    expect(screen.getByText('讀取產品資訊')).toBeInTheDocument(); // Uses description
    expect(screen.getByText('訂單 - 更新')).toBeInTheDocument(); // Uses mapped resource & action
    expect(screen.getByText('unknownResource - unknownAction')).toBeInTheDocument(); // Uses raw resource & action
    expect(screen.getByText('系統管理')).toBeInTheDocument(); // Uses name (overrides mapped)
  });

  test('checkboxes reflect the initial value prop', () => {
    const initialSelectedIds = ['p1', 'p3'];
    render(<PermissionSelector availablePermissions={MOCK_AVAILABLE_PERMISSIONS} value={initialSelectedIds} onChange={jest.fn()} />);
    
    const checkboxP1 = screen.getByRole('checkbox', { name: '建立使用者' });
    const checkboxP2 = screen.getByRole('checkbox', { name: '讀取產品資訊' });
    const checkboxP3 = screen.getByRole('checkbox', { name: '訂單 - 更新' });

    expect(checkboxP1).toBeChecked();
    expect(checkboxP2).not.toBeChecked();
    expect(checkboxP3).toBeChecked();
  });

  test('calls onChange with updated selected IDs when a checkbox is clicked', () => {
    const handleChange = jest.fn();
    render(<PermissionSelector availablePermissions={MOCK_AVAILABLE_PERMISSIONS} value={['p1']} onChange={handleChange} />);
    
    const checkboxP2 = screen.getByRole('checkbox', { name: '讀取產品資訊' }); // p2 is not initially selected

    fireEvent.click(checkboxP2);
    expect(handleChange).toHaveBeenCalledTimes(1);
    // Antd Checkbox.Group onChange returns an array of values of the checked checkboxes.
    // Initially ['p1'] was checked. Clicking p2 should add 'p2'.
    expect(handleChange).toHaveBeenCalledWith(expect.arrayContaining(['p1', 'p2']));
    expect(handleChange.mock.calls[0][0].length).toBe(2);


    const checkboxP1 = screen.getByRole('checkbox', { name: '建立使用者' }); // p1 is initially selected
    fireEvent.click(checkboxP1);
    expect(handleChange).toHaveBeenCalledTimes(2);
    // Clicking p1 (which was selected) should unselect it. Now only p2 should remain.
    // The value passed to onChange is based on the state *after* the click.
    // So if ['p1', 'p2'] was the state before this click, after unchecking p1, it becomes ['p2']
    expect(handleChange).toHaveBeenCalledWith(['p2']);
  });

  test('updates internal checked state and reflects in UI when checkboxes are clicked', () => {
    render(<PermissionSelector availablePermissions={MOCK_AVAILABLE_PERMISSIONS} value={[]} onChange={jest.fn()} />);
    
    const checkboxP1 = screen.getByRole('checkbox', { name: '建立使用者' });
    expect(checkboxP1).not.toBeChecked();
    fireEvent.click(checkboxP1);
    expect(checkboxP1).toBeChecked();

    fireEvent.click(checkboxP1); // Click again to uncheck
    expect(checkboxP1).not.toBeChecked();
  });

  test('updates when value prop changes externally', () => {
    const { rerender } = render(
      <PermissionSelector availablePermissions={MOCK_AVAILABLE_PERMISSIONS} value={['p1']} onChange={jest.fn()} />
    );
    
    const checkboxP1 = screen.getByRole('checkbox', { name: '建立使用者' });
    const checkboxP2 = screen.getByRole('checkbox', { name: '讀取產品資訊' });

    expect(checkboxP1).toBeChecked();
    expect(checkboxP2).not.toBeChecked();

    rerender(
      <PermissionSelector availablePermissions={MOCK_AVAILABLE_PERMISSIONS} value={['p2']} onChange={jest.fn()} />
    );

    // Need to re-query elements after rerender if their state might change due to props
    const updatedCheckboxP1 = screen.getByRole('checkbox', { name: '建立使用者' });
    const updatedCheckboxP2 = screen.getByRole('checkbox', { name: '讀取產品資訊' });

    expect(updatedCheckboxP1).not.toBeChecked();
    expect(updatedCheckboxP2).toBeChecked();
  });
}); 