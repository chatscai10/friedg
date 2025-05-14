import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { CartItem } from '@/types/cart.types';
import { 
  Container, Typography, Button, Box, Paper, Grid, TextField, IconButton, Divider, Avatar, Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const CartPage: React.FC = () => {
  const { cartItems, removeItemFromCart, updateItemQuantity, getCartTotal, clearCart } = useCart();

  const handleQuantityChange = (item: CartItem, quantityString: string) => {
    if (quantityString === '' || quantityString === null) {
      // If input is cleared, reset to 1 or remove. Let's reset to 1 to be consistent with min=1.
      updateItemQuantity(item.id, 1);
      return;
    }
    const numQuantity = parseInt(quantityString, 10);
    if (!isNaN(numQuantity) && numQuantity >= 1) {
      updateItemQuantity(item.id, numQuantity);
    } else if (!isNaN(numQuantity) && numQuantity < 1) {
      // If a number less than 1 is somehow entered (e.g. "0", "-5")
      updateItemQuantity(item.id, 1); 
    }
    // If parseInt results in NaN (e.g. "abc") and it's not empty string, do nothing, let TextField validation show error or prevent.
  };

  if (cartItems.length === 0) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
        <Paper elevation={3} sx={{ p: {xs: 2, sm: 4} }}>
          <Typography variant="h5" component="h2" gutterBottom>
            您的購物車是空的
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            快去挑選您喜愛的餐點吧！
          </Typography>
          <Button component={RouterLink} to="/" variant="contained" color="primary">
            返回首頁
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom sx={{ mb: 4 }}>
        您的購物車
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          {cartItems.map((item) => (
            <Paper key={item.id} elevation={2} sx={{ 
              p: 2, 
              mb: 2, 
              display: 'flex', 
              alignItems: 'center',
              flexDirection: { xs: 'column', sm: 'row' } 
            }}>
              <Avatar 
                variant="rounded"
                src={item.imageUrl || 'https://via.placeholder.com/100/CCCCCC/FFFFFF?Text=NoImage'} 
                alt={item.name} 
                sx={{ 
                  width: { xs: '100%', sm: 80 }, 
                  height: { xs: 150, sm: 80 }, 
                  mr: { sm: 2 }, 
                  mb: { xs: 2, sm: 0 },
                  objectFit: 'cover'
                }} 
              />
              <Box sx={{ flexGrow: 1, width: {xs: '100%', sm: 'auto'}, textAlign: {xs: 'center', sm: 'left'} }}>
                <Typography variant="h6" component="h3" gutterBottom sx={{fontSize: '1.1rem'}}>
                  {item.name}
                </Typography>
                {item.selectedOptions && item.selectedOptions.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
                    {item.selectedOptions.map((opt, index) => (
                      <Chip 
                        key={`${item.id}-opt-${index}-${opt.value}`}
                        label={`${opt.name}${opt.priceAdjustment ? ` (+$${opt.priceAdjustment.toFixed(2)})` : ''}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary">
                  單價: ${(item.price + (item.selectedOptions?.reduce((acc, opt) => acc + (opt.priceAdjustment || 0), 0) || 0)).toFixed(2)}
                </Typography>
              </Box>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mt: { xs: 2, sm: 0 }, 
                width: {xs: '100%', sm: 'auto'},
                justifyContent: {xs: 'space-around', sm: 'flex-end'}
              }}>
                <TextField
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange(item, e.target.value)}
                  inputProps={{ min: 1, style: { textAlign: 'center' } }}
                  sx={{ width: '70px', mx: 1 }}
                  size="small"
                  variant="outlined"
                />
                <Typography variant="body1" sx={{ mx: 1, minWidth: '80px', textAlign: 'right' }}>
                  小計: ${((item.price + (item.selectedOptions?.reduce((acc, opt) => acc + (opt.priceAdjustment || 0), 0) || 0)) * item.quantity).toFixed(2)}
                </Typography>
                <IconButton onClick={() => removeItemFromCart(item.id, item.selectedOptions)} color="error" aria-label="移除商品">
                  <DeleteIcon />
                </IconButton>
              </Box>
            </Paper>
          ))}
        </Grid>
        <Grid item xs={12} sx={{ mt: 2 }}>
          <Paper elevation={3} sx={{ p: {xs:2, sm:3} }}>
            <Typography variant="h5" component="h3" textAlign="right" gutterBottom>
              總金額: ${getCartTotal().toFixed(2)}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
              <Button 
                variant="outlined" 
                color="error" 
                onClick={clearCart}
                disabled={cartItems.length === 0}
              >
                清空購物車
              </Button>
              <Button 
                component={RouterLink} 
                to="/checkout" 
                variant="contained" 
                color="primary"
                disabled={cartItems.length === 0}
                size="large"
              >
                前往結帳
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default CartPage; 