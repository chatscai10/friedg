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
import { hasRole } from '../utils/permissionUtils';

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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openLoyalty, setOpenLoyalty] = useState(false);
  
  // 當路徑變更時更新當前路徑狀態
  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname]);
  
  // 檢查用戶角色
  useEffect(() => {
    const checkUserRole = async () => {
      setLoading(true);
      try {
        // 檢查是否為管理員
        const isAdmin = await hasRole('admin');
        // 檢查是否為普通員工
        const isStaff = await hasRole('staff');
        
        if (isAdmin) {
          setUserRole('admin');
        } else if (isStaff) {
          setUserRole('staff');
        } else {
          // 預設角色
          setUserRole('customer');
        }
      } catch (error) {
        console.error('檢查用戶角色時發生錯誤:', error);
        setUserRole('staff'); // 發生錯誤時預設為普通員工
      } finally {
        setLoading(false);
      }
    };
    
    checkUserRole();
  }, []);

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  // 處理導航項目的點擊事件
  const handleNavigation = (path: string) => {
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
  const handleLogout = () => {
    // 清除測試用戶狀態
    localStorage.removeItem('testUserLoggedIn');
    // 導航到登入頁
    navigate('/login');
  };

  // 檢查菜單項是否當前選中
  const isMenuItemSelected = (path: string) => {
    if (path === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(path);
  };

  // 側邊欄內容
  const sidebarContent = (
    <List>
      <ListItem disablePadding>
        <ListItemButton 
          selected={isMenuItemSelected('/')}
          onClick={() => handleNavigation('/')}
          data-path="/"
        >
          <ListItemIcon>
            <DashboardIcon />
          </ListItemIcon>
          <ListItemText primary="儀表板" />
        </ListItemButton>
      </ListItem>
      
      {/* 只有管理員和超級管理員可以看到的功能 */}
      {(userRole === 'admin' || userRole === 'superadmin') && (
        <>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/users')}
              onClick={() => handleNavigation('/users')}
              data-path="/users"
            >
              <ListItemIcon>
                <PeopleIcon />
              </ListItemIcon>
              <ListItemText primary="用戶管理" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/employees')}
              onClick={() => handleNavigation('/employees')}
              data-path="/employees"
            >
              <ListItemIcon>
                <PersonIcon />
              </ListItemIcon>
              <ListItemText primary="員工管理" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/stores')}
              onClick={() => handleNavigation('/stores')}
              data-path="/stores"
            >
              <ListItemIcon>
                <BusinessIcon />
              </ListItemIcon>
              <ListItemText primary="分店管理" />
            </ListItemButton>
          </ListItem>
        </>
      )}
      
      {/* 所有員工都能看到的功能 */}
      {userRole && (
        <>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/menu')}
              onClick={() => handleNavigation('/menu')}
              data-path="/menu"
            >
              <ListItemIcon>
                <RestaurantIcon />
              </ListItemIcon>
              <ListItemText primary="菜單管理" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/orders')}
              onClick={() => handleNavigation('/orders')}
              data-path="/orders"
            >
              <ListItemIcon>
                <ShoppingCartIcon />
              </ListItemIcon>
              <ListItemText primary="訂單管理" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/inventory')}
              onClick={() => alert('庫存管理功能正在開發中，敬請期待！')}
              disabled={true}
              sx={{ opacity: 0.6 }}
              data-path="/inventory"
            >
              <ListItemIcon>
                <InventoryIcon />
              </ListItemIcon>
              <ListItemText primary="庫存管理 (開發中)" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/schedules')}
              onClick={() => alert('排班管理功能正在開發中，敬請期待！')}
              disabled={true}
              sx={{ opacity: 0.6 }}
              data-path="/schedules"
            >
              <ListItemIcon>
                <ScheduleIcon />
              </ListItemIcon>
              <ListItemText primary="排班管理 (開發中)" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/attendance')}
              onClick={() => handleNavigation('/attendance')}
              data-path="/attendance"
            >
              <ListItemIcon>
                <AccessTimeIcon />
              </ListItemIcon>
              <ListItemText primary="考勤管理" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/reports')}
              onClick={() => alert('報表管理功能正在開發中，敬請期待！')}
              disabled={true}
              sx={{ opacity: 0.6 }}
              data-path="/reports"
            >
              <ListItemIcon>
                <BarChartIcon />
              </ListItemIcon>
              <ListItemText primary="報表管理 (開發中)" />
            </ListItemButton>
          </ListItem>
        </>
      )}
      
      {/* 普通員工專屬的功能 */}
      {userRole === 'staff' && (
        <>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/employee/equity/my-holdings')}
              onClick={() => handleNavigation('/employee/equity/my-holdings')}
              data-path="/employee/equity/my-holdings"
            >
              <ListItemIcon>
                <AccountBalanceIcon />
              </ListItemIcon>
              <ListItemText primary="我的股權" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              selected={isMenuItemSelected('/employee/equity/my-installments')}
              onClick={() => handleNavigation('/employee/equity/my-installments')}
              data-path="/employee/equity/my-installments"
            >
              <ListItemIcon>
                <AssessmentIcon />
              </ListItemIcon>
              <ListItemText primary="分期付款計劃" />
            </ListItemButton>
          </ListItem>
        </>
      )}
      
      {/* 會員忠誠度系統 */}
      <ListItem disablePadding>
        <ListItemButton onClick={() => setOpenLoyalty(!openLoyalty)}>
          <ListItemIcon>
            <CardGiftcardIcon />
          </ListItemIcon>
          <ListItemText primary="會員忠誠度系統" />
          {openLoyalty ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </ListItemButton>
      </ListItem>
      <Collapse in={openLoyalty} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          <ListItem disablePadding>
            <ListItemButton 
              sx={{ pl: 4 }}
              selected={isMenuItemSelected('/admin/loyalty/tier-rules')}
              onClick={() => handleNavigation('/admin/loyalty/tier-rules')}
              data-path="/admin/loyalty/tier-rules"
            >
              <ListItemIcon>
                <StarsIcon />
              </ListItemIcon>
              <ListItemText primary="會員等級規則" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              sx={{ pl: 4 }}
              selected={isMenuItemSelected('/admin/loyalty/rewards')}
              onClick={() => handleNavigation('/admin/loyalty/rewards')}
              data-path="/admin/loyalty/rewards"
            >
              <ListItemIcon>
                <RedeemIcon />
              </ListItemIcon>
              <ListItemText primary="忠誠度獎勵" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton 
              sx={{ pl: 4 }}
              selected={isMenuItemSelected('/admin/coupons/templates')}
              onClick={() => handleNavigation('/admin/coupons/templates')}
              data-path="/admin/coupons/templates"
            >
              <ListItemIcon>
                <LocalOfferIcon />
              </ListItemIcon>
              <ListItemText primary="優惠券模板" />
            </ListItemButton>
          </ListItem>
        </List>
      </Collapse>
      
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
            吃雞排找不早系統 - {userRole === 'admin' ? '管理後台' : '員工平台'}
          </Typography>
          <Typography variant="body1" sx={{ mr: 2 }}>
            {userRole === 'admin' ? '管理員' : '員工'}
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