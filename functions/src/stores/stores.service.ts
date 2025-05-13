import { firestore } from 'firebase-admin';
import { 
  Store, 
  UserContext,
  PaginationMeta,
  CreateStoreRequest,
  UpdateStoreRequest,
  GPSFence,
  PrinterSettings,
  BusinessHours,
  AttendanceSettings,
} from './stores.types'; // 確保導入更新後的類型
import { Timestamp, DocumentSnapshot, FieldValue } from 'firebase-admin/firestore';
// 導入 RBAC 庫中的 hasPermission 函數
import { hasPermission } from '../libs/rbac/core/permissionResolver';
import { ResourceTypes } from '../libs/rbac/constants'; // 導入資源類型常量
import { CustomError } from '../libs/utils/errors'; // 導入標準錯誤類型

// 獲取 Firestore 實例
const db = firestore();
const storesCollection = db.collection('stores');

/**
 * 店鋪過濾條件 - 與 listStoresQuerySchema 對應
 */
export interface StoreFilter {
  page?: number;
  limit?: number;
  sort?: 'createdAt' | 'name' | 'status'; // 與 schema 對應
  order?: 'asc' | 'desc';
  status?: 'active' | 'inactive' | 'temporary_closed' | 'permanently_closed'; // 與 schema 對應
  tenantId?: string; 
  query?: string; // 用於搜索店鋪名稱、代碼或地址
}

/**
 * 生成用於搜索的關鍵字陣列
 * @param name 店鋪名稱
 * @param storeCode 店鋪代碼
 * @param address 店鋪地址 (可選)
 * @returns 關鍵字陣列
 */
function generateSearchableKeywords(name: string, storeCode?: string, address?: string): string[] {
  const keywords: string[] = [];
  if (name) {
    keywords.push(...name.toLowerCase().split(' ').filter(k => k.length > 0));
  }
  if (storeCode) {
    keywords.push(storeCode.toLowerCase());
  }
  if (address) {
    keywords.push(...address.toLowerCase().split(' ').filter(k => k.length > 0));
  }
  // 移除重複並限制數量，可根據需要優化
  return Array.from(new Set(keywords)).slice(0, 50);
}

/**
 * 店鋪服務層 - 處理與 Firestore 的數據交互
 */
export class StoreService {
  /**
   * 根據 ID 獲取店鋪
   */
  async getStoreById(storeId: string, user: UserContext): Promise<Store | null> {
    // 權限檢查：需要有讀取店鋪資源的權限
    const canRead = hasPermission(user, ResourceTypes.STORES, 'read', { storeId, tenantId: user.tenantId });
    if (!canRead) {
      throw new CustomError('未授權：您沒有權限查看此店鋪', 403);
    }

    try {
      // 查詢店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return null;
      }
      
      const storeData = storeDoc.data() as Store; // 使用更新後的類型

      // 租戶隔離：非超級管理員只能訪問自己租戶的店鋪
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
         // 雖然 RBAC 已做基本過濾，這裡再次確認數據層級的隔離
        throw new CustomError('未授權：您無法訪問其他租戶的店鋪', 403);
      }
      
      // 過濾掉已邏輯刪除的店鋪，除非用戶有特殊權限（例如 super_admin 或能看所有店鋪的 admin）
      if (storeData.isDeleted && user.role !== 'super_admin') { // 可根據實際 RBAC 策略調整此處判斷
         // 如果需要更細粒度的邏輯刪除訪問權限，可以在 hasPermission 中處理
         throw new CustomError('店鋪不存在或已刪除', 404); // 對一般用戶隱藏邏輯刪除的存在
      }

      return this.convertStoreDocument(storeDoc);
    } catch (error) {
      console.error(`獲取店鋪(${storeId})時出錯:`, error);
      // 拋出標準錯誤
      if (error instanceof CustomError) throw error;
      throw new CustomError('獲取店鋪時發生內部錯誤', 500, error);
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
    // 權限檢查：需要有讀取店鋪列表的權限
    const canList = hasPermission(user, ResourceTypes.STORES, 'read', { tenantId: user.tenantId });
     if (!canList) {
      throw new CustomError('未授權：您沒有權限查看店鋪列表', 403);
    }

    try {
      // 解構過濾條件
      const {
        page = 1,
        limit = 20,
        sort = 'createdAt',
        order = 'desc',
        status,
        query
      } = filter;
      
      // 構建查詢
      let queryRef = storesCollection as firestore.Query;
      
      // 租戶隔離 - 如果不是超級管理員，只能查看自己租戶的店鋪
      // RBAC 層應該已經處理了大部分租戶隔離，這裡作為數據層的二次確認
      if (user.role !== 'super_admin' && user.tenantId) {
        queryRef = queryRef.where('tenantId', '==', user.tenantId);
      }
      
      // 應用狀態過濾
      if (status) {
        queryRef = queryRef.where('status', '==', status);
      }
      
      // 過濾掉已邏輯刪除的店鋪，除非用戶有特殊權限 (list 權限中包含了查看已刪除的)
      // 假設 RBAC 的 'read' action 默認不包含已刪除，如需包含，需在 RBAC 規則中定義或在此處額外處理
      queryRef = queryRef.where('isDeleted', '!=', true); // 過濾掉 isDeleted 為 true 的
      
      // 應用排序
      // 根據 API 規格支持的 sort 字段
      const validSortFields = ['createdAt', 'name', 'status'];
      if (validSortFields.includes(sort)) {
         queryRef = queryRef.orderBy(sort, order);
      } else {
        // 對於不支持的排序字段，拋出錯誤或使用默認排序
        console.warn(`收到不支持的排序字段: ${sort}, 使用默認排序 createdAt ${order}`);
         queryRef = queryRef.orderBy('createdAt', order); // 默認排序
      }
       // 添加次級排序以確保穩定性，例如按創建時間
       if (sort !== 'createdAt') {
          queryRef = queryRef.orderBy('createdAt', 'desc');
       }
      
      // 如果有搜索查詢，使用 searchableKeywords 進行過濾
      if (query) {
        const searchTerm = query.toLowerCase();
        // 使用 array-contains-any 查詢，可能需要生成多個查詢
        // 由於 Firestore array-contains-any 的限制 (最多10個值)，可能需要更複雜的實現或提示用戶精確查詢
        // 此處實現一個簡化版本，僅使用 array-contains 匹配單個詞
        // TODO: 優化搜索邏輯以支持更靈活的模糊搜索或全文搜索集成
        // queryRef = queryRef.where('searchableKeywords', 'array-contains', searchTerm); 
        // 簡易實現：只返回可能匹配的，後續在應用層過濾或使用更強大的搜索方案
        // 這裡暫時不應用 where 條件，依賴 Service 層外的模糊匹配或後續優化
         console.warn("模糊搜索功能(query)在 listStores 中暫未完全實現數據庫層級過濾。");
      }
      
      // 獲取總數 (使用 count() 聚合查詢)
      const countSnapshot = await queryRef.count().get();
      const total = countSnapshot.data().count;
      
      // 計算分頁信息
      const pageSize = Math.min(100, limit); // 最大返回100條 (與 API 規格一致)
      const offset = (page - 1) * pageSize;
      const totalPages = Math.ceil(total / pageSize);

      // 獲取特定頁面的結果
      const paginatedQuerySnapshot = await queryRef.offset(offset).limit(pageSize).get();
      
      // 轉換文檔並進行可能的 Service 層模糊匹配（如果數據庫層未完全支持）
      let stores = paginatedQuerySnapshot.docs.map(doc =>
        this.convertStoreDocument(doc)
      );

      // 簡易 Service 層模糊匹配 (如果數據庫層未實現)
      if (query) {
         const searchTerm = query.toLowerCase();
         stores = stores.filter(store => 
            (store.name?.toLowerCase().includes(searchTerm)) ||
            (store.storeCode?.toLowerCase().includes(searchTerm)) ||
            (store.address && 
             (store.address.street?.toLowerCase().includes(searchTerm) ||
              store.address.city?.toLowerCase().includes(searchTerm) ||
              store.address.state?.toLowerCase().includes(searchTerm) ||
              store.address.postalCode?.toLowerCase().includes(searchTerm) ||
              store.address.country?.toLowerCase().includes(searchTerm)
             ))
         );
         // 注意：Service 層過濾會導致 total 不準確，需要更先進的搜索方案
         console.warn("listStores Service 層模糊匹配可能導致總數不準確。");
      }
      
      return {
        stores,
        total,
        page,
        limit: pageSize,
        totalPages
      };
    } catch (error) {
      console.error('獲取店鋪列表時出錯:', error);
      // 拋出標準錯誤
      if (error instanceof CustomError) throw error;
      throw new CustomError('獲取店鋪列表時發生內部錯誤', 500, error);
    }
  }

  /**
   * 創建新店鋪
   */
  async createStore(data: CreateStoreRequest, user: UserContext): Promise<Store> {
    // 權限檢查：需要有創建店鋪資源的權限
    const canCreate = hasPermission(user, ResourceTypes.STORES, 'create', { tenantId: data.tenantId });
     if (!canCreate) {
      throw new CustomError('未授權：您沒有權限創建店鋪', 403);
    }

    try {
      // 租戶隔離 - 確保是同一租戶 (RBAC 已檢查，這裡再次確認)
      if (user.role !== 'super_admin') {
        if (!user.tenantId) {
          throw new CustomError('未授權：請求用戶上下文無效（缺少 tenantId）', 400);
        }
        // 確保使用者無法為其他租戶創建店鋪
        if (data.tenantId !== user.tenantId) {
          throw new CustomError('未授權：您無法為其他租戶創建店鋪', 403);
        }
      }

      // 檢查 storeCode 是否已存在於同一租戶下
      if (data.storeCode) {
          const existingStore = await storesCollection
              .where('tenantId', '==', data.tenantId)
              .where('storeCode', '==', data.storeCode)
              .where('isDeleted', '!=', true) // 排除已邏輯刪除的
              .limit(1).get();

          if (!existingStore.empty) {
              throw new CustomError(`店鋪代碼 '${data.storeCode}' 在此租戶下已存在`, 409);
          }
      }
      
      // 店鋪 ID 生成邏輯
      const storeId = this.generateStoreId();
      
      // 創建店鋪數據，映射請求數據到 Store 結構
      const storeData: Store = {
        storeId,
        tenantId: data.tenantId,
        name: data.name,
        storeCode: data.storeCode,
        description: data.description,
        status: data.status,
        address: data.address,
        location: data.location,
        contactInfo: data.contactInfo,
        operatingHours: data.operatingHours,
        gpsFence: data.gpsFence,
        printerSettings: data.printerSettings,
        attendanceSettings: data.attendanceSettings,
        settings: data.settings || {},
        createdAt: FieldValue.serverTimestamp() as any,
        updatedAt: FieldValue.serverTimestamp() as any,
        createdBy: user.uid,
        updatedBy: user.uid,
        isDeleted: false, // 新建時確保為 false
        // 添加 searchableKeywords 字段
        searchableKeywords: generateSearchableKeywords(data.name, data.storeCode, data.address?.street)
      };
      
      // 儲存到 Firestore
      await storesCollection.doc(storeId).set(storeData);
      console.log(`成功創建店鋪：${storeId}`);
      
      // 獲取創建後的文檔以便返回準確的時間戳
      const createdStoreDoc = await storesCollection.doc(storeId).get();
      return this.convertStoreDocument(createdStoreDoc);

    } catch (error) {
      console.error('創建店鋪時出錯:', error);
      // 拋出標準錯誤
      if (error instanceof CustomError) throw error;
      // 檢查 Firestore 唯一的索引錯誤 (如果配置了 storeCode 的唯一索引)
      // 目前 Firestore 僅支持單字段唯一索引，複合唯一索引 (tenantId + storeCode) 需要代碼實現檢查
      // 上面的 storeCode 檢查已經實現了複合唯一性檢查
      throw new CustomError('創建店鋪時發生內部錯誤', 500, error);
    }
  }

  /**
   * 更新店鋪
   */
  async updateStore(storeId: string, data: UpdateStoreRequest, user: UserContext): Promise<Store | null> {
    // 權限檢查：需要有更新店鋪資源的權限
    const canUpdate = hasPermission(user, ResourceTypes.STORES, 'update', { storeId, tenantId: user.tenantId });
     if (!canUpdate) {
      throw new CustomError('未授權：您沒有權限更新此店鋪', 403);
    }

    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return null; // 或拋出 404 錯誤
      }
      
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能更新自己租戶的店鋪 (RBAC 已檢查，這裡再次確認)
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new CustomError('未授權：您無法更新其他租戶的店鋪', 403);
      }

      // 禁止更改某些欄位 (storeId, tenantId, createdAt, createdBy)
      const updateObject: any = {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      };
      
      delete updateObject.storeId;
      delete updateObject.tenantId;
      delete updateObject.createdAt;
      delete updateObject.createdBy;
      // 禁止通過一般更新接口改變刪除狀態，使用專門的刪除接口
      delete updateObject.isDeleted;

      // 如果更新了 name, storeCode 或 address，需要重新生成 searchableKeywords
      if (data.name !== undefined || data.storeCode !== undefined || (data.address && storeData.address?.street !== data.address.street)) {
         const updatedName = data.name !== undefined ? data.name : storeData.name;
         const updatedStoreCode = data.storeCode !== undefined ? data.storeCode : storeData.storeCode;
         // 假設地址變化主要體現在 street 字段，這裡可以根據實際情況調整
         const updatedAddressStreet = data.address?.street !== undefined ? data.address.street : storeData.address?.street;
         updateObject.searchableKeywords = generateSearchableKeywords(updatedName, updatedStoreCode, updatedAddressStreet);
      }

      // 執行更新操作
      await storesCollection.doc(storeId).update(updateObject);
      console.log(`成功更新店鋪 ${storeId}`);
      
      // 獲取更新後的店鋪資料
      const updatedStoreDoc = await storesCollection.doc(storeId).get();
      return this.convertStoreDocument(updatedStoreDoc);
    } catch (error) {
      console.error(`更新店鋪(${storeId})時出錯:`, error);
      // 拋出標準錯誤
      if (error instanceof CustomError) throw error;
       // 檢查是否是 storeCode 重複的錯誤 (如果在更新時發生)
       // 需要根據 Firestore 錯誤碼判斷，或者依賴前端驗證/後端先查詢
       // 目前假設更新時 storeCode 的唯一性檢查在 Service 層之外完成或通過索引觸發
      throw new CustomError('更新店鋪時發生內部錯誤', 500, error);
    }
  }

  /**
   * 更新店鋪狀態
   */
  async updateStoreStatus(storeId: string, status: Store['status'], user: UserContext): Promise<Store | null> {
     // 權限檢查：需要有更新店鋪資源的權限
     // 狀態更新可能是細分權限，這裡暫時使用 update action
     const canUpdate = hasPermission(user, ResourceTypes.STORES, 'update', { storeId, tenantId: user.tenantId });
      if (!canUpdate) {
       throw new CustomError('未授權：您沒有權限更新此店鋪狀態', 403);
     }

    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return null; // 或拋出 404 錯誤
      }
      
      const storeData = storeDoc.data() as Store;

      // 租戶隔離 - 非超級管理員只能更新自己租戶的店鋪 (RBAC 已檢查，這裡再次確認)
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new CustomError('未授權：您無法更新其他租戶的店鋪狀態', 403);
      }

      // 執行更新操作
      await storesCollection.doc(storeId).update({
        status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
      
      console.log(`成功更新店鋪 ${storeId} 的狀態為 ${status}`);

      // 獲取更新後的店鋪資料
      const updatedStoreDoc = await storesCollection.doc(storeId).get();
      return this.convertStoreDocument(updatedStoreDoc);

    } catch (error) {
      console.error(`更新店鋪狀態(${storeId})時出錯:`, error);
      // 拋出標準錯誤
      if (error instanceof CustomError) throw error;
      throw new CustomError('更新店鋪狀態時發生內部錯誤', 500, error);
    }
  }

  /**
   * 刪除店鋪 (邏輯刪除，可選物理刪除)
   */
  async deleteStore(storeId: string, user: UserContext, hardDelete: boolean = false): Promise<boolean> {
     // 權限檢查：需要有刪除店鋪資源的權限
     // 物理刪除可能需要更高級別權限，可在 RBAC 規則中細分條件
     const canDelete = hasPermission(user, ResourceTypes.STORES, 'delete', { storeId, tenantId: user.tenantId, hardDelete });
      if (!canDelete) {
       throw new CustomError('未授權：您沒有權限刪除此店鋪', 403);
     }

    try {
      // 獲取店鋪文檔
      const storeDoc = await storesCollection.doc(storeId).get();
      
      if (!storeDoc.exists) {
        return false; // 或拋出 404 錯誤
      }
      
      const storeData = storeDoc.data() as Store;
      
      // 租戶隔離 - 非超級管理員只能刪除自己租戶的店鋪 (RBAC 已檢查，這裡再次確認)
      if (user.role !== 'super_admin' && storeData.tenantId !== user.tenantId) {
        throw new CustomError('未授權：您無法刪除其他租戶的店鋪', 403);
      }

      // 檢查是否有關聯數據阻止刪除 (例如，如果店鋪下還有活躍員工或未完成訂單)
      // 這部分邏輯可能需要額外查詢，根據業務規則實現
      // 例如：查詢 employees 集合 WHERE storeId == storeId AND status != 'terminated' AND isDeleted != true
      // const hasActiveEmployees = await db.collection('employees').where('storeId', '==', storeId).where('status', '!=', 'terminated').where('isDeleted', '!=', true).limit(1).get();
      // if (!hasActiveEmployees.empty) {
      //    throw new CustomError('店鋪下存在活躍員工，無法刪除', 409); // Conflict
      // }
      // TODO: 實現關聯數據檢查
       console.warn(`刪除店鋪 ${storeId} 時的關聯數據檢查尚未實現.`);

      // 物理刪除 (僅限超級管理員且 hardDelete 為 true)
      if (hardDelete && user.role === 'super_admin') { // 再次確認角色，儘管 RBAC 已檢查
        await storesCollection.doc(storeId).delete();
        console.log(`成功物理刪除店鋪 ${storeId}`);
      } else {
        // 邏輯刪除
        await storesCollection.doc(storeId).update({
          // 邏輯刪除只設置 isDeleted 標誌，狀態可以設置為 permanently_closed
          status: 'permanently_closed', // 根據業務需求，邏輯刪除後狀態設為永久關閉
          isDeleted: true,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: user.uid
        });
        console.log(`成功邏輯刪除店鋪 ${storeId}`);
      }
      
      return true;
    } catch (error) {
      console.error(`刪除店鋪(${storeId})時出錯:`, error);
      // 拋出標準錯誤
      if (error instanceof CustomError) throw error;
      throw new CustomError('刪除店鋪時發生內部錯誤', 500, error);
    }
  }

   // TODO: 審閱和修改其他子功能更新方法 (updateGPSFence, updatePrinterConfig, updateStoreLocation, updateStoreBusinessHours, updateStoreAttendanceSettings)
   // 確保它們使用更新後的類型、整合 RBAC 檢查、統一錯誤處理，並將數據正確映射到 Store 結構的相應子字段。
   // 注意：api-specs/stores.yaml 中沒有獨立的 updateStoreLocation API，這個方法可能需要移除或合併到 updateStore 中。
   // BusinessHours 和 AttendanceSettings 的更新方法在 service 中有重複定義，需要清理和統一。


  /**
   * 將 Firestore 文檔轉換為 Store 接口對象
   * @param doc Firestore 文檔快照
   * @returns Store 對象
   */
  private convertStoreDocument(doc: DocumentSnapshot): Store {
    const data = doc.data() as any; // 先作為 any 處理，便於轉換舊數據結構

    // 轉換時間戳字段
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt;
    const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt;

    // 根據最新的 Store 接口進行數據映射
    const store: Store = {
      storeId: doc.id,
      tenantId: data.tenantId,
      name: data.name || data.storeName || '', // 兼容舊字段
      storeCode: data.storeCode || '',
      description: data.description,
      status: data.status || (data.isActive ? 'active' : 'inactive'), // 兼容舊狀態字段
      address: data.address || (data.address ? { street: data.address, city: '', state: '', postalCode: '', country: '' } : undefined), // 兼容舊的單行地址
      location: data.location || data.geolocation || undefined, // 兼容舊字段
      contactInfo: data.contactInfo || (data.phoneNumber || data.contactPerson || data.email ? { phone: data.phoneNumber, email: data.email, managerId: undefined } : undefined), // 兼容舊字段
      operatingHours: data.operatingHours || data.businessHours || undefined, // 兼容舊字段
      gpsFence: data.gpsFence || undefined, // 與 types 對應
      printerSettings: data.printerSettings || data.printerConfig || undefined, // 兼容舊字段
      attendanceSettings: data.attendanceSettings || undefined, // 與 types 對應
      settings: data.settings || {},
      createdAt,
      updatedAt,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      isDeleted: data.isDeleted || false, // 兼容舊數據，默認 false
       searchableKeywords: data.searchableKeywords || [], // 添加 searchableKeywords 字段
    };

     // 清理 undefined 字段，確保返回的對象結構乾淨
     Object.keys(store).forEach(key => (store as any)[key] === undefined && delete (store as any)[key]);

    return store;
  }

  /**
   * 生成新的店鋪 ID
   * @returns 新的店鋪 ID 字符串
   */
  private generateStoreId(): string {
    // 使用 Firestore 的 auto-id 功能生成文檔 ID 作為店鋪 ID
    return storesCollection.doc().id;
  }
}

// 導出服務單例
export const storeService = new StoreService(); 