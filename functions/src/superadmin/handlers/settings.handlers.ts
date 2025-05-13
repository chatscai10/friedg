/**
 * 超級管理後台 - 全局設定管理相關處理函數
 */

import * as admin from 'firebase-admin';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { GlobalSettings, GlobalSettingsResponse } from '../types';
import { hasPermission } from '../../libs/rbac';
import { UserInfo, PermissionQuery, ActionType, ResourceType } from '../../libs/rbac/types';

// Firestore 集合和文檔引用
const db = admin.firestore();
const globalSettingsRef = db.collection('globalSettings').doc('main');

// 預設全局設定值
const DEFAULT_GLOBAL_SETTINGS: Omit<GlobalSettings, 'lastUpdated' | 'updatedBy'> = {
  // 系統功能開關
  maintenanceMode: false,
  allowNewRegistrations: true,
  
  // 預設參數
  defaultCurrency: 'TWD',
  defaultLanguage: 'zh-TW',
  supportedLanguages: ['zh-TW', 'en-US'],
  
  // 檔案上傳限制
  maxUploadSizeMB: 10,
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  
  // 安全性設定
  passwordMinLength: 8,
  passwordRequiresSpecialChar: true,
  sessionTimeoutMinutes: 60,
  
  // 廣告系統設定
  adsEnabled: true,
  defaultAdDisplayLimit: 3,
  
  // 推薦系統設定
  referralEnabled: true, 
  referralActivationOrderCount: 5,
  
  // 顧客評價設定
  customerRatingEnabled: true,
  minimumRatingForPublic: 3,
  
  // LINE相關設定
  lineNotifyEnabled: true,
  
  // 系統元數據
  version: '1.0.0'
};

/**
 * 使用 Zod 定義全局設定更新的驗證模式
 */
const globalSettingsUpdateSchema = z.object({
  // 系統功能開關
  maintenanceMode: z.boolean().optional(),
  allowNewRegistrations: z.boolean().optional(),
  
  // 預設參數
  defaultCurrency: z.string().length(3).optional(),
  defaultLanguage: z.string().optional(),
  supportedLanguages: z.array(z.string()).optional(),
  
  // 檔案上傳限制
  maxUploadSizeMB: z.number().min(1).max(100).optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  
  // 安全性設定
  passwordMinLength: z.number().min(6).max(20).optional(),
  passwordRequiresSpecialChar: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().min(5).max(1440).optional(),
  
  // 廣告系統設定
  adsEnabled: z.boolean().optional(),
  defaultAdDisplayLimit: z.number().min(1).max(10).optional(),
  
  // 推薦系統設定
  referralEnabled: z.boolean().optional(),
  referralActivationOrderCount: z.number().min(1).max(100).optional(),
  
  // 顧客評價設定
  customerRatingEnabled: z.boolean().optional(),
  minimumRatingForPublic: z.number().min(1).max(5).optional(),
  
  // LINE相關設定
  lineNotifyEnabled: z.boolean().optional(),
  
  // 系統元數據
  version: z.string().optional()
}).strict();

/**
 * 檢查是否為超級管理員
 * 所有涉及全局設定管理的函數都必須先經過此函數檢查權限
 */
const validateSuperAdminAccess = async (req: any): Promise<boolean> => {
  const requestingUser = req.user;
  
  if (!requestingUser) {
    console.error(`未授權：未提供身份驗證信息`);
    return false;
  }
  
  // 創建用戶信息對象
  const userInfo: UserInfo = {
    uid: requestingUser.uid,
    role: requestingUser.role,
    roleLevel: 0, // 超級管理員 
    tenantId: requestingUser.tenantId,
    storeId: requestingUser.storeId
  };
  
  // 創建權限查詢對象
  const permissionQuery: PermissionQuery = {
    action: 'update' as ActionType,
    resource: 'systemConfigs' as ResourceType
  };
  
  const hasAccess = await hasPermission(
    userInfo,
    permissionQuery,
    {}
  );

  if (!hasAccess.granted) {
    console.warn(`未授權訪問嘗試：用戶 ${requestingUser.uid}（角色：${requestingUser.role}）嘗試訪問全局設定管理API`);
    return false;
  }
  
  return true;
};

/**
 * 獲取全局設定
 * 若文檔不存在，則創建並返回預設值
 */
export const getGlobalSettings = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限管理全局設定'
      });
    }
    
    // 獲取全局設定文檔
    const settingsDoc = await globalSettingsRef.get();
    
    // 檢查文檔是否存在
    if (!settingsDoc.exists) {
      // 如果不存在，創建預設設定
      const now = admin.firestore.Timestamp.now();
      const defaultSettings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        lastUpdated: now,
        updatedBy: req.user.uid
      };
      
      // 寫入預設設定
      await globalSettingsRef.set(defaultSettings);
      
      // 返回預設設定
      return res.status(200).json({
        status: 'success',
        data: {
          ...defaultSettings,
          lastUpdated: now.toDate()
        },
        message: '使用預設值創建全局設定'
      });
    }
    
    // 獲取設定數據並格式化
    const settingsData = settingsDoc.data() as GlobalSettings;
    const formattedSettings = {
      ...settingsData,
      lastUpdated: settingsData.lastUpdated instanceof admin.firestore.Timestamp 
        ? settingsData.lastUpdated.toDate() 
        : settingsData.lastUpdated
    };
    
    return res.status(200).json({
      status: 'success',
      data: formattedSettings,
      message: '成功檢索全局設定'
    });
    
  } catch (error) {
    console.error('獲取全局設定時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '獲取全局設定時發生系統內部錯誤'
    });
  }
};

/**
 * 更新全局設定
 * 允許部分更新 (只更新請求中指定的欄位)
 */
export const updateGlobalSettings = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限管理全局設定'
      });
    }
    
    // 驗證請求數據
    const validationResult = globalSettingsUpdateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    const updateData = validationResult.data;
    
    // 確保有數據要更新
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: '未提供任何要更新的設定'
      });
    }
    
    // 檢查文檔是否存在
    const settingsDoc = await globalSettingsRef.get();
    
    // 準備更新數據
    const now = admin.firestore.Timestamp.now();
    const updatePayload = {
      ...updateData,
      lastUpdated: now,
      updatedBy: req.user.uid
    };
    
    if (!settingsDoc.exists) {
      // 如果文檔不存在，創建完整設定
      const completeSettings = {
        ...DEFAULT_GLOBAL_SETTINGS,
        ...updateData,
        lastUpdated: now,
        updatedBy: req.user.uid
      };
      
      await globalSettingsRef.set(completeSettings);
      
      return res.status(201).json({
        status: 'success',
        message: '全局設定已創建',
        data: {
          ...completeSettings,
          lastUpdated: now.toDate()
        }
      });
    }
    
    // 更新現有文檔 (僅更新指定欄位)
    await globalSettingsRef.update(updatePayload);
    
    // 獲取更新後的設定
    const updatedSettingsDoc = await globalSettingsRef.get();
    const updatedSettingsData = updatedSettingsDoc.data() as GlobalSettings;
    
    return res.status(200).json({
      status: 'success',
      message: '全局設定已更新',
      data: {
        ...updatedSettingsData,
        lastUpdated: updatedSettingsData.lastUpdated instanceof admin.firestore.Timestamp 
          ? updatedSettingsData.lastUpdated.toDate() 
          : updatedSettingsData.lastUpdated
      }
    });
    
  } catch (error) {
    console.error('更新全局設定時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '更新全局設定時發生系統內部錯誤'
    });
  }
}; 