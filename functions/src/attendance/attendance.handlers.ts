import { Request, Response } from 'express';
import { firestore } from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import {
  AttendanceLog,
  PunchRequest,
  UserContext,
  calculateDistance,
  ListAttendanceLogsQuery,
  AttendanceLogsResponse,
  ExtendedAttendanceLog,
  ClockInRequest,
  ClockOutRequest,
  ClockSource,
  AttendanceStatus
} from './attendance.types';
import { AttendanceService } from './attendance.service';

// 獲取 Firestore 實例
const db = firestore();

/**
 * 考勤API處理器 - 處理打卡相關請求
 */
export class AttendanceHandlers {
  /**
   * 處理上班打卡請求
   */
  public static async clockIn(req: Request, res: Response): Promise<Response> {
    try {
      // 從經過身份驗證的請求中獲取員工ID、租戶ID和店鋪ID
      // @ts-ignore
      const { uid: employeeId, tenantId, storeId } = req.user as {
        uid: string;
        tenantId: string;
        storeId: string;
      };

      // 從請求體獲取打卡資料
      const clockInRequest: ClockInRequest = req.body;

      // 調用服務處理打卡邏輯
      const result = await AttendanceService.clockIn(
        employeeId,
        tenantId,
        storeId,
        clockInRequest
      );

      // 根據結果回應客戶端
      if (result && 'error' in result) {
        // 處理錯誤情況
        const { error, code, details } = result;

        // 根據錯誤代碼決定HTTP狀態碼
        let statusCode = 400;
        switch (code) {
          case 'STORE_NOT_FOUND':
            statusCode = 404;
            break;
          case 'DUPLICATE_CLOCK_IN':
            statusCode = 409;
            break;
          case 'INTERNAL_SERVER_ERROR':
            statusCode = 500;
            break;
        }

        return res.status(statusCode).json({
          success: false,
          error,
          code,
          details: process.env.NODE_ENV === 'development' ? details : undefined
        });
      }

      // 成功打卡回應
      return res.status(201).json({
        success: true,
        message: '上班打卡成功',
        data: result
      });

    } catch (error) {
      console.error('上班打卡請求處理失敗:', error);
      return res.status(500).json({
        success: false,
        error: '處理請求時發生錯誤',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * 處理下班打卡請求
   */
  public static async clockOut(req: Request, res: Response): Promise<Response> {
    try {
      // 從經過身份驗證的請求中獲取員工ID、租戶ID和店鋪ID
      // @ts-ignore
      const { uid: employeeId, tenantId, storeId } = req.user as {
        uid: string;
        tenantId: string;
        storeId: string;
      };

      // 從請求體獲取打卡資料
      const clockOutRequest: ClockOutRequest = req.body;

      // 調用服務處理打卡邏輯
      const result = await AttendanceService.clockOut(
        employeeId,
        tenantId,
        storeId,
        clockOutRequest
      );

      // 根據結果回應客戶端
      if (result && 'error' in result) {
        // 處理錯誤情況
        const { error, code, details } = result;

        // 根據錯誤代碼決定HTTP狀態碼
        let statusCode = 400;
        switch (code) {
          case 'STORE_NOT_FOUND':
            statusCode = 404;
            break;
          case 'MISSING_CLOCK_IN':
            statusCode = 404;
            break;
          case 'DUPLICATE_CLOCK_OUT':
            statusCode = 409;
            break;
          case 'INTERNAL_SERVER_ERROR':
            statusCode = 500;
            break;
        }

        return res.status(statusCode).json({
          success: false,
          error,
          code,
          details: process.env.NODE_ENV === 'development' ? details : undefined
        });
      }

      // 成功打卡回應
      return res.status(200).json({
        success: true,
        message: '下班打卡成功',
        data: result
      });

    } catch (error) {
      console.error('下班打卡請求處理失敗:', error);
      return res.status(500).json({
        success: false,
        error: '處理請求時發生錯誤',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * 獲取員工出勤記錄列表
   * 備註：此方法可在後續實現
   */
  public static async listAttendanceLogs(req: Request, res: Response): Promise<Response> {
    // TODO: 實現獲取出勤記錄列表功能
    return res.status(501).json({
      success: false,
      error: '功能尚未實現'
    });
  }

  /**
   * 獲取特定出勤記錄詳情
   * 備註：此方法可在後續實現
   */
  public static async getAttendanceById(req: Request, res: Response): Promise<Response> {
    // TODO: 實現獲取特定出勤記錄詳情功能
    return res.status(501).json({
      success: false,
      error: '功能尚未實現'
    });
  }

  /**
   * 獲取員工最近一次出勤記錄
   * 備註：此方法可在後續實現
   */
  public static async getLastAttendanceLog(req: Request, res: Response): Promise<Response> {
    // TODO: 實現獲取最近一次出勤記錄功能
    return res.status(501).json({
      success: false,
      error: '功能尚未實現'
    });
  }
}

/**
 * 處理員工打卡
 * POST /attendance/punch
 */
export const handlePunch = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取請求數據
    const punchData: PunchRequest = req.body;

    // 獲取用戶上下文
    // @ts-ignore
    const user = req.user as UserContext;
    if (!user) {
      console.error('未授權：缺少有效的用戶上下文');
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證'
      });
    }

    // 確認用戶是員工
    if (!['employee', 'store_manager'].includes(user.role) && user.role !== 'staff') {
      console.warn(`權限不足：用戶 ${user.uid} (角色 ${user.role}) 嘗試進行打卡操作`);
      return res.status(403).json({
        status: 'error',
        message: '未授權：您沒有進行打卡的權限'
      });
    }

    // 獲取員工信息
    const employeeSnapshot = await db.collection('employees').doc(user.uid).get();
    if (!employeeSnapshot.exists) {
      console.error(`找不到員工：${user.uid}`);
      return res.status(404).json({
        status: 'error',
        message: '找不到對應的員工記錄'
      });
    }

    const employeeData = employeeSnapshot.data();
    if (!employeeData) {
      console.error(`員工數據為空：${user.uid}`);
      return res.status(500).json({
        status: 'error',
        message: '系統錯誤：員工數據讀取失敗'
      });
    }

    // 獲取員工的主要分店 ID
    const storeId = employeeData.storeId || user.storeId;
    if (!storeId) {
      console.error(`員工 ${user.uid} 沒有關聯的分店`);
      return res.status(400).json({
        status: 'error',
        message: '您的帳戶未關聯到任何分店，無法打卡'
      });
    }

    // 獲取分店信息
    const storeSnapshot = await db.collection('stores').doc(storeId).get();
    if (!storeSnapshot.exists) {
      console.error(`找不到分店：${storeId}`);
      return res.status(404).json({
        status: 'error',
        message: '找不到對應的分店記錄'
      });
    }

    const storeData = storeSnapshot.data();
    if (!storeData) {
      console.error(`分店數據為空：${storeId}`);
      return res.status(500).json({
        status: 'error',
        message: '系統錯誤：分店數據讀取失敗'
      });
    }

    // 檢查分店是否啟用
    if (storeData.isActive === false) {
      console.warn(`分店未啟用：${storeId}`);
      return res.status(400).json({
        status: 'error',
        message: '此分店目前未啟用，無法進行打卡'
      });
    }

    // 獲取分店地理位置和圍欄設定
    const storeLat = storeData.geolocation?.latitude;
    const storeLon = storeData.geolocation?.longitude;

    if (!storeLat || !storeLon) {
      console.error(`分店 ${storeId} 沒有設定地理位置`);
      return res.status(400).json({
        status: 'error',
        message: '此分店未設定地理位置，無法驗證打卡位置'
      });
    }

    // 獲取打卡半徑設定，預設值為 100 公尺
    let punchRadius = 100; // 預設值

    // 從分店設定或 GPS 圍欄獲取半徑
    if (storeData.settings?.punchRadius) {
      punchRadius = storeData.settings.punchRadius;
    } else if (storeData.gpsFence?.enabled && storeData.gpsFence.radius) {
      punchRadius = storeData.gpsFence.radius;
    }

    // 計算距離
    const distance = calculateDistance(
      punchData.latitude,
      punchData.longitude,
      storeLat,
      storeLon
    );

    // 判斷是否在範圍內
    const isWithinFence = distance <= punchRadius;

    // 判斷打卡類型 (上班/下班)
    // 查詢該員工今天的打卡記錄
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const todayStart = firestore.Timestamp.fromDate(todayDate);
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = firestore.Timestamp.fromDate(tomorrow);

    const attendanceLogsQuery = await db.collection('attendanceLogs')
      .where('employeeId', '==', user.uid)
      .where('storeId', '==', storeId)
      .where('timestamp', '>=', todayStart)
      .where('timestamp', '<', tomorrowStart)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    // 根據最後一筆打卡記錄判斷本次打卡類型
    let punchType: 'punch-in' | 'punch-out' = 'punch-in'; // 默認為上班卡

    if (!attendanceLogsQuery.empty) {
      const lastLog = attendanceLogsQuery.docs[0].data() as AttendanceLog;
      // 如果最後一筆是上班卡且沒有下班卡，則本次為下班卡
      if (!lastLog.clockOutTime) {
        punchType = 'punch-out';
      }
      // 如果最後一筆有下班卡，則本次為上班卡 (已是默認值)
    }

    // 生成打卡記錄 ID
    const logId = uuidv4();

    // 創建打卡記錄
    const now = firestore.Timestamp.now();
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD格式

    const attendanceLog: AttendanceLog = {
      attendanceId: logId,
      employeeId: user.uid,
      storeId,
      tenantId: user.tenantId || employeeData.tenantId,
      date: dateStr,
      clockInTime: now,
      clockInCoords: {
        latitude: punchData.latitude,
        longitude: punchData.longitude
      },
      isWithinFence,
      clockInDistance: distance,
      source: ClockSource.MOBILE_APP, // 來源為手機應用
      clockInNotes: punchData.notes,
      status: isWithinFence ? AttendanceStatus.CLOCKED_IN : AttendanceStatus.INVALID_LOCATION,
      createdAt: now,
      createdBy: user.uid
    };

    // 儲存打卡記錄
    await db.collection('attendanceLogs').doc(logId).set(attendanceLog);

    // 返回成功響應
    return res.status(200).json({
      status: 'success',
      message: isWithinFence
        ? '打卡成功'
        : '已記錄您的打卡，但位置不在允許範圍內',
      data: {
        logId,
        timestamp: now.toDate().toISOString(),
        type: punchType,
        isWithinFence,
        distance,
        storeName: storeData.storeName
      }
    });

  } catch (error: any) {
    console.error('處理打卡請求時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤',
      errors: [{
        code: 'server_error',
        message: '處理打卡請求時發生錯誤'
      }]
    });
  }
};

/**
 * 獲取考勤記錄列表
 * GET /attendance/logs
 */
export const listAttendanceLogs = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取用戶上下文
    // @ts-ignore
    const user = req.user as UserContext;
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: '未授權：缺少有效的用戶憑證',
        errors: [{
          code: 'unauthorized',
          message: '未授權：缺少有效的用戶憑證'
        }]
      });
    }

    // 獲取查詢參數
    const params: ListAttendanceLogsQuery = req.query as any;

    // 預設值
    const limit = params.limit || 10;
    const page = params.page || 1;
    const offset = (page - 1) * limit;
    const sortBy = params.sortBy || 'timestamp';
    const sortOrder = params.sortOrder || 'desc';

    // 構建查詢
    let query = db.collection('attendanceLogs') as firestore.Query;

    // 基於用戶角色和權限設置訪問控制
    if (user.role === 'admin' || user.role === 'system_admin') {
      // 管理員可以查看所有記錄
      if (user.tenantId) {
        // 租戶管理員僅能查看其租戶的記錄
        query = query.where('tenantId', '==', user.tenantId);
      }
    } else if (user.role === 'store_manager') {
      // 店長只能查看其管理的分店記錄
      const storeIds = [user.storeId];
      if (user.additionalStoreIds) {
        storeIds.push(...user.additionalStoreIds);
      }

      if (storeIds.length === 1) {
        query = query.where('storeId', '==', storeIds[0]);
      } else if (storeIds.length > 1) {
        query = query.where('storeId', 'in', storeIds.slice(0, 10));
      } else {
        // 沒有管理任何分店的店長，返回空結果
        return res.status(200).json({
          status: 'success',
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            limit: limit
          }
        });
      }
    } else {
      // 普通員工只能查看自己的記錄
      query = query.where('employeeId', '==', user.uid);
    }

    // 處理篩選條件
    if (params.employeeId) {
      // 確認用戶是否有權查看指定員工的記錄
      if (user.role === 'employee' && params.employeeId !== user.uid) {
        return res.status(403).json({
          status: 'error',
          message: '權限不足：您無權查看其他員工的考勤記錄',
          errors: [{
            code: 'forbidden',
            message: '權限不足：您無權查看其他員工的考勤記錄'
          }]
        });
      }
      query = query.where('employeeId', '==', params.employeeId);
    }

    if (params.storeId) {
      // 確認店長只能查看其管理分店的記錄
      if (user.role === 'store_manager') {
        const managedStores = [user.storeId, ...(user.additionalStoreIds || [])];
        if (!managedStores.includes(params.storeId)) {
          return res.status(403).json({
            status: 'error',
            message: '權限不足：您無權查看其他分店的考勤記錄',
            errors: [{
              code: 'forbidden',
              message: '權限不足：您無權查看其他分店的考勤記錄'
            }]
          });
        }
      }
      query = query.where('storeId', '==', params.storeId);
    }

    if (params.type) {
      query = query.where('type', '==', params.type);
    }

    if (params.source) {
      query = query.where('source', '==', params.source);
    }

    if (params.isWithinFence !== undefined) {
      query = query.where('isWithinFence', '==', params.isWithinFence);
    }

    // 處理日期範圍
    if (params.startDate) {
      const startDate = new Date(params.startDate);
      startDate.setHours(0, 0, 0, 0);
      const startTimestamp = firestore.Timestamp.fromDate(startDate);
      query = query.where('timestamp', '>=', startTimestamp);
    }

    if (params.endDate) {
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      const endTimestamp = firestore.Timestamp.fromDate(endDate);
      query = query.where('timestamp', '<=', endTimestamp);
    }

    // 計算總記錄數 (使用相同篩選條件的查詢)
    // 注意：這是個簡單實現，在大型應用中應該考慮性能優化
    const countQuery = query.count();
    const countSnapshot = await countQuery.get();
    const totalItems = countSnapshot.data().count;

    // 應用排序
    query = query.orderBy(sortBy, sortOrder);

    // 應用分頁
    query = query.limit(limit).offset(offset);

    // 執行查詢
    const snapshot = await query.get();

    // 獲取員工和分店數據以顯示名稱
    const employeeIds = new Set<string>();
    const storeIds = new Set<string>();

    snapshot.docs.forEach(doc => {
      const data = doc.data() as AttendanceLog;
      employeeIds.add(data.employeeId);
      storeIds.add(data.storeId);
    });

    // 獲取員工數據
    const employeePromises = Array.from(employeeIds).map(async (id) => {
      const employeeDoc = await db.collection('employees').doc(id).get();
      return {
        id,
        data: employeeDoc.exists ? employeeDoc.data() : null
      };
    });

    // 獲取分店數據
    const storePromises = Array.from(storeIds).map(async (id) => {
      const storeDoc = await db.collection('stores').doc(id).get();
      return {
        id,
        data: storeDoc.exists ? storeDoc.data() : null
      };
    });

    const [employeesResults, storesResults] = await Promise.all([
      Promise.all(employeePromises),
      Promise.all(storePromises)
    ]);

    // 創建查找映射
    const employeeMap = new Map(
      employeesResults.map(result => [
        result.id,
        result.data ? `${result.data.firstName} ${result.data.lastName}` : '未知員工'
      ])
    );

    const storeMap = new Map(
      storesResults.map(result => [
        result.id,
        result.data ? result.data.storeName : '未知分店'
      ])
    );

    // 處理結果
    const logs: ExtendedAttendanceLog[] = snapshot.docs.map(doc => {
      const data = doc.data() as AttendanceLog;

      return {
        ...data,
        // 使用 clockInTime 代替 timestamp
      clockInTime: data.clockInTime,  // 保持 Firestore Timestamp 格式
        employeeName: employeeMap.get(data.employeeId),
        storeName: storeMap.get(data.storeId),
      };
    });

    // 計算分頁數據
    const totalPages = Math.ceil(totalItems / limit);

    // 將 Timestamp 轉換為 ISO 字符串
    const formattedLogs = logs.map(log => {
      const formatted = {
        ...log,
        clockInTime: log.clockInTime.toDate().toISOString(),
        createdAt: log.createdAt.toDate().toISOString(),
        updatedAt: log.updatedAt ? log.updatedAt.toDate().toISOString() : undefined
      };
      return formatted;
    });

    // 返回響應
    // 將 formattedLogs 轉換為 AttendanceLogDTO[]
    const dtoLogs: any[] = formattedLogs.map(log => ({
      attendanceId: log.attendanceId,
      employeeId: log.employeeId,
      employeeName: log.employeeName,
      storeId: log.storeId,
      storeName: log.storeName,
      tenantId: log.tenantId,
      date: log.date,
      clockInTime: log.clockInTime,
      clockInCoords: log.clockInCoords,
      isWithinFence: log.isWithinFence,
      clockInDistance: log.clockInDistance,
      clockInDeviceInfo: log.clockInDeviceInfo,
      clockInNotes: log.clockInNotes,
      source: log.source,
      clockOutTime: log.clockOutTime,
      clockOutCoords: log.clockOutCoords,
      isWithinFenceClockOut: log.isWithinFenceClockOut,
      clockOutDistance: log.clockOutDistance,
      clockOutDeviceInfo: log.clockOutDeviceInfo,
      clockOutNotes: log.clockOutNotes,
      clockOutSource: log.clockOutSource,
      workDurationMinutes: log.workDurationMinutes,
      status: log.status,
      lateMinutes: log.lateMinutes,
      earlyLeaveMinutes: log.earlyLeaveMinutes,
      createdAt: log.createdAt,
      createdBy: log.createdBy,
      updatedAt: log.updatedAt,
      updatedBy: log.updatedBy
    }));

    return res.status(200).json({
      status: 'success',
      data: dtoLogs,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });

  } catch (error: any) {
    console.error('獲取考勤記錄列表時發生錯誤：', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || '系統內部錯誤',
      errors: [{
        code: 'server_error',
        message: '獲取考勤記錄列表時發生錯誤'
      }]
    });
  }
};