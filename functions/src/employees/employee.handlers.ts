import { Request, Response } from 'express';
import { firestore } from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  Employee, 
  CreateEmployeeRequest, 
  UpdateEmployeeRequest, 
  PaginatedEmployeeResponse,
  UserContext,
  EmployeeFilter
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
 * 創建新員工
 * POST /employees
 */
export const createEmployee = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取經過驗證的請求數據 (中間件已處理驗證)
    const requestData: CreateEmployeeRequest = req.body;
    
    // 獲取用戶上下文 (從 Auth 中間件)
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }

    // 獲取租戶 ID
    const tenantId = user.tenantId;
    if (!tenantId) {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }

    // 確保請求的 tenantId 與用戶的 tenantId 匹配 (租戶隔離)
    if (requestData.tenantId !== tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試在不同租戶創建員工`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法在其他租戶中創建員工'
      });
    }

    // 驗證店鋪管理員只能為其管理的店鋪創建員工
    if (user.role === 'store_manager' && user.storeId !== requestData.storeId) {
      console.warn(`權限拒絕：店鋪管理員 ${user.uid} 嘗試在非管理店鋪 ${requestData.storeId} 創建員工`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：店鋪管理員只能為其管理的店鋪創建員工'
      });
    }

    // 驗證店鋪存在性
    const storeRef = storesCollection.doc(requestData.storeId);
    const storeSnap = await storeRef.get();
    
    if (!storeSnap.exists) {
      return res.status(400).json({
        status: 'error',
        message: `未找到 ID 為 ${requestData.storeId} 的店鋪`
      });
    }

    const storeData = storeSnap.data();
    // 驗證店鋪屬於同一租戶
    if (storeData?.tenantId !== tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試使用不屬於其租戶的店鋪`);
      return res.status(403).json({
        status: 'error',
        message: `未授權：店鋪 ${requestData.storeId} 不屬於您的租戶`
      });
    }

    // 驗證其他額外的店鋪 (如果有)
    if (requestData.additionalStoreIds && requestData.additionalStoreIds.length > 0) {
      for (const additionalStoreId of requestData.additionalStoreIds) {
        const additionalStoreRef = storesCollection.doc(additionalStoreId);
        const additionalStoreSnap = await additionalStoreRef.get();
        
        if (!additionalStoreSnap.exists) {
          return res.status(400).json({
            status: 'error',
            message: `未找到 ID 為 ${additionalStoreId} 的額外店鋪`
          });
        }

        const additionalStoreData = additionalStoreSnap.data();
        if (additionalStoreData?.tenantId !== tenantId) {
          return res.status(403).json({
            status: 'error',
            message: `未授權：額外店鋪 ${additionalStoreId} 不屬於您的租戶`
          });
        }
      }
    }

    // 生成唯一員工 ID
    const employeeId = generateEmployeeId();
    
    // 創建員工數據對象
    const employeeData: Employee = {
      employeeId,
      userId: requestData.userId,
      tenantId,
      storeId: requestData.storeId,
      additionalStoreIds: requestData.additionalStoreIds || [],
      employeeCode: requestData.employeeCode || employeeId,
      firstName: requestData.firstName,
      lastName: requestData.lastName,
      displayName: `${requestData.firstName} ${requestData.lastName}`,
      position: requestData.position,
      employmentType: requestData.employmentType,
      status: requestData.status || 'active',
      hireDate: requestData.hireDate,
      terminationDate: requestData.terminationDate,
      contactInfo: requestData.contactInfo,
      photoURL: requestData.photoURL,
      schedule: requestData.schedule,
      employmentInfo: requestData.employmentInfo || {
        roleLevel: 1 // 默認最低權限等級
      },
      payInfo: requestData.payInfo,
      quietHours: requestData.quietHours,
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
      createdBy: user.uid,
    };

    // 保存到 Firestore
    await employeesCollection.doc(employeeId).set(employeeData);
    console.log(`成功創建員工：${employeeId}`);

    // 返回成功響應（使用客戶端可讀的時間戳替換 FieldValue.serverTimestamp()）
    const now = new Date().toISOString();
    const responseData = {
      ...employeeData,
      createdAt: now,
      updatedAt: now,
    };

    return res.status(201).json({
      status: 'success',
      data: responseData
    });
  } catch (error: any) {
    console.error('創建員工時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 獲取單個員工
 * GET /employees/{employeeId}
 */
export const getEmployeeById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { employeeId } = req.params;

    // 驗證請求參數
    if (!employeeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 employeeId 參數'
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

    // 獲取租戶 ID
    const tenantId = user.tenantId;
    if (!tenantId) {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }

    // 查詢員工
    const employeeDoc = await employeesCollection.doc(employeeId).get();
    
    // 檢查員工是否存在
    if (!employeeDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${employeeId} 的員工`
      });
    }

    const employeeData = employeeDoc.data() as Employee;

    // 執行租戶隔離檢查
    if (employeeData.tenantId !== tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試訪問其他租戶的員工`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法訪問其他租戶的員工資料'
      });
    }

    // 店鋪管理員只能查看自己店鋪的員工
    if (user.role === 'store_manager') {
      const isManagerStore = user.storeId === employeeData.storeId;
      const isAdditionalStore = user.additionalStoreIds && 
                               Array.isArray(user.additionalStoreIds) && 
                               user.additionalStoreIds.includes(employeeData.storeId);
      
      if (!isManagerStore && !isAdditionalStore) {
        console.warn(`權限拒絕：店鋪管理員 ${user.uid} 嘗試訪問非管理店鋪的員工`);
        return res.status(403).json({
          status: 'error',
          message: '未授權：您只能查看自己管理的店鋪員工'
        });
      }
    }

    // 處理 Firestore 時間戳 (轉為 ISO 字符串)
    let formattedEmployee = { ...employeeData };
    
    if (formattedEmployee.createdAt && typeof formattedEmployee.createdAt !== 'string') {
      formattedEmployee.createdAt = formattedEmployee.createdAt.toDate().toISOString();
    }
    
    if (formattedEmployee.updatedAt && typeof formattedEmployee.updatedAt !== 'string') {
      formattedEmployee.updatedAt = formattedEmployee.updatedAt.toDate().toISOString();
    }
    
    if (formattedEmployee.approvedAt && typeof formattedEmployee.approvedAt !== 'string') {
      formattedEmployee.approvedAt = formattedEmployee.approvedAt.toDate().toISOString();
    }

    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      data: formattedEmployee
    });
  } catch (error: any) {
    console.error('獲取員工資料時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 獲取員工列表
 * GET /employees
 */
export const listEmployees = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取經過驗證的查詢參數 (中間件已處理驗證)
    const {
      page = 1,
      limit = 20,
      sort = 'createdAt',
      order = 'desc',
      status,
      storeId,
      employmentType,
      position,
      query
    } = req.query as unknown as EmployeeFilter;

    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }

    // 獲取租戶 ID
    const tenantId = user.tenantId;
    if (!tenantId) {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }

    // 構建基本查詢
    let employeeQuery = employeesCollection.where('tenantId', '==', tenantId);

    // 應用店鋪過濾
    if (storeId) {
      // 檢查店鋪存在並屬於用戶租戶
      const storeDoc = await storesCollection.doc(storeId).get();
      if (!storeDoc.exists) {
        return res.status(400).json({
          status: 'error',
          message: `未找到 ID 為 ${storeId} 的店鋪`
        });
      }

      const storeData = storeDoc.data();
      if (storeData?.tenantId !== tenantId) {
        return res.status(403).json({
          status: 'error',
          message: `未授權：店鋪 ${storeId} 不屬於您的租戶`
        });
      }

      // 店鋪管理員只能查看自己店鋪的員工
      if (user.role === 'store_manager') {
        const isManagerStore = user.storeId === storeId;
        const isAdditionalStore = user.additionalStoreIds && 
                                 Array.isArray(user.additionalStoreIds) && 
                                 user.additionalStoreIds.includes(storeId);

        if (!isManagerStore && !isAdditionalStore) {
          console.warn(`權限拒絕：店鋪管理員 ${user.uid} 嘗試訪問非管理店鋪的員工`);
          return res.status(403).json({
            status: 'error',
            message: '未授權：您只能查看自己管理的店鋪員工'
          });
        }
      }

      employeeQuery = employeeQuery.where('storeId', '==', storeId);
    } else if (user.role === 'store_manager') {
      // 店鋪管理員必須指定店鋪，或者默認使用自己的店鋪
      if (!user.storeId) {
        return res.status(400).json({
          status: 'error',
          message: '店鋪管理員必須指定店鋪 ID'
        });
      }
      employeeQuery = employeeQuery.where('storeId', '==', user.storeId);
    }

    // 應用狀態過濾
    if (status) {
      employeeQuery = employeeQuery.where('status', '==', status);
    }

    // 應用僱傭類型過濾
    if (employmentType) {
      employeeQuery = employeeQuery.where('employmentType', '==', employmentType);
    }

    // 應用職位過濾
    if (position) {
      employeeQuery = employeeQuery.where('position', '==', position);
    }

    // 應用排序
    if (sort && order) {
      employeeQuery = employeeQuery.orderBy(sort, order as 'asc' | 'desc');
    }

    // 執行分頁查詢
    // 注意: Firestore 分頁與 SQL 分頁不同，需要使用 limit 和 startAfter/endBefore
    const pageSize = Math.min(100, Number(limit) || 20);
    const offset = (Number(page) - 1) * pageSize;

    // 首先獲取總數 (此操作可能較耗資源，生產環境中可能需要優化)
    const totalCountSnapshot = await employeeQuery.get();
    const totalCount = totalCountSnapshot.size;
    const totalPages = Math.ceil(totalCount / pageSize);

    // 應用分頁限制
    employeeQuery = employeeQuery.limit(pageSize);

    // 如果不是第一頁，需要使用 startAfter 獲取正確的數據
    if (offset > 0) {
      // 獲取分頁的起始文檔
      const startAtSnapshot = await employeeQuery
        .offset(offset - 1)
        .limit(1)
        .get();
      
      if (!startAtSnapshot.empty) {
        const startAtDoc = startAtSnapshot.docs[0];
        employeeQuery = employeeQuery.startAfter(startAtDoc);
      }
    }

    // 執行查詢
    const snapshot = await employeeQuery.get();
    
    // 轉換結果為客戶端友好格式
    const employees = snapshot.docs.map(doc => {
      const data = doc.data() as Employee;
      let formattedEmployee = { ...data };
      
      // 處理 Firestore 時間戳
      if (formattedEmployee.createdAt && typeof formattedEmployee.createdAt !== 'string') {
        formattedEmployee.createdAt = formattedEmployee.createdAt.toDate().toISOString();
      }
      
      if (formattedEmployee.updatedAt && typeof formattedEmployee.updatedAt !== 'string') {
        formattedEmployee.updatedAt = formattedEmployee.updatedAt.toDate().toISOString();
      }
      
      if (formattedEmployee.approvedAt && typeof formattedEmployee.approvedAt !== 'string') {
        formattedEmployee.approvedAt = formattedEmployee.approvedAt.toDate().toISOString();
      }
      
      return formattedEmployee;
    });

    // 構建分頁響應
    const response: PaginatedEmployeeResponse = {
      status: 'success',
      data: employees,
      pagination: {
        total: totalCount,
        page: Number(page),
        limit: pageSize,
        totalPages: totalPages
      }
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('獲取員工列表時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新員工資料
 * PUT /employees/{employeeId}
 */
export const updateEmployee = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { employeeId } = req.params;
    
    // 驗證路徑參數
    if (!employeeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 employeeId 參數'
      });
    }

    // 獲取經過驗證的請求數據 (中間件已處理驗證)
    const updateData: UpdateEmployeeRequest = req.body;
    
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }

    // 獲取租戶 ID
    const tenantId = user.tenantId;
    if (!tenantId) {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }

    // 獲取當前員工資料
    const employeeDoc = await employeesCollection.doc(employeeId).get();
    
    // 檢查員工是否存在
    if (!employeeDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${employeeId} 的員工`
      });
    }

    const employeeData = employeeDoc.data() as Employee;

    // 執行租戶隔離檢查
    if (employeeData.tenantId !== tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試更新其他租戶的員工`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法更新其他租戶的員工資料'
      });
    }

    // 店鋪管理員只能更新自己店鋪的員工
    if (user.role === 'store_manager') {
      const isManagerStore = user.storeId === employeeData.storeId;
      const isAdditionalStore = user.additionalStoreIds && 
                               Array.isArray(user.additionalStoreIds) && 
                               user.additionalStoreIds.includes(employeeData.storeId);
      
      if (!isManagerStore && !isAdditionalStore) {
        console.warn(`權限拒絕：店鋪管理員 ${user.uid} 嘗試更新非管理店鋪的員工`);
        return res.status(403).json({
          status: 'error',
          message: '未授權：您只能更新自己管理的店鋪員工'
        });
      }
    }

    // 如果更新包含 storeId 變更，需驗證新店鋪的有效性和權限
    if (updateData.storeId && updateData.storeId !== employeeData.storeId) {
      // 驗證新店鋪存在並屬於同一租戶
      const storeDoc = await storesCollection.doc(updateData.storeId).get();
      if (!storeDoc.exists) {
        return res.status(400).json({
          status: 'error',
          message: `未找到 ID 為 ${updateData.storeId} 的店鋪`
        });
      }

      const storeData = storeDoc.data();
      if (storeData?.tenantId !== tenantId) {
        return res.status(403).json({
          status: 'error',
          message: `未授權：店鋪 ${updateData.storeId} 不屬於您的租戶`
        });
      }

      // 店鋪管理員只能將員工分配給自己管理的店鋪
      if (user.role === 'store_manager') {
        const isManagerNewStore = user.storeId === updateData.storeId;
        const isAdditionalNewStore = user.additionalStoreIds && 
                                    Array.isArray(user.additionalStoreIds) && 
                                    user.additionalStoreIds.includes(updateData.storeId);
        
        if (!isManagerNewStore && !isAdditionalNewStore) {
          console.warn(`權限拒絕：店鋪管理員 ${user.uid} 嘗試將員工分配給非管理的店鋪`);
          return res.status(403).json({
            status: 'error',
            message: '未授權：您只能將員工分配給自己管理的店鋪'
          });
        }
      }
    }

    // 驗證額外的店鋪 (如果有更新)
    if (updateData.additionalStoreIds && Array.isArray(updateData.additionalStoreIds)) {
      for (const additionalStoreId of updateData.additionalStoreIds) {
        const additionalStoreDoc = await storesCollection.doc(additionalStoreId).get();
        if (!additionalStoreDoc.exists) {
          return res.status(400).json({
            status: 'error',
            message: `未找到 ID 為 ${additionalStoreId} 的額外店鋪`
          });
        }

        const additionalStoreData = additionalStoreDoc.data();
        if (additionalStoreData?.tenantId !== tenantId) {
          return res.status(403).json({
            status: 'error',
            message: `未授權：額外店鋪 ${additionalStoreId} 不屬於您的租戶`
          });
        }
      }
    }

    // 構建更新對象
    const updateObject: any = {
      ...updateData,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid
    };

    // 更新 displayName 如果 firstName 或 lastName 有變更
    if ((updateData.firstName && updateData.firstName !== employeeData.firstName) || 
        (updateData.lastName && updateData.lastName !== employeeData.lastName)) {
      const firstName = updateData.firstName || employeeData.firstName;
      const lastName = updateData.lastName || employeeData.lastName;
      updateObject.displayName = `${firstName} ${lastName}`;
    }

    // 執行更新操作
    await employeesCollection.doc(employeeId).update(updateObject);
    console.log(`成功更新員工 ${employeeId}`);

    // 獲取更新後的員工資料
    const updatedEmployeeDoc = await employeesCollection.doc(employeeId).get();
    const updatedEmployeeData = updatedEmployeeDoc.data() as Employee;

    // 處理 Firestore 時間戳
    let formattedEmployee = { ...updatedEmployeeData };
    
    if (formattedEmployee.createdAt && typeof formattedEmployee.createdAt !== 'string') {
      formattedEmployee.createdAt = formattedEmployee.createdAt.toDate().toISOString();
    }
    
    if (formattedEmployee.updatedAt && typeof formattedEmployee.updatedAt !== 'string') {
      formattedEmployee.updatedAt = formattedEmployee.updatedAt.toDate().toISOString();
    }
    
    if (formattedEmployee.approvedAt && typeof formattedEmployee.approvedAt !== 'string') {
      formattedEmployee.approvedAt = formattedEmployee.approvedAt.toDate().toISOString();
    }

    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      data: formattedEmployee
    });
  } catch (error: any) {
    console.error('更新員工資料時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 刪除員工
 * DELETE /employees/{employeeId}
 */
export const deleteEmployee = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { employeeId } = req.params;
    
    // 驗證路徑參數
    if (!employeeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 employeeId 參數'
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

    // 獲取租戶 ID
    const tenantId = user.tenantId;
    if (!tenantId) {
      console.error(`關鍵錯誤：請求用戶 ${user.uid} 缺少 tenantId claim`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：請求用戶上下文無效（缺少 tenantId）'
      });
    }

    // 獲取員工資料
    const employeeDoc = await employeesCollection.doc(employeeId).get();
    
    // 檢查員工是否存在
    if (!employeeDoc.exists) {
      return res.status(404).json({
        status: 'error',
        message: `未找到 ID 為 ${employeeId} 的員工`
      });
    }

    const employeeData = employeeDoc.data() as Employee;

    // 執行租戶隔離檢查
    if (employeeData.tenantId !== tenantId) {
      console.warn(`租戶隔離違規：用戶 ${user.uid} 嘗試刪除其他租戶的員工`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您無法刪除其他租戶的員工'
      });
    }

    // 店鋪管理員不能刪除員工，只有租戶管理員和系統管理員可以
    if (user.role === 'store_manager') {
      console.warn(`權限拒絕：店鋪管理員 ${user.uid} 嘗試刪除員工`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：店鋪管理員無權刪除員工'
      });
    }

    // 實施邏輯刪除而非物理刪除
    // 這是更安全的做法，可以保留歷史記錄，並允許後續的審計和恢復
    const updateData = {
      status: 'terminated',
      terminationDate: new Date().toISOString().split('T')[0], // 今天的日期，格式 YYYY-MM-DD
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
      isDeleted: true // 標記為已刪除
    };

    // 執行更新操作
    await employeesCollection.doc(employeeId).update(updateData);
    console.log(`成功邏輯刪除員工 ${employeeId}`);

    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      message: `員工 ${employeeId} 已成功刪除`
    });
  } catch (error: any) {
    console.error('刪除員工時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
}; 