/**
 * 排班系統API處理函數
 */

import { Request, Response } from 'express';
import { Timestamp, Firestore, FieldValue } from 'firebase-admin/firestore';
import { Schedule, ScheduleStatus } from './types';

// 擴展Request類型以包括user屬性
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
    tenantId?: string;
    storeId?: string;
    additionalStoreIds?: string[];
    roleLevel?: number;
    permissions?: Record<string, any>;
  };
}

// 假設db已經從其他地方初始化
const db: Firestore = (global as any).db || (global as any).admin?.firestore();

/**
 * 驗證排班輸入數據
 * @param scheduleData 排班數據
 * @returns 錯誤訊息數組，如果沒有錯誤則為空數組
 */
const validateScheduleInput = (scheduleData: any): string[] => {
  const errors: string[] = [];
  
  // 檢查必填欄位
  if (!scheduleData.tenantId) errors.push('租戶ID (tenantId) 是必填欄位');
  if (!scheduleData.storeId) errors.push('門店ID (storeId) 是必填欄位');
  if (!scheduleData.employeeId) errors.push('員工ID (employeeId) 是必填欄位');
  if (!scheduleData.shiftDate) errors.push('班次日期 (shiftDate) 是必填欄位');
  if (!scheduleData.startTime) errors.push('開始時間 (startTime) 是必填欄位');
  if (!scheduleData.endTime) errors.push('結束時間 (endTime) 是必填欄位');
  if (!scheduleData.role) errors.push('班次角色 (role) 是必填欄位');
  
  // 驗證日期格式 (YYYY-MM-DD)
  if (scheduleData.shiftDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(scheduleData.shiftDate)) {
      errors.push('班次日期格式錯誤，應為 YYYY-MM-DD');
    }
  }
  
  // 驗證時間格式 (HH:MM)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (scheduleData.startTime && !timeRegex.test(scheduleData.startTime)) {
    errors.push('開始時間格式錯誤，應為 HH:MM');
  }
  if (scheduleData.endTime && !timeRegex.test(scheduleData.endTime)) {
    errors.push('結束時間格式錯誤，應為 HH:MM');
  }
  
  // 驗證時間邏輯（開始時間必須早於結束時間）
  if (scheduleData.startTime && scheduleData.endTime && 
      scheduleData.startTime >= scheduleData.endTime) {
    errors.push('開始時間必須早於結束時間');
  }
  
  // 驗證角色值
  const validRoles = ['cashier', 'kitchen', 'server', 'manager'];
  if (scheduleData.role && !validRoles.includes(scheduleData.role)) {
    errors.push(`角色不合法，有效角色為: ${validRoles.join(', ')}`);
  }
  
  return errors;
};

/**
 * 獲取排班列表
 */
export const getSchedules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, storeId, employeeId, startDate, endDate, status } = req.query;
    const userInfo = req.user;

    if (!tenantId) {
      return res.status(400).json({ error: "缺少必要參數: tenantId" });
    }

    // 檢查用戶權限並限制數據範圍
    // 1. 如果是員工角色，只能查看自己的排班
    // 2. 如果是店長或以上角色，可以查看整個店舖的排班
    // 3. 如果是租戶管理員角色，可以查看整個租戶的排班
    if (userInfo && userInfo.role === 'staff' || userInfo && userInfo.role === 'store_staff') {
      // 員工只能查看自己的排班
      if (!employeeId || employeeId !== userInfo.uid) {
        console.log(`用戶 ${userInfo.uid} 嘗試查詢其他員工的排班`);
        // 強制使用自己的employeeId查詢
        req.query.employeeId = userInfo.uid;
      }
    } else if (userInfo && userInfo.role === 'store_manager') {
      // 店長只能查看自己管理的店鋪排班
      if (storeId && storeId !== userInfo.storeId) {
        console.log(`店長 ${userInfo.uid} 嘗試查詢非自己管理店鋪的排班`);
        return res.status(403).json({ error: "無權查看其他店鋪的排班" });
      }
      // 如果未指定店鋪，則限制為店長的店鋪
      if (!storeId) {
        req.query.storeId = userInfo.storeId;
      }
    }
    // tenant_admin 和 super_admin 無需額外限制，已通過中間件處理租戶隔離

    let query: any = db.collection('schedules')
      .where('tenantId', '==', tenantId);

    if (storeId) {
      query = query.where('storeId', '==', storeId);
    }

    if (employeeId) {
      query = query.where('employeeId', '==', employeeId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    // 注意: Firestore 複合查詢限制，如果使用多個範圍比較（如 >=, <=）
    // 則需要在相同欄位上建立複合索引
    if (startDate && endDate) {
      query = query.where('shiftDate', '>=', startDate)
        .where('shiftDate', '<=', endDate)
        .orderBy('shiftDate', 'asc');
    } else if (startDate) {
      query = query.where('shiftDate', '>=', startDate)
        .orderBy('shiftDate', 'asc');
    } else if (endDate) {
      query = query.where('shiftDate', '<=', endDate)
        .orderBy('shiftDate', 'asc');
    } else {
      query = query.orderBy('shiftDate', 'desc');
    }

    // 限制結果數量，避免查詢過多數據
    query = query.limit(100);

    const snapshot = await query.get();
    
    const schedules: Schedule[] = [];
    snapshot.forEach((doc: any) => {
      schedules.push({
        scheduleId: doc.id,
        ...doc.data()
      });
    });

    return res.status(200).json({ 
      schedules,
      count: schedules.length,
      message: '成功獲取排班列表'
    });
  } catch (error: any) {
    console.error("獲取排班列表錯誤:", error);
    return res.status(500).json({ 
      error: "獲取排班列表失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 獲取單個排班詳情
 */
export const getScheduleById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const userInfo = req.user;

    if (!scheduleId) {
      return res.status(400).json({ error: "缺少必要參數: scheduleId" });
    }

    const doc = await db.collection('schedules').doc(scheduleId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該排班記錄" });
    }

    // 檢查租戶ID是否匹配（基本的資源隔離）
    const scheduleData = doc.data() as Schedule;
    
    // 檢查租戶隔離
    if (userInfo && userInfo.tenantId && scheduleData.tenantId !== userInfo.tenantId) {
      console.log(`用戶 ${userInfo.uid} 嘗試查詢其他租戶的排班`);
      return res.status(403).json({ error: "無權訪問此排班記錄" });
    }

    // 檢查用戶權限
    if (userInfo) {
      // 一般員工只能查看自己的排班
      if ((userInfo.role === 'staff' || userInfo.role === 'store_staff') && 
          scheduleData.employeeId !== userInfo.uid) {
        console.log(`員工 ${userInfo.uid} 嘗試查詢其他員工的排班`);
        return res.status(403).json({ error: "無權訪問其他員工的排班記錄" });
      }

      // 店長只能查看自己店鋪的排班
      if (userInfo.role === 'store_manager' && 
          scheduleData.storeId !== userInfo.storeId) {
        console.log(`店長 ${userInfo.uid} 嘗試查詢非自己管理店鋪的排班`);
        return res.status(403).json({ error: "無權訪問其他店鋪的排班記錄" });
      }
    }

    return res.status(200).json({
      schedule: {
        ...scheduleData,
        scheduleId: doc.id
      },
      message: '成功獲取排班詳情'
    });
  } catch (error: any) {
    console.error("獲取排班詳情錯誤:", error);
    return res.status(500).json({ 
      error: "獲取排班詳情失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 創建排班
 */
export const createSchedule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      tenantId,
      storeId,
      employeeId,
      shiftDate,
      startTime,
      endTime,
      role,
      notes
    } = req.body;

    // 驗證輸入數據
    const validationErrors = validateScheduleInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: "輸入數據驗證失敗", 
        validationErrors 
      });
    }

    // 檢查同一員工在同一天是否已有安排（避免衝突）
    const existingShiftsSnapshot = await db.collection('schedules')
      .where('tenantId', '==', tenantId)
      .where('employeeId', '==', employeeId)
      .where('shiftDate', '==', shiftDate)
      .get();

    if (!existingShiftsSnapshot.empty) {
      // 這裡可以選擇直接拒絕或檢查具體時間是否衝突
      // 這裡採用簡單的方式：如果同一天已有排班，則拒絕新的請求
      return res.status(409).json({ 
        error: "該員工在此日期已有排班安排", 
        conflictingShifts: existingShiftsSnapshot.docs.map(doc => ({
          scheduleId: doc.id,
          ...doc.data()
        }))
      });
    }

    // 獲取創建者ID (從驗證令牌)
    const createdBy = req.user?.uid || 'system';

    // 構建新排班記錄
    const now = Timestamp.now();
    const newSchedule: Omit<Schedule, 'scheduleId'> = {
      tenantId,
      storeId,
      employeeId,
      shiftDate,
      startTime,
      endTime,
      role,
      status: 'draft' as ScheduleStatus,  // 初始狀態為草稿
      createdBy,
      createdAt: now,
      updatedAt: now,
      isAutoGenerated: false,  // 手動創建
      notes: notes || ''
    };

    // 寫入到Firestore
    const docRef = await db.collection('schedules').add(newSchedule);

    return res.status(201).json({
      message: '排班創建成功',
      scheduleId: docRef.id,
      schedule: {
        scheduleId: docRef.id,
        ...newSchedule
      }
    });
  } catch (error: any) {
    console.error("創建排班錯誤:", error);
    return res.status(500).json({ 
      error: "創建排班失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 更新排班
 */
export const updateSchedule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const updateData = req.body;

    if (!scheduleId) {
      return res.status(400).json({ error: "缺少必要參數: scheduleId" });
    }

    // 檢查排班是否存在
    const doc = await db.collection('schedules').doc(scheduleId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該排班記錄" });
    }

    const existingSchedule = doc.data() as Schedule;

    // 檢查排班狀態，只有草稿(draft)狀態可以被編輯
    if (existingSchedule.status !== 'draft' && !updateData.status) {
      return res.status(400).json({ 
        error: "只有處於草稿狀態的排班可以被編輯",
        currentStatus: existingSchedule.status
      });
    }

    // 如果修改了關鍵屬性，需要驗證輸入
    if (updateData.shiftDate || updateData.startTime || updateData.endTime || 
        updateData.employeeId || updateData.role) {
      
      // 合併現有數據和更新數據進行驗證
      const mergedData = { ...existingSchedule, ...updateData };
      const validationErrors = validateScheduleInput(mergedData);
      
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          error: "輸入數據驗證失敗", 
          validationErrors 
        });
      }

      // 如果更改了日期或員工，需要檢查衝突
      if ((updateData.shiftDate && updateData.shiftDate !== existingSchedule.shiftDate) ||
          (updateData.employeeId && updateData.employeeId !== existingSchedule.employeeId)) {
        
        const targetDate = updateData.shiftDate || existingSchedule.shiftDate;
        const targetEmployee = updateData.employeeId || existingSchedule.employeeId;
        
        const conflictCheckSnapshot = await db.collection('schedules')
          .where('tenantId', '==', existingSchedule.tenantId)
          .where('employeeId', '==', targetEmployee)
          .where('shiftDate', '==', targetDate)
          .get();
        
        // 檢查是否有衝突（不包括自身）
        const conflicts = conflictCheckSnapshot.docs
          .filter(d => d.id !== scheduleId)
          .map(d => ({ scheduleId: d.id, ...d.data() }));
        
        if (conflicts.length > 0) {
          return res.status(409).json({ 
            error: "該員工在目標日期已有其他排班安排", 
            conflictingShifts: conflicts
          });
        }
      }
    }

    // 不允許更新特定欄位
    delete updateData.scheduleId;
    delete updateData.tenantId;
    delete updateData.storeId;
    delete updateData.createdAt;
    delete updateData.createdBy;
    delete updateData.isAutoGenerated;

    // 添加更新時間
    updateData.updatedAt = Timestamp.now();

    // 更新排班記錄
    await db.collection('schedules').doc(scheduleId).update(updateData);

    // 獲取更新後的記錄
    const updatedDoc = await db.collection('schedules').doc(scheduleId).get();

    return res.status(200).json({
      message: '排班更新成功',
      schedule: {
        scheduleId: updatedDoc.id,
        ...updatedDoc.data()
      }
    });
  } catch (error: any) {
    console.error("更新排班錯誤:", error);
    return res.status(500).json({ 
      error: "更新排班失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 刪除排班
 */
export const deleteSchedule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scheduleId } = req.params;

    if (!scheduleId) {
      return res.status(400).json({ error: "缺少必要參數: scheduleId" });
    }

    // 檢查排班是否存在
    const doc = await db.collection('schedules').doc(scheduleId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該排班記錄" });
    }

    const schedule = doc.data() as Schedule;

    // 檢查狀態，只有草稿(draft)或已取消(cancelled)狀態可以被刪除
    if (schedule.status !== 'draft' && schedule.status !== 'cancelled') {
      return res.status(400).json({ 
        error: "只有處於草稿或已取消狀態的排班可以被刪除",
        currentStatus: schedule.status
      });
    }

    // 執行刪除操作
    await db.collection('schedules').doc(scheduleId).delete();

    return res.status(200).json({
      message: '排班刪除成功',
      deletedScheduleId: scheduleId
    });
  } catch (error: any) {
    console.error("刪除排班錯誤:", error);
    return res.status(500).json({ 
      error: "刪除排班失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 批量發布排班 - 將自動生成的排班草稿正式保存到 Firestore
 * @description 刪除指定日期範圍內現有的排班記錄，並將新的排班記錄列表寫入數據庫
 */
export const publishSchedules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, storeId, startDate, endDate, scheduleAssignments } = req.body;

    // 檢查關鍵參數
    if (!tenantId || !storeId || !startDate || !endDate || !scheduleAssignments || !Array.isArray(scheduleAssignments)) {
      return res.status(400).json({ 
        error: "缺少必要參數", 
        details: "需要提供 tenantId, storeId, startDate, endDate 以及排班列表 scheduleAssignments"
      });
    }

    // 驗證日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ error: "日期格式錯誤，請使用YYYY-MM-DD格式" });
    }

    // 驗證日期邏輯
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({ error: "無效的日期格式" });
    }
    
    if (startDateObj > endDateObj) {
      return res.status(400).json({ error: "開始日期不能晚於結束日期" });
    }

    // 驗證排班列表不為空
    if (scheduleAssignments.length === 0) {
      return res.status(400).json({ error: "排班列表不能為空" });
    }

    console.log(`開始處理排班發布流程，範圍: ${startDate} 到 ${endDate}，共 ${scheduleAssignments.length} 筆記錄`);

    // 第一步：查詢現有排班記錄
    const existingSchedulesQuery = await db.collection('schedules')
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId)
      .where('shiftDate', '>=', startDate)
      .where('shiftDate', '<=', endDate)
      .get();

    console.log(`找到 ${existingSchedulesQuery.size} 筆現有排班記錄需要刪除`);

    // 第二步：使用批次寫入進行刪除和新增操作
    const batch = db.batch();
    
    // 2.1 先刪除現有的排班記錄
    existingSchedulesQuery.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // 2.2 添加新的排班記錄
    scheduleAssignments.forEach((schedule) => {
      // 驗證必要字段
      if (!schedule.employeeId || !schedule.shiftDate || !schedule.startTime || !schedule.endTime) {
        throw new Error(`排班記錄缺少必要欄位: ${JSON.stringify(schedule)}`);
      }
      
      // 確保每條記錄都包含必要的 tenantId 和 storeId
      const scheduleWithIds = {
        ...schedule,
        tenantId: tenantId,
        storeId: storeId,
        status: 'confirmed', // 發布時將狀態設為已確認
        isAutoGenerated: schedule.isAutoGenerated || false,
        publishedAt: Timestamp.now(),
        publishedBy: req.user?.uid || 'system',
        updatedAt: Timestamp.now()
      };
      
      // 如果沒有指定 scheduleId，則創建新記錄
      const docRef = schedule.scheduleId
        ? db.collection('schedules').doc(schedule.scheduleId)
        : db.collection('schedules').doc(); // 自動生成 ID
      
      batch.set(docRef, scheduleWithIds);
    });
    
    // 執行批次操作
    await batch.commit();
    
    console.log(`成功發布 ${scheduleAssignments.length} 筆排班記錄`);
    
    // 返回成功響應
    return res.status(200).json({
      success: true,
      message: '排班發布成功',
      stats: {
        deletedRecords: existingSchedulesQuery.size,
        publishedRecords: scheduleAssignments.length,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error: any) {
    console.error("批量發布排班錯誤:", error);
    return res.status(500).json({ 
      error: "批量發布排班失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 生成自動排班 - 第一階段: 數據準備 + 第二階段: 核心排班分配邏輯
 * @description 獲取並整理自動排班所需的數據，並實作初步的排班分配邏輯
 */
export const generateSchedules = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. 解析請求參數
    const { 
      tenantId,            // 租戶ID (必填)
      storeId,             // 門店ID (必填)
      startDate,           // 開始日期 YYYY-MM-DD (必填)
      endDate,             // 結束日期 YYYY-MM-DD (必填)
      respectLeaves = true, // 是否考慮請假記錄
      respectPreferences = true, // 是否考慮員工偏好
      optimizeForCost = false, // 是否以成本最佳化
      generateDraft = true  // 是否自動生成草稿排班記錄
    } = req.body;

    // 2. 基本參數檢查
    if (!tenantId || !storeId || !startDate || !endDate) {
      return res.status(400).json({ error: "缺少必要參數: tenantId, storeId, startDate, endDate 為必填" });
    }

    // 驗證日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return res.status(400).json({ error: "日期格式錯誤，請使用YYYY-MM-DD格式" });
    }

    // 驗證日期邏輯
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({ error: "無效的日期格式" });
    }
    
    if (startDateObj > endDateObj) {
      return res.status(400).json({ error: "開始日期不能晚於結束日期" });
    }

    // 計算日期範圍天數，並限制最大範圍(防止請求過大範圍)
    const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 3600 * 24)) + 1;
    if (daysDiff > 31) {
      return res.status(400).json({ error: "排班生成範圍過大，請限制在31天內" });
    }

    console.log(`開始數據準備工作，排班範圍: ${startDate} 到 ${endDate}，共${daysDiff}天`);

    // 定義數據類型
    interface Employee {
      employeeId: string;
      name?: string;
      position?: string;
      roles?: string[];
      [key: string]: any;
    }

    interface ShiftType {
      shiftTypeId: string;
      name: string;
      startTime: string;
      endTime: string;
      minimumStaff: number;
      roles: string[];
      color?: string;
      [key: string]: any;
    }

    interface LeaveRecord {
      leaveId: string;
      [key: string]: any;
    }

    interface RestrictedDate {
      restrictedDateId: string;
      date: string;
      reason: string;
      [key: string]: any;
    }

    interface ScheduleRecord {
      scheduleId: string;
      shiftDate: string;
      employeeId: string;
      startTime: string;
      endTime: string;
      [key: string]: any;
    }

    interface EmployeePreference {
      preferenceId: string;
      employeeId: string;
      [key: string]: any;
    }

    interface SchedulingSetting {
      maxHoursPerWeek: Record<string, number>;
      minHoursPerWeek: Record<string, number>;
      minStaffPerShift: Record<string, number>;
      avoidContinuousShifts: boolean;
      [key: string]: any;
    }

    // 員工可用性狀態類型
    type AvailabilityStatus = boolean | 'partial';

    interface AvailabilityInfo {
      available: AvailabilityStatus;
      reason: string | null;
      time?: string;
      scheduleId?: string;
      leaveId?: string;
      restrictedDateId?: string;
    }

    // 排班結果記錄類型
    interface ScheduleAssignment {
      tenantId: string;
      storeId: string;
      employeeId: string;
      shiftDate: string;
      startTime: string;
      endTime: string;
      role: string;
      shiftTypeId?: string;
      isAutoGenerated: boolean;
      status: 'draft';
      notes?: string;
      createdBy: string;
    }

    // 3. 創建數據容器
    const schedulingData: {
      parameters: Record<string, any>;
      dataSources: {
        employees: Employee[];
        shiftTypes: ShiftType[];
        leaves: LeaveRecord[];
        restrictedDates: RestrictedDate[];
        employeePreferences: EmployeePreference[];
        existingSchedules: ScheduleRecord[];
      };
      processingInfo: {
        dateRange: string[];
        employeeAvailability: Record<string, Record<string, AvailabilityInfo>>;
      };
      settings?: SchedulingSetting;
      results?: {
        scheduleAssignments: ScheduleAssignment[];
        unassignedShifts: Array<{date: string; shiftTypeId: string; role: string; reason: string}>;
        employeeWorkHours: Record<string, number>;
      }
    } = {
      parameters: {
        tenantId,
        storeId,
        startDate,
        endDate,
        respectLeaves,
        respectPreferences,
        optimizeForCost,
        requestedAt: new Date().toISOString(),
        requestedBy: req.user?.uid || 'system'
      },
      dataSources: {
        employees: [],
        shiftTypes: [],
        leaves: [],
        restrictedDates: [],
        employeePreferences: [],
        existingSchedules: []
      },
      processingInfo: {
        dateRange: [],
        employeeAvailability: {}
      }
    };

    // 4. 數據收集 - 準備併發查詢
    const dataQueries = [];

    // 4.1 獲取員工列表
    const employeesQuery = db.collection('employees')
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId)
      .where('status', '==', 'active') // 只考慮狀態為活躍的員工
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          throw new Error(`沒有找到符合條件的活躍員工`);
        }
        return snapshot.docs.map(doc => ({
          ...doc.data(),
          employeeId: doc.id
        })) as Employee[];
      });
    dataQueries.push(employeesQuery);

    // 4.2 獲取班次類型定義
    const shiftTypesQuery = db.collection('shiftTypes')
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId)
      .where('isActive', '==', true)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          throw new Error(`沒有找到符合條件的班次類型定義`);
        }
        return snapshot.docs.map(doc => ({
          ...doc.data(),
          shiftTypeId: doc.id
        })) as ShiftType[];
      });
    dataQueries.push(shiftTypesQuery);

    // 4.3 獲取已批准的請假記錄 (可能影響排班)
    const leavesQuery = respectLeaves ? 
      db.collection('leaves')
        .where('tenantId', '==', tenantId)
        .where('storeId', '==', storeId)
        .where('status', '==', 'approved')
        .where('startDate', '<=', endDate)  // 請假開始日期在排班結束日期或之前
        .where('endDate', '>=', startDate)  // 請假結束日期在排班開始日期或之後
        .get()
        .then(snapshot => {
          return snapshot.docs.map(doc => ({
            ...doc.data(),
            leaveId: doc.id
          })) as LeaveRecord[];
        }) : 
      Promise.resolve([] as LeaveRecord[]);
    dataQueries.push(leavesQuery);

    // 4.4 獲取禁止排班日期
    const restrictedDatesQuery = db.collection('restrictedDates')
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId)
      .where('isActive', '==', true)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get()
      .then(snapshot => {
        return snapshot.docs.map(doc => ({
          ...doc.data(),
          restrictedDateId: doc.id
        })) as RestrictedDate[];
      });
    dataQueries.push(restrictedDatesQuery);

    // 4.5 獲取已存在的排班記錄 (用於檢查衝突)
    const existingSchedulesQuery = db.collection('schedules')
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId)
      .where('shiftDate', '>=', startDate)
      .where('shiftDate', '<=', endDate)
      .get()
      .then(snapshot => {
        return snapshot.docs.map(doc => ({
          ...doc.data(),
          scheduleId: doc.id
        })) as ScheduleRecord[];
      });
    dataQueries.push(existingSchedulesQuery);
    
    // 4.6 獲取員工排班偏好設定 (如果考慮員工偏好)
    const employeePreferencesQuery = respectPreferences ?
      db.collection('employeePreferences')
        .where('tenantId', '==', tenantId)
        .where('storeId', '==', storeId)
        .get()
        .then(snapshot => {
          return snapshot.docs.map(doc => ({
            ...doc.data(),
            preferenceId: doc.id
          })) as EmployeePreference[];
        }) :
      Promise.resolve([] as EmployeePreference[]);
    dataQueries.push(employeePreferencesQuery);

    // 4.7 獲取自動排班設定
    const schedulingSettingsQuery = db.collection('autoScheduleSettings')
      .where('tenantId', '==', tenantId)
      .where('storeId', '==', storeId)
      .where('isActive', '==', true)
      .limit(1)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          // 使用預設設定
          return {
            maxHoursPerWeek: { default: 40 },
            minHoursPerWeek: { default: 8 },
            minStaffPerShift: { default: 1 },
            avoidContinuousShifts: true
          } as SchedulingSetting;
        }
        return snapshot.docs[0].data() as SchedulingSetting;
      });
    dataQueries.push(schedulingSettingsQuery);

    // 5. 執行所有數據查詢
    console.log('開始執行資料庫查詢...');
    const results = await Promise.all(dataQueries);
    
    // 明確設定查詢結果的型別
    const employees = results[0] as Employee[];
    const shiftTypes = results[1] as ShiftType[];
    const leaves = results[2] as LeaveRecord[];
    const restrictedDates = results[3] as RestrictedDate[];
    const existingSchedules = results[4] as ScheduleRecord[];
    const employeePreferences = results[5] as EmployeePreference[];
    const schedulingSettings = results[6] as SchedulingSetting;

    // 6. 填充數據容器
    schedulingData.dataSources.employees = employees;
    schedulingData.dataSources.shiftTypes = shiftTypes;
    schedulingData.dataSources.leaves = leaves;
    schedulingData.dataSources.restrictedDates = restrictedDates;
    schedulingData.dataSources.existingSchedules = existingSchedules;
    schedulingData.dataSources.employeePreferences = employeePreferences;
    schedulingData.settings = schedulingSettings;

    // 7. 預處理數據 - 生成日期範圍
    const dateRange: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDateObj) {
      dateRange.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    schedulingData.processingInfo.dateRange = dateRange;

    // 8. 預處理數據 - 建立每個員工的可用性地圖
    const employeeAvailability: Record<string, Record<string, AvailabilityInfo>> = {};
    employees.forEach((employee: Employee) => {
      employeeAvailability[employee.employeeId] = dateRange.reduce((acc, date) => {
        acc[date] = {
          available: true,
          reason: null
        };
        return acc;
      }, {} as Record<string, AvailabilityInfo>);
    });

    // 9. 預處理數據 - 標記請假日期為不可用
    if (respectLeaves) {
      leaves.forEach(leave => {
        const leaveStartDate = new Date(leave.startDate);
        const leaveEndDate = new Date(leave.endDate);
        
        // 為請假日期範圍內的每一天標記員工不可用
        dateRange.forEach(date => {
          const currentDate = new Date(date);
          if (currentDate >= leaveStartDate && currentDate <= leaveEndDate && 
              employeeAvailability[leave.employeeId] && 
              employeeAvailability[leave.employeeId][date]) {
            employeeAvailability[leave.employeeId][date] = {
              available: false,
              reason: `請假中 (${leave.leaveType})`,
              leaveId: leave.leaveId
            };
          }
        });
      });
    }

    // 10. 預處理數據 - 標記已有排班的時段為部分可用（代表已分配）
    existingSchedules.forEach(schedule => {
      if (employeeAvailability[schedule.employeeId] && 
          employeeAvailability[schedule.employeeId][schedule.shiftDate]) {
        
        // 如果已有其他排班但不影響整天的可用性，標記為部分可用
        if (employeeAvailability[schedule.employeeId][schedule.shiftDate].available) {
          employeeAvailability[schedule.employeeId][schedule.shiftDate] = {
            available: 'partial',
            reason: '已有排班',
            time: `${schedule.startTime}-${schedule.endTime}`,
            scheduleId: schedule.scheduleId
          };
        }
      }
    });

    // 11. 預處理數據 - 標記禁止排班日期
    restrictedDates.forEach(restrictedDate => {
      // 如果是全店禁止排班，則所有員工在該日期均不可排班
      employees.forEach(employee => {
        if (employeeAvailability[employee.employeeId] && 
            employeeAvailability[employee.employeeId][restrictedDate.date]) {
          employeeAvailability[employee.employeeId][restrictedDate.date] = {
            available: false,
            reason: `禁止排班日 (${restrictedDate.reason})`,
            restrictedDateId: restrictedDate.restrictedDateId
          };
        }
      });
    });

    // 完成員工可用性計算
    schedulingData.processingInfo.employeeAvailability = employeeAvailability;

    // 12. 統計數據收集結果
    const stats = {
      employees: employees.length,
      shiftTypes: shiftTypes.length,
      leaves: leaves.length,
      restrictedDates: restrictedDates.length,
      existingSchedules: existingSchedules.length,
      employeePreferences: employeePreferences.length,
      dateRange: dateRange.length
    };

    console.log(`數據準備完成，統計資訊: ${JSON.stringify(stats)}`);

    // === 第二階段: 自動排班邏輯 ===
    if (generateDraft) {
      console.log('開始執行排班分配邏輯...');
      
      // 初始化結果容器
      schedulingData.results = {
        scheduleAssignments: [],
        unassignedShifts: [],
        employeeWorkHours: {}
      };
      
      // 初始化員工工時追蹤
      const employeeWorkHours: Record<string, number> = {};
      employees.forEach(employee => {
        employeeWorkHours[employee.employeeId] = 0;
      });
      
      // 1. 遍歷每一天進行排班
      dateRange.forEach(date => {
        console.log(`處理日期: ${date}`);
        
        // 2. 獲取當天需要安排的班次類型
        shiftTypes.forEach(shiftType => {
          console.log(`  處理班次類型: ${shiftType.name} (${shiftType.startTime}-${shiftType.endTime})`);
          
          // 計算該班次需要的工時
          const shiftStartHour = parseInt(shiftType.startTime.split(':')[0]);
          const shiftStartMinute = parseInt(shiftType.startTime.split(':')[1]);
          const shiftEndHour = parseInt(shiftType.endTime.split(':')[0]);
          const shiftEndMinute = parseInt(shiftType.endTime.split(':')[1]);
          
          // 計算總分鐘數
          let shiftDurationMinutes = (shiftEndHour * 60 + shiftEndMinute) - (shiftStartHour * 60 + shiftStartMinute);
          // 處理跨午夜的情況
          if (shiftDurationMinutes < 0) {
            shiftDurationMinutes += 24 * 60;
          }
          
          // 轉換為小時
          const shiftDurationHours = shiftDurationMinutes / 60;
          
          // 3. 處理每個班次角色需求
          shiftType.roles.forEach(role => {
            // 計算該角色需要多少人
            const requiredStaff = shiftType.minimumStaff || 1; // 默認至少需要1人
            console.log(`    需要 ${requiredStaff} 名 ${role} 角色的員工`);
            
            // 追蹤已分配的員工數
            let assignedCount = 0;
            
            // 4. 尋找符合條件的可用員工
            // 篩選條件: 1. 當天可用 2. 符合角色要求
            const availableEmployees = employees.filter(employee => {
              // 檢查員工該日期是否可用
              const availabilityInfo = employeeAvailability[employee.employeeId]?.[date];
              if (!availabilityInfo || availabilityInfo.available === false) {
                return false;
              }
              
              // 檢查員工角色是否匹配
              // 注意：這裡假設員工數據中有roles字段，或根據position來匹配
              const employeeRoles = employee.roles || [];
              const position = employee.position || '';
              
              // 如果員工有明確的roles字段，檢查是否包含所需角色
              if (employeeRoles.length > 0) {
                return employeeRoles.includes(role);
              }
              
              // 否則，檢查position是否與角色匹配（簡單的字符串包含檢查）
              return position.toLowerCase().includes(role.toLowerCase());
            });
            
            console.log(`    找到 ${availableEmployees.length} 名符合條件的可用員工`);
            
            if (availableEmployees.length === 0) {
              // 記錄無法分配的班次
              schedulingData.results!.unassignedShifts.push({
                date,
                shiftTypeId: shiftType.shiftTypeId,
                role,
                reason: '沒有符合條件的可用員工'
              });
              console.log(`    警告: 找不到符合條件的員工，該班次未分配`);
              return; // 繼續處理下一個角色
            }
            
            // 5. 進行排班分配
            for (let i = 0; i < requiredStaff && i < availableEmployees.length; i++) {
              // 排序員工：優先選擇已分配工時最少的員工
              const sortedEmployees = [...availableEmployees].sort((a, b) => 
                (employeeWorkHours[a.employeeId] || 0) - (employeeWorkHours[b.employeeId] || 0)
              );
              
              // 分配班次給工時最少的員工
              const selectedEmployee = sortedEmployees[0];
              
              // 創建排班記錄
              const scheduleAssignment: ScheduleAssignment = {
                tenantId,
                storeId,
                employeeId: selectedEmployee.employeeId,
                shiftDate: date,
                startTime: shiftType.startTime,
                endTime: shiftType.endTime,
                role: role,
                shiftTypeId: shiftType.shiftTypeId,
                isAutoGenerated: true,
                status: 'draft',
                notes: `自動生成的排班：${shiftType.name}`,
                createdBy: req.user?.uid || 'system'
              };
              
              // 將排班記錄添加到結果中
              schedulingData.results!.scheduleAssignments.push(scheduleAssignment);
              
              // 更新員工工時記錄
              employeeWorkHours[selectedEmployee.employeeId] = 
                (employeeWorkHours[selectedEmployee.employeeId] || 0) + shiftDurationHours;
              
              // 更新可用性，將該員工從可用列表中移除（防止重複分配）
              const employeeIndex = availableEmployees.findIndex(e => e.employeeId === selectedEmployee.employeeId);
              if (employeeIndex !== -1) {
                availableEmployees.splice(employeeIndex, 1);
              }
              
              assignedCount++;
              console.log(`    已分配 ${selectedEmployee.name || selectedEmployee.employeeId} 到該班次`);
            }
            
            // 檢查是否完全滿足了需求
            if (assignedCount < requiredStaff) {
              // 記錄部分未分配的班次
              schedulingData.results!.unassignedShifts.push({
                date,
                shiftTypeId: shiftType.shiftTypeId,
                role,
                reason: `需要 ${requiredStaff} 名員工，但只找到 ${assignedCount} 名符合條件的可用員工`
              });
              console.log(`    警告: 班次分配不完全，需要 ${requiredStaff} 人，僅分配 ${assignedCount} 人`);
            }
          });
        });
      });
      
      // 保存工時統計
      schedulingData.results!.employeeWorkHours = employeeWorkHours;
      
      // 排班統計
      const totalAssigned = schedulingData.results!.scheduleAssignments.length;
      const totalUnassigned = schedulingData.results!.unassignedShifts.length;
      console.log(`排班完成: 成功分配 ${totalAssigned} 個班次，未能分配 ${totalUnassigned} 個班次`);
      
      // 如果選擇直接生成排班記錄到資料庫
      if (generateDraft && schedulingData.results!.scheduleAssignments.length > 0) {
        // 這裡可以擴展為將生成的排班記錄寫入資料庫中
        console.log('生成的排班已準備好，但尚未寫入資料庫');
      }
    }

    // 13. 返回整理好的數據和排班結果
    return res.status(200).json({
      success: true,
      message: generateDraft ? '自動排班完成' : '自動排班數據準備完成',
      stats: {
        employees: employees.length,
        shiftTypes: shiftTypes.length,
        leaves: leaves.length,
        restrictedDates: restrictedDates.length,
        existingSchedules: existingSchedules.length,
        employeePreferences: employeePreferences.length,
        dateRange: dateRange.length,
        assignedShifts: schedulingData.results?.scheduleAssignments.length || 0,
        unassignedShifts: schedulingData.results?.unassignedShifts.length || 0
      },
      data: schedulingData
    });
  } catch (error: any) {
    console.error("自動排班錯誤:", error);
    return res.status(500).json({ 
      error: "自動排班失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 確認排班
 */
export const confirmSchedule = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const userInfo = req.user;
    
    if (!scheduleId) {
      return res.status(400).json({ error: "缺少必要參數: scheduleId" });
    }

    if (!userInfo || !userInfo.uid) {
      return res.status(401).json({ error: "需要登入才能確認排班" });
    }

    // 獲取排班記錄
    const doc = await db.collection('schedules').doc(scheduleId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該排班記錄" });
    }

    const scheduleData = doc.data() as Schedule;

    // 檢查租戶隔離
    if (userInfo.tenantId && scheduleData.tenantId !== userInfo.tenantId) {
      console.log(`用戶 ${userInfo.uid} 嘗試確認其他租戶的排班`);
      return res.status(403).json({ error: "無權訪問此排班記錄" });
    }

    // 確保員工只能確認自己的排班
    if (scheduleData.employeeId !== userInfo.uid) {
      console.log(`用戶 ${userInfo.uid} 嘗試確認其他員工的排班`);
      return res.status(403).json({ error: "只能確認自己的排班" });
    }

    // 檢查排班狀態是否為已發布(published)狀態
    if (scheduleData.status !== 'published') {
      return res.status(400).json({ 
        error: "無法確認排班，該排班不是處於已發布狀態",
        currentStatus: scheduleData.status
      });
    }

    // 更新排班狀態為已確認(confirmed)
    await db.collection('schedules').doc(scheduleId).update({
      status: 'confirmed',
      confirmedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    return res.status(200).json({
      message: '排班確認成功',
      scheduleId: scheduleId
    });
  } catch (error: any) {
    console.error("確認排班錯誤:", error);
    return res.status(500).json({ 
      error: "確認排班失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
}; 