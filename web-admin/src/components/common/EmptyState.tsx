import React from 'react';
import { Box, Typography, Button, useTheme, SvgIcon } from '@mui/material';
import { SvgIconComponent } from '@mui/icons-material';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: SvgIconComponent;
  actionText?: string;
  onAction?: () => void;
  sx?: React.CSSProperties | Record<string, unknown>;
}

/**
 * 通用空狀態組件
 * 用於顯示當列表或資料為空時的友好提示
 * 
 * @param title 標題
 * @param message 提示訊息
 * @param icon 圖示組件
 * @param actionText 操作按鈕文字
 * @param onAction 操作按鈕點擊事件
 * @param sx 自定義樣式
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  title = '沒有資料',
  message = '目前沒有任何資料可以顯示',
  icon: Icon,
  actionText,
  onAction,
  sx = {}
}) => {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        py: 8,
        px: 2,
        ...sx
      }}
    >
      {Icon && (
        <SvgIcon
          component={Icon}
          sx={{
            fontSize: 64,
            color: theme.palette.text.secondary,
            opacity: 0.6,
            mb: 2
          }}
        />
      )}
      
      <Typography
        variant="h5"
        color="textSecondary"
        gutterBottom
      >
        {title}
      </Typography>
      
      <Typography
        variant="body1"
        color="textSecondary"
        sx={{ mb: actionText ? 3 : 0, maxWidth: 450 }}
      >
        {message}
      </Typography>
      
      {actionText && onAction && (
        <Button
          variant="contained"
          color="primary"
          onClick={onAction}
          sx={{ mt: 2 }}
        >
          {actionText}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState; 