import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Alert,
  Divider,
  Stack,
  SelectChangeEvent
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import { Store, StoreStatus, StoreAddress, StoreLocation, StoreContactInfo } from '../../types/store';
import { createStore, updateStore, getStoreById } from '../../services/storeService';

// 地圖組件（簡易版，實際項目中應引入完整的地圖組件）
const MapSelector: React.FC<{
  location: StoreLocation | undefined;
  onChange: (location: StoreLocation) => void;
  error?: string;
}> = ({ location, onChange, error }) => {
  return (
    <Box sx={{ 
      border: theme => `1px solid ${error ? theme.palette.error.main : theme.palette.divider}`,
      borderRadius: 1,
      p: 2,
      height: 200,
      bgcolor: 'background.paper',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Typography color="textSecondary" gutterBottom>
        地圖選點功能（示意）
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <TextField
            fullWidth
            size="small"
            label="緯度"
            type="number"
            value={location?.latitude || ''}
            onChange={(e) => onChange({ 
              latitude: parseFloat(e.target.value), 
              longitude: location?.longitude || 0 
            })}
            placeholder="例：25.0330"
            InputProps={{ inputProps: { step: 0.000001 } }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            size="small"
            label="經度"
            type="number"
            value={location?.longitude || ''}
            onChange={(e) => onChange({ 
              latitude: location?.latitude || 0, 
              longitude: parseFloat(e.target.value) 
            })}
            placeholder="例：121.5654"
            InputProps={{ inputProps: { step: 0.000001 } }}
          />
        </Grid>
      </Grid>
      {error && (
        <FormHelperText error>{error}</FormHelperText>
      )}
    </Box>
  );
};

interface StoreFormProps {
  storeId?: string; // 若為編輯模式，則提供分店ID
  onSuccess?: (store: Store) => void;
  onCancel?: () => void;
}

const StoreForm: React.FC<StoreFormProps> = ({ storeId, onSuccess, onCancel }) => {
  const navigate = useNavigate();
  const isEditMode = !!storeId;
  
  // 表單狀態
  const [formData, setFormData] = useState<Partial<Store>>({
    name: '',
    storeCode: '',
    status: 'inactive' as StoreStatus,
    description: '',
    address: {} as StoreAddress,
    location: undefined,
    contactInfo: {} as StoreContactInfo
  });
  
  // 表單驗證錯誤
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // 頁面狀態
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // 如果是編輯模式，獲取分店數據
  useEffect(() => {
    if (isEditMode && storeId) {
      const fetchStoreData = async () => {
        setIsLoading(true);
        setApiError(null);
        try {
          const storeData = await getStoreById(storeId);
          setFormData(storeData);
        } catch (error) {
          console.error('獲取分店數據失敗:', error);
          setApiError('無法獲取分店資料，請稍後再試。');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchStoreData();
    }
  }, [storeId, isEditMode]);
  
  // 處理輸入變更
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // 使用點表示法處理嵌套欄位
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as Record<string, unknown> || {}),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // 清除對應的錯誤
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // 處理選擇變更
  const handleSelectChange = (e: SelectChangeEvent<StoreStatus>) => {
    const name = e.target.name as string;
    const value = e.target.value;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 清除對應的錯誤
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  // 處理位置變更
  const handleLocationChange = (location: StoreLocation) => {
    setFormData(prev => ({
      ...prev,
      location
    }));
    
    // 清除對應的錯誤
    if (errors['location']) {
      setErrors(prev => ({
        ...prev,
        location: ''
      }));
    }
  };
  
  // 驗證表單
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // 基本驗證
    if (!formData.name?.trim()) {
      newErrors.name = '請輸入分店名稱';
    }
    
    if (!formData.storeCode?.trim()) {
      newErrors.storeCode = '請輸入分店代碼';
    }
    
    // 地址驗證
    if (!formData.address?.fullAddress?.trim()) {
      newErrors['address.fullAddress'] = '請輸入完整地址';
    }
    
    // 聯絡資訊驗證
    if (formData.contactInfo?.phone && !/^\d{6,15}$/.test(formData.contactInfo.phone)) {
      newErrors['contactInfo.phone'] = '請輸入有效的電話號碼';
    }
    
    if (formData.contactInfo?.email && !/\S+@\S+\.\S+/.test(formData.contactInfo.email)) {
      newErrors['contactInfo.email'] = '請輸入有效的電子郵件';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // 處理表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setApiError(null);
    
    try {
      let result;
      
      // 準備提交的數據
      const storeData = {
        ...formData,
        tenantId: formData.tenantId || 'default', // 根據實際應用設置租戶ID
      };
      
      // 根據模式調用不同的API
      if (isEditMode && storeId) {
        result = await updateStore(storeId, storeData);
      } else {
        result = await createStore(storeData as Omit<Store, 'id' | 'createdAt' | 'updatedAt'>);
      }
      
      // 成功處理
      if (onSuccess) {
        onSuccess(result);
      } else {
        // 導航到分店頁面
        navigate('/stores');
      }
    } catch (error) {
      console.error('保存分店失敗:', error);
      setApiError('保存分店時發生錯誤，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 處理取消
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/stores');
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
          {isEditMode ? '編輯分店資訊' : '新增分店'}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        {apiError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {apiError}
          </Alert>
        )}
        
        <Grid container spacing={3}>
          {/* 基本資訊 */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              基本資訊
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              required
              fullWidth
              label="分店名稱"
              name="name"
              value={formData.name || ''}
              onChange={handleInputChange}
              error={!!errors.name}
              helperText={errors.name}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              required
              fullWidth
              label="分店代碼"
              name="storeCode"
              value={formData.storeCode || ''}
              onChange={handleInputChange}
              error={!!errors.storeCode}
              helperText={errors.storeCode}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel id="status-label">營業狀態</InputLabel>
              <Select
                labelId="status-label"
                name="status"
                value={formData.status || 'inactive'}
                onChange={handleSelectChange}
                label="營業狀態"
              >
                <MenuItem value="active">營業中</MenuItem>
                <MenuItem value="inactive">未啟用</MenuItem>
                <MenuItem value="temporary_closed">暫停營業</MenuItem>
                <MenuItem value="permanently_closed">永久關閉</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="分店描述"
              name="description"
              value={formData.description || ''}
              onChange={handleInputChange}
              placeholder="輸入分店描述、特色或其他備註資訊"
            />
          </Grid>
          
          {/* 地址與位置 */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              地址與位置
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              required
              fullWidth
              label="完整地址"
              name="address.fullAddress"
              value={formData.address?.fullAddress || ''}
              onChange={handleInputChange}
              error={!!errors['address.fullAddress']}
              helperText={errors['address.fullAddress']}
              placeholder="完整地址（含縣市、區域、街道及門牌號）"
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="縣市"
              name="address.city"
              value={formData.address?.city || ''}
              onChange={handleInputChange}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="區域"
              name="address.state"
              value={formData.address?.state || ''}
              onChange={handleInputChange}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="郵遞區號"
              name="address.postalCode"
              value={formData.address?.postalCode || ''}
              onChange={handleInputChange}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              地圖選點
            </Typography>
            <MapSelector
              location={formData.location}
              onChange={handleLocationChange}
              error={errors.location}
            />
          </Grid>
          
          {/* 聯絡資訊 */}
          <Grid item xs={12} sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              聯絡資訊
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="聯絡電話"
              name="contactInfo.phone"
              value={formData.contactInfo?.phone || ''}
              onChange={handleInputChange}
              error={!!errors['contactInfo.phone']}
              helperText={errors['contactInfo.phone']}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="電子郵件"
              name="contactInfo.email"
              type="email"
              value={formData.contactInfo?.email || ''}
              onChange={handleInputChange}
              error={!!errors['contactInfo.email']}
              helperText={errors['contactInfo.email']}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="店長ID"
              name="contactInfo.managerId"
              value={formData.contactInfo?.managerId || ''}
              onChange={handleInputChange}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="店長姓名"
              name="contactInfo.managerName"
              value={formData.contactInfo?.managerName || ''}
              onChange={handleInputChange}
            />
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
        <LoadingButton
          type="submit"
          variant="contained"
          loading={isSubmitting}
          color="primary"
        >
          {isEditMode ? '儲存變更' : '新增分店'}
        </LoadingButton>
      </Stack>
    </Box>
  );
};

export default StoreForm; 