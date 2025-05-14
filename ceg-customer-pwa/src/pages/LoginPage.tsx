import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { RecaptchaVerifier } from 'firebase/auth';
import { TextField, Button, CircularProgress, Typography, Box, Paper } from '@mui/material';
import { useNotification } from '@/hooks/useNotification';

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const { 
    isAuthenticated, 
    loading, 
    error, 
    isOtpSent, 
    initializeRecaptcha, 
    sendOtp: sendOtpToService,
    confirmOtp: confirmOtpWithService
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const appVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const { addNotification } = useNotification();

  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    if (recaptchaContainerRef.current && !appVerifierRef.current && !isOtpSent) {
      const verifier = initializeRecaptcha('recaptcha-container-login');
      if (verifier) {
        appVerifierRef.current = verifier;
      }
    }
  }, [initializeRecaptcha, isOtpSent]);

  const handleSendOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phone.trim()) {
      addNotification('請輸入手機號碼', 'warning');
      return;
    }
    if (!appVerifierRef.current) {
      addNotification('reCAPTCHA 尚未初始化，請稍後再試。', 'warning');
      if (recaptchaContainerRef.current) {
          const verifier = initializeRecaptcha('recaptcha-container-login');
          if (verifier) appVerifierRef.current = verifier;
      }
      return;
    }
    await sendOtpToService(phone, appVerifierRef.current);
  };

  const handleConfirmOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!otp.trim()) {
      addNotification('請輸入驗證碼', 'warning');
      return;
    }
    await confirmOtpWithService(otp);
  };

  return (
    <Paper elevation={3} sx={{ maxWidth: '400px', margin: '50px auto', padding: { xs: 2, sm: 4 }, textAlign: 'center' }}>
      <Typography variant="h5" component="h2" gutterBottom>
        顧客登入
      </Typography>
      {!isOtpSent ? (
        <Box component="form" onSubmit={handleSendOtp} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField 
            type="tel" 
            label="手機號碼"
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            placeholder="+886912345678"
            fullWidth
            variant="outlined"
            disabled={loading}
            required
          />
          <Box id="recaptcha-container-box" sx={{ mt: 1, mb: 1, display: 'flex', justifyContent: 'center' }}>
            <div ref={recaptchaContainerRef} id="recaptcha-container-login"></div>
          </Box>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            disabled={loading} 
            fullWidth
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? '傳送中...' : '獲取手機驗證碼'}
          </Button>
        </Box>
      ) : (
        <Box component="form" onSubmit={handleConfirmOtp} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <Typography variant="body1" gutterBottom>
            已傳送驗證碼至 {phone}
          </Typography>
          <TextField 
            type="text"
            label="驗證碼"
            value={otp} 
            onChange={(e) => setOtp(e.target.value)} 
            placeholder="請輸入驗證碼"
            fullWidth
            variant="outlined"
            disabled={loading}
            required
            inputProps={{ autoComplete: 'one-time-code' }}
          />
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            disabled={loading} 
            fullWidth
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? '驗證中...' : '驗證並登入'}
          </Button>
        </Box>
      )}
      {error && <Typography color="error" sx={{ mt: 2 }}>錯誤：{error}</Typography>}
    </Paper>
  );
};

export default LoginPage; 