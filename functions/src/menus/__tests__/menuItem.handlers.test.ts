/**
 * 測試 menuItem.handlers.js 中的函數
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

// 模擬 count() 函數
const mockCount = jest.fn().mockReturnValue({
  get: jest.fn().mockResolvedValue({
    data: () => ({ count: 10 })
  })
});

// 模擬 Firestore 查詢函數
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockOffset = jest.fn().mockReturnThis();
let mockStartAfter;

const mockCollection = jest.fn().mockImplementation(() => ({
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  get: mockGet,
  limit: mockLimit,
  offset: mockOffset,
  count: mockCount,
  startAfter: mockStartAfter
}));

const mockDb = { collection: mockCollection };

// 模擬 Zod 驗證
const mockSafeParse = jest.fn();
const createMenuItemSchema = {
  safeParse: mockSafeParse
};

// 必須在被測試模塊之前進行模擬
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

// 準�?測試
// 不直?��??�express?�Request?�Response以避?��?上層變數衝�?
// const { Request, Response } = require('express');

describe('MenuItem Handlers - createMenuItem', () => {
  // 導入被測試�??��???
  let { createMenuItem } = require('../menuItem.handlers');

  // ?��?模�??��??��??�便?�們在測試?�修?�模?�實??
  const handlers = require('../menuItem.handlers');

  // 測試?��?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testCategoryId = 'category-1';

  beforeEach(() => {
    // 清�??�?�模??
    mockSet.mockClear();
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockGet.mockClear();
    mockSafeParse.mockReset();

    // 注入模擬?�createMenuItemSchema
    handlers.createMenuItemSchema = createMenuItemSchema;

    // ?�建模擬請�??�響??
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
        name: '脆皮雞腿',
        description: '香酥多汁，外酥內嫩',
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

    // 默�??��?下�?Zod驗�??��?
    mockSafeParse.mockReturnValue({
      success: true,
      data: mockRequest.body
    });
  });

  // 測試案例1: 成功創建菜單項目
  test('成功創建菜單項目並返回201狀態', async () => {
    // 模擬分類存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });

    // 模擬創建後的項目查詢
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 'test-item-uuid-123',
        name: '脆皮雞腿',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() }
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
      message: '菜單項目創建成功'
    }));
  });

  // 測試案例2: 用戶缺少租戶ID
  test('用戶缺少租戶ID時應返回403錯誤', async () => {
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
      message: '沒有權限：用戶缺少租戶ID'
    }));

    // 不應該執行寫入操作
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案例3: 驗證失敗
  test('輸入驗證失敗時應返回500錯誤', async () => {
    // 設置 Zod 驗證失敗
    mockSafeParse.mockReturnValue({
      success: false,
      error: {
        errors: [{ message: '菜單項目名稱不能為空' }]
      }
    });

    // 執行測試
    await createMenuItem(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺服器內部錯誤'
    }));

    // 不應該執行寫入操作
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案例4: 找不到指定的菜單分類
  test('找不到指定的菜單分類時應返回404錯誤', async () => {
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
      message: '指定的菜單分類不存在'
    }));

    // 不應該執行寫入操作
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案例5: 嘗試訪問其他租戶的菜單分類
  test('嘗試使用其他租戶的菜單分類時應返回403錯誤', async () => {
    // 設置 mockGet 返回其他租戶的分類
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: 'other-tenant-id', // 其他租戶
        name: 'Other Tenant Category'
      })
    });

    // 執行測試
    await createMenuItem(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '沒有權限：無法訪問其他租戶的菜單分類'
    }));

    // 不應該執行寫入操作
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案例6: 資料庫寫入錯誤
  test('資料庫寫入錯誤時應返回500錯誤', async () => {
    // 設置 mockGet 返回存在的分類
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });

    // 設置 mockSet 拋出異常
    const testError = new Error('資料庫寫入失敗');
    mockSet.mockRejectedValueOnce(testError);

    // 執行測試
    await createMenuItem(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺服器內部錯誤'
    }));
  });
});

describe('MenuItem Handlers - listMenuItems', () => {
  // 導入被測試的函數
  let { listMenuItems } = require('../menuItem.handlers');

  // 設置測試模擬
  beforeEach(() => {
    jest.clearAllMocks();

    // 設置 where, orderBy, limit, startAfter 等查詢模擬
    mockWhere.mockReturnThis();
    mockOrderBy.mockReturnThis();
    mockLimit.mockReturnThis();
    mockStartAfter = jest.fn().mockReturnThis();
    mockCollection.mockImplementation(() => ({
      doc: mockDoc,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      startAfter: mockStartAfter,
      get: mockGet
    }));
  });

  // 測試變量
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testCategoryId = 'category-1';

  // 創建常用的測試菜單項目數據
  const createTestMenuItem = (id, overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);

    return {
      id: id || `item-${Math.random().toString(36).substring(2, 7)}`,
      tenantId: testTenantId,
      name: `測試項目 ${id}`,
      description: `測試項目 ${id} 的描述`,
      categoryId: testCategoryId,
      categoryName: '主菜',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['熱門', '推薦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };

  const setupMockRequestResponse = (queryParams = {}) => {
    // 創建模擬請求和響應
    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn().mockReturnValue({ json: jsonSpy });

    mockRequest = {
      user: {
        uid: testUserId,
        tenantId: testTenantId,
        storeId: testStoreId,
        role: 'tenant_admin'
      },
      query: {
        limit: 20,
        ...queryParams
      }
    };

    mockResponse = {
      status: statusJsonSpy,
      json: jsonSpy
    };

    return { mockRequest, mockResponse };
  };

  // 測試案例1: 成功獲取菜單項目列表（無過濾條件）
  test('成功獲取菜單項目列表並返回200狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 創建測試數據
    const testItems = [
      createTestMenuItem('item-1'),
      createTestMenuItem('item-2'),
      createTestMenuItem('item-3')
    ];

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      forEach: (callback) => {
        testItems.forEach((item, index) => {
          callback({
            data: () => item,
            id: item.id
          });
        });
      }
    });

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證 Firestore 調用
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', testTenantId);
    expect(mockOrderBy).toHaveBeenCalledWith('categoryId', 'asc');
    expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
    expect(mockLimit).toHaveBeenCalledWith(20);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: {
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'item-1' }),
          expect.objectContaining({ id: 'item-2' }),
          expect.objectContaining({ id: 'item-3' })
        ]),
        pagination: {
          pageSize: 20,
          hasMore: false,
          lastVisible: expect.any(Object)
        }
      }
    });

    // 驗證返回的時間戳已格式化
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(typeof item.createdAt).toBe('string');
      expect(typeof item.updatedAt).toBe('string');
    });
  });

  // 測試案例2: 租戶隔離
  test('租戶隔離 - 只返回當前租戶的項目', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 創建測試數據 - 已經設置 Firestore 查詢返回當前租戶的項目
    const testItems = [
      createTestMenuItem('item-1', { tenantId: testTenantId }),
      createTestMenuItem('item-2', { tenantId: testTenantId })
    ];

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      forEach: (callback) => {
        testItems.forEach((item) => {
          callback({
            data: () => item,
            id: item.id
          });
        });
      }
    });

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證 Firestore 調用 - 檢查是否使用了租戶過濾
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', testTenantId);

    // 驗證響應 - 應只包含當前租戶的項目
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    expect(responseData.length).toBe(2);
    responseData.forEach(item => {
      expect(item.tenantId).toBe(testTenantId);
    });
  });

  // 測試案例3: 分頁邏輯 (limit)
  test('分頁邏輯 - 使用 limit 參數返回指定數量', async () => {
    // 設置每頁10項
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      limit: 10
    });

    // 創建 10 個測試項目
    const testItems = Array.from({ length: 10 }, (_, i) =>
      createTestMenuItem(`item-${i+1}`)
    );

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      forEach: (callback) => {
        testItems.forEach((item) => {
          callback({
            data: () => item,
            id: item.id
          });
        });
      }
    });

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證分頁參數
    expect(mockLimit).toHaveBeenCalledWith(10);

    // 驗證響應
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.items.length).toBe(10);
    expect(responseData.pagination).toEqual({
      pageSize: 10,
      hasMore: true,  // 因為返回了剛好等於 limit 的數量
      lastVisible: expect.any(Object)
    });
  });

  // 測試案例4: 分類ID過濾
  test('過濾條件 - 使用 categoryId 過濾', async () => {
    // 設置分類ID過濾
    const specificCategoryId = 'specific-category-id';
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      categoryId: specificCategoryId
    });

    // 創建測試數據（都屬於同一分類）
    const testItems = [
      createTestMenuItem('item-1', { categoryId: specificCategoryId }),
      createTestMenuItem('item-2', { categoryId: specificCategoryId })
    ];

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      forEach: (callback) => {
        testItems.forEach((item) => {
          callback({
            data: () => item,
            id: item.id
          });
        });
      }
    });

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證過濾條件
    expect(mockWhere).toHaveBeenCalledWith('categoryId', '==', specificCategoryId);

    // 驗證返回的數據都屬於同一分類
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(item.categoryId).toBe(specificCategoryId);
    });
  });

  // 測試案例5: 活動狀態過濾
  test('過濾條件 - 使用 isActive 過濾', async () => {
    // 設置只顯示活動狀態項目
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      isActive: 'true' // 查詢參數是字符串
    });

    // 創建測試數據（都是活動狀態）
    const testItems = [
      createTestMenuItem('item-1', { isActive: true }),
      createTestMenuItem('item-2', { isActive: true })
    ];

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      forEach: (callback) => {
        testItems.forEach((item) => {
          callback({
            data: () => item,
            id: item.id
          });
        });
      }
    });

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證過濾條件 - 字符串'true' 應轉為布爾值true
    expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);

    // 驗證返回的數據都是活動狀態
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(item.isActive).toBe(true);
    });
  });

  // 測試案例6: 庫存狀態過濾
  test('過濾條件 - 使用 stockStatus 過濾', async () => {
    // 設置只顯示特定庫存狀態的項目
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      stockStatus: 'low_stock'
    });

    // 創建測試數據（都是相同庫存狀態）
    const testItems = [
      createTestMenuItem('item-1', { stockStatus: 'low_stock' }),
      createTestMenuItem('item-2', { stockStatus: 'low_stock' })
    ];

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      forEach: (callback) => {
        testItems.forEach((item) => {
          callback({
            data: () => item,
            id: item.id
          });
        });
      }
    });

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證過濾條件
    expect(mockWhere).toHaveBeenCalledWith('stockStatus', '==', 'low_stock');

    // 驗證返回的數據都是特定庫存狀態
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(item.stockStatus).toBe('low_stock');
    });
  });

  // 測試案例7: 游標分頁
  test('游標分頁 - 使用 lastItemId 和 lastCategoryId 參數', async () => {
    // 設置游標分頁參數
    const lastItemId = 'last-item-id';
    const lastCategoryId = 'last-category-id';
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      lastItemId,
      lastCategoryId
    });

    // 創建測試數據 - 模擬上一頁最後一個項目
    const lastItem = createTestMenuItem(lastItemId, {
      categoryId: lastCategoryId,
      name: 'Last Item Name'
    });

    // 創建下一頁項目
    const nextPageItems = [
      createTestMenuItem('next-item-1'),
      createTestMenuItem('next-item-2')
    ];

    // 模擬獲取上一頁最後一個項目的查詢
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => lastItem
    });

    // 模擬下一頁查詢結果
    mockGet.mockResolvedValueOnce({
      forEach: (callback) => {
        nextPageItems.forEach((item) => {
          callback({
            data: () => item,
            id: item.id
          });
        });
      }
    });

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證是否正確獲取了上一頁最後一個項目
    expect(mockDoc).toHaveBeenCalledWith(lastItemId);

    // 驗證是否正確設置了startAfter
    expect(mockStartAfter).toHaveBeenCalledWith(lastCategoryId, lastItem.name);

    // 驗證返回的是下一頁數據
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    expect(responseData.length).toBe(2);
    expect(responseData[0].id).toBe('next-item-1');
    expect(responseData[1].id).toBe('next-item-2');
  });

  // 測試案例8: 空列表結果
  test('返回空列表 - 當查詢結果為空時', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 模擬 Firestore 查詢結果 - 空結果
    mockGet.mockResolvedValueOnce({
      forEach: () => {} // 空函數，不調用回調
    });

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: {
        items: [],
        pagination: {
          pageSize: 20,
          hasMore: false,
          lastVisible: null
        }
      }
    });
  });

  // 測試案例9: 無效庫存狀態值
  test('錯誤處理 - 無效庫存狀態值返回400錯誤', async () => {
    // 準備測試請求和響應 - 使用無效的庫存狀態值
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      stockStatus: 'invalid_status'
    });

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('無效的庫存狀態值')
    }));
  });

  // 測試案例10: 用戶缺少租戶ID
  test('錯誤處理 - 用戶缺少租戶ID時應返回500錯誤', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 修改請求，使用戶缺少租戶ID
    mockRequest.user = {
      uid: testUserId,
      role: 'tenant_admin'
      // 故意不設置tenantId
    };

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證響應 - 注意：當前實現是在500 錯誤中處理這種情況，未明確區分
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺服器內部錯誤'
    }));
  });

  // 測試案例11: Firestore 查詢失敗
  test('錯誤處理 - 當 Firestore 查詢失敗時應返回500錯誤', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 模擬 Firestore 查詢拋出異常
    const testError = new Error('資料庫查詢失敗');
    mockGet.mockRejectedValueOnce(testError);

    // 執行測試
    await listMenuItems(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺服器內部錯誤',
      error: '資料庫查詢失敗'
    }));
  });
});

describe('MenuItem Handlers - getMenuItemById', () => {
  // 導入被測試的函數
  let { getMenuItemById } = require('../menuItem.handlers');

  // 設置測試模擬
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 測試變量
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testItemId = 'test-item-id';

  // 創建測試菜單項目數據
  const createTestMenuItem = (overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);

    return {
      id: testItemId,
      tenantId: testTenantId,
      name: '測試項目',
      description: '測試項目的描述',
      categoryId: 'category-1',
      categoryName: '主菜',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['熱門', '推薦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };

  const setupMockRequestResponse = (params = {}) => {
    // 創建模擬請求和響應
    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn().mockReturnValue({ json: jsonSpy });

    mockRequest = {
      user: {
        uid: testUserId,
        tenantId: testTenantId,
        storeId: testStoreId,
        role: 'tenant_admin'
      },
      params: {
        itemId: testItemId,
        ...params
      }
    };

    mockResponse = {
      status: statusJsonSpy,
      json: jsonSpy
    };

    return { mockRequest, mockResponse };
  };

  // 測試案例1: 成功獲取菜單項目
  test('成功獲取菜單項目並返回200狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 創建測試數據
    const testItem = createTestMenuItem();

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });

    // 執行測試
    await getMenuItemById(mockRequest, mockResponse);

    // 驗證 Firestore 調用
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockGet).toHaveBeenCalled();

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        id: testItemId,
        name: '測試項目',
        tenantId: testTenantId
      })
    });

    // 驗證時間戳格式化
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(typeof responseData.createdAt).toBe('string');
    expect(typeof responseData.updatedAt).toBe('string');
  });

  // 測試案例2: 找不到指定的菜單項目
  test('找不到指定的菜單項目時應返回404狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 模擬 Firestore 查詢結果 - 不存在的項目
    mockGet.mockResolvedValueOnce({
      exists: false
    });

    // 執行測試
    await getMenuItemById(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '找不到指定的菜單項目'
    });
  });

  // 測試案例3: 租戶隔離 - 嘗試訪問其他租戶的菜單項目
  test('租戶隔離: 訪問其他租戶的菜單項目時應返回403狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 創建測試數據 - 屬於其他租戶
    const otherTenantItem = createTestMenuItem({
      tenantId: 'other-tenant-id'
    });

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantItem
    });

    // 執行測試
    await getMenuItemById(mockRequest, mockResponse);

    // 驗證租戶隔離檢查
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒有權限：無法訪問其他租戶的菜單項目'
    });
  });

  // 測試案例4: 請求缺少必要的項目ID
  test('缺少必要的項目ID時應返回400狀態', async () => {
    // 準備測試請求和響應，但不提供 itemId
    const { mockRequest, mockResponse } = setupMockRequestResponse({ itemId: undefined });

    // 執行測試
    await getMenuItemById(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '缺少必要的菜單項目ID參數'
    });
  });

  // 測試案例5: Firestore 查詢失敗
  test('Firestore 查詢失敗時應返回500狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 模擬 Firestore 查詢失敗
    const testError = new Error('資料庫查詢失敗');
    mockGet.mockRejectedValueOnce(testError);

    // 執行測試
    await getMenuItemById(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '伺服器內部錯誤',
      error: '資料庫查詢失敗'
    });
  });
});

describe('MenuItem Handlers - updateMenuItem', () => {
  // 導入被測試的函數
  let { updateMenuItem } = require('../menuItem.handlers');

  // 設置測試模擬
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 測試變量
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testItemId = 'test-item-id';
  const testCategoryId = 'category-1';
  const testNewCategoryId = 'category-2';

  // 創建測試菜單項目數據
  const createTestMenuItem = (overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);

    return {
      id: testItemId,
      tenantId: testTenantId,
      name: '測試項目',
      description: '測試項目的描述',
      categoryId: testCategoryId,
      categoryName: '主菜',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['熱門', '推薦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };

  const setupMockRequestResponse = (itemId = testItemId, updateData = {}) => {
    // 創建模擬請求和響應
    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn().mockReturnValue({ json: jsonSpy });

    mockRequest = {
      user: {
        uid: testUserId,
        tenantId: testTenantId,
        storeId: testStoreId,
        role: 'tenant_admin'
      },
      params: { itemId },
      body: updateData
    };

    mockResponse = {
      status: statusJsonSpy,
      json: jsonSpy
    };

    return { mockRequest, mockResponse };
  };

  // 測試案例1: 成功更新多個欄位
  test('成功更新多個欄位並返回200狀態', async () => {
    // 準備測試請求和響應 - 更改名稱和價格
    const updateData = {
      name: '更新後的名稱',
      price: 60
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);

    // 創建測試數據
    const testItem = createTestMenuItem();

    // 模擬 Firestore 查詢結果 - 項目存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });

    // 模擬更新操作
    const mockUpdate = jest.fn().mockResolvedValue(true);
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate
    });

    // 模擬項目更新後的數據
    const updatedItem = {
      ...testItem,
      ...updateData,
      updatedAt: new admin.firestore.Timestamp(Date.now() / 1000 + 100, 0) // 假設更新時間比創建時間晚
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => updatedItem
    });

    // 執行測試
    await updateMenuItem(mockRequest, mockResponse);

    // 驗證 Firestore 調用
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockGet).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();

    // 驗證更新數據
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).toHaveProperty('name', '更新後的名稱');
    expect(updateArg).toHaveProperty('price', 60);
    expect(updateArg).toHaveProperty('updatedAt');

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '菜單項目更新成功',
      data: expect.objectContaining({
        id: testItemId,
        name: '更新後的名稱',
        price: 60
      })
    });

    // 驗證時間戳格式化
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(typeof responseData.createdAt).toBe('string');
    expect(typeof responseData.updatedAt).toBe('string');
  });

  // 測試案例2: 找不到指定的菜單項目
  test('找不到指定的菜單項目時應返回404狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 模擬 Firestore 查詢結果 - 不存在的項目
    mockGet.mockResolvedValueOnce({
      exists: false
    });

    // 執行測試
    await updateMenuItem(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '找不到指定的菜單項目'
    });
  });

  // 測試案例3: 租戶隔離 - 嘗試更新其他租戶的菜單項目
  test('租戶隔離: 更新其他租戶的菜單項目時應返回403狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 創建測試數據 - 屬於其他租戶
    const otherTenantItem = createTestMenuItem({
      tenantId: 'other-tenant-id'
    });

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantItem
    });

    // 執行測試
    await updateMenuItem(mockRequest, mockResponse);

    // 驗證租戶隔離檢查
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒有權限：無法更新其他租戶的菜單項目'
    });
  });

  // 測試案例4: 更新CategoryID - 成功
  test('成功更新分類ID並同步更新分類名稱', async () => {
    // 準備測試數據 - 更新分類ID
    const updateData = {
      categoryId: testNewCategoryId
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);

    // 創建測試數據
    const testItem = createTestMenuItem();

    // 模擬 Firestore 查詢結果 - 項目存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });

    // 模擬新分類數據
    const newCategory = {
      id: testNewCategoryId,
      tenantId: testTenantId,
      name: '新分類名稱'
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => newCategory
    });

    // 模擬更新操作
    const mockUpdate = jest.fn().mockResolvedValue(true);
    mockDoc.mockReturnValueOnce({
      get: mockGet,
      update: mockUpdate
    }).mockReturnValueOnce({
      get: mockGet
    }).mockReturnValueOnce({
      get: mockGet,
      update: mockUpdate
    });

    // 模擬項目更新後的數據
    const updatedItem = {
      ...testItem,
      categoryId: testNewCategoryId,
      categoryName: '新分類名稱',
      updatedAt: new admin.firestore.Timestamp(Date.now() / 1000 + 100, 0)
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => updatedItem
    });

    // 執行測試
    await updateMenuItem(mockRequest, mockResponse);

    // 驗證 Firestore 調用
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockDoc).toHaveBeenCalledWith(testNewCategoryId);

    // 驗證更新數據包含categoryName
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).toHaveProperty('categoryId', testNewCategoryId);
    expect(updateArg).toHaveProperty('categoryName', '新分類名稱');

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '菜單項目更新成功',
      data: expect.objectContaining({
        categoryId: testNewCategoryId,
        categoryName: '新分類名稱'
      })
    });
  });

  // 測試案例5: 更新CategoryID - 找不到新分類
  test('更新分類ID時找不到新分類應返回404狀態', async () => {
    // 準備測試數據 - 不存在的分類ID
    const updateData = {
      categoryId: 'non-existent-category'
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);

    // 創建測試數據
    const testItem = createTestMenuItem();

    // 模擬 Firestore 查詢結果 - 項目存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });

    // 模擬新分類數據 - 不存在
    mockGet.mockResolvedValueOnce({
      exists: false
    });

    // 執行測試
    await updateMenuItem(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '指定更新的菜單分類不存在'
    });
  });

  // 測試案例6: 更新CategoryID - 其他租戶分類
  test('更新分類ID時使用其他租戶分類應返回403狀態', async () => {
    // 準備測試數據 - 其他租戶的分類ID
    const updateData = {
      categoryId: 'other-tenant-category'
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);

    // 創建測試數據
    const testItem = createTestMenuItem();

    // 模擬 Firestore 查詢結果 - 項目存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });

    // 模擬新分類數據 - 屬於其他租戶
    const otherTenantCategory = {
      id: 'other-tenant-category',
      tenantId: 'other-tenant-id',
      name: '其他租戶分類'
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantCategory
    });

    // 執行測試
    await updateMenuItem(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒有權限：無法使用其他租戶的菜單分類'
    });
  });

  // 測試案例7: Firestore 更新失敗
  test('Firestore 更新失敗時應返回500狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 創建測試數據
    const testItem = createTestMenuItem();

    // 模擬 Firestore 查詢結果 - 項目存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });

    // 模擬更新操作失敗
    const mockUpdate = jest.fn().mockRejectedValue(new Error('資料庫更新失敗'));
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate
    });

    // 執行測試
    await updateMenuItem(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '伺服器內部錯誤',
      error: '資料庫更新失敗'
    });
  });
});

describe('MenuItem Handlers - deleteMenuItem', () => {
  // 導入被測試的函數
  let { deleteMenuItem } = require('../menuItem.handlers');

  // 設置測試模擬
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 測試變量
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testUserId = 'test-user-123';
  const testItemId = 'test-item-id';

  // 創建測試菜單項目數據
  const createTestMenuItem = (overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);

    return {
      id: testItemId,
      tenantId: testTenantId,
      name: '測試項目',
      description: '測試項目的描述',
      categoryId: 'category-1',
      categoryName: '主菜',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['熱門', '推薦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };

  const setupMockRequestResponse = (itemId = testItemId) => {
    // 創建模擬請求和響應
    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn().mockReturnValue({ json: jsonSpy });

    mockRequest = {
      user: {
        uid: testUserId,
        tenantId: testTenantId,
        role: 'tenant_admin'
      },
      params: { itemId }
    };

    mockResponse = {
      status: statusJsonSpy,
      json: jsonSpy
    };

    return { mockRequest, mockResponse };
  };

  // 測試案例1: 成功刪除菜單項目
  test('成功刪除菜單項目並返回200狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 創建測試數據
    const testItem = createTestMenuItem();

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });

    // 模擬刪除操作
    const mockDelete = jest.fn().mockResolvedValue(true);
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });

    // 執行測試
    await deleteMenuItem(mockRequest, mockResponse);

    // 驗證 Firestore 調用
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockGet).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '菜單項目 test-item-id 已成功刪除'
    });
  });

  // 測試案例2: 找不到指定的菜單項目
  test('找不到指定的菜單項目時應返回404狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 模擬 Firestore 查詢結果 - 不存在的項目
    mockGet.mockResolvedValueOnce({
      exists: false
    });

    // 模擬刪除操作 (不應該被調用)
    const mockDelete = jest.fn();
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });

    // 執行測試
    await deleteMenuItem(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '找不到指定的菜單項目'
    });

    // 驗證 delete 方法未被調用
    expect(mockDelete).not.toHaveBeenCalled();
  });

  // 測試案例3: 租戶隔離 - 嘗試刪除其他租戶的菜單項目
  test('租戶隔離: 刪除其他租戶的菜單項目時應返回403狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 創建測試數據 - 屬於其他租戶
    const otherTenantItem = createTestMenuItem({
      tenantId: 'other-tenant-id'
    });

    // 模擬 Firestore 查詢結果
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantItem
    });

    // 模擬刪除操作 (不應該被調用)
    const mockDelete = jest.fn();
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });

    // 執行測試
    await deleteMenuItem(mockRequest, mockResponse);

    // 驗證租戶隔離檢查
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒有權限：無法刪除其他租戶的菜單項目'
    });

    // 驗證 delete 方法未被調用
    expect(mockDelete).not.toHaveBeenCalled();
  });

  // 測試案例4: Firestore 刪除失敗
  test('Firestore 刪除失敗時應返回500狀態', async () => {
    // 準備測試請求和響應
    const { mockRequest, mockResponse } = setupMockRequestResponse();

    // 創建測試數據
    const testItem = createTestMenuItem();

    // 模擬 Firestore 查詢結果 - 項目存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });

    // 模擬刪除操作失敗
    const mockDelete = jest.fn().mockRejectedValue(new Error('資料庫刪除失敗'));
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });

    // 執行測試
    await deleteMenuItem(mockRequest, mockResponse);

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '伺服器內部錯誤',
      error: '資料庫刪除失敗'
    });
  });
});
