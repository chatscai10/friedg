import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, IconButton, Chip, 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem, FormHelperText,
  Switch, FormControlLabel, Grid, Tooltip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon,
  CardGiftcard as GiftIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { loyaltyService, LoyaltyReward } from '../../services/loyaltyService';
import { useNotification } from '../../contexts/NotificationContext';
import { handleApiError } from '../../utils/errorHandler';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';

const LoyaltyRewardsPage: React.FC = () => {
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReward, setEditingReward] = useState<Partial<LoyaltyReward> | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [tierRules, setTierRules] = useState<{tierId: string; name: string}[]>([]);
  
  // 獲取獎勵列表
  const fetchRewards = async () => {
    try {
      // 對於後續加載，保留現有狀態同時顯示loading
      if (!firstLoad) {
        setLoading(true);
      }
      setError(null);
      
      const data = await loyaltyService.listRewards();
      setRewards(data);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      const errorMsg = handleApiError(error);
      setError(errorMsg || '獲取獎勵列表失敗，請稍後再試');
      
      // 只在API錯誤時顯示通知，避免重複的通知
      if (!firstLoad) {
        showErrorNotification('獲取獎勵列表失敗');
      }
      
      // 如果是首次加載出錯，保留一個空數組讓用戶可以看到空狀態
      if (firstLoad) {
        setRewards([]);
      }
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  };

  // 獲取等級規則列表
  const fetchTierRules = async () => {
    try {
      const rules = await loyaltyService.listTierRules();
      setTierRules(rules.map(rule => ({ tierId: rule.tierId, name: rule.displayName })));
    } catch (error) {
      console.error('Error fetching tier rules:', error);
      showErrorNotification(handleApiError(error));
    }
  };

  useEffect(() => {
    fetchRewards();
    fetchTierRules();
  }, []);

  const handleAddNew = () => {
    const now = new Date();
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    
    setEditingReward({
      name: '',
      description: '',
      type: 'coupon',
      pointsCost: 100,
      value: 0,
      details: {},
      startDate: now,
      endDate: oneMonthLater,
      isActive: true,
    });
    setValidationErrors({});
    setOpenDialog(true);
  };

  const handleEdit = (reward: LoyaltyReward) => {
    setEditingReward({ ...reward });
    setValidationErrors({});
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setEditingReward(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!editingReward?.name) errors.name = '請輸入獎勵名稱';
    if (!editingReward?.description) errors.description = '請輸入獎勵描述';
    if (!editingReward?.type) errors.type = '請選擇獎勵類型';
    if (!editingReward?.pointsCost && editingReward?.pointsCost !== 0) errors.pointsCost = '請輸入所需積分';
    if (!editingReward?.value && editingReward?.value !== 0) errors.value = '請輸入獎勵價值';
    
    // 類型特定驗證
    if (editingReward?.type === 'coupon') {
      if (!editingReward.details?.couponType) {
        errors['details.couponType'] = '請選擇優惠券類型';
      }
      if (!editingReward.details?.discountValue && editingReward.details?.discountValue !== 0) {
        errors['details.discountValue'] = '請輸入折扣值';
      }
    } else if (editingReward?.type === 'product' && !editingReward.details?.productId) {
      errors['details.productId'] = '請選擇商品';
    } else if (editingReward?.type === 'service' && !editingReward.details?.serviceId) {
      errors['details.serviceId'] = '請選擇服務';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (editingReward?.rewardId) {
        // 更新現有獎勵
        await loyaltyService.updateReward(
          editingReward.rewardId,
          editingReward as Partial<LoyaltyReward>
        );
        showSuccessNotification('獎勵更新成功');
      } else {
        // 創建新獎勵
        await loyaltyService.createReward(
          editingReward as Omit<LoyaltyReward, 'rewardId' | 'createdAt' | 'updatedAt'>
        );
        showSuccessNotification('獎勵創建成功');
      }
      handleClose();
      fetchRewards();
    } catch (error) {
      console.error('Error saving reward:', error);
      showErrorNotification(handleApiError(error));
    }
  };

  const handleFieldChange = (field: string, value: unknown) => {
    // 處理巢狀屬性
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setEditingReward((prev) => ({
        ...prev,
        [parent]: {
          ...((prev?.[parent as keyof typeof prev] as Record<string, unknown>) || {}),
          [child]: value
        }
      }));
    } else {
      setEditingReward((prev) => ({
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

  // 渲染主要內容
  const renderContent = () => {
    // 首次加載中
    if (loading && firstLoad) {
      return <LoadingState message="載入忠誠度獎勵..." size="large" fullPage />;
    }
    
    // 後續更新加載中
    if (loading) {
      return (
        <Box>
          {rewards.length > 0 ? (
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
    if (error && rewards.length === 0) {
      return (
        <EmptyState 
          icon={GiftIcon}
          title="無法載入獎勵項目"
          message={error}
          actionText="重試"
          onAction={fetchRewards}
        />
      );
    }
    
    // 無數據狀態
    if (rewards.length === 0) {
      return (
        <EmptyState 
          icon={GiftIcon}
          title="沒有獎勵項目"
          message="目前沒有任何忠誠度獎勵項目，請點擊新增按鈕創建您的第一個獎勵"
          actionText="新增獎勵"
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
              <TableCell>獎勵ID</TableCell>
              <TableCell>名稱</TableCell>
              <TableCell>所需積分</TableCell>
              <TableCell>類型</TableCell>
              <TableCell>價值</TableCell>
              <TableCell>開始日期</TableCell>
              <TableCell>結束日期</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rewards.map((reward) => (
              <TableRow key={reward.rewardId}>
                <TableCell>{reward.rewardId}</TableCell>
                <TableCell>{reward.name}</TableCell>
                <TableCell>{reward.pointsCost}</TableCell>
                <TableCell>
                  {reward.type === 'coupon' ? '優惠券' : 
                   reward.type === 'product' ? '商品' : 
                   reward.type === 'service' ? '服務' : 
                   reward.type}
                </TableCell>
                <TableCell>${reward.value}</TableCell>
                <TableCell>{reward.startDate ? new Date(reward.startDate).toLocaleDateString() : '-'}</TableCell>
                <TableCell>{reward.endDate ? new Date(reward.endDate).toLocaleDateString() : '-'}</TableCell>
                <TableCell>
                  <Chip 
                    label={reward.isActive ? '啟用' : '停用'} 
                    color={reward.isActive ? 'success' : 'default'} 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="編輯">
                    <IconButton size="small" onClick={() => handleEdit(reward)}>
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
          忠誠度獎勵管理
        </Typography>
        <Box>
          {!loading && rewards.length > 0 && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={fetchRewards}
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
            新增獎勵
          </Button>
        </Box>
      </Box>

      {/* 顯示非致命錯誤 - 當有數據但更新時出錯 */}
      {error && rewards.length > 0 && (
        <Box mb={3}>
          <EmptyState 
            title={error}
            message="數據可能不是最新的，請點擊刷新按鈕重試"
            actionText="刷新數據"
            onAction={fetchRewards}
            sx={{ py: 2, backgroundColor: 'error.light', borderRadius: 1 }}
          />
        </Box>
      )}

      {renderContent()}

      {/* 新增/編輯對話框 */}
      <Dialog open={openDialog} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingReward?.rewardId ? '編輯獎勵' : '新增獎勵'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="獎勵名稱"
                fullWidth
                margin="normal"
                value={editingReward?.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="獎勵描述"
                fullWidth
                multiline
                rows={2}
                margin="normal"
                value={editingReward?.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                error={!!validationErrors.description}
                helperText={validationErrors.description}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="所需積分"
                type="number"
                fullWidth
                margin="normal"
                value={editingReward?.pointsCost || ''}
                onChange={(e) => handleFieldChange('pointsCost', parseInt(e.target.value))}
                error={!!validationErrors.pointsCost}
                helperText={validationErrors.pointsCost}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal" error={!!validationErrors.type}>
                <InputLabel>獎勵類型</InputLabel>
                <Select
                  value={editingReward?.type || ''}
                  onChange={(e) => handleFieldChange('type', e.target.value)}
                  label="獎勵類型"
                >
                  <MenuItem value="coupon">優惠券</MenuItem>
                  <MenuItem value="product">商品</MenuItem>
                  <MenuItem value="service">服務</MenuItem>
                  <MenuItem value="discount">折扣</MenuItem>
                </Select>
                {validationErrors.type && (
                  <FormHelperText>{validationErrors.type}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="獎勵價值"
                type="number"
                fullWidth
                margin="normal"
                value={editingReward?.value || ''}
                onChange={(e) => handleFieldChange('value', parseFloat(e.target.value))}
                error={!!validationErrors.value}
                helperText={validationErrors.value}
              />
            </Grid>

            {/* 根據獎勵類型顯示不同的欄位 */}
            {editingReward?.type === 'coupon' && (
              <>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth margin="normal" error={!!validationErrors['details.couponType']}>
                    <InputLabel>優惠券類型</InputLabel>
                    <Select
                      value={editingReward.details?.couponType || ''}
                      onChange={(e) => handleFieldChange('details.couponType', e.target.value)}
                      label="優惠券類型"
                    >
                      <MenuItem value="percentage">百分比折扣</MenuItem>
                      <MenuItem value="fixed">固定金額折扣</MenuItem>
                    </Select>
                    {validationErrors['details.couponType'] && (
                      <FormHelperText>{validationErrors['details.couponType']}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={editingReward.details?.couponType === 'percentage' ? '折扣百分比 (%)' : '折扣金額'}
                    type="number"
                    fullWidth
                    margin="normal"
                    value={editingReward.details?.discountValue || ''}
                    onChange={(e) => handleFieldChange('details.discountValue', parseFloat(e.target.value))}
                    error={!!validationErrors['details.discountValue']}
                    helperText={validationErrors['details.discountValue']}
                    inputProps={editingReward.details?.couponType === 'percentage' ? { min: 0, max: 100 } : { min: 0 }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="有效天數"
                    type="number"
                    fullWidth
                    margin="normal"
                    value={editingReward.details?.validDays || ''}
                    onChange={(e) => handleFieldChange('details.validDays', parseInt(e.target.value))}
                    helperText="兌換後的有效期天數"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="最低訂單金額"
                    type="number"
                    fullWidth
                    margin="normal"
                    value={editingReward.details?.minOrderAmount || ''}
                    onChange={(e) => handleFieldChange('details.minOrderAmount', parseFloat(e.target.value))}
                    helperText="選填，使用此優惠券的最低訂單金額"
                  />
                </Grid>
              </>
            )}

            {editingReward?.type === 'product' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="商品ID"
                  fullWidth
                  margin="normal"
                  value={editingReward.details?.productId || ''}
                  onChange={(e) => handleFieldChange('details.productId', e.target.value)}
                  error={!!validationErrors['details.productId']}
                  helperText={validationErrors['details.productId'] || '可兌換的商品ID'}
                />
              </Grid>
            )}

            {editingReward?.type === 'service' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="服務ID"
                  fullWidth
                  margin="normal"
                  value={editingReward.details?.serviceId || ''}
                  onChange={(e) => handleFieldChange('details.serviceId', e.target.value)}
                  error={!!validationErrors['details.serviceId']}
                  helperText={validationErrors['details.serviceId'] || '可兌換的服務ID'}
                />
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                label="開始日期"
                type="date"
                fullWidth
                margin="normal"
                value={editingReward?.startDate instanceof Date 
                  ? editingReward.startDate.toISOString().split('T')[0]
                  : ''}
                onChange={(e) => handleFieldChange('startDate', new Date(e.target.value))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="結束日期"
                type="date"
                fullWidth
                margin="normal"
                value={editingReward?.endDate instanceof Date 
                  ? editingReward.endDate.toISOString().split('T')[0] 
                  : ''}
                onChange={(e) => handleFieldChange('endDate', new Date(e.target.value))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="獎勵總數量"
                type="number"
                fullWidth
                margin="normal"
                value={editingReward?.totalStock || ''}
                onChange={(e) => handleFieldChange('totalStock', parseInt(e.target.value))}
                helperText="選填，不填則無限制"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="每會員限制"
                type="number"
                fullWidth
                margin="normal"
                value={editingReward?.limitPerMember || ''}
                onChange={(e) => handleFieldChange('limitPerMember', parseInt(e.target.value))}
                helperText="選填，每位會員可兌換次數限制"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>最低會員等級</InputLabel>
                <Select
                  value={editingReward?.minimumTier || ''}
                  onChange={(e) => handleFieldChange('minimumTier', e.target.value)}
                  label="最低會員等級"
                >
                  <MenuItem value="">無限制</MenuItem>
                  {tierRules.map(tier => (
                    <MenuItem key={tier.tierId} value={tier.tierId}>
                      {tier.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>選填，限定特定等級以上會員可兌換</FormHelperText>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!editingReward?.isActive}
                    onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                    color="primary"
                  />
                }
                label="啟用此獎勵"
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

export default LoyaltyRewardsPage; 