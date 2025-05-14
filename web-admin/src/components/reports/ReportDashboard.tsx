/**
 * 報表儀表板組件
 * 顯示多個報表卡片的儀表板
 */

import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Divider,
  Paper,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
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
import { ChartType } from './ReportViewer';

// 報表卡片屬性
export interface ReportCardProps {
  title: string;
  description?: string;
  data: any[];
  loading?: boolean;
  error?: string;
  chartType: ChartType;
  chartConfig: {
    xAxisKey: string;
    series: {
      dataKey: string;
      name: string;
      color?: string;
    }[];
  };
  summary?: Record<string, any>;
  onRefresh?: () => void;
  onExpand?: () => void;
}

// 報表儀表板屬性
export interface ReportDashboardProps {
  title: string;
  description?: string;
  reports: ReportCardProps[];
  loading?: boolean;
}

// 圖表顏色
const CHART_COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

/**
 * 報表卡片組件
 */
const ReportCard: React.FC<ReportCardProps> = ({
  title,
  description,
  data,
  loading = false,
  error,
  chartType,
  chartConfig,
  summary,
  onRefresh,
  onExpand
}) => {
  // 渲染圖表
  const renderChart = () => {
    if (!chartConfig || !data || data.length === 0 || chartType === ChartType.NONE) {
      return null;
    }

    const { xAxisKey, series } = chartConfig;

    switch (chartType) {
      case ChartType.BAR:
        return (
          <ResponsiveContainer width="100%" height={200}>
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
          <ResponsiveContainer width="100%" height={200}>
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
          <ResponsiveContainer width="100%" height={200}>
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
                  outerRadius={60 - seriesIndex * 10}
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

  // 渲染摘要
  const renderSummary = () => {
    if (!summary || Object.keys(summary).length === 0) {
      return null;
    }

    return (
      <Box mt={2}>
        <Grid container spacing={1}>
          {Object.entries(summary).slice(0, 4).map(([key, value], index) => (
            <Grid item xs={6} key={index}>
              <Paper
                elevation={0}
                sx={{
                  p: 1,
                  textAlign: 'center',
                  borderRadius: 1,
                  border: '1px solid #e0e0e0',
                  height: '100%'
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block">
                  {key}
                </Typography>
                <Typography variant="body2" component="div" sx={{ fontWeight: 'bold' }}>
                  {value}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 報表標題和操作按鈕 */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box>
            <Typography variant="subtitle1" component="h3">
              {title}
            </Typography>
            {description && (
              <Typography variant="caption" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
          <Box>
            {onRefresh && (
              <Tooltip title="重新整理">
                <IconButton size="small" onClick={onRefresh} disabled={loading}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {onExpand && (
              <Tooltip title="全螢幕檢視">
                <IconButton size="small" onClick={onExpand} disabled={loading}>
                  <FullscreenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 1 }} />

        {/* 載入中或錯誤訊息 */}
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4} flexGrow={1}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Box display="flex" justifyContent="center" alignItems="center" py={2} flexGrow={1}>
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          </Box>
        )}

        {/* 報表內容 */}
        {!loading && !error && data.length > 0 && (
          <Box flexGrow={1} display="flex" flexDirection="column">
            {/* 圖表 */}
            <Box flexGrow={1} display="flex" alignItems="center">
              {renderChart()}
            </Box>

            {/* 摘要 */}
            {renderSummary()}
          </Box>
        )}

        {/* 無數據提示 */}
        {!loading && !error && data.length === 0 && (
          <Box display="flex" justifyContent="center" alignItems="center" py={4} flexGrow={1}>
            <Typography variant="body2" color="text.secondary">
              沒有數據
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * 報表儀表板組件
 */
const ReportDashboard: React.FC<ReportDashboardProps> = ({
  title,
  description,
  reports,
  loading = false
}) => {
  return (
    <Box>
      {/* 儀表板標題 */}
      <Box mb={3}>
        <Typography variant="h5" component="h1" gutterBottom>
          {title}
        </Typography>
        {description && (
          <Typography variant="body1" color="text.secondary">
            {description}
          </Typography>
        )}
      </Box>

      {/* 載入中提示 */}
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {/* 報表卡片網格 */}
      {!loading && (
        <Grid container spacing={3}>
          {reports.map((report, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <ReportCard {...report} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ReportDashboard;
