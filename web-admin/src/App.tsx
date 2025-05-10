import * as React from 'react';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/zh-tw';
import { authService } from './services/authService';
import { setupErrorNotification } from './services/api';
import theme from './styles/theme';
import { NotificationContextProvider, useNotification } from './contexts/NotificationContext';
import MainLayout from './layouts/MainLayout';
import EmployeeList from './components/EmployeeManagement/EmployeeList';
import EmployeeForm from './components/EmployeeManagement/EmployeeForm';
import EmployeeDetail from './components/EmployeeManagement/EmployeeDetail';
import MenuItemList from './components/MenuManagement/MenuItemList';
import MenuItemForm from './components/MenuManagement/MenuItemForm';
import OrderList from './components/OrderManagement/OrderList';
import LoginPage from './pages/LoginPage';
import EmployeeLoginPage from './pages/employee/LoginPage';
import PunchPage from './pages/employee/PunchPage';
import RankingExample from './components/examples/RankingExample';
import CommentBoardExample from './components/examples/CommentBoardExample';
import NotificationExample from './components/examples/NotificationExample';
import ErrorHandlingExample from './components/examples/ErrorHandlingExample';
import AttendancePage from './pages/AttendancePage';
import LeaveManagementPage from './pages/LeaveManagementPage';
import SchedulingPage from './pages/SchedulingPage';
import CheckoutPage from './components/checkout/CheckoutPage';
import PosPage from './pages/PosPage';
import InventoryItemsListPage from './pages/Inventory/Items/InventoryItemsListPage';
import StockAdjustmentsListPage from './pages/Inventory/Adjustments/StockAdjustmentsListPage';
import PayrollPage from './pages/PayrollPage';
import DashboardPage from './pages/DashboardPage';

// 引入股權管理相關頁面
import LegalConfigPage from './pages/EquityManagement/LegalConfigPage';
import ValuationHistoryPage from './pages/EquityManagement/ValuationHistoryPage';
import EquityPoolsPage from './pages/EquityManagement/EquityPoolsPage';
import HoldingsListPage from './pages/EquityManagement/HoldingsListPage';
import DividendCyclesPage from './pages/EquityManagement/DividendCyclesPage';
import TradeWindowsPage from './pages/EquityManagement/TradeWindowsPage';

// 引入員工視圖相關頁面
import MyHoldingsPage from './pages/EmployeeView/Equity/MyHoldingsPage';
import MyInstallmentsPage from './pages/EmployeeView/Equity/MyInstallmentsPage';

// 引入 CRM 相關頁面
import CustomerListPage from './pages/CRM/CustomerListPage';
import CustomerDetailPage from './pages/CRM/CustomerDetailPage';

// 引入忠誠度管理相關頁面
import LoyaltyTierRulesPage from './pages/loyalty/LoyaltyTierRulesPage';
import LoyaltyRewardsPage from './pages/loyalty/LoyaltyRewardsPage';
import CouponTemplatesPage from './pages/coupons/CouponTemplatesPage';

// 導入必要的User類型（使用firebase/compat/auth）
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

// 使用具體的類型而非any
interface ProtectedRouteProps {
  user: firebase.User | null;
  children: React.ReactElement;
}

// 檢查是否有測試用戶登入
const isTestUserLoggedIn = (): boolean => {
  return localStorage.getItem('testUserLoggedIn') === 'true';
};

// 更新ProtectedRoute組件，直接使用Navigate組件
function ProtectedRoute({ user, children }: ProtectedRouteProps): React.ReactElement {
  // 檢查真實用戶或測試用戶
  if (!user && !isTestUserLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// 員工端PWA保護路由
function EmployeeProtectedRoute({ user, children }: ProtectedRouteProps): React.ReactElement {
  if (!user) {
    return <Navigate to="/employee/login" replace />;
  }
  return children;
}

// 包裝應用程序組件，以便在NotificationContext初始化後設置錯誤處理
function AppWithErrorHandling() {
  const { showErrorNotification } = useNotification();
  
  // 初始化API錯誤通知
  useEffect(() => {
    setupErrorNotification(showErrorNotification);
  }, [showErrorNotification]);
  
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  // Add state to store claims if needed later
  // const [userClaims, setUserClaims] = useState<Record<string, unknown> | null>(null); 

  useEffect(() => {
    // 檢查測試用戶登入
    if (isTestUserLoggedIn()) {
      console.log('Test user is logged in');
      setLoadingAuth(false);
      return () => {}; // 返回空清理函數
    }

    // Listen for auth state changes
    const unsubscribe = authService.onAuthStateChange(async (firebaseUser) => { // Make callback async
      console.log('Auth state changed:', firebaseUser);
      setUser(firebaseUser);
      
      // If user is logged in, try to get claims
      if (firebaseUser) {
        try {
          // This function forces a token refresh internally
          const claims = await authService.getCurrentUserClaims(); 
          console.log('User claims fetched in App.tsx (forced refresh):', claims);
          // setUserClaims(claims); // Store claims if needed
        } catch (error) {
          console.error("Error fetching user claims after auth state change:", error);
          // Handle error, maybe clear claims or show an error message
          // setUserClaims(null);
        }
      } else {
        // setUserClaims(null); // Clear claims on logout
      }

      setLoadingAuth(false); // Auth state determined, stop loading
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="zh-tw">
        <CssBaseline />
        <Router>
          <Routes>
            {/* 管理後台登入頁 */}
            <Route path="/login" element={
              isTestUserLoggedIn() ? (
                <Navigate to="/" replace />
              ) : <LoginPage />
            } />

            {/* 顧客結帳頁面 - 不需要授權 */}
            <Route path="/checkout" element={<CheckoutPage />} />

            {/* 員工PWA路由 */}
            <Route path="/employee/login" element={<EmployeeLoginPage />} />
            <Route path="/employee/punch" element={
              <EmployeeProtectedRoute user={user}>
                <PunchPage />
              </EmployeeProtectedRoute>
            } />

            {/* 管理後台路由 */}
            <Route
              path="/*"
              element={
                <ProtectedRoute user={user}>
                  <MainLayout>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/employees" element={<EmployeeList />} />
                      <Route path="/employees/new" element={<EmployeeForm />} />
                      <Route path="/employees/edit/:id" element={<EmployeeForm isEdit />} />
                      <Route path="/employees/view/:id" element={<EmployeeDetail />} />
                      <Route path="/menu" element={<MenuItemList />} />
                      <Route path="/menu/new" element={
                        <MenuItemForm 
                          onCancel={() => console.log('取消新增菜單項目')} 
                          onSubmit={(menuItem) => console.log('提交菜單項目', menuItem)} 
                        />
                      } />
                      <Route path="/menu/edit/:id" element={
                        <MenuItemForm 
                          menuItem={{ id: 'placeholder', name: '', description: '', categoryId: '', categoryName: '', price: 0, stockStatus: 'in_stock', isRecommended: false, isSpecial: false, isActive: true, createdAt: '', updatedAt: '' }}
                          onCancel={() => console.log('取消編輯菜單項目')} 
                          onSubmit={(menuItem) => console.log('更新菜單項目', menuItem)} 
                        />
                      } />
                      <Route path="/orders" element={<OrderList />} />
                      <Route path="/pos" element={<PosPage />} />
                      <Route path="/attendance" element={<AttendancePage />} />
                      <Route path="/leave" element={<LeaveManagementPage />} />
                      <Route path="/scheduling" element={<SchedulingPage />} />
                      <Route path="/ranking-example" element={<RankingExample />} />
                      <Route path="/comment-board-example" element={<CommentBoardExample />} />
                      <Route path="/notification-example" element={<NotificationExample />} />
                      <Route path="/error-handling-example" element={<ErrorHandlingExample />} />
                      <Route path="/payroll" element={<PayrollPage />} />
                      
                      {/* 庫存管理路由 */}
                      <Route path="/inventory/items" element={<InventoryItemsListPage />} />
                      <Route path="/inventory/adjustments" element={<StockAdjustmentsListPage />} />
                      
                      {/* 股權管理路由 */}
                      <Route path="/equity/config" element={<LegalConfigPage />} />
                      <Route path="/equity/valuations" element={<ValuationHistoryPage />} />
                      <Route path="/equity/pools" element={<EquityPoolsPage />} />
                      <Route path="/equity/holdings" element={<HoldingsListPage />} />
                      <Route path="/equity/dividends" element={<DividendCyclesPage />} />
                      <Route path="/equity/trade-windows" element={<TradeWindowsPage />} />
                      
                      {/* 員工視圖路由 */}
                      <Route path="/employee/equity/my-holdings" element={<MyHoldingsPage />} />
                      <Route path="/employee/equity/my-installments" element={<MyInstallmentsPage />} />
                      
                      {/* CRM 路由 */}
                      <Route path="/crm/customers" element={<CustomerListPage />} />
                      <Route path="/crm/customers/new" element={<CustomerDetailPage />} />
                      <Route path="/crm/customers/edit/:id" element={<CustomerDetailPage />} />
                      <Route path="/crm/customers/view/:id" element={<CustomerDetailPage />} />
                      
                      {/* 忠誠度系統 */}
                      <Route path="/admin/loyalty/tier-rules" element={<LoyaltyTierRulesPage />} />
                      <Route path="/admin/loyalty/rewards" element={<LoyaltyRewardsPage />} />
                      <Route path="/admin/coupons/templates" element={<CouponTemplatesPage />} />
                      
                      <Route path="*" element={<Typography>頁面不存在 (404)</Typography>} />
                    </Routes>
                  </MainLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <NotificationContextProvider>
      <AppWithErrorHandling />
    </NotificationContextProvider>
  );
}

export default App;
