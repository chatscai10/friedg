import React, { useContext } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppBar, Toolbar, Button, Typography, Box, Badge } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { CartContext } from '@/contexts/CartContext';

const CustomerNavigation: React.FC = () => {
  const { isAuthenticated, logout } = useAuth(); // Assuming logout is available in useAuth
  const location = useLocation();
  const cartContext = useContext(CartContext);

  if (!cartContext) {
    // This case should ideally not happen if CartProvider is set up correctly at the app root
    console.error("CartContext not found. Ensure CartProvider wraps this component.");
    return null; 
  }
  const { getCartItemCount } = cartContext;
  const cartItemCount = getCartItemCount();

  const handleLogout = async () => {
    if (logout) {
      await logout();
      // Navigate to home or login page after logout if needed, handled by AuthContext typically
    }
  };

  const navItems = [
    { path: '/', label: '首頁' },
    // { path: '/cart', label: '購物車' }, // Will be handled separately with Badge
    ...(isAuthenticated ? [{ path: '/history', label: '我的訂單' }] : []),
    // ...(isAuthenticated ? [{ path: '/profile', label: '帳戶資料' }] : []),
  ];

  return (
    <AppBar position="static" sx={{ mb: 3 }}> {/* Added margin bottom */}
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          吃雞排找不早
        </Typography>
        <Box>
          {navItems.map((item) => (
            <Button 
              key={item.path}
              component={RouterLink} 
              to={item.path} 
              color="inherit"
              variant={location.pathname === item.path ? 'outlined' : 'text'} // Highlight active link
              sx={{ ml: 1, mr: 1}} // Added margin
            >
              {item.label}
            </Button>
          ))}
          {/* Cart Button with Badge */}
          <Button
            component={RouterLink}
            to="/cart"
            color="inherit"
            variant={location.pathname === '/cart' ? 'outlined' : 'text'}
            sx={{ ml: 1, mr: 1 }}
            startIcon={
              <Badge badgeContent={cartItemCount > 0 ? cartItemCount : null} color="error">
                <ShoppingCartIcon />
              </Badge>
            }
          >
            購物車
          </Button>
          {isAuthenticated ? (
            <Button color="inherit" variant='outlined' onClick={handleLogout} sx={{ ml: 1, mr: 1}}>
              登出
            </Button>
          ) : (
            <Button component={RouterLink} to="/login" color="inherit" variant={location.pathname === '/login' ? 'outlined' : 'text'} sx={{ ml: 1, mr: 1}}>
              登入
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default CustomerNavigation; 