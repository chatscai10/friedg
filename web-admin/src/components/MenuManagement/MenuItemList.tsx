import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Select, 
  Button,
  InputAdornment,
  SelectChangeEvent,
  Stack,
  CircularProgress,
  Alert,
  Pagination,
  Typography
} from '@mui/material';
import { 
  Add as AddIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { MenuItem as MenuItemType, MenuCategory } from '../../types/menuItem';
import { getMenuItems, getMenuCategories, deleteMenuItem, updateMenuItemStatus, GetMenuItemsParams } from '../../services/menuService';
import MenuItemCard from './MenuItemCard';

interface MenuItemListProps {
  onAddNew: () => void;
  onEdit: (menuItem: MenuItemType) => void;
}

const MenuItemList: React.FC<MenuItemListProps> = ({ onAddNew, onEdit }) => {
  // 狀態管理
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterApplied, setFilterApplied] = useState(false);
  
  // 首次加載時獲取數據
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 獲取分類列表
        const categoriesResponse = await getMenuCategories();
        setCategories(categoriesResponse.data);
        
        // 獲取菜單項目列表
        await fetchMenuItems();
      } catch (err) {
        console.error('獲取數據失敗:', err);
        setError('獲取數據失敗，請重試');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // 搜索和篩選條件變更時重新獲取數據
  useEffect(() => {
    if (filterApplied) {
      fetchMenuItems();
    }
  }, [page, sortField, sortOrder, filterApplied]);
  
  // 獲取菜單項目列表
  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: GetMenuItemsParams = {
        page,
        limit: itemsPerPage,
        sort: sortField,
        order: sortOrder
      };
      
      // 添加篩選條件
      if (searchTerm) {
        params.query = searchTerm;
      }
      
      if (categoryFilter) {
        params.categoryId = categoryFilter;
      }
      
      const response = await getMenuItems(params);
      setMenuItems(response.data);
      setTotalPages(Math.ceil(response.pagination.total / itemsPerPage));
    } catch (err) {
      console.error('獲取菜單項目失敗:', err);
      setError('獲取菜單項目失敗，請重試');
    } finally {
      setLoading(false);
    }
  };
  
  // 處理搜尋輸入變更
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };
  
  // 處理分類篩選變更
  const handleCategoryChange = (event: SelectChangeEvent) => {
    setCategoryFilter(event.target.value);
  };
  
  // 應用篩選
  const handleApplyFilter = () => {
    setPage(1); // 重置到第一頁
    setFilterApplied(true);
    fetchMenuItems();
  };
  
  // 重置篩選
  const handleResetFilter = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setPage(1);
    setSortField('createdAt');
    setSortOrder('desc');
    setFilterApplied(false);
    fetchMenuItems();
  };

  // 處理編輯點擊
  const handleEditClick = (item: MenuItemType) => {
    onEdit(item);
  };
  
  // 處理刪除點擊
  const handleDeleteClick = async (id: string) => {
    if (window.confirm('確定要刪除此菜單項目嗎？')) {
      try {
        await deleteMenuItem(id);
        // 刪除成功後重新獲取列表
        fetchMenuItems();
      } catch (error) {
        console.error('刪除菜單項目失敗:', error);
        setError('刪除菜單項目失敗，請重試');
      }
    }
  };
  
  // 處理啟用/停用狀態變更
  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateMenuItemStatus(id, { isActive: !isActive });
      // 更新狀態後重新獲取列表
      fetchMenuItems();
    } catch (error) {
      console.error('更新菜單項目狀態失敗:', error);
      setError('更新菜單項目狀態失敗，請重試');
    }
  };
  
  // 處理分頁變更
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          菜單項目管理
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={onAddNew}
        >
          新增菜單項目
        </Button>
      </Box>
      
      {/* 搜尋和篩選區域 */}
      <Box sx={{ display: 'flex', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="搜尋菜單項目"
          variant="outlined"
          size="small"
          fullWidth
          value={searchTerm}
          onChange={handleSearchChange}
          sx={{ flexGrow: 1, minWidth: '200px' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl sx={{ minWidth: '200px' }} size="small">
          <InputLabel id="category-filter-label">分類篩選</InputLabel>
          <Select
            labelId="category-filter-label"
            id="category-filter"
            value={categoryFilter}
            label="分類篩選"
            onChange={handleCategoryChange}
          >
            <MenuItem value="">
              <em>全部分類</em>
            </MenuItem>
            {categories.map((category: MenuCategory) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            color="primary" 
            onClick={handleApplyFilter}
          >
            篩選
          </Button>
          <Button 
            variant="outlined" 
            color="secondary" 
            onClick={handleResetFilter}
          >
            重置
          </Button>
        </Box>
      </Box>
      
      {/* 錯誤提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* 加載中 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* 結果列表 */}
          {menuItems.length === 0 ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              未找到符合條件的菜單項目
            </Alert>
          ) : (
            <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              {menuItems.map((item: MenuItemType) => (
                <Box key={item.id}>
                  <MenuItemCard 
                    item={item} 
                    onEdit={handleEditClick} 
                    onDelete={handleDeleteClick}
                  />
                </Box>
              ))}
            </Stack>
          )}
          
          {/* 分頁 */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination 
                count={totalPages} 
                page={page}
                onChange={handlePageChange}
                color="primary" 
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default MenuItemList; 