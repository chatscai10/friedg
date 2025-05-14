/**
 * 員工績效分析報表頁面
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
  Switch,
  FormControlLabel,
  SelectChangeEvent
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ReportFilter, ReportViewer, ChartType } from '../../components/reports';
import {
  EmployeePerformanceReportService,
  EmployeePerformanceReportType,
  EmployeePerformanceReportParams
} from '../../services/reports/employeePerformanceReportService';
import { ReportFormat, ReportTimeRange } from '../../services/reports/reportService';

/**
 * 員工績效分析報表頁面
 */
const EmployeePerformanceReportPage: React.FC = () => {
  // 報表服務實例
  const reportService = new EmployeePerformanceReportService();

  // 報表狀態
  const [filters, setFilters] = useState<EmployeePerformanceReportParams>({
    timeRange: ReportTimeRange.THIS_MONTH,
    reportType: EmployeePerformanceReportType.COMPREHENSIVE
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
    { value: EmployeePerformanceReportType.COMPREHENSIVE, label: '綜合績效' },
    { value: EmployeePerformanceReportType.ATTENDANCE, label: '出勤率' },
    { value: EmployeePerformanceReportType.SALES_PERFORMANCE, label: '銷售業績' },
    { value: EmployeePerformanceReportType.CUSTOMER_RATING, label: '顧客評價' }
  ];

  // 額外的過濾條件
  const additionalFilters = (
    <>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          size="small"
          label="員工ID"
          value={filters.employeeId || ''}
          onChange={(e) => setFilters({ ...filters, employeeId: e.target.value || undefined })}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <TextField
          fullWidth
          size="small"
          label="部門ID"
          value={filters.departmentId || ''}
          onChange={(e) => setFilters({ ...filters, departmentId: e.target.value || undefined })}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <FormControlLabel
          control={
            <Switch
              checked={filters.includeInactive || false}
              onChange={(e) => setFilters({ ...filters, includeInactive: e.target.checked })}
            />
          }
          label="包含非活躍員工"
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
            <MenuItem value="employeeName">員工姓名</MenuItem>
            <MenuItem value="attendanceRate">出勤率</MenuItem>
            <MenuItem value="totalSales">銷售額</MenuItem>
            <MenuItem value="averageRating">評價分數</MenuItem>
            <MenuItem value="performanceScore">績效分數</MenuItem>
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
  const updateChartConfig = (reportType: EmployeePerformanceReportType, data: any[]) => {
    if (!data || data.length === 0) {
      setChartType(ChartType.NONE);
      setChartConfig(null);
      return;
    }

    switch (reportType) {
      case EmployeePerformanceReportType.ATTENDANCE:
        setChartType(ChartType.BAR);
        setChartConfig({
          xAxisKey: 'employeeName',
          series: [
            { dataKey: 'attendanceRate', name: '出勤率 (%)' },
            { dataKey: 'lateCount', name: '遲到次數' },
            { dataKey: 'absenceCount', name: '缺勤次數' }
          ]
        });
        break;
      case EmployeePerformanceReportType.SALES_PERFORMANCE:
        setChartType(ChartType.BAR);
        setChartConfig({
          xAxisKey: 'employeeName',
          series: [
            { dataKey: 'totalSales', name: '銷售額' },
            { dataKey: 'orderCount', name: '訂單數' },
            { dataKey: 'averageOrderValue', name: '平均訂單金額' }
          ]
        });
        break;
      case EmployeePerformanceReportType.CUSTOMER_RATING:
        setChartType(ChartType.BAR);
        setChartConfig({
          xAxisKey: 'employeeName',
          series: [
            { dataKey: 'averageRating', name: '平均評分' },
            { dataKey: 'ratingCount', name: '評價數量' }
          ]
        });
        break;
      case EmployeePerformanceReportType.COMPREHENSIVE:
        setChartType(ChartType.BAR);
        setChartConfig({
          xAxisKey: 'employeeName',
          series: [
            { dataKey: 'performanceScore', name: '績效分數' },
            { dataKey: 'kpiAchievement', name: 'KPI達成率 (%)' }
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
      { field: 'employeeName', header: '員工姓名', width: 150 },
      { field: 'department', header: '部門', width: 120 },
      { field: 'position', header: '職位', width: 120 }
    ];

    switch (filters.reportType) {
      case EmployeePerformanceReportType.ATTENDANCE:
        return [
          ...baseColumns,
          { field: 'scheduledHours', header: '排班時數', width: 100 },
          { field: 'actualHours', header: '實際時數', width: 100 },
          { field: 'attendanceRate', header: '出勤率 (%)', width: 100 },
          { field: 'lateCount', header: '遲到次數', width: 100 },
          { field: 'absenceCount', header: '缺勤次數', width: 100 }
        ];
      case EmployeePerformanceReportType.SALES_PERFORMANCE:
        return [
          ...baseColumns,
          { field: 'orderCount', header: '訂單數', width: 100 },
          { field: 'totalSales', header: '銷售額', width: 120 },
          { field: 'averageOrderValue', header: '平均訂單金額', width: 120 }
        ];
      case EmployeePerformanceReportType.CUSTOMER_RATING:
        return [
          ...baseColumns,
          { field: 'averageRating', header: '平均評分', width: 100 },
          { field: 'ratingCount', header: '評價數量', width: 100 }
        ];
      case EmployeePerformanceReportType.COMPREHENSIVE:
        return [
          ...baseColumns,
          { field: 'attendanceRate', header: '出勤率 (%)', width: 100 },
          { field: 'totalSales', header: '銷售額', width: 120 },
          { field: 'averageRating', header: '平均評分', width: 100 },
          { field: 'performanceScore', header: '績效分數', width: 100 },
          { field: 'kpiAchievement', header: 'KPI達成率 (%)', width: 120 }
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
          員工績效分析報表
        </Typography>
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to="/" color="inherit">
            首頁
          </Link>
          <Link component={RouterLink} to="/reports" color="inherit">
            報表
          </Link>
          <Typography color="textPrimary">員工績效分析</Typography>
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

export default EmployeePerformanceReportPage;
