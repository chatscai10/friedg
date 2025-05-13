import React from 'react';
import { Box, Typography, Button, Container, Paper, Divider, Chip, Link } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock as LockIcon, ArrowBack as ArrowBackIcon, Home as HomeIcon, ExitToApp as ExitToAppIcon } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';

/**
 * 未授權頁面
 * 顯示當用戶嘗試訪問沒有權限的頁面時的錯誤訊息
 */
const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  
  // 獲取用戶嘗試訪問的路徑
  const attemptedPath = location.state?.from?.pathname || '未知路徑';

  const handleGoBack = () => {
    navigate(-1); // 返回上一頁
  };

  const handleGoHome = () => {
    navigate('/'); // 返回首頁
  };

  const handleLogin = () => {
    navigate('/login'); // 前往登入頁面
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('登出失敗:', error);
    }
  };

  return (
    <Container maxWidth="md">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          py: 4
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%'
          }}
        >
          <Box 
            sx={{ 
              bgcolor: 'error.light', 
              color: 'error.contrastText',
              borderRadius: '50%',
              p: 2,
              mb: 2
            }}
          >
            <LockIcon fontSize="large" />
          </Box>
          
          <Typography variant="h4" gutterBottom color="error">
            存取被拒絕
          </Typography>
          
          <Typography variant="h6" gutterBottom>
            您沒有權限訪問此頁面
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph sx={{ mt: 1, mb: 3 }}>
            {isAuthenticated 
              ? '您的賬戶沒有訪問此資源所需的權限。如果您認為這是錯誤，請聯絡系統管理員。'
              : '請先登入後再嘗試訪問此頁面。'
            }
          </Typography>
          
          <Divider sx={{ width: '100%', my: 2 }} />
          
          {isAuthenticated && user && (
            <Box sx={{ width: '100%', mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom align="left">
                當前用戶信息:
              </Typography>
              <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
                <Typography variant="body2" align="left">
                  用戶名: {user.displayName || user.email || '未知用戶'}
                </Typography>
                <Typography variant="body2" align="left">
                  角色: 
                  <Box sx={{ display: 'inline-flex', ml: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    {user.roles.length > 0 ? 
                      user.roles.map(role => (
                        <Chip key={role} label={role} size="small" color="primary" variant="outlined" />
                      )) : 
                      <Chip label="無角色" size="small" color="default" variant="outlined" />
                    }
                  </Box>
                </Typography>
                <Typography variant="body2" align="left">
                  嘗試訪問: <Link underline="hover">{attemptedPath}</Link>
                </Typography>
              </Box>
            </Box>
          )}
          
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            {isAuthenticated ? (
              <>
                <Button 
                  variant="outlined" 
                  onClick={handleGoBack}
                  startIcon={<ArrowBackIcon />}
                >
                  返回上頁
                </Button>
                <Button 
                  variant="contained" 
                  onClick={handleGoHome}
                  startIcon={<HomeIcon />}
                >
                  返回首頁
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  onClick={handleLogout}
                  startIcon={<ExitToAppIcon />}
                >
                  登出
                </Button>
              </>
            ) : (
              <Button 
                variant="contained" 
                onClick={handleLogin}
                startIcon={<ExitToAppIcon />}
              >
                前往登入
              </Button>
            )}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default UnauthorizedPage; 