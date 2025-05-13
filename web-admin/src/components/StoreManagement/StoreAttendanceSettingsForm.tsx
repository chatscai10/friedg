import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  TextField,
  Grid,
  Alert,
  FormControlLabel,
  Switch,
  Typography,
  Divider,
  FormHelperText,
  CircularProgress,
  Paper,
  InputAdornment
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { parseISO, format } from 'date-fns';
import { updateStoreAttendanceSettingsThunk } from '../../store/storeSlice';
import { updateStoreAttendanceSettingsSchema, UpdateStoreAttendanceSettingsFormValues } from '../../validation/storeValidation';
import { RootState } from '../../store';
import { Store, AttendanceSettings } from '../../types/store';

interface StoreAttendanceSettingsFormProps {
  store: Store;
  onSuccess: () => void;
  onCancel: () => void;
}

const StoreAttendanceSettingsForm: React.FC<StoreAttendanceSettingsFormProps> = ({
  store,
  onSuccess,
  onCancel
}) => {
  const dispatch = useDispatch();
  const { saveLoading, saveError } = useSelector((state: RootState) => state.stores);
  
  // 從店鋪數據中獲取考勤設定，如果沒有則使用默認值
  const defaultValues: UpdateStoreAttendanceSettingsFormValues = {
    attendanceSettings: {
      lateThresholdMinutes: store.attendanceSettings?.lateThresholdMinutes ?? 15, // 默認遲到閾值15分鐘
      earlyThresholdMinutes: store.attendanceSettings?.earlyThresholdMinutes ?? 15, // 默認早退閾值15分鐘
      flexTimeMinutes: store.attendanceSettings?.flexTimeMinutes ?? 5, // 默認彈性打卡時間5分鐘
      requireApprovalForCorrection: store.attendanceSettings?.requireApprovalForCorrection ?? true, // 默認需要審批補卡
      autoClockOutEnabled: store.attendanceSettings?.autoClockOutEnabled ?? false, // 默認不啟用自動打下班卡
      autoClockOutTime: store.attendanceSettings?.autoClockOutTime ?? '21:00', // 默認時間 21:00
    }
  };
  
  const { 
    control, 
    handleSubmit, 
    watch, 
    formState: { errors },
    setValue
  } = useForm<UpdateStoreAttendanceSettingsFormValues>({
    resolver: zodResolver(updateStoreAttendanceSettingsSchema),
    defaultValues,
  });
  
  // 監視是否啟用自動打下班卡
  const autoClockOutEnabled = watch('attendanceSettings.autoClockOutEnabled');
  
  // 處理時間選擇
  const handleTimeChange = (newTime: Date | null) => {
    if (newTime) {
      setValue('attendanceSettings.autoClockOutTime', format(newTime, 'HH:mm'));
    }
  };
  
  // 提交表單
  const onSubmit = async (data: UpdateStoreAttendanceSettingsFormValues) => {
    const actionResult = await dispatch(
      updateStoreAttendanceSettingsThunk({
        storeId: store.id,
        attendanceData: data
      }) as any
    );
    
    if (updateStoreAttendanceSettingsThunk.fulfilled.match(actionResult)) {
      onSuccess();
    }
  };
  
  // 將字符串時間轉換為 Date 對象
  const parseTimeString = (timeString: string | undefined): Date => {
    if (!timeString) return new Date();
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };
  
  // 獲取當前自動打下班卡時間的 Date 對象
  const autoClockOutTimeDate = parseTimeString(watch('attendanceSettings.autoClockOutTime'));
  
  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <Typography variant="h6" gutterBottom>
          店鋪考勤設定
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}
        
        <Grid container spacing={3}>
          {/* 遲到閾值 */}
          <Grid item xs={12} md={6}>
            <Controller
              name="attendanceSettings.lateThresholdMinutes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="遲到閾值"
                  fullWidth
                  variant="outlined"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  error={!!errors.attendanceSettings?.lateThresholdMinutes}
                  helperText={errors.attendanceSettings?.lateThresholdMinutes?.message}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">分鐘</InputAdornment>,
                  }}
                />
              )}
            />
            <FormHelperText>
              員工遲到多少分鐘會被標記為遲到 (0-180分鐘)
            </FormHelperText>
          </Grid>
          
          {/* 早退閾值 */}
          <Grid item xs={12} md={6}>
            <Controller
              name="attendanceSettings.earlyThresholdMinutes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="早退閾值"
                  fullWidth
                  variant="outlined"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  error={!!errors.attendanceSettings?.earlyThresholdMinutes}
                  helperText={errors.attendanceSettings?.earlyThresholdMinutes?.message}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">分鐘</InputAdornment>,
                  }}
                />
              )}
            />
            <FormHelperText>
              員工提前多少分鐘下班會被標記為早退 (0-180分鐘)
            </FormHelperText>
          </Grid>
          
          {/* 彈性打卡時間 */}
          <Grid item xs={12} md={6}>
            <Controller
              name="attendanceSettings.flexTimeMinutes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="彈性打卡時間"
                  fullWidth
                  variant="outlined"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  error={!!errors.attendanceSettings?.flexTimeMinutes}
                  helperText={errors.attendanceSettings?.flexTimeMinutes?.message}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">分鐘</InputAdornment>,
                  }}
                />
              )}
            />
            <FormHelperText>
              允許提前或延後多少分鐘打卡不算異常 (0-120分鐘)
            </FormHelperText>
          </Grid>
          
          {/* 審批補卡 */}
          <Grid item xs={12}>
            <Controller
              name="attendanceSettings.requireApprovalForCorrection"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="補卡需要審批"
                />
              )}
            />
            <FormHelperText>
              啟用後，員工補卡申請需要管理員審批才能生效
            </FormHelperText>
          </Grid>
          
          {/* 自動打下班卡 */}
          <Grid item xs={12}>
            <Controller
              name="attendanceSettings.autoClockOutEnabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="啟用自動打下班卡"
                />
              )}
            />
            <FormHelperText>
              啟用後，系統將在指定時間自動為未打下班卡的員工打卡下班
            </FormHelperText>
          </Grid>
          
          {/* 自動打下班卡時間 */}
          {autoClockOutEnabled && (
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Controller
                  name="attendanceSettings.autoClockOutTime"
                  control={control}
                  render={({ field }) => (
                    <TimePicker
                      label="自動打下班卡時間"
                      value={autoClockOutTimeDate}
                      onChange={handleTimeChange}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          variant: "outlined",
                          error: !!errors.attendanceSettings?.autoClockOutTime,
                          helperText: errors.attendanceSettings?.autoClockOutTime?.message,
                        },
                      }}
                    />
                  )}
                />
              </LocalizationProvider>
              <FormHelperText>
                系統自動為員工打下班卡的時間 (24小時制)
              </FormHelperText>
            </Grid>
          )}
        </Grid>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            onClick={onCancel}
            sx={{ mr: 1 }}
          >
            取消
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saveLoading}
            startIcon={saveLoading ? <CircularProgress size={20} /> : null}
          >
            保存
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default StoreAttendanceSettingsForm; 