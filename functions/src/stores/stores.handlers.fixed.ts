import { Request, Response } from 'express';
import { BusinessHours, convertArrayToBusinessHours, TimeRange, Coordinates } from '../../../src/types/core-params';
import { businessHoursSchema, coordinatesSchema } from '../../../src/validation/ValidationSchema';

// 店鋪模擬數據
const storesData = [
  {
    storeId: 'store_001',
    storeName: '中山區旗艦店',
    storeCode: 'TPE-ZS-001',
    address: '台北市中山區中山北路123號',
    phoneNumber: '02-2345-6789',
    contactPerson: '王經理',
    email: 'manager@example.com',
    tenantId: 'tenant_001',
    isActive: true,
    coords: {
      latitude: 25.053,
      longitude: 121.525,
      radius: 100
    },
    businessHours: {
      monday: [{ start: '09:00', end: '21:00' }],
      tuesday: [{ start: '09:00', end: '21:00' }],
      wednesday: [{ start: '09:00', end: '21:00' }],
      thursday: [{ start: '09:00', end: '21:00' }],
      friday: [{ start: '09:00', end: '21:00' }],
      saturday: [{ start: '10:00', end: '22:00' }],
      sunday: [{ start: '10:00', end: '22:00' }],
      holidays: [{ start: '10:00', end: '20:00' }]
    },
    attendanceSettings: {
      lateThresholdMinutes: 15,
      earlyThresholdMinutes: 10,
      flexTimeMinutes: 30,
      requireApprovalForCorrection: true,
      autoClockOutEnabled: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    updatedBy: 'system'
  },
  {
    storeId: 'store_002',
    storeName: '信義區分店',
    storeCode: 'TPE-XY-002',
    address: '台北市信義區信義路456號',
    phoneNumber: '02-8765-4321',
    contactPerson: '林經理',
    email: 'xinyi@example.com',
    tenantId: 'tenant_001',
    isActive: true,
    coords: {
      latitude: 25.033,
      longitude: 121.565,
      radius: 80
    },
    businessHours: {
      monday: [{ start: '10:00', end: '22:00' }],
      tuesday: [{ start: '10:00', end: '22:00' }],
      wednesday: [{ start: '10:00', end: '22:00' }],
      thursday: [{ start: '10:00', end: '22:00' }],
      friday: [{ start: '10:00', end: '22:00' }],
      saturday: [{ start: '10:00', end: '23:00' }],
      sunday: [{ start: '10:00', end: '23:00' }],
      holidays: [{ start: '10:00', end: '21:00' }]
    },
    attendanceSettings: {
      lateThresholdMinutes: 10,
      earlyThresholdMinutes: 5,
      flexTimeMinutes: 15,
      requireApprovalForCorrection: true,
      autoClockOutEnabled: false
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    updatedBy: 'system'
  }
];

/**
 * 獲取店鋪列表
 * GET /stores
 */
export const listStores = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 獲取查詢參數
    const { page = '1', limit = '10', isActive, search } = req.query;
    
    // 將頁碼和每頁數量轉換為數字
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    // 計算分頁偏移量
    const startIndex = (pageNum - 1) * limitNum;
    
    // 篩選店鋪（模擬數據庫查詢）
    let filteredStores = [...storesData];
    
    // 根據 isActive 篩選
    if (isActive !== undefined) {
      const isActiveValue = isActive === 'true';
      filteredStores = filteredStores.filter(store => store.isActive === isActiveValue);
    }
    
    // 根據 search 篩選（搜索店鋪名稱或地址）
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredStores = filteredStores.filter(store => 
        store.storeName.toLowerCase().includes(searchLower) || 
        store.address.toLowerCase().includes(searchLower)
      );
    }
    
    // 計算總數
    const total = filteredStores.length;
    
    // 切片獲取當前頁數據
    const paginatedStores = filteredStores.slice(startIndex, startIndex + limitNum);
    
    console.log(`獲取店鋪列表成功，返回 ${paginatedStores.length} 條數據`);
    
    // 返回結果
    return res.status(200).json({
      success: true,
      data: paginatedStores,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('獲取店鋪列表失敗:', error);
    return res.status(500).json({
      success: false,
      message: '獲取店鋪列表時發生錯誤',
      error: (error as Error).message
    });
  }
};

/**
 * 根據ID獲取店鋪詳情
 * GET /stores/:storeId
 */
export const getStoreById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    
    // 查找店鋪
    const store = storesData.find(s => s.storeId === storeId);
    
    if (!store) {
      return res.status(404).json({
        success: false,
        message: `找不到ID為 ${storeId} 的店鋪`
      });
    }
    
    console.log(`獲取店鋪 ${storeId} 詳情成功`);
    
    return res.status(200).json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error(`獲取店鋪 ${req.params.storeId} 詳情失敗:`, error);
    return res.status(500).json({
      success: false,
      message: '獲取店鋪詳情時發生錯誤',
      error: (error as Error).message
    });
  }
};

/**
 * 創建新店鋪
 * POST /stores
 */
export const createStore = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { 
      storeName, 
      storeCode, 
      address, 
      phoneNumber, 
      contactPerson, 
      email, 
      isActive = true,
      latitude,
      longitude
    } = req.body;
    
    // 基本驗證
    if (!storeName || !storeCode) {
      return res.status(400).json({
        success: false,
        message: '店鋪名稱和店鋪代碼不能為空'
      });
    }
    
    // 檢查店鋪代碼是否已存在
    const existingStore = storesData.find(s => s.storeCode === storeCode);
    if (existingStore) {
      return res.status(409).json({
        success: false,
        message: `店鋪代碼 ${storeCode} 已存在`
      });
    }
    
    // 生成店鋪 ID
    const storeId = `store_${Date.now()}`;
    
    // 取得模擬用戶上下文
    const userContext = {
      uid: 'user_001',
      tenantId: 'tenant_001'
    };
    
    // 創建默認營業時間
    const defaultBusinessHours: BusinessHours = {
      monday: [{ start: '09:00', end: '18:00' }],
      tuesday: [{ start: '09:00', end: '18:00' }],
      wednesday: [{ start: '09:00', end: '18:00' }],
      thursday: [{ start: '09:00', end: '18:00' }],
      friday: [{ start: '09:00', end: '18:00' }],
      saturday: [],
      sunday: [],
      holidays: []
    };
    
    // 處理座標資訊
    let coords = null;
    if (latitude !== undefined && longitude !== undefined) {
      coords = {
        latitude, 
        longitude,
        radius: 100 // 默認半徑
      };
    }
    
    // 創建新店鋪
    const newStore = {
      storeId,
      storeName,
      storeCode,
      address,
      phoneNumber,
      contactPerson,
      email,
      tenantId: userContext.tenantId,
      isActive,
      coords,
      businessHours: defaultBusinessHours,
      attendanceSettings: {
        lateThresholdMinutes: 15,
        earlyThresholdMinutes: 10,
        flexTimeMinutes: 30,
        requireApprovalForCorrection: true,
        autoClockOutEnabled: false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userContext.uid,
      updatedBy: userContext.uid
    };
    
    // 保存到數據庫 (模擬)
    storesData.push(newStore);
    
    console.log(`成功創建店鋪 ${storeId}`);
    
    return res.status(201).json({
      success: true,
      message: '成功創建店鋪',
      data: newStore
    });
  } catch (error) {
    console.error('創建店鋪失敗:', error);
    return res.status(500).json({
      success: false,
      message: '創建店鋪時發生錯誤',
      error: (error as Error).message
    });
  }
};

/**
 * 更新店鋪地理位置
 * PUT /stores/:storeId/location
 */
export const updateStoreLocation = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    const { latitude, longitude, radius } = req.body;
    
    // 基本驗證
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: '緯度和經度為必填項'
      });
    }
    
    // 驗證經緯度範圍
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: '緯度應在-90到90之間，經度應在-180到180之間'
      });
    }
    
    // 創建標準座標物件
    const coords: Coordinates = { 
      latitude, 
      longitude, 
      radius: radius || 100 // 默認半徑為100米 
    };
    
    try {
      // 驗證座標格式
      coordinatesSchema.parse(coords);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: '座標格式不正確',
        error: (validationError as Error).message
      });
    }
    
    // 查找店鋪
    const storeIndex = storesData.findIndex(s => s.storeId === storeId);
    
    if (storeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `找不到ID為 ${storeId} 的店鋪`
      });
    }
    
    // 獲取當前店鋪
    const store = { ...storesData[storeIndex] };
    
    // 更新地理位置
    const updatedStore = {
      ...store,
      coords, // 使用新的標準格式
      geolocation: null, // 移除舊格式
      updatedAt: new Date().toISOString(),
      updatedBy: 'user_001' // 模擬用戶ID
    };
    
    // 保存更新後的店鋪 (模擬)
    storesData[storeIndex] = updatedStore;
    
    console.log(`成功更新店鋪 ${storeId} 地理位置`);
    
    return res.status(200).json({
      success: true,
      message: '成功更新店鋪地理位置',
      data: {
        storeId,
        coords: updatedStore.coords
      }
    });
  } catch (error) {
    console.error(`更新店鋪 ${req.params.storeId} 地理位置失敗:`, error);
    return res.status(500).json({
      success: false,
      message: '更新店鋪地理位置時發生錯誤',
      error: (error as Error).message
    });
  }
};

/**
 * 更新店鋪營業時間
 * PUT /stores/:storeId/business-hours
 */
export const updateStoreBusinessHours = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { storeId } = req.params;
    const rawBusinessHours = req.body;
    
    // 基本驗證
    if (!rawBusinessHours) {
      return res.status(400).json({
        success: false,
        message: '營業時間不能為空'
      });
    }
    
    // 處理營業時間格式
    let businessHours: BusinessHours;
    if (Array.isArray(rawBusinessHours)) {
      // 舊版陣列格式 → 新版物件格式
      businessHours = convertArrayToBusinessHours(rawBusinessHours);
    } else {
      businessHours = rawBusinessHours;
      
      // 檢查並修正格式問題（如 open/close 改為 start/end）
      Object.entries(businessHours).forEach(([day, timeRanges]: [string, any[]]) => {
        if (timeRanges && Array.isArray(timeRanges)) {
          timeRanges.forEach((range, index) => {
            if (range.open && range.close) {
              (businessHours as any)[day][index] = {
                start: range.open,
                end: range.close
              };
            }
          });
        }
      });
    }
    
    try {
      // 驗證格式合法性
      businessHoursSchema.parse(businessHours);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: '營業時間格式不正確',
        error: (validationError as Error).message
      });
    }
    
    // 查找店鋪
    const storeIndex = storesData.findIndex(s => s.storeId === storeId);
    
    if (storeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `找不到ID為 ${storeId} 的店鋪`
      });
    }
    
    // 獲取當前店鋪
    const store = { ...storesData[storeIndex] };
    
    // 更新營業時間
    const updatedStore = {
      ...store,
      businessHours,
      updatedAt: new Date().toISOString(),
      updatedBy: 'user_001' // 模擬用戶ID
    };
    
    // 保存更新後的店鋪 (模擬)
    storesData[storeIndex] = updatedStore;
    
    console.log(`成功更新店鋪 ${storeId} 營業時間`);
    
    return res.status(200).json({
      success: true,
      message: '成功更新店鋪營業時間',
      data: {
        storeId,
        businessHours: updatedStore.businessHours
      }
    });
  } catch (error) {
    console.error(`更新店鋪 ${req.params.storeId} 營業時間失敗:`, error);
    return res.status(500).json({
      success: false,
      message: '更新店鋪營業時間時發生錯誤',
      error: (error as Error).message
    });
  }
}; 