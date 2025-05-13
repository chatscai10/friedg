import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { getInventoryItems, deleteInventoryItem } from '../../../services/inventoryService';
import { InventoryItem, InventoryItemsFilter } from '../../../types/inventory.types';
import InventoryItemForm from './InventoryItemForm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hasPermission } from '../../../utils/permissionUtils';
import ViewStockLevelsModal from '../../../components/Inventory/Items/ViewStockLevelsModal';

const InventoryItemsListPage: React.FC = () => {
  // 查詢客戶端
  const queryClient = useQueryClient();
  
  // 狀態管理
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  
  // 過濾條件
  const [filters, setFilters] = useState<InventoryItemsFilter>({
    page: 1,
    pageSize: 10
  });
  
  // 模態框狀態
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [stockLevelsModalOpen, setStockLevelsModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  // 權限狀態
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canViewStockLevels: false
  });

  // 使用React Query獲取庫存品項
  const { data, isLoading, isError } = useQuery({
    queryKey: ['inventoryItems', { page: page + 1, pageSize: rowsPerPage, ...filters }],
    queryFn: () => getInventoryItems({
      ...filters,
      page: page + 1, // API使用1-based索引
      pageSize: rowsPerPage
    }),
    keepPreviousData: true
  });

  // 使用React Query處理刪除操作
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteInventoryItem(itemId),
    onSuccess: () => {
      // 刪除成功後刷新品項列表
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: unknown) => {
      console.error('刪除庫存品項失敗:', error);
      setError(error instanceof Error ? error.message : '刪除庫存品項時發生錯誤');
    }
  });

  // 載入用戶權限
  React.useEffect(() => {
    const checkPermissions = async () => {
      const canCreate = await hasPermission('inventory:create');
      const canUpdate = await hasPermission('inventory:update');
      const canDelete = await hasPermission('inventory:delete');
      const canViewStockLevels = await hasPermission('inventory:read_stock_levels');

      setPermissions({ canCreate, canUpdate, canDelete, canViewStockLevels });
    };
    
    checkPermissions();
  }, []);
  
  // 處理分頁變更
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // 處理過濾條件變更
  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setPage(0);
  };
  
  const handleCategoryFilterChange = (event: SelectChangeEvent<string>) => {
    const { value } = event.target;
    setFilters(prev => ({
      ...prev,
      category: value || undefined
    }));
    setPage(0);
  };
  
  const handleActiveFilterChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    setFilters(prev => ({
      ...prev,
      isActive: value === 'true' ? true : value === 'false' ? false : undefined
    }));
    setPage(0);
  };
  
  // 處理新增/編輯
  const handleAddItem = () => {
    setSelectedItem(null);
    setFormOpen(true);
  };
  
  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormOpen(true);
  };
  
  // 處理表單關閉
  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedItem(null);
  };
  
  // 處理表單提交
  const handleFormSubmit = () => {
    setFormOpen(false);
    // React Query會自動處理重新加載
  };
  
  // 處理刪除
  const handleDeleteClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = () => {
    if (!selectedItem) return;
    
    // 使用mutation處理刪除
    deleteMutation.mutate(selectedItem.itemId);
  };
  
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedItem(null);
  };
  
  // 處理查看庫存詳情
  const handleViewStockLevels = (item: InventoryItem) => {
    setSelectedItem(item);
    setStockLevelsModalOpen(true);
  };

  // 處理庫存水平模態框關閉
  const handleStockLevelsModalClose = () => {
    setStockLevelsModalOpen(false);
    setSelectedItem(null);
  };

  // 提取數據，處理數據為空的情況
  const items = data?.data || [];
  const total = data?.pagination.total || 0;
  
  // 組件主體
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          庫存品項管理
        </Typography>
        {permissions.canCreate && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            新增品項
          </Button>
        )}
      </Box>
      
      {/* 過濾器 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                name="name"
                label="品項名稱搜尋"
                fullWidth
                variant="outlined"
                size="small"
                value={filters.name || ''}
                onChange={handleFilterChange}
                InputProps={{
                  endAdornment: <SearchIcon color="action" />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>分類篩選</InputLabel>
                <Select
                  value={filters.category || ''}
                  label="分類篩選"
                  onChange={handleCategoryFilterChange}
                >
                  <MenuItem value="">所有分類</MenuItem>
                  <MenuItem value="原料">原料</MenuItem>
                  <MenuItem value="包材">包材</MenuItem>
                  <MenuItem value="餐具">餐具</MenuItem>
                  <MenuItem value="調味料">調味料</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>狀態篩選</InputLabel>
                <Select
                  value={filters.isActive === undefined ? '' : filters.isActive.toString()}
                  label="狀態篩選"
                  onChange={handleActiveFilterChange}
                >
                  <MenuItem value="">所有狀態</MenuItem>
                  <MenuItem value="true">啟用</MenuItem>
                  <MenuItem value="false">停用</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="lowStock"
                    checked={filters.lowStock || false}
                    onChange={handleFilterChange}
                  />
                }
                label="僅顯示低庫存"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* 錯誤提示 */}
      {(isError || error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || '獲取庫存品項時發生錯誤'}
        </Alert>
      )}
      
      {/* 表格 */}
      <Paper sx={{ width: '100%', mb: 2 }}>
        <TableContainer>
          <Table sx={{ minWidth: 750 }} aria-labelledby="庫存品項表格">
            <TableHead>
              <TableRow>
                <TableCell>品項名稱</TableCell>
                <TableCell>分類</TableCell>
                <TableCell>單位</TableCell>
                <TableCell>目前總庫存</TableCell>
                <TableCell>低庫存閾值</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    沒有符合條件的庫存品項
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{'N/A'}</TableCell>
                    <TableCell>{item.lowStockThreshold || 'N/A'}</TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <span style={{ color: 'green' }}>啟用</span>
                      ) : (
                        <span style={{ color: 'red' }}>停用</span>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {permissions.canUpdate && (
                        <IconButton
                          aria-label="編輯"
                          color="primary"
                          onClick={() => handleEditItem(item)}
                        >
                          <EditIcon />
                        </IconButton>
                      )}
                      {permissions.canDelete && (
                        <IconButton
                          aria-label="刪除"
                          color="error"
                          onClick={() => handleDeleteClick(item)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                      {permissions.canViewStockLevels && (
                        <IconButton
                          aria-label="查看庫存"
                          color="info"
                          onClick={() => handleViewStockLevels(item)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* 分頁控制 */}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="每頁筆數:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 共 ${count} 筆`}
        />
      </Paper>
      
      {/* 查看庫存水平對話框 */}
      <ViewStockLevelsModal
        open={stockLevelsModalOpen}
        onClose={handleStockLevelsModalClose}
        itemId={selectedItem?.itemId || null}
        itemName={selectedItem?.name}
      />
      
      {/* 新增/編輯表單對話框 */}
      <Dialog open={formOpen} onClose={handleFormClose} fullWidth maxWidth="md">
        <DialogTitle>
          {selectedItem ? '編輯庫存品項' : '新增庫存品項'}
        </DialogTitle>
        <DialogContent dividers>
          <InventoryItemForm
            inventoryItem={selectedItem}
            onCancel={handleFormClose}
            onSubmit={handleFormSubmit}
          />
        </DialogContent>
      </Dialog>
      
      {/* 刪除確認對話框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>確認刪除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            您確定要刪除「{selectedItem?.name}」這個庫存品項嗎？此操作將使品項變為不可用狀態。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            取消
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            autoFocus
            disabled={deleteMutation.isLoading}
          >
            {deleteMutation.isLoading ? '刪除中...' : '確認刪除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventoryItemsListPage; 