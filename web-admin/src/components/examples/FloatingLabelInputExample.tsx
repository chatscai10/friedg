import React, { useState } from 'react';
import { Box, Typography, Grid, Button, Paper } from '@mui/material';
import FloatingLabelInput from '../common/FloatingLabelInput';

/**
 * 浮動標籤輸入框示例組件
 * 展示如何使用自定義的FloatingLabelInput組件
 */
const FloatingLabelInputExample: React.FC = () => {
  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    phone: ''
  });
  
  const [hasError, setHasError] = useState(false);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 示例：如果name輸入為空，顯示錯誤
    if (name === 'name' && !value && hasError) {
      setHasError(true);
    } else if (name === 'name' && value && hasError) {
      setHasError(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.name) {
      setHasError(true);
      return;
    }
    
    // 這裡可以處理表單提交邏輯
    alert(`表單已提交: ${JSON.stringify(formValues, null, 2)}`);
  };
  
  return (
    <Paper sx={{ p: 4, m: 2, maxWidth: 600 }}>
      <Typography variant="h5" gutterBottom>
        浮動標籤輸入框示例
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        這個示例展示了基於「風格/輸入框.txt」設計的浮動標籤輸入框組件。
      </Typography>
      
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FloatingLabelInput
              label="姓名"
              name="name"
              value={formValues.name}
              onChange={handleChange}
              required
              error={hasError}
              helperText={hasError ? "請輸入姓名" : ""}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12}>
            <FloatingLabelInput
              label="電子郵件"
              name="email"
              type="email"
              value={formValues.email}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12}>
            <FloatingLabelInput
              label="電話號碼"
              name="phone"
              value={formValues.phone}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          
          <Grid item xs={12}>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              fullWidth
            >
              提交
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default FloatingLabelInputExample; 