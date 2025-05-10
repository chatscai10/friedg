import React, { useState, useEffect } from 'react';
import { Box, Container, Grid, Paper, Typography, CircularProgress, Divider, Alert } from '@mui/material';
import { PosOrderProvider } from '../contexts/PosOrderContext';
import PosCategoryTabs from '../components/Pos/PosCategoryTabs';
import PosProductGrid from '../components/Pos/PosProductGrid';
import PosOrderPanel from '../components/Pos/PosOrderPanel';
import { getMenuCategories } from '../services/menuService';
import { MenuCategory } from '../types/menuItem';

const PosPage: React.FC = () => {
  // 狀態定義
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 獲取菜單分類
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await getMenuCategories({
          isActive: true // 只獲取啟用的分類
        });
        
        if (response.data.length > 0) {
          setCategories(response.data);
          // 自動選擇第一個分類
          setSelectedCategory(response.data[0].id);
        } else {
          setError('沒有找到可用的菜單分類');
        }
      } catch (err) {
        console.error('獲取菜單分類失敗:', err);
        setError('獲取菜單分類時發生錯誤');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // 處理分類切換
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  return (
    <PosOrderProvider>
      <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          POS 點餐系統
        </Typography>

        <Divider sx={{ mb: 3 }} />

        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <CircularProgress size={60} thickness={4} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {/* 左側：菜單選擇區域 */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2, mb: 2 }}>
                <PosCategoryTabs 
                  categories={categories} 
                  selectedCategory={selectedCategory}
                  onCategoryChange={handleCategoryChange}
                />
              </Paper>
              
              <Paper sx={{ p: 2, minHeight: '500px' }}>
                {selectedCategory ? (
                  <PosProductGrid categoryId={selectedCategory} />
                ) : (
                  <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                    <Typography color="text.secondary">請選擇一個菜單分類</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
            
            {/* 右側：訂單面板 */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <PosOrderPanel />
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>
    </PosOrderProvider>
  );
};

export default PosPage; 