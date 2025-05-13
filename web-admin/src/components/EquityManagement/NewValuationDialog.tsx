import React, { useState } from 'react';
import { useMutation } from 'react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormHelperText,
  CircularProgress,
  Alert,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import dayjs, { Dayjs } from 'dayjs';

import equityService from '../../services/equityService';

interface NewValuationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  storeId: string;
}

// 驗證 Schema
const validationSchema = Yup.object({
  effectiveDate: Yup.date()
    .required('生效日期為必填'),
  sharePrice: Yup.number()
    .required('股價為必填')
    .positive('股價必須為正數'),
  averageNetProfit: Yup.number()
    .required('平均稅後淨利為必填')
    .min(0, '平均稅後淨利不能為負數'),
  monthsInCalculation: Yup.number()
    .required('計算月數為必填')
    .min(1, '計算月數至少為1')
    .max(36, '計算月數最多為36個月'),
  multiplier: Yup.number()
    .required('乘數為必填')
    .min(1, '乘數至少為1')
    .max(20, '乘數最多為20'),
  valuationNotes: Yup.string()
    .max(500, '備註不能超過500個字')
});

// 月數選項
const monthOptions = [
  { value: 3, label: '3個月 (首次估值)' },
  { value: 6, label: '6個月 (新店推薦)' },
  { value: 12, label: '12個月 (標準)' },
  { value: 24, label: '24個月 (長期趨勢)' }
];

// 乘數選項
const multiplierOptions = [
  { value: 4, label: '4倍 (標準)' },
  { value: 6, label: '6倍 (高增長)' },
  { value: 8, label: '8倍 (新店估值)' },
  { value: 10, label: '10倍 (特殊情況)' }
];

const NewValuationDialog: React.FC<NewValuationDialogProps> = ({ open, onClose, onSuccess, storeId }) => {
  const [error, setError] = useState<string | null>(null);

  // 創建估值記錄
  const { mutate: createValuation, isLoading } = useMutation(
    (data: any) => equityService.createValuation(storeId, data),
    {
      onSuccess: () => {
        onSuccess();
      },
      onError: (err: any) => {
        console.error('Error creating valuation:', err);
        setError(err.message || '創建估值時發生錯誤。');
      }
    }
  );

  const handleSubmit = (values: any) => {
    setError(null);
    
    // 計算總公司估值
    const totalCompanyValue = values.sharePrice * 100; // 假設總股數為100
    
    const valuationData = {
      effectiveDate: values.effectiveDate.toISOString(),
      sharePrice: Number(values.sharePrice),
      averageNetProfit: Number(values.averageNetProfit),
      monthsInCalculation: Number(values.monthsInCalculation),
      multiplier: Number(values.multiplier),
      valuationNotes: values.valuationNotes,
      totalCompanyValue
    };
    
    createValuation(valuationData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>新增股權估值</DialogTitle>
      <Formik
        initialValues={{
          effectiveDate: dayjs(),
          sharePrice: '',
          averageNetProfit: '',
          monthsInCalculation: 12,
          multiplier: 4,
          valuationNotes: ''
        }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, values, setFieldValue }) => (
          <Form>
            <DialogContent>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <DatePicker
                    label="生效日期"
                    value={values.effectiveDate}
                    onChange={(newValue) => setFieldValue('effectiveDate', newValue)}
                    slotProps={{ 
                      textField: { 
                        fullWidth: true, 
                        variant: 'outlined',
                        error: touched.effectiveDate && Boolean(errors.effectiveDate)
                      } 
                    }}
                  />
                  {touched.effectiveDate && errors.effectiveDate && (
                    <FormHelperText error>{errors.effectiveDate as string}</FormHelperText>
                  )}
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    label="每股價格"
                    name="sharePrice"
                    type="number"
                    error={touched.sharePrice && Boolean(errors.sharePrice)}
                    helperText={touched.sharePrice && errors.sharePrice}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    計算依據
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    label="平均稅後淨利"
                    name="averageNetProfit"
                    type="number"
                    error={touched.averageNetProfit && Boolean(errors.averageNetProfit)}
                    helperText={touched.averageNetProfit && errors.averageNetProfit}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth variant="outlined" error={touched.monthsInCalculation && Boolean(errors.monthsInCalculation)}>
                    <InputLabel>計算月數</InputLabel>
                    <Field
                      as={Select}
                      name="monthsInCalculation"
                      label="計算月數"
                    >
                      {monthOptions.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Field>
                    {touched.monthsInCalculation && errors.monthsInCalculation && (
                      <FormHelperText error>{errors.monthsInCalculation as string}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth variant="outlined" error={touched.multiplier && Boolean(errors.multiplier)}>
                    <InputLabel>乘數</InputLabel>
                    <Field
                      as={Select}
                      name="multiplier"
                      label="乘數"
                    >
                      {multiplierOptions.map(option => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Field>
                    {touched.multiplier && errors.multiplier && (
                      <FormHelperText error>{errors.multiplier as string}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <Field
                    as={TextField}
                    fullWidth
                    variant="outlined"
                    label="估值備註"
                    name="valuationNotes"
                    multiline
                    rows={3}
                    error={touched.valuationNotes && Boolean(errors.valuationNotes)}
                    helperText={touched.valuationNotes && errors.valuationNotes}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Alert severity="info">
                    估值計算公式: 股價 = (平均稅後淨利 / 計算月數 * 12) * 乘數 / 100股
                  </Alert>
                </Grid>
                
                {values.sharePrice && values.averageNetProfit && (
                  <Grid item xs={12}>
                    <Alert severity="success">
                      總公司估值: ${(Number(values.sharePrice) * 100).toLocaleString()}
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={onClose} color="inherit">
                取消
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : '創建估值'}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default NewValuationDialog; 