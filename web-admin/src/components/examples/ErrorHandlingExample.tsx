import React, { useState } from 'react';
import { Button, Box, Typography, Stack, Paper, TextField, CircularProgress } from '@mui/material';
import { useNotification } from '../../contexts/NotificationContext';
import { handleApiError, tryCatchAsync } from '../../utils/errorHandler';

// 模擬API調用函數
const simulateApiCall = async (shouldFail: boolean = false): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 模擬網絡延遲
    setTimeout(() => {
      if (shouldFail) {
        // 模擬不同類型的錯誤
        const errorTypes = [
          { code: 'auth/user-not-found', message: 'Firebase: User not found' },
          { isAxiosError: true, response: { status: 404, data: { message: 'Resource not found' } } },
          new Error('一般JavaScript錯誤'),
          '字符串錯誤消息'
        ];
        const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        reject(randomError);
      } else {
        resolve('操作成功完成！');
      }
    }, 1500);
  });
};

/**
 * 錯誤處理示例組件
 * 展示如何將錯誤處理工具與通知系統結合使用
 */
const ErrorHandlingExample: React.FC = () => {
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // 使用我們的錯誤處理工具處理異步操作
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // 基本驗證示例
      if (!inputValue.trim()) {
        throw new Error('請輸入一些文字再提交');
      }
      
      // 成功的API調用
      const result = await simulateApiCall(false);
      showSuccessNotification(result);
    } catch (error) {
      // 使用錯誤處理工具格式化錯誤訊息
      const errorMessage = handleApiError(error);
      showErrorNotification(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 使用tryCatchAsync輔助函數處理異步操作
  const handleFailingSubmit = async () => {
    setLoading(true);
    
    const result = await tryCatchAsync(
      // 異步操作
      () => simulateApiCall(true), 
      // 錯誤處理回調
      (errorMessage) => {
        showErrorNotification(typeof errorMessage === 'string' ? errorMessage : '發生未知錯誤');
      }
    );
    
    if (result) {
      showSuccessNotification(result);
    }
    
    setLoading(false);
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto', my: 4 }}>
      <Typography variant="h5" gutterBottom>
        錯誤處理與通知集成示例
      </Typography>
      
      <Typography variant="body1" paragraph>
        此示例展示了如何使用統一的錯誤處理工具配合通知系統，處理各種API和操作錯誤。
      </Typography>
      
      <Box sx={{ my: 3 }}>
        <Typography variant="h6" gutterBottom>
          基本表單提交與錯誤處理
        </Typography>
        
        <TextField
          fullWidth
          label="輸入一些文字"
          variant="outlined"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          margin="normal"
        />
        
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            提交（成功）
          </Button>
          
          <Button 
            variant="outlined" 
            color="error"
            onClick={handleFailingSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="error" /> : null}
          >
            提交（故意失敗）
          </Button>
        </Stack>
      </Box>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6">使用建議</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          1. 在API服務中使用tryCatchAsync封裝所有異步調用。
        </Typography>
        <Typography variant="body2">
          2. 使用handleApiError統一格式化各種錯誤類型。
        </Typography>
        <Typography variant="body2">
          3. 將格式化後的錯誤信息通過通知系統顯示給用戶。
        </Typography>
      </Box>
    </Paper>
  );
};

export default ErrorHandlingExample; 