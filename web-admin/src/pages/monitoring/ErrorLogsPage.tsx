/**
 * 錯誤日誌頁面
 * 顯示系統錯誤日誌和統計信息
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
  SelectChangeEvent
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Link as RouterLink } from 'react-router-dom';
import { 
  ErrorLogService,
  ErrorSeverity,
  ErrorLog,
  ErrorStats
} from '../../services/monitoring';
import { formatDate, formatDateTime, formatTime } from '../../utils/dateUtils';

/**
 * 錯誤日誌頁面
 */
const ErrorLogsPage: React.FC = () => {
  // 頁面狀態
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // 錯誤日誌
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  
  // 錯誤統計
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  
  // 分頁
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  
  // 過濾條件
  const [filters, setFilters] = useState<{
    severity?: ErrorSeverity;
    source?: string;
    startDate?: Date;
    endDate?: Date;
    resolved?: boolean;
  }>({});
  
  // 載入數據
  useEffect(() => {
    loadErrorLogs();
    loadErrorStats();
  }, [page, rowsPerPage, filters]);
  
  // 載入錯誤日誌
  const loadErrorLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const logs = await ErrorLogService.getErrorLogs(
        rowsPerPage,
        page * rowsPerPage,
        filters
      );
      setErrorLogs(logs);
    } catch (err) {
      setError('載入錯誤日誌失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // 載入錯誤統計
  const loadErrorStats = async () => {
    try {
      const stats = await ErrorLogService.getErrorStats(30);
      setErrorStats(stats);
      setTotalLogs(stats.totalErrors);
    } catch (err) {
      console.error('載入錯誤統計失敗:', err);
    }
  };
  
  // 處理刷新
  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([
      loadErrorLogs(),
      loadErrorStats()
    ]).finally(() => {
      setRefreshing(false);
    });
  };
  
  // 處理頁碼變更
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  // 處理每頁行數變更
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // 處理嚴重程度過濾變更
  const handleSeverityFilterChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setFilters({
      ...filters,
      severity: value === 'all' ? undefined : value as ErrorSeverity
    });
    setPage(0);
  };
  
  // 處理來源過濾變更
  const handleSourceFilterChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setFilters({
      ...filters,
      source: value === 'all' ? undefined : value
    });
    setPage(0);
  };
  
  // 處理已解決過濾變更
  const handleResolvedFilterChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setFilters({
      ...filters,
      resolved: value === 'all' ? undefined : value === 'true'
    });
    setPage(0);
  };
  
  // 處理開始日期過濾變更
  const handleStartDateFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFilters({
      ...filters,
      startDate: value ? new Date(value) : undefined
    });
    setPage(0);
  };
  
  // 處理結束日期過濾變更
  const handleEndDateFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFilters({
      ...filters,
      endDate: value ? new Date(value) : undefined
    });
    setPage(0);
  };
  
  // 清除所有過濾條件
  const handleClearFilters = () => {
    setFilters({});
    setPage(0);
  };
  
  // 處理查看錯誤詳情
  const handleViewErrorDetails = (log: ErrorLog) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };
  
  // 處理關閉對話框
  const handleCloseDialog = () => {
    setDialogOpen(false);
  };
  
  // 處理標記為已解決
  const handleMarkAsResolved = async () => {
    if (!selectedLog || !selectedLog.id) return;
    
    try {
      const userId = 'current-user-id'; // 應該從認證服務獲取
      const success = await ErrorLogService.markErrorAsResolved(
        selectedLog.id,
        userId,
        'Manually resolved by admin'
      );
      
      if (success) {
        // 更新本地數據
        setErrorLogs(logs => logs.map(log => 
          log.id === selectedLog.id 
            ? { ...log, resolved: true, resolvedAt: new Date(), resolvedBy: userId }
            : log
        ));
        
        // 關閉對話框
        setDialogOpen(false);
        
        // 重新載入統計數據
        loadErrorStats();
      }
    } catch (err) {
      console.error('標記錯誤為已解決失敗:', err);
    }
  };
  
  // 渲染錯誤統計卡片
  const renderErrorStatsCard = () => {
    if (!errorStats) return null;
    
    const severityData = [
      { name: '資訊', value: errorStats.bySeverity[ErrorSeverity.INFO] || 0, color: '#2196f3' },
      { name: '警告', value: errorStats.bySeverity[ErrorSeverity.WARNING] || 0, color: '#ff9800' },
      { name: '錯誤', value: errorStats.bySeverity[ErrorSeverity.ERROR] || 0, color: '#f44336' },
      { name: '嚴重', value: errorStats.bySeverity[ErrorSeverity.CRITICAL] || 0, color: '#9c27b0' }
    ];
    
    return (
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="錯誤統計"
          action={
            <Tooltip title="刷新">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                按嚴重程度分布
              </Typography>
              <Box height={200}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value) => [`${value} 個錯誤`, '數量']} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                最近30天錯誤趨勢
              </Typography>
              <Box height={200}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={errorStats.byDate}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip formatter={(value) => [`${value} 個錯誤`, '數量']} />
                    <Line type="monotone" dataKey="count" stroke="#f44336" activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };
  
  // 渲染過濾器
  const renderFilters = () => {
    return (
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="過濾條件"
          action={
            <Tooltip title="清除過濾條件">
              <IconButton onClick={handleClearFilters}>
                <ClearIcon />
              </IconButton>
            </Tooltip>
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>嚴重程度</InputLabel>
                <Select
                  value={filters.severity || 'all'}
                  label="嚴重程度"
                  onChange={handleSeverityFilterChange}
                >
                  <MenuItem value="all">全部</MenuItem>
                  <MenuItem value={ErrorSeverity.INFO}>資訊</MenuItem>
                  <MenuItem value={ErrorSeverity.WARNING}>警告</MenuItem>
                  <MenuItem value={ErrorSeverity.ERROR}>錯誤</MenuItem>
                  <MenuItem value={ErrorSeverity.CRITICAL}>嚴重</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>來源</InputLabel>
                <Select
                  value={filters.source || 'all'}
                  label="來源"
                  onChange={handleSourceFilterChange}
                >
                  <MenuItem value="all">全部</MenuItem>
                  <MenuItem value="frontend">前端</MenuItem>
                  <MenuItem value="backend">後端</MenuItem>
                  <MenuItem value="database">數據庫</MenuItem>
                  <MenuItem value="api">API</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>狀態</InputLabel>
                <Select
                  value={filters.resolved === undefined ? 'all' : filters.resolved ? 'true' : 'false'}
                  label="狀態"
                  onChange={handleResolvedFilterChange}
                >
                  <MenuItem value="all">全部</MenuItem>
                  <MenuItem value="false">未解決</MenuItem>
                  <MenuItem value="true">已解決</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="開始日期"
                type="date"
                value={filters.startDate ? formatDate(filters.startDate, 'yyyy-MM-dd') : ''}
                onChange={handleStartDateFilterChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="結束日期"
                type="date"
                value={filters.endDate ? formatDate(filters.endDate, 'yyyy-MM-dd') : ''}
                onChange={handleEndDateFilterChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };
  
  // 渲染錯誤日誌表格
  const renderErrorLogsTable = () => {
    return (
      <Paper variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>時間</TableCell>
                <TableCell>嚴重程度</TableCell>
                <TableCell>來源</TableCell>
                <TableCell>錯誤代碼</TableCell>
                <TableCell>訊息</TableCell>
                <TableCell>狀態</TableCell>
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
              ) : errorLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    沒有符合條件的錯誤日誌
                  </TableCell>
                </TableRow>
              ) : (
                errorLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={
                          log.severity === ErrorSeverity.CRITICAL ? <ErrorIcon /> :
                          log.severity === ErrorSeverity.ERROR ? <ErrorIcon /> :
                          log.severity === ErrorSeverity.WARNING ? <WarningIcon /> :
                          <InfoIcon />
                        }
                        label={log.severity}
                        color={
                          log.severity === ErrorSeverity.CRITICAL ? 'error' :
                          log.severity === ErrorSeverity.ERROR ? 'error' :
                          log.severity === ErrorSeverity.WARNING ? 'warning' :
                          'info'
                        }
                      />
                    </TableCell>
                    <TableCell>{log.source}</TableCell>
                    <TableCell>{log.code || '-'}</TableCell>
                    <TableCell>{log.message}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        icon={log.resolved ? <CheckCircleIcon /> : <ErrorIcon />}
                        label={log.resolved ? '已解決' : '未解決'}
                        color={log.resolved ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="查看詳情">
                        <IconButton size="small" onClick={() => handleViewErrorDetails(log)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalLogs}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
    );
  };
  
  // 渲染錯誤詳情對話框
  const renderErrorDetailsDialog = () => {
    if (!selectedLog) return null;
    
    return (
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          錯誤詳情
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                時間
              </Typography>
              <Typography variant="body2">
                {formatDateTime(selectedLog.timestamp)}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                嚴重程度
              </Typography>
              <Chip
                size="small"
                label={selectedLog.severity}
                color={
                  selectedLog.severity === ErrorSeverity.CRITICAL ? 'error' :
                  selectedLog.severity === ErrorSeverity.ERROR ? 'error' :
                  selectedLog.severity === ErrorSeverity.WARNING ? 'warning' :
                  'info'
                }
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                來源
              </Typography>
              <Typography variant="body2">
                {selectedLog.source}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                錯誤代碼
              </Typography>
              <Typography variant="body2">
                {selectedLog.code || '-'}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                錯誤訊息
              </Typography>
              <Typography variant="body2">
                {selectedLog.message}
              </Typography>
            </Grid>
            
            {selectedLog.stackTrace && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  堆疊追蹤
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                    backgroundColor: '#f5f5f5'
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {selectedLog.stackTrace}
                  </pre>
                </Paper>
              </Grid>
            )}
            
            {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  上下文
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                    backgroundColor: '#f5f5f5'
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(selectedLog.context, null, 2)}
                  </pre>
                </Paper>
              </Grid>
            )}
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                用戶
              </Typography>
              <Typography variant="body2">
                {selectedLog.userName || selectedLog.userId || '-'}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                IP地址
              </Typography>
              <Typography variant="body2">
                {selectedLog.ipAddress || '-'}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                路徑
              </Typography>
              <Typography variant="body2">
                {selectedLog.path || '-'}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                方法
              </Typography>
              <Typography variant="body2">
                {selectedLog.method || '-'}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                狀態
              </Typography>
              <Box display="flex" alignItems="center">
                <Chip
                  size="small"
                  icon={selectedLog.resolved ? <CheckCircleIcon /> : <ErrorIcon />}
                  label={selectedLog.resolved ? '已解決' : '未解決'}
                  color={selectedLog.resolved ? 'success' : 'default'}
                  variant="outlined"
                  sx={{ mr: 1 }}
                />
                {selectedLog.resolved && (
                  <Typography variant="body2" color="text.secondary">
                    {`由 ${selectedLog.resolvedBy} 於 ${formatDateTime(selectedLog.resolvedAt)} 解決`}
                  </Typography>
                )}
              </Box>
            </Grid>
            
            {selectedLog.notes && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  備註
                </Typography>
                <Typography variant="body2">
                  {selectedLog.notes}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          {!selectedLog.resolved && (
            <Button onClick={handleMarkAsResolved} color="primary">
              標記為已解決
            </Button>
          )}
          <Button onClick={handleCloseDialog}>
            關閉
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  return (
    <Container maxWidth="xl">
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          錯誤日誌
        </Typography>
        <Typography variant="body1" color="text.secondary">
          查看和管理系統錯誤日誌
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {renderErrorStatsCard()}
      {renderFilters()}
      {renderErrorLogsTable()}
      {renderErrorDetailsDialog()}
    </Container>
  );
};

export default ErrorLogsPage;
