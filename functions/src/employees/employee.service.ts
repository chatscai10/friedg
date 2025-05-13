import { firestore } from 'firebase-admin';
import { FieldValue, Timestamp, DocumentSnapshot } from 'firebase-admin/firestore';
import { 
  Employee, 
  EmployeeFilter, 
  CreateEmployeeRequest, 
  UpdateEmployeeRequest,
  UserContext
} from './employee.types';

// 獲取 Firestore 實例
const db = firestore();
const employeesCollection = db.collection('employees');
const storesCollection = db.collection('stores');
const rolesCollection = db.collection('roles');

// 生成唯一的員工 ID (格式: emp_{隨機字符})
function generateEmployeeId(): string {
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `emp_${randomStr}`;
}

/**
 * 員工服務層 - 處理與 Firestore 的數據交互
 */
export class EmployeeService {
  /**
   * 創建新員工
   */
  async createEmployee(data: CreateEmployeeRequest, user: UserContext): Promise<Employee> {
    // 生成唯一員工 ID
    const employeeId = generateEmployeeId();
    
    // 租戶ID應始終來自用戶上下文，以確保安全
    const tenantToUse = user.tenantId;

    // 如果是店鋪管理員，則 storeId 必須是其管理的店鋪之一
    // 注意：此檢查通常在 handler 層更合適，以儘早拒絕請求
    // 但作為服務層的額外保障，可以保留或根據團隊規範調整
    if (user.role === 'store_manager') {
      if (data.storeId !== user.storeId && (!user.additionalStoreIds || !user.additionalStoreIds.includes(data.storeId))) {
        // Handler 層應該已經處理了這個情況，但這裡作為最後防線
        throw new Error('未授權：店鋪管理員只能為其管理的店鋪創建員工。');
      }
    }
    
    // 創建員工數據對象
    const employeeData: Employee = {
      employeeId,
      userId: data.userId,
      tenantId: tenantToUse, // 強制使用用戶上下文中的 tenantId
      storeId: data.storeId,
      additionalStoreIds: data.additionalStoreIds || [],
      employeeCode: data.employeeCode || employeeId,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: `${data.firstName} ${data.lastName}`,
      position: data.position,
      employmentType: data.employmentType,
      status: data.status || 'active',
      hireDate: data.hireDate,
      terminationDate: data.terminationDate,
      contactInfo: data.contactInfo,
      photoURL: data.photoURL,
      schedule: data.schedule,
      employmentInfo: data.employmentInfo || {
        roleLevel: 1 // 默認最低權限等級
      },
      payInfo: data.payInfo,
      quietHours: data.quietHours,
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
      createdBy: user.uid,
      updatedBy: user.uid, // 創建時 updatedBy 也是創建者
    };

    // 保存到 Firestore
    await employeesCollection.doc(employeeId).set(employeeData);
    console.log(`成功創建員工：${employeeId}`);

    // 返回創建的員工數據
    return {
      ...employeeData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  /**
   * 根據 ID 獲取單個員工
   */
  async getEmployeeById(employeeId: string, user: UserContext): Promise<Employee | null> {
    // 查詢員工文檔
    const employeeDoc = await employeesCollection.doc(employeeId).get();
    
    if (!employeeDoc.exists) {
      return null;
    }

    // 獲取員工數據
    const employeeData = employeeDoc.data() as Employee;
    
    // 檢查租戶隔離
    if (employeeData.tenantId !== user.tenantId) {
      throw new Error('未授權：此員工不屬於您的租戶');
    }

    // 檢查店鋪管理員權限
    if (user.role === 'store_manager') {
      const userManagesStore = 
        user.storeId === employeeData.storeId || 
        (user.additionalStoreIds && user.additionalStoreIds.includes(employeeData.storeId));
      
      if (!userManagesStore) {
        throw new Error('未授權：您無法訪問其他店鋪的員工');
      }
    }

    return this.convertEmployeeDocument(employeeDoc);
  }

  /**
   * 列出員工（支持分頁和過濾）
   */
  async listEmployees(filter: EmployeeFilter, user: UserContext): Promise<{
    employees: Employee[],
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }> {
    // 解構過濾條件
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      status, // 允許外部傳入 status 進行過濾
      storeId,
      roleId, // 新增 roleId 過濾
      employmentType,
      position,
      // query // 移除了 query 參數的解構，因為客戶端過濾邏輯已移除
    } = filter;

    // 構建查詢
    let queryRef = employeesCollection.where('tenantId', '==', user.tenantId);

    // 店鋪管理員只能查看其管理的店鋪的員工
    if (user.role === 'store_manager' && user.storeId) {
      // 檢查查詢中是否指定了特定店鋪
      if (storeId) {
        // 如果指定了特定店鋪，則需要檢查該店鋪是否由當前管理員管理
        const isManagingStore = user.storeId === storeId ||
          (user.additionalStoreIds && user.additionalStoreIds.includes(storeId));

        if (!isManagingStore) {
          throw new Error('未授權：您無法查看非管理店鋪的員工');
        }

        queryRef = queryRef.where('storeId', '==', storeId);
      } else {
        // 如果未指定特定店鋪，僅查看主要管理的店鋪
        queryRef = queryRef.where('storeId', '==', user.storeId);
      }
    } else if (storeId) {
      // 租戶管理員可以指定查詢特定店鋪
      queryRef = queryRef.where('storeId', '==', storeId);
    }

    // 應用其他過濾條件
    // 如果外部沒有傳入 status，則默認只查詢 'active' 狀態的員工
    // 如果外部傳入了 status，則使用外部傳入的 status
    if (status) {
      queryRef = queryRef.where('status', '==', status);
    } else {
      queryRef = queryRef.where('status', '==', 'active');
    }

    // 如果有指定 roleId，則過濾該角色的員工
    if (roleId) {
      queryRef = queryRef.where('employmentInfo.roleId', '==', roleId);
    }

    if (employmentType) {
      queryRef = queryRef.where('employmentType', '==', employmentType);
    }
    
    if (position) {
      queryRef = queryRef.where('position', '==', position);
    }
    
    // 應用排序
    if (sort === 'createdAt' || sort === 'updatedAt' || sort === 'hireDate') {
      queryRef = queryRef.orderBy(sort, order);
    } else {
      // 默認按創建時間排序
      queryRef = queryRef.orderBy('createdAt', order);
    }

    // 獲取總數 (使用 count() 聚合查詢)
    const countSnapshot = await queryRef.count().get();
    const total = countSnapshot.data().count;

    // 計算分頁信息
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // 獲取特定頁面的結果
    const paginatedQuerySnapshot = await queryRef.offset(offset).limit(limit).get();
    
    // 轉換文檔
    const employees = paginatedQuerySnapshot.docs.map(doc =>
      this.convertEmployeeDocument(doc)
    );

    return {
      employees: employees, // 直接返回從 Firestore 查詢到的員工
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * 更新員工信息
   */
  async updateEmployee(employeeId: string, data: UpdateEmployeeRequest, user: UserContext): Promise<Employee> {
    // 獲取當前員工數據
    const employeeDocRef = employeesCollection.doc(employeeId);
    const employeeDoc = await employeeDocRef.get();
    
    if (!employeeDoc.exists) {
      throw new Error(`找不到 ID 為 ${employeeId} 的員工`);
    }
    
    const currentEmployeeData = employeeDoc.data() as Employee;
    
    // 檢查租戶隔離：員工必須屬於操作用戶的租戶
    if (currentEmployeeData.tenantId !== user.tenantId) {
      throw new Error('未授權：此員工不屬於您的租戶');
    }
    
    // 權限檢查：店鋪管理員的特定邏輯
    if (user.role === 'store_manager') {
      // 檢查店鋪管理員是否管理該員工所在的原始店鋪
      const managesOriginalStore = 
        user.storeId === currentEmployeeData.storeId || 
        (user.additionalStoreIds && user.additionalStoreIds.includes(currentEmployeeData.storeId));
      
      if (!managesOriginalStore) {
        throw new Error('未授權：您無法更新非管理店鋪的員工');
      }
      
      // 如果請求中包含 storeId（即嘗試轉移店鋪）
      if (data.storeId && data.storeId !== currentEmployeeData.storeId) {
        // 檢查店鋪管理員是否也管理目標店鋪
        const managesTargetStore = 
          user.storeId === data.storeId || 
          (user.additionalStoreIds && user.additionalStoreIds.includes(data.storeId));
        
        if (!managesTargetStore) {
          throw new Error('未授權：您無法將員工轉移到非您管理的店鋪');
        }
        
        // 如果店鋪變更，需要驗證新店鋪是否存在
        const isStoreValid = await this.validateStore(data.storeId, user.tenantId);
        if (!isStoreValid) {
          throw new Error(`未找到 ID 為 ${data.storeId} 的店鋪`);
        }
      }
    }
    
    // 準備更新數據，深複製防止修改原始請求對象
    const updatePayload: Partial<Employee> = {}; 
    
    // 處理基本欄位
    if (data.firstName !== undefined) updatePayload.firstName = data.firstName;
    if (data.lastName !== undefined) updatePayload.lastName = data.lastName;
    if (data.storeId !== undefined) updatePayload.storeId = data.storeId;
    if (data.additionalStoreIds !== undefined) updatePayload.additionalStoreIds = data.additionalStoreIds;
    if (data.position !== undefined) updatePayload.position = data.position;
    if (data.employmentType !== undefined) updatePayload.employmentType = data.employmentType;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.hireDate !== undefined) updatePayload.hireDate = data.hireDate;
    if (data.terminationDate !== undefined) updatePayload.terminationDate = data.terminationDate;
    if (data.photoURL !== undefined) updatePayload.photoURL = data.photoURL;

    // 處理嵌套對象的更新 - contactInfo
    if (data.contactInfo) {
      updatePayload.contactInfo = {
        ...currentEmployeeData.contactInfo || {},
        ...data.contactInfo
      };
    }

    // 處理嵌套對象的更新 - schedule
    if (data.schedule) {
      updatePayload.schedule = {
        ...currentEmployeeData.schedule || {},
        ...data.schedule
      };
    }

    // 處理嵌套對象的更新 - employmentInfo
    if (data.employmentInfo) {
      updatePayload.employmentInfo = {
        ...currentEmployeeData.employmentInfo || { roleLevel: 1 },
        ...data.employmentInfo
      };

      // 如果更新了 roleId，但沒提供 roleLevel，則保留原有 roleLevel
      if (data.employmentInfo.roleId !== undefined && data.employmentInfo.roleLevel === undefined) {
        updatePayload.employmentInfo.roleLevel = currentEmployeeData.employmentInfo?.roleLevel || 1;
      }
    }

    // 處理嵌套對象的更新 - payInfo
    if (data.payInfo) {
      updatePayload.payInfo = {
        ...currentEmployeeData.payInfo || {},
        ...data.payInfo
      };
    }

    // 處理嵌套對象的更新 - quietHours
    if (data.quietHours) {
      updatePayload.quietHours = {
        ...currentEmployeeData.quietHours || { enabled: false, startTime: '22:00', endTime: '08:00' },
        ...data.quietHours
      };
    }

    // 如果更新了名字或姓氏，更新顯示名稱
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const firstName = data.firstName !== undefined ? data.firstName : currentEmployeeData.firstName;
      const lastName = data.lastName !== undefined ? data.lastName : currentEmployeeData.lastName;
      updatePayload.displayName = `${firstName} ${lastName}`;
    }

    // 添加審計欄位
    updatePayload.updatedAt = FieldValue.serverTimestamp() as any;
    updatePayload.updatedBy = user.uid;
    
    // 執行更新
    await employeeDocRef.update(updatePayload);
    console.log(`員工 ${employeeId} 資料已更新，更新者：${user.uid}`);
    
    // 獲取更新後的員工數據
    const updatedEmployeeDoc = await employeeDocRef.get();
    return this.convertEmployeeDocument(updatedEmployeeDoc);
  }

  /**
   * 刪除員工（軟刪除）
   * 將員工狀態更新為 terminated 並添加刪除相關審計欄位
   */
  async deleteEmployee(employeeId: string, user: UserContext): Promise<boolean> {
    console.log(`嘗試刪除員工 ${employeeId}，操作者：${user.uid}`);
    
    // 獲取當前員工數據
    const employeeDocRef = employeesCollection.doc(employeeId);
    const employeeDoc = await employeeDocRef.get();

    if (!employeeDoc.exists) {
      console.log(`找不到 ID 為 ${employeeId} 的員工，無法刪除`);
      throw new Error(`找不到 ID 為 ${employeeId} 的員工`);
    }

    const employeeData = employeeDoc.data() as Employee;

    // 檢查租戶隔離
    if (employeeData.tenantId !== user.tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid}（租戶 ${user.tenantId}）嘗試刪除其他租戶 ${employeeData.tenantId} 的員工`);
      throw new Error('未授權：此員工不屬於您的租戶');
    }

    // 檢查店鋪管理員權限 (如果用戶是店鋪管理員)
    if (user.role === 'store_manager') {
      const userManagesStore = 
        user.storeId === employeeData.storeId || 
        (user.additionalStoreIds && user.additionalStoreIds.includes(employeeData.storeId));

      if (!userManagesStore) {
        console.warn(`權限不足：店鋪管理員 ${user.uid} 嘗試刪除非其管理店鋪的員工`);
        throw new Error('未授權：您無法刪除其他店鋪的員工');
      }
    }

    // 檢查員工是否已經被刪除（狀態為 terminated）
    if (employeeData.status === 'terminated') {
      console.log(`員工 ${employeeId} 已處於刪除狀態（terminated），不執行重複操作`);
      // 返回 true 表示操作成功（雖然沒有實際更改）
      return true;
    }

    // 執行邏輯刪除
    await employeeDocRef.update({
      status: 'terminated', // 將狀態設置為終止/刪除
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
      terminationDate: FieldValue.serverTimestamp(), // 更新終止日期
      deletedAt: FieldValue.serverTimestamp(), // 添加刪除時間戳
      deletedBy: user.uid // 添加刪除者信息
    });

    console.log(`員工 ${employeeId} 已被邏輯刪除（狀態更新為 terminated），刪除者：${user.uid}`);
    return true;
  }

  /**
   * 驗證店鋪存在性和所有權
   */
  async validateStore(storeId: string, tenantId: string): Promise<boolean> {
    if (!storeId) return false;
    
    const storeDoc = await storesCollection.doc(storeId).get();
    
    if (!storeDoc.exists) {
      return false;
    }
    
    const storeData = storeDoc.data();
    return storeData?.tenantId === tenantId;
  }

  /**
   * 將 Firestore 文檔轉換為 Employee 對象
   */
  private convertEmployeeDocument(doc: DocumentSnapshot): Employee {
    const data = doc.data() as Employee;
    
    // 處理 Timestamp 類型 (確保客戶端獲得標準格式)
    let result = {
      ...data,
      employeeId: doc.id // 如果沒有 employeeId，使用文檔 ID
    } as Employee;
    
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
    
    if (data.approvedAt && typeof data.approvedAt !== 'string') {
      if ('toDate' in (data.approvedAt as any)) {
        result.approvedAt = (data.approvedAt as Timestamp).toDate().toISOString();
      }
    }
    
    return result;
  }

  /**
   * 新增員工功能 (簡化版)
   * 僅處理基本必要資訊
   */
  async addEmployee(data: {
    employeeId: string;
    name: string;
    roleId: string;
    storeId: string;
    email: string;
    phone: string;
    status?: string;
  }, user: UserContext): Promise<any> {
    // 檢查 employeeId 是否已存在
    const existingEmployeeId = await employeesCollection
      .where('employeeId', '==', data.employeeId)
      .where('tenantId', '==', user.tenantId)
      .get();
    
    if (!existingEmployeeId.empty) {
      throw new Error('員工ID已存在');
    }
    
    // 檢查 email 是否已存在
    const existingEmail = await employeesCollection
      .where('contactInfo.email', '==', data.email)
      .where('tenantId', '==', user.tenantId)
      .get();
    
    if (!existingEmail.empty) {
      throw new Error('Email已被使用');
    }
    
    // 檢查 roleId 是否存在 (可選)
    const roleDoc = await rolesCollection.doc(data.roleId).get();
    if (!roleDoc.exists) {
      throw new Error(`角色ID ${data.roleId} 不存在`);
    }
    
    // 檢查 storeId 是否存在 (可選)
    const storeDoc = await storesCollection.doc(data.storeId).get();
    if (!storeDoc.exists) {
      throw new Error(`店鋪ID ${data.storeId} 不存在`);
    }
    
    // 分割全名
    const nameParts = data.name.trim().split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts.pop() || '' : '';
    const firstName = nameParts.join(' ');

    // 準備員工資料 (基本欄位)
    const employeeData: Employee = {
      employeeId: data.employeeId,
      tenantId: user.tenantId,
      storeId: data.storeId,
      firstName: firstName || data.name, // 如果無法分割，整個名字作為 firstName
      lastName: lastName, 
      displayName: data.name,
      position: roleDoc.exists ? roleDoc.data()?.name || 'Staff' : 'Staff',
      employmentType: 'full_time', // 預設值
      status: data.status || 'active',
      contactInfo: {
        email: data.email,
        phone: data.phone
      },
      employmentInfo: {
        roleId: data.roleId,
        roleLevel: roleDoc.exists ? roleDoc.data()?.level || 1 : 1
      },
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
      createdBy: user.uid,
      updatedBy: user.uid
    };
    
    // 儲存到 Firestore
    await employeesCollection.doc(data.employeeId).set(employeeData);
    
    // 返回建立的員工資料
    return {
      employeeId: data.employeeId,
      name: data.name,
      roleId: data.roleId,
      storeId: data.storeId,
      email: data.email,
      phone: data.phone,
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}

// 導出服務單例
export const employeeService = new EmployeeService(); 