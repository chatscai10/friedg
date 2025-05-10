import React, { useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon, Add as AddIcon } from '@mui/icons-material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';

import equityService from '../../services/equityService';
import storeService from '../../services/storeService';
import { StoreEquityPool, UpdatePoolRequest, EquityType } from '../../types/equity.types';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { hasPermission } from '../../utils/permissionUtils';

// 驗證 Schema
const validationSchema = Yup.object({
  poolShares: Yup.number()
    .required('預留股份數量為必填')
    .min(1, '預留股份數量至少為1')
    .max(50, '預留股份數量最多為50'),
  maxEmployeePercentage: Yup.number()
    .required('員工持股上限百分比為必填')
    .min(1, '員工持股上限百分比至少為1%')
    .max(20, '員工持股上限百分比最多為20%'),
  maxTotalEmployeePercentage: Yup.number()
    .required('全體員工持股上限為必填')
    .min(10, '全體員工持股上限至少為10%')
    .max(80, '全體員工持股上限最多為80%'),
  purchaseWindowOpen: Yup.boolean()
});

// 初始化股權池表單驗證
const initializePoolSchema = Yup.object({
  totalShares: Yup.number()
    .required('總股數為必填')
    .min(100, '總股數至少為100')
    .max(10000, '總股數最多為10000'),
  poolShares: Yup.number()
    .required('預留股份數量為必填')
    .min(10, '預留股份數量至少為10')
    .max(Yup.ref('totalShares'), '預留股份不能超過總股數'),
  initialSharePrice: Yup.number()
    .required('初始股價為必填')
    .min(1, '初始股價至少為$1')
    .max(10000, '初始股價最多為$10000'),
  equityType: Yup.string()
    .required('股權類型為必填')
    .oneOf(Object.values(EquityType), '請選擇有效的股權類型')
});

const EquityPoolsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [showInitializeDialog, setShowInitializeDialog] = useState<boolean>(false);
  const [hasPermissionToManagePool, setHasPermissionToManagePool] = useState<boolean>(false);

  // 檢查權限
  React.useEffect(() => {
    const checkPermission = async () => {
      const canManagePool = await hasPermission('equity:manage_pool');
      setHasPermissionToManagePool(canManagePool);
    };
    checkPermission();
  }, []);

  // 獲取店鋪列表
  const { data: stores, isLoading: loadingStores } = useQuery(
    'stores',
    () => storeService.getStores(),
    {
      onSuccess: (data) => {
        if (data.length > 0 && !selectedStoreId) {
          setSelectedStoreId(data[0].storeId);
        }
      }
    }
  );

  // 獲取股權池資訊
  const {
    data: poolData,
    isLoading: loadingPool,
    error: poolError,
    refetch
  } = useQuery(
    ['equityPool', selectedStoreId],
    () => equityService.getEquityPool(selectedStoreId),
    {
      enabled: !!selectedStoreId,
      onError: (error) => {
        console.error('Error fetching equity pool:', error);
      }
    }
  );

  // 更新股權池設定
  const { mutate: updatePool, isLoading: updating } = useMutation(
    (data: UpdatePoolRequest) => equityService.updateEquityPool(selectedStoreId, data),
    {
      onSuccess: () => {
        setShowDialog(false);
        queryClient.invalidateQueries(['equityPool', selectedStoreId]);
      },
      onError: (error) => {
        console.error('Error updating equity pool:', error);
      }
    }
  );

  // 初始化股權池
  const { mutate: initializePool, isLoading: initializing } = useMutation(
    (data: { totalShares: number; poolShares: number; initialSharePrice: number; equityType: string }) => 
      equityService.initializePool(selectedStoreId, data),
    {
      onSuccess: () => {
        setShowInitializeDialog(false);
        queryClient.invalidateQueries(['equityPool', selectedStoreId]);
      },
      onError: (error) => {
        console.error('Error initializing equity pool:', error);
      }
    }
  );

  if (loadingStores) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const handleStoreChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedStoreId(event.target.value as string);
  };

  const handleEditDialogOpen = () => {
    setShowDialog(true);
  };

  const handleEditDialogClose = () => {
    setShowDialog(false);
  };

  const handleInitializeDialogOpen = () => {
    setShowInitializeDialog(true);
  };

  const handleInitializeDialogClose = () => {
    setShowInitializeDialog(false);
  };

  const handleSubmit = (values: Partial<StoreEquityPool>) => {
    const updateData: UpdatePoolRequest = {
      poolShares: values.poolShares,
      maxEmployeePercentage: values.maxEmployeePercentage,
      maxTotalEmployeePercentage: values.maxTotalEmployeePercentage,
      purchaseWindowOpen: values.purchaseWindowOpen
    };

    updatePool(updateData);
  };

  const handleInitializeSubmit = (values: { totalShares: number; poolShares: number; initialSharePrice: number; equityType: string }) => {
    initializePool(values);
  };

  const poolNotFound = poolError && (poolError as any)?.response?.status === 404;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          股權池管理
        </Typography>

        <FormControl variant="outlined" sx={{ minWidth: 200 }}>
          <InputLabel id="store-select-label">選擇店鋪</InputLabel>
          <Select
            labelId="store-select-label"
            label="選擇店鋪"
            value={selectedStoreId}
            onChange={handleStoreChange}
          >
            {stores?.map((store) => (
              <MenuItem key={store.storeId} value={store.storeId}>
                {store.storeName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {!selectedStoreId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          請選擇一個店鋪來查看其股權池狀態
        </Alert>
      )}

      {poolNotFound && hasPermissionToManagePool && (
        <Box textAlign="center" my={4}>
          <Alert severity="info" sx={{ mb: 3 }}>
            尚未為此店鋪初始化股權池。初始化後才能開始進行股權管理。
          </Alert>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleInitializeDialogOpen}
            disabled={initializing}
          >
            {initializing ? '處理中...' : '初始化股權池'}
          </Button>
        </Box>
      )}

      {poolError && !poolNotFound && (
        <Alert severity="error" sx={{ mb: 2 }}>
          獲取股權池資訊時發生錯誤。
        </Alert>
      )}

      {loadingPool && selectedStoreId && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      )}

      {poolData && !loadingPool && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
              onClick={handleEditDialogOpen}
              disabled={updating}
            >
              編輯設定
            </Button>
          </Box>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                基本資訊
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  店鋪ID
                </Typography>
                <Typography variant="body1">{poolData.storeId}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  股權類型
                </Typography>
                <Typography variant="body1">
                  {poolData.equityType === 'phantom' ? '虛擬股（僅享有分紅權）' : '實股（Class B 無表決權股）'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  總股數
                </Typography>
                <Typography variant="body1">{poolData.totalShares} 股</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  當前每股價格
                </Typography>
                <Typography variant="body1">{formatCurrency(poolData.currentSharePrice)}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  當前店鋪估值
                </Typography>
                <Typography variant="body1">{formatCurrency(poolData.currentValuation)}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  最後估值日期
                </Typography>
                <Typography variant="body1">{poolData.lastValuationDate ? new Date(poolData.lastValuationDate).toLocaleDateString('zh-TW') : '尚未估值'}</Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                股份分配
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  預留股份總數
                </Typography>
                <Typography variant="body1">{poolData.poolShares} 股 ({(poolData.poolShares / poolData.totalShares * 100).toFixed(1)}%)</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  池中剩餘可分配股份
                </Typography>
                <Typography variant="body1">{poolData.remainingPoolShares} 股</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  已分配股份數
                </Typography>
                <Typography variant="body1">{poolData.allocatedShares} 股 ({(poolData.allocatedShares / poolData.totalShares * 100).toFixed(1)}%)</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  員工持股上限百分比
                </Typography>
                <Typography variant="body1">{formatPercent(poolData.maxEmployeePercentage / 100)}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  全體員工持股上限
                </Typography>
                <Typography variant="body1">{formatPercent(poolData.maxTotalEmployeePercentage / 100)}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  購股窗口狀態
                </Typography>
                <Typography variant="body1">{poolData.purchaseWindowOpen ? '開放中' : '關閉中'}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  回購儲備餘額
                </Typography>
                <Typography variant="body1">{formatCurrency(poolData.buybackReserveBalance)}</Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* 編輯股權池設定對話框 */}
      <Dialog open={showDialog} onClose={handleEditDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>編輯股權池設定</DialogTitle>
        <Formik
          initialValues={{
            poolShares: poolData?.poolShares || 0,
            maxEmployeePercentage: poolData?.maxEmployeePercentage || 0,
            maxTotalEmployeePercentage: poolData?.maxTotalEmployeePercentage || 0,
            purchaseWindowOpen: poolData?.purchaseWindowOpen || false
          }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ values, errors, touched, handleChange, setFieldValue }) => (
            <Form>
              <DialogContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="poolShares"
                      label="預留股份數量"
                      type="number"
                      value={values.poolShares}
                      onChange={handleChange}
                      error={touched.poolShares && Boolean(errors.poolShares)}
                      helperText={touched.poolShares && errors.poolShares}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="maxEmployeePercentage"
                      label="員工持股上限百分比 (%)"
                      type="number"
                      value={values.maxEmployeePercentage}
                      onChange={handleChange}
                      error={touched.maxEmployeePercentage && Boolean(errors.maxEmployeePercentage)}
                      helperText={touched.maxEmployeePercentage && errors.maxEmployeePercentage}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="maxTotalEmployeePercentage"
                      label="全體員工持股上限 (%)"
                      type="number"
                      value={values.maxTotalEmployeePercentage}
                      onChange={handleChange}
                      error={touched.maxTotalEmployeePercentage && Boolean(errors.maxTotalEmployeePercentage)}
                      helperText={touched.maxTotalEmployeePercentage && errors.maxTotalEmployeePercentage}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={values.purchaseWindowOpen}
                          onChange={(e) => setFieldValue('purchaseWindowOpen', e.target.checked)}
                          name="purchaseWindowOpen"
                          color="primary"
                        />
                      }
                      label="開放購股窗口"
                    />
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleEditDialogClose} startIcon={<CancelIcon />}>
                  取消
                </Button>
                <Button 
                  type="submit" 
                  color="primary" 
                  startIcon={<SaveIcon />}
                  disabled={updating}
                >
                  {updating ? '儲存中...' : '儲存'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      {/* 初始化股權池對話框 */}
      <Dialog open={showInitializeDialog} onClose={handleInitializeDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>初始化股權池</DialogTitle>
        <Formik
          initialValues={{
            totalShares: 100,
            poolShares: 20,
            initialSharePrice: 100,
            equityType: EquityType.PHANTOM
          }}
          validationSchema={initializePoolSchema}
          onSubmit={handleInitializeSubmit}
        >
          {({ values, errors, touched, handleChange, setFieldValue }) => (
            <Form>
              <DialogContent>
                <Typography variant="body2" color="textSecondary" paragraph>
                  初始化店鋪的股權池後，您將能夠開始進行股權分配和管理。此操作只能執行一次。
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="totalShares"
                      label="總股數"
                      type="number"
                      value={values.totalShares}
                      onChange={handleChange}
                      error={touched.totalShares && Boolean(errors.totalShares)}
                      helperText={touched.totalShares && errors.totalShares}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="poolShares"
                      label="預留股份數量"
                      type="number"
                      value={values.poolShares}
                      onChange={handleChange}
                      error={touched.poolShares && Boolean(errors.poolShares)}
                      helperText={touched.poolShares && errors.poolShares}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      name="initialSharePrice"
                      label="初始股價 ($)"
                      type="number"
                      value={values.initialSharePrice}
                      onChange={handleChange}
                      error={touched.initialSharePrice && Boolean(errors.initialSharePrice)}
                      helperText={touched.initialSharePrice && errors.initialSharePrice}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
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
                    </FormControl>
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleInitializeDialogClose} startIcon={<CancelIcon />}>
                  取消
                </Button>
                <Button 
                  type="submit" 
                  color="primary" 
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={initializing}
                >
                  {initializing ? '初始化中...' : '初始化'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </Paper>
  );
};

export default EquityPoolsPage; 