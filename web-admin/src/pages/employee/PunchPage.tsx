import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Container,
  Avatar,
  IconButton,
  Card,
  CardContent,
  Chip,
  Stack
} from '@mui/material';
import { 
  LocationOn, 
  AccessTime, 
  Refresh, 
  ExitToApp, 
  CheckCircle, 
  Warning
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import apiClient from '../../services/api';

// 打卡結果類型
interface PunchResult {
  success: boolean;
  type: 'in' | 'out';
  time: string;
  message: string;
}

// 打卡頁面組件
const PunchPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastPunch, setLastPunch] = useState<PunchResult | null>(null);
  const [punchResult, setPunchResult] = useState<PunchResult | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  // 更新當前時間
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    // 獲取最後一次打卡記錄
    fetchLastPunch();
    
    return () => clearInterval(timer);
  }, []);
  
  // 格式化時間
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };
  
  // 格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-TW', { 
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 獲取最後一次打卡記錄
  const fetchLastPunch = async () => {
    try {
      const response = await apiClient.get('/api/attendance/last');
      if (response.data) {
        setLastPunch(response.data);
      }
    } catch (error) {
      console.error('獲取最後打卡記錄失敗:', error);
    }
  };

  // 獲取位置
  const getLocation = async () => {
    setIsGettingLocation(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError('您的瀏覽器不支持地理位置功能');
      setIsGettingLocation(false);
      return;
    }
    
    try {
      // 使用Promise包裝Geolocation API
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position), 
          (error) => reject(error),
          { 
            enableHighAccuracy: true, 
            timeout: 10000, 
            maximumAge: 0 
          }
        );
      });
      
      const { latitude, longitude } = position.coords;
      setCoordinates({ latitude, longitude });
      setIsGettingLocation(false);
      return { latitude, longitude };
    } catch (err) {
      handleLocationError(err as GeolocationPositionError);
      setIsGettingLocation(false);
      throw err;
    }
  };
  
  // 處理位置錯誤
  const handleLocationError = (error: GeolocationPositionError) => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        setError('您已拒絕位置存取權限，請在設備設定中允許位置權限後重試');
        break;
      case error.POSITION_UNAVAILABLE:
        setError('無法獲取您的位置，請確保GPS已開啟');
        break;
      case error.TIMEOUT:
        setError('獲取位置超時，請稍後再試');
        break;
      default:
        setError('獲取位置時發生錯誤');
    }
  };
  
  // 處理打卡
  const handlePunch = async () => {
    setIsLoading(true);
    setError(null);
    setPunchResult(null);
    
    try {
      // 先獲取位置
      const location = await getLocation();
      
      if (!location) {
        setIsLoading(false);
        return;
      }
      
      // 發送打卡請求
      const response = await apiClient.post('/api/attendance/punch', {
        latitude: location.latitude,
        longitude: location.longitude
      });
      
      // 更新打卡結果
      setPunchResult(response.data);
      
      // 重新獲取最後一次打卡記錄
      fetchLastPunch();
    } catch (err) {
      console.error('打卡失敗:', err);
      if (!error) {
        setError('打卡失敗，請稍後再試');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // 登出
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/employee/login');
    } catch (err) {
      console.error('登出失敗:', err);
      setError('登出失敗，請稍後再試');
    }
  };
  
  // 重新整理
  const handleRefresh = () => {
    fetchLastPunch();
    setCurrentTime(new Date());
    setPunchResult(null);
    setError(null);
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4 }}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 3, 
            borderRadius: 2,
            mb: 3,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main',
                width: 48,
                height: 48
              }}
            >
              {user?.displayName ? user.displayName.charAt(0) : user?.email?.charAt(0) || 'U'}
            </Avatar>
            <Box>
              <Typography variant="h6">
                {user?.displayName || user?.email?.split('@')[0] || '員工'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email || '未登入'}
              </Typography>
            </Box>
          </Box>
          
          <Box>
            <IconButton onClick={handleRefresh} title="重新整理">
              <Refresh />
            </IconButton>
            <IconButton onClick={handleLogout} title="登出" color="error">
              <ExitToApp />
            </IconButton>
          </Box>
        </Paper>
        
        <Card sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom textAlign="center">
              {formatDate(currentTime)}
            </Typography>
            <Typography 
              variant="h2" 
              fontWeight="bold" 
              textAlign="center"
              sx={{ 
                fontFamily: 'monospace',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 1
              }}
            >
              <AccessTime sx={{ fontSize: 32 }} />
              {formatTime(currentTime)}
            </Typography>
          </CardContent>
        </Card>
        
        {lastPunch && (
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                最後打卡記錄
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {lastPunch.type === 'in' ? 
                    <Chip label="上班" color="success" size="small" /> : 
                    <Chip label="下班" color="info" size="small" />
                  }
                  <Typography>{lastPunch.time}</Typography>
                </Box>
                {lastPunch.success ? 
                  <CheckCircle color="success" /> : 
                  <Warning color="warning" />
                }
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {lastPunch.message}
              </Typography>
            </CardContent>
          </Card>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {punchResult && (
          <Alert 
            severity={punchResult.success ? "success" : "warning"} 
            sx={{ mb: 3 }}
          >
            <Typography variant="body1">
              {punchResult.success ? '打卡成功' : '打卡警告'}
            </Typography>
            <Typography variant="body2">
              {punchResult.type === 'in' ? '上班打卡' : '下班打卡'}: {punchResult.time}
            </Typography>
            <Typography variant="body2">
              {punchResult.message}
            </Typography>
          </Alert>
        )}
        
        {coordinates && (
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationOn color="primary" />
                您的位置: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
              </Typography>
            </CardContent>
          </Card>
        )}
        
        <Stack spacing={2}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={isLoading || isGettingLocation}
            onClick={handlePunch}
            sx={{ 
              py: 3, 
              borderRadius: 4,
              fontWeight: 'bold',
              fontSize: '1.1rem'
            }}
          >
            {isLoading || isGettingLocation ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              <>
                {!coordinates ? '獲取位置並打卡' : '打卡'}
              </>
            )}
          </Button>
          
          <Typography variant="caption" textAlign="center" color="text.secondary">
            點擊打卡按鈕會自動獲取您的位置進行打卡
          </Typography>
        </Stack>
      </Box>
    </Container>
  );
};

export default PunchPage; 