/**
 * 系統監控儀表板頁面
 * 顯示系統健康狀態、性能指標和錯誤統計
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
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Help as HelpIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  BugReport as BugReportIcon,
  People as PeopleIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon
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
  SystemMonitoringService, 
  HealthStatus, 
  HealthMetricType,
  ErrorLogService,
  ErrorSeverity,
  UsageStatsService,
  UserActivityType
} from '../../services/monitoring';
import { formatDate, formatDateTime, formatTime } from '../../utils/dateUtils';

// 健康狀態顏色映射
const healthStatusColors = {
  [HealthStatus.HEALTHY]: '#4caf50',
  [HealthStatus.WARNING]: '#ff9800',
  [HealthStatus.CRITICAL]: '#f44336',
  [HealthStatus.UNKNOWN]: '#9e9e9e'
};

// 健康狀態圖標映射
const HealthStatusIcon = ({ status }: { status: HealthStatus }) => {
  switch (status) {
    case HealthStatus.HEALTHY:
      return <CheckCircleIcon sx={{ color: healthStatusColors[HealthStatus.HEALTHY] }} />;
    case HealthStatus.WARNING:
      return <WarningIcon sx={{ color: healthStatusColors[HealthStatus.WARNING] }} />;
    case HealthStatus.CRITICAL:
      return <ErrorIcon sx={{ color: healthStatusColors[HealthStatus.CRITICAL] }} />;
    case HealthStatus.UNKNOWN:
    default:
      return <HelpIcon sx={{ color: healthStatusColors[HealthStatus.UNKNOWN] }} />;
  }
};

/**
 * 系統監控儀表板頁面
 */
const SystemMonitoringDashboardPage: React.FC = () => {
  // 頁面狀態
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // 健康摘要
  const [healthSummary, setHealthSummary] = useState<any>(null);
  
  // 錯誤統計
  const [errorStats, setErrorStats] = useState<any>(null);
  
  // 使用情況統計
  const [usageStats, setUsageStats] = useState<any>(null);
  
  // 活躍用戶
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  
  // 頁面訪問統計
  const [pageViewStats, setPageViewStats] = useState<any[]>([]);
  
  // 功能使用統計
  const [featureUsageStats, setFeatureUsageStats] = useState<any[]>([]);
  
  // 錯誤日誌分頁
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [errorLogsPage, setErrorLogsPage] = useState<number>(0);
  const [errorLogsRowsPerPage, setErrorLogsRowsPerPage] = useState<number>(5);
  const [errorLogsTotal, setErrorLogsTotal] = useState<number>(0);
  
  // 載入數據
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  // 處理頁籤變更
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // 處理刷新
  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData().finally(() => {
      setRefreshing(false);
    });
  };
  
  // 載入儀表板數據
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 載入健康摘要
      const summary = await SystemMonitoringService.getHealthSummary();
      setHealthSummary(summary);
      
      // 載入錯誤統計
      const errStats = await ErrorLogService.getErrorStats(7);
      setErrorStats(errStats);
      
      // 載入錯誤日誌
      const logs = await ErrorLogService.getErrorLogs(errorLogsRowsPerPage, errorLogsPage * errorLogsRowsPerPage);
      setErrorLogs(logs);
      setErrorLogsTotal(errStats.totalErrors);
      
      // 載入使用情況統計
      const dailyActivity = await UsageStatsService.getUserActivityStats(UserActivityType.DAILY, 7);
      setUsageStats(dailyActivity);
      
      // 載入活躍用戶
      const activeSessions = await UsageStatsService.getActiveUserSessions();
      setActiveUsers(activeSessions);
      
      // 載入頁面訪問統計
      const pageStats = await UsageStatsService.getPageViewStats(10);
      setPageViewStats(pageStats);
      
      // 載入功能使用統計
      const featureStats = await UsageStatsService.getFeatureUsageStats();
      setFeatureUsageStats(featureStats);
    } catch (err) {
      setError('載入儀表板數據失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // 處理錯誤日誌分頁變更
  const handleErrorLogsPageChange = (event: unknown, newPage: number) => {
    setErrorLogsPage(newPage);
    
    // 載入新頁數據
    ErrorLogService.getErrorLogs(
      errorLogsRowsPerPage,
      newPage * errorLogsRowsPerPage
    ).then(logs => {
      setErrorLogs(logs);
    }).catch(err => {
      console.error('載入錯誤日誌失敗:', err);
    });
  };
  
  // 處理錯誤日誌每頁行數變更
  const handleErrorLogsRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setErrorLogsRowsPerPage(newRowsPerPage);
    setErrorLogsPage(0);
    
    // 載入新頁數據
    ErrorLogService.getErrorLogs(newRowsPerPage, 0).then(logs => {
      setErrorLogs(logs);
    }).catch(err => {
      console.error('載入錯誤日誌失敗:', err);
    });
  };
  
  // 渲染健康狀態卡片
  const renderHealthStatusCard = () => {
    if (!healthSummary) return null;
    
    return (
      <Card>
        <CardHeader
          title="系統健康狀態"
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
          <Box display="flex" alignItems="center" mb={2}>
            <HealthStatusIcon status={healthSummary.overallStatus} />
            <Typography variant="h5" component="div" ml={1}>
              {healthSummary.overallStatus === HealthStatus.HEALTHY && '系統運行正常'}
              {healthSummary.overallStatus === HealthStatus.WARNING && '系統存在警告'}
              {healthSummary.overallStatus === HealthStatus.CRITICAL && '系統存在嚴重問題'}
              {healthSummary.overallStatus === HealthStatus.UNKNOWN && '系統狀態未知'}
            </Typography>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                  height: '100%'
                }}
              >
                <SpeedIcon color="primary" />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  API響應時間
                </Typography>
                <Typography variant="h6" component="div">
                  {healthSummary.apiResponseTime.average.toFixed(2)} ms
                </Typography>
                <Chip
                  size="small"
                  icon={<HealthStatusIcon status={healthSummary.apiResponseTime.status} />}
                  label={healthSummary.apiResponseTime.status}
                  sx={{
                    mt: 1,
                    backgroundColor: `${healthStatusColors[healthSummary.apiResponseTime.status]}20`,
                    color: healthStatusColors[healthSummary.apiResponseTime.status],
                    borderColor: healthStatusColors[healthSummary.apiResponseTime.status]
                  }}
                  variant="outlined"
                />
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                  height: '100%'
                }}
              >
                <StorageIcon color="primary" />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  數據庫查詢性能
                </Typography>
                <Typography variant="h6" component="div">
                  {healthSummary.databasePerformance.average.toFixed(2)} ms
                </Typography>
                <Chip
                  size="small"
                  icon={<HealthStatusIcon status={healthSummary.databasePerformance.status} />}
                  label={healthSummary.databasePerformance.status}
                  sx={{
                    mt: 1,
                    backgroundColor: `${healthStatusColors[healthSummary.databasePerformance.status]}20`,
                    color: healthStatusColors[healthSummary.databasePerformance.status],
                    borderColor: healthStatusColors[healthSummary.databasePerformance.status]
                  }}
                  variant="outlined"
                />
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                  height: '100%'
                }}
              >
                <BugReportIcon color="primary" />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  錯誤率
                </Typography>
                <Typography variant="h6" component="div">
                  {healthSummary.errorRate.value.toFixed(2)}%
                </Typography>
                <Chip
                  size="small"
                  icon={<HealthStatusIcon status={healthSummary.errorRate.status} />}
                  label={healthSummary.errorRate.status}
                  sx={{
                    mt: 1,
                    backgroundColor: `${healthStatusColors[healthSummary.errorRate.status]}20`,
                    color: healthStatusColors[healthSummary.errorRate.status],
                    borderColor: healthStatusColors[healthSummary.errorRate.status]
                  }}
                  variant="outlined"
                />
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  borderRadius: 2,
                  border: '1px solid #e0e0e0',
                  height: '100%'
                }}
              >
                <PeopleIcon color="primary" />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  活躍用戶
                </Typography>
                <Typography variant="h6" component="div">
                  {healthSummary.activeUsers.count}
                </Typography>
                <Chip
                  size="small"
                  icon={<HealthStatusIcon status={healthSummary.activeUsers.status} />}
                  label={healthSummary.activeUsers.status}
                  sx={{
                    mt: 1,
                    backgroundColor: `${healthStatusColors[healthSummary.activeUsers.status]}20`,
                    color: healthStatusColors[healthSummary.activeUsers.status],
                    borderColor: healthStatusColors[healthSummary.activeUsers.status]
                  }}
                  variant="outlined"
                />
              </Paper>
            </Grid>
          </Grid>
          
          <Box mt={2} display="flex" justifyContent="flex-end">
            <Typography variant="caption" color="text.secondary">
              最後更新: {formatDateTime(healthSummary.lastUpdated)}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
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
      <Card>
        <CardHeader
          title="錯誤統計"
          action={
            <Button
              component={RouterLink}
              to="/monitoring/error-logs"
              size="small"
              color="primary"
            >
              查看詳情
            </Button>
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
                最近7天錯誤趨勢
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
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                最常見的錯誤
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>錯誤代碼</TableCell>
                      <TableCell>錯誤訊息</TableCell>
                      <TableCell align="right">次數</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {errorStats.topErrors.slice(0, 5).map((error: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{error.code}</TableCell>
                        <TableCell>{error.message}</TableCell>
                        <TableCell align="right">{error.count}</TableCell>
                      </TableRow>
                    ))}
                    {errorStats.topErrors.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          沒有錯誤記錄
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };
  
  // 渲染使用情況統計卡片
  const renderUsageStatsCard = () => {
    if (!usageStats || usageStats.length === 0) return null;
    
    const usageData = usageStats.map((stat: any) => ({
      date: formatDate(stat.date),
      activeUsers: stat.activeUsers,
      newUsers: stat.newUsers,
      returningUsers: stat.returningUsers
    })).reverse();
    
    return (
      <Card>
        <CardHeader
          title="使用情況統計"
          action={
            <Button
              component={RouterLink}
              to="/monitoring/usage-stats"
              size="small"
              color="primary"
            >
              查看詳情
            </Button>
          }
        />
        <Divider />
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            最近7天用戶活躍度
          </Typography>
          <Box height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="activeUsers" name="活躍用戶" fill="#2196f3" />
                <Bar dataKey="newUsers" name="新用戶" fill="#4caf50" />
                <Bar dataKey="returningUsers" name="回訪用戶" fill="#ff9800" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          
          <Box mt={3}>
            <Typography variant="subtitle2" gutterBottom>
              當前活躍用戶 ({activeUsers.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>用戶名</TableCell>
                    <TableCell>角色</TableCell>
                    <TableCell>登入時間</TableCell>
                    <TableCell>設備</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeUsers.slice(0, 5).map((user: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{user.userName || '未知用戶'}</TableCell>
                      <TableCell>{user.userRole || '未知角色'}</TableCell>
                      <TableCell>{formatDateTime(user.startTime)}</TableCell>
                      <TableCell>{`${user.browser} / ${user.os}`}</TableCell>
                    </TableRow>
                  ))}
                  {activeUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        沒有活躍用戶
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <Container maxWidth="xl">
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          系統監控儀表板
        </Typography>
        <Typography variant="body1" color="text.secondary">
          監控系統健康狀態、性能指標和錯誤統計
        </Typography>
      </Box>
      
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {!loading && !error && (
        <Box>
          <Box mb={3}>
            <Tabs value={activeTab} onChange={handleTabChange} aria-label="監控儀表板頁籤">
              <Tab label="系統健康" />
              <Tab label="錯誤統計" />
              <Tab label="使用情況" />
            </Tabs>
          </Box>
          
          {activeTab === 0 && (
            <Box>
              {renderHealthStatusCard()}
              
              <Box mt={3}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardHeader title="系統操作" />
                      <Divider />
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <Button
                              fullWidth
                              variant="outlined"
                              startIcon={<CloudUploadIcon />}
                              component={RouterLink}
                              to="/monitoring/backup"
                            >
                              數據備份
                            </Button>
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Button
                              fullWidth
                              variant="outlined"
                              startIcon={<CloudDownloadIcon />}
                              component={RouterLink}
                              to="/monitoring/restore"
                            >
                              數據恢復
                            </Button>
                          </Grid>
                          <Grid item xs={12}>
                            <Button
                              fullWidth
                              variant="contained"
                              color="primary"
                              onClick={handleRefresh}
                              disabled={refreshing}
                              startIcon={<RefreshIcon />}
                            >
                              執行系統健康檢查
                            </Button>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardHeader title="最近錯誤日誌" />
                      <Divider />
                      <CardContent>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>時間</TableCell>
                                <TableCell>嚴重程度</TableCell>
                                <TableCell>訊息</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {errorLogs.slice(0, 5).map((log: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                                  <TableCell>
                                    <Chip
                                      size="small"
                                      label={log.severity}
                                      color={
                                        log.severity === ErrorSeverity.CRITICAL ? 'error' :
                                        log.severity === ErrorSeverity.ERROR ? 'error' :
                                        log.severity === ErrorSeverity.WARNING ? 'warning' :
                                        'info'
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>{log.message}</TableCell>
                                </TableRow>
                              ))}
                              {errorLogs.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={3} align="center">
                                    沒有錯誤日誌
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <TablePagination
                          component="div"
                          count={errorLogsTotal}
                          page={errorLogsPage}
                          onPageChange={handleErrorLogsPageChange}
                          rowsPerPage={errorLogsRowsPerPage}
                          onRowsPerPageChange={handleErrorLogsRowsPerPageChange}
                          rowsPerPageOptions={[5, 10, 25]}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}
          
          {activeTab === 1 && (
            <Box>
              {renderErrorStatsCard()}
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box>
              {renderUsageStatsCard()}
            </Box>
          )}
        </Box>
      )}
    </Container>
  );
};

export default SystemMonitoringDashboardPage;
