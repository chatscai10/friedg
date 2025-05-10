import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  FormHelperText,
  CircularProgress
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhTW } from 'date-fns/locale';
import { createSchedule, updateSchedule } from '../../services/schedulingService';
import { Schedule, ScheduleRole } from '../../types/scheduling.types';

// 選擇員工、選擇分店的介面需要調用其他服務，這裡先定義簡單結構
interface Employee {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

// 預設排班角色
const DEFAULT_ROLES: { id: ScheduleRole; name: string }[] = [
  { id: 'cashier', name: '收銀員' },
  { id: 'server', name: '服務員' },
  { id: 'chef', name: '廚師' },
  { id: 'manager', name: '經理' },
  { id: 'cleaner', name: '清潔員' }
];

interface ScheduleFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (schedule: Schedule) => void;
  initialData?: Schedule;
  employees: Employee[];
  stores: Store[];
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({
  open,
  onClose,
  onSuccess,
  initialData,
  employees,
  stores
}) => {
  const isEditMode = !!initialData;
  const [loading, setLoading] = useState(false);
  
  // 表單數據
  const [formData, setFormData] = useState({
    employeeId: '',
    storeId: '',
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 8 * 60 * 60 * 1000), // 預設8小時後
    role: 'server' as ScheduleRole,
    note: ''
  });
  
  // 表單錯誤
  const [errors, setErrors] = useState<{
    employeeId?: string;
    storeId?: string;
    startTime?: string;
    endTime?: string;
    role?: string;
    general?: string;
  }>({});
  
  // 初始化表單數據
  useEffect(() => {
    if (initialData) {
      setFormData({
        employeeId: initialData.employeeId,
        storeId: initialData.storeId,
        startTime: new Date(initialData.startTime),
        endTime: new Date(initialData.endTime),
        role: initialData.role,
        note: initialData.note || ''
      });
    } else {
      // 重置為默認值
      setFormData({
        employeeId: '',
        storeId: '',
        startTime: new Date(),
        endTime: new Date(new Date().getTime() + 8 * 60 * 60 * 1000),
        role: 'server',
        note: ''
      });
    }
    
    // 清除錯誤
    setErrors({});
  }, [initialData, open]);
  
  // 處理輸入變更
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    if (name) {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
      
      // 清除對應的錯誤
      if (errors[name as keyof typeof errors]) {
        setErrors(prev => ({
          ...prev,
          [name]: undefined
        }));
      }
    }
  };
  
  // 處理日期時間變更
  const handleDateTimeChange = (name: 'startTime' | 'endTime') => (date: Date | null) => {
    if (date) {
      setFormData(prev => ({
        ...prev,
        [name]: date
      }));
      
      // 清除對應的錯誤
      if (errors[name]) {
        setErrors(prev => ({
          ...prev,
          [name]: undefined
        }));
      }
    }
  };
  
  // 驗證表單
  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    if (!formData.employeeId) {
      newErrors.employeeId = '請選擇員工';
    }
    
    if (!formData.storeId) {
      newErrors.storeId = '請選擇分店';
    }
    
    if (!formData.startTime) {
      newErrors.startTime = '請選擇開始時間';
    }
    
    if (!formData.endTime) {
      newErrors.endTime = '請選擇結束時間';
    } else if (formData.endTime <= formData.startTime) {
      newErrors.endTime = '結束時間必須晚於開始時間';
    }
    
    if (!formData.role) {
      newErrors.role = '請選擇排班角色';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // 處理表單提交
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setErrors({});
    
    try {
      const scheduleData = {
        employeeId: formData.employeeId,
        storeId: formData.storeId,
        startTime: formData.startTime.toISOString(),
        endTime: formData.endTime.toISOString(),
        role: formData.role,
        note: formData.note
      };
      
      let response;
      
      if (isEditMode && initialData) {
        response = await updateSchedule(initialData.scheduleId, scheduleData);
      } else {
        response = await createSchedule(scheduleData);
      }
      
      onSuccess(response.schedule);
      onClose();
    } catch (error) {
      console.error('保存排班失敗:', error);
      setErrors({
        general: '保存排班失敗，請稍後再試'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditMode ? '編輯排班' : '新增排班'}
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {errors.general && (
            <Grid item xs={12}>
              <Typography color="error">{errors.general}</Typography>
            </Grid>
          )}
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth error={!!errors.employeeId}>
              <InputLabel>員工</InputLabel>
              <Select
                name="employeeId"
                value={formData.employeeId}
                onChange={handleInputChange}
                label="員工"
              >
                {employees.map(employee => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.employeeId && <FormHelperText>{errors.employeeId}</FormHelperText>}
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth error={!!errors.storeId}>
              <InputLabel>分店</InputLabel>
              <Select
                name="storeId"
                value={formData.storeId}
                onChange={handleInputChange}
                label="分店"
              >
                {stores.map(store => (
                  <MenuItem key={store.id} value={store.id}>
                    {store.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.storeId && <FormHelperText>{errors.storeId}</FormHelperText>}
            </FormControl>
          </Grid>
          
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
            <Grid item xs={12} md={6}>
              <DateTimePicker
                label="開始時間"
                value={formData.startTime}
                onChange={handleDateTimeChange('startTime')}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.startTime,
                    helperText: errors.startTime
                  }
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <DateTimePicker
                label="結束時間"
                value={formData.endTime}
                onChange={handleDateTimeChange('endTime')}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.endTime,
                    helperText: errors.endTime
                  }
                }}
              />
            </Grid>
          </LocalizationProvider>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth error={!!errors.role}>
              <InputLabel>排班角色</InputLabel>
              <Select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                label="排班角色"
              >
                {DEFAULT_ROLES.map(role => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.role && <FormHelperText>{errors.role}</FormHelperText>}
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              name="note"
              label="備註"
              value={formData.note}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={3}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? '處理中...' : (isEditMode ? '更新' : '建立')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleForm; 