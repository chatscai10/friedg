import React from 'react';
import { Button, Box, Typography, Stack, Paper } from '@mui/material';
import { useNotification } from '../../contexts/NotificationContext';

/**
 * 通知示例組件
 * 展示如何使用通知服務來顯示不同類型的通知
 */
const NotificationExample: React.FC = () => {
  const { 
    showSuccessNotification, 
    showErrorNotification, 
    showWarningNotification,
    showInfoNotification
  } = useNotification();

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto', my: 4 }}>
      <Typography variant="h5" gutterBottom>
        通知系統示例
      </Typography>
      
      <Typography variant="body1" paragraph>
        這個示例展示了如何使用通知系統顯示不同類型的通知消息。
        在實際應用中，您可以在表單提交、數據加載、錯誤處理等場景使用這些通知。
      </Typography>
      
      <Box sx={{ my: 3 }}>
        <Typography variant="h6" gutterBottom>
          基本通知類型
        </Typography>
        
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <Button 
            variant="contained" 
            color="success" 
            onClick={() => showSuccessNotification('操作成功完成！')}
          >
            成功通知
          </Button>
          
          <Button 
            variant="contained" 
            color="error" 
            onClick={() => showErrorNotification('操作過程中發生錯誤')}
          >
            錯誤通知
          </Button>
          
          <Button 
            variant="contained" 
            color="warning" 
            onClick={() => showWarningNotification('請注意，這個操作有風險')}
          >
            警告通知
          </Button>
          
          <Button 
            variant="contained" 
            color="info" 
            onClick={() => showInfoNotification('這是一條信息通知')}
          >
            信息通知
          </Button>
        </Stack>
      </Box>
      
      <Box sx={{ my: 3 }}>
        <Typography variant="h6" gutterBottom>
          在實際場景中的用法示例
        </Typography>
        
        <Stack direction="column" spacing={2}>
          <Button 
            variant="outlined"
            onClick={() => {
              // 模擬表單提交
              setTimeout(() => {
                showSuccessNotification('員工信息已成功保存');
              }, 1000);
            }}
          >
            模擬表單提交
          </Button>
          
          <Button 
            variant="outlined"
            onClick={() => {
              // 模擬API錯誤
              setTimeout(() => {
                showErrorNotification('無法連接到服務器，請稍後再試');
              }, 1000);
            }}
          >
            模擬API錯誤
          </Button>
          
          <Button 
            variant="outlined"
            onClick={() => {
              // 模擬刪除確認
              const confirmed = window.confirm('確定要刪除此項目嗎？');
              if (confirmed) {
                showSuccessNotification('項目已成功刪除');
              } else {
                showInfoNotification('已取消刪除操作');
              }
            }}
          >
            模擬刪除操作
          </Button>
        </Stack>
      </Box>
      
      <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary' }}>
        通過引入 useNotification 鉤子，您可以在任何組件中使用這些通知方法。
        詳情請查看 NotificationContext.tsx 文件。
      </Typography>
    </Paper>
  );
};

export default NotificationExample; 