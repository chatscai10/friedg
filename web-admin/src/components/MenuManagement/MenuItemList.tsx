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
  Button,
  CardActions,
  InputAdornment,
  Alert,
  SelectChangeEvent
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon,
  Search as SearchIcon,
  Restaurant as RestaurantIcon,
  FilterAlt as FilterIcon
} from '@mui/icons-material';
import { MenuItem as MenuItemType, MenuCategory } from '../../types/menuItem';
import { getMenuItems, getMenuCategories, deleteMenuItem, fixMenu } from '../../services/menuService';
import { getPlaceholderImage } from '../../utils/placeholder';
import LoadingState from '../common/LoadingState';
import EmptyState from '../common/EmptyState';
import { useNotification } from '../../contexts/NotificationContext';

// 定義參數接口
interface MenuItemsParams {
  page?: number;
  limit?: number;
  query?: string;
  categoryId?: string;
}

const MenuItemList: React.FC = () => {
  const { showSuccessNotification, showErrorNotification } = useNotification();
  
  // 狀態管理
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [firstLoad, setFirstLoad] = useState(true);
  
  // 首次加載時獲取數據和修復菜單
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 嘗試修復菜單
        try {
          console.log('嘗試修復菜單...');
          const fixResult = await fixMenu();
          if (fixResult.success) {
            console.log('菜單修復成功:', fixResult.message);
            showSuccessNotification('菜單數據結構已更新');
            // 執行修復腳本
            if (fixResult.script) {
              try {
                eval(fixResult.script);
              } catch (scriptError) {
                console.error('執行修復腳本失敗:', scriptError);
              }
            }
          }
        } catch (fixError) {
          console.error('菜單修復嘗試失敗:', fixError);
          // 繼續執行，不要中斷主要流程
        }
        
        // 獲取分類列表
        const categoriesResponse = await getMenuCategories();
        setCategories(categoriesResponse.data);
        
        // 獲取菜單項目列表
        await fetchMenuItems();
        setFirstLoad(false);
      } catch (err) {
        console.error('獲取數據失敗:', err);
        setError('獲取數據失敗，請重試');
        setFirstLoad(false);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [showSuccessNotification, showErrorNotification]);
  
  // 獲取菜單項目列表
  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: MenuItemsParams = {
        page: 1,
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
    } catch (err) {
      console.error('獲取菜單項目失敗:', err);
      setError('獲取菜單項目失敗，請重試');
      showErrorNotification('獲取菜單項目失敗，請稍後再試');
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
        showSuccessNotification('菜單項目已成功刪除');
        fetchMenuItems();
      } catch (error) {
        console.error('刪除菜單項目失敗:', error);
        showErrorNotification('刪除菜單項目失敗，請重試');
      }
    }
  };
  
  // 處理編輯點擊
  const handleEditClick = async (id: string) => {
    try {
      // 導航到編輯頁面
      window.location.href = `/menu/edit/${id}`;
    } catch (error) {
      console.error('導航到菜單編輯頁面失敗:', error);
      showErrorNotification('導航到菜單編輯頁面失敗，請重試');
    }
  };

  // 處理新增菜單項目
  const handleAddNew = () => {
    window.location.href = '/menu/new';
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
          image={item.imageUrl || getPlaceholderImage()}
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
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" color="primary">
              ${item.price}
            </Typography>
            <Chip 
              label={item.isActive ? '已啟用' : '已停用'} 
              size="small"
              color={item.isActive ? 'success' : 'default'}
            />
          </Box>
        </CardContent>
        
        <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
          <IconButton 
            size="small" 
            color="primary"
            onClick={() => handleEditClick(item.id)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            color="error"
            onClick={() => handleDeleteClick(item.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
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
          onClick={handleAddNew}
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
          startIcon={<FilterIcon />}
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
      
      {/* 使用新的載入和空狀態組件 */}
      {loading && firstLoad ? (
        <LoadingState message="載入菜單項目..." size="large" fullPage />
      ) : loading ? (
        <LoadingState message="更新中..." size="medium" />
      ) : menuItems.length === 0 ? (
        <EmptyState 
          icon={RestaurantIcon}
          title="沒有菜單項目"
          message={searchTerm || categoryFilter ? "沒有符合篩選條件的菜單項目" : "目前沒有任何菜單項目，請點擊新增按鈕創建您的第一個菜單項目"}
          actionText="新增菜單項目"
          onAction={handleAddNew}
        />
      ) : (
        <Grid container spacing={3}>
          {menuItems.map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
              {renderMenuItemCard(item)}
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default MenuItemList; 