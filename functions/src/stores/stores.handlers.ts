import { Request, Response } from 'express';
import { firestore } from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  Store, 
  CreateStoreRequest, 
  UpdateStoreRequest, 
  UpdateStoreStatusRequest,
  GPSFenceRequest,
  PrinterConfigRequest,
  PaginatedStoreResponse,
  UserContext,
  BusinessHours
} from './stores.types';
import { storeService, StoreFilter } from './stores.service';
import {
  ApiStore,
  ApiCreateStoreRequest,
  ApiUpdateStoreRequest,
  ApiUpdateStoreStatusRequest,
  toApiStore,
  toApiStores,
  fromApiCreateRequest,
  fromApiUpdateRequest,
  fromApiStatusUpdateRequest
} from './stores.adapter';

// 獲取 Firestore 實例
const db = firestore();
const storesCollection = db.collection('stores');

// 生成唯一的分店 ID (格式: store_{隨機字符})
function generateStoreId(): string {
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `store_${randomStr}`;
}

/**
 * 獲取分店列表
 * GET /stores
 */
export const listStores = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取查詢參數
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const sort = req.query.sort as string || 'createdAt';
    const order = (req.query.order as 'asc' | 'desc') || 'desc';
    const isActive = req.query.isActive ? req.query.isActive === 'true' : undefined;
    const query = req.query.query as string;
    
    // 構建過濾條件
    const filter: StoreFilter = {
      page,
      limit,
      sort,
      order,
      isActive,
      query
    };
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取租戶 ID (除非是超級管理員，否則必須有租戶 ID)
    if (!user.tenantId && user.role !== 'super_admin') {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }

    try {
      // 使用服務層獲取店鋪列表
      const result = await storeService.listStores(filter, user);
      
      // 將內部模型轉換為API模型
      const apiStores = toApiStores(result.stores);
      
      // 構建分頁響應
      const response: any = {
        status: 'success',
        data: apiStores,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      };

      return res.status(200).json(response);
    } catch (error: any) {
      // 處理權限錯誤
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
  } catch (error: any) {
    console.error('獲取分店列表時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 獲取單個分店
 * GET /stores/{storeId}
 */
export const getStoreById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 驗證路徑參數
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 storeId 參數'
      });
    }
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    try {
      // 使用服務層獲取店鋪數據
      const store = await storeService.getStoreById(storeId, user);
      
      if (!store) {
        return res.status(404).json({
          status: 'error',
          message: `未找到 ID 為 ${storeId} 的分店`
        });
      }

      // 將內部模型轉換為API模型
      const apiStore = toApiStore(store);

      return res.status(200).json({
        status: 'success',
        data: apiStore
      });
    } catch (error: any) {
      // 處理權限錯誤
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
  } catch (error: any) {
    console.error('獲取分店資料時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 創建新分店
 * POST /stores
 */
export const createStore = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取API規範請求數據並轉換為內部模型
    const apiRequestData = req.body as ApiCreateStoreRequest;
    const requestData: CreateStoreRequest = fromApiCreateRequest(apiRequestData);
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 租戶隔離 - 確保是同一租戶
    if (user.role !== 'super_admin') {
      const tenantId = user.tenantId;
      
      if (!tenantId) {
        console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
        return res.status(403).json({
          status: 'error',
          message: '未授權：請求用戶上下文無效（缺少 tenantId）'
        });
      }
      
      // 確保使用者無法為其他租戶創建分店
      if (requestData.tenantId !== tenantId) {
        console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試為其他租戶創建分店`);
        return res.status(403).json({
          status: 'error',
          message: '未授權：您無法為其他租戶創建分店'
        });
      }
    }
    
    // 檢查權限 - 只有租戶管理員及以上角色可以創建分店
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      console.warn(`權限拒絕：用戶 ${user.uid} (角色 ${user.role}) 嘗試創建分店`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有租戶管理員及以上角色可以創建分店'
      });
    }
    
    // 生成分店 ID
    const storeId = generateStoreId();
    
    // 創建分店數據
    const storeData: Store = {
      storeId,
      storeName: requestData.storeName,
      storeCode: requestData.storeCode,
      address: requestData.address,
      phoneNumber: requestData.phoneNumber,
      contactPerson: requestData.contactPerson,
      email: requestData.email,
      tenantId: requestData.tenantId,
      isActive: requestData.isActive !== undefined ? requestData.isActive : true,
      geolocation: requestData.geolocation || null,
      gpsFence: requestData.gpsFence || null,
      businessHours: requestData.businessHours || null,
      printerConfig: requestData.printerConfig || null,
      settings: requestData.settings || {},
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
      createdBy: user.uid,
      updatedBy: user.uid
    };
    
    // 儲存到 Firestore
    await storesCollection.doc(storeId).set(storeData);
    console.log(`成功創建分店：${storeId}`);
    
    // 返回成功響應
    const now = new Date().toISOString();
    const responseData = {
      ...storeData,
      createdAt: now,
      updatedAt: now
    };
    
    // 將內部模型轉換為API模型再返回
    const apiResponseData = toApiStore(responseData);
    
    return res.status(201).json({
      status: 'success',
      data: apiResponseData
    });
    
  } catch (error: any) {
    console.error('創建分店時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新分店
 * PUT /stores/{storeId}
 */
export const updateStore = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 驗證路徑參數
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 storeId 參數'
      });
    }
    
    // 獲取API規範請求數據並轉換為內部模型
    const apiUpdateData = req.body as ApiUpdateStoreRequest;
    const updateData: UpdateStoreRequest = fromApiUpdateRequest(apiUpdateData);
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取當前分店資料
    const storeDoc = await storesCollection.doc(storeId).get();
    
    // 檢查分店是否存在
    if (!storeDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${storeId} 的分店`
      });
    }
    
    const storeData = storeDoc.data() as Store;
    
    // 租戶隔離 - 非超級管理員只能更新自己租戶的分店
    if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試更新其他租戶的分店`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法更新其他租戶的分店'
      });
    }
    
    // 權限檢查 - 只有租戶管理員、分店經理及以上可以更新分店
    const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
    if (!allowedRoles.includes(user.role)) {
      // 如果不是分店經理，或者是分店經理但不是管理該分店
      if (user.role === 'store_manager' && user.storeId !== storeId) {
        console.warn(`權限拒絕：分店經理 ${user.uid} 嘗試更新非其管理的分店 ${storeId}`);
        return res.status(403).json({
          status: 'error',
          message: '未授權：分店經理只能更新自己管理的分店'
        });
      }
      
      console.warn(`權限拒絕：用戶 ${user.uid} (角色 ${user.role}) 嘗試更新分店`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有租戶管理員、分店經理及以上角色可以更新分店'
      });
    }
    
    // 構建更新數據
    const updateObject: any = {
      ...updateData,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid
    };
    
    // 禁止更改某些欄位
    delete updateObject.storeId;
    delete updateObject.tenantId;
    delete updateObject.createdAt;
    delete updateObject.createdBy;
    
    // 執行更新操作
    await storesCollection.doc(storeId).update(updateObject);
    console.log(`成功更新分店 ${storeId}`);
    
    // 獲取更新後的分店資料
    const updatedStoreDoc = await storesCollection.doc(storeId).get();
    const updatedStoreData = updatedStoreDoc.data() as Store;
    
    // 處理 Firestore 時間戳
    let formattedStore = { ...updatedStoreData };
    
    if (formattedStore.createdAt && typeof formattedStore.createdAt !== 'string') {
      formattedStore.createdAt = formattedStore.createdAt.toDate().toISOString();
    }
    
    if (formattedStore.updatedAt && typeof formattedStore.updatedAt !== 'string') {
      formattedStore.updatedAt = formattedStore.updatedAt.toDate().toISOString();
    }
    
    // 將內部模型轉換為API模型
    const apiResponseData = toApiStore(formattedStore);
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      data: apiResponseData
    });
    
  } catch (error: any) {
    console.error('更新分店時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新分店狀態
 * PATCH /stores/{storeId}/status
 */
export const updateStoreStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 驗證路徑參數
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 storeId 參數'
      });
    }
    
    // 獲取API規範請求數據並轉換為內部模型
    const apiStatusRequest = req.body as ApiUpdateStoreStatusRequest;
    const { isActive } = fromApiStatusUpdateRequest(apiStatusRequest);
    
    if (isActive === undefined) {
      return res.status(400).json({
        status: 'error',
        message: '請提供有效的狀態值'
      });
    }
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取當前分店資料
    const storeDoc = await storesCollection.doc(storeId).get();
    
    // 檢查分店是否存在
    if (!storeDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${storeId} 的分店`
      });
    }
    
    const storeData = storeDoc.data() as Store;
    
    // 租戶隔離 - 非超級管理員只能更新自己租戶的分店
    if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試更新其他租戶的分店狀態`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法更新其他租戶的分店狀態'
      });
    }
    
    // 權限檢查 - 只有租戶管理員及以上可以更新分店狀態
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      console.warn(`權限拒絕：用戶 ${user.uid} (角色 ${user.role}) 嘗試更新分店狀態`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有租戶管理員及以上角色可以更新分店狀態'
      });
    }
    
    // 執行更新操作
    await storesCollection.doc(storeId).update({
      isActive,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid
    });
    console.log(`成功更新分店 ${storeId} 的狀態為 ${isActive ? '活動' : '不活動'}`);
    
    // 獲取更新後的分店資料
    const updatedStoreDoc = await storesCollection.doc(storeId).get();
    const updatedStoreData = updatedStoreDoc.data() as Store;
    
    // 轉換為API模型
    const apiStore = toApiStore(updatedStoreData);
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      data: {
        id: apiStore.id,
        status: apiStore.status,
        updatedAt: apiStore.updatedAt
      }
    });
    
  } catch (error: any) {
    console.error('更新分店狀態時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 刪除分店
 * DELETE /stores/{storeId}
 */
export const deleteStore = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 驗證路徑參數
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 storeId 參數'
      });
    }
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取當前分店資料
    const storeDoc = await storesCollection.doc(storeId).get();
    
    // 檢查分店是否存在
    if (!storeDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${storeId} 的分店`
      });
    }
    
    const storeData = storeDoc.data() as Store;
    
    // 租戶隔離 - 非超級管理員只能刪除自己租戶的分店
    if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試刪除其他租戶的分店`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法刪除其他租戶的分店'
      });
    }
    
    // 權限檢查 - 只有租戶管理員及以上可以刪除分店
    if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
      console.warn(`權限拒絕：用戶 ${user.uid} (角色 ${user.role}) 嘗試刪除分店`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有租戶管理員及以上角色可以刪除分店'
      });
    }
    
    // 檢查分店是否正在使用（檢查是否有員工關聯到此分店）
    // TODO: 實際實作可能需要更複雜的檢查
    
    // 在實際專案中，通常不會物理刪除分店，而是邏輯刪除
    // 這裡展示兩種方式：
    
    if (req.query.hardDelete === 'true' && user.role === 'super_admin') {
      // 物理刪除 (僅限超級管理員)
      await storesCollection.doc(storeId).delete();
      console.log(`成功物理刪除分店 ${storeId}`);
      
      return res.status(204).json();
    } else {
      // 邏輯刪除 (將狀態設為不活動並標記為刪除)
      await storesCollection.doc(storeId).update({
        isActive: false,
        isDeleted: true,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
      console.log(`成功邏輯刪除分店 ${storeId}`);
      
      return res.status(200).json({
        status: 'success',
        message: `分店 ${storeId} 已成功標記為刪除`
      });
    }
    
  } catch (error: any) {
    console.error('刪除分店時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新分店地理位置
 * PUT /stores/{storeId}/location
 */
export const updateStoreLocation = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 驗證路徑參數
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 storeId 參數'
      });
    }
    
    // 獲取經過驗證的請求數據
    const locationData = req.body;
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    try {
      // 使用服務層更新店鋪位置
      const updatedStore = await storeService.updateStoreLocation(storeId, locationData, user);
      
      // 檢查店鋪是否存在
      if (!updatedStore) {
        return res.status(404).json({
          status: 'error',
          message: `未找到 ID 為 ${storeId} 的分店`
        });
      }
      
      // 將內部模型轉換為API模型
      const apiStore = toApiStore(updatedStore);
      
      // 返回成功響應，只包含位置相關資訊
      return res.status(200).json({
        status: 'success',
        message: '成功更新店鋪地理位置',
        data: {
          id: apiStore.id,
          location: apiStore.location,
          gpsFence: apiStore.gpsFence,
          updatedAt: apiStore.updatedAt
        }
      });
    } catch (error: any) {
      // 處理權限錯誤
      if (error.message && error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      // 處理資料驗證錯誤
      if (error.message && (
        error.message.includes('無效的緯度') || 
        error.message.includes('無效的經度') || 
        error.message.includes('無效的地理圍欄半徑')
      )) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
  } catch (error: any) {
    console.error('更新分店地理位置時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新分店 GPS 圍欄
 * PUT /stores/{storeId}/gps-fence
 */
export const updateGPSFence = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 驗證路徑參數
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 storeId 參數'
      });
    }
    
    // 獲取經過驗證的請求數據
    const gpsFenceData: GPSFenceRequest = req.body;
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取當前分店資料
    const storeDoc = await storesCollection.doc(storeId).get();
    
    // 檢查分店是否存在
    if (!storeDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${storeId} 的分店`
      });
    }
    
    const storeData = storeDoc.data() as Store;
    
    // 租戶隔離 - 非超級管理員只能更新自己租戶的分店
    if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試更新其他租戶的分店 GPS 圍欄`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法更新其他租戶的分店 GPS 圍欄'
      });
    }
    
    // 權限檢查 - 只有租戶管理員、分店經理及以上可以更新 GPS 圍欄
    const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
    if (!allowedRoles.includes(user.role)) {
      console.warn(`權限拒絕：用戶 ${user.uid} (角色 ${user.role}) 嘗試更新分店 GPS 圍欄`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有租戶管理員、分店經理及以上角色可以更新分店 GPS 圍欄'
      });
    }
    
    // 分店經理只能更新自己管理的分店
    if (user.role === 'store_manager' && user.storeId !== storeId) {
      console.warn(`權限拒絕：分店經理 ${user.uid} 嘗試更新非其管理的分店 ${storeId} 的 GPS 圍欄`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：分店經理只能更新自己管理的分店 GPS 圍欄'
      });
    }
    
    // 執行更新操作
    await storesCollection.doc(storeId).update({
      gpsFence: gpsFenceData,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid
    });
    console.log(`成功更新分店 ${storeId} 的 GPS 圍欄`);
    
    // 獲取更新後的店鋪數據
    const updatedStoreDoc = await storesCollection.doc(storeId).get();
    const updatedStoreData = updatedStoreDoc.data() as Store;
    
    // 將內部模型轉換為API模型
    const apiStore = toApiStore(updatedStoreData);
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      data: {
        enabled: apiStore.gpsFence?.enabled,
        radius: apiStore.gpsFence?.radius,
        center: apiStore.gpsFence?.center,
        updatedAt: apiStore.updatedAt
      }
    });
    
  } catch (error: any) {
    console.error('更新分店 GPS 圍欄時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新分店印表機設定
 * PUT /stores/{storeId}/printer-config
 */
export const updatePrinterConfig = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 驗證路徑參數
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 storeId 參數'
      });
    }
    
    // 獲取經過驗證的請求數據
    const printerConfigData: PrinterConfigRequest = req.body;
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    // 獲取當前分店資料
    const storeDoc = await storesCollection.doc(storeId).get();
    
    // 檢查分店是否存在
    if (!storeDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${storeId} 的分店`
      });
    }
    
    const storeData = storeDoc.data() as Store;
    
    // 租戶隔離 - 非超級管理員只能更新自己租戶的分店
    if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試更新其他租戶的分店印表機設定`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法更新其他租戶的分店印表機設定'
      });
    }
    
    // 權限檢查 - 只有租戶管理員、分店經理及以上可以更新印表機設定
    const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
    if (!allowedRoles.includes(user.role)) {
      console.warn(`權限拒絕：用戶 ${user.uid} (角色 ${user.role}) 嘗試更新分店印表機設定`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：只有租戶管理員、分店經理及以上角色可以更新分店印表機設定'
      });
    }
    
    // 分店經理只能更新自己管理的分店
    if (user.role === 'store_manager' && user.storeId !== storeId) {
      console.warn(`權限拒絕：分店經理 ${user.uid} 嘗試更新非其管理的分店 ${storeId} 的印表機設定`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：分店經理只能更新自己管理的分店印表機設定'
      });
    }
    
    // 執行更新操作
    await storesCollection.doc(storeId).update({
      printerConfig: printerConfigData,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid
    });
    console.log(`成功更新分店 ${storeId} 的印表機設定`);
    
    // 獲取更新後的店鋪數據
    const updatedStoreDoc = await storesCollection.doc(storeId).get();
    const updatedStoreData = updatedStoreDoc.data() as Store;
    
    // 將內部模型轉換為API模型
    const apiStore = toApiStore(updatedStoreData);
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      data: {
        receiptPrinter: updatedStoreData.printerConfig?.receiptPrinter,
        kitchenPrinters: updatedStoreData.printerConfig?.kitchenPrinters,
        settings: updatedStoreData.printerConfig?.settings,
        updatedAt: apiStore.updatedAt
      }
    });
    
  } catch (error: any) {
    console.error('更新分店印表機設定時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新分店營業時間
 * PUT /stores/{storeId}/business-hours
 */
export const updateStoreBusinessHours = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 驗證路徑參數
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 storeId 參數'
      });
    }
    
    // 獲取經過驗證的請求數據
    const { businessHours } = req.body;
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }
    
    try {
      // 使用服務層更新店鋪營業時間
      const updatedStore = await storeService.updateStoreBusinessHours(storeId, businessHours, user);
      
      // 檢查店鋪是否存在
      if (!updatedStore) {
        return res.status(404).json({
          status: 'error',
          message: `未找到 ID 為 ${storeId} 的分店`
        });
      }
      
      // 將內部模型轉換為API模型
      const apiStore = toApiStore(updatedStore);
      
      // 返回成功響應，只包含營業時間相關資訊
      return res.status(200).json({
        status: 'success',
        message: '成功更新店鋪營業時間',
        data: {
          id: apiStore.id,
          businessHours: apiStore.businessHours,
          updatedAt: apiStore.updatedAt
        }
      });
    } catch (error) {
      console.error(`處理店鋪營業時間更新時發生錯誤: ${error.message}`);
      
      // 處理特定錯誤類型
      if (error.message.includes('未授權')) {
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      }
      
      if (error.message.includes('無效的時間')) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      // 其他未知錯誤
      return res.status(500).json({
        status: 'error',
        message: '更新店鋪營業時間時發生內部錯誤'
      });
    }
  } catch (error) {
    console.error('更新店鋪營業時間時發生未處理的錯誤:', error);
    return res.status(500).json({
      status: 'error',
      message: '伺服器錯誤，無法處理請求'
    });
  }
};

/**
 * 更新分店考勤設定
 * PUT /stores/{storeId}/attendance-settings
 */
export const updateStoreAttendanceSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 驗證路徑參數
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 storeId 參數'
      });
    }
    
    // 獲取經過驗證的請求數據
    const { attendanceSettings } = req.body;
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少用戶上下文'
      });
    }
    
    // 調用服務層
    const storeService = new StoreService();
    const tenantId = user.tenantId || '';
    const result = await storeService.updateStoreAttendanceSettings(tenantId, storeId, attendanceSettings, user);
    
    // 處理錯誤情況
    if ('error' in result) {
      const { error, status } = result;
      
      // 特定錯誤狀態碼處理
      if (error.includes('未授權') || error.includes('權限')) {
        return res.status(403).json({
          status: 'error',
          message: error
        });
      }
      
      if (error.includes('找不到')) {
        return res.status(404).json({
          status: 'error',
          message: error
        });
      }
      
      if (error.includes('無效') || error.includes('必須')) {
        return res.status(400).json({
          status: 'error',
          message: error
        });
      }
      
      // 默認錯誤狀態碼
      return res.status(status || 500).json({
        status: 'error',
        message: error
      });
    }
    
    // 成功回應
    return res.status(200).json({
      status: 'success',
      data: {
        id: storeId,
        attendanceSettings: result,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('處理更新分店考勤設定請求時發生錯誤:', error);
    return res.status(500).json({
      status: 'error',
      message: '處理請求時發生服務器錯誤',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}; 