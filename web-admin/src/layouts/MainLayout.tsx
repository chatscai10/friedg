import React, { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  CircularProgress,
  Collapse,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Restaurant as RestaurantIcon,
  ShoppingCart as ShoppingCartIcon,
  Inventory as InventoryIcon,
  Schedule as ScheduleIcon,
  AccessTime as AccessTimeIcon,
  BarChart as BarChartIcon,
  ExitToApp as ExitToAppIcon,
  Assessment as AssessmentIcon,
  AccountBalance as AccountBalanceIcon,
  CardGiftcard as CardGiftcardIcon,
  Stars as StarsIcon,
  Redeem as RedeemIcon,
  LocalOffer as LocalOfferIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { getAuthorizedMenuItems, MenuItem } from '../config/menuConfig';

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}));

const AppBarStyled = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<{
  open?: boolean;
}>(({ theme, open }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'center',
}));

const Footer = styled('footer')(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
  backgroundColor: theme.palette.background.paper,
  position: 'fixed',
  bottom: 0,
  width: '100%',
}));

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [currentPath, setCurrentPath] = useState(location.pathname);
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>({});
  
  // 使用Auth Hook獲取用戶信息
  const { user, logout, hasRole, hasPermission, loading } = useAuth();
  
  // 獲取授權的菜單項
  const authorizedMenuItems = user ? getAuthorizedMenuItems(hasRole, hasPermission) : [];
  
  // 當路徑變更時更新當前路徑狀態
  useEffect(() => {
    setCurrentPath(location.pathname);
    
    // 當路徑改變時，自動展開對應的父菜單
    authorizedMenuItems.forEach(item => {
      if (item.children && item.children.length > 0) {
        if (item.children.some(child => location.pathname.startsWith(child.path))) {
          setExpandedMenus(prev => ({ ...prev, [item.path]: true }));
        }
      }
    });
  }, [location.pathname, authorizedMenuItems]);
  
  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  // 處理導航項目的點擊事件
  const handleNavigation = (path: string, disabled: boolean = false, disabledHint: string = '') => {
    if (disabled) {
      alert(disabledHint || '此功能尚未開放，敬請期待！');
      return;
    }
    
    // 確保不重複導航到相同頁面
    if (currentPath !== path) {
      console.log('開始導航到：', path);
      try {
        // 使用 React Router 導航
        navigate(path);
        console.log('導航成功到：', path);
      } catch (error) {
        console.error('導航出錯：', error);
        // 發生錯誤時嘗試使用直接導航
        console.log('嘗試使用替代方法導航到：', path);
        window.location.href = path;
      }
    } else {
      console.log('已在當前頁面，不重複導航');
    }
  };
  
  // 處理登出
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('登出失敗:', error);
    }
  };

  // 處理展開/收起子菜單
  const handleToggleSubMenu = (path: string) => {
    setExpandedMenus(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // 檢查菜單項是否當前選中
  const isMenuItemSelected = (path: string) => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(path);
  };

  // 遞歸渲染菜單項
  const renderMenuItem = (item: MenuItem) => {
    const isSelected = isMenuItemSelected(item.path);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.path] || false;
    
    return (
      <React.Fragment key={item.path}>
        <ListItem disablePadding>
          <Tooltip title={item.disabled ? (item.disabledHint || '此功能尚未開放') : ''} arrow placement="right">
            <ListItemButton 
              selected={isSelected}
              onClick={hasChildren ? () => handleToggleSubMenu(item.path) : () => handleNavigation(item.path, item.disabled, item.disabledHint)}
              data-path={item.path}
              disabled={item.disabled}
              sx={{ opacity: item.disabled ? 0.6 : 1 }}
            >
              <ListItemIcon>
                <item.icon />
              </ListItemIcon>
              <ListItemText primary={item.title} />
              {hasChildren && (isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
            </ListItemButton>
          </Tooltip>
        </ListItem>
        
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children?.map(childItem => (
                <ListItem key={childItem.path} disablePadding>
                  <Tooltip title={childItem.disabled ? (childItem.disabledHint || '此功能尚未開放') : ''} arrow placement="right">
                    <ListItemButton 
                      sx={{ pl: 4 }}
                      selected={isMenuItemSelected(childItem.path)}
                      onClick={() => handleNavigation(childItem.path, childItem.disabled, childItem.disabledHint)}
                      data-path={childItem.path}
                      disabled={childItem.disabled}
                    >
                      <ListItemIcon>
                        <childItem.icon />
                      </ListItemIcon>
                      <ListItemText primary={childItem.title} />
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              ))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  // 側邊欄內容
  const sidebarContent = (
    <List>
      {authorizedMenuItems.map(renderMenuItem)}
      
      <Divider sx={{ my: 2 }} />
      
      <ListItem disablePadding>
        <ListItemButton 
          onClick={handleLogout}
        >
          <ListItemIcon>
            <ExitToAppIcon />
          </ListItemIcon>
          <ListItemText primary="登出" />
        </ListItemButton>
      </ListItem>
    </List>
  );

  // 檢查角色是否為管理員或超級管理員
  const isAdmin = user && hasRole('admin');
  const isSuperAdmin = user && hasRole('super_admin');
  const isTenantAdmin = user && hasRole('tenant_admin');
  const isAnyAdmin = isAdmin || isSuperAdmin || isTenantAdmin;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBarStyled position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            吃雞排找不早系統 - {isAnyAdmin ? '管理後台' : '員工平台'}
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.displayName || user?.email || '未知用戶'}
          </Typography>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ExitToAppIcon />}
            onClick={handleLogout}
          >
            登出
          </Button>
        </Toolbar>
      </AppBarStyled>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader>
          <Typography variant="h6" color="primary">
            吃雞排找不早系統
          </Typography>
        </DrawerHeader>
        <Divider />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          sidebarContent
        )}
      </Drawer>
      <Main open={open}>
        <DrawerHeader />
        {children}
        <Box sx={{ height: '64px' }} />
        <Footer>
          <Typography variant="body2" color="text.secondary">
            © 2025 吃雞排找不早系統 - 版權所有
          </Typography>
        </Footer>
      </Main>
    </Box>
  );
};

export default MainLayout; 