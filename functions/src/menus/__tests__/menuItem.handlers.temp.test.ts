/**
 * Test for menuItem.handlers.ts createMenuItem function
 */

// Mock firebase-admin
const serverTimestampMock = jest.fn().mockReturnValue('mocked_server_timestamp');
const mockSet = jest.fn().mockResolvedValue(true);
const mockGet = jest.fn();
const mockDoc = jest.fn().mockReturnValue({
  set: mockSet,
  get: mockGet,
  update: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true)
});

// Mock count() function
const mockCount = jest.fn().mockReturnValue({
  get: jest.fn().mockResolvedValue({
    data: () => ({ count: 10 })
  })
});

// Mock Firestore query functions
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockOffset = jest.fn().mockReturnThis();
let mockStartAfter = jest.fn().mockReturnThis();

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

// Mock Zod validation
const mockSafeParse = jest.fn();
const createMenuItemSchema = {
  safeParse: mockSafeParse
};

// Mock required modules
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockDb),
  credential: {
    applicationDefault: jest.fn()
  }
}));

// Modify imported admin object
const admin = require('firebase-admin');
// Add FieldValue.serverTimestamp
admin.firestore.FieldValue = {
  serverTimestamp: serverTimestampMock
};
// Add Timestamp class
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

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-item-uuid-123')
}));

// Mock functions.logger
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('MenuItem Handlers - createMenuItem', () => {
  // Import the function to test
  let { createMenuItem } = require('../menuItem.handlers');

  // Import entire module so we can modify implementations for testing
  const handlers = require('../menuItem.handlers');
  
  // Test variables
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testCategoryId = 'category-1';

  beforeEach(() => {
    // Clear mocks
    mockSet.mockClear();
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockGet.mockClear();
    mockSafeParse.mockReset();
    
    // Inject mocked schema validator
    handlers.createMenuItemSchema = createMenuItemSchema;
    
    // Create mock request and response
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
        name: 'Crispy Chicken',
        description: 'Delicious fried chicken with special sauce',
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
    
    // Default successful validation response
    mockSafeParse.mockReturnValue({
      success: true,
      data: mockRequest.body
    });
  });

  // Test case 1: Successfully create menu item
  test('Should create menu item and return 201 status code', async () => {
    // Mock category exists
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });
    
    // Mock query for created item
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 'test-item-uuid-123',
        name: 'Crispy Chicken',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() }
      })
    });
    
    // Execute test
    await createMenuItem(mockRequest, mockResponse);
    
    // Verify Firestore interactions
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testCategoryId);
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith('test-item-uuid-123');
    expect(mockSet).toHaveBeenCalledTimes(1);
    
    // Verify response
    expect(statusJsonSpy).toHaveBeenCalledWith(201);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: '菜單品項創建成功'
    }));
  });

  // Test case 2: User missing tenant ID
  test('Should return 403 when user lacks tenant ID', async () => {
    // Modify request to remove tenant ID
    mockRequest.user = {
      uid: testUserId,
      role: 'tenant_admin'
      // tenantId intentionally omitted
    };
    
    // Execute test
    await createMenuItem(mockRequest, mockResponse);
    
    // Verify response
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '沒有權限：用戶缺少租戶ID'
    }));
    
    // Verify no write operations occurred
    expect(mockSet).not.toHaveBeenCalled();
  });

  // Test case 3: Validation failure
  test('Should return 403 when validation fails', async () => {
    // Set validation failure
    mockSafeParse.mockReturnValue({
      success: false,
      error: {
        errors: [{ message: 'Menu item name cannot be empty' }]
      }
    });
    
    // Execute test
    await createMenuItem(mockRequest, mockResponse);
    
    // Verify response
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺服器內部錯誤'
    }));
    
    // Verify no write operations occurred
    expect(mockSet).not.toHaveBeenCalled();
  });

  // Test case 4: Category not found
  test('Should return 404 when category is not found', async () => {
    // Mock category doesn't exist
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // Execute test
    await createMenuItem(mockRequest, mockResponse);
    
    // Verify response
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '指定的菜單分類不存在'
    }));
    
    // Verify no write operations occurred
    expect(mockSet).not.toHaveBeenCalled();
  });

  // Test case 5: Category from different tenant
  test('Should return 403 when accessing category from another tenant', async () => {
    // Mock category exists but belongs to different tenant
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: 'different-tenant-id',
        name: 'Main Dishes'
      })
    });
    
    // Execute test
    await createMenuItem(mockRequest, mockResponse);
    
    // Verify response
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '沒有權限：無法訪問其他租戶的菜單分類'
    }));
    
    // Verify no write operations occurred
    expect(mockSet).not.toHaveBeenCalled();
  });

  // Test case 6: Database error
  test('Should return 500 when database operation fails', async () => {
    // Mock category exists
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });
    
    // Mock database write failure
    const testError = new Error('Database write failed');
    mockSet.mockRejectedValueOnce(testError);
    
    // Execute test
    await createMenuItem(mockRequest, mockResponse);
    
    // Verify response
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '伺服器內部錯誤'
    }));
  });
}); 