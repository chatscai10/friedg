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
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { loyaltyService, LoyaltyTierRule } from '../../services/loyaltyService';
import { useNotification } from '../../contexts/NotificationContext';
import { handleApiError } from '../../utils/errorHandler';
import LoadingState from '../../components/common/LoadingState';
import EmptyState from '../../components/common/EmptyState';

const LoyaltyTierRulesPage: React.FC = () => {
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const [tierRules, setTierRules] = useState<LoyaltyTierRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTierRule, setEditingTierRule] = useState<Partial<LoyaltyTierRule> | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fetchTierRules = async () => {
    try {
      // 對於後續加載，保留現有狀態同時顯示loading
      if (!firstLoad) {
        setLoading(true);
      }
      setError(null);
      
      const rules = await loyaltyService.listTierRules();
      setTierRules(rules);
    } catch (error) {
      console.error('Error fetching tier rules:', error);
      const errorMsg = handleApiError(error);
      setError(errorMsg || '獲取等級規則失敗，請稍後再試');
      
      // 只在API錯誤時顯示通知，避免重複的通知
      if (!firstLoad) {
        showErrorNotification('獲取等級規則失敗');
      }
      
      // 如果是首次加載出錯，保留一個空數組讓用戶可以看到空狀態
      if (firstLoad) {
        setTierRules([]);
      }
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  };

  useEffect(() => {
    fetchTierRules();
  }, []);

  const handleAddNew = () => {
    setEditingTierRule({
      name: '',
      displayName: '',
      level: 1,
      pointsThreshold: 0,
      pointsMultiplier: 1.0,
      validityPeriod: 365,
      renewalPolicy: 'automatic',
      isActive: true,
    });
    setValidationErrors({});
    setOpenDialog(true);
  };

  const handleEdit = (rule: LoyaltyTierRule) => {
    setEditingTierRule({ ...rule });
    setValidationErrors({});
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setEditingTierRule(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!editingTierRule?.name) errors.name = '請輸入等級名稱';
    if (!editingTierRule?.displayName) errors.displayName = '請輸入顯示名稱';
    if (!editingTierRule?.level && editingTierRule?.level !== 0) errors.level = '請輸入等級數值';
    if (editingTierRule?.pointsThreshold === undefined) errors.pointsThreshold = '請輸入積分門檻';
    if (!editingTierRule?.pointsMultiplier) errors.pointsMultiplier = '請輸入積分倍數';
    if (!editingTierRule?.validityPeriod) errors.validityPeriod = '請輸入有效期';
    if (!editingTierRule?.renewalPolicy) errors.renewalPolicy = '請選擇續期政策';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (editingTierRule?.tierId) {
        // 更新現有等級規則
        await loyaltyService.updateTierRule(
          editingTierRule.tierId,
          editingTierRule as Partial<LoyaltyTierRule>
        );
        showSuccessNotification('等級規則更新成功');
      } else {
        // 創建新等級規則
        await loyaltyService.createTierRule(
          editingTierRule as Omit<LoyaltyTierRule, 'tierId' | 'createdAt' | 'updatedAt'>
        );
        showSuccessNotification('等級規則創建成功');
      }
      handleClose();
      fetchTierRules();
    } catch (error) {
      console.error('Error saving tier rule:', error);
      showErrorNotification(handleApiError(error));
    }
  };

  const handleFieldChange = (field: string, value: string | number | boolean | string[]) => {
    setEditingTierRule((prev) => ({
      ...prev,
      [field]: value,
    }));
    
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
      return <LoadingState message="載入等級規則..." size="large" fullPage />;
    }
    
    // 後續更新加載中
    if (loading) {
      return (
        <Box>
          {tierRules.length > 0 ? (
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
    if (error && tierRules.length === 0) {
      return (
        <EmptyState 
          icon={TrophyIcon}
          title="無法載入等級規則"
          message={error}
          actionText="重試"
          onAction={fetchTierRules}
        />
      );
    }
    
    // 無數據狀態
    if (tierRules.length === 0) {
      return (
        <EmptyState 
          icon={TrophyIcon}
          title="沒有等級規則"
          message="目前沒有任何等級規則，請點擊新增按鈕創建您的第一個等級規則"
          actionText="新增等級規則"
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
              <TableCell>等級ID</TableCell>
              <TableCell>名稱</TableCell>
              <TableCell>顯示名稱</TableCell>
              <TableCell>等級數值</TableCell>
              <TableCell>積分門檻</TableCell>
              <TableCell>積分倍數</TableCell>
              <TableCell>有效期(天)</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tierRules.map((rule) => (
              <TableRow key={rule.tierId}>
                <TableCell>{rule.tierId}</TableCell>
                <TableCell>{rule.name}</TableCell>
                <TableCell>{rule.displayName}</TableCell>
                <TableCell>{rule.level}</TableCell>
                <TableCell>{rule.pointsThreshold}</TableCell>
                <TableCell>{rule.pointsMultiplier}x</TableCell>
                <TableCell>{rule.validityPeriod}</TableCell>
                <TableCell>
                  <Chip 
                    label={rule.isActive ? '啟用' : '停用'} 
                    color={rule.isActive ? 'success' : 'default'} 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="編輯">
                    <IconButton size="small" onClick={() => handleEdit(rule)}>
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
          會員等級規則管理
        </Typography>
        <Box>
          {!loading && tierRules.length > 0 && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={fetchTierRules}
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
            新增等級規則
          </Button>
        </Box>
      </Box>

      {/* 顯示非致命錯誤 - 當有數據但更新時出錯 */}
      {error && tierRules.length > 0 && (
        <Box mb={3}>
          <EmptyState 
            title={error}
            message="數據可能不是最新的，請點擊刷新按鈕重試"
            actionText="刷新數據"
            onAction={fetchTierRules}
            sx={{ py: 2, backgroundColor: 'error.light', borderRadius: 1 }}
          />
        </Box>
      )}

      {renderContent()}

      {/* 新增/編輯對話框 */}
      <Dialog open={openDialog} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTierRule?.tierId ? '編輯等級規則' : '新增等級規則'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="等級名稱"
                fullWidth
                margin="normal"
                value={editingTierRule?.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="顯示名稱"
                fullWidth
                margin="normal"
                value={editingTierRule?.displayName || ''}
                onChange={(e) => handleFieldChange('displayName', e.target.value)}
                error={!!validationErrors.displayName}
                helperText={validationErrors.displayName}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="等級數值"
                type="number"
                fullWidth
                margin="normal"
                value={editingTierRule?.level || 0}
                onChange={(e) => handleFieldChange('level', parseInt(e.target.value))}
                error={!!validationErrors.level}
                helperText={validationErrors.level}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="積分門檻"
                type="number"
                fullWidth
                margin="normal"
                value={editingTierRule?.pointsThreshold || 0}
                onChange={(e) => handleFieldChange('pointsThreshold', parseInt(e.target.value))}
                error={!!validationErrors.pointsThreshold}
                helperText={validationErrors.pointsThreshold}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="積分倍數"
                type="number"
                fullWidth
                margin="normal"
                value={editingTierRule?.pointsMultiplier || 1.0}
                onChange={(e) => handleFieldChange('pointsMultiplier', parseFloat(e.target.value))}
                error={!!validationErrors.pointsMultiplier}
                helperText={validationErrors.pointsMultiplier}
                InputProps={{
                  inputProps: { step: 0.1, min: 1 }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="有效期(天)"
                type="number"
                fullWidth
                margin="normal"
                value={editingTierRule?.validityPeriod || 365}
                onChange={(e) => handleFieldChange('validityPeriod', parseInt(e.target.value))}
                error={!!validationErrors.validityPeriod}
                helperText={validationErrors.validityPeriod}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal" error={!!validationErrors.renewalPolicy}>
                <InputLabel>續期政策</InputLabel>
                <Select
                  value={editingTierRule?.renewalPolicy || 'automatic'}
                  label="續期政策"
                  onChange={(e) => handleFieldChange('renewalPolicy', e.target.value)}
                >
                  <MenuItem value="automatic">自動續期</MenuItem>
                  <MenuItem value="points_check">積分重新檢查</MenuItem>
                  <MenuItem value="manual">手動管理</MenuItem>
                </Select>
                {validationErrors.renewalPolicy && (
                  <FormHelperText>{validationErrors.renewalPolicy}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editingTierRule?.isActive || false}
                    onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                    color="primary"
                  />
                }
                label="啟用等級規則"
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

export default LoyaltyTierRulesPage; 