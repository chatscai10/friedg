import React, { useState } from 'react';
import { Formik, Form, Field, FieldProps, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import {
  Box,
  TextField,
  Typography,
  Button,
  Grid,
  FormControlLabel,
  Switch,
  InputAdornment,
  CircularProgress,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText
} from '@mui/material';
import { 
  createInventoryItem, 
  updateInventoryItem 
} from '../../../services/inventoryService';
import { 
  InventoryItem, 
  CreateInventoryItemRequest, 
  UpdateInventoryItemRequest 
} from '../../../types/inventory.types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// 表單屬性接口
interface InventoryItemFormProps {
  inventoryItem?: InventoryItem | null; // 如果提供，則為編輯模式
  onCancel: () => void;
  onSubmit: (item: InventoryItem) => void;
}

// 表單值接口
interface InventoryItemFormValues {
  name: string;
  description: string;
  category: string;
  unit: string;
  supplierInfo: {
    supplierName: string;
    supplierContactInfo: string;
    defaultOrderQuantity: number | '';
    leadTime: number | '';
  };
  lowStockThreshold: number | '';
  barcode: string;
  sku: string;
  isActive: boolean;
  costPerUnit: number | '';
}

// 庫存品項表單組件
const InventoryItemForm: React.FC<InventoryItemFormProps> = ({ 
  inventoryItem, 
  onCancel, 
  onSubmit 
}) => {
  // 判斷是否為編輯模式
  const isEditMode = !!inventoryItem;
  
  // 初始表單數據
  const initialValues: InventoryItemFormValues = {
    name: inventoryItem?.name || '',
    description: inventoryItem?.description || '',
    category: inventoryItem?.category || '',
    unit: inventoryItem?.unit || '',
    supplierInfo: {
      supplierName: inventoryItem?.supplierInfo?.supplierName || '',
      supplierContactInfo: inventoryItem?.supplierInfo?.supplierContactInfo || '',
      defaultOrderQuantity: inventoryItem?.supplierInfo?.defaultOrderQuantity !== undefined 
        ? inventoryItem.supplierInfo.defaultOrderQuantity 
        : '',
      leadTime: inventoryItem?.supplierInfo?.leadTime !== undefined 
        ? inventoryItem.supplierInfo.leadTime 
        : ''
    },
    lowStockThreshold: inventoryItem?.lowStockThreshold !== undefined 
      ? inventoryItem.lowStockThreshold 
      : '',
    barcode: inventoryItem?.barcode || '',
    sku: inventoryItem?.sku || '',
    isActive: inventoryItem?.isActive !== undefined ? inventoryItem.isActive : true,
    costPerUnit: inventoryItem?.costPerUnit !== undefined ? inventoryItem.costPerUnit : ''
  };
  
  // React Query 客戶端
  const queryClient = useQueryClient();
  
  // 錯誤狀態管理
  const [error, setError] = useState<string | null>(null);
  
  // 預定義的品項分類選項
  const categoryOptions = [
    '原料',
    '包材',
    '餐具',
    '調味料',
    '清潔用品',
    '其他'
  ];
  
  // 預定義的計量單位選項
  const unitOptions = [
    '個',
    '公斤',
    '公升',
    '包',
    '箱',
    '盒',
    '袋',
    '卷',
    '打'
  ];
  
  // 表單驗證 Schema
  const validationSchema = Yup.object({
    name: Yup.string()
      .required('品項名稱為必填欄位')
      .max(100, '品項名稱不得超過100個字符'),
    category: Yup.string()
      .required('品項分類為必填欄位'),
    unit: Yup.string()
      .required('計量單位為必填欄位'),
    description: Yup.string()
      .max(500, '描述不得超過500個字符'),
    supplierInfo: Yup.object({
      supplierName: Yup.string()
        .max(100, '供應商名稱不得超過100個字符'),
      supplierContactInfo: Yup.string()
        .max(500, '供應商聯絡資訊不得超過500個字符'),
      defaultOrderQuantity: Yup.number()
        .positive('預設訂購數量必須為正數')
        .nullable()
        .transform((value) => (isNaN(value) || value === '' ? null : value)),
      leadTime: Yup.number()
        .positive('供貨前置時間必須為正數')
        .nullable()
        .transform((value) => (isNaN(value) || value === '' ? null : value))
    }),
    lowStockThreshold: Yup.number()
      .positive('低庫存閾值必須為正數')
      .nullable()
      .transform((value) => (isNaN(value) || value === '' ? null : value)),
    barcode: Yup.string()
      .max(100, '條碼不得超過100個字符'),
    sku: Yup.string()
      .max(100, 'SKU不得超過100個字符'),
    costPerUnit: Yup.number()
      .min(0, '單位成本不能為負數')
      .nullable()
      .transform((value) => (isNaN(value) || value === '' ? null : value))
  });
  
  // 創建品項的 mutation
  const createMutation = useMutation({
    mutationFn: (values: CreateInventoryItemRequest) => createInventoryItem(values),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      onSubmit(result);
    },
    onError: (err: unknown) => {
      console.error('創建庫存品項失敗:', err);
      setError(err instanceof Error ? err.message : '創建庫存品項時發生錯誤');
    }
  });
  
  // 更新品項的 mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateInventoryItemRequest }) => 
      updateInventoryItem(id, values),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      onSubmit(result);
    },
    onError: (err: unknown) => {
      console.error('更新庫存品項失敗:', err);
      setError(err instanceof Error ? err.message : '更新庫存品項時發生錯誤');
    }
  });
  
  // 處理表單提交
  const handleSubmit = async (
    values: InventoryItemFormValues,
    { setSubmitting }: FormikHelpers<InventoryItemFormValues>
  ) => {
    try {
      setError(null);
      
      // 準備提交的數據
      const submitData: CreateInventoryItemRequest | UpdateInventoryItemRequest = {
        name: values.name,
        description: values.description || undefined,
        category: values.category,
        unit: values.unit,
        supplierInfo: {
          supplierName: values.supplierInfo.supplierName || undefined,
          supplierContactInfo: values.supplierInfo.supplierContactInfo || undefined,
          defaultOrderQuantity: 
            values.supplierInfo.defaultOrderQuantity !== '' 
              ? Number(values.supplierInfo.defaultOrderQuantity) 
              : undefined,
          leadTime: 
            values.supplierInfo.leadTime !== '' 
              ? Number(values.supplierInfo.leadTime) 
              : undefined
        },
        lowStockThreshold: values.lowStockThreshold !== '' ? Number(values.lowStockThreshold) : undefined,
        barcode: values.barcode || undefined,
        sku: values.sku || undefined,
        isActive: values.isActive,
        costPerUnit: values.costPerUnit !== '' ? Number(values.costPerUnit) : undefined
      };
      
      // 如果供應商資訊完全為空，則不提交
      if (!submitData.supplierInfo?.supplierName && 
          !submitData.supplierInfo?.supplierContactInfo && 
          submitData.supplierInfo?.defaultOrderQuantity === undefined && 
          submitData.supplierInfo?.leadTime === undefined) {
        delete submitData.supplierInfo;
      }
      
      // 根據模式執行創建或更新
      if (isEditMode && inventoryItem) {
        updateMutation.mutate({ id: inventoryItem.itemId, values: submitData });
      } else {
        createMutation.mutate(submitData as CreateInventoryItemRequest);
      }
    } catch (err: unknown) {
      console.error(`${isEditMode ? '更新' : '創建'}庫存品項失敗:`, err);
      setError(err instanceof Error ? err.message : `${isEditMode ? '更新' : '創建'}庫存品項時發生錯誤`);
      setSubmitting(false);
    }
  };
  
  // 合併 mutation 的 loading 狀態
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  
  return (
    <Box>
      {/* 錯誤提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ isValid, dirty }) => (
          <Form>
            <Grid container spacing={2}>
              {/* 基本資訊區塊 */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  基本資訊
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>
              
              {/* 品項名稱 */}
              <Grid item xs={12} sm={6}>
                <Field name="name">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      required
                      fullWidth
                      label="品項名稱"
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={meta.touched && meta.error ? meta.error : ''}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 品項分類 */}
              <Grid item xs={12} sm={6}>
                <Field name="category">
                  {({ field, meta }: FieldProps) => (
                    <FormControl 
                      fullWidth 
                      required 
                      error={meta.touched && !!meta.error}
                    >
                      <InputLabel>品項分類</InputLabel>
                      <Select
                        {...field}
                        label="品項分類"
                      >
                        {categoryOptions.map(option => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                      {meta.touched && meta.error && (
                        <FormHelperText>{meta.error}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                </Field>
              </Grid>
              
              {/* 計量單位 */}
              <Grid item xs={12} sm={6}>
                <Field name="unit">
                  {({ field, meta }: FieldProps) => (
                    <FormControl 
                      fullWidth 
                      required 
                      error={meta.touched && !!meta.error}
                    >
                      <InputLabel>計量單位</InputLabel>
                      <Select
                        {...field}
                        label="計量單位"
                      >
                        {unitOptions.map(option => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                      {meta.touched && meta.error && (
                        <FormHelperText>{meta.error}</FormHelperText>
                      )}
                    </FormControl>
                  )}
                </Field>
              </Grid>
              
              {/* 庫存單位 (SKU) */}
              <Grid item xs={12} sm={6}>
                <Field name="sku">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      fullWidth
                      label="庫存單位 (SKU)"
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={meta.touched && meta.error ? meta.error : ''}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 條碼 */}
              <Grid item xs={12} sm={6}>
                <Field name="barcode">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      fullWidth
                      label="條碼"
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={meta.touched && meta.error ? meta.error : ''}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 單位成本 */}
              <Grid item xs={12} sm={6}>
                <Field name="costPerUnit">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      fullWidth
                      label="單位成本"
                      type="number"
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={meta.touched && meta.error ? meta.error : ''}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 低庫存閾值 */}
              <Grid item xs={12} sm={6}>
                <Field name="lowStockThreshold">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      fullWidth
                      label="低庫存閾值"
                      type="number"
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={(meta.touched && meta.error) ? meta.error : '當庫存低於此值時會發出警告'}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 品項描述 */}
              <Grid item xs={12}>
                <Field name="description">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      fullWidth
                      label="品項描述"
                      multiline
                      rows={3}
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={meta.touched && meta.error ? meta.error : ''}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 啟用狀態 */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Field name="isActive">
                      {({ field }: FieldProps) => (
                        <Switch
                          {...field}
                          checked={field.value}
                          color="primary"
                        />
                      )}
                    </Field>
                  }
                  label="啟用此品項"
                />
              </Grid>
              
              {/* 供應商資訊區塊 */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  供應商資訊 (選填)
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>
              
              {/* 供應商名稱 */}
              <Grid item xs={12} sm={6}>
                <Field name="supplierInfo.supplierName">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      fullWidth
                      label="供應商名稱"
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={meta.touched && meta.error ? meta.error : ''}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 供應商聯絡資訊 */}
              <Grid item xs={12} sm={6}>
                <Field name="supplierInfo.supplierContactInfo">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      fullWidth
                      label="供應商聯絡資訊"
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={meta.touched && meta.error ? meta.error : ''}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 預設訂購數量 */}
              <Grid item xs={12} sm={6}>
                <Field name="supplierInfo.defaultOrderQuantity">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      fullWidth
                      label="預設訂購數量"
                      type="number"
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={meta.touched && meta.error ? meta.error : ''}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 供貨前置時間 */}
              <Grid item xs={12} sm={6}>
                <Field name="supplierInfo.leadTime">
                  {({ field, meta }: FieldProps) => (
                    <TextField
                      fullWidth
                      label="供貨前置時間 (天)"
                      type="number"
                      {...field}
                      error={meta.touched && !!meta.error}
                      helperText={meta.touched && meta.error ? meta.error : ''}
                    />
                  )}
                </Field>
              </Grid>
              
              {/* 按鈕區塊 */}
              <Grid item xs={12} sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  sx={{ mr: 1 }}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={!isValid || !dirty || isSubmitting}
                  startIcon={isSubmitting ? <CircularProgress size={24} /> : null}
                >
                  {isEditMode ? '更新' : '創建'}
                </Button>
              </Grid>
            </Grid>
          </Form>
        )}
      </Formik>
    </Box>
  );
};

export default InventoryItemForm; 