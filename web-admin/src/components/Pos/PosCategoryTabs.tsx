import React from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { MenuCategory } from '../../types/menuItem';

export interface PosCategoryTabsProps {
  categories: MenuCategory[];
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string) => void;
}

const PosCategoryTabs: React.FC<PosCategoryTabsProps> = ({
  categories,
  selectedCategory,
  onCategoryChange
}) => {
  // 處理標籤切換
  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    onCategoryChange(newValue);
  };

  return (
    <Box sx={{ width: '100%', bgcolor: 'background.paper' }}>
      <Tabs
        value={selectedCategory || ''}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="菜單分類標籤"
        sx={{
          '& .MuiTabs-flexContainer': {
            justifyContent: { xs: 'flex-start', md: 'center' }
          }
        }}
      >
        {categories.map((category) => (
          <Tab
            key={category.id}
            label={category.name}
            value={category.id}
            sx={{ 
              minWidth: 100,
              fontWeight: selectedCategory === category.id ? 'bold' : 'normal'
            }}
          />
        ))}
      </Tabs>
    </Box>
  );
};

export default PosCategoryTabs; 