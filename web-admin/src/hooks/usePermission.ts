import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

// 自定義聲明類型
export interface UserClaims {
  role?: string;
  permissions?: string[];
  maxDiscountPercentage?: number;
  maxRefundAmount?: number;
  canDiscount?: boolean;
  canRefund?: boolean;
  [key: string]: any;
}

// 特殊權限類型定義
export interface SpecialPermissions {
  canDiscount: boolean;
  canRefund: boolean;
  maxDiscountPercentage?: number;
  maxRefundAmount?: number;
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

/**
 * 獲取用戶特殊權限限制的Hook
 * @returns SpecialPermissions 包含折扣和退款權限及其限制值
 */
export const useSpecialPermissions = (): { loading: boolean, permissions: SpecialPermissions | null } => {
  const [loading, setLoading] = useState<boolean>(true);
  const [permissions, setPermissions] = useState<SpecialPermissions | null>(null);

  useEffect(() => {
    const fetchSpecialPermissions = async () => {
      try {
        setLoading(true);
        
        // 測試用戶處理
        if (localStorage.getItem('testUserLoggedIn') === 'true') {
          setPermissions({
            canDiscount: true,
            canRefund: true,
            maxDiscountPercentage: 100,
            maxRefundAmount: 10000
          });
          setLoading(false);
          return;
        }
        
        // 獲取當前用戶的自定義聲明
        const claims = await authService.getCurrentUserClaims() as UserClaims;
        
        if (claims) {
          const specialPermissions: SpecialPermissions = {
            canDiscount: claims.canDiscount === true || 
              claims.permissions?.includes('orders:discount') || 
              claims.role === 'admin' || 
              false,
            
            canRefund: claims.canRefund === true || 
              claims.permissions?.includes('orders:refund') || 
              claims.role === 'admin' || 
              false,
            
            maxDiscountPercentage: claims.maxDiscountPercentage,
            maxRefundAmount: claims.maxRefundAmount
          };
          
          // 根據角色設定默認限制值
          if (specialPermissions.canDiscount && specialPermissions.maxDiscountPercentage === undefined) {
            if (claims.role === 'store_manager') {
              specialPermissions.maxDiscountPercentage = 30;
            } else if (claims.role === 'shift_leader') {
              specialPermissions.maxDiscountPercentage = 20;
            } else if (claims.role === 'senior_staff') {
              specialPermissions.maxDiscountPercentage = 10;
            } else if (claims.role === 'admin' || claims.role === 'tenant_admin') {
              specialPermissions.maxDiscountPercentage = 100;
            }
          }
          
          if (specialPermissions.canRefund && specialPermissions.maxRefundAmount === undefined) {
            if (claims.role === 'store_manager') {
              specialPermissions.maxRefundAmount = 2000;
            } else if (claims.role === 'shift_leader') {
              specialPermissions.maxRefundAmount = 500;
            } else if (claims.role === 'admin' || claims.role === 'tenant_admin') {
              specialPermissions.maxRefundAmount = 100000;
            }
          }
          
          setPermissions(specialPermissions);
        } else {
          setPermissions(null);
        }
      } catch (error) {
        console.error('獲取特殊權限時發生錯誤:', error);
        setPermissions(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSpecialPermissions();
  }, []);

  return { loading, permissions };
}; 