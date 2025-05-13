import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import MainLayout from '../../layouts/MainLayout';
import { Box, CircularProgress, Typography } from '@mui/material';

// ProtectedRoute 組件參數接口
interface ProtectedRouteProps {
  // 允許訪問的角色列表（可選）
  allowedRoles?: string[];
  // 需要的權限列表（可選）
  requiredPermissions?: string[];
  // 重定向路徑，默認為登入頁
  redirectPath?: string;
  // 是否使用主佈局
  useMainLayout?: boolean;
}

/**
 * 受保護的路由組件
 * 確保只有已認證的用戶可以訪問特定路由
 * 可選地，還可以基於角色或權限控制訪問
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  requiredPermissions,
  redirectPath = '/login',
  useMainLayout = true
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  // 如果正在加載認證狀態，顯示一個加載指示器
  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          bgcolor: '#f5f5f5'
        }}
      >
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          驗證用戶身份中...
        </Typography>
      </Box>
    );
  }
  
  // 檢查用戶是否已認證
  if (!isAuthenticated) {
    // 未認證，重定向到登入頁面
    return <Navigate to={redirectPath} replace />;
  }
  
  // 檢查角色權限（如果指定）
  if (allowedRoles && allowedRoles.length > 0 && user) {
    const hasRequiredRole = user.roles.some(role => allowedRoles.includes(role));
    if (!hasRequiredRole) {
      // 用戶沒有必要的角色，重定向到未授權頁面
      return <Navigate to="/unauthorized" replace />;
    }
  }
  
  // 檢查權限（如果指定）
  if (requiredPermissions && requiredPermissions.length > 0 && user) {
    const hasAllRequiredPermissions = requiredPermissions.every(permission =>
      user.permissions.includes(permission)
    );
    if (!hasAllRequiredPermissions) {
      // 用戶沒有必要的權限，重定向到未授權頁面
      return <Navigate to="/unauthorized" replace />;
    }
  }
  
  // 通過所有檢查，渲染子路由
  // 如果啟用主佈局，則用MainLayout包裹子路由
  return useMainLayout ? (
    <MainLayout>
      <Outlet />
    </MainLayout>
  ) : (
    <Outlet />
  );
};

export default ProtectedRoute; 