import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  Schedule, 
  CreateScheduleRequest, 
  ScheduleQueryParams 
} from './scheduling.types';
import { AuthenticatedRequest } from '../middleware/auth';

const db = admin.firestore();
const schedulesCollection = 'schedules';

/**
 * 創建排班記錄
 * 
 * @param req AuthenticatedRequest 包含 CreateScheduleRequest
 * @param res Response
 */
export const createSchedule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, storeId, startTime, endTime, role, notes } = req.body as CreateScheduleRequest;
    
    // 基本參數驗證
    if (!employeeId || !storeId || !startTime || !endTime || !role) {
      return res.status(400).json({
        code: 'MISSING_REQUIRED_FIELDS',
        message: '缺少必要欄位'
      });
    }

    // 驗證請求者權限 (須為店長或更高級別)
    const userRole = req.user?.role;
    const userTenantId = req.user?.tenantId;
    const userStoreId = req.user?.storeId;
    
    // 如果用戶不是租戶管理員且不是指定分店的店長，則拒絕請求
    if (userRole !== 'tenant_admin' && userRole !== 'store_manager') {
      return res.status(403).json({
        code: 'PERMISSION_DENIED',
        message: '您沒有創建排班的權限'
      });
    }

    // 如果用戶是店長，則只能為自己的分店創建排班
    if (userRole === 'store_manager' && userStoreId !== storeId) {
      return res.status(403).json({
        code: 'STORE_MISMATCH',
        message: '您只能為自己管理的分店創建排班'
      });
    }

    // 驗證員工屬於同一租戶
    const employeeDoc = await db.collection('employees').doc(employeeId).get();
    if (!employeeDoc.exists) {
      return res.status(404).json({
        code: 'EMPLOYEE_NOT_FOUND',
        message: '找不到員工資料'
      });
    }

    const employeeData = employeeDoc.data();
    if (employeeData?.tenantId !== userTenantId) {
      return res.status(403).json({
        code: 'TENANT_MISMATCH',
        message: '員工不屬於您的租戶'
      });
    }

    // 檢查日期時間格式
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        code: 'INVALID_DATE_FORMAT',
        message: '日期時間格式無效'
      });
    }
    
    // 檢查開始時間是否早於結束時間
    if (startDate >= endDate) {
      return res.status(400).json({
        code: 'INVALID_TIME_RANGE',
        message: '開始時間必須早於結束時間'
      });
    }

    // 生成唯一 ID
    const scheduleId = uuidv4();
    const now = new Date();

    // 創建排班記錄
    const schedule: Schedule = {
      scheduleId,
      employeeId,
      storeId,
      tenantId: userTenantId || '',
      startTime,
      endTime,
      role,
      notes: notes || '',
      status: 'draft', // 初始狀態為草稿
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: req.user?.uid || ''
    };

    // 寫入資料庫
    await db.collection(schedulesCollection).doc(scheduleId).set(schedule);

    // 返回成功回應
    return res.status(201).json({
      schedule
    });
  } catch (error) {
    console.error('創建排班記錄失敗:', error);
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: '伺服器內部錯誤'
    });
  }
};

/**
 * 查詢排班記錄列表
 * 
 * @param req AuthenticatedRequest 包含 ScheduleQueryParams
 * @param res Response
 */
export const listSchedules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      employeeId,
      storeId,
      startDate,
      endDate,
      status
    } = req.query as unknown as ScheduleQueryParams;

    // 獲取分頁參數
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    // 取得用戶資訊
    const userRole = req.user?.role;
    const userTenantId = req.user?.tenantId;
    const userStoreId = req.user?.storeId;
    const userId = req.user?.uid;

    // 構建查詢
    let query: FirebaseFirestore.Query = db.collection(schedulesCollection);

    // 租戶隔離 (必要條件)
    query = query.where('tenantId', '==', userTenantId);

    // 一般員工只能看到自己的排班
    if (userRole !== 'tenant_admin' && userRole !== 'store_manager' && userRole !== 'shift_leader') {
      query = query.where('employeeId', '==', userId);
    } 
    // 店長只能看到自己分店的排班
    else if (userRole === 'store_manager') {
      query = query.where('storeId', '==', userStoreId);
    }

    // 根據查詢參數篩選
    if (employeeId) {
      // 確保店長或更高權限才能查詢特定員工
      if (userRole === 'tenant_admin' || userRole === 'store_manager' || userRole === 'shift_leader') {
        query = query.where('employeeId', '==', employeeId);
      }
    }

    if (storeId) {
      // 如果是店長，確保只能查詢自己的分店
      if (userRole === 'store_manager' && storeId !== userStoreId) {
        return res.status(403).json({
          code: 'PERMISSION_DENIED',
          message: '您只能查詢自己分店的排班記錄'
        });
      }
      query = query.where('storeId', '==', storeId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    // 如果有日期範圍，則需要進行額外處理
    // 注意：這可能導致需要索引（特別是與其他條件組合時）
    if (startDate) {
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);
      query = query.where('startTime', '>=', startDateTime.toISOString());
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.where('endTime', '<=', endDateTime.toISOString());
    }

    // 排序 (按開始時間降序)
    query = query.orderBy('startTime', 'desc');

    // 執行查詢 (取得計數)
    const countSnapshot = await query.get();
    const total = countSnapshot.size;

    // 執行分頁查詢
    const querySnapshot = await query.limit(pageSize).offset(offset).get();
    
    // 轉換結果
    const schedules: Schedule[] = [];
    querySnapshot.forEach(doc => {
      schedules.push(doc.data() as Schedule);
    });

    // 計算是否有更多資料
    const hasMore = total > page * pageSize;

    // 返回結果
    return res.status(200).json({
      schedules,
      pagination: {
        total,
        page,
        pageSize,
        hasMore
      }
    });
  } catch (error) {
    console.error('查詢排班記錄失敗:', error);
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: '伺服器內部錯誤'
    });
  }
};

/**
 * 更新排班記錄
 * 
 * @param req AuthenticatedRequest 包含 scheduleId 和更新內容
 * @param res Response
 */
export const updateSchedule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const updateData = req.body;
    
    // 基本參數驗證
    if (!scheduleId) {
      return res.status(400).json({
        code: 'MISSING_SCHEDULE_ID',
        message: '缺少排班 ID'
      });
    }
    
    // 獲取排班記錄
    const scheduleRef = db.collection(schedulesCollection).doc(scheduleId);
    const scheduleSnapshot = await scheduleRef.get();
    
    if (!scheduleSnapshot.exists) {
      return res.status(404).json({
        code: 'SCHEDULE_NOT_FOUND',
        message: '找不到指定的排班記錄'
      });
    }
    
    const scheduleData = scheduleSnapshot.data() as Schedule;
    
    // 權限檢查
    // 只有以下人員可以更新排班：
    // 1. 租戶管理員
    // 2. 該排班記錄所屬商店的店長
    // 3. 創建排班記錄的人
    if (
      req.user?.role !== 'tenant_admin' && 
      !(req.user?.role === 'store_manager' && req.user?.storeId === scheduleData.storeId) &&
      req.user?.uid !== scheduleData.createdBy
    ) {
      return res.status(403).json({
        code: 'PERMISSION_DENIED',
        message: '您沒有權限更新此排班記錄'
      });
    }
    
    // 準備更新數據
    // 只更新允許的欄位，並加上更新時間戳
    const allowedFields = ['employeeId', 'storeId', 'startTime', 'endTime', 'role', 'notes', 'status'];
    const update: Partial<Schedule> = {
      updatedAt: new Date().toISOString()
    };
    
    // 只保留允許更新的欄位
    allowedFields.forEach(field => {
      if (field in updateData) {
        (update as any)[field] = updateData[field];
      }
    });
    
    // 執行更新
    await scheduleRef.update(update);
    
    // 獲取更新後的完整排班記錄
    const updatedScheduleSnapshot = await scheduleRef.get();
    const updatedSchedule = updatedScheduleSnapshot.data() as Schedule;
    
    return res.status(200).json(updatedSchedule);
  } catch (error) {
    console.error('更新排班記錄時發生錯誤:', error);
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: '更新排班記錄時發生內部錯誤'
    });
  }
};

/**
 * 刪除排班記錄（或標記為取消）
 * 
 * @param req AuthenticatedRequest 包含 scheduleId
 * @param res Response
 */
export const deleteSchedule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scheduleId } = req.params;
    
    // 基本參數驗證
    if (!scheduleId) {
      return res.status(400).json({
        code: 'MISSING_SCHEDULE_ID',
        message: '缺少排班 ID'
      });
    }
    
    // 獲取排班記錄
    const scheduleRef = db.collection(schedulesCollection).doc(scheduleId);
    const scheduleSnapshot = await scheduleRef.get();
    
    if (!scheduleSnapshot.exists) {
      return res.status(404).json({
        code: 'SCHEDULE_NOT_FOUND',
        message: '找不到指定的排班記錄'
      });
    }
    
    const scheduleData = scheduleSnapshot.data() as Schedule;
    
    // 權限檢查
    // 只有以下人員可以刪除排班：
    // 1. 租戶管理員
    // 2. 該排班記錄所屬商店的店長
    // 3. 創建排班記錄的人
    if (
      req.user?.role !== 'tenant_admin' && 
      !(req.user?.role === 'store_manager' && req.user?.storeId === scheduleData.storeId) &&
      req.user?.uid !== scheduleData.createdBy
    ) {
      return res.status(403).json({
        code: 'PERMISSION_DENIED',
        message: '您沒有權限刪除此排班記錄'
      });
    }
    
    // 判斷是直接刪除還是標記為取消
    // 如果排班已發布且已開始，則標記為取消
    const now = new Date();
    const startTime = new Date(scheduleData.startTime);
    
    if (scheduleData.status === 'published' && startTime <= now) {
      // 標記為取消
      await scheduleRef.update({ 
        status: 'cancelled',
        updatedAt: new Date().toISOString()
      });
      
      return res.status(200).json({
        success: true,
        message: '排班記錄已標記為取消'
      });
    } else {
      // 直接刪除
      await scheduleRef.delete();
      
      return res.status(200).json({
        success: true,
        message: '排班記錄已成功刪除'
      });
    }
  } catch (error) {
    console.error('刪除排班記錄時發生錯誤:', error);
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: '刪除排班記錄時發生內部錯誤'
    });
  }
}; 