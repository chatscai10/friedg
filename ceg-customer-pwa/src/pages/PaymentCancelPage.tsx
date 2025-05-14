import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Typography, Container, Paper, Button, Box, Alert } from '@mui/material';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';

const PaymentCancelPage: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const orderId = queryParams.get('orderId') || sessionStorage.getItem('linePayOrderId'); // Get orderId if LINE Pay passes it, or from session

  // Clean up session storage if the user explicitly landed here from LINE Pay cancel
  // (though they might also navigate away and come back later, so orderId from session is a fallback)
  // useEffect(() => {
  //   if (queryParams.get('fromLinePayCancel') === 'true') { // Hypothetical query param
  //       sessionStorage.removeItem('linePayOrderId');
  //       sessionStorage.removeItem('linePayTransactionId');
  //   }
  // }, [queryParams]);

  return (
    <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: {xs: 3, sm: 5} }}>
        <HighlightOffIcon color="warning" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h5" component="h2" gutterBottom>
          支付未完成或已取消
        </Typography>
        <Alert severity="warning" sx={{my:2}}>
          您的 LINE Pay 支付未成功完成或已被您取消。
          {orderId && ` 您可以嘗試重新為訂單 ${orderId.substring(0,8)} 支付，或檢查您的訂單歷史。`}
        </Alert>
        
        <Box sx={{ mt: 3, display: 'flex', flexDirection: {xs: 'column', sm: 'row'}, justifyContent: 'center', gap: 2 }}>
          {orderId && (
            <Button 
              component={RouterLink} 
              // Ideally, we'd navigate back to a page that allows re-initiating payment for this specific orderId
              // For now, let's send them to checkout, they might need to rebuild the cart or we need a mechanism to repopulate.
              // Or better, to order history where they might find the pending order.
              to={`/history`} // Or /order/${orderId}/pay-again if such page exists
              variant="contained" 
              color="primary"
            >
              查看訂單記錄
            </Button>
          )}
          <Button component={RouterLink} to="/cart" variant="outlined" color="secondary">
            返回購物車
          </Button>
          <Button component={RouterLink} to="/" variant="text" color="inherit">
            返回首頁
          </Button>
        </Box>
        {orderId && 
            <Typography variant="caption" display="block" sx={{mt:3}}>
                如果您已完成支付但仍看到此頁面，請稍候幾分鐘或聯繫客服。
            </Typography>
        }
      </Paper>
    </Container>
  );
};

export default PaymentCancelPage; 