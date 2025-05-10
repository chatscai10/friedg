import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

// 自定義聲明類型
interface UserClaims {
  role?: string;
  permissions?: string[];
  [key: string]: any;
}

/**
 * 檢查當前用戶是否擁有指定權限的Hook
 * @param permission 要檢查的權限，例如 'crm:read', 'crm:manage'
 * @returns boolean 是否擁有權限
 */
export const usePermission = (permission: string): boolean => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        // 從localStorage檢查測試用戶登入狀態，如果是測試用戶，授予所有權限
        if (localStorage.getItem('testUserLoggedIn') === 'true') {
          setHasPermission(true);
          return;
        }
        
        // 獲取當前用戶的自定義聲明（包含權限）
        const claims = await authService.getCurrentUserClaims() as UserClaims;
        
        // 檢查是否有特定權限或超級管理員權限
        if (claims && (
          claims.permissions?.includes(permission) || 
          claims.permissions?.includes('admin:all') || 
          claims.role === 'admin'
        )) {
          setHasPermission(true);
        } else {
          setHasPermission(false);
        }
      } catch (error) {
        console.error('檢查權限時發生錯誤:', error);
        setHasPermission(false);
      }
    };

    checkPermission();
  }, [permission]);

  return hasPermission;
}; 