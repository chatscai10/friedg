import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Chip,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Grid,
  IconButton,
  Pagination,
  Button,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReceiptIcon from '@mui/icons-material/Receipt';
import EditIcon from '@mui/icons-material/Edit';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Order, OrderStatus, OrderType, PaymentStatus /*, PaymentMethod*/ } from '../../types/order';
import { getOrders, updateOrderStatus, /*getOrderReceipt,*/ GetOrdersParams } from '../../services/orderService';

// 訂單狀態顏色映射
const statusColorMap: Record<OrderStatus, string> = {
  pending: 'warning',
  preparing: 'info',
  ready: 'secondary',
  completed: 'success',
  cancelled: 'error'
};

// 訂單狀態文字映射
const statusTextMap: Record<OrderStatus, string> = {
  pending: '待處理',
  preparing: '準備中',
  ready: '待取餐',
  completed: '已完成',
  cancelled: '已取消'
};

// 訂單類型文字映射
const orderTypeTextMap: Record<OrderType, string> = {
  'dine-in': '堂食',
  'takeout': '外帶',
  'delivery': '外送'
};

// 支付狀態文字映射
const paymentStatusTextMap: Record<PaymentStatus, string> = {
  unpaid: '未支付',
  partially_paid: '部分支付',
  paid: '已支付',
  refunded: '已退款'
};

// 支付方式文字映射
const paymentMethodTextMap: Record<string, string> = {
  cash: '現金',
  linepay: 'LINE Pay',
  creditcard: '信用卡'
};

// Helper function to check if a string is a valid OrderStatus
const isOrderStatus = (status: string): status is OrderStatus => {
  return ['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(status);
};

// 訂單列表組件
const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  
  // 篩選條件
  const [searchText, setSearchText] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // 訂單詳情對話框
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);

  // 更新對話框狀態
  const [updateStatusOpen, setUpdateStatusOpen] = useState<boolean>(false);
  const [updatingOrder, setUpdatingOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>('pending');
  const [updating, setUpdating] = useState<boolean>(false);

  // 收據對話框狀態
  const [receiptOpen, setReceiptOpen] = useState<boolean>(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);
  
  // 提示消息
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // 初始化加載訂單數據
  useEffect(() => {
    loadOrders();
  }, [page]);
  
  // 加載訂單數據的函數
  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use type guard to ensure status is valid or undefined
      const statusParam = (statusFilter && isOrderStatus(statusFilter)) ? statusFilter : undefined;

      const params: GetOrdersParams = {
        page,
        limit: pageSize,
        status: statusParam, // Use validated status
        orderType: orderTypeFilter as OrderType || undefined, // Cast orderTypeFilter
        from: fromDate ? format(fromDate, 'yyyy-MM-dd') : undefined,
        to: toDate ? format(toDate, 'yyyy-MM-dd') : undefined,
        search: searchText || undefined
      };
      
      const response = await getOrders(params);
      
      // 處理日期格式
      const formattedOrders = response.orders.map(order => {
        let createdAtDate: Date;
        let updatedAtDate: Date | undefined; // updatedAt might not always exist

        // Function to safely create Date from various inputs
        const safeCreateDate = (value: any): Date | null => {
          if (!value) return null;
          try {
            if (typeof value === 'string') {
              const date = new Date(value);
              return isNaN(date.getTime()) ? null : date; // Check if string parsing was successful
            } else if (typeof value === 'object' && value !== null && '_seconds' in value && typeof value._seconds === 'number') {
              // Handle Firestore Timestamp object { _seconds, _nanoseconds }
              const date = new Date(value._seconds * 1000);
              return isNaN(date.getTime()) ? null : date;
            } else if (value instanceof Date) {
                return isNaN(value.getTime()) ? null : value; // Already a Date object
            } else if (typeof value === 'number'){
                 const date = new Date(value); // Assume milliseconds if number
                 return isNaN(date.getTime()) ? null : date;
            }
          } catch (e) {
             console.error("Error parsing date value:", value, e);
          }
          return null; // Return null if parsing fails or format is unexpected
        };

        createdAtDate = safeCreateDate(order.createdAt) ?? new Date(); // Use current date as fallback if null
        updatedAtDate = safeCreateDate(order.updatedAt) ?? undefined; // Keep undefined if parsing fails


        return {
          ...order,
          createdAt: createdAtDate,
          // Only include updatedAt if it was successfully parsed
          ...(updatedAtDate && { updatedAt: updatedAtDate }), 
        };
      });
      
      setOrders(formattedOrders);
      setFilteredOrders(formattedOrders);
      // Use totalPages from the updated PaginationInfo type
      setTotalPages(response.pagination.totalPages); 
    } catch (error) {
      console.error('加載訂單失敗:', error);
      setError('加載訂單數據時發生錯誤，請重試。');
    } finally {
      setLoading(false);
    }
  };
  
  // 應用篩選條件
  const applyFilters = () => {
    setPage(1); // 重置為第一頁
    loadOrders();
  };
  
  // 重置篩選條件
  const resetFilters = () => {
    setSearchText('');
    setStatusFilter('');
    setOrderTypeFilter('');
    setFromDate(null);
    setToDate(null);
    setPage(1);
    
    // 重新加載數據
    loadOrders();
  };
  
  // 處理頁面變更
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };
  
  // 檢視訂單詳情
  const viewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  // 打開更新狀態對話框
  const openUpdateStatusDialog = (order: Order) => {
    setUpdatingOrder(order);
    setNewStatus(order.status);
    setUpdateStatusOpen(true);
  };

  // 打開收據對話框
  const openReceiptDialog = (order: Order) => {
    setReceiptOrder(order);
    setReceiptOpen(true);
    
    // 在真實場景可以加載PDF收據
    // loadOrderReceipt(order.id);
  };
  
  // 載入訂單收據 (Temporarily comment out problematic part)
  const loadOrderReceipt = async (_orderId: string) => { // Add underscore to indicate unused param
    try {
      setLoadingReceipt(true);
       console.warn('loadOrderReceipt function called, but Blob handling is temporarily commented out.');
       await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
    } catch (error) {
      console.error('載入收據失敗:', error);
      setSnackbar({
        open: true,
        message: '載入收據時發生錯誤，請重試。',
        severity: 'error'
      });
    } finally {
      setLoadingReceipt(false);
    }
  };

  // 更新訂單狀態
  const updateOrderStatusHandler = async () => {
    if (!updatingOrder) return;
    
    try {
      setUpdating(true);
      
      const updatedOrder = await updateOrderStatus(updatingOrder.id, newStatus);
      
      // 更新本地數據
      const updatedOrders = orders.map(order => 
        order.id === updatingOrder.id ? {
          ...updatedOrder,
          createdAt: new Date(updatedOrder.createdAt),
          updatedAt: new Date(updatedOrder.updatedAt)
        } : order
      );
      
      setOrders(updatedOrders);
      setFilteredOrders(updatedOrders);
      
      setSnackbar({
        open: true,
        message: `訂單 ${updatingOrder.orderNumber} 狀態已更新為 ${statusTextMap[newStatus]}`,
        severity: 'success'
      });
      
      setUpdateStatusOpen(false);
      setUpdatingOrder(null);
    } catch (error) {
      console.error('更新訂單狀態失敗:', error);
      setSnackbar({
        open: true,
        message: '更新訂單狀態失敗，請重試。',
        severity: 'error'
      });
    } finally {
      setUpdating(false);
    }
  };

  // 獲取可用的下一個狀態選項
  const getAvailableNextStatuses = (currentStatus: OrderStatus): OrderStatus[] => {
    switch (currentStatus) {
      case 'pending':
        return ['preparing', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['completed', 'cancelled'];
      case 'completed':
      case 'cancelled':
        return [currentStatus]; // 已完成或已取消的訂單不能再改變狀態
      default:
        return ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    }
  };
  
  // 處理Snackbar關閉
  const handleSnackbarClose = () => {
    setSnackbar({...snackbar, open: false});
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        訂單管理
      </Typography>
      
      {/* 搜尋和篩選區域 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="搜尋訂單號/顧客姓名/電話"
              variant="outlined"
              size="small"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={applyFilters}>
                    <SearchIcon />
                  </IconButton>
                )
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? '隱藏篩選' : '顯示篩選'}
            </Button>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Button 
              variant="contained" 
              color="primary"
              onClick={applyFilters}
            >
              應用篩選
            </Button>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <Button 
              variant="outlined" 
              color="secondary"
              onClick={resetFilters}
            >
              重置篩選
            </Button>
          </Grid>
          
          {showFilters && (
            <>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>訂單狀態</InputLabel>
                  <Select
                    value={statusFilter}
                    label="訂單狀態"
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="">全部</MenuItem>
                    <MenuItem value="pending">待處理</MenuItem>
                    <MenuItem value="preparing">準備中</MenuItem>
                    <MenuItem value="ready">待取餐</MenuItem>
                    <MenuItem value="completed">已完成</MenuItem>
                    <MenuItem value="cancelled">已取消</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>訂單類型</InputLabel>
                  <Select
                    value={orderTypeFilter}
                    label="訂單類型"
                    onChange={(e) => setOrderTypeFilter(e.target.value)}
                  >
                    <MenuItem value="">全部</MenuItem>
                    <MenuItem value="dine-in">堂食</MenuItem>
                    <MenuItem value="takeout">外帶</MenuItem>
                    <MenuItem value="delivery">外送</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                  <DatePicker
                    label="起始日期"
                    value={fromDate}
                    onChange={(date) => setFromDate(date)}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </LocalizationProvider>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                  <DatePicker
                    label="結束日期"
                    value={toDate}
                    onChange={(date) => setToDate(date)}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </LocalizationProvider>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>
      
      {/* 錯誤訊息 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* 訂單列表 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredOrders.length === 0 ? (
        <Typography variant="body1">無符合條件的訂單</Typography>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>訂單編號</TableCell>
                  <TableCell>顧客</TableCell>
                  <TableCell>類型</TableCell>
                  <TableCell>狀態</TableCell>
                  <TableCell>金額</TableCell>
                  <TableCell>支付狀態</TableCell>
                  <TableCell>建立時間</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.orderNumber}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{order.customerName}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {order.customerPhone}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {orderTypeTextMap[order.orderType]}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={statusTextMap[order.status]} 
                        color={statusColorMap[order.status] as "warning" | "info" | "secondary" | "success" | "error"}
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      {/* Check if totalPrice exists and is a number before formatting */}
                      {typeof order.totalPrice === 'number'
                        ? `$${order.totalPrice.toFixed(2)}` 
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={paymentStatusTextMap[order.paymentStatus]} 
                        color={order.paymentStatus === 'paid' ? 'success' : 
                                order.paymentStatus === 'unpaid' ? 'warning' : 
                                order.paymentStatus === 'refunded' ? 'error' : 'info'}
                        size="small" 
                      />
                      {order.paymentMethod && (
                        <Typography variant="caption" display="block">
                          {paymentMethodTextMap[order.paymentMethod]}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="查看詳情">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => viewOrderDetails(order)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="更新狀態">
                          <IconButton 
                            size="small" 
                            color="secondary"
                            disabled={order.status === 'completed' || order.status === 'cancelled'}
                            onClick={() => openUpdateStatusDialog(order)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="查看收據">
                          <IconButton 
                            size="small" 
                            color="info"
                            disabled={order.paymentStatus !== 'paid'}
                            onClick={() => openReceiptDialog(order)}
                          >
                            <ReceiptIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* 分頁控制 */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination 
              count={totalPages} 
              page={page} 
              onChange={handlePageChange} 
              color="primary" 
            />
          </Box>
        </>
      )}
      
      {/* 訂單狀態更新對話框 */}
      <Dialog
        open={updateStatusOpen}
        onClose={() => setUpdateStatusOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        {updatingOrder && (
          <>
            <DialogTitle>
              更新訂單狀態 - {updatingOrder.orderNumber}
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ py: 1 }}>
                <Typography variant="body2" gutterBottom>
                  當前狀態: 
                  <Chip 
                    label={statusTextMap[updatingOrder.status]} 
                    color={statusColorMap[updatingOrder.status] as "warning" | "info" | "secondary" | "success" | "error"}
                    size="small"
                    sx={{ ml: 1 }} 
                  />
                </Typography>
                
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>新狀態</InputLabel>
                  <Select
                    value={newStatus}
                    label="新狀態"
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                  >
                    {getAvailableNextStatuses(updatingOrder.status).map((status) => (
                      <MenuItem key={status} value={status}>
                        {statusTextMap[status]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {newStatus === 'cancelled' && (
                  <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                    注意：取消訂單操作不可逆，請謹慎操作。
                  </Typography>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button 
                variant="outlined" 
                onClick={() => setUpdateStatusOpen(false)}
                disabled={updating}
              >
                取消
              </Button>
              <Button 
                variant="contained" 
                color={newStatus === 'cancelled' ? 'error' : 'primary'}
                onClick={updateOrderStatusHandler}
                disabled={updating}
              >
                {updating ? <CircularProgress size={24} /> : '確認更新'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* 收據對話框 */}
      <Dialog
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {receiptOrder && (
          <>
            <DialogTitle>
              電子收據 - {receiptOrder.orderNumber}
            </DialogTitle>
            <DialogContent dividers>
              {loadingReceipt ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box sx={{ p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Typography variant="h6">{receiptOrder.storeName}</Typography>
                    <Typography variant="body2">電子收據</Typography>
                    <Typography variant="caption">
                      訂單時間: {format(new Date(receiptOrder.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="body2">
                    顧客: {receiptOrder.customerName}
                  </Typography>
                  <Typography variant="body2">
                    訂單類型: {orderTypeTextMap[receiptOrder.orderType]}
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box>
                    <Typography variant="body2" fontWeight="bold">訂單項目:</Typography>
                    {receiptOrder.items.map((item, index) => (
                      <Box key={item.id || index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">
                          {index + 1}. {item.menuItemName || item.name} x{item.quantity}
                        </Typography>
                        <Typography variant="body2">
                          ${typeof item.price === 'number' ? item.price.toFixed(2) : 
                             typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2) : 'N/A'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">小計:</Typography>
                    <Typography variant="body2">${typeof receiptOrder.subtotal === 'number' ? receiptOrder.subtotal.toFixed(2) : 'N/A'}</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">稅金:</Typography>
                    <Typography variant="body2">${typeof receiptOrder.taxAmount === 'number' ? receiptOrder.taxAmount.toFixed(2) : 'N/A'}</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <Typography variant="body1">總計:</Typography>
                    <Typography variant="body1">${typeof receiptOrder.totalPrice === 'number' ? receiptOrder.totalPrice.toFixed(2) : 'N/A'}</Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2">
                      支付方式: {receiptOrder.paymentMethod ? paymentMethodTextMap[receiptOrder.paymentMethod] : '暫無'}
                    </Typography>
                    <Typography variant="body2">
                      支付狀態: {paymentStatusTextMap[receiptOrder.paymentStatus]}
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ mt: 2 }}>
                      謝謝惠顧
                    </Typography>
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button 
                variant="outlined" 
                onClick={() => setReceiptOpen(false)}
                disabled={loadingReceipt}
              >
                關閉
              </Button>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => loadOrderReceipt(receiptOrder.id)}
                disabled={loadingReceipt}
              >
                {loadingReceipt ? <CircularProgress size={24} /> : '列印收據'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* 訂單詳情對話框 */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedOrder && (
          <>
            <DialogTitle>
              訂單詳情 - {selectedOrder.orderNumber}
              <Chip 
                label={statusTextMap[selectedOrder.status]} 
                color={statusColorMap[selectedOrder.status] as "warning" | "info" | "secondary" | "success" | "error"}
                size="small"
                sx={{ ml: 2 }} 
              />
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold">基本信息</Typography>
                  <Typography variant="body2">店鋪: {selectedOrder.storeName}</Typography>
                  <Typography variant="body2">顧客: {selectedOrder.customerName}</Typography>
                  <Typography variant="body2">電話: {selectedOrder.customerPhone}</Typography>
                  <Typography variant="body2">類型: {orderTypeTextMap[selectedOrder.orderType]}</Typography>
                  <Typography variant="body2">
                    建立時間: {format(new Date(selectedOrder.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold">付款信息</Typography>
                  <Typography variant="body2">
                    支付狀態: {paymentStatusTextMap[selectedOrder.paymentStatus]}
                  </Typography>
                  {selectedOrder.paymentMethod && (
                    <Typography variant="body2">
                      支付方式: {paymentMethodTextMap[selectedOrder.paymentMethod]}
                    </Typography>
                  )}
                  <Typography variant="body2">小計: ${typeof selectedOrder.subtotal === 'number' ? selectedOrder.subtotal.toFixed(2) : 'N/A'}</Typography>
                  <Typography variant="body2">稅金: ${typeof selectedOrder.taxAmount === 'number' ? selectedOrder.taxAmount.toFixed(2) : 'N/A'}</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    總計: ${typeof selectedOrder.totalPrice === 'number' ? selectedOrder.totalPrice.toFixed(2) : 'N/A'}
                  </Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle1" fontWeight="bold">訂單項目</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>品項</TableCell>
                          <TableCell align="right">單價</TableCell>
                          <TableCell align="right">數量</TableCell>
                          <TableCell align="right">小計</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedOrder.items.map((item) => (
                          <TableRow key={item.id || item.menuItemId || `${item.name}-${item.quantity}`}>
                            <TableCell>{item.menuItemName || item.name}</TableCell>
                            <TableCell align="right">${typeof item.unitPrice === 'number' ? item.unitPrice.toFixed(2) : 
                                                        typeof item.price === 'number' ? item.price.toFixed(2) : 'N/A'}</TableCell>
                            <TableCell align="right">{item.quantity}</TableCell>
                            <TableCell align="right">${typeof item.totalPrice === 'number' ? item.totalPrice.toFixed(2) : 
                                                        typeof item.price === 'number' && typeof item.quantity === 'number' ? (item.price * item.quantity).toFixed(2) : 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              {selectedOrder.paymentStatus === 'paid' && (
                <Button 
                  variant="outlined" 
                  color="primary" 
                  startIcon={<ReceiptIcon />}
                  onClick={() => openReceiptDialog(selectedOrder)}
                >
                  查看收據
                </Button>
              )}
              {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setDetailsOpen(false);
                    openUpdateStatusDialog(selectedOrder);
                  }}
                >
                  更新狀態
                </Button>
              )}
              <Button 
                variant="contained" 
                onClick={() => setDetailsOpen(false)}
              >
                關閉
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* 提示訊息 */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={5000} 
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OrderList; 