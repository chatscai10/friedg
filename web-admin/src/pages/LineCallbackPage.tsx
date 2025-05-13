import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Paper, Alert } from '@mui/material';
import { authService } from '../services/authService';

/**
 * LINE登入回調頁面
 * 處理來自LINE的授權回調，並完成Firebase登入流程
 */
const LineCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 從URL取得參數
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');
        const idToken = urlParams.get('id_token');
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        const state = urlParams.get('state');
        
        // 處理錯誤情況
        if (error) {
          setError(`LINE登入失敗: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
          setLoading(false);
          return;
        }
        
        // 驗證參數
        if (!accessToken || !idToken) {
          setError('無效的回調參數: 缺少必要的令牌');
          setLoading(false);
          return;
        }
        
        // 解析state參數
        let tenantHint: string | undefined;
        if (state) {
          try {
            const stateData = JSON.parse(atob(state));
            tenantHint = stateData.tenant_hint;
          } catch (e) {
            console.warn('無法解析state參數:', e);
          }
        }
        
        // 使用LINE tokens交換Firebase token並完成登入
        await authService.handleLineCallback(accessToken, idToken, tenantHint);
        
        // 登入成功，重定向到首頁
        navigate('/', { replace: true });
      } catch (error) {
        console.error('LINE回調處理失敗:', error);
        setError('LINE登入過程中發生錯誤，請稍後再試');
        setLoading(false);
      }
    };
    
    handleCallback();
  }, [navigate]);
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: '#f5f5f5',
        p: 3
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
          borderRadius: 2,
        }}
      >
        <Typography variant="h5" gutterBottom>
          LINE 登入
        </Typography>
        
        {loading ? (
          <>
            <CircularProgress sx={{ my: 4 }} />
            <Typography variant="body1">
              正在完成登入流程，請稍候...
            </Typography>
          </>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </Paper>
    </Box>
  );
};

export default LineCallbackPage; 