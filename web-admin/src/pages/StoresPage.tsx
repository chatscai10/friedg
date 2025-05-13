import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
  IconButton,
  Chip,
  Alert,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  SelectChangeEvent,
  Container
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import MapIcon from '@mui/icons-material/Map';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SettingsIcon from '@mui/icons-material/Settings';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { enqueueSnackbar } from 'notistack';

import LoadingState from '../components/common/LoadingState';
import Pagination from '../components/common/Pagination';
import StoreCreateForm from '../components/StoreManagement/StoreCreateForm';
import StoreForm from '../components/StoreManagement/StoreForm';
import StoreAttendanceSettingsForm from '../components/StoreManagement/StoreAttendanceSettingsForm';
import { RootState } from '../store';
import { 
  fetchStoresThunk, 
  deleteStoreThunk, 
  setCurrentPage, 
  setPageSize,
  setSearchTerm,
  setStatusFilter,
  clearErrors
} from '../store/storeSlice';
import { Store, StoreStatus } from '../types/store';

/**
 * 店鋪狀態轉換為顯示文字
 */
const getStatusLabel = (status: StoreStatus): string => {
  const statusMap: Record<StoreStatus, string> = {
    active: '營業中',
    inactive: '未營業',
    temporary_closed: '暫時關閉',
    permanently_closed: '永久關閉'
  };
  return statusMap[status] || status;
};

/**
 * 根據店鋪狀態獲取標籤顏色
 */
const getStatusColor = (status: StoreStatus): 'success' | 'error' | 'warning' | 'default' => {
  const colorMap: Record<StoreStatus, 'success' | 'error' | 'warning' | 'default'> = {
    active: 'success',
    inactive: 'error',
    temporary_closed: 'warning',
    permanently_closed: 'default'
  };
  return colorMap[status] || 'default';
};

/**
 * 店鋪管理頁面
 */
const StoresPage: React.FC = () => {
  const dispatch = useDispatch();
  const { stores, loading, error, deleteLoading, deleteError, pagination, filters } = useSelector((state: RootState) => state.stores);

  // 刪除對話框狀態
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // 創建店鋪對話框狀態
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // 添加編輯對話框狀態
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // 添加編輯考勤設定對話框狀態
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);

  // 加載店鋪列表
  useEffect(() => {
    dispatch(fetchStoresThunk({
      page: pagination.currentPage,
      limit: pagination.pageSize,
      search: filters.search || undefined,
      status: filters.status as StoreStatus || undefined
    }) as any);
  }, [dispatch, pagination.currentPage, pagination.pageSize, filters.search, filters.status]);

  // 如果刪除成功後重新加載店鋪列表
  useEffect(() => {
    if (deleteDialogOpen && !deleteLoading && !deleteError && !storeToDelete) {
      setDeleteDialogOpen(false);
      dispatch(fetchStoresThunk({
        page: pagination.currentPage,
        limit: pagination.pageSize,
        search: filters.search || undefined,
        status: filters.status as StoreStatus || undefined
      }) as any);
    }
  }, [deleteLoading, deleteError, storeToDelete, deleteDialogOpen, dispatch, pagination.currentPage, pagination.pageSize, filters.search, filters.status]);

  // 處理添加店鋪
  const handleAddStore = () => {
    dispatch(clearErrors()); // 清除之前的錯誤
    setCreateDialogOpen(true);
  };
  
  // 處理創建成功
  const handleCreateSuccess = () => {
    dispatch(fetchStoresThunk({
      page: pagination.currentPage,
      limit: pagination.pageSize,
      search: filters.search || undefined,
      status: filters.status as StoreStatus || undefined
    }) as any);
    
    // 延遲關閉對話框，讓用戶有時間看到成功消息
    setTimeout(() => {
      setCreateDialogOpen(false);
    }, 1500);
  };
  
  // 關閉創建對話框
  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
  };

  // 處理編輯店鋪基本信息
  const handleEditStore = (store: Store) => {
    setSelectedStore(store);
    setEditDialogOpen(true);
  };

  // 關閉編輯對話框
  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedStore(null);
  };

  // 編輯成功後的處理
  const handleEditSuccess = () => {
    dispatch(fetchStoresThunk({ page: pagination.currentPage, limit: pagination.pageSize, search: filters.search || undefined, status: filters.status as StoreStatus || undefined }) as any);
    setEditDialogOpen(false);
    setSelectedStore(null);
    
    // 顯示成功通知
    enqueueSnackbar('店鋪更新成功', { variant: 'success' });
  };

  // 處理編輯店鋪地理位置
  const handleEditLocation = (storeId: string) => {
    // TODO: 開啟編輯地理位置對話框
    console.log('編輯店鋪地理位置', storeId);
  };

  // 處理編輯營業時間
  const handleEditHours = (storeId: string) => {
    // TODO: 開啟編輯營業時間對話框
    console.log('編輯店鋪營業時間', storeId);
  };

  // 處理編輯考勤設定
  const handleEditAttendance = (store: Store) => {
    setSelectedStore(store);
    setAttendanceDialogOpen(true);
  };
  
  // 關閉考勤設定對話框
  const handleCloseAttendanceDialog = () => {
    setAttendanceDialogOpen(false);
    setSelectedStore(null);
  };
  
  // 考勤設定編輯成功後的處理
  const handleAttendanceSuccess = () => {
    dispatch(fetchStoresThunk({ 
      page: pagination.currentPage, 
      limit: pagination.pageSize, 
      search: filters.search || undefined, 
      status: filters.status as StoreStatus || undefined 
    }) as any);
    
    // 延遲關閉，讓用戶有時間看到成功消息
    setTimeout(() => {
      setAttendanceDialogOpen(false);
      setSelectedStore(null);
      
      // 顯示成功通知
      enqueueSnackbar('店鋪考勤設定更新成功', { variant: 'success' });
    }, 1500);
  };

  // 打開刪除確認對話框
  const handleDeleteClick = (store: Store) => {
    setStoreToDelete({ id: store.id, name: store.name });
    setDeleteDialogOpen(true);
  };

  // 關閉刪除確認對話框
  const handleCloseDeleteDialog = () => {
    if (!deleteLoading) {
      setDeleteDialogOpen(false);
      setStoreToDelete(null);
    }
  };

  // 確認刪除店鋪
  const handleConfirmDelete = () => {
    if (storeToDelete) {
      dispatch(deleteStoreThunk(storeToDelete.id) as any)
        .then((result: any) => {
          if (!result.error) {
            setStoreToDelete(null);
          }
        });
    }
  };

  // 處理搜索變更
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchTerm(e.target.value));
  };

  // 處理搜索提交
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setCurrentPage(1)); // 重置到第一頁
    dispatch(fetchStoresThunk({
      page: 1,
      limit: pagination.pageSize,
      search: filters.search || undefined,
      status: filters.status as StoreStatus || undefined
    }) as any);
  };

  // 處理狀態篩選
  const handleStatusChange = (e: SelectChangeEvent<string>) => {
    dispatch(setStatusFilter(e.target.value));
    dispatch(setCurrentPage(1)); // 重置到第一頁
    
    // 立即使用新篩選條件請求資料
    dispatch(fetchStoresThunk({
      page: 1,
      limit: pagination.pageSize,
      search: filters.search || undefined,
      status: e.target.value as StoreStatus || undefined
    }) as any);
  };

  // 清除所有篩選器
  const handleClearFilters = () => {
    dispatch(setSearchTerm(''));
    dispatch(setStatusFilter(''));
    dispatch(setCurrentPage(1));
    
    // 使用清除後的篩選條件請求資料
    dispatch(fetchStoresThunk({
      page: 1,
      limit: pagination.pageSize
    }) as any);
  };

  // 處理分頁變更
  const handlePageChange = (newPage: number) => {
    dispatch(setCurrentPage(newPage));
  };

  // 處理每頁顯示數量變更
  const handlePageSizeChange = (newPageSize: number) => {
    dispatch(setPageSize(newPageSize));
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h1">店鋪管理</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={handleAddStore}
          >
            新增店鋪
          </Button>
        </Box>

        {/* 錯誤提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 篩選和搜索區域 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={5}>
              <form onSubmit={handleSearchSubmit}>
                <TextField
                  fullWidth
                  placeholder="搜索店鋪名稱..."
                  value={filters.search}
                  onChange={handleSearchChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button type="submit" size="small">搜索</Button>
                      </InputAdornment>
                    )
                  }}
                />
              </form>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="status-filter-label">店鋪狀態</InputLabel>
                <Select
                  labelId="status-filter-label"
                  label="店鋪狀態"
                  value={filters.status}
                  onChange={handleStatusChange}
                >
                  <MenuItem value="">全部狀態</MenuItem>
                  <MenuItem value="active">營業中</MenuItem>
                  <MenuItem value="inactive">未營業</MenuItem>
                  <MenuItem value="temporary_closed">暫時關閉</MenuItem>
                  <MenuItem value="permanently_closed">永久關閉</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="outlined" 
                onClick={handleClearFilters}
                disabled={!filters.search && !filters.status}
              >
                清除篩選
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* 店鋪列表 */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>店鋪名稱</TableCell>
                  <TableCell>店鋪代碼</TableCell>
                  <TableCell>地址</TableCell>
                  <TableCell>聯絡資訊</TableCell>
                  <TableCell>狀態</TableCell>
                  <TableCell>創建日期</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <LoadingState />
                    </TableCell>
                  </TableRow>
                ) : stores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body1" color="textSecondary">
                        沒有找到符合條件的店鋪
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  stores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell>{store.name}</TableCell>
                      <TableCell>{store.storeCode || '-'}</TableCell>
                      <TableCell>
                        {store.address?.fullAddress || (
                          store.address ? 
                            `${store.address.city || ''} ${store.address.street || ''}` : 
                            '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {store.contactInfo ? (
                          <>
                            {store.contactInfo.phone && <div>{store.contactInfo.phone}</div>}
                            {store.contactInfo.email && <div>{store.contactInfo.email}</div>}
                            {store.contactInfo.managerName && <div>店長: {store.contactInfo.managerName}</div>}
                          </>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={getStatusLabel(store.status)} 
                          color={getStatusColor(store.status)} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(store.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <Tooltip title="編輯基本信息">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleEditStore(store)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="編輯地理位置">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleEditLocation(store.id)}
                            >
                              <LocationOnIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="編輯營業時間">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleEditHours(store.id)}
                            >
                              <AccessTimeIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="編輯考勤設定">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleEditAttendance(store)}
                            >
                              <SettingsIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="刪除店鋪">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleDeleteClick(store)}
                            >
                              <DeleteIcon />
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
          
          {/* 分頁控件 */}
          <Box sx={{ p: 2 }}>
            <Pagination
              currentPage={pagination.currentPage}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </Box>
        </Paper>
      </Box>

      {/* 創建店鋪對話框 */}
      <Dialog 
        open={createDialogOpen} 
        onClose={handleCloseCreateDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>新增店鋪</DialogTitle>
        <DialogContent>
          <StoreForm
            mode="create"
            onSuccess={handleCreateSuccess}
            onCancel={handleCloseCreateDialog}
          />
        </DialogContent>
      </Dialog>

      {/* 編輯店鋪表單對話框 */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>編輯店鋪信息</DialogTitle>
        <DialogContent dividers>
          {selectedStore && (
            <StoreForm
              mode="edit"
              initialData={selectedStore}
              onSuccess={handleEditSuccess}
              onCancel={handleCloseEditDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 考勤設定編輯對話框 */}
      <Dialog 
        open={attendanceDialogOpen} 
        onClose={handleCloseAttendanceDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>編輯店鋪考勤設定</DialogTitle>
        <DialogContent>
          {selectedStore && (
            <StoreAttendanceSettingsForm
              store={selectedStore}
              onSuccess={handleAttendanceSuccess}
              onCancel={handleCloseAttendanceDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>確認刪除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {storeToDelete && `您確定要刪除店鋪「${storeToDelete.name}」嗎？此操作不可逆。`}
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteDialog} 
            disabled={deleteLoading}
          >
            取消
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
          >
            {deleteLoading ? '刪除中...' : '確認刪除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StoresPage; 