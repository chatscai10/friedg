import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Divider,
  CircularProgress,
  Alert,
  SelectChangeEvent,
  Stack
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import { Role, RoleScope, ResourcePermission, BasicPermissions } from '../../types/role';
import { createRole, updateRole, getRoleById } from '../../services/roleService';

// 資源權限複選框組件
const ResourcePermissionCheckboxes: React.FC<{
  resourceName: string;
  resourceLabel: string;
  permissions: ResourcePermission;
  onChange: (resourceName: string, permission: Partial<ResourcePermission>) => void;
}> = ({ resourceName, resourceLabel, permissions, onChange }) => {
  const handleChange = (permissionType: keyof ResourcePermission) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange(resourceName, { [permissionType]: event.target.checked });
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        {resourceLabel}
      </Typography>
      <Grid container>
        <Grid item xs={3}>
          <FormControlLabel
            control={
              <Checkbox
                checked={permissions.create}
                onChange={handleChange('create')}
                size="small"
              />
            }
            label="創建"
          />
        </Grid>
        <Grid item xs={3}>
          <FormControlLabel
            control={
              <Checkbox
                checked={permissions.read}
                onChange={handleChange('read')}
                size="small"
              />
            }
            label="查看"
          />
        </Grid>
        <Grid item xs={3}>
          <FormControlLabel
            control={
              <Checkbox
                checked={permissions.update}
                onChange={handleChange('update')}
                size="small"
              />
            }
            label="編輯"
          />
        </Grid>
        <Grid item xs={3}>
          <FormControlLabel
            control={
              <Checkbox
                checked={permissions.delete}
                onChange={handleChange('delete')}
                size="small"
              />
            }
            label="刪除"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

// 默認資源權限值
const defaultResourcePermission: ResourcePermission = {
  create: false,
  read: false,
  update: false,
  delete: false
};

// 默認基本權限
const defaultPermissions: BasicPermissions = {
  employees: { ...defaultResourcePermission },
  stores: { ...defaultResourcePermission },
  products: { ...defaultResourcePermission },
  categories: { ...defaultResourcePermission },
  orders: { ...defaultResourcePermission },
  customers: { ...defaultResourcePermission },
  reports: { ...defaultResourcePermission },
  settings: { ...defaultResourcePermission },
  roles: { ...defaultResourcePermission }
};

// 角色表單屬性接口
interface RoleFormProps {
  roleId?: string; // 若為編輯模式，則提供角色ID
  onSuccess?: (role: Role) => void;
  onCancel?: () => void;
}

// 角色表單組件
const RoleForm: React.FC<RoleFormProps> = ({ roleId, onSuccess, onCancel }) => {
  const isEditMode = !!roleId;

  // 表單狀態
  const [formData, setFormData] = useState<Partial<Role>>({
    name: '',
    description: '',
    level: 1,
    scope: 'tenant' as RoleScope,
    permissions: { ...defaultPermissions }
  });

  // 頁面狀態
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // 資源映射（用於顯示標籤）
  const resourceMapping: Record<keyof BasicPermissions, string> = {
    employees: '員工管理',
    stores: '分店管理',
    products: '產品管理',
    categories: '類別管理',
    orders: '訂單管理',
    customers: '客戶管理',
    reports: '報表分析',
    settings: '系統設定',
    roles: '角色權限'
  };

  // 如果是編輯模式，獲取角色數據
  useEffect(() => {
    if (isEditMode && roleId) {
      const fetchRoleData = async () => {
        setIsLoading(true);
        setApiError(null);
        try {
          const roleData = await getRoleById(roleId);
          setFormData(roleData);
        } catch (error) {
          console.error('獲取角色數據失敗:', error);
          setApiError('無法獲取角色資料，請稍後再試。');
        } finally {
          setIsLoading(false);
        }
      };

      fetchRoleData();
    }
  }, [roleId, isEditMode]);

  // 處理輸入變更
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 處理選擇變更
  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'level' ? Number(value) : value
    }));
  };

  // 處理資源權限變更
  const handlePermissionChange = (resourceName: string, permission: Partial<ResourcePermission>) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [resourceName]: {
          ...prev.permissions?.[resourceName as keyof BasicPermissions],
          ...permission
        }
      }
    }));
  };

  // 處理表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      setApiError('請輸入角色名稱');
      return;
    }
    
    setIsSubmitting(true);
    setApiError(null);
    
    try {
      let result;
      
      // 根據模式調用不同的API
      if (isEditMode && roleId) {
        result = await updateRole(roleId, formData);
      } else {
        result = await createRole(formData as Omit<Role, 'id' | 'createdAt' | 'updatedAt'>);
      }
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error('保存角色失敗:', error);
      setApiError('保存角色時發生錯誤，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 處理取消
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };
  
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {isEditMode ? '編輯角色' : '新增角色'}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        {apiError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {apiError}
          </Alert>
        )}
        
        <Grid container spacing={3}>
          {/* 基本信息 */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              基本信息
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              required
              fullWidth
              label="角色名稱"
              name="name"
              value={formData.name || ''}
              onChange={handleInputChange}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel id="scope-label">角色範圍</InputLabel>
              <Select
                labelId="scope-label"
                name="scope"
                value={formData.scope || 'tenant'}
                onChange={handleSelectChange}
                label="角色範圍"
              >
                <MenuItem value="global">全局</MenuItem>
                <MenuItem value="tenant">租戶</MenuItem>
                <MenuItem value="store">店鋪</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel id="level-label">權限等級</InputLabel>
              <Select
                labelId="level-label"
                name="level"
                value={formData.level?.toString() || '1'}
                onChange={handleSelectChange}
                label="權限等級"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                  <MenuItem key={level} value={level.toString()}>
                    {level} - {level >= 8 ? '高' : level >= 5 ? '中' : '基礎'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="角色描述"
              name="description"
              value={formData.description || ''}
              onChange={handleInputChange}
              placeholder="輸入角色用途、權限範圍說明等"
            />
          </Grid>
          
          {/* 權限設定 */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              基本權限設定
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              設定此角色可使用的功能與操作權限
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ mb: 3 }} />
            
            {/* 遍歷所有資源權限 */}
            {Object.keys(resourceMapping).map(resourceKey => (
              <ResourcePermissionCheckboxes
                key={resourceKey}
                resourceName={resourceKey}
                resourceLabel={resourceMapping[resourceKey as keyof BasicPermissions]}
                permissions={
                  (formData.permissions?.[resourceKey as keyof BasicPermissions] as ResourcePermission) || 
                  { ...defaultResourcePermission }
                }
                onChange={handlePermissionChange}
              />
            ))}
          </Grid>
        </Grid>
      </Paper>
      
      {/* 表單操作按鈕 */}
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button
          variant="outlined"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          取消
        </Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={isSubmitting}
        >
          儲存並設定詳細權限
        </Button>
        <LoadingButton
          type="submit"
          variant="contained"
          loading={isSubmitting}
          color="primary"
        >
          {isEditMode ? '儲存變更' : '儲存角色'}
        </LoadingButton>
      </Stack>
    </Box>
  );
};

export default RoleForm; 