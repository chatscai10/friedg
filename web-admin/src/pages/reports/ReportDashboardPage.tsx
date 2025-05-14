/**
 * 報表儀表板頁面
 * 顯示各種報表的摘要和快速訪問
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Link,
  Grid,
  Card,
  CardContent,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ReportDashboard, ChartType } from '../../components/reports';
import { SalesReportService, SalesReportType } from '../../services/reports/salesReportService';
import { InventoryReportService, InventoryReportType } from '../../services/reports/inventoryReportService';
import { EmployeePerformanceReportService, EmployeePerformanceReportType } from '../../services/reports/employeePerformanceReportService';
import { CustomerBehaviorReportService, CustomerBehaviorReportType } from '../../services/reports/customerBehaviorReportService';
import { ReportTimeRange } from '../../services/reports/reportService';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import InventoryIcon from '@mui/icons-material/Inventory';
import PersonIcon from '@mui/icons-material/Person';

/**
 * 報表儀表板頁面
 */
const ReportDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  
  // 報表服務實例
  const salesReportService = new SalesReportService();
  const inventoryReportService = new InventoryReportService();
  const employeeReportService = new EmployeePerformanceReportService();
  const customerReportService = new CustomerBehaviorReportService();
  
  // 時間範圍狀態
  const [timeRange, setTimeRange] = useState<ReportTimeRange>(ReportTimeRange.THIS_MONTH);
  
  // 報表數據狀態
  const [salesData, setSalesData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [employeeData, setEmployeeData] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any[]>([]);
  
  // 載入狀態
  const [loading, setLoading] = useState<boolean>(true);
  const [salesLoading, setSalesLoading] = useState<boolean>(false);
  const [inventoryLoading, setInventoryLoading] = useState<boolean>(false);
  const [employeeLoading, setEmployeeLoading] = useState<boolean>(false);
  const [customerLoading, setCustomerLoading] = useState<boolean>(false);
  
  // 錯誤狀態
  const [salesError, setSalesError] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // 載入所有報表數據
  useEffect(() => {
    loadAllReports();
  }, [timeRange]);

  // 載入所有報表
  const loadAllReports = async () => {
    setLoading(true);
    
    await Promise.all([
      loadSalesReport(),
      loadInventoryReport(),
      loadEmployeeReport(),
      loadCustomerReport()
    ]);
    
    setLoading(false);
  };

  // 載入銷售報表
  const loadSalesReport = async () => {
    setSalesLoading(true);
    setSalesError(null);
    
    try {
      const result = await salesReportService.generateReport({
        timeRange,
        reportType: SalesReportType.DAILY
      });
      
      setSalesData(result.data);
    } catch (err: any) {
      setSalesError(err.message || '載入銷售報表失敗');
      setSalesData([]);
    } finally {
      setSalesLoading(false);
    }
  };

  // 載入庫存報表
  const loadInventoryReport = async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    
    try {
      const result = await inventoryReportService.generateReport({
        timeRange,
        reportType: InventoryReportType.LOW_STOCK
      });
      
      setInventoryData(result.data);
    } catch (err: any) {
      setInventoryError(err.message || '載入庫存報表失敗');
      setInventoryData([]);
    } finally {
      setInventoryLoading(false);
    }
  };

  // 載入員工績效報表
  const loadEmployeeReport = async () => {
    setEmployeeLoading(true);
    setEmployeeError(null);
    
    try {
      const result = await employeeReportService.generateReport({
        timeRange,
        reportType: EmployeePerformanceReportType.COMPREHENSIVE
      });
      
      setEmployeeData(result.data);
    } catch (err: any) {
      setEmployeeError(err.message || '載入員工績效報表失敗');
      setEmployeeData([]);
    } finally {
      setEmployeeLoading(false);
    }
  };

  // 載入顧客行為報表
  const loadCustomerReport = async () => {
    setCustomerLoading(true);
    setCustomerError(null);
    
    try {
      const result = await customerReportService.generateReport({
        timeRange,
        reportType: CustomerBehaviorReportType.FREQUENCY
      });
      
      setCustomerData(result.data);
    } catch (err: any) {
      setCustomerError(err.message || '載入顧客行為報表失敗');
      setCustomerData([]);
    } finally {
      setCustomerLoading(false);
    }
  };

  // 處理時間範圍變更
  const handleTimeRangeChange = (event: SelectChangeEvent<string>) => {
    setTimeRange(event.target.value as ReportTimeRange);
  };

  // 報表卡片配置
  const reportCards = [
    {
      title: '銷售報表',
      description: '顯示銷售趨勢和業績數據',
      data: salesData,
      loading: salesLoading,
      error: salesError,
      chartType: ChartType.BAR,
      chartConfig: {
        xAxisKey: 'date',
        series: [
          { dataKey: 'totalSales', name: '銷售額' }
        ]
      },
      summary: {
        '總銷售額': salesData.reduce((sum, item) => sum + (item.totalSales || 0), 0).toFixed(2),
        '訂單數': salesData.reduce((sum, item) => sum + (item.totalOrders || 0), 0)
      },
      onRefresh: loadSalesReport,
      onExpand: () => navigate('/reports/sales')
    },
    {
      title: '庫存報表',
      description: '顯示庫存狀態和低庫存警報',
      data: inventoryData,
      loading: inventoryLoading,
      error: inventoryError,
      chartType: ChartType.BAR,
      chartConfig: {
        xAxisKey: 'itemName',
        series: [
          { dataKey: 'currentStock', name: '當前庫存' },
          { dataKey: 'reorderPoint', name: '再訂購點' }
        ]
      },
      summary: {
        '低庫存品項': inventoryData.length,
        '總庫存成本': inventoryData.reduce((sum, item) => sum + (item.totalCost || 0), 0).toFixed(2)
      },
      onRefresh: loadInventoryReport,
      onExpand: () => navigate('/reports/inventory')
    },
    {
      title: '員工績效報表',
      description: '顯示員工績效和出勤數據',
      data: employeeData,
      loading: employeeLoading,
      error: employeeError,
      chartType: ChartType.BAR,
      chartConfig: {
        xAxisKey: 'employeeName',
        series: [
          { dataKey: 'performanceScore', name: '績效分數' }
        ]
      },
      summary: {
        '員工數': employeeData.length,
        '平均績效分數': (employeeData.reduce((sum, item) => sum + (item.performanceScore || 0), 0) / (employeeData.length || 1)).toFixed(2)
      },
      onRefresh: loadEmployeeReport,
      onExpand: () => navigate('/reports/employee-performance')
    },
    {
      title: '顧客行為報表',
      description: '顯示顧客消費行為和偏好',
      data: customerData,
      loading: customerLoading,
      error: customerError,
      chartType: ChartType.BAR,
      chartConfig: {
        xAxisKey: 'customerName',
        series: [
          { dataKey: 'purchaseCount', name: '購買次數' }
        ]
      },
      summary: {
        '顧客數': customerData.length,
        '平均購買次數': (customerData.reduce((sum, item) => sum + (item.purchaseCount || 0), 0) / (customerData.length || 1)).toFixed(2)
      },
      onRefresh: loadCustomerReport,
      onExpand: () => navigate('/reports/customer-behavior')
    }
  ];

  // 報表類型卡片
  const reportTypeCards = [
    {
      title: '銷售報表',
      icon: <ShoppingCartIcon fontSize="large" />,
      description: '分析銷售趨勢、產品表現和收入數據',
      path: '/reports/sales'
    },
    {
      title: '庫存報表',
      icon: <InventoryIcon fontSize="large" />,
      description: '監控庫存水平、使用情況和成本分析',
      path: '/reports/inventory'
    },
    {
      title: '員工績效報表',
      icon: <PersonIcon fontSize="large" />,
      description: '評估員工出勤率、銷售業績和顧客評價',
      path: '/reports/employee-performance'
    },
    {
      title: '顧客行為報表',
      icon: <PeopleIcon fontSize="large" />,
      description: '分析顧客消費頻率、偏好商品和購買模式',
      path: '/reports/customer-behavior'
    }
  ];

  return (
    <Container maxWidth="xl">
      {/* 頁面標題和麵包屑 */}
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          報表儀表板
        </Typography>
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to="/" color="inherit">
            首頁
          </Link>
          <Typography color="textPrimary">報表</Typography>
        </Breadcrumbs>
      </Box>

      {/* 時間範圍選擇器 */}
      <Box mb={3}>
        <FormControl variant="outlined" size="small" sx={{ minWidth: 200 }}>
          <InputLabel>時間範圍</InputLabel>
          <Select
            value={timeRange}
            onChange={handleTimeRangeChange}
            label="時間範圍"
          >
            <MenuItem value={ReportTimeRange.TODAY}>今天</MenuItem>
            <MenuItem value={ReportTimeRange.YESTERDAY}>昨天</MenuItem>
            <MenuItem value={ReportTimeRange.THIS_WEEK}>本週</MenuItem>
            <MenuItem value={ReportTimeRange.LAST_WEEK}>上週</MenuItem>
            <MenuItem value={ReportTimeRange.THIS_MONTH}>本月</MenuItem>
            <MenuItem value={ReportTimeRange.LAST_MONTH}>上月</MenuItem>
            <MenuItem value={ReportTimeRange.THIS_QUARTER}>本季度</MenuItem>
            <MenuItem value={ReportTimeRange.LAST_QUARTER}>上季度</MenuItem>
            <MenuItem value={ReportTimeRange.THIS_YEAR}>本年</MenuItem>
            <MenuItem value={ReportTimeRange.LAST_YEAR}>去年</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* 報表儀表板 */}
      <ReportDashboard
        title="業務概覽"
        description="主要業務指標摘要"
        reports={reportCards}
        loading={loading}
      />

      {/* 報表類型導航卡片 */}
      <Box mt={6} mb={3}>
        <Typography variant="h5" component="h2" gutterBottom>
          報表類型
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Grid container spacing={3}>
          {reportTypeCards.map((card, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box display="flex" justifyContent="center" mb={2}>
                    {card.icon}
                  </Box>
                  <Typography variant="h6" component="h3" align="center" gutterBottom>
                    {card.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2, flexGrow: 1 }}>
                    {card.description}
                  </Typography>
                  <Button
                    variant="outlined"
                    fullWidth
                    component={RouterLink}
                    to={card.path}
                    endIcon={<BarChartIcon />}
                  >
                    查看報表
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
};

export default ReportDashboardPage;
