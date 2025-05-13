import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Container,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff, Email, Lock } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const auth = getAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Firebase 認證
      await signInWithEmailAndPassword(auth, email, password);
      
      // 登入成功，導向打卡頁面
      navigate('/employee/punch');
    } catch (err: any) {
      console.error('登入失敗:', err);
      setError(getErrorMessage(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  // 根據錯誤代碼返回具體錯誤信息
  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/invalid-email':
        return '電子郵件格式不正確';
      case 'auth/user-disabled':
        return '此帳號已被停用';
      case 'auth/user-not-found':
        return '找不到此電子郵件對應的帳號';
      case 'auth/wrong-password':
        return '密碼不正確';
      case 'auth/too-many-requests':
        return '登入嘗試次數過多，請稍後再試';
      default:
        return '登入失敗，請稍後再試';
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: 2
          }}
        >
          <Stack spacing={3}>
            <Box textAlign="center">
              <Typography variant="h5" fontWeight="bold">
                員工登入
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                吃雞排找不早 - 員工專用打卡系統
              </Typography>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Box component="form" onSubmit={handleLogin}>
              <Stack spacing={3}>
                <TextField
                  fullWidth
                  label="電子郵件"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Email color="primary" />
                      </InputAdornment>
                    )
                  }}
                />

                <TextField
                  fullWidth
                  label="密碼"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="primary" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleTogglePasswordVisibility}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={isLoading}
                  sx={{ mt: 2, borderRadius: '8px', py: 1.5 }}
                >
                  {isLoading ? <CircularProgress size={24} /> : '登入'}
                </Button>
              </Stack>
            </Box>

            <Divider sx={{ my: 1 }}>
              <Typography variant="caption" color="text.secondary">
                或
              </Typography>
            </Divider>

            <Button
              fullWidth
              variant="outlined"
              size="large"
              sx={{ 
                borderRadius: '8px', 
                py: 1.5, 
                backgroundColor: '#06C755',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#05a949',
                }
              }}
            >
              LINE 登入
            </Button>

            <Typography variant="caption" color="text.secondary" textAlign="center">
              登入即表示您同意我們的服務條款與隱私政策
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage; 