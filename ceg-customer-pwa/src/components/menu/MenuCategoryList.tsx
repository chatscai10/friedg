import React, { useState } from 'react';
import { MenuCategory } from '@/types/menu.types'; // Assuming path alias @/ for src
import { Box, Typography, Chip, Stack, Paper } from '@mui/material';

interface MenuCategoryListProps {
  categories: MenuCategory[];
  onSelectCategory: (categoryId: string | null) => void; // Allow null to select all
  selectedCategoryId: string | null; // Added prop to control selected state from parent
}

const MenuCategoryList: React.FC<MenuCategoryListProps> = ({ categories, onSelectCategory, selectedCategoryId }) => {

  const handleCategoryClick = (categoryId: string) => {
    const newSelectedId = selectedCategoryId === categoryId ? null : categoryId;
    onSelectCategory(newSelectedId);
  };

  if (!categories || categories.length === 0) {
    return (
        <Typography variant="body1" color="text.secondary" sx={{my: 2, textAlign: 'center'}}>
            沒有可用的菜單分類。
        </Typography>
    );
  }

  return (
    <Paper elevation={0} sx={{ 
        p: {xs: 1, sm: 1.5}, 
        mb: {xs: 2, sm: 3}, 
        // backgroundColor: (theme) => theme.palette.grey[100] // Optional: subtle background color
    }}>
      <Typography variant="h6" component="h3" sx={{ mb: 1.5, fontSize: '1.2rem', fontWeight: 'bold' }}>
        菜單分類
      </Typography>
      <Stack 
        direction="row" 
        spacing={1} 
        sx={{ 
            flexWrap: 'wrap', // Allow chips to wrap on smaller screens
            justifyContent: 'flex-start' // Align chips to the start
        }}
      >
        {/* Optional: "All" category chip */}
        <Chip
            label="全部商品"
            clickable
            onClick={() => onSelectCategory(null)}
            color={selectedCategoryId === null ? 'primary' : 'default'}
            variant={selectedCategoryId === null ? 'filled' : 'outlined'}
            sx={{ mb: 1 }}
        />
        {categories.map((category) => (
          <Chip 
            key={category.id}
            label={category.name}
            clickable
            onClick={() => handleCategoryClick(category.id)}
            color={selectedCategoryId === category.id ? 'primary' : 'default'}
            variant={selectedCategoryId === category.id ? 'filled' : 'outlined'}
            sx={{ mb: 1 }} // Add margin bottom for wrapped chips
          />
        ))}
      </Stack>
    </Paper>
  );
};

export default MenuCategoryList; 