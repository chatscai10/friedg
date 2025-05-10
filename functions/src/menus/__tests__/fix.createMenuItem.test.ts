/**
 * 測試 menuItem.handlers.ts 中的 createMenuItem 函數
 */

// 模擬 firebase-admin
const serverTimestampMock = jest.fn().mockReturnValue('mocked_server_timestamp');
const mockSet = jest.fn().mockResolvedValue(true);
const mockGet = jest.fn();
const mockDoc = jest.fn().mockReturnValue({
  set: mockSet,
  get: mockGet,
  update: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true)
});

const mockCollection = jest.fn().mockImplementation(() => ({
  doc: mockDoc,
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  get: mockGet
}));

const mockDb = { collection: mockCollection };

// 必須提前模擬被測試模組依賴的模擬
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockDb),
  credential: {
    applicationDefault: jest.fn()
  }
}));

// 直接修改導入後的 admin 對象
const admin = require('firebase-admin');
// 添加 FieldValue.serverTimestamp
admin.firestore.FieldValue = {
  serverTimestamp: serverTimestampMock
};
// 添加 Timestamp 類別
admin.firestore.Timestamp = class Timestamp {
  seconds: number;
  nanoseconds: number;
  
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  
  toDate() {
    return new Date(this.seconds * 1000);
  }
};

// 模擬 uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-item-uuid-123')
}));

// 模擬 functions.logger
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// 導入被測試函數
import { createMenuItem } from '../menuItem.handlers';

describe('MenuItem Handlers - createMenuItem', () => {
  // 測試變數
  let mockRequest: any, mockResponse: any;
  let jsonSpy: jest.Mock, statusJsonSpy: jest.Mock;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testCategoryId = 'category-1';

  beforeEach(() => {
    // 清除所有模擬
    mockSet.mockClear();
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockGet.mockClear();
    
    // 建立模擬請求與響應
    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    
    mockRequest = {
      user: {
        uid: testUserId,
        tenantId: testTenantId,
        storeId: testStoreId,
        role: 'tenant_admin'
      },
      body: {
        name: '香炸雞腿',
        description: '香酥多汁的炸雞腿',
        categoryId: testCategoryId,
        price: 80,
        discountPrice: 70,
        imageUrl: 'http://example.com/chicken.jpg',
        stockStatus: 'in_stock',
        stockQuantity: 50
      }
    };
    
    mockResponse = {
      status: statusJsonSpy,
      json: jsonSpy
    };
  });

  // 測試案例1: 成功建立菜單項目
  test('成功建立菜單項目並返回201狀態', async () => {
    // 模擬類別存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });
    
    // 執行測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗證 Firestore 調用
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testCategoryId);
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith('test-item-uuid-123');
    expect(mockSet).toHaveBeenCalledTimes(1);
    
    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(201);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: expect.any(String)
    }));
  });

  // 測試案例2: 用戶缺少租戶ID
  test('用戶缺少租戶ID時返回403錯誤', async () => {
    // 修改請求，使用戶缺少租戶ID
    mockRequest.user = {
      uid: testUserId,
      role: 'tenant_admin'
      // 故意不設置tenantId
    };
    
    // 執行測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.any(String)
    }));
    
    // 不應該執行寫入操作
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案例3: 找不到指定的菜單分類
  test('找不到指定的菜單分類時返回404錯誤', async () => {
    // 設置 mockGet 返回不存在的分類
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // 執行測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.any(String)
    }));
    
    // 不應該執行寫入操作
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案例4: 租戶隔離 - 分類屬於不同租戶
  test('嘗試使用其他租戶的分類時返回403錯誤', async () => {
    // 設置 mockGet 返回屬於其他租戶的分類
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: 'other-tenant-id', // 不同的租戶ID
        name: 'Other Tenant Category'
      })
    });
    
    // 執行測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.any(String)
    }));
    
    // 不應該執行寫入操作
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案例5: 資料庫寫入失敗
  test('資料庫寫入失敗時返回500錯誤', async () => {
    // 模擬分類存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });
    
    // 模擬寫入失敗
    const testError = new Error('資料庫寫入失敗');
    mockSet.mockRejectedValueOnce(testError);
    
    // 執行測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.any(String)
    }));
  });

  // 測試案例6: 用戶未認證
  test('未認證的用戶請求返回401錯誤', async () => {
    // 修改請求，用戶未認證
    mockRequest.user = null;
    
    // 執行測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(401);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.any(String)
    }));
    
    // 不應該執行寫入操作
    expect(mockSet).not.toHaveBeenCalled();
  });
}); 