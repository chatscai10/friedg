import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getMyOrders, OrderSummary } from '@/services/orderService';
import { useNotification } from '@/contexts/NotificationContext';
import { getOrderStatusText, getOrderStatusChipColor } from '@/utils/orderUtils';
import {
  Container, Typography, Alert, CircularProgress, Box, Paper, List, ListItem, ListItemText, Button, Divider, Chip, Grid
} from '@mui/material';

const OrderHistoryPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { isAuthenticated, currentUserToken } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  useEffect(() => {
    if (!isAuthenticated) {
      addNotification('請先登入以查看訂單歷史。', 'warning');
      navigate('/login', { state: { from: { pathname: '/history' } } });
      return;
    }

    const fetchOrders = async () => {
      setLoading(true);
      try {
        const token = await currentUserToken();
        if (!token) {
          addNotification('無法獲取認證令牌，請重新登入。', 'error');
          setLoading(false);
          return;
        }
        const response = await getMyOrders(token);
        if (response.success && response.data) {
          setOrders(response.data);
        } else {
          addNotification(response.message || '獲取訂單歷史失敗。', 'error');
          setOrders([]);
        }
      } catch (err: any) {
        console.error("Error fetching order history:", err);
        addNotification(err.message || '獲取訂單歷史時發生未知錯誤。', 'error');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, navigate, currentUserToken, addNotification]);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
      let date;
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else if (timestamp._seconds) {
        date = new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
      }
      return date ? date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' , hour: '2-digit', minute: '2-digit'}) : 'Invalid Date';
    } catch (e) {
      console.error("Error formatting date:", e, timestamp);
      return 'Invalid Date Format';
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Box textAlign="center">
            <CircularProgress size={60} sx={{mb: 2}}/>
            <Typography variant="h6">載入訂單歷史中...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: {xs: 2, sm: 4} }}>
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom sx={{ mb: {xs:2, sm:4} }}>
        我的訂單歷史
      </Typography>
      
      {orders.length === 0 && !loading && (
        <Paper elevation={1} sx={{p:3, textAlign: 'center'}}>
            <Alert severity="info" sx={{mb: 2}}>您目前沒有任何訂單。</Alert>
            <Button component={RouterLink} to="/" variant="contained" color="primary">
              前往點餐
            </Button>
        </Paper>
      )}

      {orders.length > 0 && (
        <List disablePadding>
          {orders.map((order, index) => (
            <React.Fragment key={order.id}>
              <Paper elevation={2} sx={{ mb: 2, p: {xs: 1.5, sm:2.5} }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={8}>
                    <Typography variant="subtitle1" component="h3" gutterBottom sx={{fontWeight: 'bold'}}>
                      訂單號: {order.id.substring(0, 8)}...
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      日期: {formatDate(order.createdAt)}
                    </Typography>
                    <Box sx={{display: 'flex', alignItems: 'center', mt: 0.5}}>
                        <Typography variant="body2" color="text.secondary" sx={{mr:0.5}}>
                            狀態: 
                        </Typography>
                        <Chip 
                            label={getOrderStatusText(order.status)}
                            color={getOrderStatusChipColor(order.status)}
                            size="small" 
                        />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={4} sx={{ textAlign: {xs: 'left', sm: 'right'}, mt: {xs:1, sm:0} }}>
                    <Typography variant="h6" component="p" sx={{fontWeight: 'bold', mb:1}}>
                      ${order.totalAmount.toFixed(2)}
                    </Typography>
                    <Button 
                      component={RouterLink} 
                      to={`/order/${order.id}`} 
                      variant="outlined" 
                      size="small"
                      color="primary"
                    >
                      查看詳情
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </React.Fragment>
          ))}
        </List>
      )}
      
      <Box sx={{ textAlign: 'center', mt: {xs:3, sm:4} }}>
        <Button component={RouterLink} to="/" variant="contained" size="large">
          返回首頁繼續點餐
        </Button>
      </Box>
    </Container>
  );
};

export default OrderHistoryPage; 