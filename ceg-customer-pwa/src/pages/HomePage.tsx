import React, { useEffect, useState } from 'react';
// import { Link } from 'react-router-dom'; // No longer needed here, navigation is global
import { MenuCategory, MenuItem } from '@/types/menu.types';
import { getMockMenuCategories, getMockMenuItems } from '@/services/menuService';
import MenuCategoryList from '@/components/menu/MenuCategoryList';
import MenuItemCard from '@/components/menu/MenuItemCard';
import {
  Container, Typography, Box, Grid, CircularProgress, Alert
} from '@mui/material';

const HomePage: React.FC = () => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Simulate API delay for loading state demonstration
        // await new Promise(resolve => setTimeout(resolve, 1000)); 
        const [cats, items] = await Promise.all([
          getMockMenuCategories(),
          getMockMenuItems()
        ]);
        setCategories(cats);
        setMenuItems(items);
        setFilteredItems(items);
      } catch (err) {
        console.error("Error fetching menu data:", err);
        setError("無法載入菜單資料，請稍後再試或檢查您的網路連線。");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSelectCategory = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId); // Update selected category ID state
    if (categoryId) {
      setFilteredItems(menuItems.filter(item => item.categoryId === categoryId && item.stockStatus !== 'archived'));
    } else {
      setFilteredItems(menuItems.filter(item => item.stockStatus !== 'archived')); // Show all non-archived items
    }
  };

  // Removed handleAddToCart as it's handled within MenuItemCard now

  if (loading) {
    return (
      <Container sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Box textAlign="center">
            <CircularProgress size={60} sx={{mb: 2}}/>
            <Typography variant="h6">載入菜單中，請稍候...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error" sx={{width: '100%'}}>{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: {xs: 2, sm: 3} }}>
      {/* Header Section - Can be enhanced or made a separate component */}
      <Box sx={{ textAlign: 'center', my: {xs:2, sm:4} }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{fontWeight: 'bold', color: 'primary.main'}}>
          吃雞排找不早
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          今日精選，美味即刻點餐！
        </Typography>
      </Box>

      <MenuCategoryList 
        categories={categories} 
        onSelectCategory={handleSelectCategory} 
        selectedCategoryId={selectedCategoryId} // Pass selectedId to MenuCategoryList
      />

      <Typography variant="h5" component="h2" sx={{ mt: {xs:3, sm:4}, mb: {xs:2, sm:3}, fontWeight: 'medium' }}>
        {selectedCategoryId ? categories.find(c=>c.id === selectedCategoryId)?.name : '所有商品'}
      </Typography>
      
      {filteredItems.length === 0 && !loading && (
        <Alert severity="info" sx={{width: '100%'}}>目前此分類下暫無商品，或商品已售罄。</Alert>
      )}

      <Grid container spacing={{ xs: 2, md: 3 }}>
        {filteredItems.map((item) => (
          <Grid item key={item.id} xs={12} sm={6} md={4} lg={3}>
            {/* MenuItemCard now handles its own add to cart logic via useCart */}
            <MenuItemCard item={item} /> 
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default HomePage; 