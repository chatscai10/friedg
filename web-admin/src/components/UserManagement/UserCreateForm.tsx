import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogTitle, 
  TextField, 
  Button, 
  FormControl, 
  FormHelperText, 
  FormGroup, 
  FormControlLabel, 
  Checkbox, 
  InputLabel, 
  Select, 
  MenuItem, 
  Grid, 
  Box, 
  Typography, 
  CircularProgress, 
  Alert, 
  Divider
} from '@mui/material';
import { Role } from '../../types/role';
import { UserStatus, CreateUserPayload } from '../../types/user.types';
import { createUserSchema, CreateUserFormData } from '../../validation/userValidation';

interface UserCreateFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserPayload) => Promise<void>;
  availableRoles: Role[];
  isSubmitting: boolean;
  error: string | null;
  currentTenantId?: string;
  availableStores?: { id: string; name: string }[];
  isSuperAdmin?: boolean;
  availableTenants?: { id: string; name: string }[];
}

/**
 * 新增用戶表單組件
 */
const UserCreateForm: React.FC<UserCreateFormProps> = ({
  open,
  onClose,
  onSubmit,
  availableRoles,
  isSubmitting,
  error,
  currentTenantId,
  availableStores,
  isSuperAdmin,
  availableTenants
}) => {
  // React Hook Form 設置
  const { 
    control, 
    handleSubmit, 
    formState: { errors }, 
    reset,
    setValue,
    watch
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      displayName: '',
      firstName: '',
      lastName: '',
      roles: [],
      status: 'active' as UserStatus,
      tenantId: currentTenantId || '',
      storeId: ''
    }
  });

  // 監聽表單值
  const selectedRoles = watch('roles');

  // 當對話框關閉時重置表單
  useEffect(() => {
    if (open) {
      reset({
        email: '',
        password: '',
        confirmPassword: '',
        displayName: '',
        firstName: '',
        lastName: '',
        roles: [],
        status: 'active',
        tenantId: currentTenantId || '',
        storeId: ''
      });
    }
  }, [open, reset, currentTenantId]);

  // 表單提交
  const handleFormSubmit = (data: CreateUserFormData) => {
    // 創建用戶提交數據
    const payload: CreateUserPayload = {
      email: data.email,
      password: data.password,
      displayName: data.displayName || undefined,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      roles: data.roles,
      status: data.status,
      tenantId: data.tenantId || undefined,
      storeId: data.storeId || undefined
    };

    onSubmit(payload);
  };

  const handleRoleCheckboxChange = (roleId: string, checked: boolean) => {
    if (checked) {
      const newRoles = [...selectedRoles, roleId];
      setValue('roles', newRoles);
    } else {
      const newRoles = selectedRoles.filter(id => id !== roleId);
      setValue('roles', newRoles);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      aria-labelledby="create-user-dialog-title"
    >
      <DialogTitle id="create-user-dialog-title">
        新增用戶
      </DialogTitle>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* 基本信息區塊 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                基本信息
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            {/* 電子郵件 */}
            <Grid item xs={12}>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="電子郵件*"
                    type="email"
                    fullWidth
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                )}
              />
            </Grid>

            {/* 密碼 */}
            <Grid item xs={12} md={6}>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="密碼*"
                    type="password"
                    fullWidth
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                )}
              />
            </Grid>

            {/* 確認密碼 */}
            <Grid item xs={12} md={6}>
              <Controller
                name="confirmPassword"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="確認密碼*"
                    type="password"
                    fullWidth
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword?.message}
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                )}
              />
            </Grid>

            {/* 顯示名稱 */}
            <Grid item xs={12}>
              <Controller
                name="displayName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="顯示名稱"
                    fullWidth
                    error={!!errors.displayName}
                    helperText={errors.displayName?.message}
                    disabled={isSubmitting}
                  />
                )}
              />
            </Grid>

            {/* 名 */}
            <Grid item xs={12} md={6}>
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="名"
                    fullWidth
                    error={!!errors.firstName}
                    helperText={errors.firstName?.message}
                    disabled={isSubmitting}
                  />
                )}
              />
            </Grid>

            {/* 姓 */}
            <Grid item xs={12} md={6}>
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="姓"
                    fullWidth
                    error={!!errors.lastName}
                    helperText={errors.lastName?.message}
                    disabled={isSubmitting}
                  />
                )}
              />
            </Grid>

            {/* 用戶狀態 */}
            <Grid item xs={12}>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.status}>
                    <InputLabel id="status-select-label">用戶狀態</InputLabel>
                    <Select
                      {...field}
                      labelId="status-select-label"
                      label="用戶狀態"
                      disabled={isSubmitting}
                    >
                      <MenuItem value="active">啟用</MenuItem>
                      <MenuItem value="inactive">停用</MenuItem>
                      <MenuItem value="suspended">已暫停</MenuItem>
                    </Select>
                    {errors.status && (
                      <FormHelperText>{errors.status.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* 租戶和店鋪 */}
            {isSuperAdmin && (
              <>
                {/* 租戶選擇 */}
                <Grid item xs={12} md={6}>
                  <Controller
                    name="tenantId"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.tenantId}>
                        <InputLabel id="tenant-select-label">所屬租戶</InputLabel>
                        <Select
                          {...field}
                          labelId="tenant-select-label"
                          label="所屬租戶"
                          disabled={isSubmitting}
                        >
                          <MenuItem value="">
                            <em>無</em>
                          </MenuItem>
                          {availableTenants?.map(tenant => (
                            <MenuItem key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.tenantId && (
                          <FormHelperText>{errors.tenantId.message}</FormHelperText>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>
              </>
            )}

            {/* 店鋪選擇 */}
            <Grid item xs={12} md={isSuperAdmin ? 6 : 12}>
              <Controller
                name="storeId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.storeId}>
                    <InputLabel id="store-select-label">所屬店鋪</InputLabel>
                    <Select
                      {...field}
                      labelId="store-select-label"
                      label="所屬店鋪"
                      disabled={isSubmitting}
                    >
                      <MenuItem value="">
                        <em>無</em>
                      </MenuItem>
                      {availableStores?.map(store => (
                        <MenuItem key={store.id} value={store.id}>
                          {store.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.storeId && (
                      <FormHelperText>{errors.storeId.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* 角色分配區塊 */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                分配角色*
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>

            {/* 角色列表 */}
            <Grid item xs={12}>
              <FormControl 
                component="fieldset" 
                fullWidth 
                error={!!errors.roles}
              >
                <FormGroup>
                  {availableRoles.map((role: Role) => (
                    <FormControlLabel
                      key={role.roleId}
                      control={
                        <Checkbox
                          checked={selectedRoles.includes(role.roleId)}
                          onChange={(e) => handleRoleCheckboxChange(role.roleId, e.target.checked)}
                          disabled={isSubmitting}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1">{role.roleName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {role.description}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </FormGroup>
                {errors.roles && (
                  <FormHelperText>{errors.roles.message}</FormHelperText>
                )}
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button 
            onClick={onClose} 
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isSubmitting ? '創建中...' : '創建用戶'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserCreateForm; 