import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { loginUser, logoutUser, clearAuthError } from '../store/authSlice';
import { AuthenticatedUser } from '../types/user.types';

/**
 * 自定義 Hook 提供身份驗證相關功能和狀態
 */
export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, user, token, loading, error } = useSelector(
    (state: RootState) => state.auth
  );

  /**
   * 登入函數
   * @param email 用戶郵箱
   * @param password 用戶密碼
   */
  const login = async (email: string, password: string) => {
    return dispatch(loginUser({ email, password })).unwrap();
  };

  /**
   * 登出函數
   */
  const logout = async () => {
    return dispatch(logoutUser()).unwrap();
  };

  /**
   * 清除錯誤
   */
  const clearError = () => {
    dispatch(clearAuthError());
  };

  /**
   * 檢查用戶是否擁有特定角色
   * @param role 要檢查的角色
   * @returns 是否擁有該角色
   */
  const hasRole = (role: string): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.includes(role);
  };

  /**
   * 檢查用戶是否擁有特定權限
   * @param permission 要檢查的權限
   * @returns 是否擁有該權限
   */
  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  };

  /**
   * 檢查用戶是否至少擁有指定角色列表中的一個
   * @param roles 要檢查的角色列表
   * @returns 是否至少擁有其中一個角色
   */
  const hasAnyRole = (roles: string[]): boolean => {
    if (!user || !user.roles) return false;
    return user.roles.some(role => roles.includes(role));
  };

  return {
    isAuthenticated,
    user,
    token,
    loading,
    error,
    login,
    logout,
    clearError,
    hasRole,
    hasPermission,
    hasAnyRole,
  };
}; 