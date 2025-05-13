import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Divider, Grid, Card, CardContent, CardActions } from '@mui/material';
import LinePayButton from './LinePayButton';

interface CheckoutPageProps {
  orderId?: string; // 可以從路由參數獲取
}

/**
 * 結帳頁面示例
 * 
 * 展示如何在結帳流程中使用 LINE Pay 按鈕
 */
const CheckoutPage: React.FC<CheckoutPageProps> = ({ orderId: propOrderId }) => {
  // 如果沒有提供 orderId 屬性，則嘗試從 URL 獲取
  const [orderId, setOrderId] = useState<string>(propOrderId || '');
  const orderSummary = {
    items: [
      { id: 1, name: '招牌雞排', quantity: 1, price: 85 },
      { id: 2, name: '甜不辣', quantity: 2, price: 30 }
    ],
    subtotal: 145,
    tax: 0,
    total: 145
  };
  
  useEffect(() => {
    // 如果沒有從 props 獲取到 orderId，嘗試從 URL 獲取
    if (!propOrderId) {
      const params = new URLSearchParams(window.location.search);
      const urlOrderId = params.get('orderId');
      if (urlOrderId) {
        setOrderId(urlOrderId);
      }
    }
    
    // 在實際應用中，這裡應該使用 orderService 獲取訂單詳情
    // const fetchOrderDetails = async () => {
    //   const orderDetails = await orderService.getOrderById(orderId);
    //   setOrderSummary(orderDetails);
    // };
    // 
    // if (orderId) {
    //   fetchOrderDetails();
    // }
  }, [propOrderId]);
  
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Typography variant="h4" gutterBottom align="center">
        訂單結帳
      </Typography>
      
      <Grid container spacing={3}>
        {/* 訂單摘要 */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              訂單摘要
            </Typography>
            <Box sx={{ my: 2 }}>
              {orderSummary.items.map((item) => (
                <Box key={item.id} display="flex" justifyContent="space-between" mb={1}>
                  <Typography>
                    {item.name} x {item.quantity}
                  </Typography>
                  <Typography>
                    NT$ {item.price * item.quantity}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Divider />
            <Box display="flex" justifyContent="space-between" mt={2}>
              <Typography variant="subtitle1">小計</Typography>
              <Typography variant="subtitle1">NT$ {orderSummary.subtotal}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="subtitle1">稅金</Typography>
              <Typography variant="subtitle1">NT$ {orderSummary.tax}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="h6">總計</Typography>
              <Typography variant="h6">NT$ {orderSummary.total}</Typography>
            </Box>
          </Paper>
        </Grid>
        
        {/* 支付選項 */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                選擇支付方式
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                請選擇以下支付方式之一完成訂單。
              </Typography>
            </CardContent>
            <CardActions sx={{ flexDirection: 'column', alignItems: 'stretch', px: 2, pb: 2 }}>
              <LinePayButton
                orderId={orderId}
                fullWidth
                buttonText="LINE Pay 付款"
                variant="contained"
              />
              {/* 可以添加其他支付方式按鈕 */}
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CheckoutPage; 