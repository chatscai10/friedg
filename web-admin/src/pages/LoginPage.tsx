import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { Container, TextField, Button, Typography, Box, Alert } from '@mui/material';
import { FirebaseError } from 'firebase/app';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.login(email, password);
      console.log('Login successful');
      // Navigate to the dashboard or desired route after successful login
      navigate('/'); // Navigate to the root/dashboard
    } catch (err) {
      console.error('Login failed:', err);
      let errorMessage = '登入失敗，請檢查您的帳號或密碼。';
      // Check if it's a FirebaseError to safely access err.code
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            errorMessage = '帳號或密碼錯誤。';
        } else if (err.code === 'auth/invalid-email') {
            errorMessage = '信箱格式錯誤。';
        }
        // Add more specific Firebase Auth error codes if needed
      }
      // Handle other potential errors (e.g., network errors) if necessary
      setError(errorMessage);
    } finally {
      setLoading(false);
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
        <Typography component="h1" variant="h5">
          管理員登入
        </Typography>
        <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
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
          {error && (
            <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? '登入中...' : '登入'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default LoginPage; 