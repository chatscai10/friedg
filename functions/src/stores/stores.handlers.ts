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
  UserContext
} from './stores.types';

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
    const { 
      page = 1, 
      limit = 20,
      isActive
    } = req.query;
    
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
    const tenantId = user.tenantId;
    if (!tenantId && user.role !== 'super_admin') {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }
    
    // 構建查詢
    let query: any = storesCollection;
    
    // 租戶隔離 - 如果不是超級管理員，只能查看自己租戶的分店
    if (user.role !== 'super_admin') {
      query = query.where('tenantId', '==', tenantId);
    }
    
    // 活動狀態過濾
    if (isActive !== undefined) {
      const isActiveBool = isActive === 'true';
      query = query.where('isActive', '==', isActiveBool);
    }
    
    // 執行分頁查詢
    const pageSize = Math.min(50, Number(limit) || 20);
    const offset = (Number(page) - 1) * pageSize;
    
    // 獲取總數
    const snapshot = await query.get();
    const totalCount = snapshot.size;
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // 應用分頁
    const pagedQuery = query.limit(pageSize);
    
    // 如果需要跳過結果，使用偏移量
    const pagedSnapshot = await (offset 
      ? pagedQuery.offset(offset).get() 
      : pagedQuery.get());
    
    // 處理結果
    const stores = pagedSnapshot.docs.map(doc => {
      const data = doc.data() as Store;
      let formattedStore = { ...data };
      
      // 處理 Firestore 時間戳
      if (formattedStore.createdAt && typeof formattedStore.createdAt !== 'string') {
        formattedStore.createdAt = formattedStore.createdAt.toDate().toISOString();
      }
      
      if (formattedStore.updatedAt && typeof formattedStore.updatedAt !== 'string') {
        formattedStore.updatedAt = formattedStore.updatedAt.toDate().toISOString();
      }
      
      return formattedStore;
    });
    
    // 構建回應
    const response: PaginatedStoreResponse = {
      status: 'success',
      data: stores,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: pageSize,
        totalPages: totalPages
      }
    };
    
    return res.status(200).json(response);
    
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
    
    // 查詢分店
    const storeDoc = await storesCollection.doc(storeId).get();
    
    // 檢查分店是否存在
    if (!storeDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${storeId} 的分店`
      });
    }
    
    const storeData = storeDoc.data() as Store;
    
    // 租戶隔離 - 非超級管理員只能查看自己租戶的分店
    if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試訪問其他租戶的分店`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法訪問其他租戶的分店'
      });
    }
    
    // 處理 Firestore 時間戳
    let formattedStore = { ...storeData };
    
    if (formattedStore.createdAt && typeof formattedStore.createdAt !== 'string') {
      formattedStore.createdAt = formattedStore.createdAt.toDate().toISOString();
    }
    
    if (formattedStore.updatedAt && typeof formattedStore.updatedAt !== 'string') {
      formattedStore.updatedAt = formattedStore.updatedAt.toDate().toISOString();
    }
    
    // 返回分店資料
    return res.status(200).json({
      status: 'success',
      data: formattedStore
    });
    
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
    // 獲取經過驗證的請求數據
    const requestData: CreateStoreRequest = req.body;
    
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
    
    return res.status(201).json({
      status: 'success',
      data: responseData
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
    
    // 獲取經過驗證的請求數據
    const updateData: UpdateStoreRequest = req.body;
    
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
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      data: formattedStore
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
    
    // 獲取經過驗證的請求數據
    const { isActive }: UpdateStoreStatusRequest = req.body;
    
    if (isActive === undefined) {
      return res.status(400).json({
        status: 'error',
        message: '請提供 isActive 狀態值'
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
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      message: `分店 ${storeId} 的狀態已成功更新為 ${isActive ? '活動' : '不活動'}`,
      data: {
        storeId,
        isActive
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
      
      return res.status(200).json({
        status: 'success',
        message: `分店 ${storeId} 已成功永久刪除`
      });
    } else {
      // 邏輯刪除 (將狀態設為不活動)
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
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      message: `分店 ${storeId} 的 GPS 圍欄已成功更新`,
      data: {
        storeId,
        gpsFence: gpsFenceData
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
    
    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      message: `分店 ${storeId} 的印表機設定已成功更新`,
      data: {
        storeId,
        printerConfig: printerConfigData
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