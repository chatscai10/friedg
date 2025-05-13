import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  CardHeader,
  Alert,
  Divider 
} from '@mui/material';
import { 
  PeopleOutline, 
  StorefrontOutlined, 
  ShoppingCartOutlined,
  AssignmentOutlined
} from '@mui/icons-material';

/**
 * 儀表板頁面組件
 * 顯示系統概覽信息
 */
const DashboardPage: React.FC = () => {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        儀表板
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        儀表板功能開發中 - 將提供系統關鍵數據的即時概覽。以下為示範數據。
      </Alert>

      {/* 統計卡片區域 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#f5f8ff' }}>
            <PeopleOutline fontSize="large" color="primary" />
            <Typography variant="h5" component="div" sx={{ mt: 1 }}>
              12
            </Typography>
            <Typography variant="body2" color="text.secondary">
              活躍員工
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#f5f8ff' }}>
            <StorefrontOutlined fontSize="large" color="primary" />
            <Typography variant="h5" component="div" sx={{ mt: 1 }}>
              3
            </Typography>
            <Typography variant="body2" color="text.secondary">
              營業分店
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#f5f8ff' }}>
            <ShoppingCartOutlined fontSize="large" color="primary" />
            <Typography variant="h5" component="div" sx={{ mt: 1 }}>
              38
            </Typography>
            <Typography variant="body2" color="text.secondary">
              今日訂單
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper elevation={2} sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: '#f5f8ff' }}>
            <AssignmentOutlined fontSize="large" color="primary" />
            <Typography variant="h5" component="div" sx={{ mt: 1 }}>
              2
            </Typography>
            <Typography variant="body2" color="text.secondary">
              待審請假
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* 主要內容卡片 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardHeader title="訂單概況" />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                訂單數據加載中，此區域將展示最近訂單統計和趨勢圖表。
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardHeader title="人力資源" />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                人力資源數據加載中，此區域將展示員工考勤和排班資訊。
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardHeader title="庫存狀態" />
            <Divider />
            <CardContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                庫存模組尚未啟用，此區域將展示庫存水位和需要補貨的品項。
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardHeader title="系統公告" />
            <Divider />
            <CardContent>
              <Typography variant="body2" paragraph>
                歡迎使用「吃雞排找不早」管理系統！
              </Typography>
              <Typography variant="body2" color="text.secondary">
                系統目前處於開發階段，部分功能可能尚未完全實現。如遇到問題，請聯繫系統管理員。
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage; 