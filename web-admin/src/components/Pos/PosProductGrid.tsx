import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  CardActionArea
} from '@mui/material';
import { getMenuItems } from '../../services/menuService';
import { usePosOrder } from '../../contexts/PosOrderContext';
import { MenuItem } from '../../types/menuItem';

interface PosProductGridProps {
  categoryId: string;
}

const PosProductGrid: React.FC<PosProductGridProps> = ({ categoryId }) => {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { addItem } = usePosOrder();

  // 載入指定分類的商品
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 呼叫API獲取商品
        const response = await getMenuItems({
          categoryId,
          isActive: true // 只顯示啟用的商品
        });
        
        setProducts(response.data || []);
      } catch (err) {
        console.error('載入商品失敗:', err);
        setError('載入商品失敗，請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    if (categoryId) {
      fetchProducts();
    }
  }, [categoryId]);

  // 處理點擊商品
  const handleProductClick = (product: MenuItem) => {
    addItem(product);
  };

  // 顯示載入中
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  // 顯示錯誤
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  // 顯示商品網格
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        商品列表 ({products.length})
      </Typography>
      
      {products.length === 0 ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <Typography color="text.secondary">此分類下沒有可用商品</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {products.map((product) => (
            <Grid item xs={6} sm={4} md={3} key={product.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'scale(1.02)',
                  }
                }}
              >
                <CardActionArea 
                  onClick={() => handleProductClick(product)}
                  sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                >
                  {product.imageUrl && (
                    <CardMedia
                      component="img"
                      height="140"
                      image={product.imageUrl}
                      alt={product.name}
                    />
                  )}
                  
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="subtitle1" component="div" fontWeight="bold">
                        {product.name}
                      </Typography>
                      
                      {product.stockStatus === 'out_of_stock' && (
                        <Chip 
                          label="售罄" 
                          size="small" 
                          color="error" 
                          sx={{ ml: 1 }} 
                        />
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {product.description && product.description.length > 50 
                        ? `${product.description.substring(0, 50)}...` 
                        : product.description || ''}
                    </Typography>
                    
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" color="primary">
                        ${product.price}
                      </Typography>
                      
                      {product.discountPrice && product.discountPrice < product.price && (
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ textDecoration: 'line-through' }}
                        >
                          ${product.price}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default PosProductGrid; 