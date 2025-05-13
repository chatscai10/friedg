/**
 * 超級管理後台 - 服務方案管理相關處理函數
 */

import * as admin from 'firebase-admin';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  ServicePlan, 
  ServicePlanStatus, 
  ServicePlanInput, 
  BillingCycle,
  ServicePlanResponse,
  PlanFeatures,
  PlanLimits
} from '../types';
import { hasPermission } from '../../libs/rbac';
import { UserInfo, PermissionQuery, ActionType, ResourceType } from '../../libs/rbac/types';

// Firestore 集合引用
const db = admin.firestore();
const servicePlansCollection = db.collection('servicePlans');

/**
 * 使用 Zod 定義服務方案輸入驗證模式
 */
const planFeaturesSchema = z.object({
  basic_ordering: z.boolean(),
  advanced_ordering: z.boolean(),
  basic_inventory: z.boolean(),
  advanced_inventory: z.boolean(),
  staff_management: z.boolean(),
  marketing_tools: z.boolean(),
  analytics_reports: z.boolean(),
  customer_management: z.boolean(),
  multiple_locations: z.boolean(),
  api_access: z.boolean(),
  white_label: z.boolean()
}).catchall(z.boolean());

const planLimitsSchema = z.object({
  maxStores: z.number().int().min(1),
  maxUsers: z.number().int().min(1),
  maxMenuItems: z.number().int().min(0),
  maxProducts: z.number().int().min(0),
  maxOrders: z.number().int().min(0),
  storageLimit: z.number().int().min(0)
}).catchall(z.number());

const servicePlanSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  description: z.string().min(1),
  status: z.enum([ServicePlanStatus.ACTIVE, ServicePlanStatus.INACTIVE]),
  price: z.number().min(0),
  currency: z.string().length(3), // 貨幣代碼通常為3位字母
  billingCycle: z.enum([BillingCycle.MONTHLY, BillingCycle.YEARLY]),
  features: planFeaturesSchema,
  limits: planLimitsSchema,
  isRecommended: z.boolean().optional().default(false),
  trialDays: z.number().int().min(0).optional().default(0),
  sortOrder: z.number().int().min(0).optional().default(100)
});

/**
 * 使用 Zod 定義更新方案狀態的驗證模式
 */
const planStatusUpdateSchema = z.object({
  status: z.enum([ServicePlanStatus.ACTIVE, ServicePlanStatus.INACTIVE])
}).strict();

/**
 * 檢查是否為超級管理員
 * 所有涉及方案管理的函數都必須先經過此函數檢查權限
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
    console.warn(`未授權訪問嘗試：用戶 ${requestingUser.uid}（角色：${requestingUser.role}）嘗試訪問服務方案管理API`);
    return false;
  }
  
  return true;
};

/**
 * 創建新的服務方案
 */
export const createServicePlan = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限管理服務方案'
      });
    }
    
    // 驗證請求數據
    const validationResult = servicePlanSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    const planData = validationResult.data;
    
    // 檢查方案代碼是否已存在
    const existingPlanQuery = await servicePlansCollection
      .where('code', '==', planData.code)
      .get();
      
    if (!existingPlanQuery.empty) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: `方案代碼 '${planData.code}' 已存在，請使用不同的代碼`
      });
    }
    
    // 準備要存儲的數據
    const now = admin.firestore.Timestamp.now();
    const newPlan = {
      ...planData,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.uid
    };
    
    // 寫入數據庫
    const docRef = await servicePlansCollection.add(newPlan);
    
    // 重新獲取創建的方案（包含ID）
    const createdDoc = await docRef.get();
    const createdPlan = {
      id: createdDoc.id,
      ...createdDoc.data(),
      createdAt: createdDoc.data()!.createdAt.toDate().toISOString(),
      updatedAt: createdDoc.data()!.updatedAt.toDate().toISOString()
    };
    
    return res.status(201).json({
      status: 'success',
      data: createdPlan,
      message: '服務方案創建成功'
    });
    
  } catch (error) {
    console.error('創建服務方案時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '創建服務方案時發生系統內部錯誤'
    });
  }
};

/**
 * 獲取單一服務方案詳情
 */
export const getServicePlanById = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限管理服務方案'
      });
    }
    
    // 獲取方案ID
    const planId = req.params.planId;
    
    if (!planId) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: '缺少方案ID參數'
      });
    }
    
    // 獲取方案文檔
    const planRef = servicePlansCollection.doc(planId);
    const planDoc = await planRef.get();
    
    if (!planDoc.exists) {
      return res.status(404).json({
        status: 'error',
        errorCode: 'E404',
        message: `未找到ID為 ${planId} 的服務方案`
      });
    }
    
    // 獲取方案數據並格式化日期
    const planData = planDoc.data();
    const plan: ServicePlan = {
      ...planData as any,
      id: planDoc.id,
      createdAt: planData!.createdAt.toDate(),
      updatedAt: planData!.updatedAt.toDate()
    };
    
    return res.status(200).json({
      status: 'success',
      data: plan,
      message: '成功檢索服務方案詳情'
    });
    
  } catch (error) {
    console.error('獲取服務方案詳情時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '獲取服務方案詳情時發生系統內部錯誤'
    });
  }
};

/**
 * 獲取所有服務方案
 */
export const listServicePlans = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限管理服務方案'
      });
    }
    
    // 構建查詢
    let query: any = servicePlansCollection;
    
    // 只顯示特定狀態的方案（如果有指定）
    if (req.query.status) {
      const status = req.query.status;
      if (status === ServicePlanStatus.ACTIVE || status === ServicePlanStatus.INACTIVE) {
        query = query.where('status', '==', status);
      }
    }
    
    // 添加排序（按排序值升序，名稱升序）
    query = query.orderBy('sortOrder', 'asc').orderBy('name', 'asc');
    
    // 執行查詢
    const plansSnapshot = await query.get();
    
    if (plansSnapshot.empty) {
      return res.status(200).json({
        status: 'success',
        data: [],
        message: '沒有任何服務方案'
      });
    }
    
    // 處理查詢結果
    const plans: ServicePlan[] = [];
    
    plansSnapshot.forEach((doc: any) => {
      const plan = doc.data();
      
      // 將 Firestore Timestamp 轉換為 ISO 日期字符串
      const formattedPlan = {
        ...plan,
        id: doc.id,
        createdAt: plan.createdAt.toDate(),
        updatedAt: plan.updatedAt.toDate()
      };
      
      plans.push(formattedPlan as ServicePlan);
    });
    
    return res.status(200).json({
      status: 'success',
      data: plans,
      message: `成功檢索 ${plans.length} 個服務方案`
    });
    
  } catch (error) {
    console.error('獲取服務方案列表時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '獲取服務方案列表時發生系統內部錯誤'
    });
  }
};

/**
 * 更新服務方案
 */
export const updateServicePlan = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限管理服務方案'
      });
    }
    
    // 獲取方案ID
    const planId = req.params.planId;
    
    if (!planId) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: '缺少方案ID參數'
      });
    }
    
    // 驗證請求數據
    const validationResult = servicePlanSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    const updateData = validationResult.data;
    
    // 獲取方案引用
    const planRef = servicePlansCollection.doc(planId);
    const planDoc = await planRef.get();
    
    if (!planDoc.exists) {
      return res.status(404).json({
        status: 'error',
        errorCode: 'E404',
        message: `未找到ID為 ${planId} 的服務方案`
      });
    }
    
    // 檢查方案代碼是否已被其他方案使用
    if (updateData.code !== planDoc.data()!.code) {
      const existingPlanQuery = await servicePlansCollection
        .where('code', '==', updateData.code)
        .get();
        
      if (!existingPlanQuery.empty) {
        return res.status(400).json({
          status: 'error',
          errorCode: 'E400',
          message: `方案代碼 '${updateData.code}' 已存在，請使用不同的代碼`
        });
      }
    }
    
    // 記錄操作用戶信息
    const requestingUser = req.user;
    
    // 準備更新數據
    const now = admin.firestore.Timestamp.now();
    const updatePayload = {
      ...updateData,
      updatedAt: now,
      updatedBy: requestingUser.uid
    };
    
    // 執行更新
    await planRef.update(updatePayload);
    
    // 獲取更新後的方案數據
    const updatedPlanDoc = await planRef.get();
    const updatedPlanData = updatedPlanDoc.data();
    
    return res.status(200).json({
      status: 'success',
      message: `成功更新服務方案 ${updatedPlanData!.name}`,
      data: {
        id: updatedPlanDoc.id,
        ...updatedPlanData,
        updatedAt: updatedPlanData!.updatedAt.toDate().toISOString()
      }
    });
    
  } catch (error) {
    console.error('更新服務方案時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '更新服務方案時發生系統內部錯誤'
    });
  }
};

/**
 * 更新服務方案狀態
 */
export const updateServicePlanStatus = async (req: any, res: any) => {
  try {
    // 驗證超級管理員權限
    const isAuthorized = await validateSuperAdminAccess(req);
    if (!isAuthorized) {
      return res.status(403).json({
        status: 'error',
        errorCode: 'E401',
        message: '未授權：您沒有權限管理服務方案'
      });
    }
    
    // 獲取方案ID
    const planId = req.params.planId;
    
    if (!planId) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: '缺少方案ID參數'
      });
    }
    
    // 驗證請求數據
    const validationResult = planStatusUpdateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'E400',
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    const { status } = validationResult.data;
    
    // 獲取方案引用
    const planRef = servicePlansCollection.doc(planId);
    const planDoc = await planRef.get();
    
    if (!planDoc.exists) {
      return res.status(404).json({
        status: 'error',
        errorCode: 'E404',
        message: `未找到ID為 ${planId} 的服務方案`
      });
    }
    
    // 如果狀態相同，則無需更新
    if (planDoc.data()!.status === status) {
      return res.status(200).json({
        status: 'success',
        message: `服務方案 ${planDoc.data()!.name} 已經是 ${status} 狀態`,
        data: {
          id: planDoc.id,
          ...planDoc.data(),
          updatedAt: planDoc.data()!.updatedAt.toDate().toISOString()
        }
      });
    }
    
    // 記錄操作用戶信息
    const requestingUser = req.user;
    
    // 準備更新數據
    const updatePayload = {
      status,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: requestingUser.uid
    };
    
    // 執行更新
    await planRef.update(updatePayload);
    
    // 獲取更新後的方案數據
    const updatedPlanDoc = await planRef.get();
    const updatedPlanData = updatedPlanDoc.data();
    
    return res.status(200).json({
      status: 'success',
      message: `成功將服務方案 ${updatedPlanData!.name} 的狀態更新為 ${status}`,
      data: {
        id: updatedPlanDoc.id,
        ...updatedPlanData,
        updatedAt: updatedPlanData!.updatedAt.toDate().toISOString()
      }
    });
    
  } catch (error) {
    console.error('更新服務方案狀態時出錯:', error);
    return res.status(500).json({
      status: 'error',
      errorCode: 'E500',
      message: '更新服務方案狀態時發生系統內部錯誤'
    });
  }
}; 