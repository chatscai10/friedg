import apiClient from './api';
import { firestore } from 'firebase/firestore';

// 考勤記錄類型
export interface AttendanceLog {
  logId: string;               // 打卡記錄唯一識別碼
  employeeId: string;          // 員工 ID
  employeeName?: string;       // 員工姓名 (前端顯示用)
  storeId: string;             // 分店 ID
  storeName?: string;          // 分店名稱 (前端顯示用)
  tenantId: string;            // 租戶 ID
  timestamp: Date;             // 打卡時間
  type: 'punch-in' | 'punch-out';  // 打卡類型 (上班/下班)
  latitude: number;            // 緯度
  longitude: number;           // 經度
  isWithinFence: boolean;      // 是否在允許範圍內
  distance?: number;           // 與分店中心點的距離 (公尺)
  source: 'mobile-app' | 'web-admin-manual' | 'kiosk';  // 來源
  notes?: string;              // 備註 (如：手動調整理由)
  createdAt: Date;             // 記錄創建時間
  createdBy?: string;          // 記錄創建者 (若為手動調整)
  updatedAt?: Date;            // 記錄更新時間
  updatedBy?: string;          // 記錄更新者
}

// 考勤記錄列表查詢參數
export interface GetAttendanceLogsParams {
  page?: number;               // 頁碼
  limit?: number;              // 每頁記錄數
  startDate?: string;          // 開始日期
  endDate?: string;            // 結束日期
  employeeId?: string;         // 員工 ID
  storeId?: string;            // 分店 ID
  type?: 'punch-in' | 'punch-out';  // 打卡類型
  isWithinFence?: boolean;     // 是否在允許範圍內
  sort?: string;               // 排序字段
  order?: 'asc' | 'desc';      // 排序方式
}

// 考勤記錄列表響應
export interface AttendanceLogsResponse {
  data: AttendanceLog[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

// 模擬員工數據
const mockEmployees = [
  { id: 'emp001', name: '張小明', storeId: 'store001' },
  { id: 'emp002', name: '李大華', storeId: 'store001' },
  { id: 'emp003', name: '王美麗', storeId: 'store002' },
  { id: 'emp004', name: '陳志明', storeId: 'store002' },
  { id: 'emp005', name: '林小玲', storeId: 'store003' }
];

// 模擬分店數據
const mockStores = [
  { id: 'store001', name: '台北信義店', latitude: 25.0330, longitude: 121.5654 },
  { id: 'store002', name: '台北忠孝店', latitude: 25.0418, longitude: 121.5449 },
  { id: 'store003', name: '台北南港店', latitude: 25.0553, longitude: 121.6076 }
];

// 生成模擬考勤記錄數據
const generateMockAttendanceLogs = (): AttendanceLog[] => {
  const logs: AttendanceLog[] = [];
  const now = new Date();
  
  // 生成過去7天的記錄
  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    
    // 每個員工每天上下班打卡
    mockEmployees.forEach(employee => {
      const store = mockStores.find(s => s.id === employee.storeId);
      if (!store) return;
      
      // 上班卡 (9:00 左右)
      const punchInTime = new Date(day);
      punchInTime.setHours(9, Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
      
      // 下班卡 (18:00 左右)
      const punchOutTime = new Date(day);
      punchOutTime.setHours(18, Math.floor(Math.random() * 30), Math.floor(Math.random() * 60));
      
      // 隨機生成是否在圍欄內
      const inPunchIsWithinFence = Math.random() > 0.1; // 90% 在圍欄內
      const outPunchIsWithinFence = Math.random() > 0.1; // 90% 在圍欄內
      
      // 隨機生成距離
      const inDistance = inPunchIsWithinFence ? Math.random() * 80 : 100 + Math.random() * 200;
      const outDistance = outPunchIsWithinFence ? Math.random() * 80 : 100 + Math.random() * 200;
      
      // 生成經緯度偏移
      const inLatOffset = (Math.random() * 0.002) - 0.001;
      const inLngOffset = (Math.random() * 0.002) - 0.001;
      const outLatOffset = (Math.random() * 0.002) - 0.001;
      const outLngOffset = (Math.random() * 0.002) - 0.001;
      
      // 生成上班卡記錄
      logs.push({
        logId: `log_in_${employee.id}_${day.toISOString().split('T')[0]}`,
        employeeId: employee.id,
        employeeName: employee.name,
        storeId: store.id,
        storeName: store.name,
        tenantId: 'tenant001',
        timestamp: punchInTime,
        type: 'punch-in',
        latitude: store.latitude + inLatOffset,
        longitude: store.longitude + inLngOffset,
        isWithinFence: inPunchIsWithinFence,
        distance: inDistance,
        source: 'mobile-app',
        createdAt: punchInTime,
      });
      
      // 生成下班卡記錄
      logs.push({
        logId: `log_out_${employee.id}_${day.toISOString().split('T')[0]}`,
        employeeId: employee.id,
        employeeName: employee.name,
        storeId: store.id,
        storeName: store.name,
        tenantId: 'tenant001',
        timestamp: punchOutTime,
        type: 'punch-out',
        latitude: store.latitude + outLatOffset,
        longitude: store.longitude + outLngOffset,
        isWithinFence: outPunchIsWithinFence,
        distance: outDistance,
        source: 'mobile-app',
        createdAt: punchOutTime,
      });
    });
  }
  
  // 加入一些手動調整的記錄
  const manualDate = new Date(now);
  manualDate.setDate(now.getDate() - 3);
  manualDate.setHours(12, 30, 0);
  
  logs.push({
    logId: `log_manual_${manualDate.toISOString().split('T')[0]}`,
    employeeId: 'emp005',
    employeeName: '林小玲',
    storeId: 'store003',
    storeName: '台北南港店',
    tenantId: 'tenant001',
    timestamp: manualDate,
    type: 'punch-in',
    latitude: mockStores[2].latitude,
    longitude: mockStores[2].longitude,
    isWithinFence: true,
    distance: 0,
    source: 'web-admin-manual',
    notes: '員工忘記打卡，主管手動新增',
    createdAt: manualDate,
    createdBy: 'admin001',
  });
  
  return logs;
};

// 模擬考勤記錄數據
const mockAttendanceLogs = generateMockAttendanceLogs();

// 獲取考勤記錄列表
export const getAttendanceLogs = async (params?: GetAttendanceLogsParams): Promise<AttendanceLogsResponse> => {
  try {
    // 注意：這是模擬數據，真實實現應使用API請求
    // 以下代碼應替換為: const response = await apiClient.get('/api/attendance/logs', { params });
    
    // 預設參數
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const startIndex = (page - 1) * limit;
    
    // 過濾記錄
    let filteredLogs = [...mockAttendanceLogs];
    
    // 按員工ID過濾
    if (params?.employeeId) {
      filteredLogs = filteredLogs.filter(log => log.employeeId === params.employeeId);
    }
    
    // 按分店ID過濾
    if (params?.storeId) {
      filteredLogs = filteredLogs.filter(log => log.storeId === params.storeId);
    }
    
    // 按打卡類型過濾
    if (params?.type) {
      filteredLogs = filteredLogs.filter(log => log.type === params.type);
    }
    
    // 按是否在範圍內過濾
    if (params?.isWithinFence !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.isWithinFence === params.isWithinFence);
    }
    
    // 按日期範圍過濾
    if (params?.startDate) {
      const startDate = new Date(params.startDate);
      startDate.setHours(0, 0, 0, 0);
      filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
    }
    
    if (params?.endDate) {
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate);
    }
    
    // 排序
    const sortField = params?.sort || 'timestamp';
    const sortOrder = params?.order || 'desc';
    
    filteredLogs.sort((a, b) => {
      // 使用安全的方法獲取屬性值進行排序
      const getFieldValue = (obj: AttendanceLog, field: string) => {
        if (field === 'timestamp' || field === 'createdAt' || field === 'updatedAt') {
          return obj[field as keyof AttendanceLog] as Date;
        }
        return String(obj[field as keyof AttendanceLog] || '');
      };
      
      const aValue = getFieldValue(a, sortField);
      const bValue = getFieldValue(b, sortField);
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    // 分頁
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + limit);
    
    // 模擬響應
    return {
      data: paginatedLogs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredLogs.length / limit),
        totalItems: filteredLogs.length
      }
    };
    
  } catch (error) {
    console.error('獲取考勤記錄列表失敗:', error);
    throw error;
  }
};

// 獲取單個考勤記錄詳情
export const getAttendanceLogById = async (logId: string): Promise<AttendanceLog> => {
  try {
    // 注意：這是模擬數據，真實實現應使用API請求
    // 以下代碼應替換為: const response = await apiClient.get(`/api/attendance/logs/${logId}`);
    
    const log = mockAttendanceLogs.find(log => log.logId === logId);
    
    if (!log) {
      throw new Error('考勤記錄不存在');
    }
    
    return log;
  } catch (error) {
    console.error(`獲取考勤記錄詳情失敗 (ID: ${logId}):`, error);
    throw error;
  }
};

// 導出模擬數據，方便組件開發時使用
export const getMockEmployees = () => mockEmployees;
export const getMockStores = () => mockStores; 