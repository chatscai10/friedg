import { Request, Response } from 'express';
import { db } from '../firebase';
import { HttpError } from '../utils/errors';
import { validateSchema } from '../utils/validation';
import { isAdmin, isManager } from '../utils/auth';
import * as yup from 'yup';

// 創建請假申請的請求驗證模式
const createLeaveRequestSchema = yup.object().shape({
  leaveTypeId: yup.string().required('請假類型ID必須提供'),
  startTime: yup.string().required('請假開始時間必須提供'),
  endTime: yup.string().required('請假結束時間必須提供'),
  reason: yup.string().required('請假原因必須提供'),
  storeId: yup.string()
});

// 更新請假申請狀態的請求驗證模式
const updateLeaveRequestStatusSchema = yup.object().shape({
  newStatus: yup.string().oneOf(['approved', 'rejected'], '狀態必須是 approved 或 rejected').required('新狀態必須提供'),
  rejectionReason: yup.string().when('newStatus', {
    is: 'rejected',
    then: (schema) => schema.required('拒絕原因必須提供')
  })
});

/**
 * 獲取所有可用的假期類別
 */
export const listLeaveTypes = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    
    let query = db.collection('leaveTypes');
    
    // 如果提供了租戶ID，則過濾特定租戶的假期類型
    if (tenantId) {
      query = query.where('tenantId', '==', tenantId);
    } else {
      // 否則，獲取全局假期類型（tenantId 為空的）
      query = query.where('tenantId', '==', '');
    }
    
    const snapshot = await query.get();
    const leaveTypes = snapshot.docs.map(doc => ({
      leaveTypeId: doc.id,
      ...doc.data()
    }));
    
    return res.status(200).json({ leaveTypes });
  } catch (error) {
    console.error('獲取假期類別失敗:', error);
    return res.status(500).json({ 
      code: 'server_error',
      message: '獲取假期類別失敗' 
    });
  }
};

/**
 * 員工提交請假申請
 */
export const createLeaveRequest = async (req: Request, res: Response) => {
  try {
    // 驗證請求數據
    const validatedData = await validateSchema(createLeaveRequestSchema, req.body);
    
    // 獲取當前用戶ID
    const userId = req.user?.uid;
    if (!userId) {
      throw new HttpError(401, 'unauthorized', '未授權的請求');
    }
    
    // 獲取請假類型信息（檢查是否存在）
    const leaveTypeDoc = await db.collection('leaveTypes').doc(validatedData.leaveTypeId).get();
    if (!leaveTypeDoc.exists) {
      throw new HttpError(400, 'invalid_leave_type', '無效的請假類型');
    }
    
    // 獲取用戶信息
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new HttpError(400, 'user_not_found', '找不到用戶資料');
    }
    
    const userData = userDoc.data();
    const storeId = validatedData.storeId || userData?.storeId || '';
    const tenantId = userData?.tenantId || '';
    
    // 創建請假申請
    const requestData = {
      employeeId: userId,
      storeId,
      tenantId,
      leaveTypeId: validatedData.leaveTypeId,
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
      reason: validatedData.reason,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    
    const docRef = await db.collection('leaveRequests').add(requestData);
    
    // 回傳結果
    return res.status(201).json({
      leaveRequest: {
        requestId: docRef.id,
        ...requestData
      }
    });
  } catch (error) {
    console.error('建立請假申請失敗:', error);
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({
        code: error.code,
        message: error.message
      });
    }
    
    return res.status(500).json({
      code: 'server_error',
      message: '建立請假申請失敗'
    });
  }
};

/**
 * 查詢請假申請列表
 */
export const listLeaveRequests = async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      storeId,
      status,
      startDate,
      endDate,
      page = '1',
      pageSize = '20'
    } = req.query;
    
    // 獲取當前用戶
    const userId = req.user?.uid;
    if (!userId) {
      throw new HttpError(401, 'unauthorized', '未授權的請求');
    }
    
    // 獲取用戶角色/信息
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new HttpError(400, 'user_not_found', '找不到用戶資料');
    }
    
    const userData = userDoc.data();
    const userRole = userData?.role || 'employee';
    const userStoreId = userData?.storeId;
    const userTenantId = userData?.tenantId;
    
    // 建立查詢
    let query = db.collection('leaveRequests');
    
    // 根據用戶角色進行權限過濾
    if (userRole === 'admin' || await isAdmin(userId)) {
      // 管理員可以查看所有請假申請，但仍然限制在他們的租戶內
      if (userTenantId) {
        query = query.where('tenantId', '==', userTenantId);
      }
    } else if (userRole === 'manager' || await isManager(userId)) {
      // 經理可以查看其商店的所有請假申請
      if (userStoreId) {
        query = query.where('storeId', '==', userStoreId);
      }
    } else {
      // 一般員工只能查看自己的請假申請
      query = query.where('employeeId', '==', userId);
    }
    
    // 應用查詢過濾條件
    if (employeeId && (userRole === 'admin' || userRole === 'manager')) {
      query = query.where('employeeId', '==', employeeId);
    }
    
    if (storeId && userRole === 'admin') {
      query = query.where('storeId', '==', storeId);
    }
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    // 根據時間範圍過濾
    // 注意: Firestore 不支持在單一查詢中使用多個範圍條件，這裡可能需要優化
    if (startDate) {
      query = query.where('startTime', '>=', startDate);
    }
    
    // 分頁處理
    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * pageSizeNum;
    
    // 獲取總數（這在 Firestore 中需要單獨查詢）
    const countSnapshot = await query.get();
    const total = countSnapshot.size;
    
    // 獲取分頁結果
    query = query.orderBy('requestedAt', 'desc')
                 .limit(pageSizeNum)
                 .offset(offset);
    
    const snapshot = await query.get();
    const leaveRequests = snapshot.docs.map(doc => ({
      requestId: doc.id,
      ...doc.data()
    }));
    
    // 回傳結果
    return res.status(200).json({
      leaveRequests,
      pagination: {
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        hasMore: total > pageNum * pageSizeNum
      }
    });
  } catch (error) {
    console.error('獲取請假申請列表失敗:', error);
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({
        code: error.code,
        message: error.message
      });
    }
    
    return res.status(500).json({
      code: 'server_error',
      message: '獲取請假申請列表失敗'
    });
  }
};

/**
 * 更新請假申請狀態（批准或拒絕）
 */
export const updateLeaveRequestStatus = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    
    // 驗證請求數據
    const validatedData = await validateSchema(updateLeaveRequestStatusSchema, req.body);
    
    // 獲取當前用戶
    const userId = req.user?.uid;
    if (!userId) {
      throw new HttpError(401, 'unauthorized', '未授權的請求');
    }
    
    // 獲取用戶角色/信息
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new HttpError(400, 'user_not_found', '找不到用戶資料');
    }
    
    const userData = userDoc.data();
    const userRole = userData?.role || 'employee';
    const userStoreId = userData?.storeId;
    
    // 檢查權限（只有管理員或經理可以審批）
    if (userRole !== 'admin' && userRole !== 'manager' && 
        !(await isAdmin(userId)) && !(await isManager(userId))) {
      throw new HttpError(403, 'permission_denied', '您沒有權限執行此操作');
    }
    
    // 獲取請假申請
    const leaveRequestDoc = await db.collection('leaveRequests').doc(requestId).get();
    if (!leaveRequestDoc.exists) {
      throw new HttpError(404, 'leave_request_not_found', '找不到請假申請');
    }
    
    const leaveRequestData = leaveRequestDoc.data();
    
    // 如果是經理，確保只能審批其所在商店的請假申請
    if (userRole === 'manager' && leaveRequestData?.storeId !== userStoreId) {
      throw new HttpError(403, 'permission_denied', '您只能審批您所在商店的請假申請');
    }
    
    // 確保申請狀態為待處理
    if (leaveRequestData?.status !== 'pending') {
      throw new HttpError(400, 'invalid_status_change', '只能更新待處理的請假申請');
    }
    
    // 更新申請狀態
    const updateData: any = {
      status: validatedData.newStatus,
      approvedBy: userId,
      approvedAt: new Date().toISOString()
    };
    
    // 如果是拒絕，添加拒絕原因
    if (validatedData.newStatus === 'rejected') {
      updateData.rejectionReason = validatedData.rejectionReason;
    }
    
    await db.collection('leaveRequests').doc(requestId).update(updateData);
    
    // 獲取更新後的文檔
    const updatedDoc = await db.collection('leaveRequests').doc(requestId).get();
    const updatedData = updatedDoc.data();
    
    // 回傳結果
    return res.status(200).json({
      leaveRequest: {
        requestId: updatedDoc.id,
        ...updatedData
      }
    });
  } catch (error) {
    console.error('更新請假申請狀態失敗:', error);
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({
        code: error.code,
        message: error.message
      });
    }
    
    return res.status(500).json({
      code: 'server_error',
      message: '更新請假申請狀態失敗'
    });
  }
}; 