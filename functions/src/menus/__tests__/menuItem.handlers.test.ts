/**
 * 測試 menuItem.handlers.js 中�??��?
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

// 模擬 count() ?��?
const mockCount = jest.fn().mockReturnValue({
  get: jest.fn().mockResolvedValue({
    data: () => ({ count: 10 })
  })
});

// 模擬 Firestore ?�詢?��?
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

// 模擬 Zod 驗�?
const mockSafeParse = jest.fn();
const createMenuItemSchema = {
  safeParse: mockSafeParse
};

// 必�??��??�被測試模�?之�??��?模擬
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockDb),
  credential: {
    applicationDefault: jest.fn()
  }
}));

// ?�接修改導入後�? admin 對象
const admin = require('firebase-admin');
// 添�? FieldValue.serverTimestamp
admin.firestore.FieldValue = {
  serverTimestamp: serverTimestampMock
};
// 添�? Timestamp 類�?
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
        name: '?�皮?��?',
        description: '香�?多�??��??��???,
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

  // 測試案�?1: ?��??�建?�單?��?
  test('?��??�建?�單?��?並�???01?�??, async () => {
    // 模擬?��?存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });
    
    // 模擬?�建後�??�目?�詢
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 'test-item-uuid-123',
        name: '?�皮?��?',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() }
      })
    });
    
    // ?��?測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗�? Firestore ?��?
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testCategoryId);
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith('test-item-uuid-123');
    expect(mockSet).toHaveBeenCalledTimes(1);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(201);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: '?�單?�目?�建?��?'
    }));
  });

  // 測試案�?2: ?�戶缺�?租戶ID
  test('?�用?�缺少�??�ID?��?返�?403?�誤', async () => {
    // 修改請�?，使?�戶缺�?租戶ID
    mockRequest.user = {
      uid: testUserId,
      role: 'tenant_admin'
      // ?��?不設�?tenantId
    };
    
    // ?��?測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '沒�?權�?：用?�缺少�??�ID'
    }));
    
    // 不�?該執行寫?��?�?
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案�?3: 驗�?失�?
  test('?�輸?��?證失?��??��???00?�誤', async () => {
    // 設置 Zod 驗�?失�?
    mockSafeParse.mockReturnValue({
      success: false,
      error: {
        errors: [{ message: '?�單?�目?�稱不能?�空' }]
      }
    });
    
    // ?��?測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺�??�內?�錯�?
    }));
    
    // 不�?該執行寫?��?�?
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案�?4: ?��??��?定�??�單?��?
  test('?�找不到?��??��??��?類�??��???04?�誤', async () => {
    // 設置 mockGet 返�?不�??��??��?
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // ?��?測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '?��??��??��?類�?存在'
    }));
    
    // 不�?該執行寫?��?�?
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案�?5: ?�試訪�??��?租戶?��??��?�?
  test('?��?試使?�其他�??��??�單?��??��?返�?403?�誤', async () => {
    // 設置 mockGet 返�??��?租戶?��?�?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: 'other-tenant-id', // ?��?租戶
        name: 'Other Tenant Category'
      })
    });
    
    // ?��?測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '沒�?權�?：無法訪?�其他�??��??�單?��?'
    }));
    
    // 不�?該執行寫?��?�?
    expect(mockSet).not.toHaveBeenCalled();
  });

  // 測試案�?6: ?��?庫寫?�錯�?
  test('?�數?�庫寫入?�誤?��?返�?500?�誤', async () => {
    // 設置 mockGet 返�??��??��?�?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });
    
    // 設置 mockSet ?�出?�常
    const testError = new Error('?��?庫寫?�失??);
    mockSet.mockRejectedValueOnce(testError);
    
    // ?��?測試
    await createMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺�??�內?�錯�?
    }));
  });
});

describe('MenuItem Handlers - listMenuItems', () => {
  // 導入被測試�??��???
  let { listMenuItems } = require('../menuItem.handlers');
  
  // ?�置?�?�模??
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 設置 where, orderBy, limit, startAfter ?��??��?設模??
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
  
  // 測試?��?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testCategoryId = 'category-1';
  
  // ?�建常�??�測試�??��??�數??
  const createTestMenuItem = (id, overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
    
    return {
      id: id || `item-${Math.random().toString(36).substring(2, 7)}`,
      tenantId: testTenantId,
      name: `測試?��? ${id}`,
      description: `測試?��? ${id} ?��?述`,
      categoryId: testCategoryId,
      categoryName: '主�?',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['?��?', '?�薦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };
  
  const setupMockRequestResponse = (queryParams = {}) => {
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
  
  // 測試案�?1: ?��??��??�單?��??�表（無?�濾條件�?
  test('?��??��??�單?��??�表並�???00?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?�建測試?��?
    const testItems = [
      createTestMenuItem('item-1'),
      createTestMenuItem('item-2'),
      createTestMenuItem('item-3')
    ];
    
    // 模擬 Firestore ?�詢結�?
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
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�? Firestore ?��?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', testTenantId);
    expect(mockOrderBy).toHaveBeenCalledWith('categoryId', 'asc');
    expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
    expect(mockLimit).toHaveBeenCalledWith(20);
    
    // 驗�??��?
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
    
    // 驗�?返�??��??��??�戳已格式�?
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(typeof item.createdAt).toBe('string');
      expect(typeof item.updatedAt).toBe('string');
    });
  });
  
  // 測試案�?2: 租戶?�離
  test('租戶?�離 - ?��??�當?��??��??��?', async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?�建測試?��? - 已�??�設 Firestore ?�詢?��??�當?��??��??�目
    const testItems = [
      createTestMenuItem('item-1', { tenantId: testTenantId }),
      createTestMenuItem('item-2', { tenantId: testTenantId })
    ];
    
    // 模擬 Firestore ?�詢結�?
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
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�? Firestore ?��? - 檢查?�否?�用了�??��???
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', testTenantId);
    
    // 驗�??��? - ?�只?�含?��?租戶?��???
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    expect(responseData.length).toBe(2);
    responseData.forEach(item => {
      expect(item.tenantId).toBe(testTenantId);
    });
  });
  
  // 測試案�?3: ?��??�輯 (limit)
  test('?��??�輯 - ?��? limit ?�數返�?�?��?�數??, async () => {
    // ?�置每�?10??
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      limit: 10
    });
    
    // ?�建 10 ?�測試�???
    const testItems = Array.from({ length: 10 }, (_, i) => 
      createTestMenuItem(`item-${i+1}`)
    );
    
    // 模擬 Firestore ?�詢結�?
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
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�??��??�數
    expect(mockLimit).toHaveBeenCalledWith(10);
    
    // 驗�??��?
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.items.length).toBe(10);
    expect(responseData.pagination).toEqual({
      pageSize: 10,
      hasMore: true,  // ?�為返�?了�?好�???limit ?��??�數
      lastVisible: expect.any(Object)
    });
  });
  
  // 測試案�?4: ?��?類ID?�濾
  test('?�濾條件 - ?��? categoryId ?�濾', async () => {
    // ?�置?��?類ID?�濾
    const specificCategoryId = 'specific-category-id';
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      categoryId: specificCategoryId
    });
    
    // ?�建測試?��?（都屬於?��??��?�?
    const testItems = [
      createTestMenuItem('item-1', { categoryId: specificCategoryId }),
      createTestMenuItem('item-2', { categoryId: specificCategoryId })
    ];
    
    // 模擬 Firestore ?�詢結�?
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
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�??�濾條件
    expect(mockWhere).toHaveBeenCalledWith('categoryId', '==', specificCategoryId);
    
    // 驗�?返�??�數?�都屬於?��??��?
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(item.categoryId).toBe(specificCategoryId);
    });
  });
  
  // 測試案�?5: ?��??��??��?�?
  test('?�濾條件 - ?��? isActive ?�濾', async () => {
    // ?�置?�顯示�??��??��?
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      isActive: 'true' // ?�詢?�數?��?符串
    });
    
    // ?�建測試?��?（都?��??��??��?
    const testItems = [
      createTestMenuItem('item-1', { isActive: true }),
      createTestMenuItem('item-2', { isActive: true })
    ];
    
    // 模擬 Firestore ?�詢結�?
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
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�??�濾條件 - 字符�?'true' ?��??�為布爾??true
    expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
    
    // 驗�?返�??�數?�都?��??��???
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(item.isActive).toBe(true);
    });
  });
  
  // 測試案�?6: ?�庫存�??��?�?
  test('?�濾條件 - ?��? stockStatus ?�濾', async () => {
    // ?�置?�顯示特定庫存�??��??��?
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      stockStatus: 'low_stock'
    });
    
    // ?�建測試?��?（都?�相?�庫存�??��?
    const testItems = [
      createTestMenuItem('item-1', { stockStatus: 'low_stock' }),
      createTestMenuItem('item-2', { stockStatus: 'low_stock' })
    ];
    
    // 模擬 Firestore ?�詢結�?
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
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�??�濾條件
    expect(mockWhere).toHaveBeenCalledWith('stockStatus', '==', 'low_stock');
    
    // 驗�?返�??�數?�都?�特定庫存�???
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(item.stockStatus).toBe('low_stock');
    });
  });
  
  // 測試案�?7: 游�??��?
  test('游�??��? - 使用 lastItemId ??lastCategoryId ?�數', async () => {
    // 設置游�??��??�數
    const lastItemId = 'last-item-id';
    const lastCategoryId = 'last-category-id';
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      lastItemId,
      lastCategoryId
    });
    
    // ?�建測試?��? - 模擬?�後�??��???
    const lastItem = createTestMenuItem(lastItemId, { 
      categoryId: lastCategoryId,
      name: 'Last Item Name'
    });
    
    // ?�建下�??��??�目
    const nextPageItems = [
      createTestMenuItem('next-item-1'),
      createTestMenuItem('next-item-2')
    ];
    
    // 模擬?��?上�??��?後�??��??��??��?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => lastItem
    });
    
    // 模擬下�??�查詢�???
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
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�??�否�?��?��?了�?一?��?後�??��???
    expect(mockDoc).toHaveBeenCalledWith(lastItemId);
    
    // 驗�??�否�?��設置�?startAfter
    expect(mockStartAfter).toHaveBeenCalledWith(lastCategoryId, lastItem.name);
    
    // 驗�?返�??�是下�??��??��?
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    expect(responseData.length).toBe(2);
    expect(responseData[0].id).toBe('next-item-1');
    expect(responseData[1].id).toBe('next-item-2');
  });
  
  // 測試案�?8: 空�?表�?�?
  test('返�?空�?�?- ?�查詢�??�為空�?', async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // 模擬 Firestore ?�詢結�? - 空�?�?
    mockGet.mockResolvedValueOnce({
      forEach: () => {} // 空函?��?不調?��?�?
    });
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�??��?
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
  
  // 測試案�?9: ?��??�庫存�??��?
  test('?�誤?��? - ?��??�庫存�??�值�???00?�誤', async () => {
    // 準�?測試請�??�響??- 使用?��??�庫存�??��?
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      stockStatus: 'invalid_status'
    });
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('?��??�庫存�??��?)
    }));
  });
  
  // 測試案�?10: ?�戶缺�?租戶ID
  test('?�誤?��? - ?�用?�缺少�??�ID?��?返�?500?�誤', async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // 修改請�?，使?�戶缺�?租戶ID
    mockRequest.user = {
      uid: testUserId,
      role: 'tenant_admin'
      // ?��?不設�?tenantId
    };
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�??��? - 注�?：當?�實?�是??500 ?�誤中�??�這種?��?，未?�確?��?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺�??�內?�錯�?
    }));
  });
  
  // 測試案�?11: Firestore ?�詢失�?
  test('?�誤?��? - ??Firestore ?�詢失�??��?返�?500?�誤', async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // 模擬 Firestore ?�詢?�出?�常
    const testError = new Error('?��?庫查詢失??);
    mockGet.mockRejectedValueOnce(testError);
    
    // ?��?測試
    await listMenuItems(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺�??�內?�錯�?,
      error: '?��?庫查詢失??
    }));
  });
});

describe('MenuItem Handlers - getMenuItemById', () => {
  // 導入被測試�??��???
  let { getMenuItemById } = require('../menuItem.handlers');
  
  // ?�置?�?�模??
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // 測試?��?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testItemId = 'test-item-id';
  
  // ?�建測試?�單?��??��?
  const createTestMenuItem = (overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
    
    return {
      id: testItemId,
      tenantId: testTenantId,
      name: '測試?��?',
      description: '測試?��??��?�?,
      categoryId: 'category-1',
      categoryName: '主�?',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['?��?', '?�薦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };
  
  const setupMockRequestResponse = (params = {}) => {
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
  
  // 測試案�?1: ?��??��??�單?��?
  test('?��??��??�單?��?並�???00?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?�建測試?��?
    const testItem = createTestMenuItem();
    
    // 模擬 Firestore ?�詢結�?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // ?��?測試
    await getMenuItemById(mockRequest, mockResponse);
    
    // 驗�? Firestore ?��?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockGet).toHaveBeenCalled();
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        id: testItemId,
        name: '測試?��?',
        tenantId: testTenantId
      })
    });
    
    // 驗�??��??�格式�?
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(typeof responseData.createdAt).toBe('string');
    expect(typeof responseData.updatedAt).toBe('string');
  });
  
  // 測試案�?2: ?��??��?定�??�單?��?
  test('?��??��?定�??�單?��??��???04?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // 模擬 Firestore ?�詢結�? - 不�??��??��?
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // ?��?測試
    await getMenuItemById(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '?��??��?定�??�單?�目'
    });
  });
  
  // 測試案�?3: 租戶?�離 - ?�試訪�??��?租戶?��??��???
  test('租戶?�離: 訪�??��?租戶?��??��??��?返�?403?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?�建測試?��? - 屬於?��?租戶
    const otherTenantItem = createTestMenuItem({
      tenantId: 'other-tenant-id'
    });
    
    // 模擬 Firestore ?�詢結�?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantItem
    });
    
    // ?��?測試
    await getMenuItemById(mockRequest, mockResponse);
    
    // 驗�?租戶?�離檢查
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒�?權�?：無法訪?�其他�??��??�單?�目'
    });
  });
  
  // 測試案�?4: 請�?缺�?必�??��???ID
  test('缺�?必�??��??�ID?��???00?�??, async () => {
    // 準�?測試請�??�響?��?但�??��? itemId
    const { mockRequest, mockResponse } = setupMockRequestResponse({ itemId: undefined });
    
    // ?��?測試
    await getMenuItemById(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '缺�?必�??��??��??�ID?�數'
    });
  });
  
  // 測試案�?5: Firestore ?�詢失�?
  test('Firestore ?�詢失�??��???00?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // 模擬 Firestore ?�詢失�?
    const testError = new Error('?��?庫查詢失??);
    mockGet.mockRejectedValueOnce(testError);
    
    // ?��?測試
    await getMenuItemById(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '伺�??�內?�錯�?,
      error: '?��?庫查詢失??
    });
  });
});

describe('MenuItem Handlers - updateMenuItem', () => {
  // 導入被測試�??��???
  let { updateMenuItem } = require('../menuItem.handlers');
  
  // ?�置?�?�模??
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // 測試?��?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testItemId = 'test-item-id';
  const testCategoryId = 'category-1';
  const testNewCategoryId = 'category-2';
  
  // ?�建測試?�單?��??��?
  const createTestMenuItem = (overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
    
    return {
      id: testItemId,
      tenantId: testTenantId,
      name: '測試?��?',
      description: '測試?��??��?�?,
      categoryId: testCategoryId,
      categoryName: '主�?',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['?��?', '?�薦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };
  
  const setupMockRequestResponse = (itemId = testItemId, updateData = {}) => {
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
      params: { itemId },
      body: updateData
    };
    
    mockResponse = {
      status: statusJsonSpy,
      json: jsonSpy
    };
    
    return { mockRequest, mockResponse };
  };
  
  // 測試案�?1: ?��??�新?��?欄�?
  test('?��??�新?��?欄�?並�???00?�??, async () => {
    // 準�?測試請�??�響??- ?�更?��?稱�??�格
    const updateData = {
      name: '?�新?��??��?�?,
      price: 60
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);
    
    // ?�建測試?��?
    const testItem = createTestMenuItem();
    
    // 模擬 Firestore ?�詢結�? - ?��??��??��?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // 模擬?�新?��?
    const mockUpdate = jest.fn().mockResolvedValue(true);
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate
    });
    
    // 模擬?��??�新後�??��?
    const updatedItem = {
      ...testItem,
      ...updateData,
      updatedAt: new admin.firestore.Timestamp(Date.now() / 1000 + 100, 0) // ?�設?�新?��?比創建�??��?
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => updatedItem
    });
    
    // ?��?測試
    await updateMenuItem(mockRequest, mockResponse);
    
    // 驗�? Firestore ?��?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockGet).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    
    // 驗�??�新?��?
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).toHaveProperty('name', '?�新?��??��?�?);
    expect(updateArg).toHaveProperty('price', 60);
    expect(updateArg).toHaveProperty('updatedAt');
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '?�單?��??�新?��?',
      data: expect.objectContaining({
        id: testItemId,
        name: '?�新?��??��?�?,
        price: 60
      })
    });
    
    // 驗�??��??�格式�?
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(typeof responseData.createdAt).toBe('string');
    expect(typeof responseData.updatedAt).toBe('string');
  });
  
  // 測試案�?2: ?��??��?定�??�單?��?
  test('?��??��?定�??�單?��??��???04?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // 模擬 Firestore ?�詢結�? - 不�??��??��?
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // ?��?測試
    await updateMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '?��??��?定�??�單?��?'
    });
  });
  
  // 測試案�?3: 租戶?�離 - ?�試?�新?��?租戶?��??��???
  test('租戶?�離: ?�新?��?租戶?��??��??��?返�?403?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?�建測試?��? - 屬於?��?租戶
    const otherTenantItem = createTestMenuItem({
      tenantId: 'other-tenant-id'
    });
    
    // 模擬 Firestore ?�詢結�?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantItem
    });
    
    // ?��?測試
    await updateMenuItem(mockRequest, mockResponse);
    
    // 驗�?租戶?�離檢查
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒�?權�?：無法更?�其他�??��??�單?��?'
    });
  });
  
  // 測試案�?4: ?�新CategoryID - ?��?
  test('?��??�新?��?ID並�?步更?��?類�?�?, async () => {
    // 準�?測試?��? - ?�新?��?ID
    const updateData = {
      categoryId: testNewCategoryId
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);
    
    // ?�建測試?��?
    const testItem = createTestMenuItem();
    
    // 模擬 Firestore ?�詢結�? - ?��??��??��?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // 模擬?��??��?�?
    const newCategory = {
      id: testNewCategoryId,
      tenantId: testTenantId,
      name: '?��?類�?�?
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => newCategory
    });
    
    // 模擬?�新?��?
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
    
    // 模擬?��??�新後�??��?
    const updatedItem = {
      ...testItem,
      categoryId: testNewCategoryId,
      categoryName: '?��?類�?�?,
      updatedAt: new admin.firestore.Timestamp(Date.now() / 1000 + 100, 0)
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => updatedItem
    });
    
    // ?��?測試
    await updateMenuItem(mockRequest, mockResponse);
    
    // 驗�? Firestore ?��?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockDoc).toHaveBeenCalledWith(testNewCategoryId);
    
    // 驗�??�新?��??�含categoryName
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).toHaveProperty('categoryId', testNewCategoryId);
    expect(updateArg).toHaveProperty('categoryName', '?��?類�?�?);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '?�單?��??�新?��?',
      data: expect.objectContaining({
        categoryId: testNewCategoryId,
        categoryName: '?��?類�?�?
      })
    });
  });
  
  // 測試案�?5: ?�新CategoryID - ?��??�新?��?
  test('?�新?��?ID?�找不到?��?類�???04?�??, async () => {
    // 準�?測試?��? - ?��??��?類ID
    const updateData = {
      categoryId: 'non-existent-category'
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);
    
    // ?�建測試?��?
    const testItem = createTestMenuItem();
    
    // 模擬 Firestore ?�詢結�? - ?��??��??��?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // 模擬?��??��?�?- 不�???
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // ?��?測試
    await updateMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '?��??�新?�單?��?不�???
    });
  });
  
  // 測試案�?6: ?�新CategoryID - ?��?租戶?��?�?
  test('?�新?��?ID?�使?�其他�??��??��?返�?403?�??, async () => {
    // 準�?測試?��? - ?��?租戶?��?類ID
    const updateData = {
      categoryId: 'other-tenant-category'
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);
    
    // ?�建測試?��?
    const testItem = createTestMenuItem();
    
    // 模擬 Firestore ?�詢結�? - ?��??��??��?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // 模擬?��??��?�?- 屬於?��?租戶
    const otherTenantCategory = {
      id: 'other-tenant-category',
      tenantId: 'other-tenant-id',
      name: '?��?租戶?��?�?
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantCategory
    });
    
    // ?��?測試
    await updateMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒�?權�?：無法使?�其他�??��??�單?��?'
    });
  });
  
  // 測試案�?7: Firestore ?�新失�?
  test('Firestore ?�新失�??��???00?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    //
    const testItem = createTestMenuItem();
    
    // 模擬 Firestore ?�詢結�? - ?��?存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // 模擬?�新?��?失�?
    const mockUpdate = jest.fn().mockRejectedValue(new Error('?��?庫更?�失??));
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate
    });
    
    // ?��?測試
    await updateMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '伺�??�內?�錯�?,
      error: '?��?庫更?�失??
    });
  });
});

describe('MenuItem Handlers - deleteMenuItem', () => {
  // 導入被測試�??��???
  let { deleteMenuItem } = require('../menuItem.handlers');
  
  // ?�置?�?�模??
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // 測試?��?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testUserId = 'test-user-123';
  const testItemId = 'test-item-id';
  
  // ?�建測試?�單?��??��?
  const createTestMenuItem = (overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
    
    return {
      id: testItemId,
      tenantId: testTenantId,
      name: '測試?��?',
      description: '測試?��??��?�?,
      categoryId: 'category-1',
      categoryName: '主�?',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['?��?', '?�薦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };
  
  const setupMockRequestResponse = (itemId = testItemId) => {
    // ?�建模擬請�??�響??
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
  
  // 測試案�?1: ?��??�除?�單?��?
  test('?��??�除?�單?��?並�???00?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?�建測試?��?
    const testItem = createTestMenuItem();
    
    // 模擬 Firestore ?�詢結�?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // 模擬?�除?��?
    const mockDelete = jest.fn().mockResolvedValue(true);
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });
    
    // ?��?測試
    await deleteMenuItem(mockRequest, mockResponse);
    
    // 驗�? Firestore ?��?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockGet).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '?�單?�目 test-item-id 已�??�刪??
    });
  });
  
  // 測試案�?2: ?��??��?定�??�單?��?
  test('?��??��?定�??�單?��??��???04?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // 模擬 Firestore ?�詢結�? - 不�??��??��?
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // 模擬?�除?��? (不�?該被調用)
    const mockDelete = jest.fn();
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });
    
    // ?��?測試
    await deleteMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '?��??��?定�??�單?��?'
    });
    
    // 驗�? delete ?��??�被調用
    expect(mockDelete).not.toHaveBeenCalled();
  });
  
  // 測試案�?3: 租戶?�離 - ?�試?�除?��?租戶?��??��???
  test('租戶?�離: ?�除?��?租戶?��??��??��?返�?403?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?�建測試?��? - 屬於?��?租戶
    const otherTenantItem = createTestMenuItem({
      tenantId: 'other-tenant-id'
    });
    
    // 模擬 Firestore ?�詢結�?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantItem
    });
    
    // 模擬?�除?��? (不�?該被調用)
    const mockDelete = jest.fn();
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });
    
    // ?��?測試
    await deleteMenuItem(mockRequest, mockResponse);
    
    // 驗�?租戶?�離檢查
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒�?權�?：無法刪?�其他�??��??�單?��?'
    });
    
    // 驗�? delete ?��??�被調用
    expect(mockDelete).not.toHaveBeenCalled();
  });
  
  // 測試案�?4: Firestore ?�除失�?
  test('Firestore ?�除失�??��???00?�??, async () => {
    // 準�?測試請�??�響??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?�建測試?��?
    const testItem = createTestMenuItem();
    
    // 模擬 Firestore ?�詢結�? - ?��?存在
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // 模擬?�除?��?失�?
    const mockDelete = jest.fn().mockRejectedValue(new Error('?��?庫刪?�失??));
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });
    
    // ?��?測試
    await deleteMenuItem(mockRequest, mockResponse);
    
    // 驗�??��?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '伺�??�內?�錯�?,
      error: '?��?庫刪?�失??
    });
  });
}); 
