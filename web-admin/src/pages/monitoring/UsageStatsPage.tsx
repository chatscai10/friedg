/**
 * 系統使用情況統計頁面
 * 顯示功能使用頻率、用戶活躍度等指標
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
  Tabs,
  Tab
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Pageview as PageviewIcon,
  Apps as AppsIcon
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
  UsageStatsService,
  UserActivityType,
  FeatureUsageStats,
  UserActivityStats,
  PageViewStats,
  UserSession
} from '../../services/monitoring';
import { formatDate, formatDateTime, formatTime } from '../../utils/dateUtils';

// 圖表顏色
const CHART_COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

/**
 * 系統使用情況統計頁面
 */
const UsageStatsPage: React.FC = () => {
  // 頁面狀態
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  
  // 使用者活躍度統計
  const [dailyActivityStats, setDailyActivityStats] = useState<UserActivityStats[]>([]);
  const [weeklyActivityStats, setWeeklyActivityStats] = useState<UserActivityStats[]>([]);
  const [monthlyActivityStats, setMonthlyActivityStats] = useState<UserActivityStats[]>([]);
  
  // 功能使用統計
  const [featureUsageStats, setFeatureUsageStats] = useState<FeatureUsageStats[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  
  // 頁面訪問統計
  const [pageViewStats, setPageViewStats] = useState<PageViewStats[]>([]);
  
  // 活躍使用者會話
  const [activeUserSessions, setActiveUserSessions] = useState<UserSession[]>([]);
  
  // 載入數據
  useEffect(() => {
    loadUsageStats();
  }, []);
  
  // 處理頁籤變更
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // 處理刷新
  const handleRefresh = () => {
    setRefreshing(true);
    loadUsageStats().finally(() => {
      setRefreshing(false);
    });
  };
  
  // 載入使用情況統計
  const loadUsageStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 載入使用者活躍度統計
      const [daily, weekly, monthly] = await Promise.all([
        UsageStatsService.getUserActivityStats(UserActivityType.DAILY, 30),
        UsageStatsService.getUserActivityStats(UserActivityType.WEEKLY, 12),
        UsageStatsService.getUserActivityStats(UserActivityType.MONTHLY, 12)
      ]);
      
      setDailyActivityStats(daily);
      setWeeklyActivityStats(weekly);
      setMonthlyActivityStats(monthly);
      
      // 載入功能使用統計
      const features = await UsageStatsService.getFeatureUsageStats();
      setFeatureUsageStats(features);
      
      // 載入模組列表
      const moduleList = await UsageStatsService.getModules();
      setModules(moduleList);
      
      // 載入頁面訪問統計
      const pages = await UsageStatsService.getPageViewStats();
      setPageViewStats(pages);
      
      // 載入活躍使用者會話
      const sessions = await UsageStatsService.getActiveUserSessions();
      setActiveUserSessions(sessions);
    } catch (err) {
      setError('載入使用情況統計失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // 處理模組選擇變更
  const handleModuleChange = (module: string | null) => {
    setSelectedModule(module);
    
    // 重新載入功能使用統計
    if (module) {
      UsageStatsService.getFeatureUsageStats(module).then(features => {
        setFeatureUsageStats(features);
      }).catch(err => {
        console.error('載入功能使用統計失敗:', err);
      });
    } else {
      UsageStatsService.getFeatureUsageStats().then(features => {
        setFeatureUsageStats(features);
      }).catch(err => {
        console.error('載入功能使用統計失敗:', err);
      });
    }
  };
  
  // 渲染使用者活躍度統計
  const renderUserActivityStats = () => {
    // 處理數據
    const dailyData = dailyActivityStats
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(stat => ({
        date: formatDate(stat.date),
        activeUsers: stat.activeUsers,
        newUsers: stat.newUsers,
        returningUsers: stat.returningUsers
      }));
    
    const weeklyData = weeklyActivityStats
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(stat => ({
        date: formatDate(stat.date),
        activeUsers: stat.activeUsers,
        newUsers: stat.newUsers,
        returningUsers: stat.returningUsers
      }));
    
    const monthlyData = monthlyActivityStats
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(stat => ({
        date: formatDate(stat.date, 'yyyy-MM'),
        activeUsers: stat.activeUsers,
        newUsers: stat.newUsers,
        returningUsers: stat.returningUsers
      }));
    
    return (
      <Box>
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title="每日活躍用戶"
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
            <Box height={300}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="activeUsers" name="活躍用戶" stroke="#1f77b4" activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="newUsers" name="新用戶" stroke="#2ca02c" />
                  <Line type="monotone" dataKey="returningUsers" name="回訪用戶" stroke="#ff7f0e" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="每週活躍用戶" />
              <Divider />
              <CardContent>
                <Box height={250}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="activeUsers" name="活躍用戶" fill="#1f77b4" />
                      <Bar dataKey="newUsers" name="新用戶" fill="#2ca02c" />
                      <Bar dataKey="returningUsers" name="回訪用戶" fill="#ff7f0e" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="每月活躍用戶" />
              <Divider />
              <CardContent>
                <Box height={250}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="activeUsers" name="活躍用戶" fill="#1f77b4" />
                      <Bar dataKey="newUsers" name="新用戶" fill="#2ca02c" />
                      <Bar dataKey="returningUsers" name="回訪用戶" fill="#ff7f0e" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };
  
  // 渲染功能使用統計
  const renderFeatureUsageStats = () => {
    return (
      <Box>
        <Box mb={3} display="flex" alignItems="center">
          <Typography variant="subtitle1" sx={{ mr: 2 }}>
            模組:
          </Typography>
          <Box>
            <Chip
              label="全部"
              color={selectedModule === null ? 'primary' : 'default'}
              onClick={() => handleModuleChange(null)}
              sx={{ mr: 1, mb: 1 }}
            />
            {modules.map((module) => (
              <Chip
                key={module}
                label={module}
                color={selectedModule === module ? 'primary' : 'default'}
                onClick={() => handleModuleChange(module)}
                sx={{ mr: 1, mb: 1 }}
              />
            ))}
          </Box>
        </Box>
        
        <Card>
          <CardHeader
            title="功能使用統計"
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
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>功能</TableCell>
                    <TableCell>模組</TableCell>
                    <TableCell align="right">使用次數</TableCell>
                    <TableCell align="right">獨立用戶數</TableCell>
                    <TableCell align="right">平均使用時長</TableCell>
                    <TableCell>最後更新</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : featureUsageStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        沒有功能使用統計
                      </TableCell>
                    </TableRow>
                  ) : (
                    featureUsageStats.map((stat, index) => (
                      <TableRow key={index}>
                        <TableCell>{stat.feature}</TableCell>
                        <TableCell>{stat.module}</TableCell>
                        <TableCell align="right">{stat.usageCount}</TableCell>
                        <TableCell align="right">{stat.uniqueUsers}</TableCell>
                        <TableCell align="right">
                          {stat.averageDuration ? `${(stat.averageDuration / 1000).toFixed(2)} 秒` : '-'}
                        </TableCell>
                        <TableCell>{formatDateTime(stat.lastUpdated)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
        
        <Box mt={3}>
          <Card>
            <CardHeader title="功能使用分布" />
            <Divider />
            <CardContent>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={featureUsageStats.slice(0, 10)}
                      dataKey="usageCount"
                      nameKey="feature"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {featureUsageStats.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value, name, props) => [`${value} 次`, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };
  
  // 渲染頁面訪問統計
  const renderPageViewStats = () => {
    return (
      <Box>
        <Card>
          <CardHeader
            title="頁面訪問統計"
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
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>頁面</TableCell>
                    <TableCell align="right">訪問次數</TableCell>
                    <TableCell align="right">獨立用戶數</TableCell>
                    <TableCell align="right">平均停留時間</TableCell>
                    <TableCell align="right">跳出率</TableCell>
                    <TableCell>最後更新</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : pageViewStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        沒有頁面訪問統計
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageViewStats.map((stat, index) => (
                      <TableRow key={index}>
                        <TableCell>{stat.page}</TableCell>
                        <TableCell align="right">{stat.viewCount}</TableCell>
                        <TableCell align="right">{stat.uniqueUsers}</TableCell>
                        <TableCell align="right">{`${(stat.averageDuration / 1000).toFixed(2)} 秒`}</TableCell>
                        <TableCell align="right">{`${(stat.bounceRate * 100).toFixed(2)}%`}</TableCell>
                        <TableCell>{formatDateTime(stat.lastUpdated)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
        
        <Box mt={3}>
          <Card>
            <CardHeader title="頁面訪問分布" />
            <Divider />
            <CardContent>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pageViewStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="page" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="viewCount" name="訪問次數" fill="#1f77b4" />
                    <Bar dataKey="uniqueUsers" name="獨立用戶數" fill="#2ca02c" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  };
  
  // 渲染活躍使用者會話
  const renderActiveUserSessions = () => {
    return (
      <Box>
        <Card>
          <CardHeader
            title="當前活躍用戶"
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
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>用戶</TableCell>
                    <TableCell>角色</TableCell>
                    <TableCell>店鋪</TableCell>
                    <TableCell>登入時間</TableCell>
                    <TableCell>設備</TableCell>
                    <TableCell>瀏覽器</TableCell>
                    <TableCell>操作系統</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : activeUserSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        沒有活躍用戶
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeUserSessions.map((session, index) => (
                      <TableRow key={index}>
                        <TableCell>{session.userName || session.userId}</TableCell>
                        <TableCell>{session.userRole || '-'}</TableCell>
                        <TableCell>{session.storeId || '-'}</TableCell>
                        <TableCell>{formatDateTime(session.startTime)}</TableCell>
                        <TableCell>{session.device}</TableCell>
                        <TableCell>{session.browser}</TableCell>
                        <TableCell>{session.os}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    );
  };
  
  return (
    <Container maxWidth="xl">
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          系統使用情況統計
        </Typography>
        <Typography variant="body1" color="text.secondary">
          追蹤功能使用頻率、用戶活躍度等指標
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Box mb={3}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="使用情況統計頁籤">
          <Tab icon={<PeopleIcon />} label="用戶活躍度" />
          <Tab icon={<AppsIcon />} label="功能使用" />
          <Tab icon={<PageviewIcon />} label="頁面訪問" />
          <Tab icon={<TrendingUpIcon />} label="活躍會話" />
        </Tabs>
      </Box>
      
      {loading && !refreshing ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {activeTab === 0 && renderUserActivityStats()}
          {activeTab === 1 && renderFeatureUsageStats()}
          {activeTab === 2 && renderPageViewStats()}
          {activeTab === 3 && renderActiveUserSessions()}
        </>
      )}
    </Container>
  );
};

export default UsageStatsPage;
