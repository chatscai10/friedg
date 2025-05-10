import { Request, Response, NextFunction } from 'express';
import { UserContext } from '../stores/stores.types';

/**
 * 權限檢查中間件
 * 檢查用戶是否有特定資源的特定操作權限
 * @param resource 資源名稱（如 'stores', 'users' 等）
 * @param action 操作類型（'create', 'read', 'update', 'delete'）
 */
export const checkPermissions = (resource: string, action: 'create' | 'read' | 'update' | 'delete') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as UserContext;
      
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: '未授權：缺少有效的用戶上下文'
        });
      }
      
      // 超級管理員有所有權限
      if (user.role === 'super_admin') {
        return next();
      }
      
      // 檢查用戶是否有指定資源的指定操作權限
      const hasPermission = user.permissions?.[resource]?.[action] || false;
      
      // 根據用戶角色自動分配一些權限
      // 例如：租戶管理員可以讀取所有租戶內的資源
      if (!hasPermission) {
        // 租戶管理員權限
        if (user.role === 'tenant_admin') {
          if (action === 'read') {
            // 租戶管理員可以讀取所有資源
            return next();
          }
          
          if (['create', 'update', 'delete'].includes(action) && 
              ['stores', 'staff', 'menus', 'settings'].includes(resource)) {
            // 租戶管理員可以創建、更新和刪除分店、員工、菜單和設定
            return next();
          }
        }
        
        // 分店管理員權限
        if (user.role === 'store_manager') {
          if (action === 'read') {
            // 分店管理員可以讀取所有資源
            return next();
          }
          
          if (['update'].includes(action) && 
              ['stores', 'staff', 'orders'].includes(resource)) {
            // 分店管理員可以更新分店資訊、員工和訂單
            // 但需要在對應的 handler 中做進一步檢查（只能修改自己的分店）
            return next();
          }
        }
        
        // 店員權限
        if (user.role === 'staff') {
          if (action === 'read' && 
              ['stores', 'menus', 'orders'].includes(resource)) {
            // 店員可以讀取分店、菜單和訂單
            return next();
          }
          
          if (action === 'update' && ['orders'].includes(resource)) {
            // 店員可以更新訂單
            return next();
          }
        }
      } else {
        // 用戶直接擁有所需權限
        return next();
      }
      
      // 若到達這裡，表示用戶沒有所需權限
      console.warn(`權限被拒絕：用戶 ${user.uid} (角色 ${user.role}) 嘗試對資源 ${resource} 執行操作 ${action}`);
      
      return res.status(403).json({
        status: 'error',
        message: '拒絕訪問：您沒有執行此操作的權限'
      });
      
    } catch (error: any) {
      console.error('權限檢查時發生錯誤：', error);
      
      return res.status(500).json({
        status: 'error',
        message: '處理請求時發生錯誤',
        details: error.message
      });
    }
  };
}; 