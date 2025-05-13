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
  Grid, 
  CircularProgress, 
  Alert
} from '@mui/material';
import { User, UpdateUserPayload } from '../../types/user.types';
import { updateUserSchema, UpdateUserFormData } from '../../validation/userValidation';

interface UserEditFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UpdateUserPayload) => Promise<void>;
  user: User | null;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * 編輯用戶資料表單組件
 */
const UserEditForm: React.FC<UserEditFormProps> = ({
  open,
  onClose,
  onSubmit,
  user,
  isSubmitting,
  error
}) => {
  // React Hook Form 設置
  const { 
    control, 
    handleSubmit, 
    formState: { errors }, 
    reset
  } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || ''
    }
  });

  // 當對話框打開或用戶改變時重置表單
  useEffect(() => {
    if (open && user) {
      reset({
        displayName: user.displayName || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      });
    }
  }, [open, user, reset]);

  // 表單提交
  const handleFormSubmit = (data: UpdateUserFormData) => {
    if (!user) return;
    
    // 過濾掉未變更的欄位，只提交有變更的資料
    const payload: UpdateUserPayload = {};
    if (data.displayName !== user.displayName) payload.displayName = data.displayName;
    if (data.firstName !== user.firstName) payload.firstName = data.firstName;
    if (data.lastName !== user.lastName) payload.lastName = data.lastName;
    if (data.email !== user.email) payload.email = data.email;
    
    // 如果沒有任何變更，不提交
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    
    onSubmit(payload);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      aria-labelledby="edit-user-dialog-title"
    >
      <DialogTitle id="edit-user-dialog-title">
        編輯用戶資料
      </DialogTitle>

      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
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
            
            {/* 電子郵件 */}
            <Grid item xs={12}>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="電子郵件"
                    type="email"
                    fullWidth
                    error={!!errors.email}
                    helperText={errors.email?.message || '修改電子郵件可能需要驗證流程'}
                    disabled={isSubmitting || true} // 通常不允許直接修改郵箱
                  />
                )}
              />
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
            {isSubmitting ? '更新中...' : '更新資料'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserEditForm; 