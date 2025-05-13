import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';

import equityService from '../../services/equityService';
import storeService from '../../services/storeService';
import { LegalConfig, EquityType, UpdateLegalConfigRequest } from '../../types/equity.types';

// 驗證 Schema
const validationSchema = Yup.object({
  equityType: Yup.string().required('股權類型為必填'),
  performanceVestingMonths: Yup.number()
    .min(0, '鎖定期不能為負數')
    .max(60, '鎖定期不能超過60個月')
    .required('績效配股鎖定期為必填'),
  purchaseVestingMonths: Yup.number()
    .min(0, '鎖定期不能為負數')
    .max(60, '鎖定期不能超過60個月')
    .required('認購鎖定期為必填'),
  maxInstallments: Yup.number()
    .min(1, '至少要有1期')
    .max(12, '不能超過12期')
    .required('最大分期數為必填'),
  goodLeaverRepurchasePercentage: Yup.number()
    .min(0, '百分比不能為負數')
    .max(100, '百分比不能超過100%')
    .required('良性離職回購百分比為必填'),
  badLeaverRepurchasePercentage: Yup.number()
    .min(0, '百分比不能為負數')
    .max(100, '百分比不能超過100%')
    .required('非良性離職回購百分比為必填'),
  buybackReservePercentage: Yup.number()
    .min(0, '百分比不能為負數')
    .max(50, '百分比不能超過50%')
    .required('回購儲備百分比為必填'),
  platformFeePercentage: Yup.number()
    .min(0, '百分比不能為負數')
    .max(10, '百分比不能超過10%')
    .required('平台服務費百分比為必填'),
  tradingWindowDays: Yup.number()
    .min(1, '交易窗口至少要開放1天')
    .max(30, '交易窗口不能超過30天')
    .required('交易窗口開放天數為必填'),
  maxPriceVariationPercentage: Yup.number()
    .min(1, '價格浮動至少要有1%')
    .max(50, '價格浮動不能超過50%')
    .required('最大價格浮動百分比為必填'),
  dividendTaxRate: Yup.number()
    .min(0, '稅率不能為負數')
    .max(50, '稅率不能超過50%')
});

const LegalConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [showDialog, setShowDialog] = useState<boolean>(false);

  // 獲取店鋪列表
  const { data: stores, isLoading: loadingStores } = useQuery(
    'stores',
    () => storeService.getStores(),
    {
      onSuccess: (data) => {
        if (data.data.length > 0 && !selectedStoreId) {
          setSelectedStoreId(data.data[0].id);
        }
      }
    }
  );

  // 獲取法律配置
  const {
    data: legalConfig,
    isLoading: loadingConfig,
    error: configError,
    refetch
  } = useQuery(
    ['legalConfig', selectedStoreId],
    () => equityService.getLegalConfig(selectedStoreId),
    {
      enabled: !!selectedStoreId,
      onError: (error) => {
        console.error('Error fetching legal config:', error);
      }
    }
  );

  // 更新法律配置
  const { mutate: updateConfig, isLoading: updating } = useMutation(
    (data: UpdateLegalConfigRequest) => equityService.updateLegalConfig(selectedStoreId, data),
    {
      onSuccess: () => {
        setIsEditMode(false);
        queryClient.invalidateQueries(['legalConfig', selectedStoreId]);
      },
      onError: (error) => {
        console.error('Error updating legal config:', error);
        setShowDialog(true);
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
    setIsEditMode(false);
  };

  const handleSubmit = (values: Partial<LegalConfig>) => {
    const updateData: UpdateLegalConfigRequest = {
      equityType: values.equityType as EquityType,
      performanceVestingMonths: values.performanceVestingMonths,
      purchaseVestingMonths: values.purchaseVestingMonths,
      maxInstallments: values.maxInstallments,
      goodLeaverRepurchasePercentage: values.goodLeaverRepurchasePercentage,
      badLeaverRepurchasePercentage: values.badLeaverRepurchasePercentage,
      buybackReservePercentage: values.buybackReservePercentage,
      platformFeePercentage: values.platformFeePercentage,
      tradingWindowDays: values.tradingWindowDays,
      maxPriceVariationPercentage: values.maxPriceVariationPercentage,
      dividendTaxRate: values.dividendTaxRate,
      legalDocumentUrls: values.legalDocumentUrls
    };

    updateConfig(updateData);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          股權法律配置
        </Typography>

        <FormControl variant="outlined" sx={{ minWidth: 200 }}>
          <InputLabel id="store-select-label">選擇店鋪</InputLabel>
          <Select
            labelId="store-select-label"
            label="選擇店鋪"
            value={selectedStoreId}
            onChange={handleStoreChange}
          >
            {stores?.data.map((store) => (
              <MenuItem key={store.id} value={store.id}>
                {store.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {!selectedStoreId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          請選擇一個店鋪來查看其股權法律配置
        </Alert>
      )}

      {configError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          獲取法律配置時發生錯誤。可能是該店鋪尚未設置股權配置。
        </Alert>
      )}

      {loadingConfig && selectedStoreId && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      )}

      {legalConfig && !loadingConfig && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            {!isEditMode ? (
              <Button
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => setIsEditMode(true)}
              >
                編輯設定
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<CancelIcon />}
                onClick={() => setIsEditMode(false)}
              >
                取消編輯
              </Button>
            )}
          </Box>

          {!isEditMode ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  基本設定
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    股權類型
                  </Typography>
                  <Typography variant="body1">
                    {legalConfig.equityType === 'phantom' ? '虛擬股（僅享有分紅權）' : '實股（Class B 無表決權股）'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    績效配股鎖定期
                  </Typography>
                  <Typography variant="body1">{legalConfig.performanceVestingMonths} 個月</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    認購鎖定期
                  </Typography>
                  <Typography variant="body1">{legalConfig.purchaseVestingMonths} 個月</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    最大分期數
                  </Typography>
                  <Typography variant="body1">{legalConfig.maxInstallments} 期</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    分紅稅率
                  </Typography>
                  <Typography variant="body1">
                    {legalConfig.dividendTaxRate !== undefined
                      ? `${legalConfig.dividendTaxRate}%`
                      : '無 (0%)'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  回購與交易設定
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    良性離職回購百分比
                  </Typography>
                  <Typography variant="body1">{legalConfig.goodLeaverRepurchasePercentage}%</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    非良性離職回購百分比
                  </Typography>
                  <Typography variant="body1">{legalConfig.badLeaverRepurchasePercentage}%</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    回購儲備百分比
                  </Typography>
                  <Typography variant="body1">{legalConfig.buybackReservePercentage}%</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    平台服務費百分比
                  </Typography>
                  <Typography variant="body1">{legalConfig.platformFeePercentage}%</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    交易窗口開放天數
                  </Typography>
                  <Typography variant="body1">{legalConfig.tradingWindowDays} 天</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    最大價格浮動百分比
                  </Typography>
                  <Typography variant="body1">{legalConfig.maxPriceVariationPercentage}%</Typography>
                </Box>
              </Grid>

              {legalConfig.legalDocumentUrls && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    法律文件
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      股權協議
                    </Typography>
                    <Typography variant="body1">
                      {legalConfig.legalDocumentUrls.equityAgreement ? (
                        <a
                          href={legalConfig.legalDocumentUrls.equityAgreement}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          查看文件
                        </a>
                      ) : (
                        '未設定'
                      )}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      鎖定期時程表
                    </Typography>
                    <Typography variant="body1">
                      {legalConfig.legalDocumentUrls.vestingSchedule ? (
                        <a
                          href={legalConfig.legalDocumentUrls.vestingSchedule}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          查看文件
                        </a>
                      ) : (
                        '未設定'
                      )}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      稅務資訊
                    </Typography>
                    <Typography variant="body1">
                      {legalConfig.legalDocumentUrls.taxInformation ? (
                        <a
                          href={legalConfig.legalDocumentUrls.taxInformation}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          查看文件
                        </a>
                      ) : (
                        '未設定'
                      )}
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          ) : (
            <Formik
              initialValues={{
                equityType: legalConfig.equityType,
                performanceVestingMonths: legalConfig.performanceVestingMonths,
                purchaseVestingMonths: legalConfig.purchaseVestingMonths,
                maxInstallments: legalConfig.maxInstallments,
                goodLeaverRepurchasePercentage: legalConfig.goodLeaverRepurchasePercentage,
                badLeaverRepurchasePercentage: legalConfig.badLeaverRepurchasePercentage,
                buybackReservePercentage: legalConfig.buybackReservePercentage,
                platformFeePercentage: legalConfig.platformFeePercentage,
                tradingWindowDays: legalConfig.tradingWindowDays,
                maxPriceVariationPercentage: legalConfig.maxPriceVariationPercentage,
                dividendTaxRate: legalConfig.dividendTaxRate || 0,
                legalDocumentUrls: {
                  equityAgreement: legalConfig.legalDocumentUrls?.equityAgreement || '',
                  vestingSchedule: legalConfig.legalDocumentUrls?.vestingSchedule || '',
                  taxInformation: legalConfig.legalDocumentUrls?.taxInformation || ''
                }
              }}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ errors, touched, values }) => (
                <Form>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" gutterBottom>
                        基本設定
                      </Typography>
                      <Divider sx={{ mb: 2 }} />

                      <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                        <InputLabel>股權類型</InputLabel>
                        <Field
                          as={Select}
                          name="equityType"
                          label="股權類型"
                          error={touched.equityType && Boolean(errors.equityType)}
                        >
                          <MenuItem value={EquityType.PHANTOM}>虛擬股（僅享有分紅權）</MenuItem>
                          <MenuItem value={EquityType.REAL}>實股（Class B 無表決權股）</MenuItem>
                        </Field>
                      </FormControl>

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="績效配股鎖定期 (月)"
                        name="performanceVestingMonths"
                        type="number"
                        error={touched.performanceVestingMonths && Boolean(errors.performanceVestingMonths)}
                        helperText={touched.performanceVestingMonths && errors.performanceVestingMonths}
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="認購鎖定期 (月)"
                        name="purchaseVestingMonths"
                        type="number"
                        error={touched.purchaseVestingMonths && Boolean(errors.purchaseVestingMonths)}
                        helperText={touched.purchaseVestingMonths && errors.purchaseVestingMonths}
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="最大分期數"
                        name="maxInstallments"
                        type="number"
                        error={touched.maxInstallments && Boolean(errors.maxInstallments)}
                        helperText={touched.maxInstallments && errors.maxInstallments}
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="分紅稅率 (%)"
                        name="dividendTaxRate"
                        type="number"
                        error={touched.dividendTaxRate && Boolean(errors.dividendTaxRate)}
                        helperText={touched.dividendTaxRate && errors.dividendTaxRate}
                        sx={{ mb: 2 }}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle1" gutterBottom>
                        回購與交易設定
                      </Typography>
                      <Divider sx={{ mb: 2 }} />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="良性離職回購百分比 (%)"
                        name="goodLeaverRepurchasePercentage"
                        type="number"
                        error={touched.goodLeaverRepurchasePercentage && Boolean(errors.goodLeaverRepurchasePercentage)}
                        helperText={touched.goodLeaverRepurchasePercentage && errors.goodLeaverRepurchasePercentage}
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="非良性離職回購百分比 (%)"
                        name="badLeaverRepurchasePercentage"
                        type="number"
                        error={touched.badLeaverRepurchasePercentage && Boolean(errors.badLeaverRepurchasePercentage)}
                        helperText={touched.badLeaverRepurchasePercentage && errors.badLeaverRepurchasePercentage}
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="回購儲備百分比 (%)"
                        name="buybackReservePercentage"
                        type="number"
                        error={touched.buybackReservePercentage && Boolean(errors.buybackReservePercentage)}
                        helperText={touched.buybackReservePercentage && errors.buybackReservePercentage}
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="平台服務費百分比 (%)"
                        name="platformFeePercentage"
                        type="number"
                        error={touched.platformFeePercentage && Boolean(errors.platformFeePercentage)}
                        helperText={touched.platformFeePercentage && errors.platformFeePercentage}
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="交易窗口開放天數"
                        name="tradingWindowDays"
                        type="number"
                        error={touched.tradingWindowDays && Boolean(errors.tradingWindowDays)}
                        helperText={touched.tradingWindowDays && errors.tradingWindowDays}
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="最大價格浮動百分比 (%)"
                        name="maxPriceVariationPercentage"
                        type="number"
                        error={touched.maxPriceVariationPercentage && Boolean(errors.maxPriceVariationPercentage)}
                        helperText={touched.maxPriceVariationPercentage && errors.maxPriceVariationPercentage}
                        sx={{ mb: 2 }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="subtitle1" gutterBottom>
                        法律文件
                      </Typography>
                      <Divider sx={{ mb: 2 }} />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="股權協議 URL"
                        name="legalDocumentUrls.equityAgreement"
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="鎖定期時程表 URL"
                        name="legalDocumentUrls.vestingSchedule"
                        sx={{ mb: 2 }}
                      />

                      <Field
                        as={TextField}
                        fullWidth
                        variant="outlined"
                        label="稅務資訊 URL"
                        name="legalDocumentUrls.taxInformation"
                        sx={{ mb: 2 }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          type="submit"
                          variant="contained"
                          color="primary"
                          startIcon={<SaveIcon />}
                          disabled={updating}
                        >
                          {updating ? <CircularProgress size={24} /> : '保存設定'}
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Form>
              )}
            </Formik>
          )}
        </Box>
      )}

      <Dialog open={showDialog} onClose={() => setShowDialog(false)}>
        <DialogTitle>更新失敗</DialogTitle>
        <DialogContent>
          <Typography>更新法律配置時發生錯誤。請稍後再試或聯繫技術支持。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)} color="primary">
            關閉
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default LegalConfigPage; 