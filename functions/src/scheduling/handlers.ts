/**
 * 排班系統API處理函數
 */

import { Request, Response } from 'express';
import { Timestamp, Firestore, FieldValue } from 'firebase-admin/firestore';
import { Schedule, ScheduleStatus, ShiftType } from './types';

// 假設db已經從其他地方初始化
const db: Firestore = (global as any).db || (global as any).admin?.firestore();

/**
 * 驗證排班輸入數據
 * @param scheduleData 排班數據
 * @returns 錯誤訊息數組，如果沒有錯誤則為空數組
 */
const validateScheduleInput = (scheduleData: Partial<Schedule & { shiftDate: string, startTime: string, endTime: string, role: string }>): string[] => {
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
export const getSchedules = async (req: Request, res: Response) => {
  try {
    const { tenantId, storeId, employeeId, startDate, endDate, status } = req.query as { 
      tenantId?: string, 
      storeId?: string, 
      employeeId?: string, 
      startDate?: string, 
      endDate?: string, 
      status?: ScheduleStatus 
    };
    const userInfo = req.user;

    if (!userInfo) {
      return res.status(401).json({ error: "用戶未認證", success: false, errorCode: 'UNAUTHENTICATED' });
    }

    const effectiveTenantId = userInfo.tenantId;
    if (!effectiveTenantId) {
       return res.status(403).json({ error: "用戶未關聯到租戶", success: false, errorCode: 'NO_TENANT_ASSOCIATION' });
    }
    
    let queryStoreId = storeId;
    let queryEmployeeId = employeeId;

    if (userInfo.role === 'staff' || userInfo.role === 'store_staff') {
      if (!queryEmployeeId || queryEmployeeId !== userInfo.uid) {
        queryEmployeeId = userInfo.uid;
      }
    } else if (userInfo.role === 'store_manager') {
      if (queryStoreId && queryStoreId !== userInfo.storeId) {
        return res.status(403).json({ error: "無權查看其他店鋪的排班", success: false, errorCode: 'STORE_ACCESS_DENIED' });
      }
      if (!queryStoreId) {
        queryStoreId = userInfo.storeId;
      }
    }

    let query: FirebaseFirestore.Query = db.collection('schedules')
      .where('tenantId', '==', effectiveTenantId);

    if (queryStoreId) {
      query = query.where('storeId', '==', queryStoreId);
    }

    if (queryEmployeeId) {
      query = query.where('employeeId', '==', queryEmployeeId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    if (startDate && endDate) {
      query = query.where('shiftDate', '>=', startDate)
        .where('shiftDate', '<=', endDate);
    } else if (startDate) {
      query = query.where('shiftDate', '>=', startDate);
    } else if (endDate) {
      query = query.where('shiftDate', '<=', endDate);
    } 
    if(startDate || endDate) {
        query = query.orderBy('shiftDate', 'asc');
    } else {
        query = query.orderBy('shiftDate', 'desc');
    }

    query = query.limit(100);

    const snapshot = await query.get();

    const schedules: Schedule[] = [];
    snapshot.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      schedules.push({
        scheduleId: doc.id,
        ...(doc.data() as Omit<Schedule, 'scheduleId'>)
      });
    });

    return res.status(200).json({
      schedules,
      count: schedules.length,
      message: '成功獲取排班列表',
      success: true
    });
  } catch (error: any) {
    console.error("獲取排班列表錯誤:", error);
    return res.status(500).json({
      error: "獲取排班列表失敗",
      details: error.message || "服務器內部錯誤",
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * 獲取單個排班詳情
 */
export const getScheduleById = async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const userInfo = req.user;

    if (!userInfo) {
      return res.status(401).json({ error: "用戶未認證", success: false, errorCode: 'UNAUTHENTICATED' });
    }

    if (!scheduleId) {
      return res.status(400).json({ error: "缺少必要參數: scheduleId", success: false, errorCode: 'MISSING_PARAM_SCHEDULE_ID' });
    }

    const doc = await db.collection('schedules').doc(scheduleId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該排班記錄", success: false, errorCode: 'SCHEDULE_NOT_FOUND' });
    }

    const scheduleData = doc.data() as Omit<Schedule, 'scheduleId'>;

    // 檢查租戶隔離 (enforceTenantIsolation 中間件應該已處理，但可做額外防禦)
    if (userInfo.tenantId && scheduleData.tenantId !== userInfo.tenantId) {
      console.warn(`[AUTH_WARN] 用戶 ${userInfo.uid} (租戶 ${userInfo.tenantId}) 嘗試查詢其他租戶 ${scheduleData.tenantId} 的排班 ${scheduleId}`);
      return res.status(403).json({ error: "無權訪問此排班記錄", success: false, errorCode: 'TENANT_ACCESS_DENIED' });
    }

    // 檢查用戶權限
    // 一般員工只能查看自己的排班
    if ((userInfo.role === 'staff' || userInfo.role === 'store_staff') &&
        scheduleData.employeeId !== userInfo.uid) {
      console.warn(`[AUTH_WARN] 員工 ${userInfo.uid} 嘗試查詢其他員工 ${scheduleData.employeeId} 的排班 ${scheduleId}`);
      return res.status(403).json({ error: "無權訪問其他員工的排班記錄", success: false, errorCode: 'EMPLOYEE_ACCESS_DENIED' });
    }

    // 店長只能查看自己店鋪的排班 (或其管理的 additionalStoreIds)
    if (userInfo.role === 'store_manager') {
      const canAccessStore = scheduleData.storeId === userInfo.storeId || 
                             (userInfo.additionalStoreIds && userInfo.additionalStoreIds.includes(scheduleData.storeId));
      if (!canAccessStore) {
        console.warn(`[AUTH_WARN] 店長 ${userInfo.uid} (店鋪 ${userInfo.storeId}) 嘗試查詢非自己管理店鋪 ${scheduleData.storeId} 的排班 ${scheduleId}`);
        return res.status(403).json({ error: "無權訪問其他店鋪的排班記錄", success: false, errorCode: 'STORE_ACCESS_DENIED_MANAGER' });
      }
    }

    return res.status(200).json({
      schedule: {
        ...scheduleData,
        scheduleId: doc.id
      },
      message: '成功獲取排班詳情',
      success: true
    });
  } catch (error: any) {
    console.error("獲取排班詳情錯誤:", error);
    return res.status(500).json({
      error: "獲取排班詳情失敗",
      details: error.message || "服務器內部錯誤",
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * 創建排班
 */
export const createSchedule = async (req: Request, res: Response) => {
  try {
    const userInfo = req.user;
    if (!userInfo) {
      return res.status(401).json({ error: "用戶未認證", success: false, errorCode: 'UNAUTHENTICATED' });
    }

    if (!userInfo.tenantId) {
      return res.status(403).json({ error: "用戶未關聯到租戶，無法創建排班", success: false, errorCode: 'NO_TENANT_ASSOCIATION_CREATE' });
    }

    const rawScheduleData = req.body as Partial<Schedule & { shiftDate: string, startTime: string, endTime: string, role: string }>;

    const effectiveTenantId = userInfo.tenantId;
    let effectiveStoreId = rawScheduleData.storeId;

    if (userInfo.role === 'store_manager') {
      if (!userInfo.storeId) {
        return res.status(403).json({ error: "店長未關聯到特定店鋪，無法確定排班所屬店鋪", success: false, errorCode: 'MANAGER_NO_STORE_ID' });
      }
      if (rawScheduleData.storeId && rawScheduleData.storeId !== userInfo.storeId) {
         console.warn(`[CREATE_SCHEDULE_WARN] 店長 ${userInfo.uid} 嘗試為非自己 (${userInfo.storeId}) 的店鋪 ${rawScheduleData.storeId} 創建排班，將使用店長自身店鋪ID。`);
      }
      effectiveStoreId = userInfo.storeId; 
    } else if (userInfo.role === 'tenant_admin' || userInfo.role === 'super_admin'){
      if (!rawScheduleData.storeId) {
         return res.status(400).json({ error: "必須為租戶管理員或超級管理員指定 storeId 來創建排班", success: false, errorCode: 'MISSING_STORE_ID_FOR_ADMIN' });
      }
    } else {
        return res.status(403).json({ error: "此用戶角色無權創建排班記錄", success: false, errorCode: 'INSUFFICIENT_ROLE_CREATE' });
    }

    const dataToValidate: Partial<Schedule & { shiftDate: string, startTime: string, endTime: string, role: string }> = {
        ...rawScheduleData,
        tenantId: effectiveTenantId,
        storeId: effectiveStoreId
    };

    const validationErrors = validateScheduleInput(dataToValidate);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: "輸入數據驗證失敗",
        validationErrors,
        success: false,
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const now = Timestamp.now();

    const newScheduleData: Omit<Schedule, 'scheduleId' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
      tenantId: effectiveTenantId,
      storeId: effectiveStoreId!,
      employeeId: dataToValidate.employeeId!,
      shiftDate: dataToValidate.shiftDate!,
      startTime: dataToValidate.startTime!,
      endTime: dataToValidate.endTime!,
      role: dataToValidate.role!,
      status: 'draft',
      notes: dataToValidate.notes || '',
      isAutoGenerated: false,
    };

    const scheduleDocRef = db.collection('schedules').doc();

    const finalSchedule: Schedule = {
      ...newScheduleData,
      scheduleId: scheduleDocRef.id,
      createdAt: now,
      updatedAt: now,
      createdBy: userInfo.uid
    };

    await scheduleDocRef.set(finalSchedule);

    return res.status(201).json({
      schedule: finalSchedule,
      message: '排班創建成功',
      success: true
    });
  } catch (error: any) {
    console.error("創建排班錯誤:", error);
    return res.status(500).json({
      error: "創建排班失敗",
      details: error.message || "服務器內部錯誤",
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * 更新排班
 */
export const updateSchedule = async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const updates = req.body as Partial<Omit<Schedule, 'scheduleId' | 'tenantId' | 'createdAt' | 'createdBy' | 'updatedAt'> & { shiftDate?: string; startTime?: string; endTime?: string; role?: string; notes?: string; status?: ScheduleStatus }>;
    
    const userInfo = req.user;
    if (!userInfo) {
      return res.status(401).json({ error: "用戶未認證", success: false, errorCode: 'UNAUTHENTICATED' });
    }

    if (!scheduleId) {
      return res.status(400).json({ error: "缺少排班ID", success: false, errorCode: 'MISSING_SCHEDULE_ID' });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "沒有提供任何更新數據", success: false, errorCode: 'NO_UPDATE_DATA' });
    }

    const scheduleRef = db.collection('schedules').doc(scheduleId);
    const scheduleSnapshot = await scheduleRef.get();

    if (!scheduleSnapshot.exists) {
      return res.status(404).json({ error: "找不到要更新的排班記錄", success: false, errorCode: 'SCHEDULE_NOT_FOUND_UPDATE' });
    }

    const existingSchedule = scheduleSnapshot.data() as Schedule;

    // 權限檢查：
    // 1. 租戶隔離：用戶租戶必須與排班記錄的租戶匹配 (除非是 super_admin)
    if (userInfo.role !== 'super_admin' && existingSchedule.tenantId !== userInfo.tenantId) {
      return res.status(403).json({ error: "無權更新其他租戶的排班記錄", success: false, errorCode: 'TENANT_ACCESS_DENIED_UPDATE' });
    }

    // 2. 角色權限：
    //    - super_admin, tenant_admin 可以更新其租戶下的任何排班
    //    - store_manager 可以更新其管理店鋪 (storeId 或 additionalStoreIds) 的排班
    //    - 排班的創建者 (createdBy) 或被排班的員工 (employeeId) 或許可以更新某些狀態 (例如：確認 - confirm，但此處是通用更新)
    //    這裡的邏輯應與 authorizeRoles 保持一致或更細化。
    //    目前的 authorizeRoles 已經做了大部分工作，這裡可以簡化為檢查 storeId (如果用戶是 store_manager)
    
    if (userInfo.role === 'store_manager') {
      const canAccessStore = existingSchedule.storeId === userInfo.storeId || 
                             (userInfo.additionalStoreIds && userInfo.additionalStoreIds.includes(existingSchedule.storeId));
      if (!canAccessStore) {
        return res.status(403).json({ error: "店長無權更新非自己管理店鋪的排班記錄", success: false, errorCode: 'STORE_ACCESS_DENIED_UPDATE_MANAGER' });
      }
    }
    // 其他角色 (如 staff) 應已被 authorizeRoles 攔截。

    // 數據驗證 (只驗證被更新的字段)
    // 創建一個包含現有數據和更新數據的臨時對象進行驗證
    // 注意：validateScheduleInput 期望 tenantId, storeId, employeeId, shiftDate, startTime, endTime, role 這些字段
    // 更新時，有些字段可能不允許更改 (如 tenantId, storeId, employeeId)
    const dataToValidateForUpdate = { 
        ...existingSchedule, 
        ...updates, 
        // 強制原始的 tenantId, storeId, employeeId，防止被意外更新
        tenantId: existingSchedule.tenantId,
        storeId: existingSchedule.storeId,
        employeeId: existingSchedule.employeeId,
    } as Schedule; // 斷言為完整的 Schedule 類型以便 validateScheduleInput 檢查

    // 如果更新的字段中包含日期/時間/角色等需要驗證的字段，則進行驗證
    if (updates.shiftDate || updates.startTime || updates.endTime || updates.role) {
        const validationErrors = validateScheduleInput(dataToValidateForUpdate);
        if (validationErrors.length > 0) {
            // 過濾掉非本次更新字段相關的錯誤 (可選，或完善 validateScheduleInput 以支持部分驗證)
            // 簡單起見，這裡返回所有驗證錯誤
            return res.status(400).json({
                error: "更新數據驗證失敗",
                validationErrors,
                success: false,
                errorCode: 'VALIDATION_ERROR_UPDATE'
            });
        }
    }
    
    // 準備要更新到 Firestore 的數據
    const firestoreUpdateData: Partial<Schedule> & { updatedAt: FieldValue } = {
        ...updates, // 包含用戶提交的、允許的更新字段
        updatedAt: FieldValue.serverTimestamp() // 使用伺服器時間戳
    };

    // 防止關鍵字段被篡改 (即使上面已嘗試在 dataToValidateForUpdate 中固定)
    delete (firestoreUpdateData as any).tenantId;
    delete (firestoreUpdateData as any).storeId;
    delete (firestoreUpdateData as any).employeeId;
    delete (firestoreUpdateData as any).scheduleId;
    delete (firestoreUpdateData as any).createdBy;
    delete (firestoreUpdateData as any).createdAt;
    delete (firestoreUpdateData as any).isAutoGenerated; // 通常不允許手動更改此標記

    await scheduleRef.update(firestoreUpdateData);

    const updatedSchedule = { ...existingSchedule, ...firestoreUpdateData, scheduleId: scheduleRef.id, updatedAt: Timestamp.now() /* 估計值，實際應重新讀取 */ };

    return res.status(200).json({
      schedule: updatedSchedule, // 為了減少讀取，可以返回合併後的對象，但 updatedAt 會有偏差
      // schedule: await scheduleRef.get().then(doc => ({ scheduleId: doc.id, ...doc.data() })), // 更準確但多一次讀取
      message: '排班更新成功',
      success: true
    });
  } catch (error: any) {
    console.error("更新排班錯誤:", error);
    return res.status(500).json({
      error: "更新排班失敗",
      details: error.message || "服務器內部錯誤",
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * 刪除排班
 */
export const deleteSchedule = async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params; 
    const userInfo = req.user; 

    if (!userInfo) {
      return res.status(401).json({ error: "用戶未認證", success: false, errorCode: 'UNAUTHENTICATED' });
    }

    if (!scheduleId) {
      return res.status(400).json({ error: "缺少排班ID", success: false, errorCode: 'MISSING_SCHEDULE_ID' });
    }

    const scheduleRef = db.collection('schedules').doc(scheduleId);
    const scheduleSnapshot = await scheduleRef.get();

    if (!scheduleSnapshot.exists) {
      return res.status(404).json({ error: "找不到要刪除的排班記錄", success: false, errorCode: 'SCHEDULE_NOT_FOUND_DELETE' });
    }

    const scheduleToDelete = scheduleSnapshot.data() as Schedule; // 從 ./types 導入的 Schedule

    // 權限檢查：
    // 1. 租戶隔離：用戶租戶必須與排班記錄的租戶匹配 (除非是 super_admin)
    if (userInfo.role !== 'super_admin' && scheduleToDelete.tenantId !== userInfo.tenantId) {
      console.warn(`[AUTH_WARN] 用戶 ${userInfo.uid} (租戶 ${userInfo.tenantId}) 嘗試刪除其他租戶 ${scheduleToDelete.tenantId} 的排班 ${scheduleId}`);
      return res.status(403).json({ error: "無權刪除其他租戶的排班記錄", success: false, errorCode: 'TENANT_ACCESS_DENIED_DELETE' });
    }

    // 2. 角色權限：(基於 authorizeRoles 和進一步的資源所有權檢查)
    //    routes.ts 中此路由配置了 authorizeRoles(['store_manager', 'tenant_admin', 'super_admin'])
    if (userInfo.role === 'store_manager') {
      const canAccessStore = scheduleToDelete.storeId === userInfo.storeId || 
                             (userInfo.additionalStoreIds && userInfo.additionalStoreIds.includes(scheduleToDelete.storeId));
      if (!canAccessStore) {
        console.warn(`[AUTH_WARN] 店長 ${userInfo.uid} (店鋪 ${userInfo.storeId}) 嘗試刪除非自己管理店鋪 ${scheduleToDelete.storeId} 的排班 ${scheduleId}`);
        return res.status(403).json({ error: "店長無權刪除非自己管理店鋪的排班記錄", success: false, errorCode: 'STORE_ACCESS_DENIED_DELETE_MANAGER' });
      }
    }
    // tenant_admin 和 super_admin 的權限已由 authorizeRoles 和 tenantId 檢查覆蓋。
    // 其他角色（如 staff）應已被 authorizeRoles 攔截。

    // --- 關於軟刪除 vs 物理刪除的邏輯 --- 
    // 以下是原始文件 (handlers.ts 43KB版本中未直接包含，但 scheduling.handlers.ts 12KB版本中類似的邏輯)
    // 或常見的業務需求。根據實際需求決定是否啟用。
    /*
    const now = Timestamp.now();
    // Schedule 類型中的 startTime 和 endTime 是 HH:MM 格式的字符串，需要與 shiftDate 組合
    let scheduleStartDateTime: Date | null = null;
    if (scheduleToDelete.shiftDate && scheduleToDelete.startTime) {
      try {
        // 假設 shiftDate 是 YYYY-MM-DD, startTime 是 HH:MM
        scheduleStartDateTime = new Date(`${scheduleToDelete.shiftDate}T${scheduleToDelete.startTime}`); 
      } catch (e) {
        console.error(`無法解析排班開始時間: ${scheduleToDelete.shiftDate}T${scheduleToDelete.startTime}`, e);
      }
    }

    if (scheduleToDelete.status === 'published' && scheduleStartDateTime && scheduleStartDateTime.getTime() < now.toMillis()) {
      // 如果排班已發布且已（理論上）開始，則標記為取消
      await scheduleRef.update({ 
        status: 'cancelled', 
        updatedAt: FieldValue.serverTimestamp() // 或 Timestamp.now()
      });
      return res.status(200).json({
        message: '排班已標記為取消',
        success: true,
        scheduleId,
        newStatus: 'cancelled'
      });
    } else {
      // 否則，直接物理刪除
      await scheduleRef.delete();
      return res.status(200).json({
        message: '排班已成功刪除 (物理刪除)',
        success: true,
        scheduleId
      });
    }
    */

    // 當前實現：默認為物理刪除 (如簡化版所做)
    await scheduleRef.delete();

    return res.status(200).json({
      message: '排班已成功刪除', // 與簡化版信息一致，表明是物理刪除
      success: true,
      scheduleId
    });
  } catch (error: any) {
    console.error("刪除排班錯誤:", error);
    return res.status(500).json({
      error: "刪除排班失敗",
      details: error.message || "服務器內部錯誤",
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * 批量發布排班
 * @param req.body.scheduleIds - 要發布的排班ID列表
 * @param req.body.storeId - (可選) 如果提供，將只發布此店鋪下的排班 (通常由 tenant_admin 使用)
 */
export const publishSchedules = async (req: Request, res: Response) => {
  try {
    const { scheduleIds, storeId: requestStoreId } = req.body as { scheduleIds?: string[], storeId?: string };
    const userInfo = req.user;

    if (!userInfo) {
      return res.status(401).json({ error: "用戶未認證", success: false, errorCode: 'UNAUTHENTICATED' });
    }

    if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return res.status(400).json({ error: "缺少或無效的 scheduleIds 參數 (應為非空數組)", success: false, errorCode: 'MISSING_OR_INVALID_SCHEDULE_IDS' });
    }

    if (!userInfo.tenantId) {
      return res.status(403).json({ error: "用戶未關聯到租戶，無法發布排班", success: false, errorCode: 'NO_TENANT_ASSOCIATION_PUBLISH' });
    }

    // 權限和範圍確定
    // routes.ts 中此路由配置了 authorizeRoles(['store_manager', 'tenant_admin', 'super_admin'])
    let effectiveStoreId: string | undefined = undefined;

    if (userInfo.role === 'store_manager') {
      if (!userInfo.storeId) {
        return res.status(403).json({ error: "店長未關聯到特定店鋪", success: false, errorCode: 'MANAGER_NO_STORE_ID_PUBLISH' });
      }
      effectiveStoreId = userInfo.storeId;
      // 店長提交的 requestStoreId (如果有) 必須與其自身 storeId 一致
      if (requestStoreId && requestStoreId !== effectiveStoreId) {
        return res.status(403).json({ error: `店長只能發布自己店鋪 (${effectiveStoreId}) 的排班`, success: false, errorCode: 'STORE_MISMATCH_PUBLISH_MANAGER' });
      }
    } else if (userInfo.role === 'tenant_admin' || userInfo.role === 'super_admin') {
      // 租戶管理員或超管可以指定 storeId (但必須在其租戶下)，或不指定 (則處理所有租戶下的指定 scheduleIds)
      // 注意：如果允許不指定 storeId，則 tenant_admin 需要額外校驗 scheduleId 是否都屬於其名下租戶
      // 這裡簡化處理：如果提供了 requestStoreId，則使用它；否則，不按特定 storeId 過濾 (依賴 scheduleId 的 tenantId 校驗)
      effectiveStoreId = requestStoreId;
      // TODO: 如果 effectiveStoreId 存在，校驗其是否屬於 userInfo.tenantId
    } else {
      // 理論上已被 authorizeRoles 攔截
      return res.status(403).json({ error: "此用戶角色無權發布排班", success: false, errorCode: 'INSUFFICIENT_ROLE_PUBLISH' });
    }

    const batch = db.batch();
    const errors: { scheduleId: string, reason: string }[] = [];
    const published: string[] = [];
    const notFound: string[] = [];
    const alreadyPublished: string[] = [];

    for (const scheduleId of scheduleIds) {
      if (typeof scheduleId !== 'string' || !scheduleId.trim()) {
        errors.push({ scheduleId: scheduleId || 'INVALID_ID', reason: '無效的排班ID格式' });
        continue;
      }
      const scheduleRef = db.collection('schedules').doc(scheduleId);
      const scheduleSnapshot = await scheduleRef.get();

      if (!scheduleSnapshot.exists) {
        notFound.push(scheduleId);
        continue;
      }

      const schedule = scheduleSnapshot.data() as Schedule;

      // 權限檢查:
      // 1. 租戶ID必須匹配
      if (schedule.tenantId !== userInfo.tenantId && userInfo.role !== 'super_admin') {
        errors.push({ scheduleId, reason: `租戶不匹配 (排班租戶: ${schedule.tenantId}, 用戶租戶: ${userInfo.tenantId})` });
        continue;
      }
      // 2. 如果 effectiveStoreId 已定義 (例如店長操作，或管理員指定了店鋪)，則排班的 storeId 必須匹配
      if (effectiveStoreId && schedule.storeId !== effectiveStoreId) {
        errors.push({ scheduleId, reason: `店鋪不匹配 (排班店鋪: ${schedule.storeId}, 目標店鋪: ${effectiveStoreId})` });
        continue;
      }

      if (schedule.status === 'published' || schedule.status === 'confirmed') {
        alreadyPublished.push(scheduleId);
        continue;
      }

      if (schedule.status === 'draft') { // 只有草稿狀態的可以被發布
        batch.update(scheduleRef, { 
          status: 'published', 
          publishedAt: FieldValue.serverTimestamp(), // 或 Timestamp.now()
          updatedAt: FieldValue.serverTimestamp()   // 或 Timestamp.now()
        });
        published.push(scheduleId);
      } else {
        errors.push({ scheduleId, reason: `排班狀態為 ${schedule.status}，無法發布` });
      }
    }

    if (published.length > 0) {
      await batch.commit();
    }

    return res.status(200).json({
      message: `批量發布操作完成。成功: ${published.length}，失敗/跳過: ${errors.length + notFound.length + alreadyPublished.length}`,
      success: true,
      results: {
        published,
        notFound,
        alreadyPublished,
        errors
      }
    });

  } catch (error: any) {
    console.error("批量發布排班錯誤:", error);
    if (error.code === 'ABORTED' || error.message.includes('MAX_WRITES_PER_SEC')) {
        return res.status(429).json({ error: "操作過於頻繁，請稍後再試", success: false, errorCode: 'TOO_MANY_REQUESTS' });
    }
    return res.status(500).json({
      error: "批量發布排班失敗",
      details: error.message || "服務器內部錯誤",
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * 自動排班生成
 * @param req.body.storeId - 目標店鋪ID
 * @param req.body.startDate - 排班開始日期 (YYYY-MM-DD)
 * @param req.body.endDate - 排班結束日期 (YYYY-MM-DD)
 * @param req.body.generationStrategy - (可選) 生成策略: 'default', 'optimize_cost', 'maximize_fairness'
 * @param req.body.settings - (可選) 臨時的排班設定覆蓋
 */
export const generateSchedules = async (req: Request, res: Response) => {
  try {
    const {
      storeId: requestStoreId,
      startDate,
      endDate,
      generationStrategy,
      settings // 假設 settings 是 AutoScheduleSetting 的部分或完整結構
    } = req.body as { 
        storeId?: string, 
        startDate?: string, 
        endDate?: string, 
        generationStrategy?: string, 
        settings?: Partial<import('./types').AutoScheduleSetting> 
    }; // 恢復 generationStrategy 和 settings
    
    const userInfo = req.user;
    if (!userInfo) {
      return res.status(401).json({ error: "用戶未認證", success: false, errorCode: 'UNAUTHENTICATED' });
    }

    // tenantId 檢查 (從 userInfo 獲取)
    if (!userInfo.tenantId) {
      return res.status(403).json({ error: "用戶未關聯到租戶，無法生成排班", success: false, errorCode: 'NO_TENANT_ASSOCIATION_GENERATE' });
    }

    // storeId, startDate, endDate 是基礎必要參數
    if (!requestStoreId || !startDate || !endDate) {
      return res.status(400).json({ error: "缺少必要參數: storeId, startDate, 或 endDate", success: false, errorCode: 'MISSING_PARAMS_GENERATE' });
    }
    // TODO: 應添加對 startDate 和 endDate 格式 (YYYY-MM-DD) 和邏輯 (startDate <= endDate) 的驗證

    // 權限和範圍確定
    // routes.ts 中此路由配置了 authorizeRoles(['store_manager', 'tenant_admin', 'super_admin'])
    let effectiveStoreId: string = requestStoreId; // 初始設為請求的 storeId

    if (userInfo.role === 'store_manager') {
      if (!userInfo.storeId) {
        return res.status(403).json({ error: "店長未關聯到特定店鋪，無法生成排班", success: false, errorCode: 'MANAGER_NO_STORE_ID_GENERATE' });
      }
      // 店長只能為自己的店鋪生成排班
      if (requestStoreId !== userInfo.storeId) {
        console.warn(`[GEN_SCHEDULE_WARN] 店長 ${userInfo.uid} 嘗試為非自己 (${userInfo.storeId}) 的店鋪 ${requestStoreId} 生成排班。將強制使用店長自身店鋪ID (${userInfo.storeId})。`);
        effectiveStoreId = userInfo.storeId; // 強制為店長自己的 storeId
      }
    } else if (userInfo.role === 'tenant_admin') {
      // tenant_admin 必須提供 storeId，且該 storeId 必須屬於其管理的 tenantId
      // TODO: 此處需要一步校驗 requestStoreId (即 effectiveStoreId) 是否真的屬於 userInfo.tenantId
      // 例如: const storeDoc = await db.collection('stores').doc(effectiveStoreId).get();
      //       if (!storeDoc.exists || storeDoc.data()?.tenantId !== userInfo.tenantId) { ... return 403 ... }
      console.log(`Tenant Admin ${userInfo.uid} 為店鋪 ${effectiveStoreId} (租戶 ${userInfo.tenantId}) 生成排班`);
    } else if (userInfo.role === 'super_admin') {
      // super_admin 可以為任何提供的 storeId 生成排班 (理論上應已驗證 storeId 存在性)
      console.log(`Super Admin ${userInfo.uid} 為店鋪 ${effectiveStoreId} 生成排班`);
    } else {
      // 此情況理論上應已被 authorizeRoles 中間件攔截
      return res.status(403).json({ error: "此用戶角色無權生成排班", success: false, errorCode: 'INSUFFICIENT_ROLE_GENERATE' });
    }

    console.log(`最終為店鋪 ${effectiveStoreId} (租戶 ${userInfo.tenantId}) 生成 ${startDate} 到 ${endDate} 的排班，策略: ${generationStrategy || 'default'}`);

    // --- 以下為複雜的排班生成邏輯 --- 
    // 原始代碼 (handlers.ts 43KB) 中包含大量相關的內部接口定義和一個非常長的函數體骨架
    // 這部分邏輯超出了類型修復的範圍，需要專門的業務邏輯實現。
    // 這裡僅作示意，表明排班生成的核心調用位置。
    /*
    // 1. 獲取必要的數據 (員工、班次類型、假期、偏好設定、現有排班等)
    //    const employees = await fetchEmployees(userInfo.tenantId!, effectiveStoreId);
    //    const shiftTypes = await fetchShiftTypes(userInfo.tenantId!, effectiveStoreId);
    //    const leaveRecords = await fetchLeaveRecords(userInfo.tenantId!, effectiveStoreId, startDate, endDate);
    //    const existingSchedules = await fetchExistingSchedules(userInfo.tenantId!, effectiveStoreId, startDate, endDate);
    //    const autoScheduleSettingsToUse = settings || await fetchAutoScheduleSettings(userInfo.tenantId!, effectiveStoreId);

    // 2. 調用核心排班算法 (需要實現)
    //    const generatedAssignments: ScheduleAssignment[] = await coreSchedulingAlgorithm(
    //        employees, shiftTypes, leaveRecords, existingSchedules, autoScheduleSettingsToUse, 
    //        startDate, endDate, generationStrategy
    //    );

    // 3. 處理生成的排班 (例如，保存為草稿)
    //    const createdDrafts: Schedule[] = [];
    //    const creationErrors: any[] = [];
    //    const batch = db.batch();
    //    for (const assignment of generatedAssignments) {
    //        try {
    //            const scheduleDocRef = db.collection('schedules').doc(); // 自動生成 ID
    //            const draftSchedule: Schedule = {
    //                scheduleId: scheduleDocRef.id,
    //                tenantId: userInfo.tenantId!,
    //                storeId: effectiveStoreId,
    //                employeeId: assignment.employeeId,
    //                shiftDate: assignment.shiftDate,
    //                startTime: assignment.startTime,
    //                endTime: assignment.endTime,
    //                role: assignment.role,
    //                status: 'draft', // 生成後狀態為草稿
    //                isAutoGenerated: true,
    //                createdAt: Timestamp.now(),
    //                updatedAt: Timestamp.now(),
    //                createdBy: userInfo.uid, // 或標記為 'system_auto_schedule'
    //                notes: assignment.notes || '自動生成',
    //                // publishedAt, confirmedAt 在草稿階段通常不設置
    //            };
    //            batch.set(scheduleDocRef, draftSchedule);
    //            createdDrafts.push(draftSchedule);
    //        } catch (e) {
    //            creationErrors.push({ assignmentDetails: assignment, error: (e as Error).message });
    //        }
    //    }
    //    if (createdDrafts.length > 0) { 
    //        await batch.commit(); 
    //    }
    //    console.log(`自動排班生成完成。生成草稿: ${createdDrafts.length}，失敗: ${creationErrors.length}`);
    */

    // 返回結果 (目前為示意，實際應返回生成的排班草稿信息或異步任務ID)
    return res.status(200).json({
      message: '自動排班生成請求已處理 (此為模擬響應，實際排班算法邏輯待實現)',
      success: true,
      details: {
        tenantId: userInfo.tenantId,
        storeId: effectiveStoreId,
        dateRange: { startDate, endDate },
        strategyUsed: generationStrategy || 'default',
        // draftsCreatedCount: createdDrafts.length, // 示例
        // creationErrorCount: creationErrors.length, // 示例
        // errors: creationErrors.length > 0 ? creationErrors : undefined // 示例
      }
    });

  } catch (error: any) {
    console.error("自動排班生成錯誤:", error);
    return res.status(500).json({
      error: "自動排班生成失敗",
      details: error.message || "服務器內部錯誤",
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * 員工確認排班
 * @param req.params.scheduleId - 要確認的排班ID
 */
export const confirmSchedule = async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const userInfo = req.user;

    if (!userInfo) {
      return res.status(401).json({ error: "用戶未認證", success: false, errorCode: 'UNAUTHENTICATED' });
    }

    if (!scheduleId) {
      return res.status(400).json({ error: "缺少排班ID", success: false, errorCode: 'MISSING_SCHEDULE_ID_CONFIRM' });
    }

    const scheduleRef = db.collection('schedules').doc(scheduleId);
    const scheduleSnapshot = await scheduleRef.get();

    if (!scheduleSnapshot.exists) {
      return res.status(404).json({ error: "找不到要確認的排班記錄", success: false, errorCode: 'SCHEDULE_NOT_FOUND_CONFIRM' });
    }

    const scheduleToConfirm = scheduleSnapshot.data() as Schedule;

    // 權限檢查：
    // 1. 租戶隔離：用戶租戶必須與排班記錄的租戶匹配 (除非是 super_admin，但通常 super_admin 不會直接確認排班)
    if (userInfo.role !== 'super_admin' && scheduleToConfirm.tenantId !== userInfo.tenantId) {
      return res.status(403).json({ error: "無權確認其他租戶的排班記錄", success: false, errorCode: 'TENANT_ACCESS_DENIED_CONFIRM' });
    }

    // 2. 員工只能確認自己的排班 (employeeId 必須匹配 userInfo.uid)
    //    或者，店長/管理員可能有權限代為確認 (但 routes.ts 中此路由未明確賦予管理角色，通常是員工操作)
    //    當前路由配置為：router.post('/:scheduleId/confirm', authenticateRequest, enforceTenantIsolation, confirmSchedule);
    //    沒有 authorizeRoles，表示任何通過 authenticateRequest 和 enforceTenantIsolation 的用戶都可以嘗試調用。
    //    因此，這裡需要嚴格檢查是否是排班對應的員工本人。
    if (scheduleToConfirm.employeeId !== userInfo.uid) {
        // 如果未來允許管理員代確認，這裡需要更複雜的邏輯
        // 例如: if (scheduleToConfirm.employeeId !== userInfo.uid && userInfo.role !== 'store_manager' && userInfo.role !== 'tenant_admin') {
        console.warn(`[CONFIRM_SCHEDULE_WARN] 用戶 ${userInfo.uid} 嘗試確認不屬於自己的排班 ${scheduleId} (員工ID: ${scheduleToConfirm.employeeId})`);
        return res.status(403).json({ error: "只能確認分配給自己的排班記錄", success: false, errorCode: 'EMPLOYEE_MISMATCH_CONFIRM' });
    }

    // 狀態檢查：
    // 只有 'published' 狀態的排班才能被確認
    if (scheduleToConfirm.status !== 'published') {
      return res.status(400).json({
        error: `排班狀態為 '${scheduleToConfirm.status}'，無法確認 (必須是 'published')`,
        success: false,
        errorCode: 'INVALID_STATUS_FOR_CONFIRMATION',
        currentStatus: scheduleToConfirm.status
      });
    }
    
    // 更新狀態為 'confirmed'
    const updateData = {
      status: 'confirmed' as ScheduleStatus,
      confirmedAt: Timestamp.now(), // Firestore Timestamp
      updatedAt: Timestamp.now()    // Firestore Timestamp
    };

    await scheduleRef.update(updateData);

    const confirmedSchedule = { 
        ...scheduleToConfirm, 
        ...updateData, 
        scheduleId: scheduleRef.id 
    };

    return res.status(200).json({
      schedule: confirmedSchedule,
      message: '排班確認成功',
      success: true
    });

  } catch (error: any) {
    console.error("確認排班錯誤:", error);
    return res.status(500).json({
      error: "確認排班失敗",
      details: error.message || "服務器內部錯誤",
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};