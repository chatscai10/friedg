import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Grid,
  Divider,
  SelectChangeEvent
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';

import { getStores } from '../../../services/storeService';
import { getStockLevelForItemInStore, upsertStockLevel, getInventoryItemById } from '../../../services/inventoryService';
import { hasPermission } from '../../../utils/permissionUtils';

// Props for the component
interface ViewStockLevelsModalProps {
  open: boolean;
  onClose: () => void;
  itemId: string | null;
  itemName?: string;
}

// Validation schema for threshold update form
const thresholdUpdateSchema = Yup.object({
  lowStockThreshold: Yup.number()
    .required('閾值為必填')
    .min(0, '閾值必須為非負數')
    .integer('閾值必須為整數')
});

/**
 * 查看庫存水平模態框
 * 顯示特定品項在選定分店的庫存水平，並允許修改低庫存閾值
 */
const ViewStockLevelsModal: React.FC<ViewStockLevelsModalProps> = ({
  open,
  onClose,
  itemId,
  itemName = '未命名品項'
}) => {
  // State for storing the selected store
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  
  // State for permissions
  const [canUpdateThreshold, setCanUpdateThreshold] = useState<boolean>(false);
  
  // Get query client
  const queryClient = useQueryClient();
  
  // Check permissions when component mounts
  React.useEffect(() => {
    const checkPermissions = async () => {
      const hasUpdatePermission = await hasPermission('inventory:update_stock_levels');
      setCanUpdateThreshold(hasUpdatePermission);
    };
    
    checkPermissions();
  }, []);
  
  // Fetch stores list
  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => getStores(),
    staleTime: 10 * 60 * 1000  // 10分鐘內不重新獲取
  });
  
  // Set first store as default when stores are loaded
  React.useEffect(() => {
    if (storesQuery.data?.data && storesQuery.data.data.length > 0 && !selectedStoreId) {
      setSelectedStoreId(storesQuery.data.data[0].id);
    }
  }, [storesQuery.data, selectedStoreId]);
  
  // Fetch stock level for selected item and store
  const stockLevelQuery = useQuery({
    queryKey: ['stockLevel', itemId, selectedStoreId],
    queryFn: () => {
      if (!itemId || !selectedStoreId) {
        throw new Error('需要品項ID和分店ID');
      }
      return getStockLevelForItemInStore(itemId, selectedStoreId);
    },
    enabled: !!itemId && !!selectedStoreId,
    staleTime: 1 * 60 * 1000  // 1分鐘內不重新獲取
  });
  
  // Mutation for updating low stock threshold
  const updateThresholdMutation = useMutation({
    mutationFn: ({ storeId, itemId, threshold, currentQuantity }: { 
      storeId: string; 
      itemId: string; 
      threshold: number;
      currentQuantity: number;
    }) => {
      return upsertStockLevel(itemId, storeId, { 
        lowStockThreshold: threshold,
        quantity: currentQuantity // 需要保持原有數量不變
      });
    },
    onSuccess: () => {
      // Invalidate stock level query to refresh data
      queryClient.invalidateQueries({ queryKey: ['stockLevel', itemId, selectedStoreId] });
    }
  });
  
  // Handle store selection change
  const handleStoreChange = (event: SelectChangeEvent<string>) => {
    setSelectedStoreId(event.target.value);
  };
  
  // Handle threshold update
  const handleThresholdUpdate = (values: { lowStockThreshold: number }) => {
    if (!itemId || !selectedStoreId || !stockLevelQuery.data) return;
    
    updateThresholdMutation.mutate({
      storeId: selectedStoreId,
      itemId,
      threshold: values.lowStockThreshold,
      currentQuantity: stockLevelQuery.data.quantity // 保持原有數量不變
    });
  };
  
  // Get current store name
  const getCurrentStoreName = () => {
    if (!selectedStoreId || !storesQuery.data?.data) return '載入中...';
    const store = storesQuery.data.data.find(store => store.id === selectedStoreId);
    return store ? store.name : '未找到分店';
  };
  
  // 獲取品項詳情以獲取單位
  const itemDetailQuery = useQuery({
    queryKey: ['inventoryItem', itemId],
    queryFn: () => {
      if (!itemId) {
        throw new Error('需要品項ID');
      }
      return getInventoryItemById(itemId);
    },
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000 // 5分鐘內不重新獲取
  });
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        查看「{itemName}」庫存水平
      </DialogTitle>
      
      <DialogContent dividers>
        {/* 分店選擇器 */}
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel id="store-select-label">選擇分店</InputLabel>
            {storesQuery.isLoading ? (
              <Select
                labelId="store-select-label"
                value=""
                label="選擇分店"
                disabled
              >
                <MenuItem value="">載入中...</MenuItem>
              </Select>
            ) : storesQuery.isError ? (
              <Alert severity="error">
                無法載入分店列表: {(storesQuery.error as Error)?.message || '未知錯誤'}
              </Alert>
            ) : (
              <Select
                labelId="store-select-label"
                value={selectedStoreId}
                label="選擇分店"
                onChange={handleStoreChange}
              >
                {storesQuery.data?.data.map(store => (
                  <MenuItem key={store.id} value={store.id}>
                    {store.name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </FormControl>
        </Box>
        
        {/* 庫存水平顯示 */}
        {!itemId ? (
          <Alert severity="info">請選擇一個品項查看庫存水平</Alert>
        ) : !selectedStoreId ? (
          <Alert severity="info">請選擇一個分店查看庫存水平</Alert>
        ) : stockLevelQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : stockLevelQuery.isError ? (
          <Alert severity="error">
            載入庫存水平失敗: {(stockLevelQuery.error as Error)?.message || '未知錯誤'}
          </Alert>
        ) : (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              {getCurrentStoreName()} 庫存詳情
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    目前庫存數量
                  </Typography>
                  <Typography variant="h5">
                    {stockLevelQuery.data?.quantity || 0} {itemDetailQuery.data?.unit || '單位'}
                  </Typography>
                  {stockLevelQuery.data?.quantity !== undefined && 
                   stockLevelQuery.data?.lowStockThreshold !== undefined && 
                   stockLevelQuery.data.quantity < stockLevelQuery.data.lowStockThreshold && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      目前庫存低於閾值
                    </Alert>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                {/* 閾值顯示與修改表單 */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    低庫存閾值
                  </Typography>
                  
                  <Formik
                    initialValues={{
                      lowStockThreshold: stockLevelQuery.data?.lowStockThreshold || 0
                    }}
                    validationSchema={thresholdUpdateSchema}
                    onSubmit={handleThresholdUpdate}
                    enableReinitialize
                  >
                    {({ errors, touched, isSubmitting }) => (
                      <Form>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Field
                            as={TextField}
                            name="lowStockThreshold"
                            type="number"
                            variant="outlined"
                            size="small"
                            error={touched.lowStockThreshold && Boolean(errors.lowStockThreshold)}
                            helperText={touched.lowStockThreshold && errors.lowStockThreshold}
                            disabled={!canUpdateThreshold}
                            sx={{ width: '120px' }}
                          />
                          <Button
                            type="submit"
                            variant="contained"
                            size="small"
                            disabled={isSubmitting || updateThresholdMutation.isPending || !canUpdateThreshold}
                          >
                            {updateThresholdMutation.isPending ? '更新中...' : '更新閾值'}
                          </Button>
                        </Box>
                        
                        {!canUpdateThreshold && (
                          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                            您沒有修改閾值的權限
                          </Typography>
                        )}
                        
                        {updateThresholdMutation.isSuccess && (
                          <Alert severity="success" sx={{ mt: 1 }}>
                            閾值已成功更新
                          </Alert>
                        )}
                        
                        {updateThresholdMutation.isError && (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            更新閾值失敗: {(updateThresholdMutation.error as Error)?.message || '未知錯誤'}
                          </Alert>
                        )}
                      </Form>
                    )}
                  </Formik>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} color="primary">
          關閉
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ViewStockLevelsModal; 