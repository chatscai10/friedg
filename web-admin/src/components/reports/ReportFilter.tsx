/**
 * 報表過濾器組件
 * 提供通用的報表過濾功能
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Typography,
  Divider,
  SelectChangeEvent,
  IconButton,
  Collapse
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhTW } from 'date-fns/locale';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { ReportTimeRange } from '../../services/reports/reportService';

// 報表過濾器屬性
export interface ReportFilterProps {
  onFilterChange: (filters: any) => void;
  reportTypes: { value: string; label: string }[];
  additionalFilters?: React.ReactNode;
  initialValues?: any;
}

/**
 * 報表過濾器組件
 */
const ReportFilter: React.FC<ReportFilterProps> = ({
  onFilterChange,
  reportTypes,
  additionalFilters,
  initialValues = {}
}) => {
  // 過濾器狀態
  const [expanded, setExpanded] = useState(true);
  const [timeRange, setTimeRange] = useState<ReportTimeRange>(
    initialValues.timeRange || ReportTimeRange.THIS_MONTH
  );
  const [reportType, setReportType] = useState<string>(
    initialValues.reportType || (reportTypes.length > 0 ? reportTypes[0].value : '')
  );
  const [startDate, setStartDate] = useState<Date | null>(
    initialValues.startDate || null
  );
  const [endDate, setEndDate] = useState<Date | null>(
    initialValues.endDate || null
  );
  const [storeId, setStoreId] = useState<string>(
    initialValues.storeId || ''
  );

  // 當過濾條件變更時觸發回調
  useEffect(() => {
    const filters = {
      timeRange,
      reportType,
      startDate,
      endDate,
      storeId: storeId || undefined
    };
    onFilterChange(filters);
  }, [timeRange, reportType, startDate, endDate, storeId]);

  // 處理時間範圍變更
  const handleTimeRangeChange = (event: SelectChangeEvent<string>) => {
    setTimeRange(event.target.value as ReportTimeRange);
    
    // 如果不是自定義範圍，清空開始和結束日期
    if (event.target.value !== ReportTimeRange.CUSTOM) {
      setStartDate(null);
      setEndDate(null);
    }
  };

  // 處理報表類型變更
  const handleReportTypeChange = (event: SelectChangeEvent<string>) => {
    setReportType(event.target.value);
  };

  // 切換展開/收起狀態
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box display="flex" alignItems="center">
            <FilterListIcon sx={{ mr: 1 }} />
            <Typography variant="h6">報表過濾器</Typography>
          </Box>
          <IconButton onClick={toggleExpanded} size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        <Collapse in={expanded}>
          <Grid container spacing={2}>
            {/* 報表類型 */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>報表類型</InputLabel>
                <Select
                  value={reportType}
                  label="報表類型"
                  onChange={handleReportTypeChange}
                >
                  {reportTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {/* 時間範圍 */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>時間範圍</InputLabel>
                <Select
                  value={timeRange}
                  label="時間範圍"
                  onChange={handleTimeRangeChange}
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
                  <MenuItem value={ReportTimeRange.CUSTOM}>自定義</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* 自定義日期範圍 */}
            {timeRange === ReportTimeRange.CUSTOM && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                    <DatePicker
                      label="開始日期"
                      value={startDate}
                      onChange={(newValue) => setStartDate(newValue)}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                    <DatePicker
                      label="結束日期"
                      value={endDate}
                      onChange={(newValue) => setEndDate(newValue)}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
              </>
            )}
            
            {/* 店鋪選擇 */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="店鋪ID"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              />
            </Grid>
            
            {/* 額外的過濾條件 */}
            {additionalFilters}
          </Grid>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default ReportFilter;
