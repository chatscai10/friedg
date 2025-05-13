import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  TextField,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Grid,
  Card,
  CardContent,
  SelectChangeEvent,
  Button
} from '@mui/material';
import { 
  FilterList,
  Search,
  Refresh,
  CheckCircle,
  Cancel,
  LocationOn,
  Person,
  Business,
  InfoOutlined
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { 
  getAttendanceLogs, 
  AttendanceLog, 
  GetAttendanceLogsParams,
  getMockEmployees,
  getMockStores
} from '../../services/attendanceService';
import { Coordinates } from '../../../src/types/core-params';

// 考勤列表組件
const AttendanceList: React.FC = () => {
  // 狀態管理
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState<GetAttendanceLogsParams>({
    page: 1,
    limit: 10,
    sort: 'timestamp',
    order: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // 模擬數據
  const employees = getMockEmployees();
  const stores = getMockStores();
  
  // 獲取考勤記錄數據
  const fetchAttendanceLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await getAttendanceLogs({
        ...filters,
        page: page + 1,
        limit: rowsPerPage
      });
      
      setLogs(response.data);
      setTotalItems(response.pagination.totalItems);
    } catch (err) {
      console.error('獲取考勤記錄失敗:', err);
      setError('獲取考勤記錄失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加載和依賴項更改時獲取數據
  useEffect(() => {
    fetchAttendanceLogs();
  }, [page, rowsPerPage, filters]);
  
  // 處理頁碼變更
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  // 處理每頁記錄數變更
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // 處理篩選值變更
  const handleFilterChange = (field: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0); // 重置頁碼
  };
  
  // 清除篩選條件
  const handleClearFilters = () => {
    setFilters({
      page: 1,
      limit: rowsPerPage,
      sort: 'timestamp',
      order: 'desc'
    });
    setPage(0);
  };
  
  // 處理刷新
  const handleRefresh = () => {
    fetchAttendanceLogs();
  };
  
  // 格式化時間
  const formatDateTime = (date: Date) => {
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };
  
  // 格式化地理坐標
  const formatCoordinates = (coords: Coordinates | {latitude: number, longitude: number}) => {
    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
  };
  
  // 獲取來源顯示文本
  const getSourceDisplay = (source: string) => {
    switch (source) {
      case 'mobile-app':
        return '手機應用';
      case 'web-admin-manual':
        return '後台手動';
      case 'kiosk':
        return '自助設備';
      default:
        return source;
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          考勤記錄
        </Typography>
        <Box>
          <Tooltip title="重新整理">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="篩選">
            <IconButton onClick={() => setShowFilters(!showFilters)}>
              <FilterList />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {showFilters && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker 
                  label="開始日期"
                  value={filters.startDate ? new Date(filters.startDate) : null}
                  onChange={(date) => handleFilterChange('startDate', date ? date.toISOString().split('T')[0] : undefined)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker 
                  label="結束日期"
                  value={filters.endDate ? new Date(filters.endDate) : null}
                  onChange={(date) => handleFilterChange('endDate', date ? date.toISOString().split('T')[0] : undefined)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>員工</InputLabel>
                  <Select
                    value={filters.employeeId || ''}
                    label="員工"
                    onChange={(e) => handleFilterChange('employeeId', e.target.value || undefined)}
                  >
                    <MenuItem value="">全部員工</MenuItem>
                    {employees.map((employee) => (
                      <MenuItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>分店</InputLabel>
                  <Select
                    value={filters.storeId || ''}
                    label="分店"
                    onChange={(e) => handleFilterChange('storeId', e.target.value || undefined)}
                  >
                    <MenuItem value="">全部分店</MenuItem>
                    {stores.map((store) => (
                      <MenuItem key={store.id} value={store.id}>
                        {store.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>打卡類型</InputLabel>
                  <Select
                    value={filters.type || ''}
                    label="打卡類型"
                    onChange={(e: SelectChangeEvent) => handleFilterChange('type', e.target.value || undefined)}
                  >
                    <MenuItem value="">全部類型</MenuItem>
                    <MenuItem value="punch-in">上班卡</MenuItem>
                    <MenuItem value="punch-out">下班卡</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>位置驗證</InputLabel>
                  <Select
                    value={filters.isWithinFence === undefined ? '' : filters.isWithinFence ? 'true' : 'false'}
                    label="位置驗證"
                    onChange={(e) => handleFilterChange('isWithinFence', e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined)}
                  >
                    <MenuItem value="">全部</MenuItem>
                    <MenuItem value="true">通過</MenuItem>
                    <MenuItem value="false">未通過</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>排序欄位</InputLabel>
                  <Select
                    value={filters.sort || 'timestamp'}
                    label="排序欄位"
                    onChange={(e) => handleFilterChange('sort', e.target.value)}
                  >
                    <MenuItem value="timestamp">打卡時間</MenuItem>
                    <MenuItem value="createdAt">記錄時間</MenuItem>
                    <MenuItem value="employeeName">員工姓名</MenuItem>
                    <MenuItem value="storeName">分店名稱</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>排序方式</InputLabel>
                  <Select
                    value={filters.order || 'desc'}
                    label="排序方式"
                    onChange={(e) => handleFilterChange('order', e.target.value as 'asc' | 'desc')}
                  >
                    <MenuItem value="desc">降序</MenuItem>
                    <MenuItem value="asc">升序</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button variant="outlined" onClick={handleClearFilters}>
                    清除篩選
                  </Button>
                  <Button 
                    variant="contained"
                    onClick={() => setShowFilters(false)}
                  >
                    關閉篩選
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper elevation={2}>
        <TableContainer>
          <Table>
            <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
              <TableRow>
                <TableCell>時間</TableCell>
                <TableCell>員工</TableCell>
                <TableCell>分店</TableCell>
                <TableCell>類型</TableCell>
                <TableCell>位置</TableCell>
                <TableCell>位置驗證</TableCell>
                <TableCell>來源</TableCell>
                <TableCell>備註</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      正在加載考勤記錄...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    <Typography variant="body2">
                      無符合條件的考勤記錄
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.logId} hover>
                    <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person fontSize="small" color="primary" />
                        {log.employeeName}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Business fontSize="small" color="primary" />
                        {log.storeName}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={log.type === 'punch-in' ? '上班卡' : '下班卡'} 
                        color={log.type === 'punch-in' ? 'primary' : 'secondary'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={`經緯度: ${formatCoordinates(log.coords || { latitude: log.latitude, longitude: log.longitude })}`}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocationOn fontSize="small" color="action" />
                          <Typography variant="body2">
                            {log.distance ? `${log.distance.toFixed(0)}公尺` : '無數據'}
                          </Typography>
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {log.isWithinFence ? (
                        <Chip 
                          icon={<CheckCircle fontSize="small" />} 
                          label="通過" 
                          color="success" 
                          size="small" 
                          variant="outlined"
                        />
                      ) : (
                        <Chip 
                          icon={<Cancel fontSize="small" />} 
                          label="未通過" 
                          color="error" 
                          size="small" 
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell>{getSourceDisplay(log.source)}</TableCell>
                    <TableCell>
                      {log.notes ? (
                        <Tooltip title={log.notes}>
                          <InfoOutlined fontSize="small" color="info" />
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={totalItems}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="每頁記錄:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 共 ${count} 筆`}
        />
      </Paper>
    </Box>
  );
};

export default AttendanceList; 