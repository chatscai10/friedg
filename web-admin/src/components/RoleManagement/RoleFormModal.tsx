import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Spin, Alert as AntAlert, Space } from 'antd';
import { Role, RoleScope, PermissionItem, ROLE_SCOPES } from '../../types/role';
import { TenantItem } from '../../types/tenant';
import { Store } from '../../types/store';
import PermissionSelector from './PermissionSelector';

const { Option } = Select;

interface RoleFormValues {
  roleName: string;
  description?: string;
  scope: RoleScope;
  roleLevel?: number;
  permissions: string[];
  tenantId?: string;
  storeId?: string;
  status?: 'active' | 'inactive';
}

interface RoleFormModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (values: RoleFormValues) => void;
  initialData?: Role | null;
  allPermissions: PermissionItem[];
  isLoading?: boolean;
  allPermissionsLoading?: boolean;
  allPermissionsError?: string | null;
  createError?: string | null;
  updateError?: string | null;
  clearCreateError?: () => void;
  clearUpdateError?: () => void;
  okButtonProps?: { disabled?: boolean };
  tenantsList?: TenantItem[];
  tenantsLoading?: boolean;
  tenantsError?: string | null;
  clearTenantsError?: () => void;
  onTenantChange?: (tenantId?: string) => void;
  storesList?: Store[];
  storesLoading?: boolean;
  storesError?: string | null;
  clearStoresError?: () => void;
}

const RoleFormModal: React.FC<RoleFormModalProps> = ({
  visible,
  onCancel,
  onOk,
  initialData,
  allPermissions,
  isLoading = false,
  allPermissionsLoading = false,
  allPermissionsError = null,
  createError,
  updateError,
  clearCreateError,
  clearUpdateError,
  okButtonProps,
  tenantsList = [],
  tenantsLoading = false,
  tenantsError = null,
  clearTenantsError,
  onTenantChange,
  storesList = [],
  storesLoading = false,
  storesError = null,
  clearStoresError,
}) => {
  const [form] = Form.useForm<RoleFormValues>();
  const watchedScope = Form.useWatch('scope', form);

  useEffect(() => {
    if (visible) {
      if (initialData) {
        form.setFieldsValue({
          ...initialData,
          permissions: initialData.permissions ? initialData.permissions.map(p => typeof p === 'string' ? p : p.id) : [],
          roleLevel: initialData.roleLevel ?? undefined,
          status: initialData.status || 'active',
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ scope: RoleScope.TENANT, status: 'active' });
      }
    }
  }, [initialData, visible, form]);

  useEffect(() => {
    if (!visible) return;

    const currentValues = form.getFieldsValue();
    if (watchedScope === RoleScope.GLOBAL) {
      if (currentValues.tenantId || currentValues.storeId) {
        form.setFieldsValue({ tenantId: undefined, storeId: undefined });
      }
    } else if (watchedScope === RoleScope.TENANT) {
      if (currentValues.storeId) {
        form.setFieldsValue({ storeId: undefined });
      }
    }
    if (createError && clearCreateError) {
      clearCreateError();
    }
    if (updateError && clearUpdateError) {
      clearUpdateError();
    }
  }, [watchedScope, form, visible, initialData, createError, updateError, clearCreateError, clearUpdateError]);

  const handleOk = () => {
    form
      .validateFields()
      .then((values: RoleFormValues) => {
        const finalValues = { ...values };
        if (values.scope === RoleScope.GLOBAL) {
          delete finalValues.tenantId;
          delete finalValues.storeId;
        } else if (values.scope === RoleScope.TENANT) {
          delete finalValues.storeId;
        }
        onOk(finalValues);
      })
      .catch((info) => {
        console.log('Validate Failed:', info);
      });
  };

  const isOkButtonLoading = isLoading || allPermissionsLoading || tenantsLoading || storesLoading;
  const isOkButtonDisabled = okButtonProps?.disabled || !!allPermissionsError || allPermissionsLoading;

  return (
    <Modal
      title={initialData ? '編輯角色' : '創建新角色'}
      visible={visible}
      onOk={handleOk}
      onCancel={onCancel}
      okText={initialData ? '保存' : '創建'}
      cancelText="取消"
      confirmLoading={isOkButtonLoading}
      okButtonProps={{ disabled: isOkButtonDisabled }}
      destroyOnClose
      width={720}
      maskClosable={false}
    >
      <Form form={form} layout="vertical" name="role_form_in_modal">
        {createError && (
          <Form.Item>
            <AntAlert
              message={`創建角色失敗: ${createError}`}
              type="error"
              showIcon
              closable
              onClose={clearCreateError}
              style={{ marginBottom: 16 }}
            />
          </Form.Item>
        )}
        {updateError && (
          <Form.Item>
            <AntAlert
              message={`更新角色失敗: ${updateError}`}
              type="error"
              showIcon
              closable
              onClose={clearUpdateError}
              style={{ marginBottom: 16 }}
            />
          </Form.Item>
        )}

        <Form.Item
          name="roleName"
          label="角色名稱"
          rules={[{ required: true, message: '請輸入角色名稱!' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label="角色描述">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item
          name="scope"
          label="角色範圍"
          rules={[{ required: true, message: '請選擇角色範圍!' }]}
        >
          <Select placeholder="請選擇角色範圍">
            {ROLE_SCOPES.map(s => (
              <Option key={s.value} value={s.value}>{s.label}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          name="roleLevel"
          label="角色等級"
          rules={[
            { required: true, message: '請輸入角色等級!' },
            { type: 'number', min: 1, message: '角色等級必須大於0', transform: value => Number(value) }
           ]}
          help="數字越小權限越高，例如 1 為最高權限"
        >
          <Input type="number" />
        </Form.Item>
        <Form.Item
          name="status"
          label="角色狀態"
          rules={[{ required: true, message: '請選擇角色狀態!' }]}
        >
          <Select placeholder="請選擇角色狀態">
            <Option value="active">啟用</Option>
            <Option value="inactive">禁用</Option>
          </Select>
        </Form.Item>

        {(watchedScope === RoleScope.TENANT || watchedScope === RoleScope.STORE) && (
          <Form.Item
            name="tenantId"
            label="租戶"
            rules={[{ required: watchedScope !== RoleScope.GLOBAL, message: '請選擇租戶!' }]}
          >
            {tenantsLoading ? (
              <div style={{ textAlign: 'center' }}><Spin tip="租戶列表加載中..." /></div>
            ) : tenantsError ? (
              <AntAlert
                message={`加載租戶列表失敗: ${tenantsError}`}
                type="error"
                showIcon
                closable
                onClose={clearTenantsError}
              />
            ) : (
              <Select
                placeholder="請選擇租戶"
                disabled={!watchedScope || (watchedScope !== RoleScope.TENANT && watchedScope !== RoleScope.STORE)}
                allowClear
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) => 
                  (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                }
                onChange={(value) => {
                  onTenantChange?.(value);
                  form.setFieldsValue({ storeId: undefined });
                }}
              >
                {tenantsList && tenantsList.length > 0 ? (
                  tenantsList.map(tenant => (
                    <Option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </Option>
                  ))
                ) : (
                  <Option value="" disabled>無可用租戶</Option>
                )}
              </Select>
            )}
          </Form.Item>
        )}

        {watchedScope === RoleScope.STORE && (
          <Form.Item
            label="店鋪"
            rules={[{ required: watchedScope === RoleScope.STORE, message: '請選擇店鋪!' }]}
          >
            {(!form.getFieldValue('tenantId') && watchedScope === RoleScope.STORE) ? (
              <AntAlert message="請先選擇一個租戶以加載店鋪列表。" type="info" showIcon />
            ) : storesLoading ? (
              <div style={{ textAlign: 'center' }}><Spin tip="店鋪列表加載中..." /></div>
            ) : storesError ? (
              <AntAlert
                message={`加載店鋪列表失敗: ${storesError}`}
                type="error"
                showIcon
                closable
                onClose={clearStoresError}
              />
            ) : (
              <Form.Item 
                name="storeId"
                noStyle
                rules={[{ required: watchedScope === RoleScope.STORE, message: '請選擇店鋪!' }]}
              >
                <Select
                  placeholder="請選擇店鋪"
                  disabled={!form.getFieldValue('tenantId') || storesLoading || !!storesError}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) => 
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {storesList && storesList.length > 0 ? (
                    storesList.map(store => (
                      <Option key={store.id} value={store.id}>
                        {store.name} (ID: {store.id})
                      </Option>
                    ))
                  ) : (
                    <Option value="" disabled>
                      {form.getFieldValue('tenantId') ? '此租戶下無可用店鋪' : '請先選擇租戶'}
                    </Option>
                  )}
                </Select>
              </Form.Item>
            )}
          </Form.Item>
        )}

        <Form.Item
          label="權限配置"
        >
          {allPermissionsLoading ? (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <Spin tip="權限數據加載中..." />
            </div>
          ) : allPermissionsError ? (
            <AntAlert
              message={`加載可用權限失敗: ${allPermissionsError}`}
              type="error"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          ) : (
            <Form.Item 
              name="permissions" 
              noStyle
            >
              <PermissionSelector
                availablePermissions={allPermissions}
              />
            </Form.Item>
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RoleFormModal; 