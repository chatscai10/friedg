import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Paper,
  InputAdornment,
  FormHelperText,
  FormGroup,
  Card,
  CardMedia,
  SelectChangeEvent,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  AddPhotoAlternate as AddPhotoIcon
} from '@mui/icons-material';
import { MenuItem as MenuItemType, MenuItemStockStatus, MenuCategory } from '../../types/menuItem';
import { createMenuItem, updateMenuItem, uploadMenuItemImage, getMenuCategories, MenuItemInput } from '../../services/menuService';
import { getPlaceholderImage } from '../../utils/placeholder';

interface MenuItemFormProps {
  menuItem?: MenuItemType; // 如果提供，則表示編輯模式
  onCancel: () => void;
  onSubmit: (menuItem: MenuItemType) => void;
}

const MenuItemForm: React.FC<MenuItemFormProps> = ({ menuItem, onCancel, onSubmit }) => {
  const isEditMode = !!menuItem;
  const formTitle = isEditMode ? '編輯菜單項目' : '新增菜單項目';
  
  // 狀態管理
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [categoryName, setCategoryName] = useState<string>('');
  
  // 表單欄位狀態
  const [formData, setFormData] = useState<Partial<MenuItemType>>(
    menuItem || {
      name: '',
      description: '',
      categoryId: '',
      price: 0,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: [],
      nutritionInfo: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        allergens: []
      }
    }
  );
  
  // 首次加載時獲取分類數據
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getMenuCategories();
        setCategories(response.data);
        
        // 如果是編輯模式，設置分類名稱
        if (isEditMode && menuItem?.categoryId) {
          const category = response.data.find(cat => cat.id === menuItem.categoryId);
          if (category) {
            setCategoryName(category.name);
          }
        }
      } catch (err) {
        console.error('獲取菜單分類失敗:', err);
        setError('獲取菜單分類失敗，無法加載表單');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCategories();
    
    // 如果有圖片則設置預覽
    if (menuItem?.imageUrl) {
      setImagePreview(menuItem.imageUrl);
    }
  }, [isEditMode, menuItem]);
  
  // 處理表單輸入變更
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // 處理價格欄位變更 (轉換為數字)
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;
    setFormData({
      ...formData,
      [name]: numValue
    });
  };
  
  // 處理開關欄位變更
  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData({
      ...formData,
      [name]: checked
    });
  };
  
  // 處理分類選擇變更
  const handleCategoryChange = (e: SelectChangeEvent) => {
    const categoryId = e.target.value;
    const category = categories.find(cat => cat.id === categoryId);
    
    setFormData({
      ...formData,
      categoryId,
      categoryName: category?.name || ''
    });
    
    if (category) {
      setCategoryName(category.name);
    }
  };
  
  // 處理庫存狀態變更
  const handleStockStatusChange = (e: SelectChangeEvent) => {
    setFormData({
      ...formData,
      stockStatus: e.target.value as MenuItemStockStatus
    });
  };
  
  // 處理營養信息變更
  const handleNutritionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;
    setFormData({
      ...formData,
      nutritionInfo: {
        ...formData.nutritionInfo,
        [name]: numValue
      }
    });
  };
  
  // 處理過敏原變更
  const [allergenInput, setAllergenInput] = useState('');
  
  const handleAllergenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAllergenInput(e.target.value);
  };
  
  const handleAddAllergen = () => {
    if (allergenInput.trim() && formData.nutritionInfo?.allergens) {
      setFormData({
        ...formData,
        nutritionInfo: {
          ...formData.nutritionInfo,
          allergens: [...formData.nutritionInfo.allergens, allergenInput.trim()]
        }
      });
      setAllergenInput('');
    }
  };
  
  const handleDeleteAllergen = (index: number) => {
    if (formData.nutritionInfo?.allergens) {
      const newAllergens = [...formData.nutritionInfo.allergens];
      newAllergens.splice(index, 1);
      setFormData({
        ...formData,
        nutritionInfo: {
          ...formData.nutritionInfo,
          allergens: newAllergens
        }
      });
    }
  };
  
  // 處理標籤變更
  const [tagInput, setTagInput] = useState('');
  
  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagInput(e.target.value);
  };
  
  const handleAddTag = () => {
    if (tagInput.trim() && formData.tags) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };
  
  const handleDeleteTag = (index: number) => {
    if (formData.tags) {
      const newTags = [...formData.tags];
      newTags.splice(index, 1);
      setFormData({
        ...formData,
        tags: newTags
      });
    }
  };
  
  // 處理圖片上傳
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      
      // 創建預覽
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // 表單驗證
  const validateForm = () => {
    if (!formData.name) {
      setError('菜單項目名稱不能為空');
      return false;
    }
    
    if (!formData.categoryId) {
      setError('請選擇菜單分類');
      return false;
    }
    
    if (formData.price <= 0) {
      setError('價格必須大於零');
      return false;
    }
    
    return true;
  };
  
  // 處理表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // 表單驗證
    if (!validateForm()) {
      return;
    }
    
    try {
      setSubmitting(true);
      
      // 如果有新上傳的圖片，先上傳圖片
      if (imageFile) {
        try {
          const imageResult = await uploadMenuItemImage(imageFile, 'main');
          // 更新表單數據中的圖片URL
          setFormData({
            ...formData,
            imageUrl: imageResult.imageUrl,
            thumbnailUrl: imageResult.thumbnailUrl
          });
        } catch (error) {
          console.error('上傳圖片失敗:', error);
          setError('上傳圖片失敗，請重試');
          setSubmitting(false);
          return;
        }
      }
      
      let result: MenuItemType;
      
      // 根據模式執行創建或更新操作
      if (isEditMode && menuItem?.id) {
        // 移除不需要傳送的字段
        const { id, createdAt, updatedAt, ...updateData } = formData;
        result = await updateMenuItem(menuItem.id, updateData as MenuItemInput);
      } else {
        // 確保categoryName被正確添加到數據中
        const submitData = {
          ...formData,
          categoryName
        };
        result = await createMenuItem(submitData as MenuItemInput);
      }
      
      // 返回結果給父組件
      onSubmit(result);
      
    } catch (error) {
      console.error('保存菜單項目失敗:', error);
      setError('保存菜單項目失敗，請重試');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          {formTitle}
        </Typography>
        <Box>
          <Button 
            variant="outlined" 
            color="secondary" 
            onClick={onCancel} 
            startIcon={<CancelIcon />}
            sx={{ mr: 1 }}
            disabled={submitting}
          >
            取消
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            startIcon={<SaveIcon />}
            disabled={submitting}
          >
            {submitting ? '保存中...' : '保存'}
          </Button>
        </Box>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>基本信息</Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2 }}>
          <TextField
            required
            fullWidth
            label="菜單項目名稱"
            name="name"
            value={formData.name || ''}
            onChange={handleInputChange}
          />
          <FormControl fullWidth required>
            <InputLabel id="category-label">菜單分類</InputLabel>
            <Select
              labelId="category-label"
              name="categoryId"
              value={formData.categoryId || ''}
              label="菜單分類"
              onChange={handleCategoryChange}
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        
        <TextField
          fullWidth
          multiline
          rows={3}
          label="描述"
          name="description"
          value={formData.description || ''}
          onChange={handleInputChange}
          sx={{ mb: 2 }}
        />
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2 }}>
          <TextField
            required
            label="價格"
            name="price"
            type="number"
            value={formData.price || 0}
            onChange={handlePriceChange}
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
          />
          <TextField
            label="折扣價格"
            name="discountPrice"
            type="number"
            value={formData.discountPrice || ''}
            onChange={handlePriceChange}
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>,
            }}
          />
          <FormControl fullWidth>
            <InputLabel id="stock-status-label">庫存狀態</InputLabel>
            <Select
              labelId="stock-status-label"
              name="stockStatus"
              value={formData.stockStatus || 'in_stock'}
              label="庫存狀態"
              onChange={handleStockStatusChange}
            >
              <MenuItem value="in_stock">庫存充足</MenuItem>
              <MenuItem value="low_stock">庫存不足</MenuItem>
              <MenuItem value="out_of_stock">售罄</MenuItem>
            </Select>
          </FormControl>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <FormGroup row sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive || false}
                    onChange={handleSwitchChange}
                    name="isActive"
                    color="primary"
                  />
                }
                label="啟用"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isRecommended || false}
                    onChange={handleSwitchChange}
                    name="isRecommended"
                    color="primary"
                  />
                }
                label="推薦"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isSpecial || false}
                    onChange={handleSwitchChange}
                    name="isSpecial"
                    color="secondary"
                  />
                }
                label="特選"
              />
            </FormGroup>
          </Box>
        </Box>
      </Paper>
      
      {/* 圖片上傳區 */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>菜單圖片</Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          <Box sx={{ flex: 1, textAlign: 'center' }}>
            <Card sx={{ width: '100%', maxWidth: 300, mx: 'auto', mb: 2 }}>
              <CardMedia
                component="img"
                height="200"
                image={imagePreview || getPlaceholderImage()}
                alt="菜單項目圖片"
              />
            </Card>
            <Button
              variant="outlined"
              component="label"
              startIcon={<AddPhotoIcon />}
            >
              上傳圖片
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageChange}
              />
            </Button>
            <FormHelperText>推薦尺寸: 600x400 像素，最大檔案大小: 2MB</FormHelperText>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default MenuItemForm; 