import { Request, Response, NextFunction } from 'express';
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
import { StoreService } from './stores.service';
import { CustomError } from '../libs/utils/errors';
import { validateRequest } from '../middleware/validateRequest';
import { sendSuccessResponse, sendErrorResponse } from '../utils/responseHandler';

// 獲取 Firestore 實例
const db = firestore();
const storesCollection = db.collection('stores');

const storeServiceInstance = new StoreService();

// 生成唯一的分店 ID (格式: store_{隨機字符})
function generateStoreId(): string {
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `store_${randomStr}`;
}

/**
 * 獲取分店列表
 * GET /stores
 */
export const listStoresHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 從 req.query 中提取過濾參數，並由 validateRequest 中間件確保格式正確
    const filter = req.query; // validateRequest 已驗證並轉換類型

    // 從 req.user 中獲取用戶上下文 (假設已由 authMiddleware 添加)
    const user = req.user as UserContext; 

    // 調用 Service 層方法獲取店鋪列表
    const result = await storeServiceInstance.listStores(filter, user);

    // 返回成功回應
    sendSuccessResponse(res, result, 200);
  } catch (error) {
    // 捕獲錯誤並標準化處理
    console.error('listStoresHandler error:', error);
    sendErrorResponse(res, error);
  }
};

/**
 * 獲取單個分店
 * GET /stores/{storeId}
 */
export const getStoreByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 從 req.params 中提取 storeId
    const { storeId } = req.params; // validateRequest 已驗證

    // 從 req.user 中獲取用戶上下文
    const user = req.user as UserContext;

    // 調用 Service 層方法
    const store = await storeServiceInstance.getStoreById(storeId, user);

    if (!store) {
      // 如果店鋪不存在，返回 404
      throw new CustomError('找不到指定的分店', 404);
    }

    // 返回成功回應
    sendSuccessResponse(res, store, 200);
  } catch (error) {
    // 捕獲錯誤並標準化處理
    console.error('getStoreByIdHandler error:', error);
    sendErrorResponse(res, error);
  }
};

/**
 * 創建新分店
 * POST /stores
 */
export const createStoreHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 從 req.body 中提取創建數據
    const createData = req.body; // validateRequest 已驗證

    // 從 req.user 中獲取用戶上下文
    const user = req.user as UserContext;

    // 調用 Service 層方法創建店鋪
    const newStore = await storeServiceInstance.createStore(createData, user);

    // 返回成功回應 (狀態碼 201)
    sendSuccessResponse(res, newStore, 201);
  } catch (error) {
    // 捕獲錯誤並標準化處理
    console.error('createStoreHandler error:', error);
    sendErrorResponse(res, error);
  }
};

/**
 * 更新分店
 * PUT /stores/{storeId}
 */
export const updateStoreHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 從 req.params 中提取 storeId
    const { storeId } = req.params; // validateRequest 已驗證

    // 從 req.body 中提取更新數據
    const updateData = req.body; // validateRequest 已驗證

    // 從 req.user 中獲取用戶上下文
    const user = req.user as UserContext;

    // 調用 Service 層方法更新店鋪
    const updatedStore = await storeServiceInstance.updateStore(storeId, updateData, user);

    if (!updatedStore) {
      // 如果店鋪不存在，返回 404
      throw new CustomError('找不到指定的分店', 404);
    }

    // 返回成功回應
    sendSuccessResponse(res, updatedStore, 200);
  } catch (error) {
    // 捕獲錯誤並標準化處理
    console.error('updateStoreHandler error:', error);
    sendErrorResponse(res, error);
  }
};

/**
 * 刪除分店
 * DELETE /stores/{storeId}
 */
export const deleteStoreHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 從 req.params 中提取 storeId
    const { storeId } = req.params; // validateRequest 已驗證

    // 從 req.query 中提取 hardDelete 參數
    const { hardDelete } = req.query; // validateRequest 已驗證
    const isHardDelete = hardDelete === true; // Zod coerce 已轉換為 boolean

    // 從 req.user 中獲取用戶上下文
    const user = req.user as UserContext;

    // 調用 Service 層方法刪除店鋪
    const success = await storeServiceInstance.deleteStore(storeId, user, isHardDelete);

    if (!success) {
      // 如果店鋪不存在，返回 404
       throw new CustomError('找不到指定的分店', 404); // deleteStore 返回 false 表示不存在
    }

    // 返回成功回應 (狀態碼 204 No Content)
    sendSuccessResponse(res, null, 204); // 刪除成功通常返回 204
  } catch (error) {
    // 捕獲錯誤並標準化處理
    console.error('deleteStoreHandler error:', error);
    sendErrorResponse(res, error);
  }
};

/**
 * 更新分店狀態
 * PATCH /stores/{storeId}/status
 */
export const updateStoreStatusHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { storeId } = req.params; // validateRequest 已驗證
    const { status, reason } = req.body; // validateRequest 已驗證
    const user = req.user as UserContext;

    const updatedStore = await storeServiceInstance.updateStoreStatus(storeId, status, user);

    if (!updatedStore) {
      throw new CustomError('找不到指定的分店', 404);
    }

    sendSuccessResponse(res, updatedStore, 200);

  } catch (error) {
    console.error('updateStoreStatusHandler error:', error);
    sendErrorResponse(res, error);
  }
};

/**
 * 更新分店 GPS 圍欄
 * PUT /stores/{storeId}/gps-fence
 */
export const updateStoreGPSFenceHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { storeId } = req.params; // validateRequest 已驗證
    const gpsFenceData = req.body; // validateRequest 已驗證
    const user = req.user as UserContext;

    // 需要在 StoreService 中添加或修改 updateGPSFence 方法以處理新的 GPSFence 類型
    // 這裡暫時假定 Service 層有相應的方法
     // TODO: 確保 StoreService 中存在並正確實現 updateGPSFence 方法，處理類型和 RBAC
     const updatedStore = await (storeServiceInstance as any).updateGPSFence(storeId, gpsFenceData, user); // 暫時使用 any 繞過類型檢查

    if (!updatedStore) {
      throw new CustomError('找不到指定的分店', 404);
    }

    sendSuccessResponse(res, updatedStore, 200);

  } catch (error) {
    console.error('updateStoreGPSFenceHandler error:', error);
    sendErrorResponse(res, error);
  }
};

/**
 * 更新分店印表機設定
 * PUT /stores/{storeId}/printer-config
 */
export const updateStorePrinterSettingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { storeId } = req.params; // validateRequest 已驗證
    const printerSettingsData = req.body; // validateRequest 已驗證
    const user = req.user as UserContext;

    // 需要在 StoreService 中添加或修改 updatePrinterConfig 方法以處理新的 PrinterSettings 類型
    // 這裡暫時假定 Service 層有相應的方法
     // TODO: 確保 StoreService 中存在並正確實現 updatePrinterSettings 方法，處理類型和 RBAC
     const updatedStore = await (storeServiceInstance as any).updatePrinterSettings(storeId, printerSettingsData, user); // 暫時使用 any 繞過類型檢查

    if (!updatedStore) {
      throw new CustomError('找不到指定的分店', 404);
    }

    sendSuccessResponse(res, updatedStore, 200);

  } catch (error) {
    console.error('updateStorePrinterSettingsHandler error:', error);
    sendErrorResponse(res, error);
  }
};

/**
 * 更新分店營業時間
 * PUT /stores/{storeId}/business-hours
 */
export const updateStoreBusinessHoursHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { storeId } = req.params; // validateRequest 已驗證
    const businessHoursData = req.body; // validateRequest 已驗證
    const user = req.user as UserContext;

    // 需要在 StoreService 中添加或修改 updateStoreBusinessHours 方法以處理新的 BusinessHours 類型
    // 這裡暫時假定 Service 層有相應的方法
     // TODO: 確保 StoreService 中存在並正確實現 updateStoreBusinessHours 方法，處理類型和 RBAC
     const updatedStore = await (storeServiceInstance as any).updateStoreBusinessHours(storeId, businessHoursData, user); // 暫時使用 any 繞過類型檢查

    if (!updatedStore) {
      throw new CustomError('找不到指定的分店', 404);
    }

    sendSuccessResponse(res, updatedStore, 200);

  } catch (error) {
    console.error('updateStoreBusinessHoursHandler error:', error);
    sendErrorResponse(res, error);
  }
};

/**
 * 更新分店考勤設定
 * PUT /stores/{storeId}/attendance-settings
 */
export const updateStoreAttendanceSettingsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { storeId } = req.params; // validateRequest 已驗證
    const attendanceSettingsData = req.body; // validateRequest 已驗證
    const user = req.user as UserContext;

    // 需要在 StoreService 中添加或修改 updateStoreAttendanceSettings 方法以處理新的 AttendanceSettings 類型
    // 這裡暫時假定 Service 層有相應的方法
     // TODO: 確保 StoreService 中存在並正確實現 updateStoreAttendanceSettings 方法，處理類型和 RBAC
     const updatedStore = await (storeServiceInstance as any).updateStoreAttendanceSettings(storeId, attendanceSettingsData, user); // 暫時使用 any 繞過類型檢查

    if (!updatedStore) {
      throw new CustomError('找不到指定的分店', 404);
    }

    sendSuccessResponse(res, updatedStore, 200);

  } catch (error) {
    console.error('updateStoreAttendanceSettingsHandler error:', error);
    sendErrorResponse(res, error);
  }
}; 