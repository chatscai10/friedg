import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  TextField,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Autocomplete,
  CircularProgress
} from '@mui/material';
import { Formik, Form, Field, FormikProps } from 'formik';
import * as Yup from 'yup';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';

import { 
  StockAdjustmentType, 
  CreateStockAdjustmentRequest,
  InventoryItem
} from '../../../types/inventory.types';
import { createStockAdjustment, getInventoryItems } from '../../../services/inventoryService';
import { getStores } from '../../../services/storeService';

// 表單Props定義
interface StockAdjustmentFormProps {
  onSubmit: () => void;  // 成功提交後的回調
  onCancel: () => void;  // 取消表單的回調
}

// 表單初始值
const initialValues: CreateStockAdjustmentRequest & { selectedItem: InventoryItem | null } = {
  itemId: '',
  storeId: '',
  adjustmentType: StockAdjustmentType.RECEIPT,  // 預設為入庫
  quantityAdjusted: 0,
  reason: '',
  selectedItem: null  // 用於Autocomplete，不會傳送到API
};

// 表單元件
const StockAdjustmentForm: React.FC<StockAdjustmentFormProps> = ({ onSubmit, onCancel }) => {
  // 用於搜尋品項的狀態
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAdjustmentType, setSelectedAdjustmentType] = useState<StockAdjustmentType>(StockAdjustmentType.RECEIPT);
  
  // 獲取QueryClient以便在提交成功後重新加載列表數據
  const queryClient = useQueryClient();
  
  // 使用React Query獲取分店列表
  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores(),
    staleTime: 5 * 60 * 1000  // 5分鐘內不重新獲取
  });
  
  // 使用React Query搜尋品項
  const itemsQuery = useQuery({
    queryKey: ['inventoryItems', { name: searchQuery }],
    queryFn: () => getInventoryItems({ name: searchQuery, page: 1, pageSize: 10 }),
    enabled: searchQuery.length > 1, // 只有當輸入至少2個字符時才觸發查詢
    staleTime: 30 * 1000  // 30秒內不重新獲取
  });
  
  // 用於創建庫存調整的mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateStockAdjustmentRequest) => createStockAdjustment(data),
    onSuccess: () => {
      // 成功後重新加載庫存調整列表
      queryClient.invalidateQueries({ queryKey: ['stockAdjustments'] });
      onSubmit(); // 調用父組件提供的回調函數
    }
  });
  
  // 防抖處理搜尋輸入，避免過多請求
  const debouncedSearch = useMemo(
    () => debounce((text: string) => {
      setSearchQuery(text);
    }, 500),
    []
  );

  // 清理debounce函數
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);
  
  // 處理調整類型變更
  const handleAdjustmentTypeChange = (
    setFieldValue: FormikProps<typeof initialValues>['setFieldValue'],
    value: StockAdjustmentType
  ) => {
    setSelectedAdjustmentType(value);
    setFieldValue('adjustmentType', value);
  };
  
  // 根據調整類型生成不同的數量驗證架構
  const getQuantityValidationSchema = (adjustmentType: StockAdjustmentType) => {
    switch(adjustmentType) {
      case StockAdjustmentType.RECEIPT:
      case StockAdjustmentType.STOCK_COUNT:
        // 入庫和盤點調整可以是正數或負數（增加或減少庫存）
        return Yup.number()
          .required('調整數量為必填')
          .not([0], '調整數量不能為零');
      case StockAdjustmentType.ISSUE:
      case StockAdjustmentType.DAMAGE:
        // 出庫和損壞通常是減少庫存，所以應該是負數
        // 但允許用戶輸入正數，提交時自動轉換為負數
        return Yup.number()
          .required('調整數量為必填')
          .not([0], '調整數量不能為零');
      case StockAdjustmentType.TRANSFER:
        // 移撥：需要確保有轉入店鋪（這個邏輯較複雜，可能需要額外欄位）
        return Yup.number()
          .required('調整數量為必填')
          .not([0], '調整數量不能為零');
      default:
        return Yup.number()
          .required('調整數量為必填')
          .not([0], '調整數量不能為零');
    }
  };
  
  // 創建驗證架構
  const validationSchema = Yup.object({
    itemId: Yup.string().required('品項為必填'),
    storeId: Yup.string().required('分店為必填'),
    adjustmentType: Yup.string().required('調整類型為必填'),
    quantityAdjusted: getQuantityValidationSchema(selectedAdjustmentType),
    reason: Yup.string().max(200, '原因不能超過200個字符')
  });
  
  // 處理表單提交
  const handleSubmit = (values: typeof initialValues) => {
    // 提取提交數據，忽略 selectedItem
    const submitData: CreateStockAdjustmentRequest = {
      itemId: values.itemId,
      storeId: values.storeId,
      adjustmentType: values.adjustmentType,
      quantityAdjusted: values.quantityAdjusted,
      reason: values.reason
    };
    
    // 根據調整類型自動轉換數量的正負值
    if ((values.adjustmentType === StockAdjustmentType.ISSUE || 
         values.adjustmentType === StockAdjustmentType.DAMAGE) && 
         submitData.quantityAdjusted > 0) {
      submitData.quantityAdjusted = -submitData.quantityAdjusted;
    }
    
    createMutation.mutate(submitData);
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ errors, touched, values, setFieldValue, isSubmitting }) => (
        <Form>
          <Box sx={{ p: 2 }}>
            <Grid container spacing={3}>
              {/* 品項選擇器 */}
              <Grid item xs={12}>
                <Autocomplete
                  id="itemId"
                  options={itemsQuery.data?.data || []}
                  getOptionLabel={(option: InventoryItem) => `${option.name} (${option.sku || option.itemId})`}
                  loading={itemsQuery.isLoading}
                  value={values.selectedItem}
                  onChange={(_, newValue) => {
                    setFieldValue('selectedItem', newValue);
                    setFieldValue('itemId', newValue?.itemId || '');
                  }}
                  onInputChange={(_, newInputValue) => {
                    debouncedSearch(newInputValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="品項"
                      error={touched.itemId && Boolean(errors.itemId)}
                      helperText={touched.itemId && errors.itemId}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {itemsQuery.isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  noOptionsText="無符合項目，請輸入關鍵字搜尋"
                  loadingText="搜尋中..."
                />
              </Grid>
              
              {/* 分店選擇器 */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={touched.storeId && Boolean(errors.storeId)}>
                  <InputLabel id="store-select-label">分店</InputLabel>
                  <Field
                    as={Select}
                    labelId="store-select-label"
                    id="storeId"
                    name="storeId"
                    label="分店"
                  >
                    <MenuItem value="" disabled>
                      請選擇分店
                    </MenuItem>
                    {storesQuery.isLoading ? (
                      <MenuItem disabled>載入中...</MenuItem>
                    ) : storesQuery.data?.data ? (
                      storesQuery.data.data.map((store) => (
                        <MenuItem key={store.id} value={store.id}>
                          {store.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>無分店資料</MenuItem>
                    )}
                  </Field>
                  {touched.storeId && errors.storeId && (
                    <FormHelperText>{errors.storeId}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
              
              {/* 調整類型選擇器 */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={touched.adjustmentType && Boolean(errors.adjustmentType)}>
                  <InputLabel id="adjustment-type-label">調整類型</InputLabel>
                  <Select
                    labelId="adjustment-type-label"
                    id="adjustmentType"
                    name="adjustmentType"
                    value={values.adjustmentType}
                    label="調整類型"
                    onChange={(e) => handleAdjustmentTypeChange(
                      setFieldValue, 
                      e.target.value as StockAdjustmentType
                    )}
                  >
                    <MenuItem value={StockAdjustmentType.RECEIPT}>入庫</MenuItem>
                    <MenuItem value={StockAdjustmentType.ISSUE}>出庫</MenuItem>
                    <MenuItem value={StockAdjustmentType.STOCK_COUNT}>盤點調整</MenuItem>
                    <MenuItem value={StockAdjustmentType.DAMAGE}>損壞報廢</MenuItem>
                    <MenuItem value={StockAdjustmentType.TRANSFER}>移撥</MenuItem>
                    <MenuItem value={StockAdjustmentType.OTHER}>其他</MenuItem>
                  </Select>
                  {touched.adjustmentType && errors.adjustmentType && (
                    <FormHelperText>{errors.adjustmentType}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
              
              {/* 調整數量 */}
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  fullWidth
                  id="quantityAdjusted"
                  name="quantityAdjusted"
                  label="調整數量"
                  type="number"
                  error={touched.quantityAdjusted && Boolean(errors.quantityAdjusted)}
                  helperText={
                    (touched.quantityAdjusted && errors.quantityAdjusted) ||
                    (values.adjustmentType === StockAdjustmentType.ISSUE || 
                     values.adjustmentType === StockAdjustmentType.DAMAGE 
                     ? '提示：出庫/損壞調整將自動轉換為負數' : '')
                  }
                />
                {(values.adjustmentType === StockAdjustmentType.ISSUE || 
                  values.adjustmentType === StockAdjustmentType.DAMAGE) && 
                  values.quantityAdjusted > 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                    注意：提交時將轉換為 -{values.quantityAdjusted}
                  </Typography>
                )}
              </Grid>
              
              {/* 調整原因 */}
              <Grid item xs={12}>
                <Field
                  as={TextField}
                  fullWidth
                  id="reason"
                  name="reason"
                  label="調整原因 (選填)"
                  multiline
                  rows={2}
                  error={touched.reason && Boolean(errors.reason)}
                  helperText={touched.reason && errors.reason}
                />
              </Grid>
              
              {/* 按鈕區 */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                  <Button
                    color="inherit"
                    onClick={onCancel}
                    disabled={isSubmitting || createMutation.isPending}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting || createMutation.isPending}
                  >
                    {createMutation.isPending ? '提交中...' : '提交'}
                  </Button>
                </Box>
              </Grid>
              
              {/* 錯誤提示 */}
              {createMutation.isError && (
                <Grid item xs={12}>
                  <Typography color="error">
                    提交失敗: {(createMutation.error as Error)?.message || '未知錯誤'}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        </Form>
      )}
    </Formik>
  );
};

export default StockAdjustmentForm; 