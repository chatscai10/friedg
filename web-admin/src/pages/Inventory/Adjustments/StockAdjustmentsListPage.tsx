import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  SelectChangeEvent
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { getStockAdjustments } from '../../../services/inventoryService';
import { getStores } from '../../../services/storeService';
import { StockAdjustment, StockAdjustmentType, StockAdjustmentsFilter } from '../../../types/inventory.types';
import StockAdjustmentForm from './StockAdjustmentForm';
import { hasPermission } from '../../../utils/permissionUtils';

// 庫存調整記錄列表頁面
const StockAdjustmentsListPage: React.FC = () => {
  // 查詢客戶端和狀態管理
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  
  // 過濾條件
  const [filters, setFilters] = useState<StockAdjustmentsFilter>({
    page: 1,
    pageSize: 10
  });
  
  // 日期範圍選擇狀態
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  
  // 模態框狀態
  const [formOpen, setFormOpen] = useState<boolean>(false);
  
  // 權限狀態
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false
  });

  // 獲取分店列表
  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores(),
    staleTime: 5 * 60 * 1000 // 5分鐘內不重新獲取
  });

  // 使用React Query獲取庫存調整記錄
  const { data, isLoading, isError } = useQuery({
    queryKey: ['stockAdjustments', { page: page + 1, pageSize: rowsPerPage, ...filters }],
    queryFn: () => getStockAdjustments({
      ...filters,
      page: page + 1, // API使用1-based索引
      pageSize: rowsPerPage,
      startDate: startDate?.format('YYYY-MM-DD'),
      endDate: endDate?.format('YYYY-MM-DD')
    }),
    enabled: permissions.canRead // 只有在有權限時才獲取數據
  });

  // 載入用戶權限
  React.useEffect(() => {
    const checkPermissions = async () => {
      const canCreate = await hasPermission('inventory:create_adjustment');
      const canRead = await hasPermission('inventory:read_adjustments');

      setPermissions({ canCreate, canRead });
    };
    
    checkPermissions();
  }, []);
  
  // 處理分頁變更
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // 處理過濾條件變更
  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPage(0);
  };
  
  const handleStoreFilterChange = (event: SelectChangeEvent<string>) => {
    const { value } = event.target;
    setFilters(prev => ({
      ...prev,
      storeId: value || undefined
    }));
    setPage(0);
  };
  
  const handleAdjustmentTypeFilterChange = (event: SelectChangeEvent<string>) => {
    const { value } = event.target;
    setFilters(prev => ({
      ...prev,
      adjustmentType: value as StockAdjustmentType || undefined
    }));
    setPage(0);
  };
  
  // 處理日期過濾器變更
  const handleStartDateChange = (date: Dayjs | null) => {
    setStartDate(date);
    // 不立即觸發查詢，等用戶點擊"套用過濾"按鈕
  };
  
  const handleEndDateChange = (date: Dayjs | null) => {
    setEndDate(date);
    // 不立即觸發查詢，等用戶點擊"套用過濾"按鈕
  };
  
  // 套用所有過濾條件進行查詢
  const applyDateFilters = () => {
    // 通過更新一個臨時字段來觸發查詢重新執行
    // (因為日期值已經在狀態中，我們只需要觸發queryKey變化)
    setFilters(prev => ({
      ...prev,
      _timestamp: new Date().getTime()
    }));
  };
  
  // 處理新增庫存調整
  const handleAddAdjustment = () => {
    setFormOpen(true);
  };
  
  // 處理表單關閉
  const handleFormClose = () => {
    setFormOpen(false);
  };
  
  // 處理表單提交
  const handleFormSubmit = () => {
    setFormOpen(false);
    // React Query會自動重新獲取數據
  };
  
  // 獲取分店名稱的輔助函數
  const getStoreName = (storeId: string) => {
    const store = storesQuery.data?.data.find(store => store.id === storeId);
    return store ? store.name : storeId;
  };

  // 提取數據，處理數據為空的情況
  const adjustments = data?.data || [];
  const total = data?.pagination.total || 0;
  
  // 組件主體
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          庫存調整記錄管理
        </Typography>
        {permissions.canCreate && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddAdjustment}
          >
            新增庫存調整
          </Button>
        )}
      </Box>
      
      {/* 過濾器 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                name="itemId"
                label="品項ID搜尋"
                fullWidth
                variant="outlined"
                size="small"
                value={filters.itemId || ''}
                onChange={handleFilterChange}
                InputProps={{
                  endAdornment: <SearchIcon color="action" />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>分店篩選</InputLabel>
                <Select
                  value={filters.storeId || ''}
                  label="分店篩選"
                  onChange={handleStoreFilterChange}
                >
                  <MenuItem value="">所有分店</MenuItem>
                  {storesQuery.data?.data.map(store => (
                    <MenuItem key={store.id} value={store.id}>
                      {store.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>調整類型篩選</InputLabel>
                <Select
                  value={filters.adjustmentType || ''}
                  label="調整類型篩選"
                  onChange={handleAdjustmentTypeFilterChange}
                >
                  <MenuItem value="">所有類型</MenuItem>
                  <MenuItem value={StockAdjustmentType.RECEIPT}>入庫</MenuItem>
                  <MenuItem value={StockAdjustmentType.ISSUE}>出庫</MenuItem>
                  <MenuItem value={StockAdjustmentType.STOCK_COUNT}>盤點調整</MenuItem>
                  <MenuItem value={StockAdjustmentType.DAMAGE}>損壞報廢</MenuItem>
                  <MenuItem value={StockAdjustmentType.TRANSFER}>移撥</MenuItem>
                  <MenuItem value={StockAdjustmentType.OTHER}>其他</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
            <Grid item xs={12} md={3}>
              <DatePicker
                label="開始日期"
                value={startDate}
                onChange={handleStartDateChange}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatePicker
                label="結束日期"
                value={endDate}
                onChange={handleEndDateChange}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                color="primary"
                onClick={applyDateFilters}
                sx={{ mt: 1 }}
              >
                套用日期過濾
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* 錯誤提示 */}
      {(isError || error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || '獲取庫存調整記錄時發生錯誤'}
        </Alert>
      )}
      
      {/* 未授權提示 */}
      {!permissions.canRead && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          您沒有查看庫存調整記錄的權限
        </Alert>
      )}
      
      {/* 表格 */}
      {permissions.canRead && (
        <Paper sx={{ width: '100%', mb: 2 }}>
          <TableContainer>
            <Table sx={{ minWidth: 750 }} aria-labelledby="庫存調整記錄表格">
              <TableHead>
                <TableRow>
                  <TableCell>調整ID</TableCell>
                  <TableCell>品項ID</TableCell>
                  <TableCell>分店</TableCell>
                  <TableCell>調整類型</TableCell>
                  <TableCell>調整數量</TableCell>
                  <TableCell>調整原因</TableCell>
                  <TableCell>調整日期</TableCell>
                  <TableCell>操作員</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : adjustments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      沒有符合條件的庫存調整記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  adjustments.map((adjustment: StockAdjustment) => (
                    <TableRow key={adjustment.adjustmentId}>
                      <TableCell>{adjustment.adjustmentId}</TableCell>
                      <TableCell>{adjustment.itemId}</TableCell>
                      <TableCell>{getStoreName(adjustment.storeId)}</TableCell>
                      <TableCell>{adjustment.adjustmentType}</TableCell>
                      <TableCell>{adjustment.quantityAdjusted}</TableCell>
                      <TableCell>{adjustment.reason || '無'}</TableCell>
                      <TableCell>
                        {new Date(adjustment.adjustmentDate).toLocaleString('zh-TW')}
                      </TableCell>
                      <TableCell>{adjustment.operatorId}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* 分頁控制 */}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="每頁筆數:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 共 ${count} 筆`}
          />
        </Paper>
      )}
      
      {/* 新增庫存調整表單對話框 */}
      <Dialog open={formOpen} onClose={handleFormClose} fullWidth maxWidth="md">
        <DialogTitle>
          新增庫存調整
        </DialogTitle>
        <DialogContent dividers>
          <StockAdjustmentForm
            onCancel={handleFormClose}
            onSubmit={handleFormSubmit}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default StockAdjustmentsListPage; 