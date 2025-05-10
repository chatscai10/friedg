import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

/**
 * 角色權限驗證中間件
 * 
 * @param allowedRoles 允許訪問的角色列表
 * @returns 中間件函式
 */
export const validateRoles = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          code: 'UNAUTHENTICATED',
          message: '用戶未認證'
        });
      }

      const userRole = req.user.role;

      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          code: 'PERMISSION_DENIED',
          message: '您沒有權限執行此操作'
        });
      }

      return next();
    } catch (error) {
      console.error('角色驗證失敗:', error);
      return res.status(500).json({
        code: 'INTERNAL_SERVER_ERROR',
        message: '伺服器內部錯誤'
      });
    }
  };
}; 