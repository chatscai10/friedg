import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  TextField,
  FormControl,
  FormLabel,
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
  Switch,
  Typography,
  Paper,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Checkbox,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import { RootState } from '../store';
import { createRole, fetchRoleById, clearCurrentRole, updateRole } from '../store/roleSlice';
import { createRoleSchema, updateRoleSchema, CreateRoleFormData } from '../validation/roleValidation';
import { ALL_PERMISSIONS } from '../config/permissionConfig';
import { CreateRolePayload, UpdateRolePayload, Permission } from '../types/role';
import LoadingState from '../components/common/LoadingState';

const RoleFormPage: React.FC = () => {
  const { roleId } = useParams<{ roleId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isEditMode = !!roleId;
  
  // 從 Redux store 獲取角色相關狀態
  const { currentRole, loading, saveLoading, error, saveError } = useSelector((state: RootState) => state.roles);
  
  // 從 Auth store 獲取當前用戶訊息
  const { user } = useSelector((state: RootState) => state.auth);
  
  // 表單註冊
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<CreateRoleFormData>({
    resolver: zodResolver(isEditMode ? updateRoleSchema : createRoleSchema),
    defaultValues: {
      roleName: '',
      description: '',
      scope: 'tenant',
      roleLevel: 10,
      isActive: true,
      permissions: []
    }
  });
  
  // 監聽表單值變化
  const scope = watch('scope');
  
  // 權限選擇狀態
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({});
  
  // 獲取角色詳情（編輯模式）
  useEffect(() => {
    if (isEditMode && roleId) {
      dispatch(fetchRoleById(roleId) as any);
    }
    
    return () => {
      // 組件卸載時清除當前角色
      dispatch(clearCurrentRole());
    };
  }, [dispatch, isEditMode, roleId]);
  
  // 當獲取到角色詳情時，設置表單的默認值
  useEffect(() => {
    if (isEditMode && currentRole) {
      reset({
        roleName: currentRole.roleName,
        description: currentRole.description || '',
        scope: currentRole.scope,
        roleLevel: currentRole.roleLevel,
        isActive: currentRole.isActive,
        permissions: currentRole.permissions
      });
      
      // 設置權限選擇狀態
      const permissionMap: Record<string, string[]> = {};
      currentRole.permissions.forEach(permission => {
        if (!permissionMap[permission.resource]) {
          permissionMap[permission.resource] = [];
        }
        permissionMap[permission.resource].push(permission.action);
      });
      setSelectedPermissions(permissionMap);
    }
  }, [isEditMode, currentRole, reset]);
  
  // 處理權限選擇變化
  const handlePermissionChange = (resource: string, action: string, checked: boolean) => {
    setSelectedPermissions(prev => {
      const newPermissions = { ...prev };
      
      if (!newPermissions[resource]) {
        newPermissions[resource] = [];
      }
      
      if (checked) {
        newPermissions[resource] = [...newPermissions[resource], action];
      } else {
        newPermissions[resource] = newPermissions[resource].filter(a => a !== action);
      }
      
      // 如果該資源下沒有選中任何操作，則刪除該資源的鍵
      if (newPermissions[resource].length === 0) {
        delete newPermissions[resource];
      }
      
      // 更新表單字段
      const permissions: Permission[] = [];
      Object.entries(newPermissions).forEach(([res, actions]) => {
        actions.forEach(act => {
          permissions.push({ resource: res, action: act });
        });
      });
      setValue('permissions', permissions, { shouldValidate: true });
      
      return newPermissions;
    });
  };
  
  // 檢查權限是否被選中
  const isPermissionSelected = (resource: string, action: string): boolean => {
    return selectedPermissions[resource]?.includes(action) || false;
  };
  
  // 處理資源所有權限全選/取消全選
  const handleResourceToggle = (resource: string, checked: boolean) => {
    setSelectedPermissions(prev => {
      const newPermissions = { ...prev };
      
      const resourceItem = ALL_PERMISSIONS.find(item => item.resource === resource);
      if (!resourceItem) return prev;
      
      if (checked) {
        newPermissions[resource] = resourceItem.actions.map(a => a.action);
      } else {
        delete newPermissions[resource];
      }
      
      // 更新表單字段
      const permissions: Permission[] = [];
      Object.entries(newPermissions).forEach(([res, actions]) => {
        actions.forEach(act => {
          permissions.push({ resource: res, action: act });
        });
      });
      setValue('permissions', permissions, { shouldValidate: true });
      
      return newPermissions;
    });
  };
  
  // 檢查資源是否全選
  const isResourceAllSelected = (resource: string): boolean => {
    const resourceItem = ALL_PERMISSIONS.find(item => item.resource === resource);
    if (!resourceItem) return false;
    
    const selected = selectedPermissions[resource] || [];
    return selected.length === resourceItem.actions.length;
  };
  
  // 檢查資源是否部分選中
  const isResourcePartiallySelected = (resource: string): boolean => {
    const resourceItem = ALL_PERMISSIONS.find(item => item.resource === resource);
    if (!resourceItem) return false;
    
    const selected = selectedPermissions[resource] || [];
    return selected.length > 0 && selected.length < resourceItem.actions.length;
  };
  
  // 表單提交處理
  const onSubmit: SubmitHandler<CreateRoleFormData> = (data) => {
    if (isEditMode && roleId) {
      // 更新模式
      const updateData: UpdateRolePayload = {
        roleName: data.roleName,
        description: data.description,
        permissions: data.permissions,
        isActive: data.isActive,
        roleLevel: data.roleLevel
      };
      
      dispatch(updateRole({ roleId, roleData: updateData }) as any)
        .then((result: any) => {
          if (!result.error) {
            navigate('/roles');
          }
        });
    } else {
      // 創建模式
      const createData: CreateRolePayload = {
        roleName: data.roleName,
        description: data.description || '',
        scope: data.scope,
        permissions: data.permissions,
        isActive: data.isActive,
        roleLevel: data.roleLevel
      };
      
      // 如果是租戶範圍且有租戶ID，則添加租戶ID
      if (data.scope === 'tenant' && user?.tenantId) {
        createData.tenantId = user.tenantId;
      }
      
      dispatch(createRole(createData) as any)
        .then((result: any) => {
          if (!result.error) {
            navigate('/roles');
          }
        });
    }
  };
  
  if (loading) {
    return <LoadingState label="加載角色信息..." />;
  }
  
  return (
    <Box component={Paper} p={4} sx={{ maxWidth: 'lg', mx: 'auto' }}>
      <Box display="flex" alignItems="center" mb={3}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/roles')}
          variant="outlined"
          sx={{ mr: 2 }}
        >
          返回
        </Button>
        <Typography variant="h5" component="h1">
          {isEditMode ? '編輯角色' : '創建角色'}
        </Typography>
      </Box>
      
      {(error || saveError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || saveError}
        </Alert>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Controller
              name="roleName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="角色名稱"
                  fullWidth
                  error={!!errors.roleName}
                  helperText={errors.roleName?.message}
                  disabled={isEditMode && currentRole?.isSystemRole}
                  required
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Controller
              name="roleLevel"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="角色等級"
                  fullWidth
                  type="number"
                  InputProps={{ inputProps: { min: 1, max: 100 } }}
                  error={!!errors.roleLevel}
                  helperText={errors.roleLevel?.message || '角色等級決定角色的優先級，數字越小等級越高'}
                  disabled={isEditMode && currentRole?.isSystemRole}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="角色描述"
                  fullWidth
                  multiline
                  rows={2}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                />
              )}
            />
          </Grid>
          
          {!isEditMode && (
            <Grid item xs={12}>
              <FormControl component="fieldset" error={!!errors.scope}>
                <FormLabel component="legend">角色範圍</FormLabel>
                <Controller
                  name="scope"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup {...field} row>
                      <FormControlLabel
                        value="global"
                        control={<Radio />}
                        label="全局 (適用於所有租戶)"
                        disabled={user?.role !== 'admin'}
                      />
                      <FormControlLabel 
                        value="tenant" 
                        control={<Radio />} 
                        label="租戶 (僅適用於當前租戶)"
                      />
                    </RadioGroup>
                  )}
                />
                {errors.scope && (
                  <FormHelperText>{errors.scope.message}</FormHelperText>
                )}
              </FormControl>
            </Grid>
          )}
          
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel component="legend">狀態</FormLabel>
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch checked={field.value} onChange={field.onChange} />}
                    label={field.value ? '啟用' : '禁用'}
                    disabled={isEditMode && currentRole?.isSystemRole && currentRole.roleName === 'SuperAdmin'}
                  />
                )}
              />
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              權限設置
            </Typography>
            
            {errors.permissions && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.permissions.message}
              </Alert>
            )}
            
            {ALL_PERMISSIONS.map((resourceItem) => (
              <Accordion key={resourceItem.resource} sx={{ my: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" width="100%">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isResourceAllSelected(resourceItem.resource)}
                          indeterminate={isResourcePartiallySelected(resourceItem.resource)}
                          onChange={(e) => {
                            // 阻止事件冒泡，避免展開/收起手風琴
                            e.stopPropagation();
                            handleResourceToggle(resourceItem.resource, e.target.checked);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isEditMode && currentRole?.isSystemRole}
                        />
                      }
                      label={resourceItem.displayName}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <FormGroup>
                    <Grid container spacing={2}>
                      {resourceItem.actions.map((actionItem) => (
                        <Grid item xs={6} sm={4} md={3} key={`${resourceItem.resource}-${actionItem.action}`}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={isPermissionSelected(resourceItem.resource, actionItem.action)}
                                onChange={(e) => handlePermissionChange(
                                  resourceItem.resource,
                                  actionItem.action,
                                  e.target.checked
                                )}
                                disabled={isEditMode && currentRole?.isSystemRole}
                              />
                            }
                            label={actionItem.displayName}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </FormGroup>
                </AccordionDetails>
              </Accordion>
            ))}
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={() => navigate('/roles')}
                sx={{ mr: 2 }}
              >
                取消
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                startIcon={saveLoading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                disabled={saveLoading}
              >
                {saveLoading ? '保存中...' : isEditMode ? '更新角色' : '創建角色'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default RoleFormPage; 