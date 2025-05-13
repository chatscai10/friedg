import { firestore } from 'firebase-admin';
import { 
  Store, 
  UserContext,
  PaginationMeta,
  CreateStoreRequest,
  UpdateStoreRequest,
  GPSFenceRequest,
  PrinterConfigRequest,
  BusinessHours,
  AttendanceSettings
} from './stores.types';
import { Timestamp, DocumentSnapshot, FieldValue } from 'firebase-admin/firestore';

// 獲取 Firestore 實例
const db = firestore();
const storesCollection = db.collection('stores');

/**
 * 店鋪過濾條件
 */
export interface StoreFilter {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  isActive?: boolean;
  query?: string; // 用於搜索店鋪名稱、代碼或地址
}

/**
 * 店鋪服務層 - 處理與 Firestore 的數據交互
 */
export class StoreService {
  /**
   * 根據 ID 獲取店鋪
   */
  async getStoreById(storeId: string, user: UserContext): Promise<Store | null> {
    try {
      // 查詢店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return null;
      }
      
      // 獲取店鋪數據
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能訪問自己租戶的店鋪
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法訪問其他租戶的店鋪');
      }
      
      return this.convertStoreDocument(storeDoc);
    } catch (error) {
      console.error(`獲取店鋪(${storeId})時出錯:`, error);
      throw error;
    }
  }
  
  /**
   * 獲取店鋪列表 (支持分頁和過濾)
   */
  async listStores(filter: StoreFilter, user: UserContext): Promise<{
    stores: Store[],
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }> {
    try {
      // 解構過濾條件
      const {
        page = 1,
        limit = 20,
        sort = 'createdAt',
        order = 'desc',
        isActive,
        query
      } = filter;
      
      // 構建查詢
      let queryRef = storesCollection as firestore.Query;
      
      // 租戶隔離 - 如果不是超級管理員，只能查看自己租戶的店鋪
      if (user.role !== 'super_admin' && user.tenantId) {
        queryRef = queryRef.where('tenantId', '==', user.tenantId);
      }
      
      // 應用其他過濾條件
      if (isActive !== undefined) {
        queryRef = queryRef.where('isActive', '==', isActive);
      }
      
      // 排除已標記為刪除的店鋪
      queryRef = queryRef.where('isDeleted', '==', false);
      
      // 應用排序
      if (sort === 'createdAt' || sort === 'updatedAt' || sort === 'storeName') {
        queryRef = queryRef.orderBy(sort, order);
      } else {
        // 默認按創建時間排序
        queryRef = queryRef.orderBy('createdAt', order);
      }
      
      // 獲取總數 (使用 count() 聚合查詢或普通查詢後取 size)
      const countSnapshot = await queryRef.count().get();
      const total = countSnapshot.data().count;
      
      // 計算分頁信息
      const pageSize = Math.min(50, limit); // 最大返回50條
      const offset = (page - 1) * pageSize;
      const totalPages = Math.ceil(total / pageSize);
      
      // 獲取特定頁面的結果
      const paginatedQuerySnapshot = await queryRef.offset(offset).limit(pageSize).get();
      
      // 轉換文檔
      const stores = paginatedQuerySnapshot.docs.map(doc =>
        this.convertStoreDocument(doc)
      );
      
      // 如果有搜索查詢，可以在此處實現客戶端過濾（未來可考慮使用 Firebase 的全文搜索功能）
      
      return {
        stores,
        total,
        page,
        limit: pageSize,
        totalPages
      };
    } catch (error) {
      console.error('獲取店鋪列表時出錯:', error);
      throw error;
    }
  }

  /**
   * 創建新店鋪
   */
  async createStore(data: CreateStoreRequest, user: UserContext): Promise<Store> {
    try {
      // 租戶隔離 - 確保是同一租戶
      if (user.role !== 'super_admin') {
        if (!user.tenantId) {
          throw new Error('未授權：請求用戶上下文無效（缺少 tenantId）');
        }
        
        // 確保使用者無法為其他租戶創建店鋪
        if (data.tenantId !== user.tenantId) {
          throw new Error('未授權：您無法為其他租戶創建店鋪');
        }
      }
      
      // 檢查權限 - 只有租戶管理員及以上角色可以創建店鋪
      if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
        throw new Error('未授權：只有租戶管理員及以上角色可以創建店鋪');
      }
      
      // 店鋪 ID 生成邏輯
      const storeId = this.generateStoreId();
      
      // 創建店鋪數據
      const storeData: Store = {
        storeId,
        storeName: data.storeName,
        storeCode: data.storeCode,
        address: data.address,
        phoneNumber: data.phoneNumber,
        contactPerson: data.contactPerson,
        email: data.email,
        tenantId: data.tenantId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDeleted: false, // 確保新創建的店鋪未被標記為刪除
        geolocation: data.geolocation || null,
        gpsFence: data.gpsFence || null,
        businessHours: data.businessHours || null,
        printerConfig: data.printerConfig || null,
        settings: data.settings || {},
        createdAt: FieldValue.serverTimestamp() as any,
        updatedAt: FieldValue.serverTimestamp() as any,
        createdBy: user.uid,
        updatedBy: user.uid
      };
      
      // 儲存到 Firestore
      await storesCollection.doc(storeId).set(storeData);
      console.log(`成功創建店鋪：${storeId}`);
      
      // 處理時間戳返回
      const now = new Date().toISOString();
      return {
        ...storeData,
        createdAt: now,
        updatedAt: now
      };
    } catch (error) {
      console.error('創建店鋪時出錯:', error);
      throw error;
    }
  }

  /**
   * 更新店鋪
   */
  async updateStore(storeId: string, data: UpdateStoreRequest, user: UserContext): Promise<Store | null> {
    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return null;
      }
      
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能更新自己租戶的店鋪
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法更新其他租戶的店鋪');
      }
      
      // 權限檢查 - 只有租戶管理員、店鋪經理及以上可以更新店鋪
      const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
      if (!allowedRoles.includes(user.role)) {
        throw new Error('未授權：只有租戶管理員、店鋪經理及以上角色可以更新店鋪');
      }
      
      // 如果是店鋪經理，只能更新自己管理的店鋪
      if (user.role === 'store_manager' && user.storeId !== storeId) {
        throw new Error('未授權：店鋪經理只能更新自己管理的店鋪');
      }
      
      // 構建更新數據
      const updateObject: any = {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      };
      
      // 禁止更改某些欄位
      delete updateObject.storeId;
      delete updateObject.tenantId;
      delete updateObject.createdAt;
      delete updateObject.createdBy;
      delete updateObject.isDeleted; // 防止通過一般更新接口改變刪除狀態
      
      // 執行更新操作
      await storesCollection.doc(storeId).update(updateObject);
      console.log(`成功更新店鋪 ${storeId}`);
      
      // 獲取更新後的店鋪資料
      const updatedStoreDoc = await storesCollection.doc(storeId).get();
      return this.convertStoreDocument(updatedStoreDoc);
    } catch (error) {
      console.error(`更新店鋪(${storeId})時出錯:`, error);
      throw error;
    }
  }

  /**
   * 更新店鋪狀態
   */
  async updateStoreStatus(storeId: string, isActive: boolean, user: UserContext): Promise<boolean> {
    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return false;
      }
      
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能更新自己租戶的店鋪
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法更新其他租戶的店鋪狀態');
      }
      
      // 權限檢查 - 只有租戶管理員及以上可以更新店鋪狀態
      if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
        throw new Error('未授權：只有租戶管理員及以上角色可以更新店鋪狀態');
      }
      
      // 執行更新操作
      await storesCollection.doc(storeId).update({
        isActive,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
      
      console.log(`成功更新店鋪 ${storeId} 的狀態為 ${isActive ? '活動' : '不活動'}`);
      return true;
    } catch (error) {
      console.error(`更新店鋪狀態(${storeId})時出錯:`, error);
      throw error;
    }
  }

  /**
   * 刪除店鋪 (邏輯刪除)
   */
  async deleteStore(storeId: string, user: UserContext, hardDelete: boolean = false): Promise<boolean> {
    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return false;
      }
      
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能刪除自己租戶的店鋪
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法刪除其他租戶的店鋪');
      }
      
      // 權限檢查 - 只有租戶管理員及以上可以刪除店鋪
      if (user.role !== 'super_admin' && user.role !== 'tenant_admin') {
        throw new Error('未授權：只有租戶管理員及以上角色可以刪除店鋪');
      }
      
      // 物理刪除 (僅限超級管理員)
      if (hardDelete && user.role === 'super_admin') {
        await storesCollection.doc(storeId).delete();
        console.log(`成功物理刪除店鋪 ${storeId}`);
      } else {
        // 邏輯刪除
        await storesCollection.doc(storeId).update({
          isActive: false,
          isDeleted: true,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        });
        console.log(`成功邏輯刪除店鋪 ${storeId}`);
      }
      
      return true;
    } catch (error) {
      console.error(`刪除店鋪(${storeId})時出錯:`, error);
      throw error;
    }
  }

  /**
   * 更新店鋪 GPS 圍欄
   */
  async updateGPSFence(storeId: string, gpsFenceData: GPSFenceRequest, user: UserContext): Promise<Store | null> {
    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return null;
      }
      
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能更新自己租戶的店鋪
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法更新其他租戶的店鋪 GPS 圍欄');
      }
      
      // 權限檢查 - 只有租戶管理員、店鋪經理及以上可以更新 GPS 圍欄
      const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
      if (!allowedRoles.includes(user.role)) {
        throw new Error('未授權：只有租戶管理員、店鋪經理及以上角色可以更新店鋪 GPS 圍欄');
      }
      
      // 分店經理只能更新自己管理的店鋪
      if (user.role === 'store_manager' && user.storeId !== storeId) {
        throw new Error('未授權：店鋪經理只能更新自己管理的店鋪 GPS 圍欄');
      }
      
      // 執行更新操作
      await storesCollection.doc(storeId).update({
        gpsFence: gpsFenceData,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
      
      // 獲取更新後的店鋪資料
      const updatedStoreDoc = await storesCollection.doc(storeId).get();
      return this.convertStoreDocument(updatedStoreDoc);
    } catch (error) {
      console.error(`更新店鋪GPS圍欄(${storeId})時出錯:`, error);
      throw error;
    }
  }

  /**
   * 更新店鋪印表機設定
   */
  async updatePrinterConfig(storeId: string, printerConfigData: PrinterConfigRequest, user: UserContext): Promise<Store | null> {
    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return null;
      }
      
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能更新自己租戶的店鋪
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法更新其他租戶的店鋪印表機設定');
      }
      
      // 權限檢查 - 只有租戶管理員、店鋪經理及以上可以更新印表機設定
      const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
      if (!allowedRoles.includes(user.role)) {
        throw new Error('未授權：只有租戶管理員、店鋪經理及以上角色可以更新店鋪印表機設定');
      }
      
      // 分店經理只能更新自己管理的店鋪
      if (user.role === 'store_manager' && user.storeId !== storeId) {
        throw new Error('未授權：店鋪經理只能更新自己管理的店鋪印表機設定');
      }
      
      // 執行更新操作
      await storesCollection.doc(storeId).update({
        printerConfig: printerConfigData,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
      
      // 獲取更新後的店鋪資料
      const updatedStoreDoc = await storesCollection.doc(storeId).get();
      return this.convertStoreDocument(updatedStoreDoc);
    } catch (error) {
      console.error(`更新店鋪印表機設定(${storeId})時出錯:`, error);
      throw error;
    }
  }

  /**
   * 更新店鋪地理位置和地理圍欄
   * @param storeId 店鋪ID
   * @param locationData 位置數據，包含座標和地理圍欄半徑
   * @param user 操作用戶上下文
   * @returns 更新後的店鋪資料或null(如果店鋪不存在)
   */
  async updateStoreLocation(
    storeId: string, 
    locationData: { 
      coordinates: { 
        latitude: number, 
        longitude: number 
      }, 
      geofenceRadius: number 
    }, 
    user: UserContext
  ): Promise<Store | null> {
    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        console.warn(`嘗試更新不存在的店鋪位置，店鋪ID: ${storeId}`);
        return null;
      }
      
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能更新自己租戶的店鋪
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法更新其他租戶的店鋪地理位置');
      }
      
      // 權限檢查 - 只有租戶管理員、店鋪經理及以上可以更新地理位置
      const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
      if (!allowedRoles.includes(user.role)) {
        throw new Error('未授權：只有租戶管理員、店鋪經理及以上角色可以更新店鋪地理位置');
      }
      
      // 分店經理只能更新自己管理的店鋪
      if (user.role === 'store_manager' && user.storeId !== storeId) {
        throw new Error('未授權：店鋪經理只能更新自己管理的店鋪地理位置');
      }
      
      // 驗證座標數據
      const { coordinates, geofenceRadius } = locationData;
      if (coordinates.latitude < -90 || coordinates.latitude > 90) {
        throw new Error('無效的緯度值：應在 -90 到 90 之間');
      }
      
      if (coordinates.longitude < -180 || coordinates.longitude > 180) {
        throw new Error('無效的經度值：應在 -180 到 180 之間');
      }
      
      if (geofenceRadius < 0) {
        throw new Error('無效的地理圍欄半徑：應為非負數');
      }
      
      // 更新地理位置和圍欄資訊
      const geolocation = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address: storeData.address // 保留現有地址字段
      };
      
      const gpsFence = {
        enabled: true, // 默認啟用地理圍欄
        radius: geofenceRadius,
        center: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        },
        allowedDeviation: storeData.gpsFence?.allowedDeviation || 50 // 使用現有值或默認值
      };
      
      // 執行更新操作
      await storesCollection.doc(storeId).update({
        geolocation,
        gpsFence,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
      
      console.log(`成功更新店鋪 ${storeId} 的地理位置和圍欄設置`);
      
      // 獲取更新後的店鋪資料
      const updatedStoreDoc = await storesCollection.doc(storeId).get();
      return this.convertStoreDocument(updatedStoreDoc);
    } catch (error) {
      console.error(`更新店鋪地理位置(${storeId})時出錯:`, error);
      throw error;
    }
  }
  
  /**
   * 更新店鋪營業時間
   * @param storeId 店鋪ID
   * @param businessHoursData 營業時間數據
   * @param user 操作用戶上下文
   * @returns 更新後的店鋪資料或null(如果店鋪不存在)
   */
  async updateStoreBusinessHours(
    storeId: string,
    businessHoursData: BusinessHours,
    user: UserContext
  ): Promise<Store | null> {
    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        console.warn(`嘗試更新不存在的店鋪營業時間，店鋪ID: ${storeId}`);
        return null;
      }
      
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能更新自己租戶的店鋪
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法更新其他租戶的店鋪營業時間');
      }
      
      // 權限檢查 - 只有租戶管理員、店鋪經理及以上可以更新營業時間
      const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
      if (!allowedRoles.includes(user.role)) {
        throw new Error('未授權：只有租戶管理員、店鋪經理及以上角色可以更新店鋪營業時間');
      }
      
      // 分店經理只能更新自己管理的店鋪
      if (user.role === 'store_manager' && user.storeId !== storeId) {
        throw new Error('未授權：店鋪經理只能更新自己管理的店鋪營業時間');
      }
      
      // 時間格式驗證
      const validateTimeFormat = (timeStr: string): boolean => {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr);
      };
      
      // 驗證時間範圍合理性
      const validateTimeRange = (start: string, end: string): boolean => {
        if (!validateTimeFormat(start) || !validateTimeFormat(end)) {
          return false;
        }
        
        const [startHours, startMinutes] = start.split(':').map(Number);
        const [endHours, endMinutes] = end.split(':').map(Number);
        
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        return endTotalMinutes > startTotalMinutes;
      };
      
      // 驗證營業時間數據
      const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      for (const day of weekdays) {
        if (businessHoursData[day] && Array.isArray(businessHoursData[day])) {
          for (const timeRange of businessHoursData[day]) {
            if (timeRange.start && timeRange.end) {
              if (!validateTimeRange(timeRange.start, timeRange.end)) {
                throw new Error(`無效的時間範圍：${day} ${timeRange.start}-${timeRange.end}，結束時間必須晚於開始時間`);
              }
            } else {
              throw new Error(`無效的時間範圍格式：${day} 缺少開始或結束時間`);
            }
          }
        }
      }
      
      // 如果提供了假日時間設定，也進行驗證
      if (businessHoursData.holidays && Array.isArray(businessHoursData.holidays)) {
        for (const timeRange of businessHoursData.holidays) {
          if (timeRange.start && timeRange.end) {
            if (!validateTimeRange(timeRange.start, timeRange.end)) {
              throw new Error(`無效的假日時間範圍：${timeRange.start}-${timeRange.end}，結束時間必須晚於開始時間`);
            }
          } else {
            throw new Error(`無效的假日時間範圍格式：缺少開始或結束時間`);
          }
        }
      }
      
      // 執行更新操作
      await storesCollection.doc(storeId).update({
        businessHours: businessHoursData,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
      
      console.log(`成功更新店鋪 ${storeId} 的營業時間設置`);
      
      // 獲取更新後的店鋪資料
      const updatedStoreDoc = await storesCollection.doc(storeId).get();
      return this.convertStoreDocument(updatedStoreDoc);
    } catch (error) {
      console.error(`更新店鋪營業時間(${storeId})時出錯:`, error);
      throw error;
    }
  }
  
  /**
   * 更新分店營業時間
   * @param tenantId 租戶ID
   * @param storeId 分店ID
   * @param businessHoursData 營業時間資料
   * @param user 用戶上下文
   * @returns 更新後的營業時間資料
   */
  async updateStoreBusinessHours(
    tenantId: string,
    storeId: string,
    businessHoursData: BusinessHours,
    user: UserContext
  ): Promise<BusinessHours | { error: string, status: number }> {
    try {
      // 1. 檢查店鋪是否存在
      const storeDoc = await storesCollection.doc(storeId).get();
      if (!storeDoc.exists) {
        return { error: '找不到指定的分店', status: 404 };
      }

      const storeData = <Store>storeDoc.data();

      // 2. 租戶隔離: 只有 super_admin 可跨租戶操作
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        return { error: '您沒有權限操作此租戶的分店', status: 403 };
      }

      // 3. 權限檢查: 允許的角色
      const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
      if (!allowedRoles.includes(user.role)) {
        return { error: '您沒有權限更新分店營業時間', status: 403 };
      }

      // 4. 店長只能更新自己管理的店
      if (user.role === 'store_manager' && user.storeId !== storeId) {
        return { error: '您只能更新自己管理的分店', status: 403 };
      }

      // 5. 驗證時間格式和邏輯
      const validateTimeRange = (timeRange: { start: string; end: string }) => {
        // 驗證時間格式
        const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timePattern.test(timeRange.start) || !timePattern.test(timeRange.end)) {
          return { valid: false, message: '時間格式無效，應為 HH:MM' };
        }

        // 驗證結束時間晚於開始時間
        const [startHour, startMinute] = timeRange.start.split(':').map(Number);
        const [endHour, endMinute] = timeRange.end.split(':').map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        if (endMinutes <= startMinutes) {
          return { valid: false, message: '結束時間必須晚於開始時間' };
        }

        return { valid: true };
      };

      // 檢查所有工作日的時間段
      for (const day of Object.keys(businessHoursData)) {
        const timeRanges = businessHoursData[day as keyof BusinessHours];
        
        if (Array.isArray(timeRanges)) {
          for (const range of timeRanges) {
            const result = validateTimeRange(range);
            if (!result.valid) {
              return { error: `${day} 的時間範圍無效: ${result.message}`, status: 400 };
            }
          }
        }
      }

      // 6. 更新數據庫
      await storesCollection.doc(storeId).update({
        businessHours: businessHoursData,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });

      return businessHoursData;
    } catch (error) {
      console.error('更新分店營業時間時發生錯誤:', error);
      return { error: '更新分店營業時間時發生錯誤', status: 500 };
    }
  }

  /**
   * 更新分店考勤設定
   * @param tenantId 租戶ID
   * @param storeId 分店ID
   * @param attendanceSettingsData 考勤設定資料
   * @param user 用戶上下文
   * @returns 更新後的考勤設定資料
   */
  async updateStoreAttendanceSettings(
    tenantId: string,
    storeId: string,
    attendanceSettingsData: AttendanceSettings,
    user: UserContext
  ): Promise<AttendanceSettings | { error: string, status: number }> {
    try {
      // 1. 檢查店鋪是否存在
      const storeDoc = await storesCollection.doc(storeId).get();
      if (!storeDoc.exists) {
        return { error: '找不到指定的分店', status: 404 };
      }

      const storeData = <Store>storeDoc.data();

      // 2. 租戶隔離: 只有 super_admin 可跨租戶操作
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        return { error: '您沒有權限操作此租戶的分店', status: 403 };
      }

      // 3. 權限檢查: 允許的角色
      const allowedRoles = ['super_admin', 'tenant_admin', 'store_manager'];
      if (!allowedRoles.includes(user.role)) {
        return { error: '您沒有權限更新分店考勤設定', status: 403 };
      }

      // 4. 店長只能更新自己管理的店
      if (user.role === 'store_manager' && user.storeId !== storeId) {
        return { error: '您只能更新自己管理的分店', status: 403 };
      }

      // 5. 驗證數據合理性
      if (attendanceSettingsData.lateThresholdMinutes < 0 || 
          attendanceSettingsData.lateThresholdMinutes > 180) {
        return { error: '遲到閾值必須在0到180分鐘之間', status: 400 };
      }
      
      if (attendanceSettingsData.earlyThresholdMinutes < 0 || 
          attendanceSettingsData.earlyThresholdMinutes > 180) {
        return { error: '早退閾值必須在0到180分鐘之間', status: 400 };
      }
      
      if (attendanceSettingsData.flexTimeMinutes < 0 || 
          attendanceSettingsData.flexTimeMinutes > 120) {
        return { error: '彈性時間必須在0到120分鐘之間', status: 400 };
      }
      
      // 如果啟用了自動下班打卡，則必須提供有效的自動下班時間
      if (attendanceSettingsData.autoClockOutEnabled) {
        if (!attendanceSettingsData.autoClockOutTime) {
          return { error: '啟用自動下班打卡時必須提供自動下班時間', status: 400 };
        }
        
        // 驗證時間格式
        const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timePattern.test(attendanceSettingsData.autoClockOutTime)) {
          return { error: '自動下班時間格式無效，應為 HH:MM', status: 400 };
        }
      }

      // 6. 更新數據庫
      await storesCollection.doc(storeId).update({
        attendanceSettings: attendanceSettingsData,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });

      return attendanceSettingsData;
    } catch (error) {
      console.error('更新分店考勤設定時發生錯誤:', error);
      return { error: '更新分店考勤設定時發生錯誤', status: 500 };
    }
  }

  /**
   * 將 Firestore 文檔轉換為 Store 對象
   */
  private convertStoreDocument(doc: DocumentSnapshot): Store {
    const data = doc.data() as Store;
    
    // 處理 Timestamp 類型，確保客戶端獲得標準格式
    let result = {
      ...data,
      storeId: doc.id // 確保 storeId 是文檔 ID
    } as Store;
    
    // 轉換時間戳記錄為可序列化格式
    if (data.createdAt && typeof data.createdAt !== 'string') {
      if ('toDate' in (data.createdAt as any)) {
        result.createdAt = (data.createdAt as Timestamp).toDate().toISOString();
      }
    }
    
    if (data.updatedAt && typeof data.updatedAt !== 'string') {
      if ('toDate' in (data.updatedAt as any)) {
        result.updatedAt = (data.updatedAt as Timestamp).toDate().toISOString();
      }
    }
    
    return result;
  }

  /**
   * 生成唯一的店鋪 ID (格式: store_{隨機字符})
   */
  private generateStoreId(): string {
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `store_${randomStr}`;
  }
}

// 導出服務單例
export const storeService = new StoreService(); 