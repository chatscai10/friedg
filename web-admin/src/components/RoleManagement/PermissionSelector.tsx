import React, { useState, useEffect } from 'react';
import { Checkbox, Typography, Space } from 'antd';
import type { CheckboxValueType } from 'antd/es/checkbox/Group';
import {
  PermissionItem,
  RESOURCE_DISPLAY_NAMES,
  ACTION_DISPLAY_NAMES,
} from '../../types/role';

const { Text } = Typography;

interface PermissionSelectorProps {
  availablePermissions: PermissionItem[];
  value?: string[];
  onChange?: (newSelectedPermissions: string[]) => void;
}

const PermissionSelector: React.FC<PermissionSelectorProps> = ({
  availablePermissions,
  value = [],
  onChange,
}) => {
  const [checkedList, setCheckedList] = useState<string[]>(value);

  useEffect(() => {
    setCheckedList(value);
  }, [value]);

  const handleCheckboxGroupChange = (list: CheckboxValueType[]) => {
    const newSelectedIds = list as string[];
    setCheckedList(newSelectedIds);
    if (onChange) {
      onChange(newSelectedIds);
    }
  };

  const getPermissionDisplayName = (permission: PermissionItem): string => {
    if (permission.name) return permission.name;
    if (permission.description) return permission.description;

    const translatedResourceType = RESOURCE_DISPLAY_NAMES[permission.resourceType];
    const translatedAction = ACTION_DISPLAY_NAMES[permission.action];

    if (translatedResourceType && translatedAction) {
      return `${translatedResourceType} - ${translatedAction}`;
    } else if (translatedResourceType) {
      return `${translatedResourceType} - ${permission.action}`;
    } else if (translatedAction) {
      return `${permission.resourceType} - ${translatedAction}`;
    }

    return `${permission.resourceType} - ${permission.action}`;
  };

  return (
    <div>
      <Checkbox.Group
        style={{ width: '100%' }}
        value={checkedList}
        onChange={handleCheckboxGroupChange}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {availablePermissions.map((permission) => (
            <Checkbox key={permission.id} value={permission.id}>
              {getPermissionDisplayName(permission)}
            </Checkbox>
          ))}
          {availablePermissions.length === 0 && (
            <Text type="secondary">沒有可用的權限選項。</Text>
          )}
        </Space>
      </Checkbox.Group>
    </div>
  );
};

export default PermissionSelector; 