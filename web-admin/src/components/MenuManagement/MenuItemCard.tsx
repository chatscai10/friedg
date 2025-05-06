import * as React from 'react';
import { styled, keyframes, useTheme, Theme } from '@mui/material/styles';
import { Box, Typography, Button } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { MenuItem } from '../../types/menuItem';

// 定義卡片容器樣式
const CardContainer = styled(Box)(() => ({
  position: 'relative',
  width: '250px',
  height: '150px',
  background: 'white',
  transition: '0.4s ease-in-out',
  borderRadius: '15px',
  boxShadow: 'rgba(0, 0, 0, 0.07) 0px 1px 1px, rgba(0, 0, 0, 0.07) 0px 2px 2px, rgba(0, 0, 0, 0.07) 0px 4px 4px, rgba(0, 0, 0, 0.07) 0px 8px 8px, rgba(0, 0, 0, 0.07) 0px 16px 16px',
  overflow: 'hidden',
  margin: '2em auto',
  '&:hover': {
    height: '400px',
    transform: 'translateY(10px)',
  }
}));

// 定義食品圖片樣式
const FoodImage = styled('img')(() => ({
  position: 'absolute',
  top: '-30px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '120px',
  height: '120px',
  borderRadius: '50%',
  objectFit: 'cover',
  transition: '0.4s ease-in-out',
  zIndex: 10,
  border: '4px solid white',
  boxShadow: '0 0 10px rgba(0,0,0,0.2)',
  '.card-container:hover &': {
    top: '-50px',
    width: '150px',
    height: '150px',
  }
}));

// 定義標題樣式
const Title = styled(Typography)(({ theme }) => ({
  position: 'relative',
  color: theme.palette.text.primary,
  fontWeight: 'bold',
  fontSize: '1.1em',
  textAlign: 'center',
  marginTop: '90px',
  transition: '0.4s ease-in-out',
  '.card-container:hover &': {
    transform: 'translateY(30px)',
  }
}));

// 定義描述樣式
const Description = styled(Typography)(({ theme }) => ({
  position: 'relative',
  color: theme.palette.text.secondary,
  fontSize: '0.8em',
  textAlign: 'center',
  margin: '10px 30px',
  height: '40px',
  overflow: 'hidden',
  transition: '0.4s ease-in-out',
  opacity: 0,
  '.card-container:hover &': {
    opacity: 1,
    transform: 'translateY(30px)',
  }
}));

// 定義價格樣式
const Price = styled(Typography)(({ theme }) => ({
  position: 'relative',
  color: theme.palette.primary.main,
  fontWeight: 'bold',
  fontSize: '1.5em',
  textAlign: 'center',
  marginTop: '5px',
  transition: '0.4s ease-in-out',
  opacity: 0,
  '.card-container:hover &': {
    opacity: 1,
    transform: 'translateY(30px)',
  }
}));

// 定義原價樣式
const OriginalPrice = styled(Typography)(({ theme }) => ({
  position: 'relative',
  color: theme.palette.text.secondary,
  fontSize: '0.9em',
  textAlign: 'center',
  textDecoration: 'line-through',
  transition: '0.4s ease-in-out',
  opacity: 0,
  '.card-container:hover &': {
    opacity: 1,
    transform: 'translateY(30px)',
  }
}));

// 定義類別標籤樣式
const CategoryBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '10px',
  right: '10px',
  background: theme.palette.secondary.main,
  color: 'white',
  padding: '4px 8px',
  borderRadius: '12px',
  fontSize: '0.7em',
  fontWeight: 'bold',
  zIndex: 5,
}));

// 定義編輯按鈕樣式
const EditButton = styled(Button)(({ theme }) => ({
  position: 'relative',
  border: 'none',
  outline: 'none',
  backgroundColor: theme.palette.primary.main,
  color: 'white',
  fontSize: '0.8em',
  padding: '8px 0',
  borderRadius: '10px',
  width: '80%',
  margin: '0 auto',
  display: 'block',
  transition: '0.4s ease-in-out',
  fontWeight: 'bold',
  marginTop: '20px',
  opacity: 0,
  transform: 'translateY(20px)',
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
  '.card-container:hover &': {
    opacity: 1,
    transform: 'translateY(30px)',
  }
}));

// 定義刪除按鈕樣式
const DeleteButton = styled(Button)(({ theme }) => ({
  position: 'relative',
  border: 'none',
  outline: 'none',
  backgroundColor: theme.palette.error.main,
  color: 'white',
  fontSize: '0.8em',
  padding: '8px 0',
  borderRadius: '10px',
  width: '80%',
  margin: '0 auto',
  display: 'block',
  transition: '0.4s ease-in-out',
  fontWeight: 'bold',
  marginTop: '10px',
  opacity: 0,
  transform: 'translateY(20px)',
  '&:hover': {
    backgroundColor: theme.palette.error.dark,
  },
  '.card-container:hover &': {
    opacity: 1,
    transform: 'translateY(30px)',
  }
}));

// 根據庫存狀態取得顏色
const getStockStatusColor = (theme: Theme, status: 'in_stock' | 'low_stock' | 'out_of_stock') => {
  if (status === 'in_stock') return theme.palette.success.main;
  if (status === 'low_stock') return theme.palette.warning.main;
  return theme.palette.error.main;
};

// 定義庫存狀態樣式
const StockStatus = styled(Box)(() => ({
  position: 'absolute',
  top: '10px',
  left: '10px',
  color: 'white',
  padding: '4px 8px',
  borderRadius: '12px',
  fontSize: '0.7em',
  fontWeight: 'bold',
  zIndex: 5,
}));

// 定義推薦徽章樣式的動畫
const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.8;
  }
`;

// 定義推薦徽章樣式
const RecommendedBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '50px',
  right: '10px',
  background: theme.palette.warning.main,
  color: 'white',
  padding: '4px 8px',
  borderRadius: '12px',
  fontSize: '0.7em',
  fontWeight: 'bold',
  zIndex: 5,
  animation: `${pulseAnimation} 2s infinite ease-in-out`,
}));

// 定義特殊徽章樣式
const SpecialBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '50px',
  left: '10px',
  background: theme.palette.info.main,
  color: 'white',
  padding: '4px 8px',
  borderRadius: '12px',
  fontSize: '0.7em',
  fontWeight: 'bold',
  zIndex: 5,
}));

// 元件接口定義
interface MenuItemCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
}

/**
 * 餐點卡片元件
 * 基於風格/線上點餐-餐點卡片.txt的設計風格
 */
const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, onEdit, onDelete }) => {
  const theme = useTheme();
  const statusColor = getStockStatusColor(theme, item.stockStatus);

  return (
    <CardContainer className="card-container">
      {/* 分類標籤 */}
      <CategoryBadge>{item.categoryName}</CategoryBadge>
      
      {/* 庫存狀態 */}
      <StockStatus sx={{ backgroundColor: statusColor }}>
        {item.stockStatus === 'in_stock' ? '庫存充足' : 
         item.stockStatus === 'low_stock' ? '庫存不足' : '售罄'}
      </StockStatus>
      
      {/* 推薦標籤 */}
      {item.isRecommended && <RecommendedBadge>推薦</RecommendedBadge>}
      
      {/* 特殊標籤 */}
      {item.isSpecial && <SpecialBadge>特選</SpecialBadge>}
      
      {/* 食品圖片 */}
      <FoodImage
        src={item.imageUrl || 'https://via.placeholder.com/300x160?text=無圖片'}
        alt={item.name}
      />
      
      {/* 標題 */}
      <Title variant="h6">{item.name}</Title>
      
      {/* 描述 */}
      <Description variant="body2">{item.description || '無描述'}</Description>
      
      {/* 價格 */}
      {item.discountPrice ? (
        <>
          <Price>${item.discountPrice}</Price>
          <OriginalPrice>${item.price}</OriginalPrice>
        </>
      ) : (
        <Price>${item.price}</Price>
      )}
      
      {/* 編輯按鈕 */}
      <EditButton
        startIcon={<EditIcon />}
        onClick={() => onEdit(item)}
      >
        編輯
      </EditButton>
      
      {/* 刪除按鈕 */}
      <DeleteButton
        startIcon={<DeleteIcon />}
        onClick={() => onDelete(item.id)}
      >
        刪除
      </DeleteButton>
    </CardContainer>
  );
};

export default MenuItemCard; 