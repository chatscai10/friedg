import * as React from 'react';
import { Box, Typography, Container, Grid } from '@mui/material';
import MenuItemCard from '../MenuManagement/MenuItemCard';

// 模擬餐點數據
const mockMenuItems = [
  {
    id: '1',
    name: '特製牛肉漢堡',
    description: '100%澳洲進口牛肉製成，搭配特製醬料與新鮮蔬菜',
    price: 180,
    discountPrice: 160,
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    categoryId: '1',
    categoryName: '主餐',
    isActive: true,
    isRecommended: true,
    isSpecial: false,
    stockStatus: 'in_stock' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: '蒜香蘑菇披薩',
    description: '香濃起司搭配新鮮蘑菇與特製蒜香醬',
    price: 320,
    discountPrice: null,
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    categoryId: '1',
    categoryName: '主餐',
    isActive: true,
    isRecommended: false,
    isSpecial: true,
    stockStatus: 'low_stock' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    name: '芒果冰沙',
    description: '使用台灣在地新鮮芒果製作，清涼消暑',
    price: 120,
    discountPrice: 100,
    imageUrl: 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    categoryId: '2',
    categoryName: '飲料',
    isActive: true,
    isRecommended: true,
    isSpecial: true,
    stockStatus: 'out_of_stock' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

/**
 * 餐點卡片範例頁面
 * 展示基於風格/線上點餐-餐點卡片.txt設計的卡片元件
 */
const MenuItemCardExample: React.FC = () => {
  // 模擬編輯處理函數
  const handleEdit = (item: any) => {
    console.log('編輯項目:', item);
    alert(`編輯項目: ${item.name}`);
  };

  // 模擬刪除處理函數
  const handleDelete = (id: string) => {
    console.log('刪除項目 ID:', id);
    alert(`刪除項目 ID: ${id}`);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
          餐點卡片範例
        </Typography>
        
        <Typography variant="subtitle1" gutterBottom sx={{ mb: 3 }}>
          基於風格/線上點餐-餐點卡片.txt設計的餐點卡片元件，懸停查看完整效果
        </Typography>

        <Grid container spacing={4} justifyContent="center" sx={{ mt: 2 }}>
          {mockMenuItems.map((item) => (
            <Grid item key={item.id}>
              <MenuItemCard 
                item={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
};

export default MenuItemCardExample; 