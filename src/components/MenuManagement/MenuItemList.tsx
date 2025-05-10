import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  CardMedia, 
  Typography, 
  Grid, 
  Chip, 
  IconButton, 
  TextField, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel, 
  Divider,
  Button,
  CardActions,
  InputAdornment,
  CircularProgress,
  Alert,
  SelectChangeEvent
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { MenuItem as MenuItemType, MenuCategory } from '../../types/menuItem';
import { getMenuItems, getMenuCategories, deleteMenuItem, updateMenuItemStatus } from '../../services/menuService';

const MenuItemList: React.FC = () => {
  // 狀態管理
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
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
  
  // 獲取菜單項目列表
  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page,
        limit: 20
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
      setTotalPages(Math.ceil(response.pagination.total / 20));
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
    setCategoryFilter(event.target.value as string);
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

  // 處理編輯點擊
  const handleEditClick = async (id: string) => {
    try {
      // 導航到編輯頁面
      window.location.href = `/menu/edit/${id}`;
    } catch (error) {
      console.error('導航到菜單編輯頁面失敗:', error);
      setError('導航到菜單編輯頁面失敗，請重試');
    }
  };

  // 渲染單一菜單項目卡片
  const renderMenuItemCard = (item: MenuItemType) => {
    return (
      <Card 
        key={item.id} 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          height: '100%',
          boxShadow: 2,
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.02)',
            boxShadow: 4
          }
        }}
      >
        <CardMedia
          component="img"
          height="160"
          image={item.imageUrl || 'https://via.placeholder.com/300x160?text=無圖片'}
          alt={item.name}
          sx={{ objectFit: 'cover' }}
        />
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h6" component="div" noWrap sx={{ fontWeight: 'bold' }}>
              {item.name}
            </Typography>
            <Box>
              {item.isRecommended && (
                <Chip 
                  label="推薦" 
                  size="small" 
                  color="primary" 
                  sx={{ mr: 0.5, fontSize: '0.7rem' }} 
                />
              )}
              {item.isSpecial && (
                <Chip 
                  label="特選" 
                  size="small" 
                  color="secondary" 
                  sx={{ fontSize: '0.7rem' }} 
                />
              )}
            </Box>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ height: '40px', overflow: 'hidden', mb: 1 }}>
            {item.description || '無描述'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Chip 
              label={item.categoryName} 
              size="small" 
              variant="outlined" 
              sx={{ mr: 1 }} 
            />
            <Typography 
              variant="caption" 
              color={
                item.stockStatus === 'in_stock' ? 'success.main' : 
                item.stockStatus === 'low_stock' ? 'warning.main' : 'error.main'
              }
            >
              {item.stockStatus === 'in_stock' ? '庫存充足' : 
               item.stockStatus === 'low_stock' ? '庫存不足' : '售罄'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
            {item.discountPrice ? (
              <>
                <Typography variant="h6" color="primary" fontWeight="bold">
                  ${item.discountPrice}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through', ml: 1 }}>
                  ${item.price}
                </Typography>
              </>
            ) : (
              <Typography variant="h6" color="primary" fontWeight="bold">
                ${item.price}
              </Typography>
            )}
          </Box>
        </CardContent>
        <Divider />
        <CardActions sx={{ justifyContent: 'space-between', p: 1 }}>
          <Box>
            <IconButton 
              size="small" 
              color="primary" 
              aria-label="編輯"
              onClick={() => handleEditClick(item.id)}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton 
              size="small" 
              color="error" 
              aria-label="刪除"
              onClick={() => handleDeleteClick(item.id)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <Chip 
            label={item.isActive ? '啟用中' : '已停用'} 
            size="small" 
            color={item.isActive ? 'success' : 'default'} 
            onClick={() => handleToggleActive(item.id, item.isActive)}
          />
        </CardActions>
      </Card>
    );
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
        >
          新增菜單項目
        </Button>
      </Box>
      
      <Box sx={{ display: 'flex', mb: 3, gap: 2 }}>
        <TextField
          label="搜尋菜單項目"
          variant="outlined"
          size="small"
          fullWidth
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <FormControl sx={{ minWidth: 200 }} size="small">
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
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button 
          variant="outlined" 
          onClick={fetchMenuItems}
        >
          套用篩選
        </Button>
      </Box>
      
      {/* 錯誤提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* 載入指示器 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            {menuItems.map((item) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
                {renderMenuItemCard(item)}
              </Grid>
            ))}
            {menuItems.length === 0 && !loading && (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    無符合條件的菜單項目
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </>
      )}
    </Box>
  );
};

export default MenuItemList; 