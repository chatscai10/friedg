import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Snackbar,
  Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';

import { listLeaveRequests, LeaveRequest, ListLeaveRequestParams } from '../services/leaveService';
import LeaveRequestList from '../components/LeaveManagement/LeaveRequestList';

// 假設的用戶/分店數據獲取函數
// 實際項目中應該從API獲取
const getEmployees = async () => {
  // 模擬API調用
  await new Promise(resolve => setTimeout(resolve, 300));
  return [
    { id: 'emp1', name: '張三' },
    { id: 'emp2', name: '李四' },
    { id: 'emp3', name: '王五' },
    { id: 'emp4', name: '趙六' },
    { id: 'emp5', name: '孫七' }
  ];
};

const getStores = async () => {
  // 模擬API調用
  await new Promise(resolve => setTimeout(resolve, 300));
  return [
    { id: 'store1', name: '台北店' },
    { id: 'store2', name: '新北店' },
    { id: 'store3', name: '桃園店' },
    { id: 'store4', name: '台中店' },
    { id: 'store5', name: '高雄店' }
  ];
};

const LeaveManagementPage: React.FC = () => {
  // 請假申請列表
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  
  // 分頁參數
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  // 篩選條件
  const [filters, setFilters] = useState<ListLeaveRequestParams>({
    status: 'pending', // 默認顯示待處理的請假申請
    page: 1,
    pageSize: 10
  });
  
  // 日期範圍
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfMonth(new Date()));
  
  // 員工和分店列表
  const [employees, setEmployees] = useState<{id: string; name: string}[]>([]);
  const [stores, setStores] = useState<{id: string; name: string}[]>([]);
  
  // 通知訊息
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // 獲取請假申請列表
  const fetchLeaveRequests = useCallback(async () => {
    setLoading(true);
    
    try {
      // 構建查詢參數
      const params: ListLeaveRequestParams = {
        ...filters,
        page: page + 1, // 轉換為1-based
        pageSize
      };
      
      // 添加日期範圍（如果有）
      if (startDate) {
        params.startDate = format(startDate, 'yyyy-MM-dd');
      }
      
      if (endDate) {
        params.endDate = format(endDate, 'yyyy-MM-dd');
      }
      
      const response = await listLeaveRequests(params);
      setLeaveRequests(response.items);
      setTotalItems(response.pagination.total);
    } catch (error) {
      console.error('獲取請假申請列表失敗:', error);
      setSnackbar({
        open: true,
        message: '獲取請假申請列表失敗',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, startDate, endDate]);
  
  // 獲取員工和分店數據
  const fetchEmployeesAndStores = useCallback(async () => {
    try {
      const [employeesData, storesData] = await Promise.all([
        getEmployees(),
        getStores()
      ]);
      
      setEmployees(employeesData);
      setStores(storesData);
    } catch (error) {
      console.error('獲取員工和分店數據失敗:', error);
    }
  }, []);
  
  // 處理篩選條件變更
  const handleFilterChange = (key: string, value: string | null) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // 應用篩選條件
  const applyFilters = () => {
    setPage(0); // 重置頁碼
    fetchLeaveRequests();
  };
  
  // 重置篩選條件
  const resetFilters = () => {
    setFilters({
      status: 'pending',
      page: 1,
      pageSize: 10
    });
    setStartDate(startOfMonth(new Date()));
    setEndDate(endOfMonth(new Date()));
    setPage(0);
  };
  
  // 處理頁碼變更
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  // 處理每頁筆數變更
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
  };
  
  // 處理狀態變更後的刷新
  const handleStatusChanged = () => {
    fetchLeaveRequests();
    setSnackbar({
      open: true,
      message: '請假申請狀態已更新',
      severity: 'success'
    });
  };
  
  // 初始加載
  useEffect(() => {
    fetchEmployeesAndStores();
  }, [fetchEmployeesAndStores]);
  
  // 當篩選條件或分頁參數變更時獲取數據
  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests, page, pageSize]);
  
  // 關閉通知訊息
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };
  
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          請假管理
        </Typography>
        
        {/* 篩選器 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" mb={2}>
                <FilterListIcon sx={{ mr: 1 }} />
                <Typography variant="h6">篩選條件</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>狀態</InputLabel>
                <Select
                  value={filters.status || ''}
                  label="狀態"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">全部狀態</MenuItem>
                  <MenuItem value="pending">待審批</MenuItem>
                  <MenuItem value="approved">已批准</MenuItem>
                  <MenuItem value="rejected">已拒絕</MenuItem>
                  <MenuItem value="cancelled">已取消</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>分店</InputLabel>
                <Select
                  value={filters.storeId || ''}
                  label="分店"
                  onChange={(e) => handleFilterChange('storeId', e.target.value)}
                >
                  <MenuItem value="">全部分店</MenuItem>
                  {stores.map(store => (
                    <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>員工</InputLabel>
                <Select
                  value={filters.employeeId || ''}
                  label="員工"
                  onChange={(e) => handleFilterChange('employeeId', e.target.value)}
                >
                  <MenuItem value="">全部員工</MenuItem>
                  {employees.map(employee => (
                    <MenuItem key={employee.id} value={employee.id}>{employee.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                <DatePicker
                  label="開始日期"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small'
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                <DatePicker
                  label="結束日期"
                  value={endDate}
                  onChange={setEndDate}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small'
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={resetFilters}
              >
                重置
              </Button>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={applyFilters}
                startIcon={<RefreshIcon />}
              >
                應用篩選
              </Button>
            </Grid>
          </Grid>
        </Paper>
        
        {/* 請假申請列表 */}
        <Box sx={{ mb: 4 }}>
          <LeaveRequestList
            leaveRequests={leaveRequests}
            loading={loading}
            totalItems={totalItems}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onStatusChange={handleStatusChanged}
          />
        </Box>
      </Box>
      
      {/* 通知訊息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default LeaveManagementPage; 