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
  TextField,
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
  DialogActions,
  FormHelperText,
  Autocomplete,
  debounce
} from '@mui/material';
import { 
  FilterList as FilterIcon, 
  Clear as ClearIcon, 
  Visibility as VisibilityIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';
import { Formik, Form, Field, FormikHelpers } from 'formik';
import * as Yup from 'yup';

import equityService from '../../services/equityService';
import storeService from '../../services/storeService';
import employeeService from '../../services/employeeService';
import { hasPermission } from '../../utils/permissionUtils';
import { 
  EmployeeEquityHolding,
  EquityHoldingStatus, 
  EquitySourceType, 
  HoldingFilters,
  EquityType
} from '../../types/equity.types';
import { Employee } from '../../types/employee.types';

// 定義新增持股記錄表單初始值
interface CreateHoldingFormValues {
  employeeId: string;
  employeeName?: string; // 用於顯示
  storeId: string;
  equityType: EquityType;
  shares: number;
  sourceType: EquitySourceType;
  purchasePrice?: number;
  totalInvestment?: number;
  vestingStartDate: string;
  vestingEndDate: string;
  acquiredDate: string;
}

// 驗證 Schema
const createHoldingSchema = Yup.object().shape({
  employeeId: Yup.string().required('員工為必填'),
  storeId: Yup.string().required('店鋪為必填'),
  equityType: Yup.string().required('股權類型為必填'),
  shares: Yup.number()
    .required('股份數量為必填')
    .positive('股份數量必須為正數')
    .max(1000, '股份數量不能超過1000'),
  sourceType: Yup.string().required('獲取來源為必填'),
  purchasePrice: Yup.number()
    .when('sourceType', {
      is: EquitySourceType.PURCHASE,
      then: Yup.number()
        .required('認購價格為必填')
        .positive('認購價格必須為正數'),
      otherwise: Yup.number().nullable()
    }),
  vestingStartDate: Yup.date().required('鎖定期開始日期為必填'),
  vestingEndDate: Yup.date()
    .required('鎖定期結束日期為必填')
    .min(
      Yup.ref('vestingStartDate'),
      '鎖定期結束日期必須晚於開始日期'
    ),
  acquiredDate: Yup.date().required('獲取日期為必填')
});

const HoldingsListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<HoldingFilters>({});
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [selectedHolding, setSelectedHolding] = useState<EmployeeEquityHolding | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);
  const [hasCreatePermission, setHasCreatePermission] = useState<boolean>(false);

  // 檢查權限
  useEffect(() => {
    const checkPermission = async () => {
      const canCreateHolding = await hasPermission('equity:manage_holdings');
      setHasCreatePermission(canCreateHolding);
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

  // 搜尋員工
  const { data: employees, isLoading: loadingEmployees } = useQuery(
    ['employees', employeeSearch],
    () => employeeService.searchEmployees({ query: employeeSearch, active: true }),
    {
      enabled: employeeSearch.length > 1, // 只有當輸入至少2個字元時才執行搜尋
      staleTime: 30 * 1000 // 30秒內不重新請求
    }
  );

  // 獲取持股記錄列表
  const {
    data: holdingsData,
    isLoading: loadingHoldings,
    error: holdingsError,
    refetch
  } = useQuery(
    ['holdings', filters, page, rowsPerPage],
    () => {
      const queryFilters = {
        ...filters,
        limit: rowsPerPage,
        cursor
      };
      
      return equityService.getHoldings(queryFilters);
    },
    {
      keepPreviousData: true,
      onError: (error) => {
        console.error('Error fetching holdings:', error);
      }
    }
  );

  // 建立持股記錄
  const { mutate: createHolding, isLoading: creating } = useMutation(
    (data: CreateHoldingFormValues) => equityService.createHolding(data),
    {
      onSuccess: () => {
        // 重新載入持股列表
        queryClient.invalidateQueries(['holdings']);
        // 關閉對話框
        setShowCreateDialog(false);
      },
      onError: (error) => {
        console.error('Error creating holding:', error);
      }
    }
  );

  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const handleFilterChange = (event: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    if (!event.target.name) return;

    if (event.target.value === 'all') {
      // 重置該欄位的篩選
      const { [event.target.name]: _, ...newFilters } = filters;
      setFilters(newFilters);
    } else {
      setFilters(prev => ({
        ...prev,
        [event.target.name]: event.target.value
      }));
    }
    setCursor(undefined);
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({});
    setCursor(undefined);
    setPage(0);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    if (newPage > page && holdingsData?.nextCursor) {
      setCursor(holdingsData.nextCursor);
    } else if (newPage < page) {
      setCursor(undefined);
      // 如果要回到前面的頁面，目前的實現可能需要重新從頭開始請求
      // 理想情況下應該保存每個頁面的 cursor
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

  // 處理新增持股記錄對話框
  const handleCreateDialogOpen = () => {
    setShowCreateDialog(true);
  };

  const handleCreateDialogClose = () => {
    setShowCreateDialog(false);
  };

  // 處理表單提交
  const handleCreateHolding = (values: CreateHoldingFormValues, helpers: FormikHelpers<CreateHoldingFormValues>) => {
    createHolding(values);
    helpers.resetForm();
  };

  // 員工搜尋防抖處理
  const debouncedEmployeeSearch = React.useCallback(
    debounce((searchValue: string) => {
      setEmployeeSearch(searchValue);
    }, 300),
    []
  );

  // 獲取狀態顯示顏色
  const getStatusColor = (status: EquityHoldingStatus): "success" | "info" | "warning" | "default" | "error" | "primary" | "secondary" => {
    switch (status) {
      case EquityHoldingStatus.ACTIVE:
        return 'success';
      case EquityHoldingStatus.VESTING:
        return 'info';
      case EquityHoldingStatus.SELLING:
        return 'warning';
      case EquityHoldingStatus.FROZEN:
        return 'error';
      case EquityHoldingStatus.TERMINATED:
        return 'default';
      default:
        return 'default';
    }
  };

  // 獲取狀態顯示文字
  const getStatusText = (status: EquityHoldingStatus): string => {
    switch (status) {
      case EquityHoldingStatus.ACTIVE:
        return '已歸屬，活躍';
      case EquityHoldingStatus.VESTING:
        return '歸屬期內';
      case EquityHoldingStatus.SELLING:
        return '正在出售中';
      case EquityHoldingStatus.FROZEN:
        return '凍結';
      case EquityHoldingStatus.TERMINATED:
        return '已終止';
      default:
        return status;
    }
  };

  // 獲取股權來源顯示文字
  const getSourceTypeText = (sourceType: EquitySourceType): string => {
    switch (sourceType) {
      case EquitySourceType.PERFORMANCE:
        return '績效獎勵';
      case EquitySourceType.PURCHASE:
        return '現金認購';
      default:
        return sourceType;
    }
  };

  // 計算默認的鎖定期結束日期（一年後）
  const getDefaultVestingEndDate = (startDate: string): string => {
    const date = new Date(startDate);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  };

  if (loadingStores) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // 計算分頁信息
  const totalCount = holdingsData?.totalCount || 0;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          持股記錄管理
        </Typography>

        <Box display="flex" gap={2}>
          {hasCreatePermission && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleCreateDialogOpen}
            >
              新增記錄
            </Button>
          )}
          <Tooltip title="顯示篩選器">
            <IconButton onClick={handleFilterToggle} color={showFilters ? 'primary' : 'default'}>
              <FilterIcon />
            </IconButton>
          </Tooltip>
          {showFilters && Object.keys(filters).length > 0 && (
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
                <InputLabel id="status-filter-label">狀態</InputLabel>
                <Select
                  labelId="status-filter-label"
                  label="狀態"
                  name="status"
                  value={filters.status || 'all'}
                  onChange={handleFilterChange}
                >
                  <MenuItem value="all">所有狀態</MenuItem>
                  <MenuItem value={EquityHoldingStatus.ACTIVE}>已歸屬，活躍</MenuItem>
                  <MenuItem value={EquityHoldingStatus.VESTING}>歸屬期內</MenuItem>
                  <MenuItem value={EquityHoldingStatus.SELLING}>正在出售中</MenuItem>
                  <MenuItem value={EquityHoldingStatus.FROZEN}>凍結</MenuItem>
                  <MenuItem value={EquityHoldingStatus.TERMINATED}>已終止</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="員工ID"
                name="employeeId"
                variant="outlined"
                value={filters.employeeId || ''}
                onChange={handleFilterChange}
                placeholder="輸入員工ID進行篩選"
              />
            </Grid>
          </Grid>
        </Paper>
      )}

      {holdingsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          獲取持股記錄時發生錯誤
        </Alert>
      )}

      {loadingHoldings && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      )}

      {holdingsData && !loadingHoldings && (
        <>
          <TableContainer>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>員工</TableCell>
                  <TableCell>店鋪</TableCell>
                  <TableCell align="right">股份數量</TableCell>
                  <TableCell>獲取來源</TableCell>
                  <TableCell align="right">獲取價格</TableCell>
                  <TableCell>獲取日期</TableCell>
                  <TableCell>鎖定期結束</TableCell>
                  <TableCell align="right">當前市值</TableCell>
                  <TableCell>狀態</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {holdingsData.holdings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      尚未有持股記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  holdingsData.holdings.map((holding: EmployeeEquityHolding) => (
                    <TableRow key={holding.holdingId}>
                      <TableCell>{holding.employeeName || holding.employeeId}</TableCell>
                      <TableCell>{holding.storeName || holding.storeId}</TableCell>
                      <TableCell align="right">{holding.shares}</TableCell>
                      <TableCell>{getSourceTypeText(holding.sourceType)}</TableCell>
                      <TableCell align="right">
                        {holding.sourceType === EquitySourceType.PURCHASE
                          ? formatCurrency(holding.purchasePrice || 0)
                          : '-'}
                      </TableCell>
                      <TableCell>{new Date(holding.acquiredDate).toLocaleDateString('zh-TW')}</TableCell>
                      <TableCell>{new Date(holding.vestingEndDate).toLocaleDateString('zh-TW')}</TableCell>
                      <TableCell align="right">{formatCurrency(holding.currentValue)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(holding.status)}
                          color={getStatusColor(holding.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="查看詳情">
                          <IconButton
                            size="small"
                            onClick={() => setSelectedHolding(holding)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
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

      {/* 新增持股記錄對話框 */}
      <Dialog
        open={showCreateDialog}
        onClose={handleCreateDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>新增持股記錄</DialogTitle>
        <Formik
          initialValues={{
            employeeId: '',
            employeeName: '',
            storeId: stores && stores.length > 0 ? stores[0].storeId : '',
            equityType: EquityType.PHANTOM,
            shares: 1,
            sourceType: EquitySourceType.PERFORMANCE,
            purchasePrice: undefined,
            totalInvestment: undefined,
            vestingStartDate: new Date().toISOString().split('T')[0], // 今天
            vestingEndDate: getDefaultVestingEndDate(new Date().toISOString().split('T')[0]), // 一年後
            acquiredDate: new Date().toISOString().split('T')[0] // 今天
          }}
          validationSchema={createHoldingSchema}
          onSubmit={handleCreateHolding}
        >
          {({ values, errors, touched, handleChange, setFieldValue }) => (
            <Form>
              <DialogContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      id="employee-search"
                      options={employees || []}
                      getOptionLabel={(option: Employee) => 
                        `${option.firstName} ${option.lastName} (${option.employeeId})`
                      }
                      loading={loadingEmployees}
                      onInputChange={(_event, value) => debouncedEmployeeSearch(value)}
                      onChange={(_event, value) => {
                        if (value) {
                          setFieldValue('employeeId', value.employeeId);
                          setFieldValue('employeeName', `${value.firstName} ${value.lastName}`);
                        } else {
                          setFieldValue('employeeId', '');
                          setFieldValue('employeeName', '');
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="選擇員工"
                          variant="outlined"
                          error={touched.employeeId && Boolean(errors.employeeId)}
                          helperText={touched.employeeId && errors.employeeId}
                          placeholder="輸入姓名或ID進行搜尋"
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={touched.storeId && Boolean(errors.storeId)}>
                      <InputLabel id="store-select-label">店鋪</InputLabel>
                      <Select
                        labelId="store-select-label"
                        name="storeId"
                        value={values.storeId}
                        onChange={handleChange}
                        label="店鋪"
                      >
                        {stores?.map((store) => (
                          <MenuItem key={store.storeId} value={store.storeId}>
                            {store.storeName}
                          </MenuItem>
                        ))}
                      </Select>
                      {touched.storeId && errors.storeId && (
                        <FormHelperText>{errors.storeId}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={touched.equityType && Boolean(errors.equityType)}>
                      <InputLabel id="equity-type-label">股權類型</InputLabel>
                      <Select
                        labelId="equity-type-label"
                        name="equityType"
                        value={values.equityType}
                        onChange={handleChange}
                        label="股權類型"
                      >
                        <MenuItem value={EquityType.PHANTOM}>虛擬股（僅享有分紅權）</MenuItem>
                        <MenuItem value={EquityType.REAL}>實股（Class B 無表決權股）</MenuItem>
                      </Select>
                      {touched.equityType && errors.equityType && (
                        <FormHelperText>{errors.equityType}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="shares"
                      label="股份數量"
                      type="number"
                      InputProps={{ inputProps: { min: 1 } }}
                      value={values.shares}
                      onChange={handleChange}
                      error={touched.shares && Boolean(errors.shares)}
                      helperText={touched.shares && errors.shares}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={touched.sourceType && Boolean(errors.sourceType)}>
                      <InputLabel id="source-type-label">獲取來源</InputLabel>
                      <Select
                        labelId="source-type-label"
                        name="sourceType"
                        value={values.sourceType}
                        onChange={handleChange}
                        label="獲取來源"
                      >
                        <MenuItem value={EquitySourceType.PERFORMANCE}>績效獎勵</MenuItem>
                        <MenuItem value={EquitySourceType.PURCHASE}>現金認購</MenuItem>
                      </Select>
                      {touched.sourceType && errors.sourceType && (
                        <FormHelperText>{errors.sourceType}</FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                  {values.sourceType === EquitySourceType.PURCHASE && (
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        name="purchasePrice"
                        label="認購價格 ($)"
                        type="number"
                        InputProps={{ inputProps: { min: 0.01, step: 0.01 } }}
                        value={values.purchasePrice || ''}
                        onChange={handleChange}
                        error={touched.purchasePrice && Boolean(errors.purchasePrice)}
                        helperText={touched.purchasePrice && errors.purchasePrice}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="acquiredDate"
                      label="獲取日期"
                      type="date"
                      value={values.acquiredDate}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      error={touched.acquiredDate && Boolean(errors.acquiredDate)}
                      helperText={touched.acquiredDate && errors.acquiredDate}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="vestingStartDate"
                      label="鎖定期開始日期"
                      type="date"
                      value={values.vestingStartDate}
                      onChange={(e) => {
                        handleChange(e);
                        // 更新鎖定期結束日期為一年後
                        setFieldValue('vestingEndDate', getDefaultVestingEndDate(e.target.value));
                      }}
                      InputLabelProps={{ shrink: true }}
                      error={touched.vestingStartDate && Boolean(errors.vestingStartDate)}
                      helperText={touched.vestingStartDate && errors.vestingStartDate}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      name="vestingEndDate"
                      label="鎖定期結束日期"
                      type="date"
                      value={values.vestingEndDate}
                      onChange={handleChange}
                      InputLabelProps={{ shrink: true }}
                      error={touched.vestingEndDate && Boolean(errors.vestingEndDate)}
                      helperText={touched.vestingEndDate && errors.vestingEndDate}
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
                  {creating ? '創建中...' : '創建持股記錄'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </Paper>
  );
};

export default HoldingsListPage; 