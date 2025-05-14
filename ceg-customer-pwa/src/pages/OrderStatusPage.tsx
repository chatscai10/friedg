import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Order, OrderItem as ICartItem } from '@/types/order.types';
import { useNotification } from '@/contexts/NotificationContext';
import { getOrderStatusText, getOrderStatusChipColor } from '@/utils/orderUtils';
import {
  Container, Paper, Typography, CircularProgress, Alert, Box, List, ListItem, ListItemText, Button, Divider, Chip, Grid
} from '@mui/material';
import { firestore } from '@/config/firebase';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';

const OrderStatusPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { isAuthenticated, currentUser } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      addNotification('請先登入以查看訂單詳情。', 'warning');
      navigate('/login', { state: { from: { pathname: `/order/${orderId}` } } });
      return;
    }
    if (!orderId) {
      addNotification('未指定訂單ID。', 'error');
      setLoading(false);
      navigate('/history');
      return;
    }

    setLoading(true);
    const orderRef = doc(firestore, 'orders', orderId);

    const unsubscribe = onSnapshot(orderRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const orderData = docSnap.data() as Omit<Order, 'id'>;
          if (orderData.customerId !== currentUser.uid) {
            addNotification('您沒有權限查看此訂單。', 'error');
            setOrder(null);
            navigate('/history');
          } else {
            setOrder({ ...orderData, id: docSnap.id });
          }
        } else {
          addNotification(`找不到訂單 (ID: ${orderId})。`, 'error');
          setOrder(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to order details:", error);
        addNotification('獲取訂單詳情時發生錯誤。', 'error');
        setOrder(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAuthenticated, currentUser, navigate, orderId, addNotification]);
  
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
      let date;
      if (timestamp instanceof Timestamp) {
        date = timestamp.toDate();
      } else if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp._seconds) {
        date = new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
      } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        date = new Date(timestamp);
      }
      return date ? date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' , hour: '2-digit', minute: '2-digit'}) : 'Invalid Date';
    } catch (e) {
      console.error("Error formatting date:", e, "Timestamp:", timestamp);
      return 'Invalid Date Format';
    }
  };

  if (loading) {
    return (
        <Container sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <Box textAlign="center">
                <CircularProgress size={60} sx={{mb: 2}}/>
                <Typography variant="h6">載入訂單詳情中...</Typography>
            </Box>
        </Container>
    );
  }

  if (!order) {
    return (
        <Container sx={{ py: 4, textAlign: 'center' }}>
            <Alert severity="warning" sx={{mb:2}}>找不到您要查詢的訂單，或載入時發生錯誤。</Alert>
            <Button component={RouterLink} to="/history" variant="outlined" color="primary">
              返回訂單歷史
            </Button>
        </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: {xs:2, sm:4} }}>
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom sx={{ mb: {xs:2, sm:4} }}>
        訂單詳情
      </Typography>
      
      <Paper elevation={2} sx={{ p: {xs:2, sm:3}, mb: 3 }}>
        <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold'}}>訂單資訊</Typography>
                <Typography variant="body1"><strong>訂單ID:</strong> {order.id}</Typography>
                <Box sx={{display: 'flex', alignItems: 'center', my: 0.5}}>
                    <Typography variant="body1" sx={{mr:0.5}}><strong>狀態:</strong></Typography>
                    <Chip 
                        label={getOrderStatusText(order.status)}
                        color={getOrderStatusChipColor(order.status)}
                        size="small" 
                    />
                </Box>
                <Typography variant="body1"><strong>下單時間:</strong> {formatDate(order.createdAt)}</Typography>
                {order.paymentMethod && <Typography variant="body1"><strong>付款方式:</strong> {order.paymentMethod === 'linepay' ? 'LINE Pay' : '現金'}</Typography>}
                {order.pickupMethod && <Typography variant="body1"><strong>取餐方式:</strong> {order.pickupMethod === 'self-pickup' ? '自取' : '外送'}</Typography>}
                {order.estimatedPickupTime && <Typography variant="body1"><strong>預計完成時間:</strong> {formatDate(order.estimatedPickupTime)}</Typography>}
            </Grid>
            <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold'}}>顧客資訊</Typography>
                <Typography variant="body1"><strong>顧客姓名:</strong> {order.customerInfo.name || '-'}</Typography>
                <Typography variant="body1"><strong>聯絡電話:</strong> {order.customerInfo.phone || '-'}</Typography>
                {order.orderNotes && <Typography variant="body1" sx={{mt:1}}><strong>訂單備註:</strong> {order.orderNotes}</Typography>}
            </Grid>
        </Grid>
        <Divider sx={{my:2}} />
        <Typography variant="body1" sx={{fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'right'}}>總金額: ${order.totalAmount.toFixed(2)}</Typography>
      </Paper>
      
      <Paper elevation={2} sx={{ p: {xs:2, sm:3} }}>
        <Typography variant="h6" component="h3" gutterBottom sx={{fontWeight: 'bold'}}>
            訂購商品 ({order.items.length})
        </Typography>
        <List disablePadding>
          {order.items.map((item: ICartItem, index: number) => (
            <React.Fragment key={`${item.id}-${index}`}>
              <ListItem sx={{ py: 1.5, px:0 }}>
                <ListItemText 
                  primary={<Typography variant="subtitle1">{item.name} (x{item.quantity})</Typography>}
                  secondary={
                    item.selectedOptions && item.selectedOptions.length > 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{pl:1}}>
                        選項: {item.selectedOptions.map(opt => `${opt.name}: ${opt.value}`).join(', ')}
                      </Typography>
                    ) : null
                  }
                />
                <Typography variant="subtitle1" sx={{fontWeight: 'medium'}}>
                    ${(item.price * item.quantity).toFixed(2)}
                </Typography>
              </ListItem>
              {index < order.items.length - 1 && <Divider component="li" variant="inset" />}
            </React.Fragment>
          ))}
        </List>
      </Paper>
      
      <Box sx={{ textAlign: 'center', mt: {xs:3, sm:4}, display: 'flex', justifyContent:'center', gap: 2, flexWrap: 'wrap' }}>
        <Button component={RouterLink} to="/history" variant="outlined" color="primary" size="large">
          返回訂單歷史
        </Button>
        <Button component={RouterLink} to="/" variant="contained" color="primary" size="large">
          繼續點餐
        </Button>
      </Box>
    </Container>
  );
};

export default OrderStatusPage; 