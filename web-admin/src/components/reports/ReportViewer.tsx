/**
 * 報表查看器組件
 * 顯示報表數據和圖表
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ReportFormat } from '../../services/reports/reportService';

// 圖表類型
export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  NONE = 'none'
}

// 報表查看器屬性
export interface ReportViewerProps {
  title: string;
  description?: string;
  data: any[];
  columns: { field: string; header: string; width?: number }[];
  summary: Record<string, any>;
  loading?: boolean;
  error?: string;
  chartType?: ChartType;
  chartConfig?: {
    xAxisKey: string;
    series: {
      dataKey: string;
      name: string;
      color?: string;
    }[];
  };
  onExport?: (format: ReportFormat) => void;
  onRefresh?: () => void;
}

// 圖表顏色
const CHART_COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

/**
 * 報表查看器組件
 */
const ReportViewer: React.FC<ReportViewerProps> = ({
  title,
  description,
  data,
  columns,
  summary,
  loading = false,
  error,
  chartType = ChartType.BAR,
  chartConfig,
  onExport,
  onRefresh
}) => {
  // 分頁狀態
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 處理頁碼變更
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // 處理每頁行數變更
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 渲染圖表
  const renderChart = () => {
    if (!chartConfig || !data || data.length === 0 || chartType === ChartType.NONE) {
      return null;
    }

    const { xAxisKey, series } = chartConfig;

    switch (chartType) {
      case ChartType.BAR:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              {series.map((s, index) => (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color || CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case ChartType.LINE:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              {series.map((s, index) => (
                <Line
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={s.color || CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      case ChartType.PIE:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <RechartsTooltip />
              <Legend />
              {series.map((s, seriesIndex) => (
                <Pie
                  key={s.dataKey}
                  data={data}
                  dataKey={s.dataKey}
                  nameKey={xAxisKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={80 - seriesIndex * 10}
                  label
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
              ))}
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  // 渲染摘要卡片
  const renderSummaryCards = () => {
    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.entries(summary).map(([key, value], index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                textAlign: 'center',
                borderRadius: 2,
                border: '1px solid #e0e0e0',
                height: '100%'
              }}
            >
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {key}
              </Typography>
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                {value}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Card variant="outlined">
      <CardContent>
        {/* 報表標題和操作按鈕 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box>
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
          <Box>
            {onRefresh && (
              <Tooltip title="重新整理">
                <IconButton onClick={onRefresh} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
            {onExport && (
              <>
                <Tooltip title="匯出 Excel">
                  <IconButton onClick={() => onExport(ReportFormat.EXCEL)} disabled={loading || !data.length}>
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="匯出 PDF">
                  <IconButton onClick={() => onExport(ReportFormat.PDF)} disabled={loading || !data.length}>
                    <PrintIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 載入中或錯誤訊息 */}
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 報表內容 */}
        {!loading && !error && data.length > 0 && (
          <>
            {/* 摘要卡片 */}
            {Object.keys(summary).length > 0 && renderSummaryCards()}

            {/* 圖表 */}
            {chartType !== ChartType.NONE && chartConfig && (
              <Box mb={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}
                >
                  {renderChart()}
                </Paper>
              </Box>
            )}

            {/* 數據表格 */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {columns.map((column) => (
                      <TableCell key={column.field} style={{ width: column.width }}>
                        {column.header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {columns.map((column) => (
                          <TableCell key={`${rowIndex}-${column.field}`}>
                            {row[column.field]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={data.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="每頁行數:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
              />
            </TableContainer>
          </>
        )}

        {/* 無數據提示 */}
        {!loading && !error && data.length === 0 && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <Typography variant="body1" color="text.secondary">
              沒有符合條件的數據
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportViewer;
