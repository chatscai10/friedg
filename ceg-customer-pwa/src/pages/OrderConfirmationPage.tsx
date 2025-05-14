import React from 'react';
import { useParams, Link as RouterLink, Navigate } from 'react-router-dom';
import { Container, Typography, Button, Box, Paper } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const OrderConfirmationPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();

  if (!orderId) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="sm" sx={{ py: {xs:3, sm:5} }}>
      <Paper elevation={3} sx={{
        p: {xs: 2, sm: 4},
        textAlign: 'center',
        // backgroundColor: (theme) => theme.palette.success.lightest, // A very light green, if defined in theme
        border: (theme) => `2px solid ${theme.palette.success.main}`,
        borderRadius: 2 // theme.shape.borderRadius * 2
      }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'success.dark', fontWeight: 'bold' }}>
          訂單已成功提交！
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" paragraph>
          感謝您的訂購，我們已收到您的訂單。
        </Typography>
        <Typography variant="h6" component="p" gutterBottom sx={{mb:3}}>
          您的訂單號碼是: <Box component="strong" sx={{ color: 'primary.main', display: 'block', fontSize: '1.2em', mt:0.5 }}>{orderId}</Box>
        </Typography>
        <Typography variant="body1" paragraph>
          我們將盡快為您準備餐點。
        </Typography>
        <Typography variant="body1" paragraph color="text.secondary" sx={{mb:3}}>
          您可以隨時前往「我的訂單」頁面追蹤訂單狀態。
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button 
                component={RouterLink} 
                to={`/order/${orderId}`}
                variant="outlined"
                color="primary"
                size="large"
            >
                查看訂單詳情
            </Button>
            <Button 
                component={RouterLink} 
                to="/"
                variant="contained"
                color="primary"
                size="large"
            >
                返回首頁繼續點餐
            </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default OrderConfirmationPage; 