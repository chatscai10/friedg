import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, IconButton, Chip, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, FormHelperText,
  Switch, FormControlLabel, Grid, Tooltip, Divider
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon,
  LocalOffer as CouponIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { couponService, CouponTemplate } from '../../services/couponService';
import { useNotification } from '../../contexts/NotificationContext';
import { handleApiError } from '../../utils/errorHandler';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';

const CouponTemplatesPage: React.FC = () => {
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const [templates, setTemplates] = useState<CouponTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<CouponTemplate> | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fetchTemplates = async () => {
    try {
      // 對於後續加載，保留現有狀態同時顯示loading
      if (!firstLoad) {
        setLoading(true);
      }
      setError(null);
      
      const data = await couponService.listTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
      const errorMsg = handleApiError(error);
      setError(errorMsg || '獲取優惠券模板失敗，請稍後再試');
      
      // 只在API錯誤時顯示通知，避免重複的通知
      if (!firstLoad) {
        showErrorNotification('獲取優惠券模板失敗');
      }
      
      // 如果是首次加載出錯，保留一個空數組讓用戶可以看到空狀態
      if (firstLoad) {
        setTemplates([]);
      }
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleAddNew = () => {
    // 設置默認值
    setEditingTemplate({
      name: '',
      description: '',
      type: 'percentage',
      value: 0,
      validityType: 'fixed',
      maxUsagePerCoupon: 1,
      constraints: {
        minOrderAmount: 0
      },
      distributionChannels: ['manual'],
      isActive: true
    });
    setValidationErrors({});
    setOpenDialog(true);
  };

  const handleEdit = (template: CouponTemplate) => {
    setEditingTemplate({ ...template });
    setValidationErrors({});
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
  };

  // 獲取優惠券類型顯示名稱
  const getCouponTypeDisplayName = (type: string): string => {
    switch (type) {
      case 'percentage': return '百分比折扣';
      case 'fixed': return '固定金額';
      case 'shipping': return '免運費';
      case 'freeItem': return '贈品';
      default: return type;
    }
  };

  // 格式化優惠券價值顯示
  const formatCouponValue = (template: CouponTemplate): string => {
    switch (template.type) {
      case 'percentage': return `${template.value}%`;
      case 'fixed': return `$${template.value}`;
      case 'shipping': return '免運費';
      case 'freeItem': return `贈品: ${template.value || ''}`;
      default: return `${template.value}`;
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!editingTemplate?.name) errors.name = '請輸入優惠券名稱';
    if (!editingTemplate?.description) errors.description = '請輸入優惠券描述';
    if (!editingTemplate?.type) errors.type = '請選擇優惠券類型';
    if (!editingTemplate?.value && editingTemplate?.value !== 0) errors.value = '請輸入優惠券價值';
    if (!editingTemplate?.validityType) errors.validityType = '請選擇有效期類型';
    
    if (editingTemplate?.validityType === 'fixed') {
      if (!editingTemplate?.validStartDate) errors.validStartDate = '請選擇開始日期';
      if (!editingTemplate?.validEndDate) errors.validEndDate = '請選擇結束日期';
    } else if (editingTemplate?.validityType === 'dynamic' && !editingTemplate?.validDays) {
      errors.validDays = '請輸入有效天數';
    }
    
    if (!editingTemplate?.maxUsagePerCoupon) errors.maxUsagePerCoupon = '請輸入每張優惠券使用次數上限';
    if (!editingTemplate?.distributionChannels || editingTemplate.distributionChannels.length === 0) {
      errors.distributionChannels = '請選擇發放渠道';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (editingTemplate?.templateId) {
        // 更新現有模板
        await couponService.updateTemplate(editingTemplate.templateId, editingTemplate);
        showSuccessNotification('優惠券模板更新成功');
      } else {
        // 創建新模板
        await couponService.createTemplate(editingTemplate as Omit<CouponTemplate, 'templateId' | 'createdAt' | 'updatedAt'>);
        showSuccessNotification('優惠券模板創建成功');
      }
      handleClose();
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      showErrorNotification(handleApiError(error));
    }
  };

  const handleFieldChange = (field: string, value: string | number | boolean | Date | object | ('system' | 'manual' | 'campaign' | 'birthday' | 'loyalty')[]) => {
    // 處理巢狀屬性
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setEditingTemplate((prev) => ({
        ...prev,
        [parent]: {
          ...(prev ? (prev[parent as keyof typeof prev] as object || {}) : {}),
          [child]: value
        }
      }));
    } else if (field === 'distributionChannels') {
      // 處理多選值
      setEditingTemplate((prev) => ({
        ...prev,
        distributionChannels: value as ('system' | 'manual' | 'campaign' | 'birthday' | 'loyalty')[]
      }));
    } else {
      setEditingTemplate((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
    
    // 清除該欄位的驗證錯誤
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // 處理分發渠道的選擇
  const handleDistributionChannelChange = (channel: 'system' | 'manual' | 'campaign' | 'birthday' | 'loyalty') => {
    if (!editingTemplate) return;
    
    const channels = editingTemplate.distributionChannels || [];
    const updatedChannels = channels.includes(channel) 
      ? channels.filter(c => c !== channel)
      : [...channels, channel];
    
    handleFieldChange('distributionChannels', updatedChannels);
  };

  const formatDistributionChannels = (channels: string[]) => {
    const map: Record<string, string> = {
      'system': '系統自動',
      'manual': '手動發放',
      'campaign': '活動',
      'birthday': '生日獎勵',
      'loyalty': '忠誠度兌換'
    };
    
    return channels.map(c => map[c] || c).join(', ');
  };

  // 渲染主要內容
  const renderContent = () => {
    // 首次加載中
    if (loading && firstLoad) {
      return <LoadingState message="載入優惠券模板..." size="large" fullPage />;
    }
    
    // 後續更新加載中
    if (loading) {
      return (
        <Box>
          {templates.length > 0 ? (
            // 如果有現有數據，在上方顯示loading指示器，同時保留原有表格
            <Box mb={2}>
              <LoadingState message="更新中..." size="small" />
            </Box>
          ) : (
            // 如果沒有現有數據，顯示全屏loading
            <LoadingState message="更新中..." size="medium" />
          )}
        </Box>
      );
    }
    
    // 處理錯誤情況 - 如果是首次加載錯誤，顯示錯誤空狀態
    if (error && templates.length === 0) {
      return (
        <EmptyState 
          icon={CouponIcon}
          title="無法載入優惠券模板"
          message={error}
          actionText="重試"
          onAction={fetchTemplates}
        />
      );
    }
    
    // 無數據狀態
    if (templates.length === 0) {
      return (
        <EmptyState 
          icon={CouponIcon}
          title="沒有優惠券模板"
          message="目前沒有任何優惠券模板，請點擊新增按鈕創建您的第一個優惠券模板"
          actionText="新增優惠券模板"
          onAction={handleAddNew}
        />
      );
    }
    
    // 顯示數據表格
    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>模板ID</TableCell>
              <TableCell>名稱</TableCell>
              <TableCell>類型</TableCell>
              <TableCell>價值</TableCell>
              <TableCell>有效期</TableCell>
              <TableCell>使用限制</TableCell>
              <TableCell>發放渠道</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.templateId}>
                <TableCell>{template.templateId}</TableCell>
                <TableCell>{template.name}</TableCell>
                <TableCell>{getCouponTypeDisplayName(template.type)}</TableCell>
                <TableCell>{formatCouponValue(template)}</TableCell>
                <TableCell>
                  {template.validityType === 'fixed' && template.validStartDate && template.validEndDate ? 
                    `${new Date(template.validStartDate).toLocaleDateString()} - ${new Date(template.validEndDate).toLocaleDateString()}` :
                   template.validityType === 'dynamic' ? `領取後${template.validDays}天` : '-'}
                </TableCell>
                <TableCell>
                  {template.constraints?.minOrderAmount ? `最低訂單金額: $${template.constraints.minOrderAmount}` : '無限制'}
                </TableCell>
                <TableCell>{formatDistributionChannels(template.distributionChannels || [])}</TableCell>
                <TableCell>
                  <Chip 
                    label={template.isActive ? '啟用' : '停用'} 
                    color={template.isActive ? 'success' : 'default'} 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="編輯">
                    <IconButton size="small" onClick={() => handleEdit(template)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          優惠券模板管理
        </Typography>
        <Box>
          {!loading && templates.length > 0 && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={fetchTemplates}
              sx={{ mr: 2 }}
            >
              刷新
            </Button>
          )}
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddNew}
          >
            新增模板
          </Button>
        </Box>
      </Box>

      {/* 顯示非致命錯誤 - 當有數據但更新時出錯 */}
      {error && templates.length > 0 && (
        <Box mb={3}>
          <EmptyState 
            title={error}
            message="數據可能不是最新的，請點擊刷新按鈕重試"
            actionText="刷新數據"
            onAction={fetchTemplates}
            sx={{ py: 2, backgroundColor: 'error.light', borderRadius: 1 }}
          />
        </Box>
      )}

      {renderContent()}

      {/* 保留現有的對話框內容 */}
      <Dialog open={openDialog} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate?.templateId ? '編輯優惠券模板' : '新增優惠券模板'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="名稱"
                fullWidth
                margin="normal"
                value={editingTemplate?.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal" error={!!validationErrors.type}>
                <InputLabel>優惠券類型</InputLabel>
                <Select
                  value={editingTemplate?.type || ''}
                  onChange={(e) => handleFieldChange('type', e.target.value)}
                  label="優惠券類型"
                >
                  <MenuItem value="percentage">百分比折扣</MenuItem>
                  <MenuItem value="fixed">固定金額折扣</MenuItem>
                  <MenuItem value="freeItem">贈品</MenuItem>
                  <MenuItem value="shipping">免運費</MenuItem>
                </Select>
                {validationErrors.type && (
                  <FormHelperText>{validationErrors.type}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="描述"
                fullWidth
                multiline
                rows={2}
                margin="normal"
                value={editingTemplate?.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                error={!!validationErrors.description}
                helperText={validationErrors.description}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={editingTemplate?.type === 'percentage' ? '折扣百分比 (%)' : '折扣金額/價值'}
                type="number"
                fullWidth
                margin="normal"
                value={editingTemplate?.value || ''}
                onChange={(e) => handleFieldChange('value', parseFloat(e.target.value))}
                error={!!validationErrors.value}
                helperText={validationErrors.value}
                inputProps={editingTemplate?.type === 'percentage' ? { min: 0, max: 100 } : { min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal" error={!!validationErrors.validityType}>
                <InputLabel>有效期類型</InputLabel>
                <Select
                  value={editingTemplate?.validityType || ''}
                  onChange={(e) => handleFieldChange('validityType', e.target.value)}
                  label="有效期類型"
                >
                  <MenuItem value="fixed">固定日期</MenuItem>
                  <MenuItem value="dynamic">動態天數</MenuItem>
                </Select>
                {validationErrors.validityType && (
                  <FormHelperText>{validationErrors.validityType}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* 根據有效期類型顯示不同欄位 */}
            {editingTemplate?.validityType === 'fixed' ? (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="開始日期"
                    type="date"
                    fullWidth
                    margin="normal"
                    value={editingTemplate?.validStartDate instanceof Date 
                      ? editingTemplate.validStartDate.toISOString().split('T')[0]
                      : editingTemplate?.validStartDate || ''}
                    onChange={(e) => handleFieldChange('validStartDate', e.target.value)}
                    error={!!validationErrors.validStartDate}
                    helperText={validationErrors.validStartDate}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="結束日期"
                    type="date"
                    fullWidth
                    margin="normal"
                    value={editingTemplate?.validEndDate instanceof Date 
                      ? editingTemplate.validEndDate.toISOString().split('T')[0]
                      : editingTemplate?.validEndDate || ''}
                    onChange={(e) => handleFieldChange('validEndDate', e.target.value)}
                    error={!!validationErrors.validEndDate}
                    helperText={validationErrors.validEndDate}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </>
            ) : (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="有效天數"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={editingTemplate?.validDays || ''}
                  onChange={(e) => handleFieldChange('validDays', parseInt(e.target.value))}
                  error={!!validationErrors.validDays}
                  helperText={validationErrors.validDays || '發放後的有效天數'}
                  inputProps={{ min: 1 }}
                />
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                label="發行上限"
                type="number"
                fullWidth
                margin="normal"
                value={editingTemplate?.maxIssueCount || ''}
                onChange={(e) => handleFieldChange('maxIssueCount', parseInt(e.target.value))}
                helperText="選填，此模板發放的總數量上限"
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="每張使用次數"
                type="number"
                fullWidth
                margin="normal"
                value={editingTemplate?.maxUsagePerCoupon || ''}
                onChange={(e) => handleFieldChange('maxUsagePerCoupon', parseInt(e.target.value))}
                error={!!validationErrors.maxUsagePerCoupon}
                helperText={validationErrors.maxUsagePerCoupon || '每張優惠券可使用的次數'}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="每人領取限制"
                type="number"
                fullWidth
                margin="normal"
                value={editingTemplate?.maxUsagePerMember || ''}
                onChange={(e) => handleFieldChange('maxUsagePerMember', parseInt(e.target.value))}
                helperText="選填，每位會員可領取的數量"
                inputProps={{ min: 0 }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                使用限制
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="最低訂單金額"
                type="number"
                fullWidth
                margin="normal"
                value={editingTemplate?.constraints?.minOrderAmount || ''}
                onChange={(e) => handleFieldChange('constraints.minOrderAmount', parseFloat(e.target.value))}
                helperText="選填，使用此優惠券的最低訂單金額"
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="最高折扣金額"
                type="number"
                fullWidth
                margin="normal"
                value={editingTemplate?.constraints?.maxDiscountAmount || ''}
                onChange={(e) => handleFieldChange('constraints.maxDiscountAmount', parseFloat(e.target.value))}
                helperText="選填，百分比折扣最高可折扣的金額"
                inputProps={{ min: 0 }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                發放渠道
              </Typography>
              <FormControl error={!!validationErrors.distributionChannels} fullWidth>
                <Grid container spacing={1}>
                  <Grid item>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editingTemplate?.distributionChannels?.includes('manual') || false}
                          onChange={() => handleDistributionChannelChange('manual')}
                          color="primary"
                        />
                      }
                      label="手動發放"
                    />
                  </Grid>
                  <Grid item>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editingTemplate?.distributionChannels?.includes('system') || false}
                          onChange={() => handleDistributionChannelChange('system')}
                          color="primary"
                        />
                      }
                      label="系統自動"
                    />
                  </Grid>
                  <Grid item>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editingTemplate?.distributionChannels?.includes('campaign') || false}
                          onChange={() => handleDistributionChannelChange('campaign')}
                          color="primary"
                        />
                      }
                      label="活動"
                    />
                  </Grid>
                  <Grid item>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editingTemplate?.distributionChannels?.includes('birthday') || false}
                          onChange={() => handleDistributionChannelChange('birthday')}
                          color="primary"
                        />
                      }
                      label="生日獎勵"
                    />
                  </Grid>
                  <Grid item>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={editingTemplate?.distributionChannels?.includes('loyalty') || false}
                          onChange={() => handleDistributionChannelChange('loyalty')}
                          color="primary"
                        />
                      }
                      label="忠誠度兌換"
                    />
                  </Grid>
                </Grid>
                {validationErrors.distributionChannels && (
                  <FormHelperText>{validationErrors.distributionChannels}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!editingTemplate?.isActive}
                    onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                    color="primary"
                  />
                }
                label="啟用此模板"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="inherit">
            取消
          </Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            儲存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CouponTemplatesPage; 