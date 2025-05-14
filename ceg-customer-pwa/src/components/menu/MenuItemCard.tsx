import React, { useState } from 'react';
import { MenuItem } from '@/types/menu.types'; // Assuming path alias @/ for src
import { useCart } from '@/hooks/useCart'; // Import useCart
import { Card, CardMedia, CardContent, CardActions, Button, Typography, Box, Chip } from '@mui/material';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import RecommendationChip from '@/components/common/RecommendationChip'; // Assuming this might be created later
import StockStatusChip from '@/components/common/StockStatusChip'; // Assuming this might be created later
import OptionSelectionDialog from './OptionSelectionDialog'; // Added
import { CartItemOption } from '@/types/cart.types'; // Added

interface MenuItemCardProps {
  item: MenuItem;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item }) => {
  const { addItemToCart } = useCart(); // Removed getCartItemQuantity for now from direct use here
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    if (item.stockStatus !== 'out_of_stock') {
      setDialogOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleDirectAddToCart = () => {
    if (item.stockStatus !== 'out_of_stock') {
      addItemToCart(item, 1, []); // Add with empty options array
      // TODO: Add notification for direct add
    }
  };

  const handleAddToCartWithOptions = (product: MenuItem, quantity: number, selectedOptions: CartItemOption[]) => {
    addItemToCart(product, quantity, selectedOptions);
    // TODO: Add notification for add with options
    handleCloseDialog();
  };

  const hasOptions = item.optionGroups && item.optionGroups.length > 0;

  return (
    <>
      <Card sx={{ 
        maxWidth: 345, // Standard card width, can be adjusted
        m: 1, // Margin around card
        display: 'flex',
        flexDirection: 'column',
        height: '100%' // Ensure cards in a row have same height if using Grid auto layout
      }}>
        <CardMedia
          component="img"
          height="160" // Fixed height for image
          image={item.imageUrl || 'https://via.placeholder.com/345x160/CCCCCC/FFFFFF?Text=NoImage'}
          alt={item.name}
          sx={{ objectFit: 'cover' }} // Ensure image covers the area
        />
        <CardContent sx={{ flexGrow: 1 }}> {/* Allows content to expand and push actions to bottom */}
          <Typography gutterBottom variant="h6" component="div" sx={{fontSize: '1.1rem'}}>
            {item.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ 
              minHeight: '3.6em', // Approx 2 lines of text
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2, // Limit to 2 lines
              WebkitBoxOrient: 'vertical',
              mb: 1
          }}>
            {item.description || '美味餐點，即刻擁有！'}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:1 }}>
            <Typography variant="h6" component="p" color="primary" sx={{ fontWeight: 'bold' }}>
              ${item.price.toFixed(2)}
            </Typography>
            {/* Stock Status and Recommendation Chips */}
            <Box>
              {item.isRecommended && (
                <Chip label="推薦" color="success" size="small" sx={{ mr: 0.5, backgroundColor: theme => theme.palette.secondary.main, color: theme => theme.palette.secondary.contrastText }} />
              )}
              {item.stockStatus === 'low_stock' && (
                <Chip label="庫存緊張" color="warning" variant="outlined" size="small" />
              )}
              {item.stockStatus === 'out_of_stock' && (
                <Chip label="已售罄" color="error" variant="filled" size="small" />
              )}
            </Box>
          </Box>
        </CardContent>
        <CardActions sx={{ justifyContent: 'center', pt: 0, pb:1.5 }}>
          <Button
            variant="contained"
            color="primary"
            size="medium"
            onClick={hasOptions ? handleOpenDialog : handleDirectAddToCart}
            disabled={item.stockStatus === 'out_of_stock'}
            startIcon={<AddShoppingCartIcon />}
            fullWidth // Make button take full width of CardActions
          >
            {item.stockStatus === 'out_of_stock' ? '暫時無法點餐' : (hasOptions ? '選擇規格' : '加入購物車')}
          </Button>
        </CardActions>
      </Card>
      {/* Ensure dialog is only rendered if item is available, though item should always be defined here */}
      {item && (
          <OptionSelectionDialog 
              open={dialogOpen} 
              item={item} 
              onClose={handleCloseDialog} 
              onAddToCart={handleAddToCartWithOptions} 
          />
      )}
    </>
  );
};

export default MenuItemCard; 