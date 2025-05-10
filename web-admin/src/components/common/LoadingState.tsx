import React from 'react';
import { Box, CircularProgress, Typography, useTheme } from '@mui/material';

interface LoadingStateProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullPage?: boolean;
}

/**
 * 通用載入中狀態組件
 * 
 * @param message 顯示的載入訊息
 * @param size 載入圖示大小
 * @param fullPage 是否佔據整個頁面
 */
const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = '載入中，請稍候...', 
  size = 'medium',
  fullPage = false
}) => {
  const theme = useTheme();
  
  const getSizeValue = () => {
    switch (size) {
      case 'small': return 30;
      case 'large': return 60;
      default: return 40;
    }
  };
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center',
        py: fullPage ? 0 : 6,
        minHeight: fullPage ? '80vh' : 'auto',
        width: '100%',
        color: theme.palette.text.secondary
      }}
    >
      <CircularProgress size={getSizeValue()} color="primary" />
      {message && (
        <Typography 
          variant={size === 'large' ? 'h6' : 'body1'} 
          color="inherit"
          sx={{ mt: 2 }}
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default LoadingState; 