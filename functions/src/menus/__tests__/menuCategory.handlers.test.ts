/**
 * 基本測試範例
 */
describe('Basic Test Suite', () => {
  test('testing basic functionality', () => {
    expect(true).toBe(true);
  });
});

/**
 * 測試 menuCategory.handlers.ts 中的方法
 */

// 模擬 firebase-admin
const serverTimestampMock = jest.fn().mockReturnValue('mocked_server_timestamp');
const mockSet = jest.fn().mockResolvedValue(true);
const mockDoc = jest.fn().mockImplementation((docId) => {
  return {
    set: mockSet,
    get: mockGet,
    update: mockUpdate,
    delete: mockDelete
  };
});

// 模擬 Firestore 查詢方法
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockGet = jest.fn();
const mockLimit = jest.fn().mockReturnThis();
const mockUpdate = jest.fn().mockResolvedValue(true);
const mockDelete = jest.fn().mockResolvedValue(true);

// 創建更靈活的mockCollection，能夠處理不同的集合
const mockCollection = jest.fn().mockImplementation((collectionName) => {
  if (collectionName === 'menuItems') {
    return {
      where: mockWhere,
      limit: mockLimit,
      get: mockGet
    };
  }
  return {
    doc: mockDoc,
    where: mockWhere,
    orderBy: mockOrderBy,
    get: mockGet,
    limit: mockLimit
  };
});

const mockDb = { collection: mockCollection };

// 必須在導入被測試模塊之前進行模擬
jest.mock('firebase-admin', () => {
  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockDb),
    credential: {
      applicationDefault: jest.fn()
    }
  };
});

// 直接修改導入後的 admin 對象
const admin = require('firebase-admin');
// 添加 FieldValue.serverTimestamp
admin.firestore.FieldValue = {
  serverTimestamp: serverTimestampMock
};

// 模擬 uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-123')
}));

// 模擬 firebase-functions/logger
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
jest.mock('firebase-functions', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError
  }
}));

// 擴展Request接口以包含user屬性
import { Request as ExpressRequest, Response } from 'express';
interface RequestWithUser extends ExpressRequest {
  user?: {
    uid: string;
    tenantId?: string;
    role: string;
    [key: string]: any;
  };
}
type Request = RequestWithUser;

// 在模擬設置後導入被測試函數
import { createMenuCategory, listMenuCategories, getMenuCategoryById, updateMenuCategory, deleteMenuCategory } from '../menuCategory.handlers';
import { MenuCategoryInput, MenuCategoryQueryParams } from '../menuCategory.validators';

// 創建模擬的 Firestore 文檔快照
const createMockDocumentSnapshot = (data: any) => ({
  id: data.id,
  data: () => data,
  exists: true
});

// 創建樣本菜單分類數據
const createSampleCategories = () => {
  const timestamp = new Date('2025-05-01T08:00:00Z');
  
  const toTimestamp = (date: Date) => ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0
  });
  
  return [
    {
      id: 'category-1',
      tenantId: 'test-tenant-id',
      name: 'Main Dishes',
      description: 'All main courses',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: 'http://example.com/main.jpg',
      isActive: true,
      createdBy: 'admin-1',
      createdAt: toTimestamp(timestamp),
      updatedAt: toTimestamp(timestamp)
    },
    {
      id: 'category-2',
      tenantId: 'test-tenant-id',
      name: 'Drinks',
      description: 'Beverages',
      displayOrder: 3,
      type: 'drink',
      imageUrl: 'http://example.com/drink.jpg',
      isActive: true,
      createdBy: 'admin-1',
      createdAt: toTimestamp(timestamp),
      updatedAt: toTimestamp(timestamp)
    },
    {
      id: 'category-3',
      tenantId: 'test-tenant-id',
      name: 'Desserts',
      description: 'Sweet treats',
      displayOrder: 4,
      type: 'dessert',
      imageUrl: 'http://example.com/dessert.jpg',
      isActive: false, // 未激活
      createdBy: 'admin-1',
      createdAt: toTimestamp(timestamp),
      updatedAt: toTimestamp(timestamp)
    },
    {
      id: 'category-4',
      tenantId: 'test-tenant-id',
      name: 'Side Dishes',
      description: 'All sides',
      displayOrder: 2,
      type: 'side_dish',
      imageUrl: 'http://example.com/side.jpg',
      isActive: true,
      createdBy: 'admin-1',
      createdAt: toTimestamp(timestamp),
      updatedAt: toTimestamp(timestamp)
    },
    {
      id: 'category-5',
      tenantId: 'other-tenant-id', // 其他租戶
      name: 'Other Tenant Category',
      description: 'Should not be visible',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: '',
      isActive: true,
      createdBy: 'admin-2',
      createdAt: toTimestamp(timestamp),
      updatedAt: toTimestamp(timestamp)
    }
  ];
};

describe('MenuCategory Handlers - createMenuCategory', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusJsonSpy: jest.Mock;
  let jsonSpy: jest.Mock;

  beforeEach(() => {
    // 清理所有模擬
    mockSet.mockClear();
    mockDoc.mockClear();
    mockCollection.mockClear();
    serverTimestampMock.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();
    (require('uuid').v4 as jest.Mock).mockClear();

    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn(() => ({ json: jsonSpy }));
    mockResponse = {
      status: statusJsonSpy as any,
      json: jsonSpy,
    };
  });

  test('should create a menu category successfully with valid input and authorized user', async () => {
    // 1. 準備 (Arrange)
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      body: {
        name: 'New Main Dishes',
        type: 'main_dish',
        displayOrder: 1,
        description: 'Delicious main courses',
        imageUrl: 'http://example.com/image.png',
        isActive: true,
      } as MenuCategoryInput,
    };

    const uuid = require('uuid');
    const expectedCategoryId = 'test-uuid-123';
    (uuid.v4 as jest.Mock).mockReturnValueOnce(expectedCategoryId);

    // 2. 執行 (Act)
    await createMenuCategory(mockRequest as Request, mockResponse as Response);

    // 3. 斷言 (Assert)
    // 驗證 Firestore 操作
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(expectedCategoryId);

    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      id: expectedCategoryId,
      tenantId: 'test-tenant-id',
      name: 'New Main Dishes',
      type: 'main_dish',
      displayOrder: 1,
      description: 'Delicious main courses',
      imageUrl: 'http://example.com/image.png',
      isActive: true,
      createdBy: 'test-user-id',
      createdAt: 'mocked_server_timestamp',
      updatedAt: 'mocked_server_timestamp',
    }));

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(201);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: '菜單分類創建成功',
      data: expect.objectContaining({
        id: expectedCategoryId,
        name: 'New Main Dishes',
      }),
    }));

    // 驗證日誌記錄
    expect(mockLoggerInfo).toHaveBeenCalledWith('處理創建菜單分類請求', expect.any(Object));
    expect(mockLoggerInfo).toHaveBeenCalledWith('準備創建菜單分類', expect.any(Object));
    expect(mockLoggerInfo).toHaveBeenCalledWith('菜單分類創建成功', expect.any(Object));
  });

  // 1. 缺少用戶信息 (401 Unauthorized) 測試
  test('should return 401 when user information is missing', async () => {
    // 1. 準備 (Arrange)
    mockRequest = {
      // user is undefined
      body: {
        name: 'New Main Dishes',
        type: 'main_dish',
        displayOrder: 1,
      } as MenuCategoryInput,
    };

    // 2. 執行 (Act)
    await createMenuCategory(mockRequest as Request, mockResponse as Response);

    // 3. 斷言 (Assert)
    // 驗證 Firestore 操作未執行
    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();

    // 驗證返回 401 錯誤
    expect(statusJsonSpy).toHaveBeenCalledWith(401);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('未授權：找不到有效的用戶信息'),
    }));

    // 驗證錯誤日誌
    expect(mockLoggerError).toHaveBeenCalledWith('創建菜單分類失敗: 找不到有效的用戶信息');
  });

  // 2. 用戶缺少租戶 ID (403 Forbidden) 測試
  test('should return 403 when user lacks tenant ID', async () => {
    // 1. 準備 (Arrange)
    mockRequest = {
      user: { uid: 'test-user-id', role: 'tenant_admin' }, // tenantId is missing
      body: {
        name: 'New Main Dishes',
        type: 'main_dish',
        displayOrder: 1,
      } as MenuCategoryInput,
    };

    // 2. 執行 (Act)
    await createMenuCategory(mockRequest as Request, mockResponse as Response);

    // 3. 斷言 (Assert)
    // 驗證 Firestore 操作未執行
    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();

    // 驗證返回 403 錯誤
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('沒有權限：用戶缺少租戶ID'),
    }));

    // 驗證錯誤日誌
    expect(mockLoggerError).toHaveBeenCalledWith('創建菜單分類失敗: 用戶缺少租戶ID', expect.any(Object));
  });

  // 3. Firestore 寫入失敗 (500 Internal Server Error) 測試
  test('should return 500 when Firestore write fails', async () => {
    // 1. 準備 (Arrange)
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      body: {
        name: 'New Main Dishes',
        type: 'main_dish',
        displayOrder: 1,
      } as MenuCategoryInput,
    };

    // 模擬 Firestore 寫入失敗
    const firestoreError = new Error('Firestore write failed');
    mockSet.mockRejectedValueOnce(firestoreError);

    // 2. 執行 (Act)
    await createMenuCategory(mockRequest as Request, mockResponse as Response);

    // 3. 斷言 (Assert)
    // 驗證 Firestore 操作被調用
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalled();

    // 驗證返回 500 錯誤
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('伺服器內部錯誤'),
      error: expect.stringContaining('Firestore write failed'),
    }));

    // 驗證錯誤日誌
    expect(mockLoggerError).toHaveBeenCalledWith('創建菜單分類時發生錯誤', expect.objectContaining({
      error: expect.stringContaining('Firestore write failed'),
      stack: expect.any(String)
    }));
  });

  // 4. 可選欄位處理測試
  test('should handle optional fields correctly', async () => {
    // 1. 準備 (Arrange) - 僅提供必填欄位
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      body: {
        name: 'New Main Dishes',
        type: 'main_dish',
        displayOrder: 1,
        // description, imageUrl, isActive 未提供
      } as MenuCategoryInput,
    };

    const uuid = require('uuid');
    const expectedCategoryId = 'test-uuid-123';
    (uuid.v4 as jest.Mock).mockReturnValueOnce(expectedCategoryId);

    // 2. 執行 (Act)
    await createMenuCategory(mockRequest as Request, mockResponse as Response);

    // 3. 斷言 (Assert)
    // 驗證保存到 Firestore 的數據包含預設值
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      id: expectedCategoryId,
      tenantId: 'test-tenant-id',
      name: 'New Main Dishes',
      type: 'main_dish',
      displayOrder: 1,
      description: '', // 預設為空字串
      imageUrl: '', // 預設為空字串
      isActive: true, // 預設為 true
      createdBy: 'test-user-id',
      createdAt: 'mocked_server_timestamp',
      updatedAt: 'mocked_server_timestamp',
    }));

    // 驗證響應成功
    expect(statusJsonSpy).toHaveBeenCalledWith(201);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: '菜單分類創建成功',
    }));
  });
});

describe('MenuCategory Handlers - listMenuCategories', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusJsonSpy: jest.Mock;
  let jsonSpy: jest.Mock;
  let categories: any[];

  beforeEach(() => {
    // 清理所有模擬
    mockWhere.mockClear();
    mockOrderBy.mockClear();
    mockGet.mockClear();
    mockCollection.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();

    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn(() => ({ json: jsonSpy }));
    mockResponse = {
      status: statusJsonSpy as any,
      json: jsonSpy,
    };

    // 創建樣本數據
    categories = createSampleCategories();
  });

  // 1. 成功獲取菜單分類列表測試
  test('should successfully get list of menu categories', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: { isActive: true } as any, // 明確指定isActive為true
    };

    // 只返回特定租戶且激活的分類
    const filteredCategories = categories.filter(
      cat => cat.tenantId === 'test-tenant-id' && cat.isActive === true
    );

    // 按displayOrder和name排序
    const sortedCategories = [...filteredCategories].sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name);
    });

    // 模擬Firestore查詢結果
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: sortedCategories.map(createMockDocumentSnapshot)
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    // 驗證Firestore查詢構建
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', 'test-tenant-id');
    expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true); // 明確過濾條件
    expect(mockOrderBy).toHaveBeenCalledWith('displayOrder', 'asc');
    expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
    expect(mockGet).toHaveBeenCalled();

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ id: 'category-1' }),
        expect.objectContaining({ id: 'category-2' }),
        expect.objectContaining({ id: 'category-4' })
      ])
    });

    // 驗證返回數據中不包含其他租戶的分類
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.length).toBe(3);
    expect(responseData.some((cat: any) => cat.id === 'category-5')).toBe(false);

    // 驗證返回數據中不包含未激活的分類
    expect(responseData.some((cat: any) => cat.id === 'category-3')).toBe(false);

    // 驗證時間戳已轉換為ISO字符串
    expect(typeof responseData[0].createdAt).toBe('string');
    expect(typeof responseData[0].updatedAt).toBe('string');
  });

  // 2. 租戶隔離測試
  test('should enforce tenant isolation', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: { isActive: 'all' } as any, // 獲取所有狀態的分類
    };

    // 只返回特定租戶的分類
    const filteredCategories = categories.filter(
      cat => cat.tenantId === 'test-tenant-id'
    );

    // 模擬Firestore查詢結果
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: filteredCategories.map(createMockDocumentSnapshot)
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    // 驗證Firestore查詢構建
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', 'test-tenant-id');
    expect(mockGet).toHaveBeenCalled();

    // 驗證響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    
    // 驗證返回數據中不包含其他租戶的分類
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.length).toBe(4); // 特定租戶的4個分類
    expect(responseData.some((cat: any) => cat.tenantId !== 'test-tenant-id')).toBe(false);
  });

  // 3. isActive 過濾測試 - 默認 (未提供參數)
  test('should filter active categories by default', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: { isActive: true } as any, // 在validator處理後，默認值應該會變成true
    };

    // 只返回特定租戶且激活的分類
    const filteredCategories = categories.filter(
      cat => cat.tenantId === 'test-tenant-id' && cat.isActive === true
    );

    // 模擬Firestore查詢結果
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: filteredCategories.map(createMockDocumentSnapshot)
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
    
    // 驗證返回數據
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.every((cat: any) => cat.isActive === true)).toBe(true);
    expect(responseData.length).toBe(3); // 三個激活的分類
  });

  // 4. isActive 過濾測試 - isActive=false
  test('should filter inactive categories when isActive=false', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: { isActive: false } as any, // 明確要求非激活分類
    };

    // 只返回特定租戶且非激活的分類
    const filteredCategories = categories.filter(
      cat => cat.tenantId === 'test-tenant-id' && cat.isActive === false
    );

    // 模擬Firestore查詢結果
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: filteredCategories.map(createMockDocumentSnapshot)
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    expect(mockWhere).toHaveBeenCalledWith('isActive', '==', false);
    
    // 驗證返回數據
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.every((cat: any) => cat.isActive === false)).toBe(true);
    expect(responseData.length).toBe(1); // 一個非激活的分類
    expect(responseData[0].id).toBe('category-3');
  });

  // 5. isActive 過濾測試 - isActive=all
  test('should return all categories when isActive=all', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: { isActive: 'all' } as any, // 獲取所有狀態分類
    };

    // 返回特定租戶的所有分類（激活和非激活）
    const filteredCategories = categories.filter(
      cat => cat.tenantId === 'test-tenant-id'
    );

    // 模擬Firestore查詢結果
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: filteredCategories.map(createMockDocumentSnapshot)
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    // 驗證沒有添加isActive過濾條件
    expect(mockWhere).toHaveBeenCalledTimes(1); // 只有tenantId過濾
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', 'test-tenant-id');
    
    // 驗證返回數據包含激活和非激活分類
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.some((cat: any) => cat.isActive === true)).toBe(true);
    expect(responseData.some((cat: any) => cat.isActive === false)).toBe(true);
    expect(responseData.length).toBe(4); // 所有tenant的分類
  });

  // 6. type 過濾測試 - 單一類型
  test('should filter by single type', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: { type: 'main_dish' } as any, // 過濾主菜類型
    };

    // 只返回特定租戶且為主菜類型且激活的分類
    const filteredCategories = categories.filter(
      cat => cat.tenantId === 'test-tenant-id' && cat.type === 'main_dish' && cat.isActive === true
    );

    // 模擬Firestore查詢結果
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: filteredCategories.map(createMockDocumentSnapshot)
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    expect(mockWhere).toHaveBeenCalledWith('type', '==', 'main_dish');
    
    // 驗證返回數據
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.every((cat: any) => cat.type === 'main_dish')).toBe(true);
    expect(responseData.length).toBe(1); // 只有一個激活的main_dish分類
    expect(responseData[0].id).toBe('category-1');
  });

  // 7. type 過濾測試 - 多類型
  test('should filter by multiple types', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: { type: ['main_dish', 'drink'] } as any, // 多類型過濾
    };

    // 返回特定租戶且類型為main_dish或drink且激活的分類
    const filteredCategories = categories.filter(
      cat => cat.tenantId === 'test-tenant-id' && 
             (cat.type === 'main_dish' || cat.type === 'drink') && 
             cat.isActive === true
    );

    // 模擬Firestore查詢結果
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: filteredCategories.map(createMockDocumentSnapshot)
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    expect(mockWhere).toHaveBeenCalledWith('type', 'in', ['main_dish', 'drink']);
    
    // 驗證返回數據
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.every((cat: any) => 
      cat.type === 'main_dish' || cat.type === 'drink'
    )).toBe(true);
    expect(responseData.length).toBe(2); // 兩個符合條件的分類
  });

  // 8. 組合過濾測試 - type和isActive
  test('should apply combined filters for type and isActive', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: { 
        type: 'dessert',
        isActive: false 
      } as any, // 非激活的甜點
    };

    // 返回特定租戶且類型為dessert且非激活的分類
    const filteredCategories = categories.filter(
      cat => cat.tenantId === 'test-tenant-id' && 
             cat.type === 'dessert' && 
             cat.isActive === false
    );

    // 模擬Firestore查詢結果
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: filteredCategories.map(createMockDocumentSnapshot)
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    expect(mockWhere).toHaveBeenCalledWith('type', '==', 'dessert');
    expect(mockWhere).toHaveBeenCalledWith('isActive', '==', false);
    
    // 驗證返回數據
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.length).toBe(1); // 只有一個符合條件的分類
    expect(responseData[0].id).toBe('category-3');
    expect(responseData[0].type).toBe('dessert');
    expect(responseData[0].isActive).toBe(false);
  });

  // 9. 排序邏輯測試
  test('should sort categories by displayOrder and then by name', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: { isActive: 'all' } as any, // 獲取所有狀態的分類
    };

    // 返回特定租戶的所有分類，用固定順序以確保驗證通過
    const testCategories = [
      {...categories.find(c => c.id === 'category-1')!}, // displayOrder: 1
      {...categories.find(c => c.id === 'category-4')!}, // displayOrder: 2
      {...categories.find(c => c.id === 'category-2')!}, // displayOrder: 3
      {...categories.find(c => c.id === 'category-3')!}, // displayOrder: 4
    ];

    // 模擬Firestore查詢結果
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: testCategories.map(createMockDocumentSnapshot)
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    expect(mockOrderBy).toHaveBeenCalledWith('displayOrder', 'asc');
    expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
    
    // 驗證返回的數據順序
    const responseData = jsonSpy.mock.calls[0][0].data;
    
    // 確認每個分類的displayOrder是遞增的
    for (let i = 0; i < responseData.length - 1; i++) {
      expect(responseData[i].displayOrder).toBeLessThanOrEqual(responseData[i+1].displayOrder);
    }
  });

  // 10. 空列表測試
  test('should handle empty result set', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'non-existent-tenant', role: 'tenant_admin' },
      query: {} as any,
    };

    // 模擬Firestore返回空結果
    mockGet.mockResolvedValueOnce({
      empty: true,
      docs: []
    });

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: []
    });
  });

  // 11. 未提供租戶ID錯誤測試
  test('should return 403 when tenant ID is missing', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', role: 'tenant_admin' }, // 缺少tenantId
      query: {} as any,
    };

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒有權限：用戶缺少租戶ID'
    });
    expect(mockLoggerError).toHaveBeenCalled();
  });

  // 12. Firestore查詢失敗測試
  test('should return 500 when Firestore query fails', async () => {
    // 1. 準備
    mockRequest = {
      user: { uid: 'test-user-id', tenantId: 'test-tenant-id', role: 'tenant_admin' },
      query: {} as any,
    };

    // 模擬Firestore查詢失敗
    const firestoreError = new Error('Firestore query failed');
    mockGet.mockRejectedValueOnce(firestoreError);

    // 2. 執行
    await listMenuCategories(mockRequest as Request, mockResponse as Response);

    // 3. 斷言
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺服器內部錯誤',
      error: 'Firestore query failed'
    }));
    expect(mockLoggerError).toHaveBeenCalled();
  });
});

describe('MenuCategory Handlers - getMenuCategoryById', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusJsonSpy: jest.Mock;
  let jsonSpy: jest.Mock;
  const testCategoryId = 'test-category-123';
  const testTenantId = 'test-tenant-id';
  const otherTenantId = 'other-tenant-id';

  beforeEach(() => {
    // 清理所有模擬
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();

    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn(() => ({ json: jsonSpy }));
    mockResponse = {
      status: statusJsonSpy as any,
      json: jsonSpy,
    };

    // 重置mockGet的默認行為
    mockGet.mockReset();
  });

  test('should successfully retrieve menu category with valid ID and matching tenant', async () => {
    // 準備測試數據
    const timestamp = new Date('2023-05-01T08:00:00Z');
    const mockCategory = {
      id: testCategoryId,
      tenantId: testTenantId,
      name: 'Test Category',
      description: 'A test category',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: 'http://example.com/image.jpg',
      isActive: true,
      createdBy: 'test-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };

    // 模擬文檔獲取
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });

    // 設置請求
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };

    // 執行
    await getMenuCategoryById(mockRequest as Request, mockResponse as Response);

    // 驗證
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testCategoryId);
    expect(mockGet).toHaveBeenCalled();
    
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        id: testCategoryId,
        tenantId: testTenantId,
        name: 'Test Category',
        createdAt: timestamp.toISOString(),
        updatedAt: timestamp.toISOString()
      })
    });

    expect(mockLoggerInfo).toHaveBeenCalledWith('處理獲取菜單分類詳情請求', expect.any(Object));
    expect(mockLoggerInfo).toHaveBeenCalledWith('查詢菜單分類詳情', expect.objectContaining({
      categoryId: testCategoryId,
      tenantId: testTenantId
    }));
    expect(mockLoggerInfo).toHaveBeenCalledWith('成功獲取菜單分類詳情', expect.any(Object));
  });

  test('should return 404 when category does not exist', async () => {
    // 模擬文檔不存在
    mockGet.mockResolvedValueOnce({
      exists: false,
      data: () => null,
    });

    // 設置請求
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };

    // 執行
    await getMenuCategoryById(mockRequest as Request, mockResponse as Response);

    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '找不到指定的菜單分類'
    });

    expect(mockLoggerInfo).toHaveBeenCalledWith('找不到指定的菜單分類', expect.any(Object));
  });

  test('should return 403 when tenant isolation check fails', async () => {
    // 準備測試數據 - 設置一個屬於其他租戶的分類
    const timestamp = new Date('2023-05-01T08:00:00Z');
    const mockCategory = {
      id: testCategoryId,
      tenantId: otherTenantId, // 其他租戶ID
      name: 'Other Tenant Category',
      description: 'A category from another tenant',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: '',
      isActive: true,
      createdBy: 'other-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };

    // 模擬文檔獲取
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });

    // 設置請求 - 使用testTenantId，但分類屬於otherTenantId
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };

    // 執行
    await getMenuCategoryById(mockRequest as Request, mockResponse as Response);

    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒有權限：無法訪問其他租戶的菜單分類'
    });

    expect(mockLoggerInfo).toHaveBeenCalledWith('租戶隔離檢查失敗: 無法訪問其他租戶的菜單分類', expect.objectContaining({
      categoryId: testCategoryId,
      requestTenantId: testTenantId,
      resourceTenantId: otherTenantId
    }));
  });

  test('should return 400 when categoryId parameter is missing', async () => {
    // 設置請求 - 缺少categoryId
    mockRequest = {
      params: {}, // 無參數
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };

    // 執行
    await getMenuCategoryById(mockRequest as Request, mockResponse as Response);

    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '缺少必要的分類ID參數'
    });

    expect(mockLoggerError).toHaveBeenCalledWith('獲取菜單分類詳情失敗: 缺少必要的分類ID參數');
  });

  test('should return 500 when database query fails', async () => {
    // 模擬數據庫查詢失敗
    const testError = new Error('Database connection failed');
    mockGet.mockRejectedValueOnce(testError);

    // 設置請求
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };

    // 執行
    await getMenuCategoryById(mockRequest as Request, mockResponse as Response);

    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '伺服器內部錯誤',
      error: 'Database connection failed'
    });

    expect(mockLoggerError).toHaveBeenCalledWith('獲取菜單分類詳情時出錯', expect.objectContaining({
      error: 'Database connection failed'
    }));
  });
});

describe('MenuCategory Handlers - updateMenuCategory', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusJsonSpy: jest.Mock;
  let jsonSpy: jest.Mock;
  const testCategoryId = 'test-category-123';
  const testTenantId = 'test-tenant-id';
  const otherTenantId = 'other-tenant-id';
  
  beforeEach(() => {
    // 清理所有模擬
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockGet.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();
    mockUpdate.mockClear();
    
    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn(() => ({ json: jsonSpy }));
    mockResponse = {
      status: statusJsonSpy as any,
      json: jsonSpy,
    };
    
    // 準備時間戳
    const timestamp = new Date('2023-05-01T08:00:00Z');
    const updatedTimestamp = new Date('2023-05-01T09:30:00Z');
  });
  
  test('should successfully update menu category with valid data and matching tenant', async () => {
    // 準備測試數據
    const timestamp = new Date('2023-05-01T08:00:00Z');
    const updatedTimestamp = new Date('2023-05-02T10:00:00Z');
    
    // 模擬現有的菜單分類
    const mockCategory = {
      id: testCategoryId,
      tenantId: testTenantId,
      name: 'Original Category',
      description: 'Original description',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: 'http://example.com/original.jpg',
      isActive: true,
      createdBy: 'test-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 更新後的菜單分類
    const updatedCategory = {
      ...mockCategory,
      name: 'Updated Category',
      description: 'Updated description',
      updatedAt: {
        toDate: () => updatedTimestamp,
        seconds: Math.floor(updatedTimestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 設置請求
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' },
      body: {
        name: 'Updated Category',
        description: 'Updated description'
      }
    };
    
    // 模擬數據庫操作
    // 第一次get返回原始分類
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });
    
    // 第二次get返回更新後的分類
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => updatedCategory,
      id: testCategoryId
    });
    
    // 執行
    await updateMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    // 檢查Firestore操作
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testCategoryId);
    expect(mockGet).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Updated Category',
      description: 'Updated description',
      updatedAt: 'mocked_server_timestamp'
    }));
    
    // 檢查響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: '菜單分類更新成功',
      data: expect.objectContaining({
        id: testCategoryId,
        name: 'Updated Category',
        description: 'Updated description'
      })
    }));
    
    // 驗證格式化的時間戳
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.updatedAt).toBe(updatedTimestamp.toISOString());
    
    // 驗證日誌
    expect(mockLoggerInfo).toHaveBeenCalledWith('處理更新菜單分類請求', expect.any(Object));
    expect(mockLoggerInfo).toHaveBeenCalledWith('準備更新菜單分類', expect.any(Object));
    expect(mockLoggerInfo).toHaveBeenCalledWith('菜單分類更新成功', expect.any(Object));
  });
  
  test('should return 404 when category does not exist', async () => {
    // 設置請求
    mockRequest = {
      params: { categoryId: 'non-existent-id' },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' },
      body: {
        name: 'Updated Name'
      }
    };
    
    // 模擬文檔不存在
    mockGet.mockResolvedValueOnce({
      exists: false,
      data: () => null
    });
    
    // 執行
    await updateMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '找不到指定的菜單分類'
    });
    
    // 驗證未調用update
    expect(mockUpdate).not.toHaveBeenCalled();
  });
  
  test('should return 403 when tenant isolation check fails', async () => {
    // 準備測試數據 - 設置一個屬於其他租戶的分類
    const timestamp = new Date('2023-05-01T08:00:00Z');
    const mockCategory = {
      id: testCategoryId,
      tenantId: otherTenantId, // 其他租戶ID
      name: 'Other Tenant Category',
      description: 'A category from another tenant',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: '',
      isActive: true,
      createdBy: 'other-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 設置請求 - 使用testTenantId，但分類屬於otherTenantId
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' },
      body: {
        name: 'Updated Name'
      }
    };
    
    // 模擬文檔獲取
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });
    
    // 執行
    await updateMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒有權限：無法更新其他租戶的菜單分類'
    });
    
    // 驗證未調用update
    expect(mockUpdate).not.toHaveBeenCalled();
  });
  
  test('should return 400 when categoryId parameter is missing', async () => {
    // 設置請求 - 缺少categoryId
    mockRequest = {
      params: {}, // 無參數
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' },
      body: {
        name: 'Updated Name'
      }
    };
    
    // 執行
    await updateMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '缺少必要的分類ID參數'
    });
    
    // 驗證未調用get和update
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
  
  test('should return 500 when database update fails', async () => {
    // 準備測試數據
    const timestamp = new Date('2023-05-01T08:00:00Z');
    const mockCategory = {
      id: testCategoryId,
      tenantId: testTenantId,
      name: 'Original Category',
      description: 'Original description',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: 'http://example.com/original.jpg',
      isActive: true,
      createdBy: 'test-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 設置請求
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' },
      body: {
        name: 'Updated Name'
      }
    };
    
    // 模擬文檔獲取成功但更新失敗
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });
    
    // 模擬更新失敗
    const updateError = new Error('Database update failed');
    mockUpdate.mockRejectedValueOnce(updateError);
    
    // 執行
    await updateMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '伺服器內部錯誤',
      error: 'Database update failed'
    });
    
    // 驗證嘗試調用update
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalled();
  });
  
  test('should handle partial updates correctly', async () => {
    // 準備測試數據
    const timestamp = new Date('2023-05-01T08:00:00Z');
    const updatedTimestamp = new Date('2023-05-02T10:00:00Z');
    
    // 模擬現有的菜單分類
    const mockCategory = {
      id: testCategoryId,
      tenantId: testTenantId,
      name: 'Original Category',
      description: 'Original description',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: 'http://example.com/original.jpg',
      isActive: true,
      createdBy: 'test-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 更新後的菜單分類 - 只更新isActive
    const updatedCategory = {
      ...mockCategory,
      isActive: false,
      updatedAt: {
        toDate: () => updatedTimestamp,
        seconds: Math.floor(updatedTimestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 設置請求 - 只更新isActive
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' },
      body: {
        isActive: false
      }
    };
    
    // 模擬數據庫操作
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });
    
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => updatedCategory,
      id: testCategoryId
    });
    
    // 執行
    await updateMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    // 檢查update只包含isActive字段
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      isActive: false,
      updatedAt: 'mocked_server_timestamp'
    }));
    
    // 確保update調用中沒有包含其他欄位
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall).not.toHaveProperty('name');
    expect(updateCall).not.toHaveProperty('description');
    expect(updateCall).not.toHaveProperty('displayOrder');
    expect(updateCall).not.toHaveProperty('type');
    expect(updateCall).not.toHaveProperty('imageUrl');
    
    // 檢查響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        id: testCategoryId,
        isActive: false,
        // 其他欄位保持不變
        name: 'Original Category',
        description: 'Original description'
      })
    }));
  });
});

describe('MenuCategory Handlers - deleteMenuCategory', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusJsonSpy: jest.Mock;
  let jsonSpy: jest.Mock;
  const testCategoryId = 'test-category-123';
  const testTenantId = 'test-tenant-id';
  const otherTenantId = 'other-tenant-id';
  
  beforeEach(() => {
    // 清理所有模擬
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockGet.mockClear();
    mockWhere.mockClear();
    mockLimit.mockClear();
    mockDelete.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();
    
    jsonSpy = jest.fn();
    statusJsonSpy = jest.fn(() => ({ json: jsonSpy }));
    mockResponse = {
      status: statusJsonSpy as any,
      json: jsonSpy,
    };
  });
  
  test('should successfully delete menu category when no menu items are associated', async () => {
    // 準備測試數據
    const timestamp = new Date('2023-05-01T08:00:00Z');
    
    // 模擬現有的菜單分類
    const mockCategory = {
      id: testCategoryId,
      tenantId: testTenantId,
      name: 'Test Category',
      description: 'A test category',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: 'http://example.com/image.jpg',
      isActive: true,
      createdBy: 'test-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 設置請求
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };
    
    // 模擬數據庫操作
    // 返回現有分類
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });
    
    // 模擬沒有關聯的菜單項目
    mockGet.mockResolvedValueOnce({
      empty: true,
      docs: []
    });
    
    // 執行
    await deleteMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    // 檢查Firestore操作
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testCategoryId);
    expect(mockGet).toHaveBeenCalled();
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockWhere).toHaveBeenCalledWith('categoryId', '==', testCategoryId);
    expect(mockLimit).toHaveBeenCalledWith(1);
    
    expect(mockDelete).toHaveBeenCalled();
    
    // 檢查響應
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '菜單分類刪除成功'
    });
    
    // 驗證日誌
    expect(mockLoggerInfo).toHaveBeenCalledWith('處理刪除菜單分類請求', expect.any(Object));
    expect(mockLoggerInfo).toHaveBeenCalledWith('菜單分類刪除成功', expect.any(Object));
  });
  
  test('should return 400 when attempting to delete a category with associated menu items', async () => {
    // 準備測試數據
    const timestamp = new Date('2023-05-01T08:00:00Z');
    
    // 模擬現有的菜單分類
    const mockCategory = {
      id: testCategoryId,
      tenantId: testTenantId,
      name: 'Test Category',
      description: 'A test category',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: 'http://example.com/image.jpg',
      isActive: true,
      createdBy: 'test-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 模擬一個關聯的菜單項目
    const mockMenuItem = {
      id: 'test-item-1',
      categoryId: testCategoryId,
      name: 'Test Item',
      tenantId: testTenantId
    };
    
    // 設置請求
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };
    
    // 模擬數據庫操作
    // 返回現有分類
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });
    
    // 模擬有關聯的菜單項目
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: 'test-item-1',
        data: () => mockMenuItem
      }]
    });
    
    // 執行
    await deleteMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    // 檢查Firestore操作
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testCategoryId);
    expect(mockGet).toHaveBeenCalled();
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockWhere).toHaveBeenCalledWith('categoryId', '==', testCategoryId);
    
    // 確認沒有調用delete
    expect(mockDelete).not.toHaveBeenCalled();
    
    // 檢查響應
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '無法刪除：該分類下存在菜單項目，請先刪除或移動這些項目'
    });
  });
  
  test('should return 404 when category does not exist', async () => {
    // 設置請求
    mockRequest = {
      params: { categoryId: 'non-existent-id' },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };
    
    // 模擬文檔不存在
    mockGet.mockResolvedValueOnce({
      exists: false,
      data: () => null
    });
    
    // 執行
    await deleteMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '找不到指定的菜單分類'
    });
    
    // 驗證未調用delete
    expect(mockDelete).not.toHaveBeenCalled();
  });
  
  test('should return 403 when tenant isolation check fails', async () => {
    // 準備測試數據 - 設置一個屬於其他租戶的分類
    const timestamp = new Date('2023-05-01T08:00:00Z');
    const mockCategory = {
      id: testCategoryId,
      tenantId: otherTenantId, // 其他租戶ID
      name: 'Other Tenant Category',
      description: 'A category from another tenant',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: '',
      isActive: true,
      createdBy: 'other-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 設置請求 - 使用testTenantId，但分類屬於otherTenantId
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };
    
    // 模擬文檔獲取
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });
    
    // 執行
    await deleteMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '沒有權限：無法刪除其他租戶的菜單分類'
    });
    
    // 驗證未調用delete
    expect(mockDelete).not.toHaveBeenCalled();
  });
  
  test('should return 400 when categoryId parameter is missing', async () => {
    // 設置請求 - 缺少categoryId
    mockRequest = {
      params: {}, // 無參數
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };
    
    // 執行
    await deleteMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '缺少必要的分類ID參數'
    });
    
    // 驗證未調用get和delete
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
  
  test('should return 500 when database delete fails', async () => {
    // 準備測試數據
    const timestamp = new Date('2023-05-01T08:00:00Z');
    const mockCategory = {
      id: testCategoryId,
      tenantId: testTenantId,
      name: 'Test Category',
      description: 'A test category',
      displayOrder: 1,
      type: 'main_dish',
      imageUrl: 'http://example.com/image.jpg',
      isActive: true,
      createdBy: 'test-admin',
      createdAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      },
      updatedAt: {
        toDate: () => timestamp,
        seconds: Math.floor(timestamp.getTime() / 1000),
        nanoseconds: 0
      }
    };
    
    // 設置請求
    mockRequest = {
      params: { categoryId: testCategoryId },
      user: { uid: 'test-user', tenantId: testTenantId, role: 'tenant_admin' }
    };
    
    // 模擬數據庫操作
    // 返回現有分類
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockCategory,
      id: testCategoryId
    });
    
    // 模擬沒有關聯的菜單項目
    mockGet.mockResolvedValueOnce({
      empty: true,
      docs: []
    });
    
    // 模擬刪除操作失敗
    const deleteError = new Error('Database delete failed');
    mockDelete.mockRejectedValueOnce(deleteError);
    
    // 執行
    await deleteMenuCategory(mockRequest as Request, mockResponse as Response);
    
    // 驗證
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '伺服器內部錯誤',
      error: 'Database delete failed'
    });
    
    // 驗證嘗試調用delete
    expect(mockDelete).toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalled();
  });
});
