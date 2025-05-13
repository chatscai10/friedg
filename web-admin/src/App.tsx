import * as React from 'react';
import { ThemeProvider, CssBaseline, CircularProgress } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import theme from './styles/theme';

// 頁面
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

// 路由保護組件
import ProtectedRoute from './components/common/ProtectedRoute';

// 懶加載頁面，減少初始加載時間
const UsersPage = React.lazy(() => import('./pages/UsersPage'));
const RolesPage = React.lazy(() => import('./pages/RolesPage'));
const RoleFormPage = React.lazy(() => import('./pages/RoleFormPage'));
const StoresPage = React.lazy(() => import('./pages/StoresPage'));
const EmployeesPage = React.lazy(() => import('./pages/EmployeesPage'));
const MenuPage = React.lazy(() => import('./pages/MenuPage'));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage'));
const PosPage = React.lazy(() => import('./pages/PosPage'));
const AttendancePage = React.lazy(() => import('./pages/AttendancePage'));
const LineCallbackPage = React.lazy(() => import('./pages/LineCallbackPage'));

// 全局加載中組件
const LoadingComponent = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </div>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <React.Suspense fallback={<LoadingComponent />}>
          <Routes>
            {/* 公開路由 - 不需要登入 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/line-callback" element={<LineCallbackPage />} />
            
            {/* 基本受保護路由 - 需要登入但不檢查權限 */}
            <Route element={<ProtectedRoute />}>
              {/* 儀表板（默認頁面) */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              
              {/* POS系統頁面 */}
              <Route path="/pos" element={<PosPage />} />
            </Route>
            
            {/* 管理員路由 - 需要 admin、super_admin 或 tenant_admin 角色 */}
            <Route 
              element={
                <ProtectedRoute 
                  allowedRoles={['admin', 'super_admin', 'tenant_admin']} 
                />
              }
            >
              <Route path="/users" element={<UsersPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/roles/create" element={<RoleFormPage />} />
              <Route path="/roles/edit/:roleId" element={<RoleFormPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
            </Route>
            
            {/* 店鋪管理路由 - 需要管理員或店長角色 */}
            <Route 
              element={
                <ProtectedRoute 
                  allowedRoles={['admin', 'super_admin', 'tenant_admin', 'store_manager']} 
                />
              }
            >
              <Route path="/stores" element={<StoresPage />} />
            </Route>
            
            {/* 菜單管理路由 - 需要管理員或店長或具備菜單管理權限 */}
            <Route 
              element={
                <ProtectedRoute 
                  allowedRoles={['admin', 'super_admin', 'tenant_admin', 'store_manager']}
                  requiredPermissions={['menu:read']}
                />
              }
            >
              <Route path="/menu" element={<MenuPage />} />
            </Route>
            
            {/* 訂單管理路由 - 需要管理員或店長或具備訂單管理權限 */}
            <Route 
              element={
                <ProtectedRoute 
                  allowedRoles={['admin', 'super_admin', 'tenant_admin', 'store_manager']}
                  requiredPermissions={['orders:read']}
                />
              }
            >
              <Route path="/orders" element={<OrdersPage />} />
            </Route>

            {/* 考勤管理路由 - 需要管理員或店長或具備考勤管理權限 */}
            <Route 
              element={
                <ProtectedRoute 
                  allowedRoles={['admin', 'super_admin', 'tenant_admin', 'store_manager']}
                  requiredPermissions={['attendance:read']}
                />
              }
            >
              <Route path="/attendance" element={<AttendancePage />} />
            </Route>
            
            {/* 處理未匹配的路由 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
