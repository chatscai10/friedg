import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  TextField,
  Grid,
  Alert,
  MenuItem,
  InputLabel,
  FormControl,
  Select,
  Typography,
  Divider,
  FormHelperText,
  CircularProgress
} from '@mui/material';
import { createStoreThunk } from '../../store/storeSlice';
import { createStoreSchema, CreateStoreFormValues } from '../../validation/storeValidation';
import { RootState } from '../../store';
import { StoreStatus } from '../../types/store';

interface StoreCreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const defaultValues: CreateStoreFormValues = {
  name: '',
  storeCode: '',
  description: '',
  status: 'active',
  address: {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  },
  contactInfo: {
    email: '',
    phone: '',
    managerName: '',
  }
};

const statusOptions = [
  { value: 'active', label: '營業中' },
  { value: 'inactive', label: '未營業' },
  { value: 'temporary_closed', label: '暫時關閉' },
  { value: 'permanently_closed', label: '永久關閉' },
];

const StoreCreateForm: React.FC<StoreCreateFormProps> = ({ onSuccess, onCancel }) => {
  const dispatch = useDispatch();
  const { saveLoading, saveError } = useSelector((state: RootState) => state.stores);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<CreateStoreFormValues>({
    resolver: zodResolver(createStoreSchema),
    defaultValues
  });

  const onSubmit = async (data: CreateStoreFormValues) => {
    try {
      setSubmissionSuccess(false);
      
      const result = await dispatch(createStoreThunk(data) as any);
      
      if (result.meta.requestStatus === 'fulfilled') {
        setSubmissionSuccess(true);
        reset();
        onSuccess();
      }
    } catch (error) {
      console.error('創建店鋪時發生錯誤:', error);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}
      
      {submissionSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          店鋪創建成功！
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* 基本信息 */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight="bold">基本信息</Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="店鋪名稱"
                fullWidth
                required
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="storeCode"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="店鋪代碼"
                fullWidth
                error={!!errors.storeCode}
                helperText={errors.storeCode?.message}
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
                label="店鋪描述"
                fullWidth
                multiline
                rows={3}
                error={!!errors.description}
                helperText={errors.description?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.status}>
                <InputLabel id="status-label">店鋪狀態</InputLabel>
                <Select
                  {...field}
                  labelId="status-label"
                  label="店鋪狀態"
                >
                  {statusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.status && (
                  <FormHelperText>{errors.status.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        </Grid>

        {/* 地址信息 */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight="bold">地址信息</Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="address.street"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="街道"
                fullWidth
                error={!!errors.address?.street}
                helperText={errors.address?.street?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="address.city"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="城市"
                fullWidth
                error={!!errors.address?.city}
                helperText={errors.address?.city?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <Controller
            name="address.state"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="省/州"
                fullWidth
                error={!!errors.address?.state}
                helperText={errors.address?.state?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <Controller
            name="address.postalCode"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="郵遞區號"
                fullWidth
                error={!!errors.address?.postalCode}
                helperText={errors.address?.postalCode?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <Controller
            name="address.country"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="國家"
                fullWidth
                error={!!errors.address?.country}
                helperText={errors.address?.country?.message}
              />
            )}
          />
        </Grid>

        {/* 聯絡資訊 */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight="bold">聯絡資訊</Typography>
          <Divider sx={{ mb: 2 }} />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="contactInfo.email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="電子郵件"
                fullWidth
                error={!!errors.contactInfo?.email}
                helperText={errors.contactInfo?.email?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="contactInfo.phone"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="電話"
                fullWidth
                error={!!errors.contactInfo?.phone}
                helperText={errors.contactInfo?.phone?.message}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Controller
            name="contactInfo.managerName"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="店長姓名"
                fullWidth
                error={!!errors.contactInfo?.managerName}
                helperText={errors.contactInfo?.managerName?.message}
              />
            )}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          onClick={onCancel}
          sx={{ mr: 1 }}
          disabled={saveLoading}
        >
          取消
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={saveLoading}
          startIcon={saveLoading ? <CircularProgress size={20} /> : null}
        >
          {saveLoading ? '處理中...' : '創建店鋪'}
        </Button>
      </Box>
    </Box>
  );
};

export default StoreCreateForm; 