import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, Divider, Skeleton } from '@mui/material';
import OrderList from '../components/OrderManagement/OrderList';
import { getOrderStatistics } from '../services/orderService';

// 訂單頁面
const OrdersPage: React.FC = () => {
  const [statistics, setStatistics] = useState<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  }>({
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0
  });
  
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const loadStatistics = async () => {
      try {
        setLoading(true);
        const stats = await getOrderStatistics() as any;
        setStatistics(stats);
      } catch (error) {
        console.error('載入訂單統計失敗:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadStatistics();
  }, []);
  
  return (
    <Box sx={{ p: 3 }}>
      {/* 訂單統計面板 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper
            elevation={2}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
              bgcolor: '#f5f5f5',
              borderLeft: '4px solid #2196f3'
            }}
          >
            <Typography variant="h6" color="textSecondary" gutterBottom>
              訂單總數
            </Typography>
            <Typography component="p" variant="h4">
              {loading ? <Skeleton width="60%" /> : statistics.totalOrders}
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="textSecondary">
                已完成
              </Typography>
              <Typography variant="body2">
                {loading ? <Skeleton width={30} /> : statistics.completedOrders}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="textSecondary">
                處理中
              </Typography>
              <Typography variant="body2">
                {loading ? <Skeleton width={30} /> : statistics.pendingOrders}
              </Typography>
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper
            elevation={2}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
              bgcolor: '#f5f5f5',
              borderLeft: '4px solid #4caf50'
            }}
          >
            <Typography variant="h6" color="textSecondary" gutterBottom>
              總營收
            </Typography>
            <Typography component="p" variant="h4">
              {loading ? (
                <Skeleton width="60%" /> 
              ) : (
                `NT$ ${statistics.totalRevenue.toLocaleString()}`
              )}
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Paper
            elevation={2}
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              height: 140,
              bgcolor: '#f5f5f5',
              borderLeft: '4px solid #ff9800'
            }}
          >
            <Typography variant="h6" color="textSecondary" gutterBottom>
              平均訂單金額
            </Typography>
            <Typography component="p" variant="h4">
              {loading ? (
                <Skeleton width="60%" /> 
              ) : (
                `NT$ ${statistics.averageOrderValue.toLocaleString(undefined, { 
                  minimumFractionDigits: 0, 
                  maximumFractionDigits: 0 
                })}`
              )}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      
      {/* 訂單列表 */}
      <OrderList />
    </Box>
  );
};

export default OrdersPage; 