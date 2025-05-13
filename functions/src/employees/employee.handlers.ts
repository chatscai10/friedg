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
import { employeeService } from './employee.service';

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
    const isStoreValid = await employeeService.validateStore(requestData.storeId, tenantId);
    if (!isStoreValid) {
      return res.status(400).json({
        status: 'error',
        message: `未找到 ID 為 ${requestData.storeId} 的店鋪`
      });
    }

    // 驗證其他額外的店鋪 (如果有)
    if (requestData.additionalStoreIds && requestData.additionalStoreIds.length > 0) {
      for (const additionalStoreId of requestData.additionalStoreIds) {
        const isAdditionalStoreValid = await employeeService.validateStore(additionalStoreId, tenantId);
        if (!isAdditionalStoreValid) {
          return res.status(400).json({
            status: 'error',
            message: `未找到 ID 為 ${additionalStoreId} 的額外店鋪`
          });
        }
      }
    }

    // 使用服務層創建員工
    const employeeData = await employeeService.createEmployee(requestData, user);

    return res.status(201).json({
      status: 'success',
      data: employeeData
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

    try {
      // 使用服務層獲取員工數據
      const employee = await employeeService.getEmployeeById(employeeId, user);
      
      if (!employee) {
        return res.status(404).json({
          status: 'error',
          message: '找不到指定的員工資料'
        });
      }

      return res.status(200).json({
        status: 'success',
        data: employee,
        message: '員工查詢成功'
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
    console.error('獲取員工時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 獲取員工列表（含分頁和過濾）
 * GET /employees
 */
export const listEmployees = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }

    // 解析查詢參數
    const queryParams = req.query;
    
    // 構建過濾條件
    const filter: EmployeeFilter = {
      page: queryParams.page ? parseInt(queryParams.page as string) : 1,
      limit: queryParams.limit ? parseInt(queryParams.limit as string) : 10,
      sort: queryParams.sortBy as string || 'createdAt',
      order: (queryParams.sortOrder as 'asc' | 'desc') || 'desc',
      status: queryParams.status as 'active' | 'inactive' | 'on_leave' | 'terminated',
      storeId: queryParams.storeId as string,
      roleId: queryParams.roleId as string,
      employmentType: queryParams.employmentType as 'full_time' | 'part_time' | 'contract' | 'intern' | 'temporary',
      position: queryParams.position as string,
      query: queryParams.query as string
    };

    try {
      // 使用服務層獲取員工列表
      const result = await employeeService.listEmployees(filter, user);
      
      // 構建分頁響應
      const response = {
        status: 'success',
        data: result.employees,
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          totalItems: result.total,
          itemsPerPage: result.limit
        },
        message: '員工列表查詢成功'
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
    console.error('獲取員工列表時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 更新員工
 * PUT /employees/{employeeId}
 */
export const updateEmployee = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { employeeId } = req.params;
    const updateData: UpdateEmployeeRequest = req.body;

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

    try {
      console.log(`開始更新員工 ${employeeId}，更新者：${user.uid}`);
      
      // 使用服務層更新員工
      const updatedEmployee = await employeeService.updateEmployee(employeeId, updateData, user);
      
      console.log(`員工 ${employeeId} 更新成功`);
      return res.status(200).json({
        status: 'success',
        data: updatedEmployee,
        message: '員工資料更新成功'
      });
    } catch (error: any) {
      // 處理特定類型的錯誤
      if (error.message && error.message.includes('未授權')) {
        console.warn(`權限拒絕：${error.message}，請求者：${user.uid}`);
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      } else if (error.message && error.message.includes('找不到')) {
        console.warn(`資源未找到：${error.message}`);
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      } else if (error.message && error.message.includes('驗證失敗')) {
        console.warn(`資料驗證失敗：${error.message}`);
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      throw error; // 重新拋出其他錯誤
    }
  } catch (error: any) {
    console.error('更新員工時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 刪除員工（軟刪除）
 * DELETE /api/v1/employees/{employeeId}
 */
export const deleteEmployee = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { employeeId } = req.params;

    // 驗證請求參數
    if (!employeeId) {
      console.warn('刪除員工請求缺少必要的 employeeId 參數');
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的 employeeId 參數'
      });
    }

    // 獲取用戶上下文
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：刪除員工請求缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }

    try {
      console.log(`開始刪除員工 ${employeeId}，操作者：${user.uid}`);
      
      // 使用服務層軟刪除員工
      await employeeService.deleteEmployee(employeeId, user);

      console.log(`員工 ${employeeId} 刪除操作成功完成`);
      return res.status(200).json({
        status: 'success',
        message: '員工資料已成功刪除'
      });
    } catch (error: any) {
      // 處理特定類型的錯誤
      if (error.message && error.message.includes('未授權')) {
        console.warn(`權限拒絕：${error.message}，請求者：${user.uid}`);
        return res.status(403).json({
          status: 'error',
          message: error.message
        });
      } else if (error.message && error.message.includes('找不到')) {
        console.warn(`資源未找到：${error.message}`);
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
      
      // 其他錯誤拋出供全局處理
      throw error;
    }
  } catch (error: any) {
    console.error('刪除員工時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
};

/**
 * 新增員工 (簡化版)
 * POST /api/employees
 */
export const addEmployeeHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取請求資料
    const { employeeId, name, roleId, storeId, email, phone, status } = req.body;
    
    // 驗證必要欄位
    if (!employeeId || !name || !roleId || !storeId || !email || !phone) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要欄位'
      });
    }
    
    // 驗證 email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Email格式錯誤'
      });
    }
    
    // 獲取用戶上下文 (從 Auth 中間件)
    const user = req.user as UserContext;
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }

    // 驗證用戶具有適當的權限 (租戶管理員或店鋪管理員)
    if (user.role !== 'tenant_admin' && user.role !== 'store_manager') {
      return res.status(403).json({
        status: 'error',
        message: '未授權：您沒有新增員工的權限'
      });
    }
    
    // 驗證店鋪管理員只能為其管理的店鋪新增員工
    if (user.role === 'store_manager' && user.storeId !== storeId) {
      return res.status(403).json({
        status: 'error',
        message: '未授權：店鋪管理員只能為其管理的店鋪創建員工'
      });
    }
    
    // 使用 EmployeeService 新增員工
    const result = await employeeService.addEmployee({
      employeeId,
      name,
      roleId,
      storeId,
      email,
      phone,
      status: status || 'active'
    }, user);
    
    // 返回成功回應
    return res.status(201).json({
      status: 'success',
      data: result,
      message: '員工新增成功'
    });
  } catch (error: any) {
    console.error('新增員工時發生錯誤：', error);
    
    // 處理特定錯誤類型
    if (error.message.includes('已存在')) {
      return res.status(409).json({
        status: 'error',
        message: error.message
      });
    } else if (error.message.includes('不存在')) {
      return res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
    
    // 一般錯誤
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤'
    });
  }
}; 