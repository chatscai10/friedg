/**
 * 備份頁面
 * 用於管理系統數據備份
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  SelectChangeEvent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  CloudDownload as CloudDownloadIcon,
  Settings as SettingsIcon,
  Schedule as ScheduleIcon,
  Save as SaveIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { 
  BackupService,
  BackupType,
  BackupStatus,
  BackupRecord,
  BackupConfig
} from '../../services/monitoring';
import { formatDate, formatDateTime, formatTime, formatFileSize } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';

/**
 * 備份頁面
 */
const BackupPage: React.FC = () => {
  const { currentUser } = useAuth();
  
  // 頁面狀態
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // 備份記錄
  const [backupRecords, setBackupRecords] = useState<BackupRecord[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);
  
  // 備份配置
  const [backupConfig, setBackupConfig] = useState<BackupConfig | null>(null);
  
  // 對話框狀態
  const [createDialogOpen, setCreateDialogOpen] = useState<boolean>(false);
  const [configDialogOpen, setConfigDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState<boolean>(false);
  
  // 新備份表單
  const [newBackupType, setNewBackupType] = useState<BackupType>(BackupType.FULL);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  
  // 分頁
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  
  // 可用的集合列表
  const availableCollections = [
    'users',
    'stores',
    'employees',
    'products',
    'categories',
    'orders',
    'customers',
    'inventory',
    'attendanceRecords',
    'shifts',
    'payrolls',
    'settings',
    'auditLogs',
    'errorLogs'
  ];
  
  // 載入數據
  useEffect(() => {
    loadBackupRecords();
    loadBackupConfig();
  }, []);
  
  // 載入備份記錄
  const loadBackupRecords = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const records = await BackupService.getBackupRecords(
        rowsPerPage,
        page * rowsPerPage
      );
      setBackupRecords(records);
    } catch (err) {
      setError('載入備份記錄失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // 載入備份配置
  const loadBackupConfig = async () => {
    try {
      const config = await BackupService.getBackupConfig();
      setBackupConfig(config);
    } catch (err) {
      console.error('載入備份配置失敗:', err);
    }
  };
  
  // 處理刷新
  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([
      loadBackupRecords(),
      loadBackupConfig()
    ]).finally(() => {
      setRefreshing(false);
    });
  };
  
  // 處理頁碼變更
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    
    // 載入新頁數據
    BackupService.getBackupRecords(
      rowsPerPage,
      newPage * rowsPerPage
    ).then(records => {
      setBackupRecords(records);
    }).catch(err => {
      console.error('載入備份記錄失敗:', err);
    });
  };
  
  // 處理每頁行數變更
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    
    // 載入新頁數據
    BackupService.getBackupRecords(newRowsPerPage, 0).then(records => {
      setBackupRecords(records);
    }).catch(err => {
      console.error('載入備份記錄失敗:', err);
    });
  };
  
  // 處理創建備份
  const handleCreateBackup = async () => {
    if (!currentUser) return;
    
    try {
      setCreateDialogOpen(false);
      setLoading(true);
      
      await BackupService.createBackup(
        newBackupType,
        newBackupType === BackupType.COLLECTION ? selectedCollections : [],
        currentUser.uid
      );
      
      // 重新載入備份記錄
      await loadBackupRecords();
    } catch (err) {
      setError('創建備份失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // 處理刪除備份
  const handleDeleteBackup = async () => {
    if (!selectedBackup || !selectedBackup.id) return;
    
    try {
      setDeleteDialogOpen(false);
      setLoading(true);
      
      await BackupService.deleteBackup(selectedBackup.id);
      
      // 重新載入備份記錄
      await loadBackupRecords();
    } catch (err) {
      setError('刪除備份失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // 處理從備份恢復
  const handleRestoreFromBackup = async () => {
    if (!selectedBackup || !selectedBackup.id || !currentUser) return;
    
    try {
      setRestoreDialogOpen(false);
      setLoading(true);
      
      await BackupService.restoreFromBackup(
        selectedBackup.id,
        selectedCollections.length > 0 ? selectedCollections : undefined,
        currentUser.uid
      );
      
      // 顯示成功訊息
      setError('恢復操作已啟動，請稍後檢查恢復記錄');
    } catch (err) {
      setError('從備份恢復失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // 處理更新備份配置
  const handleUpdateBackupConfig = async () => {
    if (!backupConfig || !currentUser) return;
    
    try {
      setConfigDialogOpen(false);
      setLoading(true);
      
      await BackupService.updateBackupConfig({
        ...backupConfig,
        updatedBy: currentUser.uid
      });
      
      // 重新載入備份配置
      await loadBackupConfig();
    } catch (err) {
      setError('更新備份配置失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // 處理備份類型變更
  const handleBackupTypeChange = (event: SelectChangeEvent<string>) => {
    setNewBackupType(event.target.value as BackupType);
    
    // 如果不是集合備份，清空選擇的集合
    if (event.target.value !== BackupType.COLLECTION) {
      setSelectedCollections([]);
    }
  };
  
  // 處理集合選擇變更
  const handleCollectionToggle = (collection: string) => {
    const currentIndex = selectedCollections.indexOf(collection);
    const newSelectedCollections = [...selectedCollections];
    
    if (currentIndex === -1) {
      newSelectedCollections.push(collection);
    } else {
      newSelectedCollections.splice(currentIndex, 1);
    }
    
    setSelectedCollections(newSelectedCollections);
  };
  
  // 處理備份配置變更
  const handleBackupConfigChange = (field: string, value: any) => {
    if (!backupConfig) return;
    
    if (field.startsWith('schedule.')) {
      const scheduleField = field.split('.')[1];
      setBackupConfig({
        ...backupConfig,
        schedule: {
          ...backupConfig.schedule,
          [scheduleField]: value
        }
      });
    } else {
      setBackupConfig({
        ...backupConfig,
        [field]: value
      });
    }
  };
  
  // 渲染備份記錄表格
  const renderBackupRecordsTable = () => {
    return (
      <Paper variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>備份時間</TableCell>
                <TableCell>類型</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>檔案大小</TableCell>
                <TableCell>集合</TableCell>
                <TableCell>創建者</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : backupRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    沒有備份記錄
                  </TableCell>
                </TableRow>
              ) : (
                backupRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDateTime(record.startTime)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          record.type === BackupType.FULL ? '完整備份' :
                          record.type === BackupType.INCREMENTAL ? '增量備份' :
                          '集合備份'
                        }
                        color={
                          record.type === BackupType.FULL ? 'primary' :
                          record.type === BackupType.INCREMENTAL ? 'secondary' :
                          'default'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          record.status === BackupStatus.COMPLETED ? '已完成' :
                          record.status === BackupStatus.IN_PROGRESS ? '進行中' :
                          record.status === BackupStatus.PENDING ? '等待中' :
                          record.status === BackupStatus.FAILED ? '失敗' :
                          '已取消'
                        }
                        color={
                          record.status === BackupStatus.COMPLETED ? 'success' :
                          record.status === BackupStatus.IN_PROGRESS ? 'info' :
                          record.status === BackupStatus.PENDING ? 'warning' :
                          record.status === BackupStatus.FAILED ? 'error' :
                          'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{record.fileSize ? formatFileSize(record.fileSize) : '-'}</TableCell>
                    <TableCell>
                      {record.collections && record.collections.length > 0
                        ? `${record.collections.length} 個集合`
                        : '全部'}
                    </TableCell>
                    <TableCell>{record.createdBy}</TableCell>
                    <TableCell>
                      <Box>
                        <Tooltip title="從此備份恢復">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedBackup(record);
                              setSelectedCollections([]);
                              setRestoreDialogOpen(true);
                            }}
                            disabled={record.status !== BackupStatus.COMPLETED}
                          >
                            <CloudDownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="刪除備份">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedBackup(record);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={record.status === BackupStatus.IN_PROGRESS || record.status === BackupStatus.PENDING}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={backupRecords.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>
    );
  };
  
  // 渲染創建備份對話框
  const renderCreateBackupDialog = () => {
    return (
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          創建新備份
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>備份類型</InputLabel>
                <Select
                  value={newBackupType}
                  label="備份類型"
                  onChange={handleBackupTypeChange}
                >
                  <MenuItem value={BackupType.FULL}>完整備份</MenuItem>
                  <MenuItem value={BackupType.INCREMENTAL}>增量備份</MenuItem>
                  <MenuItem value={BackupType.COLLECTION}>集合備份</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {newBackupType === BackupType.COLLECTION && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  選擇要備份的集合
                </Typography>
                <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                  <List dense>
                    {availableCollections.map((collection) => (
                      <ListItem key={collection} button onClick={() => handleCollectionToggle(collection)}>
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={selectedCollections.indexOf(collection) !== -1}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemText primary={collection} />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
                {selectedCollections.length === 0 && newBackupType === BackupType.COLLECTION && (
                  <Typography variant="caption" color="error">
                    請至少選擇一個集合
                  </Typography>
                )}
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            取消
          </Button>
          <Button
            onClick={handleCreateBackup}
            color="primary"
            disabled={newBackupType === BackupType.COLLECTION && selectedCollections.length === 0}
          >
            創建
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  // 渲染刪除備份對話框
  const renderDeleteBackupDialog = () => {
    if (!selectedBackup) return null;
    
    return (
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          刪除備份
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1">
            確定要刪除以下備份嗎？此操作無法撤銷。
          </Typography>
          <Box mt={2}>
            <Typography variant="subtitle2">
              備份時間: {formatDateTime(selectedBackup.startTime)}
            </Typography>
            <Typography variant="subtitle2">
              備份類型: {
                selectedBackup.type === BackupType.FULL ? '完整備份' :
                selectedBackup.type === BackupType.INCREMENTAL ? '增量備份' :
                '集合備份'
              }
            </Typography>
            <Typography variant="subtitle2">
              檔案大小: {selectedBackup.fileSize ? formatFileSize(selectedBackup.fileSize) : '-'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleDeleteBackup} color="error">
            刪除
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  // 渲染從備份恢復對話框
  const renderRestoreFromBackupDialog = () => {
    if (!selectedBackup) return null;
    
    return (
      <Dialog
        open={restoreDialogOpen}
        onClose={() => setRestoreDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          從備份恢復
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            警告：恢復操作將覆蓋現有數據，請確保您了解此操作的影響。
          </Alert>
          <Typography variant="body1" gutterBottom>
            您正在從以下備份恢復數據：
          </Typography>
          <Box mb={2}>
            <Typography variant="subtitle2">
              備份時間: {formatDateTime(selectedBackup.startTime)}
            </Typography>
            <Typography variant="subtitle2">
              備份類型: {
                selectedBackup.type === BackupType.FULL ? '完整備份' :
                selectedBackup.type === BackupType.INCREMENTAL ? '增量備份' :
                '集合備份'
              }
            </Typography>
            <Typography variant="subtitle2">
              檔案大小: {selectedBackup.fileSize ? formatFileSize(selectedBackup.fileSize) : '-'}
            </Typography>
          </Box>
          
          <Typography variant="subtitle2" gutterBottom>
            選擇要恢復的集合（可選）
          </Typography>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            如果不選擇任何集合，將恢復備份中的所有數據。
          </Typography>
          <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
            <List dense>
              {availableCollections.map((collection) => (
                <ListItem key={collection} button onClick={() => handleCollectionToggle(collection)}>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selectedCollections.indexOf(collection) !== -1}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText primary={collection} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleRestoreFromBackup} color="primary">
            恢復
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  // 渲染備份配置對話框
  const renderBackupConfigDialog = () => {
    if (!backupConfig) return null;
    
    return (
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          備份配置
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={backupConfig.enabled}
                    onChange={(e) => handleBackupConfigChange('enabled', e.target.checked)}
                  />
                }
                label="啟用自動備份"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>備份頻率</InputLabel>
                <Select
                  value={backupConfig.schedule.frequency}
                  label="備份頻率"
                  onChange={(e) => handleBackupConfigChange('schedule.frequency', e.target.value)}
                >
                  <MenuItem value="daily">每日</MenuItem>
                  <MenuItem value="weekly">每週</MenuItem>
                  <MenuItem value="monthly">每月</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {backupConfig.schedule.frequency === 'weekly' && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>星期幾</InputLabel>
                  <Select
                    value={backupConfig.schedule.dayOfWeek || 0}
                    label="星期幾"
                    onChange={(e) => handleBackupConfigChange('schedule.dayOfWeek', Number(e.target.value))}
                  >
                    <MenuItem value={0}>星期日</MenuItem>
                    <MenuItem value={1}>星期一</MenuItem>
                    <MenuItem value={2}>星期二</MenuItem>
                    <MenuItem value={3}>星期三</MenuItem>
                    <MenuItem value={4}>星期四</MenuItem>
                    <MenuItem value={5}>星期五</MenuItem>
                    <MenuItem value={6}>星期六</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            {backupConfig.schedule.frequency === 'monthly' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="日期"
                  type="number"
                  value={backupConfig.schedule.dayOfMonth || 1}
                  onChange={(e) => handleBackupConfigChange('schedule.dayOfMonth', Number(e.target.value))}
                  InputProps={{ inputProps: { min: 1, max: 31 } }}
                  helperText="每月的第幾天（1-31）"
                />
              </Grid>
            )}
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="小時"
                type="number"
                value={backupConfig.schedule.hour}
                onChange={(e) => handleBackupConfigChange('schedule.hour', Number(e.target.value))}
                InputProps={{ inputProps: { min: 0, max: 23 } }}
                helperText="24小時制（0-23）"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="分鐘"
                type="number"
                value={backupConfig.schedule.minute}
                onChange={(e) => handleBackupConfigChange('schedule.minute', Number(e.target.value))}
                InputProps={{ inputProps: { min: 0, max: 59 } }}
                helperText="分鐘（0-59）"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>備份類型</InputLabel>
                <Select
                  value={backupConfig.type}
                  label="備份類型"
                  onChange={(e) => handleBackupConfigChange('type', e.target.value)}
                >
                  <MenuItem value={BackupType.FULL}>完整備份</MenuItem>
                  <MenuItem value={BackupType.INCREMENTAL}>增量備份</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="保留天數"
                type="number"
                value={backupConfig.retentionDays}
                onChange={(e) => handleBackupConfigChange('retentionDays', Number(e.target.value))}
                InputProps={{ inputProps: { min: 1 } }}
                helperText="備份保留的天數"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="儲存位置"
                value={backupConfig.storageLocation}
                onChange={(e) => handleBackupConfigChange('storageLocation', e.target.value)}
                helperText="備份檔案的儲存位置（例如：gs://bucket-name/backups）"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="通知郵件"
                value={backupConfig.notifyEmail || ''}
                onChange={(e) => handleBackupConfigChange('notifyEmail', e.target.value)}
                helperText="備份完成後通知的郵件地址（可選）"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>
            取消
          </Button>
          <Button onClick={handleUpdateBackupConfig} color="primary">
            保存
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  return (
    <Container maxWidth="xl">
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          系統備份
        </Typography>
        <Typography variant="body1" color="text.secondary">
          管理系統數據備份和恢復
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Box mb={3}>
        <Grid container spacing={2}>
          <Grid item>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setNewBackupType(BackupType.FULL);
                setSelectedCollections([]);
                setCreateDialogOpen(true);
              }}
            >
              創建備份
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setConfigDialogOpen(true)}
            >
              備份配置
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              刷新
            </Button>
          </Grid>
        </Grid>
      </Box>
      
      {renderBackupRecordsTable()}
      {renderCreateBackupDialog()}
      {renderDeleteBackupDialog()}
      {renderRestoreFromBackupDialog()}
      {renderBackupConfigDialog()}
    </Container>
  );
};

export default BackupPage;
