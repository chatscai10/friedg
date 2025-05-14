import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext'; // Assuming path
import { useNotification } from '../../contexts/NotificationContext'; // Assuming path
import orderService from '../../services/orderService'; // Assuming path
import { CircularProgress, Typography, Button, Container, Box, Paper } from '@mui/material'; // Assuming Material-UI

const OrderProcessingPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const { addNotification } = useNotification();
  const [message, setMessage] = useState('正在確認支付結果，請稍候...');
  const [isProcessing, setIsProcessing] = useState(true);
  const [showTimeoutControls, setShowTimeoutControls] = useState(false);

  const { orderId, transactionId: initialTransactionId, amount } = location.state as 
    { orderId: string; transactionId?: string; amount?: number }; // transactionId and amount might not always be there from LINE Pay initiation

  const checkOrderStatus = useCallback(async (currentOrderId: string) => {
    if (!currentOrderId) {
      setMessage('無效的訂單資訊。');
      addNotification('無效的訂單資訊，請重新下單', 'error');
      setIsProcessing(false);
      setShowTimeoutControls(true); // Show controls even for this error
      return;
    }

    try {
      // Simulate polling or a direct status check if available
      // In a real scenario, this might involve multiple retries or a webhook-driven update.
      // For this simulation, we use a timeout then check final status.
      
      // If we had a real transactionId from LINE Pay, we might use it to confirm.
      // For now, just using orderId.
      
      let attempts = 0;
      const maxAttempts = 5; // Poll for 5 times (e.g., 25 seconds total)
      const pollInterval = 5000; // 5 seconds

      const poll = async () => {
        attempts++;
        try {
          const orderDetails = await orderService.getOrderDetails(currentOrderId);
          if (orderDetails && orderDetails.status === 'paid') {
            setMessage('訂單支付成功！感謝您的訂購。');
            addNotification('訂單支付成功！', 'success');
            clearCart();
            setIsProcessing(false);
            setShowTimeoutControls(false);
            // Optional: Navigate to a success page or order details
            // navigate(`/order/${currentOrderId}`); 
            navigate('/history'); // Navigate to order history for now
            return;
          } else if (orderDetails && orderDetails.status === 'payment_failed') {
            setMessage('訂單支付失敗，請重新嘗試或聯繫客服。');
            addNotification('支付失敗，請重試', 'error');
            setIsProcessing(false);
            setShowTimeoutControls(true);
            return;
          } else if (attempts >= maxAttempts) {
            setMessage('訂單處理中，請稍後在訂單歷史中查看結果。');
            addNotification('訂單仍在處理中，請稍後查看。', 'info');
            setIsProcessing(false);
            setShowTimeoutControls(true);
            return;
          }
          // If still pending or other intermediate status, continue polling
          setTimeout(poll, pollInterval);
        } catch (error: any) {
          console.error("Error checking order status:", error);
          if (attempts >= maxAttempts) {
            setMessage('查詢訂單狀態時發生錯誤，請稍後在訂單歷史中查看。');
            addNotification('查詢訂單狀態失敗', 'error');
            setIsProcessing(false);
            setShowTimeoutControls(true);
          } else {
            setTimeout(poll, pollInterval);
          }
        }
      };
      
      poll();

    } catch (error) {
      console.error("Error processing order:", error);
      setMessage('訂單處理時發生未知錯誤。');
      addNotification('訂單處理失敗', 'error');
      setIsProcessing(false);
      setShowTimeoutControls(true);
    }
  }, [addNotification, clearCart, navigate]);

  useEffect(() => {
    if (!orderId) {
      addNotification('無訂單資訊，無法處理支付狀態。', 'error');
      navigate('/'); // Redirect to home if no orderId
      return;
    }
    // Start checking status when component mounts
    checkOrderStatus(orderId);
  }, [orderId, navigate, addNotification, checkOrderStatus]);

  return (
    <Container component={Paper} sx={{ mt: 4, p: 3, textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>
        訂單處理中
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', my: 3 }}>
        {isProcessing && <CircularProgress sx={{ mb: 2 }} />} 
        <Typography variant="body1">{message}</Typography>
      </Box>
      {showTimeoutControls && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button component={Link} to="/" variant="outlined">
            返回首頁
          </Button>
          <Button component={Link} to="/history" variant="contained">
            查看訂單歷史
          </Button>
        </Box>
      )}
    </Container>
  );
};

export default OrderProcessingPage; 