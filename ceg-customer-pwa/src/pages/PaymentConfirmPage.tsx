import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import { Typography, Container, Paper, Button, CircularProgress, Box, Alert } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
// import { confirmLinePayTransaction } from '@/services/paymentService'; // Assuming a service function to confirm with backend
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/contexts/NotificationContext';

const PaymentConfirmPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // const { orderId: pathOrderId } = useParams<{ orderId: string }>(); // If orderId is in path
  const { getIdToken } = useAuth();
  const { addNotification } = useNotification();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const processPaymentConfirmation = async () => {
      const queryParams = new URLSearchParams(location.search);
      const transactionId = queryParams.get('transactionId');
      const orderIdFromQuery = queryParams.get('orderId'); // LINE Pay specific query param for orderId
      const linePayOrderId = sessionStorage.getItem('linePayOrderId');
      
      // Use orderId from query param first, fallback to sessionStorage if not present
      // LINE Pay documentation indicates they append orderId and transactionId to the confirmUrl
      const effectiveOrderId = orderIdFromQuery || linePayOrderId;

      if (!transactionId || !effectiveOrderId) {
        setError('支付資訊不完整，無法確認訂單狀態。');
        addNotification('支付資訊不完整，無法確認。', 'error');
        setIsLoading(false);
        return;
      }

      const token = await getIdToken();
      if (!token) {
        setError('使用者驗證失敗，請重新登入後再試。');
        addNotification('使用者驗證失敗。', 'error');
        setIsLoading(false);
        return;
      }
      
      try {
        // TODO: Call backend to confirm payment and update order status
        // const response = await confirmLinePayTransaction({ orderId: effectiveOrderId, transactionId }, token);
        // For now, simulate success as backend endpoint is not yet implemented/updated for this exact flow
        console.log(`Simulating confirmation for orderId: ${effectiveOrderId}, transactionId: ${transactionId}`);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
        const simulatedResponse = { success: true, message: 'LINE Pay 支付已確認！訂單處理中。', orderId: effectiveOrderId }; 

        if (simulatedResponse.success) {
          setConfirmationMessage(simulatedResponse.message || '支付成功！感謝您的訂購。');
          setConfirmedOrderId(simulatedResponse.orderId);
          addNotification('LINE Pay 支付已成功確認！', 'success');
          sessionStorage.removeItem('linePayOrderId'); // Clean up session storage
          sessionStorage.removeItem('linePayTransactionId');
          // navigate(`/order/${simulatedResponse.orderId}/status`); // Navigate to order status page
        } else {
          setError(simulatedResponse.message || '支付確認失敗，請聯繫客服。');
          addNotification(simulatedResponse.message || '支付確認失敗。', 'error');
        }
      } catch (err: any) {
        console.error("Error confirming payment:", err);
        setError(err.message || '確認支付過程中發生錯誤。');
        addNotification('確認支付過程中發生錯誤。', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    processPaymentConfirmation();
  }, [location.search, getIdToken, navigate, addNotification]);

  if (isLoading) {
    return (
      <Container sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Box textAlign="center">
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6">正在確認您的支付狀態，請稍候...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: {xs: 3, sm: 5} }}>
        {error && (
          <>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h5" component="h2" color="error" gutterBottom>
              支付確認失敗
            </Typography>
            <Alert severity="error" sx={{my:2}}>{error}</Alert>
            <Button component={RouterLink} to="/cart" variant="contained" color="primary" sx={{ mr: 1, mt:2 }}>
              返回購物車
            </Button>
            <Button component={RouterLink} to="/history" variant="outlined" color="secondary" sx={{ mt:2 }}>
              查看訂單歷史
            </Button>
          </>
        )}
        {!error && confirmationMessage && (
          <>
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h5" component="h2" color="primary.main" gutterBottom>
              {confirmationMessage}
            </Typography>
            {confirmedOrderId && 
              <Typography variant="body1" color="text.secondary" sx={{mb:3}}>
                您的訂單編號: {confirmedOrderId}
              </Typography>
            }
            <Button component={RouterLink} to={`/order/${confirmedOrderId}/status`} variant="contained" color="primary" sx={{ mr: 1, mt:2 }}>
              查看訂單狀態
            </Button>
            <Button component={RouterLink} to="/" variant="outlined" color="secondary" sx={{ mt:2 }}>
              繼續購物
            </Button>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default PaymentConfirmPage; 