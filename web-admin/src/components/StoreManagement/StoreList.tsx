import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Stack,
  Chip,
  SelectChangeEvent,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Sort as SortIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  LocationOn as LocationOnIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  PowerSettingsNew as PowerIcon
} from '@mui/icons-material';

import { Store, StoreStatus } from '../../types/store';
import { getStores, GetStoresParams } from '../../services/storeService';

// 分店列表組件
const StoreList: React.FC = () => {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 每頁顯示的記錄數
  const rowsPerPage = 10;
  
  // 操作菜單相關狀態
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  
  // 模擬的地區資料（實際應從API獲取）
  const regions = [
    { id: 'north', name: '北區' },
    { id: 'central', name: '中區' },
    { id: 'south', name: '南區' },
    { id: 'east', name: '東區' }
  ];

  // 狀態顯示的映射
  const statusMap: Record<StoreStatus, { label: string; color: 'success' | 'error' | 'warning' | 'default' }> = {
    active: { label: '營業中', color: 'success' },
    inactive: { label: '未啟用', color: 'default' },
    temporary_closed: { label: '暫停營業', color: 'warning' },
    permanently_closed: { label: '永久關閉', color: 'error' }
  };

  // 獲取分店數據
  const fetchStores = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: GetStoresParams = {
        page,
        limit: rowsPerPage,
        sort: sortField,
        order: sortOrder
      };

      if (statusFilter) {
        params.status = statusFilter as StoreStatus;
      }

      if (searchQuery) {
        params.query = searchQuery;
      }

      // 在實際應用中，根據API結構調整區域篩選
      if (regionFilter) {
        // 假設API支持以地址中的城市/區域進行篩選
        // 實際實現可能需要調整
      }

      const response = await getStores(params);
      
      setStores(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.totalItems);
      
    } catch (err) {
      console.error('獲取分店列表失敗:', err);
      setError('獲取分店數據時發生錯誤，請稍後再試。');
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 當頁面加載或依賴項變更時獲取數據
  useEffect(() => {
    fetchStores();
  }, [page, statusFilter, regionFilter, sortField, sortOrder]);

  // 處理搜索
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // 執行搜索
  const handleSearchSubmit = () => {
    setPage(1); // 重置頁碼
    fetchStores();
  };

  // 處理按Enter鍵搜索
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  // 處理狀態篩選
  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value);
    setPage(1); // 重置頁碼
  };

  // 處理區域篩選
  const handleRegionFilterChange = (event: SelectChangeEvent) => {
    setRegionFilter(event.target.value);
    setPage(1); // 重置頁碼
  };

  // 處理排序
  const handleSortChange = (event: SelectChangeEvent) => {
    setSortField(event.target.value);
    setPage(1); // 重置頁碼
  };

  // 切換排序順序
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    setPage(1); // 重置頁碼
  };

  // 處理分頁
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  // 處理新增分店
  const handleAddStore = () => {
    navigate('/stores/new');
  };

  // 處理手動刷新
  const handleRefresh = () => {
    fetchStores();
  };

  // 開啟操作菜單
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, storeId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedStoreId(storeId);
  };

  // 關閉操作菜單
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedStoreId(null);
  };

  // 處理編輯分店
  const handleEditStore = () => {
    if (selectedStoreId) {
      navigate(`/stores/edit/${selectedStoreId}`);
    }
    handleMenuClose();
  };

  // 處理查看分店詳情
  const handleViewStoreDetails = () => {
    if (selectedStoreId) {
      navigate(`/stores/view/${selectedStoreId}`);
    }
    handleMenuClose();
  };

  // 處理分店設定
  const handleStoreSettings = () => {
    if (selectedStoreId) {
      navigate(`/stores/settings/${selectedStoreId}`);
    }
    handleMenuClose();
  };

  // 處理管理分店員工
  const handleManageStoreEmployees = () => {
    if (selectedStoreId) {
      navigate(`/stores/${selectedStoreId}/employees`);
    }
    handleMenuClose();
  };

  // 處理切換分店狀態
  const handleToggleStoreStatus = () => {
    if (selectedStoreId) {
      // 實際應用中應該調用API來更改狀態
      alert(`切換分店狀態功能尚未實現 (ID: ${selectedStoreId})`);
    }
    handleMenuClose();
  };

  // 獲取地址顯示文本
  const getAddressDisplay = (store: Store) => {
    if (store.address?.fullAddress) {
      return store.address.fullAddress;
    }
    
    const parts = [];
    if (store.address?.street) parts.push(store.address.street);
    if (store.address?.city) parts.push(store.address.city);
    if (store.address?.state) parts.push(store.address.state);
    if (store.address?.postalCode) parts.push(store.address.postalCode);
    
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  // 獲取GPS顯示文本
  const getGpsDisplay = (store: Store) => {
    if (store.location?.latitude && store.location?.longitude) {
      return `${store.location.latitude.toFixed(6)}, ${store.location.longitude.toFixed(6)}`;
    }
    return '-';
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          分店管理
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddStore}
          sx={{ borderRadius: '4px' }}
        >
          新增分店
        </Button>
      </Box>
      <Divider sx={{ mb: 3 }} />
      
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'wrap' }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="搜尋分店..."
            value={searchQuery}
            onChange={handleSearch}
            onKeyPress={handleKeyPress}
            InputProps={{
              startAdornment: <SearchIcon color="primary" sx={{ mr: 1 }} />
            }}
            sx={{ minWidth: 200 }}
          />
          
          <IconButton onClick={handleSearchSubmit} color="primary" size="small">
            <SearchIcon />
          </IconButton>
          
          <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="status-filter-label">狀態</InputLabel>
            <Select
              labelId="status-filter-label"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              label="狀態"
            >
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="active">營業中</MenuItem>
              <MenuItem value="inactive">未啟用</MenuItem>
              <MenuItem value="temporary_closed">暫停營業</MenuItem>
              <MenuItem value="permanently_closed">永久關閉</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="region-filter-label">區域</InputLabel>
            <Select
              labelId="region-filter-label"
              value={regionFilter}
              onChange={handleRegionFilterChange}
              label="區域"
            >
              <MenuItem value="">全部區域</MenuItem>
              {regions.map(region => (
                <MenuItem key={region.id} value={region.id}>{region.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="sort-field-label">排序欄位</InputLabel>
              <Select
                labelId="sort-field-label"
                value={sortField}
                onChange={handleSortChange}
                label="排序欄位"
              >
                <MenuItem value="name">分店名稱</MenuItem>
                <MenuItem value="status">狀態</MenuItem>
                <MenuItem value="createdAt">創建日期</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={toggleSortOrder} color="primary">
              <SortIcon sx={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
            </IconButton>
          </Box>
          
          <IconButton onClick={handleRefresh} color="primary" title="刷新數據">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ position: 'relative' }}>
        {isLoading && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <Table>
          <TableHead sx={{ backgroundColor: '#355891' }}>
            <TableRow>
              <TableCell sx={{ color: 'white' }}>代碼</TableCell>
              <TableCell sx={{ color: 'white' }}>分店名稱</TableCell>
              <TableCell sx={{ color: 'white' }}>地址</TableCell>
              <TableCell sx={{ color: 'white' }}>店長</TableCell>
              <TableCell sx={{ color: 'white' }}>電話</TableCell>
              <TableCell sx={{ color: 'white' }}>狀態</TableCell>
              <TableCell sx={{ color: 'white' }}>GPS</TableCell>
              <TableCell sx={{ color: 'white' }} align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stores.map((store, index) => (
              <TableRow 
                key={store.id}
                hover
                sx={{ backgroundColor: index % 2 === 0 ? 'rgba(0, 0, 0, 0.02)' : 'white' }}
              >
                <TableCell>{store.storeCode || '-'}</TableCell>
                <TableCell>
                  <Box sx={{ fontWeight: 'bold', cursor: 'pointer' }} onClick={() => navigate(`/stores/view/${store.id}`)}>
                    {store.name}
                  </Box>
                  {store.description && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      {store.description.length > 30 ? `${store.description.substring(0, 30)}...` : store.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{getAddressDisplay(store)}</TableCell>
                <TableCell>{store.contactInfo?.managerName || '-'}</TableCell>
                <TableCell>{store.contactInfo?.phone || '-'}</TableCell>
                <TableCell>
                  <Chip 
                    label={statusMap[store.status]?.label || store.status}
                    color={statusMap[store.status]?.color || 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {store.location ? (
                      <Tooltip title={getGpsDisplay(store)}>
                        <LocationOnIcon color="primary" fontSize="small" />
                      </Tooltip>
                    ) : '-'}
                    {store.gpsFence?.enabled && (
                      <Chip 
                        label={`圍欄 ${store.gpsFence.radius || 0}m`} 
                        color="info" 
                        size="small"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <IconButton 
                    size="small"
                    aria-label="more"
                    aria-haspopup="true"
                    onClick={(event) => handleMenuOpen(event, store.id)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {stores.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  無符合條件的分店記錄
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Typography variant="body2" color="textSecondary">
          共 {totalItems} 筆紀錄
        </Typography>
        <Stack spacing={2}>
          <Pagination 
            count={totalPages} 
            page={page} 
            onChange={handlePageChange} 
            color="primary" 
            showFirstButton 
            showLastButton
            disabled={isLoading}
          />
        </Stack>
      </Box>

      {/* 操作菜單 */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewStoreDetails}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          <ListItemText>查看詳情</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEditStore}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>編輯</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleStoreSettings}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>設定</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleManageStoreEmployees}>
          <ListItemIcon><PeopleIcon fontSize="small" /></ListItemIcon>
          <ListItemText>員工</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleToggleStoreStatus}>
          <ListItemIcon><PowerIcon fontSize="small" /></ListItemIcon>
          <ListItemText>切換狀態</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default StoreList; 