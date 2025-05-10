import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  SelectChangeEvent
} from '@mui/material';
import { 
  FilterList as FilterIcon, 
  Clear as ClearIcon, 
  Visibility as VisibilityIcon,
  Add as AddIcon,
  LockOpen as OpenIcon,
  Lock as CloseIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { Formik, Form, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import equityService from '../../services/equityService';
import storeService from '../../services/storeService';
import { hasPermission } from '../../utils/permissionUtils';
import { 
  InternalTradeWindow,
  TradeWindowStatus,
  TradeWindowFilters
} from '../../types/equity.types';

// 定義創建交易窗口表單初始值
interface CreateTradeWindowFormValues {
  storeId: string;
  year: number;
  quarter: number;
  openDate: Date | null;
  closeDate: Date | null;
}

// 驗證 Schema
const createTradeWindowSchema = Yup.object().shape({
  storeId: Yup.string().required('店鋪為必填'),
  year: Yup.number()
    .required('年份為必填')
    .min(2020, '年份不能早於2020年')
    .max(2100, '年份不能超過2100年'),
  quarter: Yup.number()
    .required('季度為必填')
    .min(1, '季度必須是1-4之間')
    .max(4, '季度必須是1-4之間'),
  openDate: Yup.date()
    .required('開始日期為必填')
    .typeError('請輸入有效的日期'),
  closeDate: Yup.date()
    .required('結束日期為必填')
    .min(
      Yup.ref('openDate'),
      '結束日期必須晚於開始日期'
    )
    .typeError('請輸入有效的日期')
});

const TradeWindowsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TradeWindowFilters>({
    limit: 10
  });
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [hasCreatePermission, setHasCreatePermission] = useState<boolean>(false);

  // 檢查權限
  useEffect(() => {
    const checkPermission = async () => {
      const canManageWindows = await hasPermission('equity:manage_trade_windows');
      setHasCreatePermission(canManageWindows);
    };
    checkPermission();
  }, []);

  // 獲取店鋪列表
  const { data: stores, isLoading: loadingStores } = useQuery(
    'stores',
    () => storeService.getStores(),
    {
      staleTime: 5 * 60 * 1000 // 5分鐘內不重新請求
    }
  );

  // 獲取交易窗口列表
  const {
    data: windowsData,
    isLoading: loadingWindows,
    error: windowsError
  } = useQuery(
    ['tradeWindows', filters, page, rowsPerPage],
    () => {
      const queryFilters = {
        ...filters,
        limit: rowsPerPage,
        cursor
      };
      return equityService.getTradeWindows(queryFilters);
    },
    {
      keepPreviousData: true,
      enabled: !!filters
    }
  );

  // 創建交易窗口
  const { mutate: createTradeWindow, isLoading: creating } = useMutation(
    (data: CreateTradeWindowFormValues) => equityService.createTradeWindow(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tradeWindows']);
        setShowCreateDialog(false);
      },
      onError: (error) => {
        console.error('Error creating trade window:', error);
      }
    }
  );

  // 切換窗口狀態 (開啟/關閉)
  const { mutate: toggleTradeWindow, isLoading: toggling } = useMutation(
    ({ windowId, action }: { windowId: string; action: 'open' | 'close' }) => 
      equityService.toggleTradeWindow(windowId, action),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tradeWindows']);
      },
      onError: (error) => {
        console.error('Error toggling trade window status:', error);
      }
    }
  );

  const handleFilterChange = (event: SelectChangeEvent) => {
    const { name, value } = event.target;
    
    if (value === 'all') {
      // 重置該欄位的篩選
      const { [name]: _, ...newFilters } = filters;
      setFilters(newFilters);
    } else {
      setFilters(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    setCursor(undefined);
    setPage(0);
  };

  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const handleClearFilters = () => {
    setFilters({ limit: rowsPerPage });
    setCursor(undefined);
    setPage(0);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    if (newPage > page && windowsData?.nextCursor) {
      setCursor(windowsData.nextCursor);
    } else if (newPage < page) {
      // 向前翻頁邏輯可能需要更複雜的實現，這裡簡化處理
      setCursor(undefined);
    }
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setFilters(prev => ({
      ...prev,
      limit: parseInt(event.target.value, 10)
    }));
    setCursor(undefined);
    setPage(0);
  };

  // 處理創建交易窗口對話框
  const handleCreateDialogOpen = () => {
    setShowCreateDialog(true);
  };

  const handleCreateDialogClose = () => {
    setShowCreateDialog(false);
  };

  // 處理表單提交
  const handleCreateTradeWindow = (values: CreateTradeWindowFormValues, helpers: FormikHelpers<CreateTradeWindowFormValues>) => {
    createTradeWindow(values);
    helpers.resetForm();
  };

  // 生成當前季度的默認日期範圍
  const getDefaultDatesForQuarter = (year: number, quarter: number): [Date, Date] => {
    const startMonth = (quarter - 1) * 3;
    const endMonth = quarter * 3 - 1;
    
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, endMonth + 1, 0); // 季度最後一個月的最後一天
    
    return [startDate, endDate];
  };

  // 獲取狀態顯示顏色
  const getStatusColor = (status: TradeWindowStatus): "success" | "info" | "warning" | "default" | "error" | "primary" | "secondary" => {
    switch (status) {
      case TradeWindowStatus.SCHEDULED:
        return 'info';
      case TradeWindowStatus.OPEN:
        return 'success';
      case TradeWindowStatus.CLOSED:
        return 'default';
      default:
        return 'default';
    }
  };

  // 獲取狀態顯示文字
  const getStatusText = (status: TradeWindowStatus): string => {
    switch (status) {
      case TradeWindowStatus.SCHEDULED:
        return '已排程';
      case TradeWindowStatus.OPEN:
        return '開放中';
      case TradeWindowStatus.CLOSED:
        return '已關閉';
      default:
        return status;
    }
  };

  if (loadingStores) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // 計算分頁信息
  const totalCount = windowsData?.totalCount || 0;

  // 獲取當前年份和過去3年的選項
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          交易窗口管理
        </Typography>

        <Box display="flex" gap={2}>
          {hasCreatePermission && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleCreateDialogOpen}
            >
              創建窗口
            </Button>
          )}
          <Tooltip title="顯示篩選器">
            <IconButton onClick={handleFilterToggle} color={showFilters ? 'primary' : 'default'}>
              <FilterIcon />
            </IconButton>
          </Tooltip>
          {showFilters && Object.keys(filters).length > 1 && ( // > 1 因為至少有 limit
            <Tooltip title="清除篩選">
              <IconButton onClick={handleClearFilters} color="secondary">
                <ClearIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {showFilters && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="store-filter-label">店鋪</InputLabel>
                <Select
                  labelId="store-filter-label"
                  label="店鋪"
                  name="storeId"
                  value={filters.storeId || 'all'}
                  onChange={handleFilterChange}
                >
                  <MenuItem value="all">所有店鋪</MenuItem>
                  {stores?.map((store) => (
                    <MenuItem key={store.storeId} value={store.storeId}>
                      {store.storeName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="year-filter-label">年份</InputLabel>
                <Select
                  labelId="year-filter-label"
                  label="年份"
                  name="year"
                  value={filters.year?.toString() || 'all'}
                  onChange={handleFilterChange}
                >
                  <MenuItem value="all">所有年份</MenuItem>
                  {yearOptions.map((year) => (
                    <MenuItem key={year} value={year.toString()}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="quarter-filter-label">季度</InputLabel>
                <Select
                  labelId="quarter-filter-label"
                  label="季度"
                  name="quarter"
                  value={filters.quarter?.toString() || 'all'}
                  onChange={handleFilterChange}
                >
                  <MenuItem value="all">所有季度</MenuItem>
                  <MenuItem value="1">Q1</MenuItem>
                  <MenuItem value="2">Q2</MenuItem>
                  <MenuItem value="3">Q3</MenuItem>
                  <MenuItem value="4">Q4</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="status-filter-label">狀態</InputLabel>
                <Select
                  labelId="status-filter-label"
                  label="狀態"
                  name="status"
                  value={filters.status || 'all'}
                  onChange={handleFilterChange}
                >
                  <MenuItem value="all">所有狀態</MenuItem>
                  <MenuItem value={TradeWindowStatus.SCHEDULED}>已排程</MenuItem>
                  <MenuItem value={TradeWindowStatus.OPEN}>開放中</MenuItem>
                  <MenuItem value={TradeWindowStatus.CLOSED}>已關閉</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {windowsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          獲取交易窗口時發生錯誤。
        </Alert>
      )}

      {loadingWindows && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      )}

      {windowsData && !loadingWindows && (
        <>
          <TableContainer>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>窗口ID</TableCell>
                  <TableCell>店鋪</TableCell>
                  <TableCell>年份/季度</TableCell>
                  <TableCell>開放期間</TableCell>
                  <TableCell align="right">交易數量</TableCell>
                  <TableCell align="right">交易量</TableCell>
                  <TableCell align="right">總交易價值</TableCell>
                  <TableCell>狀態</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {windowsData.windows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      尚未有交易窗口記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  windowsData.windows.map((window: InternalTradeWindow) => (
                    <TableRow key={window.windowId}>
                      <TableCell>{window.windowId}</TableCell>
                      <TableCell>{window.storeName || window.storeId}</TableCell>
                      <TableCell>{`${window.year} Q${window.quarter}`}</TableCell>
                      <TableCell>
                        {new Date(window.openDate).toLocaleDateString('zh-TW')} - 
                        {new Date(window.closeDate).toLocaleDateString('zh-TW')}
                      </TableCell>
                      <TableCell align="right">{window.transactionCount}</TableCell>
                      <TableCell align="right">{window.sharesTraded} 股</TableCell>
                      <TableCell align="right">{formatCurrency(window.totalValue)}</TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusText(window.status)} 
                          color={getStatusColor(window.status)} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={1}>
                          {/* 開啟按鈕 - 當狀態為 SCHEDULED 時顯示 */}
                          {window.status === TradeWindowStatus.SCHEDULED && hasCreatePermission && (
                            <Tooltip title="開啟窗口">
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={() => toggleTradeWindow({ windowId: window.windowId, action: 'open' })}
                                disabled={toggling}
                              >
                                <OpenIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {/* 關閉按鈕 - 當狀態為 OPEN 時顯示 */}
                          {window.status === TradeWindowStatus.OPEN && hasCreatePermission && (
                            <Tooltip title="關閉窗口">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => toggleTradeWindow({ windowId: window.windowId, action: 'close' })}
                                disabled={toggling}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {/* 查看詳情按鈕 - 始終顯示 */}
                          <Tooltip title="查看詳情">
                            <IconButton 
                              size="small" 
                              color="primary"
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="每頁筆數:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
        </>
      )}

      {/* 創建交易窗口對話框 */}
      <Dialog
        open={showCreateDialog}
        onClose={handleCreateDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>創建交易窗口</DialogTitle>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Formik
            initialValues={{
              storeId: stores && stores.length > 0 ? stores[0].storeId : '',
              year: currentYear,
              quarter: Math.floor((new Date().getMonth() / 3) + 1),
              openDate: getDefaultDatesForQuarter(currentYear, Math.floor((new Date().getMonth() / 3) + 1))[0],
              closeDate: getDefaultDatesForQuarter(currentYear, Math.floor((new Date().getMonth() / 3) + 1))[1]
            }}
            validationSchema={createTradeWindowSchema}
            onSubmit={handleCreateTradeWindow}
          >
            {({ values, errors, touched, handleChange, setFieldValue }) => (
              <Form>
                <DialogContent>
                  <DialogContentText sx={{ mb: 2 }}>
                    創建新的交易窗口。交易窗口開放期間，員工可以進行股份交易。所有標記星號(*)的字段均為必填項。
                  </DialogContentText>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth error={touched.storeId && Boolean(errors.storeId)}>
                        <InputLabel id="store-select-label">店鋪 *</InputLabel>
                        <Select
                          labelId="store-select-label"
                          name="storeId"
                          value={values.storeId}
                          onChange={handleChange}
                          label="店鋪 *"
                        >
                          {stores?.map((store) => (
                            <MenuItem key={store.storeId} value={store.storeId}>
                              {store.storeName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth error={touched.year && Boolean(errors.year)}>
                        <InputLabel id="year-select-label">年份 *</InputLabel>
                        <Select
                          labelId="year-select-label"
                          name="year"
                          value={values.year}
                          onChange={(e) => {
                            handleChange(e);
                            // 更新日期範圍
                            const [start, end] = getDefaultDatesForQuarter(
                              Number(e.target.value), 
                              values.quarter
                            );
                            setFieldValue('openDate', start);
                            setFieldValue('closeDate', end);
                          }}
                          label="年份 *"
                        >
                          {yearOptions.map((year) => (
                            <MenuItem key={year} value={year}>
                              {year}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth error={touched.quarter && Boolean(errors.quarter)}>
                        <InputLabel id="quarter-select-label">季度 *</InputLabel>
                        <Select
                          labelId="quarter-select-label"
                          name="quarter"
                          value={values.quarter}
                          onChange={(e) => {
                            handleChange(e);
                            // 更新日期範圍
                            const [start, end] = getDefaultDatesForQuarter(
                              values.year, 
                              Number(e.target.value)
                            );
                            setFieldValue('openDate', start);
                            setFieldValue('closeDate', end);
                          }}
                          label="季度 *"
                        >
                          <MenuItem value={1}>Q1</MenuItem>
                          <MenuItem value={2}>Q2</MenuItem>
                          <MenuItem value={3}>Q3</MenuItem>
                          <MenuItem value={4}>Q4</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        label="開放日期 *"
                        value={values.openDate}
                        onChange={(newValue) => {
                          setFieldValue('openDate', newValue);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            error={touched.openDate && Boolean(errors.openDate)}
                            helperText={touched.openDate && errors.openDate}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        label="關閉日期 *"
                        value={values.closeDate}
                        onChange={(newValue) => {
                          setFieldValue('closeDate', newValue);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            error={touched.closeDate && Boolean(errors.closeDate)}
                            helperText={touched.closeDate && errors.closeDate}
                          />
                        )}
                        minDate={values.openDate}
                      />
                    </Grid>
                  </Grid>
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={handleCreateDialogClose}
                    startIcon={<CancelIcon />}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    color="primary"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={creating}
                  >
                    {creating ? '創建中...' : '創建交易窗口'}
                  </Button>
                </DialogActions>
              </Form>
            )}
          </Formik>
        </LocalizationProvider>
      </Dialog>
    </Paper>
  );
};

export default TradeWindowsPage; 