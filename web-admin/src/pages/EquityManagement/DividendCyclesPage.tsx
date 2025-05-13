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
  Calculate as CalculateIcon,
  CheckCircle as ApproveIcon,
  MonetizationOn as DistributeIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';
import { Formik, Form, Field, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import equityService from '../../services/equityService';
import storeService from '../../services/storeService';
import { hasPermission } from '../../utils/permissionUtils';
import { 
  DividendCycle,
  DividendCycleStatus,
  DividendCycleFilters
} from '../../types/equity.types';

// 定義創建分紅週期表單初始值
interface CreateDividendCycleFormValues {
  storeId: string;
  year: number;
  quarter: number;
  totalNetProfit: number;
  previousDeficit: number;
  startDate: Date | null;
  endDate: Date | null;
}

// 驗證 Schema
const createDividendCycleSchema = Yup.object().shape({
  storeId: Yup.string().required('店鋪為必填'),
  year: Yup.number()
    .required('年份為必填')
    .min(2020, '年份不能早於2020年')
    .max(2100, '年份不能超過2100年'),
  quarter: Yup.number()
    .required('季度為必填')
    .min(1, '季度必須是1-4之間')
    .max(4, '季度必須是1-4之間'),
  totalNetProfit: Yup.number()
    .required('總淨利潤為必填')
    .typeError('必須是數字'),
  previousDeficit: Yup.number()
    .min(0, '前期虧損不能為負數')
    .typeError('必須是數字')
    .default(0),
  startDate: Yup.date()
    .required('開始日期為必填')
    .typeError('請輸入有效的日期'),
  endDate: Yup.date()
    .required('結束日期為必填')
    .min(
      Yup.ref('startDate'),
      '結束日期必須晚於開始日期'
    )
    .typeError('請輸入有效的日期')
});

const DividendCyclesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DividendCycleFilters>({
    limit: 10
  });
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  
  // 權限控制
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canCalculate: false,
    canApprove: false,
    canDistribute: false
  });

  // 檢查權限
  useEffect(() => {
    const checkPermissions = async () => {
      const [canCreate, canCalculate, canApprove, canDistribute] = await Promise.all([
        hasPermission('equity:manage_dividends'),
        hasPermission('equity:manage_dividends'),
        hasPermission('equity:approve_dividends'),
        hasPermission('equity:distribute_dividends')
      ]);
      
      setPermissions({
        canCreate,
        canCalculate,
        canApprove,
        canDistribute
      });
    };
    
    checkPermissions();
  }, []);

  // 獲取店鋪列表
  const { data: stores, isLoading: loadingStores } = useQuery(
    'stores',
    () => storeService.getStores(),
    {
      staleTime: 5 * 60 * 1000 // 5分鐘內不重新請求
    }
  );

  // 獲取分紅週期列表
  const {
    data: cyclesData,
    isLoading: loadingCycles,
    error: cyclesError
  } = useQuery(
    ['dividendCycles', filters, page, rowsPerPage],
    () => {
      const queryFilters = {
        ...filters,
        limit: rowsPerPage,
        cursor
      };
      return equityService.getDividendCycles(queryFilters);
    },
    {
      keepPreviousData: true,
      enabled: !!filters
    }
  );

  // 創建分紅週期
  const { mutate: createDividendCycle, isLoading: creating } = useMutation(
    (data: CreateDividendCycleFormValues) => equityService.createDividendCycle(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dividendCycles']);
        setShowCreateDialog(false);
      },
      onError: (error) => {
        console.error('Error creating dividend cycle:', error);
      }
    }
  );

  // 計算分紅
  const { mutate: calculateDividend, isLoading: calculating } = useMutation(
    (cycleId: string) => equityService.calculateDividend(cycleId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dividendCycles']);
      },
      onError: (error) => {
        console.error('Error calculating dividend:', error);
      }
    }
  );

  // 審批分紅
  const { mutate: approveDividend, isLoading: approving } = useMutation(
    (cycleId: string) => equityService.approveDividend(cycleId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dividendCycles']);
      },
      onError: (error) => {
        console.error('Error approving dividend:', error);
      }
    }
  );

  // 分配分紅
  const { mutate: distributeDividend, isLoading: distributing } = useMutation(
    (cycleId: string) => equityService.distributeDividend(cycleId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dividendCycles']);
      },
      onError: (error) => {
        console.error('Error distributing dividend:', error);
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
    if (newPage > page && cyclesData?.nextCursor) {
      setCursor(cyclesData.nextCursor);
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

  // 處理創建分紅週期對話框
  const handleCreateDialogOpen = () => {
    setShowCreateDialog(true);
  };

  const handleCreateDialogClose = () => {
    setShowCreateDialog(false);
  };

  // 處理表單提交
  const handleCreateDividendCycle = (values: CreateDividendCycleFormValues, helpers: FormikHelpers<CreateDividendCycleFormValues>) => {
    createDividendCycle(values);
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
  const getStatusColor = (status: DividendCycleStatus): "success" | "info" | "warning" | "default" | "error" | "primary" | "secondary" => {
    switch (status) {
      case DividendCycleStatus.DRAFT:
        return 'default';
      case DividendCycleStatus.CALCULATING:
        return 'info';
      case DividendCycleStatus.PENDING_APPROVAL:
        return 'warning';
      case DividendCycleStatus.APPROVED:
        return 'success';
      case DividendCycleStatus.DISTRIBUTING:
        return 'info';
      case DividendCycleStatus.COMPLETED:
        return 'success';
      case DividendCycleStatus.CANCELLED:
        return 'error';
      default:
        return 'default';
    }
  };

  // 獲取狀態顯示文字
  const getStatusText = (status: DividendCycleStatus): string => {
    switch (status) {
      case DividendCycleStatus.DRAFT:
        return '草稿';
      case DividendCycleStatus.CALCULATING:
        return '計算中';
      case DividendCycleStatus.PENDING_APPROVAL:
        return '待審批';
      case DividendCycleStatus.APPROVED:
        return '已審批';
      case DividendCycleStatus.DISTRIBUTING:
        return '分配中';
      case DividendCycleStatus.COMPLETED:
        return '已完成';
      case DividendCycleStatus.CANCELLED:
        return '已取消';
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
  const totalCount = cyclesData?.totalCount || 0;

  // 獲取當前年份和過去3年的選項
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          分紅週期管理
        </Typography>

        <Box display="flex" gap={2}>
          {permissions.canCreate && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleCreateDialogOpen}
            >
              創建週期
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
                  <MenuItem value={DividendCycleStatus.DRAFT}>草稿</MenuItem>
                  <MenuItem value={DividendCycleStatus.CALCULATING}>計算中</MenuItem>
                  <MenuItem value={DividendCycleStatus.PENDING_APPROVAL}>待審批</MenuItem>
                  <MenuItem value={DividendCycleStatus.APPROVED}>已審批</MenuItem>
                  <MenuItem value={DividendCycleStatus.DISTRIBUTING}>分配中</MenuItem>
                  <MenuItem value={DividendCycleStatus.COMPLETED}>已完成</MenuItem>
                  <MenuItem value={DividendCycleStatus.CANCELLED}>已取消</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {cyclesError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          獲取分紅週期時發生錯誤。
        </Alert>
      )}

      {loadingCycles && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      )}

      {cyclesData && !loadingCycles && (
        <>
          <TableContainer>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>週期ID</TableCell>
                  <TableCell>店鋪</TableCell>
                  <TableCell>年份/季度</TableCell>
                  <TableCell>期間</TableCell>
                  <TableCell align="right">總淨利潤</TableCell>
                  <TableCell align="right">可分配利潤</TableCell>
                  <TableCell align="right">每股分紅</TableCell>
                  <TableCell align="right">總分紅金額</TableCell>
                  <TableCell>狀態</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cyclesData.cycles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      尚未有分紅週期記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  cyclesData.cycles.map((cycle: DividendCycle) => (
                    <TableRow key={cycle.cycleId}>
                      <TableCell>{cycle.cycleId}</TableCell>
                      <TableCell>{cycle.storeName || cycle.storeId}</TableCell>
                      <TableCell>{`${cycle.year} Q${cycle.quarter}`}</TableCell>
                      <TableCell>
                        {new Date(cycle.startDate).toLocaleDateString('zh-TW')} - 
                        {new Date(cycle.endDate).toLocaleDateString('zh-TW')}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(cycle.totalNetProfit)}</TableCell>
                      <TableCell align="right">{formatCurrency(cycle.distributableProfit)}</TableCell>
                      <TableCell align="right">{formatCurrency(cycle.dividendPerShare)}</TableCell>
                      <TableCell align="right">{formatCurrency(cycle.totalDividendAmount)}</TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusText(cycle.status)} 
                          color={getStatusColor(cycle.status)} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box display="flex" justifyContent="center" gap={1}>
                          {/* 計算按鈕 - 當狀態為 DRAFT 時顯示 */}
                          {cycle.status === DividendCycleStatus.DRAFT && permissions.canCalculate && (
                            <Tooltip title="計算分紅">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => calculateDividend(cycle.cycleId)}
                                disabled={calculating}
                              >
                                <CalculateIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {/* 審批按鈕 - 當狀態為 PENDING_APPROVAL 時顯示 */}
                          {cycle.status === DividendCycleStatus.PENDING_APPROVAL && permissions.canApprove && (
                            <Tooltip title="審批分紅">
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={() => approveDividend(cycle.cycleId)}
                                disabled={approving}
                              >
                                <ApproveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {/* 分配按鈕 - 當狀態為 APPROVED 時顯示 */}
                          {cycle.status === DividendCycleStatus.APPROVED && permissions.canDistribute && (
                            <Tooltip title="執行分配">
                              <IconButton 
                                size="small" 
                                color="info"
                                onClick={() => distributeDividend(cycle.cycleId)}
                                disabled={distributing}
                              >
                                <DistributeIcon fontSize="small" />
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

      {/* 創建分紅週期對話框 */}
      <Dialog
        open={showCreateDialog}
        onClose={handleCreateDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>創建分紅週期</DialogTitle>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Formik
            initialValues={{
              storeId: stores && stores.length > 0 ? stores[0].storeId : '',
              year: currentYear,
              quarter: Math.floor((new Date().getMonth() / 3) + 1),
              totalNetProfit: 0,
              previousDeficit: 0,
              startDate: getDefaultDatesForQuarter(currentYear, Math.floor((new Date().getMonth() / 3) + 1))[0],
              endDate: getDefaultDatesForQuarter(currentYear, Math.floor((new Date().getMonth() / 3) + 1))[1]
            }}
            validationSchema={createDividendCycleSchema}
            onSubmit={handleCreateDividendCycle}
          >
            {({ values, errors, touched, handleChange, setFieldValue }) => (
              <Form>
                <DialogContent>
                  <DialogContentText sx={{ mb: 2 }}>
                    創建新的分紅週期。所有標記星號(*)的字段均為必填項。
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
                            setFieldValue('startDate', start);
                            setFieldValue('endDate', end);
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
                            setFieldValue('startDate', start);
                            setFieldValue('endDate', end);
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
                      <TextField
                        fullWidth
                        name="totalNetProfit"
                        label="總淨利潤 ($) *"
                        type="number"
                        InputProps={{ inputProps: { step: 0.01 } }}
                        value={values.totalNetProfit}
                        onChange={handleChange}
                        error={touched.totalNetProfit && Boolean(errors.totalNetProfit)}
                        helperText={touched.totalNetProfit && errors.totalNetProfit}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        name="previousDeficit"
                        label="前期虧損 ($)"
                        type="number"
                        InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                        value={values.previousDeficit}
                        onChange={handleChange}
                        error={touched.previousDeficit && Boolean(errors.previousDeficit)}
                        helperText={touched.previousDeficit && errors.previousDeficit}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        label="開始日期 *"
                        value={values.startDate}
                        onChange={(newValue) => {
                          setFieldValue('startDate', newValue);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            error={touched.startDate && Boolean(errors.startDate)}
                            helperText={touched.startDate && errors.startDate}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        label="結束日期 *"
                        value={values.endDate}
                        onChange={(newValue) => {
                          setFieldValue('endDate', newValue);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            error={touched.endDate && Boolean(errors.endDate)}
                            helperText={touched.endDate && errors.endDate}
                          />
                        )}
                        minDate={values.startDate}
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
                    {creating ? '創建中...' : '創建分紅週期'}
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

export default DividendCyclesPage; 