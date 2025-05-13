import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Divider,
  FormControlLabel,
  Checkbox,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  SelectChangeEvent
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { zhTW } from 'date-fns/locale';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { createEmployee, updateEmployee, getEmployeeById } from '../../services/employeeService';
import { Employee, EmploymentType, EmployeeStatus } from '../../types/employee';

// 星期幾選項
const daysOfWeek = [
  { value: 0, label: '週日' },
  { value: 1, label: '週一' },
  { value: 2, label: '週二' },
  { value: 3, label: '週三' },
  { value: 4, label: '週四' },
  { value: 5, label: '週五' },
  { value: 6, label: '週六' },
];

// 班次選項
const shifts = [
  { value: 'morning', label: '早班 (08:00-14:00)' },
  { value: 'afternoon', label: '午班 (14:00-20:00)' },
  { value: 'evening', label: '晚班 (20:00-02:00)' },
];

interface EmployeeFormProps {
  isEdit?: boolean;
  employeeId?: string;
  employeeData?: Employee;
  onCancel?: () => void;
  onSuccess?: () => void;
}

// 擴展 Employee 類型，增加扁平化的欄位
interface EmployeeFormData extends Partial<Employee> {
  phone: string;
  emergencyContact: string;
  emergencyPhone: string;
  preferredShifts: string[];
  maxHoursPerWeek: number;
  daysUnavailable: number[];
  hourlyRate: string;
  salaryType: string;
  bankAccount: string;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ isEdit: isEditProp, employeeId: employeeIdProp, employeeData: initialEmployeeData, onCancel, onSuccess }) => {
  const params = useParams();
  const navigate = useNavigate();
  const employeeId = employeeIdProp || params.id;
  const isEdit = isEditProp || !!employeeId;
  
  const [isLoading, setIsLoading] = useState(isEdit && !initialEmployeeData);
  const [formData, setFormData] = useState<EmployeeFormData>({
    firstName: '',
    lastName: '',
    position: '',
    employmentType: '' as EmploymentType,
    status: '' as EmployeeStatus,
    storeId: '',
    hireDate: undefined,
    terminationDate: undefined,
    phone: '',
    emergencyContact: '',
    emergencyPhone: '',
    preferredShifts: [],
    maxHoursPerWeek: 40,
    daysUnavailable: [],
    hourlyRate: '',
    salaryType: '',
    bankAccount: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 在編輯模式下載入員工資料
  useEffect(() => {
    // 如果是編輯模式且有提供 employeeId，但沒有初始數據
    if (isEdit && employeeId && !initialEmployeeData) {
      const fetchEmployeeData = async () => {
        setIsLoading(true);
        try {
          const employeeData = await getEmployeeById(employeeId);
          
          // 將嵌套資料扁平化
          setFormData({
            ...employeeData,
            phone: employeeData.contactInfo?.phone || '',
            emergencyContact: employeeData.contactInfo?.emergencyContact || '',
            emergencyPhone: employeeData.contactInfo?.emergencyPhone || '',
            preferredShifts: employeeData.schedule?.preferredShifts || [],
            maxHoursPerWeek: employeeData.schedule?.maxHoursPerWeek || 40,
            daysUnavailable: employeeData.schedule?.daysUnavailable || [],
            hourlyRate: employeeData.payInfo?.hourlyRate?.toString() || '',
            salaryType: employeeData.payInfo?.salaryType || '',
            bankAccount: employeeData.payInfo?.bankAccount || '',
          });
        } catch (error) {
          console.error('載入員工資料失敗:', error);
          setApiError('載入員工資料時發生錯誤，請稍後再試。');
        } finally {
          setIsLoading(false);
        }
      };

      fetchEmployeeData();
    } else if (initialEmployeeData) {
      // 如果有提供初始數據，則直接使用
      // 將嵌套資料扁平化
      setFormData({
        ...initialEmployeeData,
        phone: initialEmployeeData.contactInfo?.phone || '',
        emergencyContact: initialEmployeeData.contactInfo?.emergencyContact || '',
        emergencyPhone: initialEmployeeData.contactInfo?.emergencyPhone || '',
        preferredShifts: initialEmployeeData.schedule?.preferredShifts || [],
        maxHoursPerWeek: initialEmployeeData.schedule?.maxHoursPerWeek || 40,
        daysUnavailable: initialEmployeeData.schedule?.daysUnavailable || [],
        hourlyRate: initialEmployeeData.payInfo?.hourlyRate?.toString() || '',
        salaryType: initialEmployeeData.payInfo?.salaryType || '',
        bankAccount: initialEmployeeData.payInfo?.bankAccount || '',
      });
    }
  }, [isEdit, employeeId, initialEmployeeData]);

  // 處理文本輸入變化
  const handleChange = (event: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }> | SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name as string]: value,
    });
    
    // 清除該欄位的錯誤
    if (errors[name as string]) {
      setErrors({
        ...errors,
        [name as string]: '',
      });
    }
  };

  // 處理多選情況 (班次偏好)
  const handleShiftChange = (shift: string) => {
    const currentShifts = [...(formData.preferredShifts || [])];
    const shiftIndex = currentShifts.indexOf(shift);
    
    if (shiftIndex === -1) {
      currentShifts.push(shift);
    } else {
      currentShifts.splice(shiftIndex, 1);
    }
    
    setFormData({
      ...formData,
      preferredShifts: currentShifts,
    });
  };

  // 處理多選情況 (不可排班日)
  const handleUnavailableDayChange = (day: number) => {
    const currentDays = [...(formData.daysUnavailable || [])];
    const dayIndex = currentDays.indexOf(day);
    
    if (dayIndex === -1) {
      currentDays.push(day);
    } else {
      currentDays.splice(dayIndex, 1);
    }
    
    setFormData({
      ...formData,
      daysUnavailable: currentDays,
    });
  };

  // 處理日期變化
  const handleDateChange = (date: Date | null, fieldName: string) => {
    setFormData({
      ...formData,
      [fieldName]: date,
    });
  };

  // 驗證表單
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // 必填字段驗證
    if (!formData.lastName) newErrors.lastName = '請輸入姓氏';
    if (!formData.firstName) newErrors.firstName = '請輸入名字';
    if (!formData.position) newErrors.position = '請輸入職位';
    if (!formData.storeId) newErrors.storeId = '請選擇所屬店鋪';
    if (!formData.employmentType) newErrors.employmentType = '請選擇雇傭類型';
    if (!formData.status) newErrors.status = '請選擇狀態';
    if (!formData.hireDate) newErrors.hireDate = '請選擇入職日期';
    if (!formData.phone) newErrors.phone = '請輸入電話';
    
    // 更多驗證邏輯...
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 處理表單提交
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // 驗證表單
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setApiError(null);
    
    try {
      // 格式化數據，處理日期等特殊字段
      const employeeDataToSubmit = {
        ...formData,
        hireDate: formData.hireDate ? new Date(formData.hireDate).toISOString().split('T')[0] : undefined,
        terminationDate: formData.terminationDate ? new Date(formData.terminationDate).toISOString().split('T')[0] : undefined,
        hourlyRate: formData.hourlyRate ? Number(formData.hourlyRate) : undefined,
        maxHoursPerWeek: formData.maxHoursPerWeek ? Number(formData.maxHoursPerWeek) : undefined,
        contactInfo: {
          phone: formData.phone,
          emergencyContact: formData.emergencyContact,
          emergencyPhone: formData.emergencyPhone,
        },
        schedule: {
          preferredShifts: formData.preferredShifts,
          maxHoursPerWeek: formData.maxHoursPerWeek ? Number(formData.maxHoursPerWeek) : undefined,
          daysUnavailable: formData.daysUnavailable,
        },
        payInfo: {
          hourlyRate: formData.hourlyRate ? Number(formData.hourlyRate) : undefined,
          salaryType: formData.salaryType as 'hourly' | 'monthly' | 'annual',
          bankAccount: formData.bankAccount,
        },
      };
      
      if (isEdit && employeeId) {
        // 編輯現有員工
        await updateEmployee(employeeId, employeeDataToSubmit);
        setSuccessMessage('員工資料已成功更新！');
      } else {
        // 創建新員工
        await createEmployee(employeeDataToSubmit as Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>);
        setSuccessMessage('新員工已成功創建！');
      }
      
      // 延遲關閉，讓用戶看到成功消息
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          // 如果沒有提供 onSuccess 回調，則導航回列表頁
          navigate('/employees');
        }
      }, 1500);
    } catch (error) {
      console.error('提交員工數據失敗:', error);
      setApiError('提交數據時發生錯誤，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 返回按鈕處理函數
  const handleBack = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/employees');
    }
  };

  // 關閉成功消息
  const handleCloseSuccessMessage = () => {
    setSuccessMessage(null);
  };

  // 如果正在載入數據，顯示載入中
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress color="primary" />
        <Typography variant="h6" sx={{ ml: 2 }}>
          載入中...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          sx={{ mr: 2 }}
        >
          返回
        </Button>
        <Typography variant="h4" component="h1">
          {isEdit ? '編輯員工' : '新增員工'}
        </Typography>
      </Box>

      {apiError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {apiError}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 4 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
          <Box component="form" onSubmit={handleSubmit}>
            {/* 基本資料 */}
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
              基本資料
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="姓"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={!!errors.lastName}
                  helperText={errors.lastName}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="名"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={!!errors.firstName}
                  helperText={errors.firstName}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="職位"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  error={!!errors.position}
                  helperText={errors.position}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!errors.storeId}>
                  <InputLabel id="store-label">所屬店鋪</InputLabel>
                  <Select
                    labelId="store-label"
                    name="storeId"
                    value={formData.storeId}
                    label="所屬店鋪"
                    onChange={handleChange}
                  >
                    <MenuItem value="store001">台北門市</MenuItem>
                    <MenuItem value="store002">新竹門市</MenuItem>
                    <MenuItem value="store003">台中門市</MenuItem>
                    <MenuItem value="store004">高雄門市</MenuItem>
                  </Select>
                  {errors.storeId && <FormHelperText>{errors.storeId}</FormHelperText>}
                </FormControl>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* 雇傭資訊 */}
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
              雇傭資訊
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!errors.employmentType}>
                  <InputLabel id="employment-type-label">雇傭類型</InputLabel>
                  <Select
                    labelId="employment-type-label"
                    name="employmentType"
                    value={formData.employmentType}
                    label="雇傭類型"
                    onChange={handleChange}
                  >
                    <MenuItem value="full_time">全職</MenuItem>
                    <MenuItem value="part_time">兼職</MenuItem>
                    <MenuItem value="contract">合約工</MenuItem>
                    <MenuItem value="intern">實習生</MenuItem>
                    <MenuItem value="temporary">臨時工</MenuItem>
                  </Select>
                  {errors.employmentType && <FormHelperText>{errors.employmentType}</FormHelperText>}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!errors.status}>
                  <InputLabel id="status-label">狀態</InputLabel>
                  <Select
                    labelId="status-label"
                    name="status"
                    value={formData.status}
                    label="狀態"
                    onChange={handleChange}
                  >
                    <MenuItem value="active">在職</MenuItem>
                    <MenuItem value="inactive">待職</MenuItem>
                    <MenuItem value="on_leave">休假</MenuItem>
                    <MenuItem value="terminated">離職</MenuItem>
                  </Select>
                  {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="入職日期"
                  value={formData.hireDate}
                  onChange={(date) => handleDateChange(date, 'hireDate')}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!errors.hireDate,
                      helperText: errors.hireDate
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="離職日期"
                  value={formData.terminationDate}
                  onChange={(date) => handleDateChange(date, 'terminationDate')}
                  slotProps={{
                    textField: {
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* 聯絡資訊 */}
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
              聯絡資訊
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="電話"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="例：0912-345-678"
                  error={!!errors.phone}
                  helperText={errors.phone}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="緊急聯絡人"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="緊急聯絡人電話"
                  name="emergencyPhone"
                  value={formData.emergencyPhone}
                  onChange={handleChange}
                  placeholder="例：0923-456-789"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* 排班資訊 */}
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
              排班資訊
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>班次偏好</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {shifts.map((shift) => (
                    <Chip
                      key={shift.value}
                      label={shift.label}
                      onClick={() => handleShiftChange(shift.value)}
                      color={(formData.preferredShifts || []).includes(shift.value) ? 'primary' : 'default'}
                      sx={{ 
                        borderRadius: '16px',
                        '&.MuiChip-colorPrimary': {
                          background: 'linear-gradient(137.48deg, #ffdb3b 10%, #fe53bb 45%, #8f51ea 67%, #0044ff 87%)',
                        }
                      }}
                    />
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="每週最大工時"
                  name="maxHoursPerWeek"
                  type="number"
                  value={formData.maxHoursPerWeek}
                  onChange={handleChange}
                  InputProps={{ inputProps: { min: 0, max: 168 } }}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>不可排班日</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {daysOfWeek.map((day) => (
                    <Chip
                      key={day.value}
                      label={day.label}
                      onClick={() => handleUnavailableDayChange(day.value)}
                      color={(formData.daysUnavailable || []).includes(day.value) ? 'primary' : 'default'}
                      sx={{ 
                        borderRadius: '16px',
                        '&.MuiChip-colorPrimary': {
                          background: 'linear-gradient(137.48deg, #ffdb3b 10%, #fe53bb 45%, #8f51ea 67%, #0044ff 87%)',
                        }
                      }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* 薪資資訊 */}
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', mb: 2 }}>
              薪資資訊
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="時薪"
                  name="hourlyRate"
                  type="number"
                  value={formData.hourlyRate}
                  onChange={handleChange}
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required error={!!errors.salaryType}>
                  <InputLabel id="salary-type-label">薪資類型</InputLabel>
                  <Select
                    labelId="salary-type-label"
                    name="salaryType"
                    value={formData.salaryType}
                    label="薪資類型"
                    onChange={handleChange}
                  >
                    <MenuItem value="hourly">時薪制</MenuItem>
                    <MenuItem value="monthly">月薪制</MenuItem>
                    <MenuItem value="annual">年薪制</MenuItem>
                  </Select>
                  {errors.salaryType && <FormHelperText>{errors.salaryType}</FormHelperText>}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="銀行帳號"
                  name="bankAccount"
                  value={formData.bankAccount}
                  onChange={handleChange}
                  placeholder="例：012-345-678901"
                />
              </Grid>
            </Grid>

            {/* 按鈕區 */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, gap: 2 }}>
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button
                variant="contained"
                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                type="submit"
                disabled={isSubmitting}
                sx={{ 
                  background: 'linear-gradient(137.48deg, #ffdb3b 10%, #fe53bb 45%, #8f51ea 67%, #0044ff 87%)',
                  transition: '0.5s',
                  '&:hover': {
                    transform: 'scale(1.05)',
                  }
                }}
              >
                {isSubmitting ? '處理中...' : '儲存'}
              </Button>
            </Box>
          </Box>
        </LocalizationProvider>
      </Paper>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSuccessMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSuccessMessage} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmployeeForm; 