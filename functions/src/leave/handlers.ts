/**
 * 請假系統API處理函數
 */

import { Request, Response } from 'express';
import { Timestamp, Firestore } from 'firebase-admin/firestore';
import { LeaveRequest, LeaveType, LeaveStatus } from './types';
import { logAuditEvent, AuditLogStatus } from '../libs/audit';
import { logLeaveAction } from '../libs/audit/utils';

// 擴展Request類型以包括user屬性
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    role?: string;
    tenantId?: string;
    storeId?: string;
  };
}

// 在第9行後添加：
interface LeaveRequestWithName extends LeaveRequest {
  employeeName?: string;
}

// 假設db已經從其他地方初始化
const db: Firestore = (global as any).db || (global as any).admin?.firestore();

/**
 * 驗證請假申請輸入數據
 * @param leaveData 請假數據
 * @returns 錯誤訊息數組，如果沒有錯誤則為空數組
 */
const validateLeaveInput = (leaveData: any): string[] => {
  const errors: string[] = [];
  
  // 檢查必填欄位
  if (!leaveData.tenantId) errors.push('租戶ID (tenantId) 是必填欄位');
  if (!leaveData.storeId) errors.push('門店ID (storeId) 是必填欄位');
  if (!leaveData.employeeId) errors.push('員工ID (employeeId) 是必填欄位');
  if (!leaveData.leaveType) errors.push('請假類型 (leaveType) 是必填欄位');
  if (!leaveData.startDate) errors.push('開始日期 (startDate) 是必填欄位');
  if (!leaveData.endDate) errors.push('結束日期 (endDate) 是必填欄位');
  if (!leaveData.reason) errors.push('請假原因 (reason) 是必填欄位');
  
  // 驗證日期格式 (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (leaveData.startDate && !dateRegex.test(leaveData.startDate)) {
    errors.push('開始日期格式錯誤，應為 YYYY-MM-DD');
  }
  if (leaveData.endDate && !dateRegex.test(leaveData.endDate)) {
    errors.push('結束日期格式錯誤，應為 YYYY-MM-DD');
  }
  
  // 驗證日期邏輯
  if (leaveData.startDate && leaveData.endDate) {
    const startDate = new Date(leaveData.startDate);
    const endDate = new Date(leaveData.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      errors.push('日期格式無效');
    } else if (startDate > endDate) {
      errors.push('開始日期不能晚於結束日期');
    }
  }
  
  // 驗證時間格式 (HH:MM)，如果有提供
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (leaveData.startTime && !timeRegex.test(leaveData.startTime)) {
    errors.push('開始時間格式錯誤，應為 HH:MM');
  }
  if (leaveData.endTime && !timeRegex.test(leaveData.endTime)) {
    errors.push('結束時間格式錯誤，應為 HH:MM');
  }
  
  // 驗證時間邏輯
  if (leaveData.startDate === leaveData.endDate && 
      leaveData.startTime && leaveData.endTime && 
      leaveData.startTime >= leaveData.endTime) {
    errors.push('開始時間必須早於結束時間');
  }
  
  // 驗證請假類型
  const validLeaveTypes = ['annual', 'sick', 'personal', 'maternity', 'bereavement', 'unpaid', 'other'];
  if (leaveData.leaveType && !validLeaveTypes.includes(leaveData.leaveType)) {
    errors.push(`請假類型不合法，有效類型為: ${validLeaveTypes.join(', ')}`);
  }
  
  return errors;
};

/**
 * 計算請假天數
 * @param startDate 開始日期
 * @param endDate 結束日期
 * @returns 請假天數
 */
const calculateLeaveDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // 將時間設為00:00:00以便計算整天
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // 計算相差的毫秒數
  const diffTime = Math.abs(end.getTime() - start.getTime());
  
  // 轉換為天數並加1(因為包含頭尾兩天)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  return diffDays;
};

/**
 * 獲取請假申請列表
 */
export const getLeaveRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, storeId, employeeId, status, startDate, endDate } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: "缺少必要參數: tenantId" });
    }

    let query: any = db.collection('leaves')
      .where('tenantId', '==', tenantId);

    if (storeId) {
      query = query.where('storeId', '==', storeId);
    }

    if (employeeId) {
      query = query.where('employeeId', '==', employeeId);
    }

    if (status && typeof status === 'string') {
      query = query.where('status', '==', status);
    }

    if (startDate && endDate) {
      // 查找任何與日期範圍有重疊的請假
      query = query.where('startDate', '<=', endDate)
        .where('endDate', '>=', startDate)
        .orderBy('startDate', 'asc');
    } else if (startDate) {
      // 查找開始日期在指定日期或之後的請假
      query = query.where('startDate', '>=', startDate)
        .orderBy('startDate', 'asc');
    } else if (endDate) {
      // 查找結束日期在指定日期或之前的請假
      query = query.where('endDate', '<=', endDate)
        .orderBy('endDate', 'asc');
    } else {
      // 默認按開始日期降序排列
      query = query.orderBy('startDate', 'desc');
    }

    // 限制結果數量
    query = query.limit(100);

    const snapshot = await query.get();
    
    const leaveRequests: LeaveRequest[] = [];
    snapshot.forEach((doc: any) => {
      leaveRequests.push({
        leaveId: doc.id,
        ...doc.data()
      });
    });

    return res.status(200).json({ 
      leaveRequests,
      count: leaveRequests.length,
      message: '成功獲取請假申請列表'
    });
  } catch (error: any) {
    console.error("獲取請假申請列表錯誤:", error);
    return res.status(500).json({ 
      error: "獲取請假申請列表失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 獲取請假申請詳情
 */
export const getLeaveRequestById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { leaveId } = req.params;

    if (!leaveId) {
      return res.status(400).json({ error: "缺少必要參數: leaveId" });
    }

    const doc = await db.collection('leaves').doc(leaveId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該請假申請" });
    }

    // 檢查租戶ID是否匹配（基本的資源隔離）
    const leaveData = doc.data() as LeaveRequest;
    const requestTenantId = req.query.tenantId as string;
    
    if (requestTenantId && leaveData.tenantId !== requestTenantId) {
      return res.status(403).json({ error: "無權訪問此請假申請" });
    }

    return res.status(200).json({
      leaveRequest: {
        ...leaveData,
        leaveId: doc.id
      },
      message: '成功獲取請假申請詳情'
    });
  } catch (error: any) {
    console.error("獲取請假申請詳情錯誤:", error);
    return res.status(500).json({ 
      error: "獲取請假申請詳情失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 創建請假申請
 */
export const createLeaveRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      tenantId,
      storeId,
      employeeId,
      leaveType,
      startDate,
      endDate,
      startTime,
      endTime,
      reason,
      attachmentUrls
    } = req.body;

    // 驗證輸入數據
    const validationErrors = validateLeaveInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: "輸入數據驗證失敗", 
        validationErrors 
      });
    }

    // 檢查是否有重疊的請假申請
    const overlapQuery = db.collection('leaves')
      .where('tenantId', '==', tenantId)
      .where('employeeId', '==', employeeId)
      .where('status', 'in', ['pending', 'approved'])
      .where('startDate', '<=', endDate)
      .where('endDate', '>=', startDate);

    const overlapSnapshot = await overlapQuery.get();
    
    if (!overlapSnapshot.empty) {
      return res.status(409).json({ 
        error: "該時間段內已有其他請假申請", 
        conflictingLeaves: overlapSnapshot.docs.map(doc => ({
          leaveId: doc.id,
          ...doc.data()
        }))
      });
    }

    // 計算請假天數
    const totalDays = calculateLeaveDays(startDate, endDate);
    
    // 計算請假小時數 (如果有提供時間)
    let totalHours = undefined;
    if (startTime && endTime) {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      const startTimeMinutes = startHour * 60 + startMinute;
      const endTimeMinutes = endHour * 60 + endMinute;
      
      totalHours = (endTimeMinutes - startTimeMinutes) / 60 * totalDays;
    }

    // 獲取創建者ID (從驗證令牌)
    const createdBy = req.user?.uid || employeeId;

    // 建立請假申請資料
    const now = Timestamp.now();
    const newLeaveRequest: Omit<LeaveRequest, 'leaveId'> = {
      tenantId,
      storeId,
      employeeId,
      employeeName: req.body.employeeName || '',
      leaveType: leaveType as LeaveType,
      startDate,
      endDate,
      totalDays,
      reason,
      status: 'pending' as LeaveStatus,
      createdAt: now,
      updatedAt: now,
      updatedBy: req.user?.uid || '',
      reviewerId: null,
      reviewerName: null,
      reviewedAt: null,
      reviewComment: null
    };

    // 加入選填欄位
    if (startTime) newLeaveRequest.startTime = startTime;
    if (endTime) newLeaveRequest.endTime = endTime;
    if (totalHours) newLeaveRequest.totalHours = totalHours;
    if (attachmentUrls && Array.isArray(attachmentUrls)) {
      newLeaveRequest.attachmentUrls = attachmentUrls;
    }

    const docRef = await db.collection('leaves').add(newLeaveRequest);

    // 記錄操作日誌
    try {
      await logLeaveAction(
        req,
        'leave_request_create',
        docRef.id,
        `${newLeaveRequest.employeeName} (${startDate} ~ ${endDate})`,
        AuditLogStatus.SUCCESS,
        '新建請假申請',
        {
          leaveType: newLeaveRequest.leaveType,
          leaveDays: newLeaveRequest.totalDays,
          startDate,
          endDate
        }
      );
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }

    return res.status(201).json({
      message: '請假申請已成功提交，等待審核',
      leaveId: docRef.id,
      leaveRequest: {
        ...newLeaveRequest,
        leaveId: docRef.id
      }
    });
  } catch (error: any) {
    console.error("創建請假申請錯誤:", error);
    
    // 記錄操作日誌 (失敗)
    try {
      await logAuditEvent({
        userId: req.user?.uid || 'unknown',
        userName: req.user?.name,
        userEmail: req.user?.email,
        tenantId: req.user?.tenantId,
        storeId: req.user?.storeId,
        
        action: 'leave_request_create',
        status: AuditLogStatus.FAILURE,
        statusMessage: error.message || '創建請假申請失敗',
        
        targetEntityType: 'leave_request',
        targetEntityId: 'new',
        targetEntityName: req.body.employeeName || req.user?.name || 'unknown',
        
        details: {
          error: error.message,
          leaveType: req.body.leaveType,
          startDate: req.body.startDate,
          endDate: req.body.endDate
        },
        
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return res.status(500).json({ 
      error: "創建請假申請失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 更新請假申請
 */
export const updateLeaveRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { leaveId } = req.params;
    const updateData = req.body;

    if (!leaveId) {
      return res.status(400).json({ error: "缺少必要參數: leaveId" });
    }

    // 檢查請假申請是否存在
    const doc = await db.collection('leaves').doc(leaveId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該請假申請" });
    }

    const existingLeave = doc.data() as LeaveRequest;

    // 檢查當前狀態是否允許修改
    // 只有處於待審批(pending)狀態的請假申請可以被編輯，除非是在更新狀態
    if (existingLeave.status !== 'pending' && !updateData.status) {
      return res.status(400).json({ 
        error: "只有待審批狀態的請假申請可以被編輯",
        currentStatus: existingLeave.status
      });
    }

    // 檢查是否有員工自己試圖更改狀態
    if (updateData.status && 
        req.user?.role !== 'admin' && 
        req.user?.role !== 'manager') {
      return res.status(403).json({ 
        error: "僅管理員或經理可以更改請假申請狀態" 
      });
    }

    // 如果修改了關鍵屬性，需要驗證輸入並檢查衝突
    if (updateData.startDate || updateData.endDate || 
        updateData.leaveType || updateData.reason) {

      // 合併現有數據和更新數據進行驗證
      const mergedData = { ...existingLeave, ...updateData };
      const validationErrors = validateLeaveInput(mergedData);
      
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          error: "輸入數據驗證失敗", 
          validationErrors 
        });
      }

      // 如果修改了日期，檢查是否與其他請假衝突
      if ((updateData.startDate && updateData.startDate !== existingLeave.startDate) ||
          (updateData.endDate && updateData.endDate !== existingLeave.endDate)) {
        
        const targetStartDate = updateData.startDate || existingLeave.startDate;
        const targetEndDate = updateData.endDate || existingLeave.endDate;
        
        const overlapQuery = db.collection('leaves')
          .where('tenantId', '==', existingLeave.tenantId)
          .where('employeeId', '==', existingLeave.employeeId)
          .where('status', 'in', ['pending', 'approved'])
          .where('startDate', '<=', targetEndDate)
          .where('endDate', '>=', targetStartDate);
        
        const overlapSnapshot = await overlapQuery.get();
        
        // 檢查是否有衝突（不包括自己）
        const conflicts = overlapSnapshot.docs
          .filter(d => d.id !== leaveId)
          .map(d => ({ leaveId: d.id, ...d.data() }));
        
        if (conflicts.length > 0) {
          return res.status(409).json({ 
            error: "該時間段內已有其他請假申請", 
            conflictingLeaves: conflicts
          });
        }

        // 如果日期有更改，需要重新計算天數
        if (targetStartDate !== existingLeave.startDate || 
            targetEndDate !== existingLeave.endDate) {
          updateData.totalDays = calculateLeaveDays(targetStartDate, targetEndDate);
          
          // 如果有時間資訊，也需要重新計算小時數
          if (existingLeave.startTime && existingLeave.endTime) {
            const startTime = updateData.startTime || existingLeave.startTime;
            const endTime = updateData.endTime || existingLeave.endTime;
            
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const [endHour, endMinute] = endTime.split(':').map(Number);
            
            const startTimeMinutes = startHour * 60 + startMinute;
            const endTimeMinutes = endHour * 60 + endMinute;
            
            updateData.totalHours = (endTimeMinutes - startTimeMinutes) / 60 * updateData.totalDays;
          }
        }
      }
    }

    // 不允許更新特定欄位
    delete updateData.leaveId;
    delete updateData.tenantId;
    delete updateData.storeId;
    delete updateData.employeeId;
    delete updateData.createdAt;

    // 添加更新時間
    updateData.updatedAt = Timestamp.now();
    updateData.updatedBy = req.user?.uid || '';

    // 如果是管理員批准請假，設置額外欄位
    if (updateData.status === 'approved' && 
        (req.user?.role === 'admin' || req.user?.role === 'manager')) {
      updateData.approvedAt = Timestamp.now();
      updateData.approverId = req.user.uid;
    }

    // 更新請假申請
    await db.collection('leaves').doc(leaveId).update(updateData);

    // 獲取更新後的記錄
    const updatedDoc = await db.collection('leaves').doc(leaveId).get();

    // 記錄操作日誌
    try {
      await logLeaveAction(
        req,
        'leave_request_update',
        leaveId,
        `${updatedDoc.data().employeeName} (${updatedDoc.data().startDate} ~ ${updatedDoc.data().endDate})`,
        AuditLogStatus.SUCCESS,
        '更新請假申請',
        {
          updatedFields: Object.keys(updateData).filter(k => k !== 'updatedAt' && k !== 'updatedBy')
        },
        {
          leaveType: existingLeave.leaveType,
          startDate: existingLeave.startDate,
          endDate: existingLeave.endDate,
          reason: existingLeave.reason
        },
        {
          leaveType: updatedDoc.data().leaveType,
          startDate: updatedDoc.data().startDate,
          endDate: updatedDoc.data().endDate,
          reason: updatedDoc.data().reason
        }
      );
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }

    return res.status(200).json({
      message: '請假申請已成功更新',
      leaveRequest: {
        leaveId: updatedDoc.id,
        ...updatedDoc.data()
      }
    });
  } catch (error: any) {
    console.error("更新請假申請錯誤:", error);
    
    // 記錄操作日誌 (失敗)
    try {
      const { leaveId } = req.params;
      await logAuditEvent({
        userId: req.user?.uid || 'unknown',
        userName: req.user?.name,
        userEmail: req.user?.email,
        tenantId: req.user?.tenantId,
        storeId: req.user?.storeId,
        
        action: 'leave_request_update',
        status: AuditLogStatus.FAILURE,
        statusMessage: error.message || '更新請假申請失敗',
        
        targetEntityType: 'leave_request',
        targetEntityId: leaveId,
        
        details: {
          error: error.message,
          updatedFields: Object.keys(req.body).filter(k => k !== 'tenantId' && k !== 'storeId')
        },
        
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return res.status(500).json({ 
      error: "更新請假申請失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 刪除請假申請
 */
export const deleteLeaveRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { leaveId } = req.params;

    if (!leaveId) {
      return res.status(400).json({ error: "缺少必要參數: leaveId" });
    }

    // 檢查請假申請是否存在
    const doc = await db.collection('leaves').doc(leaveId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "找不到該請假申請" });
    }

    const leaveRequest = doc.data() as LeaveRequest;

    // 檢查是否有權限刪除
    // 1. 員工只能刪除自己的待審批請假申請
    // 2. 管理員/經理可以刪除任何請假申請
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
      if (req.user?.uid !== leaveRequest.employeeId) {
        return res.status(403).json({ error: "無權刪除他人的請假申請" });
      }
      
      if (leaveRequest.status !== 'pending') {
        return res.status(400).json({ 
          error: "只有待審批狀態的請假申請可以被刪除",
          currentStatus: leaveRequest.status 
        });
      }
    }

    // 備份請假申請數據用於日誌記錄
    const leaveData = { ...leaveRequest };

    // 執行刪除操作
    await db.collection('leaves').doc(leaveId).delete();

    // 記錄操作日誌
    try {
      await logLeaveAction(
        req,
        'leave_request_delete',
        leaveId,
        `${leaveData.employeeName} (${leaveData.startDate} ~ ${leaveData.endDate})`,
        AuditLogStatus.SUCCESS,
        '刪除請假申請',
        {
          leaveType: leaveData.leaveType,
          startDate: leaveData.startDate,
          endDate: leaveData.endDate,
          leaveDays: leaveData.totalDays,
          reason: leaveData.reason
        },
        leaveData
      );
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }

    return res.status(200).json({
      message: '請假申請已成功刪除'
    });
  } catch (error: any) {
    console.error("刪除請假申請錯誤:", error);
    
    // 記錄操作日誌 (失敗)
    try {
      const { leaveId } = req.params;
      await logAuditEvent({
        userId: req.user?.uid || 'unknown',
        userName: req.user?.name,
        userEmail: req.user?.email,
        tenantId: req.user?.tenantId,
        storeId: req.user?.storeId,
        
        action: 'leave_request_delete',
        status: AuditLogStatus.FAILURE,
        statusMessage: error.message || '刪除請假申請失敗',
        
        targetEntityType: 'leave_request',
        targetEntityId: leaveId,
        
        details: { error: error.message },
        
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return res.status(500).json({ 
      error: "刪除請假申請失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
};

/**
 * 審批請假申請
 */
export const approveLeaveRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { leaveId } = req.params;
    const { approved, comment } = req.body;
    
    if (!leaveId) {
      return res.status(400).json({ error: "缺少必要參數: leaveId" });
    }
    
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: "缺少必要參數: approved (boolean)" });
    }
    
    // 檢查請假申請是否存在
    const leaveRef = db.collection('leaves').doc(leaveId);
    const leaveDoc = await leaveRef.get();
    
    if (!leaveDoc.exists) {
      return res.status(404).json({ error: "找不到該請假申請" });
    }
    
    const currentLeave = leaveDoc.data() as LeaveRequest;
    
    // 只有待審核狀態的申請才能審批
    if (currentLeave.status !== 'pending') {
      return res.status(400).json({ error: "只能審批待審核狀態的請假申請" });
    }
    
    // 只有管理員或經理才能審批
    if (req.user?.role !== 'admin' && req.user?.role !== 'manager') {
      return res.status(403).json({ error: "無權審批請假申請" });
    }
    
    // 準備更新數據
    const now = Timestamp.now();
    const updateData: Partial<LeaveRequest> = {
      status: approved ? 'approved' as LeaveStatus : 'rejected' as LeaveStatus,
      reviewerId: req.user.uid,
      reviewerName: req.user.name || req.user.email || req.user.uid,
      reviewedAt: now,
      reviewComment: comment || null,
      updatedAt: now,
      updatedBy: req.user.uid
    };
    
    // 更新數據庫
    await leaveRef.update(updateData);
    
    // 獲取更新後的完整數據
    const updatedDoc = await leaveRef.get();
    const updatedLeave = updatedDoc.data() as LeaveRequest;
    
    // 記錄操作日誌
    try {
      await logLeaveAction(
        req,
        approved ? 'leave_request_approve' : 'leave_request_reject',
        leaveId,
        `${updatedLeave.employeeName} (${updatedLeave.startDate} ~ ${updatedLeave.endDate})`,
        AuditLogStatus.SUCCESS,
        approved ? '批准請假申請' : '拒絕請假申請',
        {
          leaveType: updatedLeave.leaveType,
          startDate: updatedLeave.startDate,
          endDate: updatedLeave.endDate,
          leaveDays: updatedLeave.totalDays,
          comment: updateData.reviewComment
        },
        { status: currentLeave.status },
        { status: updateData.status }
      );
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }
    
    // 返回成功響應
    return res.status(200).json({
      leaveRequest: {
        ...updatedLeave,
        leaveId
      },
      message: approved ? '請假申請已批准' : '請假申請已拒絕'
    });
  } catch (error: any) {
    console.error("審批請假申請錯誤:", error);
    
    // 記錄操作日誌 (失敗)
    try {
      const { leaveId } = req.params;
      const { approved } = req.body;
      await logAuditEvent({
        userId: req.user?.uid || 'unknown',
        userName: req.user?.name,
        userEmail: req.user?.email,
        tenantId: req.user?.tenantId,
        storeId: req.user?.storeId,
        
        action: approved ? 'leave_request_approve' : 'leave_request_reject',
        status: AuditLogStatus.FAILURE,
        statusMessage: error.message || '審批請假申請失敗',
        
        targetEntityType: 'leave_request',
        targetEntityId: leaveId,
        
        details: {
          error: error.message,
          approved
        },
        
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
    }
    
    return res.status(500).json({ 
      error: "審批請假申請失敗", 
      details: error.message || "服務器內部錯誤" 
    });
  }
}; 