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
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  SelectChangeEvent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  IconButton,
  Tooltip,
  Chip,
  FormHelperText
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import LoadingButton from '@mui/lab/LoadingButton';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Store, StoreOperatingHours, StoreGpsFence, StorePrinterSettings } from '../../types/store';
import { updateStore, getStoreById } from '../../services/storeService';
import QuietHoursSettings from '../common/QuietHoursSettings';
import { NotificationPreferences } from '../../types/notification.types';

interface StoreSettingsFormProps {
  storeId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const StoreSettingsForm: React.FC<StoreSettingsFormProps> = ({ storeId, onSuccess, onCancel }) => {
  const navigate = useNavigate();
  
  // 獲取星期幾的顯示名稱
  const getDayName = (day: number): string => {
    const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    return days[day];
  };

  // 表單狀態
  const [formData, setFormData] = useState<Store | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | false>('operatingHours');
  
  // 專門用於處理通知設定的子狀態
  const [notificationSettings, setNotificationSettings] = useState<{
    quietHours: NotificationPreferences['quietHours'];
    autoAcceptOrders: boolean;
    minOrderAmount: number;
    supportTakeout: boolean;
    supportDelivery: boolean;
  }>({
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00'
    },
    autoAcceptOrders: true,
    minOrderAmount: 0,
    supportTakeout: true,
    supportDelivery: false
  });
  
  // 頁面狀態
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // 獲取分店數據
  useEffect(() => {
    const fetchStoreData = async () => {
      setIsLoading(true);
      setApiError(null);
      try {
        const storeData = await getStoreById(storeId);
        setFormData(storeData);
        
        // 初始化通知設定（實際上應該從專用的API獲取）
        // 這裡假設從Store對象中的某些欄位獲取，實際實現可能需要調整
        setNotificationSettings({
          quietHours: storeData.quietHours || {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00'
          },
          autoAcceptOrders: storeData.autoAcceptOrders || true,
          minOrderAmount: storeData.minOrderAmount || 0,
          supportTakeout: storeData.supportTakeout !== false,
          supportDelivery: !!storeData.supportDelivery
        });
        
        // 確保營業時間有完整的7天
        if (!storeData.operatingHours || storeData.operatingHours.length < 7) {
          const defaultHours: StoreOperatingHours[] = [];
          for (let i = 0; i < 7; i++) {
            // 查找是否已存在當天的營業時間設定
            const existingDayHours = storeData.operatingHours?.find(
              (hours) => hours.day === i
            );
            
            if (existingDayHours) {
              defaultHours.push(existingDayHours);
            } else {
              defaultHours.push({
                day: i,
                isOpen: i !== 0, // 默認週日休息，其他日營業
                openTime: '09:00',
                closeTime: '21:00'
              });
            }
          }
          
          setFormData({
            ...storeData,
            operatingHours: defaultHours
          });
        }
      } catch (error) {
        console.error('獲取分店數據失敗:', error);
        setApiError('無法獲取分店資料，請稍後再試。');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchStoreData();
  }, [storeId]);
  
  // 處理展開/收合區段
  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSection(isExpanded ? panel : false);
  };
  
  // 處理營業時間變更
  const handleOperatingHoursChange = (index: number, field: keyof StoreOperatingHours, value: unknown) => {
    if (!formData) return;
    
    const updatedHours = [...(formData.operatingHours || [])];
    
    // 檢查是否需要創建新的條目
    if (!updatedHours[index]) {
      updatedHours[index] = {
        day: index,
        isOpen: true,
        openTime: '09:00',
        closeTime: '21:00'
      };
    }
    
    updatedHours[index] = {
      ...updatedHours[index],
      [field]: value
    };
    
    setFormData({
      ...formData,
      operatingHours: updatedHours
    });
  };
  
  // 處理GPS圍欄設定變更
  const handleGpsFenceChange = (field: keyof StoreGpsFence, value: unknown) => {
    if (!formData) return;
    
    const updatedGpsFence: StoreGpsFence = {
      ...(formData.gpsFence || { enabled: false }),
      [field]: value
    };
    
    // 如果啟用狀態改變，確保其他欄位有默認值
    if (field === 'enabled' && value === true && !updatedGpsFence.radius) {
      updatedGpsFence.radius = 100; // 默認半徑100米
      
      // 如果沒有中心點，使用分店位置
      if (!updatedGpsFence.center && formData.location) {
        updatedGpsFence.center = { ...formData.location };
      }
    }
    
    setFormData({
      ...formData,
      gpsFence: updatedGpsFence
    });
  };
  
  // 處理打印機設定變更
  const handlePrinterSettingsChange = (field: string, value: unknown) => {
    if (!formData) return;
    
    // 處理嵌套欄位
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      
      const updatedPrinterSettings: StorePrinterSettings = {
        ...(formData.printerSettings || { enabled: false }),
        [parent]: {
          ...(formData.printerSettings?.[parent as keyof StorePrinterSettings] as object || {}),
          [child]: value
        }
      };
      
      setFormData({
        ...formData,
        printerSettings: updatedPrinterSettings
      });
    } else {
      const updatedPrinterSettings: StorePrinterSettings = {
        ...(formData.printerSettings || { enabled: false }),
        [field]: value
      };
      
      // 如果啟用狀態改變為 true
      if (field === 'enabled' && value === true) {
        // 設置一些默認值
        if (!updatedPrinterSettings.printerType) {
          updatedPrinterSettings.printerType = 'thermal';
        }
      }
      
      setFormData({
        ...formData,
        printerSettings: updatedPrinterSettings
      });
    }
  };
  
  // 處理通知偏好變更
  const handleQuietHoursChange = (quietHours: NotificationPreferences['quietHours']) => {
    setNotificationSettings(prev => ({
      ...prev,
      quietHours
    }));
  };
  
  // 處理訂單設定變更
  const handleOrderSettingsChange = (field: string, value: unknown) => {
    setNotificationSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // 處理數字輸入變更，確保數字型別
  const handleNumberInputChange = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
    
    if (field.startsWith('gpsFence.')) {
      const gpsFenceField = field.split('.')[1] as keyof StoreGpsFence;
      handleGpsFenceChange(gpsFenceField, value);
    } else if (field === 'minOrderAmount') {
      handleOrderSettingsChange(field, value);
    }
  };
  
  // 處理印表機設定中的印表機ID列表變更
  const handlePrinterIdsChange = (newPrinterIds: string[]) => {
    if (!formData) return;
    
    const updatedPrinterSettings: StorePrinterSettings = {
      ...(formData.printerSettings || { enabled: false }),
      printerIds: newPrinterIds
    };
    
    setFormData({
      ...formData,
      printerSettings: updatedPrinterSettings
    });
  };
  
  // 添加新的印表機ID
  const handleAddPrinterId = (printerId: string) => {
    if (!formData || !printerId.trim()) return;
    
    const currentPrinterIds = formData.printerSettings?.printerIds || [];
    if (!currentPrinterIds.includes(printerId)) {
      handlePrinterIdsChange([...currentPrinterIds, printerId.trim()]);
    }
    
    // 清空輸入框
    setNewPrinterId('');
  };
  
  // 刪除印表機ID
  const handleDeletePrinterId = (printerIdToDelete: string) => {
    if (!formData) return;
    
    const currentPrinterIds = formData.printerSettings?.printerIds || [];
    handlePrinterIdsChange(currentPrinterIds.filter(id => id !== printerIdToDelete));
  };
  
  // 控制新增印表機ID的輸入
  const [newPrinterId, setNewPrinterId] = useState('');
  const handleNewPrinterIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPrinterId(e.target.value);
  };
  
  const handlePrinterIdKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newPrinterId.trim()) {
      e.preventDefault();
      handleAddPrinterId(newPrinterId);
    }
  };
  
  // 處理表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData) return;
    
    setIsSubmitting(true);
    setApiError(null);
    
    try {
      // 準備提交的數據
      const storeData = {
        ...formData,
        // 整合通知設定（實際上可能需要通過單獨的API更新）
        quietHours: notificationSettings.quietHours,
        autoAcceptOrders: notificationSettings.autoAcceptOrders,
        minOrderAmount: notificationSettings.minOrderAmount,
        supportTakeout: notificationSettings.supportTakeout,
        supportDelivery: notificationSettings.supportDelivery
      };
      
      // 調用 API 更新分店設定
      await updateStore(storeId, storeData);
      
      // 成功處理
      if (onSuccess) {
        onSuccess();
      } else {
        // 導航回分店頁面
        navigate('/stores');
      }
    } catch (error) {
      console.error('保存分店設定失敗:', error);
      setApiError('保存分店設定時發生錯誤，請稍後再試。');
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
  
  if (isLoading || !formData) {
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
          分店設定 - {formData.name}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        {apiError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {apiError}
          </Alert>
        )}
        
        {/* 營業時間設定 */}
        <Accordion 
          expanded={expandedSection === 'operatingHours'} 
          onChange={handleAccordionChange('operatingHours')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="bold">營業時間設定</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {formData.operatingHours?.sort((a, b) => a.day - b.day).map((hours: StoreOperatingHours) => (
                <Grid item xs={12} key={hours.day}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={3}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={hours.isOpen}
                              onChange={(e) => handleOperatingHoursChange(hours.day, 'isOpen', e.target.checked)}
                            />
                          }
                          label={getDayName(hours.day)}
                        />
                      </Grid>
                      
                      {hours.isOpen && (
                        <>
                          <Grid item xs={12} sm={4.5}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                              <TimePicker
                                label="開始營業時間"
                                value={new Date(`2022-01-01T${hours.openTime || '09:00'}:00`)}
                                onChange={(newValue) => {
                                  if (newValue) {
                                    const hoursStr = newValue.getHours().toString().padStart(2, '0');
                                    const minutes = newValue.getMinutes().toString().padStart(2, '0');
                                    handleOperatingHoursChange(hours.day, 'openTime', `${hoursStr}:${minutes}`);
                                  }
                                }}
                                slotProps={{ textField: { fullWidth: true, variant: 'outlined', size: 'small' } }}
                              />
                            </LocalizationProvider>
                          </Grid>
                          <Grid item xs={12} sm={4.5}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                              <TimePicker
                                label="結束營業時間"
                                value={new Date(`2022-01-01T${hours.closeTime || '21:00'}:00`)}
                                onChange={(newValue) => {
                                  if (newValue) {
                                    const hoursStr = newValue.getHours().toString().padStart(2, '0');
                                    const minutes = newValue.getMinutes().toString().padStart(2, '0');
                                    handleOperatingHoursChange(hours.day, 'closeTime', `${hoursStr}:${minutes}`);
                                  }
                                }}
                                slotProps={{ textField: { fullWidth: true, variant: 'outlined', size: 'small' } }}
                              />
                            </LocalizationProvider>
                          </Grid>
                        </>
                      )}
                    </Grid>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
        
        {/* GPS 打卡圍欄設定 */}
        <Accordion 
          expanded={expandedSection === 'gpsFence'} 
          onChange={handleAccordionChange('gpsFence')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="bold">GPS 打卡圍欄設定</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.gpsFence?.enabled || false}
                  onChange={(e) => handleGpsFenceChange('enabled', e.target.checked)}
                />
              }
              label="啟用 GPS 打卡圍欄"
            />
            
            {formData.gpsFence?.enabled && (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="圍欄半徑 (米)"
                      type="number"
                      value={formData.gpsFence?.radius || 100}
                      onChange={(e) => handleNumberInputChange('gpsFence.radius', e as React.ChangeEvent<HTMLInputElement>)}
                      InputProps={{ inputProps: { min: 50, max: 1000 } }}
                      helperText="設定員工可打卡的範圍半徑 (50-1000米)"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      圍欄中心點
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="緯度"
                          type="number"
                          value={formData.gpsFence?.center?.latitude || formData.location?.latitude || ''}
                          InputProps={{ inputProps: { step: 0.000001 } }}
                          disabled
                          helperText="使用分店地理位置作為圍欄中心點"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="經度"
                          type="number"
                          value={formData.gpsFence?.center?.longitude || formData.location?.longitude || ''}
                          InputProps={{ inputProps: { step: 0.000001 } }}
                          disabled
                          helperText="使用分店地理位置作為圍欄中心點"
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
        
        {/* 訂單設定 */}
        <Accordion 
          expanded={expandedSection === 'orderSettings'} 
          onChange={handleAccordionChange('orderSettings')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="bold">訂單設定</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl component="fieldset">
                  <Typography variant="subtitle2" gutterBottom>
                    支援的取餐方式
                  </Typography>
                  <Grid container>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={notificationSettings.supportTakeout}
                            onChange={(e) => handleOrderSettingsChange('supportTakeout', e.target.checked)}
                          />
                        }
                        label="外帶自取"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={notificationSettings.supportDelivery}
                            onChange={(e) => handleOrderSettingsChange('supportDelivery', e.target.checked)}
                          />
                        }
                        label="外送"
                      />
                    </Grid>
                  </Grid>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="最低訂單金額"
                  type="number"
                  value={notificationSettings.minOrderAmount}
                  onChange={(e) => handleNumberInputChange('minOrderAmount', e as React.ChangeEvent<HTMLInputElement>)}
                  InputProps={{ inputProps: { min: 0 } }}
                  helperText="設定為0表示無最低訂單金額限制"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.autoAcceptOrders}
                      onChange={(e) => handleOrderSettingsChange('autoAcceptOrders', e.target.checked)}
                    />
                  }
                  label="自動接受訂單"
                />
                <Typography variant="caption" color="textSecondary" display="block">
                  啟用後，系統將自動接受新訂單，無需人工確認
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  勿擾時段設定
                </Typography>
                <QuietHoursSettings
                  quietHours={notificationSettings.quietHours}
                  onChange={handleQuietHoursChange}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
        
        {/* 印表機設定 */}
        <Accordion 
          expanded={expandedSection === 'printerSettings'} 
          onChange={handleAccordionChange('printerSettings')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="bold">印表機設定</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.printerSettings?.enabled || false}
                  onChange={(e) => handlePrinterSettingsChange('enabled', e.target.checked)}
                />
              }
              label="啟用印表機整合"
            />
            
            {formData.printerSettings?.enabled && (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="printer-type-label">印表機類型</InputLabel>
                      <Select
                        labelId="printer-type-label"
                        value={formData.printerSettings?.printerType || 'thermal'}
                        onChange={(e: SelectChangeEvent) => handlePrinterSettingsChange('printerType', e.target.value)}
                        label="印表機類型"
                      >
                        <MenuItem value="thermal">熱感印表機</MenuItem>
                        <MenuItem value="label">標籤印表機</MenuItem>
                        <MenuItem value="normal">一般印表機</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="印表機 API 金鑰"
                      value={formData.printerSettings?.apiKey || ''}
                      onChange={(e) => handlePrinterSettingsChange('apiKey', e.target.value)}
                      placeholder="輸入雲端印表機服務 API 金鑰"
                      helperText="用於與印表機服務提供商進行認證"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="API 端點 URL"
                      value={formData.printerSettings?.apiUrl || ''}
                      onChange={(e) => handlePrinterSettingsChange('apiUrl', e.target.value)}
                      placeholder="例: https://printer-api.example.com/print"
                      helperText="雲端印表機服務的 API 基礎 URL"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      印表機 ID 列表
                      <Tooltip title="添加該分店可用的印表機 ID，每個印表機 ID 應對應雲端印表機服務中已註冊的設備">
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs>
                          <TextField
                            fullWidth
                            label="新增印表機 ID"
                            size="small"
                            value={newPrinterId}
                            onChange={handleNewPrinterIdChange}
                            onKeyDown={handlePrinterIdKeyDown}
                            placeholder="輸入印表機 ID 並按 Enter 添加"
                          />
                        </Grid>
                        <Grid item>
                          <Button
                            variant="outlined"
                            size="medium"
                            startIcon={<AddIcon />}
                            onClick={() => handleAddPrinterId(newPrinterId)}
                            disabled={!newPrinterId.trim()}
                          >
                            添加
                          </Button>
                        </Grid>
                      </Grid>
                      <FormHelperText>
                        輸入印表機 ID 後按 Enter 或點擊添加按鈕
                      </FormHelperText>
                    </Box>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {(formData.printerSettings?.printerIds || []).length > 0 ? (
                        formData.printerSettings?.printerIds?.map((printerId) => (
                          <Chip
                            key={printerId}
                            label={printerId}
                            onDelete={() => handleDeletePrinterId(printerId)}
                            color="primary"
                            variant="outlined"
                          />
                        ))
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          尚未添加任何印表機 ID
                        </Typography>
                      )}
                    </Box>
                    <FormHelperText>
                      這些印表機 ID 將用於識別分店可用的印表機設備
                    </FormHelperText>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      列印範本設定
                      <Tooltip title="設置不同類型的列印範本，用於客戶收據、廚房通知和外送單據等">
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="收據範本 ID"
                          value={formData.printerSettings?.templates?.receipt || ''}
                          onChange={(e) => handlePrinterSettingsChange('templates.receipt', e.target.value)}
                          placeholder="例: receipt_template_001"
                          helperText="用於顧客收據列印的範本 ID"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="廚房通知範本 ID"
                          value={formData.printerSettings?.templates?.kitchen || ''}
                          onChange={(e) => handlePrinterSettingsChange('templates.kitchen', e.target.value)}
                          placeholder="例: kitchen_template_001"
                          helperText="用於廚房訂單通知的範本 ID"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="外送單據範本 ID"
                          value={formData.printerSettings?.templates?.takeout || ''}
                          onChange={(e) => handlePrinterSettingsChange('templates.takeout', e.target.value)}
                          placeholder="例: takeout_template_001"
                          helperText="用於外送/外帶訂單的範本 ID"
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
        
        {/* 外部平台整合 */}
        <Accordion 
          expanded={expandedSection === 'externalIntegration'} 
          onChange={handleAccordionChange('externalIntegration')}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight="bold">外部平台整合</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="textSecondary" paragraph>
              設定外部訂餐平台的整合 ID，以便系統能正確處理來自外部平台的訂單
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Uber Eats 商店 ID"
                  placeholder="輸入 Uber Eats 平台的商店 ID"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="foodpanda 商店 ID"
                  placeholder="輸入 foodpanda 平台的商店 ID"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="DoorDash 商店 ID"
                  placeholder="輸入 DoorDash 平台的商店 ID"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="自訂平台 ID"
                  placeholder="輸入其他平台的商店 ID"
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
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
          儲存設定
        </LoadingButton>
      </Stack>
    </Box>
  );
};

export default StoreSettingsForm; 