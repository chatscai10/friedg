/**
 * 安全儀表板頁面
 * 顯示系統安全狀態和管理安全相關功能
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Tab,
  Tabs
} from '@mui/material';
import {
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  VpnKey as VpnKeyIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Person as PersonIcon,
  Public as PublicIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import { firestore } from '../../firebaseConfig';

/**
 * 安全儀表板頁面
 */
const SecurityDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  
  // 頁面狀態
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  
  // 可疑活動
  const [suspiciousActivities, setSuspiciousActivities] = useState<any[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState<number>(0);
  
  // 安全狀態
  const [securityStatus, setSecurityStatus] = useState<{
    overallStatus: 'secure' | 'warning' | 'critical' | 'unknown';
    lastScan: Date | null;
    issues: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    firewallStatus: 'active' | 'inactive';
    encryptionStatus: 'enabled' | 'disabled';
    rateLimitStatus: 'enabled' | 'disabled';
    suspiciousActivityMonitoring: 'enabled' | 'disabled';
  }>({
    overallStatus: 'unknown',
    lastScan: null,
    issues: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    },
    firewallStatus: 'inactive',
    encryptionStatus: 'disabled',
    rateLimitStatus: 'disabled',
    suspiciousActivityMonitoring: 'disabled'
  });
  
  // 載入數據
  useEffect(() => {
    loadSecurityData();
  }, []);
  
  // 處理頁籤變更
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // 處理刷新
  const handleRefresh = () => {
    loadSecurityData();
  };
  
  // 載入安全數據
  const loadSecurityData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 載入可疑活動
      const activitiesSnapshot = await firestore
        .collection('suspiciousActivities')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      
      const activities = activitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));
      
      setSuspiciousActivities(activities);
      
      // 載入未讀警報數量
      const alertsSnapshot = await firestore
        .collection('alertNotifications')
        .where('read', '==', false)
        .get();
      
      setUnreadAlerts(alertsSnapshot.size);
      
      // 載入安全狀態
      const securityConfigSnapshot = await firestore
        .collection('systemConfig')
        .doc('security')
        .get();
      
      if (securityConfigSnapshot.exists) {
        const configData = securityConfigSnapshot.data();
        
        setSecurityStatus({
          overallStatus: configData?.overallStatus || 'unknown',
          lastScan: configData?.lastScan?.toDate() || null,
          issues: configData?.issues || {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
          },
          firewallStatus: configData?.firewallStatus || 'inactive',
          encryptionStatus: configData?.encryptionStatus || 'disabled',
          rateLimitStatus: configData?.rateLimitStatus || 'disabled',
          suspiciousActivityMonitoring: configData?.suspiciousActivityMonitoring || 'disabled'
        });
      }
    } catch (err) {
      console.error('載入安全數據失敗:', err);
      setError('載入安全數據失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };
  
  // 渲染安全狀態卡片
  const renderSecurityStatusCard = () => {
    const { overallStatus, lastScan, issues } = securityStatus;
    
    const statusColors = {
      secure: '#4caf50',
      warning: '#ff9800',
      critical: '#f44336',
      unknown: '#9e9e9e'
    };
    
    const StatusIcon = () => {
      switch (overallStatus) {
        case 'secure':
          return <CheckCircleIcon sx={{ color: statusColors.secure }} />;
        case 'warning':
          return <WarningIcon sx={{ color: statusColors.warning }} />;
        case 'critical':
          return <ErrorIcon sx={{ color: statusColors.critical }} />;
        case 'unknown':
        default:
          return <InfoIcon sx={{ color: statusColors.unknown }} />;
      }
    };
    
    return (
      <Card>
        <CardHeader
          title="安全狀態"
          action={
            <Tooltip title="刷新">
              <IconButton onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          }
        />
        <Divider />
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <StatusIcon />
            <Typography variant="h5" component="div" ml={1}>
              {overallStatus === 'secure' && '系統安全狀態良好'}
              {overallStatus === 'warning' && '系統存在安全警告'}
              {overallStatus === 'critical' && '系統存在嚴重安全問題'}
              {overallStatus === 'unknown' && '系統安全狀態未知'}
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
                <ErrorIcon color="error" />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  嚴重問題
                </Typography>
                <Typography variant="h6" component="div">
                  {issues.critical}
                </Typography>
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
                <WarningIcon color="warning" />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  高風險問題
                </Typography>
                <Typography variant="h6" component="div">
                  {issues.high}
                </Typography>
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
                <InfoIcon color="info" />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  中風險問題
                </Typography>
                <Typography variant="h6" component="div">
                  {issues.medium}
                </Typography>
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
                <InfoIcon sx={{ color: '#9e9e9e' }} />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  低風險問題
                </Typography>
                <Typography variant="h6" component="div">
                  {issues.low}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          
          <Box mt={2} display="flex" justifyContent="flex-end">
            <Typography variant="caption" color="text.secondary">
              最後掃描: {lastScan ? formatDateTime(lastScan) : '未知'}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  };
  
  // 渲染安全功能卡片
  const renderSecurityFeaturesCard = () => {
    const { firewallStatus, encryptionStatus, rateLimitStatus, suspiciousActivityMonitoring } = securityStatus;
    
    const securityFeatures = [
      {
        name: '防火牆',
        status: firewallStatus === 'active' ? '已啟用' : '未啟用',
        icon: <ShieldIcon />,
        color: firewallStatus === 'active' ? 'success' : 'error'
      },
      {
        name: '敏感數據加密',
        status: encryptionStatus === 'enabled' ? '已啟用' : '未啟用',
        icon: <LockIcon />,
        color: encryptionStatus === 'enabled' ? 'success' : 'error'
      },
      {
        name: 'API請求速率限制',
        status: rateLimitStatus === 'enabled' ? '已啟用' : '未啟用',
        icon: <PublicIcon />,
        color: rateLimitStatus === 'enabled' ? 'success' : 'error'
      },
      {
        name: '可疑活動監控',
        status: suspiciousActivityMonitoring === 'enabled' ? '已啟用' : '未啟用',
        icon: <VisibilityIcon />,
        color: suspiciousActivityMonitoring === 'enabled' ? 'success' : 'error'
      }
    ];
    
    return (
      <Card sx={{ mt: 3 }}>
        <CardHeader title="安全功能" />
        <Divider />
        <CardContent>
          <List>
            {securityFeatures.map((feature, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    {feature.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={feature.name}
                    secondary={feature.status}
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      size="small"
                      label={feature.status}
                      color={feature.color as 'success' | 'error'}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                {index < securityFeatures.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
          
          <Box mt={2} display="flex" justifyContent="flex-end">
            <Button
              component={RouterLink}
              to="/security/settings"
              variant="outlined"
              startIcon={<SettingsIcon />}
            >
              安全設置
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  };
  
  // 渲染可疑活動卡片
  const renderSuspiciousActivitiesCard = () => {
    return (
      <Card>
        <CardHeader
          title="可疑活動"
          action={
            <Button
              component={RouterLink}
              to="/security/suspicious-activities"
              size="small"
              color="primary"
            >
              查看全部
            </Button>
          }
        />
        <Divider />
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={24} />
            </Box>
          ) : suspiciousActivities.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" p={3}>
              沒有可疑活動記錄
            </Typography>
          ) : (
            <List>
              {suspiciousActivities.slice(0, 5).map((activity, index) => (
                <React.Fragment key={activity.id}>
                  <ListItem>
                    <ListItemIcon>
                      {activity.severity === 'critical' && <ErrorIcon color="error" />}
                      {activity.severity === 'high' && <WarningIcon color="error" />}
                      {activity.severity === 'medium' && <WarningIcon color="warning" />}
                      {activity.severity === 'low' && <InfoIcon color="info" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight="medium">
                          {activity.type === 'unusual_login_location' && '異常登入位置'}
                          {activity.type === 'unusual_login_time' && '異常登入時間'}
                          {activity.type === 'unusual_login_device' && '異常登入設備'}
                          {activity.type === 'failed_login' && '登入失敗'}
                          {activity.type === 'brute_force_attempt' && '暴力破解嘗試'}
                          {activity.type === 'unusual_transaction' && '異常交易'}
                          {activity.type === 'permission_change' && '權限變更'}
                          {activity.type === 'data_export' && '數據導出'}
                        </Typography>
                      }
                      secondary={
                        <>
                          <Typography variant="caption" display="block">
                            {activity.userId || activity.ipAddress || '未知來源'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {activity.timestamp ? formatDateTime(activity.timestamp) : '未知時間'}
                          </Typography>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        size="small"
                        label={
                          activity.status === 'detected' ? '已檢測' :
                          activity.status === 'investigating' ? '調查中' :
                          activity.status === 'resolved_legitimate' ? '已解決 (合法)' :
                          activity.status === 'resolved_suspicious' ? '已解決 (可疑)' :
                          activity.status === 'resolved_malicious' ? '已解決 (惡意)' :
                          '已忽略'
                        }
                        color={
                          activity.status === 'detected' || activity.status === 'investigating' ? 'warning' :
                          activity.status === 'resolved_legitimate' || activity.status === 'ignored' ? 'default' :
                          'error'
                        }
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < Math.min(suspiciousActivities.length, 5) - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
          
          {unreadAlerts > 0 && (
            <Box mt={2}>
              <Alert severity="warning">
                您有 {unreadAlerts} 個未讀安全警報
              </Alert>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };
  
  // 渲染安全操作卡片
  const renderSecurityActionsCard = () => {
    const securityActions = [
      {
        title: '安全設置',
        description: '配置系統安全選項和策略',
        icon: <SettingsIcon fontSize="large" color="primary" />,
        path: '/security/settings'
      },
      {
        title: '敏感數據管理',
        description: '管理敏感數據加密和訪問控制',
        icon: <LockIcon fontSize="large" color="primary" />,
        path: '/security/sensitive-data'
      },
      {
        title: '可疑活動',
        description: '查看和管理可疑活動記錄',
        icon: <VisibilityIcon fontSize="large" color="primary" />,
        path: '/security/suspicious-activities'
      },
      {
        title: '安全規則測試',
        description: '測試和驗證Firestore安全規則',
        icon: <ShieldIcon fontSize="large" color="primary" />,
        path: '/security/rules-test'
      }
    ];
    
    return (
      <Card sx={{ mt: 3 }}>
        <CardHeader title="安全操作" />
        <Divider />
        <CardContent>
          <Grid container spacing={2}>
            {securityActions.map((action, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Paper
                  elevation={0}
                  component={RouterLink}
                  to={action.path}
                  sx={{
                    p: 2,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    borderRadius: 2,
                    border: '1px solid #e0e0e0',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: 2
                    }
                  }}
                >
                  <Box mb={1}>
                    {action.icon}
                  </Box>
                  <Typography variant="subtitle1" gutterBottom>
                    {action.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {action.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <Container maxWidth="xl">
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          安全儀表板
        </Typography>
        <Typography variant="body1" color="text.secondary">
          監控和管理系統安全狀態
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Box mb={3}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="安全儀表板頁籤">
          <Tab label="概覽" />
          <Tab label="可疑活動" />
          <Tab label="安全設置" />
        </Tabs>
      </Box>
      
      {activeTab === 0 && (
        <Box>
          {renderSecurityStatusCard()}
          {renderSecurityFeaturesCard()}
          {renderSecurityActionsCard()}
        </Box>
      )}
      
      {activeTab === 1 && (
        <Box>
          {renderSuspiciousActivitiesCard()}
        </Box>
      )}
      
      {activeTab === 2 && (
        <Box>
          <Typography variant="body1" color="text.secondary" align="center" p={3}>
            請前往安全設置頁面進行配置
          </Typography>
          <Box display="flex" justifyContent="center">
            <Button
              component={RouterLink}
              to="/security/settings"
              variant="contained"
              startIcon={<SettingsIcon />}
            >
              安全設置
            </Button>
          </Box>
        </Box>
      )}
    </Container>
  );
};

export default SecurityDashboardPage;
