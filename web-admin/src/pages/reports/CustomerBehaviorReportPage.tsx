/**
 * 顧客消費行為分析報表頁面
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Link,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  TextField,
  SelectChangeEvent
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ReportFilter, ReportViewer, ChartType } from '../../components/reports';
import {
  CustomerBehaviorReportService,
  CustomerBehaviorReportType,
  CustomerBehaviorReportParams
} from '../../services/reports/customerBehaviorReportService';
import { ReportFormat, ReportTimeRange } from '../../services/reports/reportService';

/**
 * 顧客消費行為分析報表頁面
 */
const CustomerBehaviorReportPage: React.FC = () => {
  // 報表服務實例
  const reportService = new CustomerBehaviorReportService();

  // 報表狀態
  const [filters, setFilters] = useState<CustomerBehaviorReportParams>({
    timeRange: ReportTimeRange.THIS_MONTH,
    reportType: CustomerBehaviorReportType.FREQUENCY
  });
  const [reportData, setReportData] = useState<any>({
    data: [],
    summary: {},
    metadata: {
      title: '',
      description: '',
      generatedAt: new Date(),
      params: {},
      totalCount: 0
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>(ChartType.BAR);
  const [chartConfig, setChartConfig] = useState<any>(null);

  // 報表類型選項
  const reportTypes = [
    { value: CustomerBehaviorReportType.FREQUENCY, label: '消費頻率' },
    { value: CustomerBehaviorReportType.AVERAGE_SPENDING, label: '平均消費金額' },
    { value: CustomerBehaviorReportType.PREFERRED_PRODUCTS, label: '偏好商品' },
    { value: CustomerBehaviorReportType.PURCHASE_TIME, label: '購買時間分析' },
    { value: CustomerBehaviorReportType.CUSTOMER_SEGMENT, label: '顧客分群' },
    { value: CustomerBehaviorReportType.RETENTION, label: '顧客留存率' }
  ];

  // 額外的過濾條件
  const additionalFilters = (
    <>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          size="small"
          label="顧客分群"
          value={filters.customerSegment || ''}
          onChange={(e) => setFilters({ ...filters, customerSegment: e.target.value || undefined })}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          size="small"
          label="商品類別"
          value={filters.productCategory || ''}
          onChange={(e) => setFilters({ ...filters, productCategory: e.target.value || undefined })}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          size="small"
          label="最小購買次數"
          type="number"
          value={filters.minPurchaseCount || ''}
          onChange={(e) => setFilters({ ...filters, minPurchaseCount: e.target.value ? parseInt(e.target.value) : undefined })}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          size="small"
          label="最小總消費金額"
          type="number"
          value={filters.minTotalSpending || ''}
          onChange={(e) => setFilters({ ...filters, minTotalSpending: e.target.value ? parseInt(e.target.value) : undefined })}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>排序欄位</InputLabel>
          <Select
            value={filters.sortBy || ''}
            label="排序欄位"
            onChange={(e: SelectChangeEvent<string>) => setFilters({ ...filters, sortBy: e.target.value || undefined })}
          >
            <MenuItem value="">無</MenuItem>
            <MenuItem value="customerName">顧客姓名</MenuItem>
            <MenuItem value="purchaseCount">購買次數</MenuItem>
            <MenuItem value="totalSpending">總消費金額</MenuItem>
            <MenuItem value="averageOrderValue">平均訂單金額</MenuItem>
            <MenuItem value="daysSinceLastPurchase">最近購買天數</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>排序方式</InputLabel>
          <Select
            value={filters.sortOrder || 'desc'}
            label="排序方式"
            onChange={(e: SelectChangeEvent<string>) => setFilters({ ...filters, sortOrder: e.target.value as 'asc' | 'desc' })}
          >
            <MenuItem value="asc">升序</MenuItem>
            <MenuItem value="desc">降序</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    </>
  );

  // 載入報表數據
  const loadReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await reportService.generateReport(filters);
      setReportData(result);
      updateChartConfig(filters.reportType, result.data);
    } catch (err: any) {
      setError(err.message || '載入報表失敗');
    } finally {
      setLoading(false);
    }
  };

  // 當過濾條件變更時重新載入報表
  useEffect(() => {
    loadReport();
  }, [filters]);

  // 更新圖表配置
  const updateChartConfig = (reportType: CustomerBehaviorReportType, data: any[]) => {
    if (!data || data.length === 0) {
      setChartType(ChartType.NONE);
      setChartConfig(null);
      return;
    }

    switch (reportType) {
      case CustomerBehaviorReportType.FREQUENCY:
        setChartType(ChartType.BAR);
        setChartConfig({
          xAxisKey: 'customerName',
          series: [
            { dataKey: 'purchaseCount', name: '購買次數' },
            { dataKey: 'purchaseFrequency', name: '月均購買頻率' }
          ]
        });
        break;
      case CustomerBehaviorReportType.AVERAGE_SPENDING:
        setChartType(ChartType.BAR);
        setChartConfig({
          xAxisKey: 'customerName',
          series: [
            { dataKey: 'totalSpending', name: '總消費金額' },
            { dataKey: 'averageOrderValue', name: '平均訂單金額' }
          ]
        });
        break;
      case CustomerBehaviorReportType.PREFERRED_PRODUCTS:
        setChartType(ChartType.PIE);
        setChartConfig({
          xAxisKey: 'productName',
          series: [
            { dataKey: 'purchaseCount', name: '購買次數' }
          ]
        });
        break;
      case CustomerBehaviorReportType.PURCHASE_TIME:
        setChartType(ChartType.BAR);
        setChartConfig({
          xAxisKey: 'preferredDayOfWeek',
          series: [
            { dataKey: 'purchaseCount', name: '購買次數' }
          ]
        });
        break;
      case CustomerBehaviorReportType.CUSTOMER_SEGMENT:
        setChartType(ChartType.PIE);
        setChartConfig({
          xAxisKey: 'segment',
          series: [
            { dataKey: 'customerCount', name: '顧客數量' }
          ]
        });
        break;
      case CustomerBehaviorReportType.RETENTION:
        setChartType(ChartType.LINE);
        setChartConfig({
          xAxisKey: 'period',
          series: [
            { dataKey: 'retentionRate', name: '留存率 (%)' }
          ]
        });
        break;
      default:
        setChartType(ChartType.NONE);
        setChartConfig(null);
    }
  };

  // 處理報表導出
  const handleExport = async (format: ReportFormat) => {
    try {
      await reportService.exportReport(reportData, format);
    } catch (err: any) {
      setError(err.message || '導出報表失敗');
    }
  };

  // 獲取報表列定義
  const getReportColumns = () => {
    const baseColumns = [
      { field: 'customerName', header: '顧客姓名', width: 150 }
    ];

    switch (filters.reportType) {
      case CustomerBehaviorReportType.FREQUENCY:
        return [
          ...baseColumns,
          { field: 'firstPurchaseDate', header: '首次購買日期', width: 120 },
          { field: 'lastPurchaseDate', header: '最近購買日期', width: 120 },
          { field: 'purchaseCount', header: '購買次數', width: 100 },
          { field: 'purchaseFrequency', header: '月均購買頻率', width: 120 },
          { field: 'daysSinceLastPurchase', header: '最近購買天數', width: 120 }
        ];
      case CustomerBehaviorReportType.AVERAGE_SPENDING:
        return [
          ...baseColumns,
          { field: 'totalSpending', header: '總消費金額', width: 120 },
          { field: 'averageOrderValue', header: '平均訂單金額', width: 120 },
          { field: 'purchaseCount', header: '購買次數', width: 100 }
        ];
      case CustomerBehaviorReportType.PREFERRED_PRODUCTS:
        return [
          { field: 'productName', header: '商品名稱', width: 200 },
          { field: 'categoryName', header: '類別', width: 150 },
          { field: 'purchaseCount', header: '購買次數', width: 100 },
          { field: 'purchaseRatio', header: '佔比 (%)', width: 100 }
        ];
      case CustomerBehaviorReportType.PURCHASE_TIME:
        return [
          { field: 'preferredDayOfWeek', header: '星期', width: 100 },
          { field: 'preferredTimeOfDay', header: '時段', width: 100 },
          { field: 'purchaseCount', header: '購買次數', width: 100 },
          { field: 'purchaseRatio', header: '佔比 (%)', width: 100 }
        ];
      case CustomerBehaviorReportType.CUSTOMER_SEGMENT:
        return [
          { field: 'segment', header: '顧客分群', width: 150 },
          { field: 'customerCount', header: '顧客數量', width: 100 },
          { field: 'averageSpending', header: '平均消費金額', width: 120 },
          { field: 'averagePurchaseFrequency', header: '平均購買頻率', width: 120 }
        ];
      case CustomerBehaviorReportType.RETENTION:
        return [
          { field: 'period', header: '時間段', width: 150 },
          { field: 'newCustomers', header: '新顧客數', width: 100 },
          { field: 'retainedCustomers', header: '留存顧客數', width: 120 },
          { field: 'retentionRate', header: '留存率 (%)', width: 100 }
        ];
      default:
        return baseColumns;
    }
  };

  return (
    <Container maxWidth="xl">
      {/* 頁面標題和麵包屑 */}
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          顧客消費行為分析報表
        </Typography>
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to="/" color="inherit">
            首頁
          </Link>
          <Link component={RouterLink} to="/reports" color="inherit">
            報表
          </Link>
          <Typography color="textPrimary">顧客消費行為分析</Typography>
        </Breadcrumbs>
      </Box>

      {/* 報表過濾器 */}
      <ReportFilter
        onFilterChange={setFilters}
        reportTypes={reportTypes}
        additionalFilters={additionalFilters}
        initialValues={filters}
      />

      {/* 報表查看器 */}
      <ReportViewer
        title={reportData.metadata.title}
        description={reportData.metadata.description}
        data={reportData.data}
        columns={getReportColumns()}
        summary={reportData.summary}
        loading={loading}
        error={error || undefined}
        chartType={chartType}
        chartConfig={chartConfig}
        onExport={handleExport}
        onRefresh={loadReport}
      />
    </Container>
  );
};

export default CustomerBehaviorReportPage;
