import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, TextField, Button, Typography, Box, Alert, CircularProgress, Paper, Divider } from '@mui/material';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '../hooks/useAuth';
import { Login as LoginIcon } from '@mui/icons-material';
import { authService } from '../services/authService';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [lineLoading, setLineLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login, isAuthenticated, loading, error, clearError } = useAuth();
  
  // 如果已登入，重定向到首頁
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);
  
  // 顯示Redux中的錯誤
  useEffect(() => {
    if (error) {
      setLocalError(error);
    }
  }, [error]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    clearError();
    
    try {
      await login(email, password);
      // 不需要手動導航，useEffect會處理
    } catch (err) {
      console.error('Login failed:', err);
      let errorMessage = '登入失敗，請檢查您的帳號或密碼。';
      // 處理特定錯誤
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          errorMessage = '帳號或密碼錯誤。';
        } else if (err.code === 'auth/invalid-email') {
          errorMessage = '信箱格式錯誤。';
        }
      }
      setLocalError(errorMessage);
    }
  };

  const handleLineLogin = async () => {
    setLocalError(null);
    clearError();
    setLineLoading(true);
    
    try {
      // 開始LINE登入流程
      authService.loginWithLine();
      // 導向到LINE登入頁面後不需要額外操作
    } catch (err) {
      console.error('LINE login failed:', err);
      setLocalError('LINE登入初始化失敗，請稍後再試。');
      setLineLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <Typography component="h1" variant="h5" gutterBottom>
            吃雞排找不早系統
          </Typography>
          <Typography component="h2" variant="h6" color="primary" sx={{ mb: 3 }}>
            管理後台登入
          </Typography>
          
          <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="電子郵件"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="密碼"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            {localError && (
              <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
                {localError}
              </Alert>
            )}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
            >
              {loading ? '登入中...' : '登入'}
            </Button>
            
            <Divider sx={{ my: 2 }}>或</Divider>
            
            <Button
              fullWidth
              variant="outlined"
              sx={{ 
                mt: 1,
                mb: 2,
                bgcolor: '#06C755',
                color: 'white',
                border: 'none',
                '&:hover': {
                  bgcolor: '#05A848',
                  border: 'none',
                }
              }}
              disabled={lineLoading || loading}
              onClick={handleLineLogin}
              startIcon={lineLoading ? <CircularProgress size={20} color="inherit" /> : (
                <Box
                  component="img"
                  src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg"
                  alt="LINE"
                  sx={{ width: 20, height: 20 }}
                />
              )}
            >
              {lineLoading ? 'LINE登入中...' : '使用LINE登入'}
            </Button>
          </Box>
        </Paper>
        
        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          © 2025 吃雞排找不早 - 版權所有
        </Typography>
      </Box>
    </Container>
  );
}

export default LoginPage; 