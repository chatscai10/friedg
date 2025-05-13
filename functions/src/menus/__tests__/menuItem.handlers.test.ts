/**
 * æ¸¬è©¦ menuItem.handlers.js ä¸­ç??¹æ?
 */

// æ¨¡æ“¬ firebase-admin
const serverTimestampMock = jest.fn().mockReturnValue('mocked_server_timestamp');
const mockSet = jest.fn().mockResolvedValue(true);
const mockGet = jest.fn();
const mockDoc = jest.fn().mockReturnValue({
  set: mockSet,
  get: mockGet,
  update: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true)
});

// æ¨¡æ“¬ count() ?¹æ?
const mockCount = jest.fn().mockReturnValue({
  get: jest.fn().mockResolvedValue({
    data: () => ({ count: 10 })
  })
});

// æ¨¡æ“¬ Firestore ?¥è©¢?¹æ?
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

// æ¨¡æ“¬ Zod é©—è?
const mockSafeParse = jest.fn();
const createMenuItemSchema = {
  safeParse: mockSafeParse
};

// å¿…é??¨å??¥è¢«æ¸¬è©¦æ¨¡å?ä¹‹å??²è?æ¨¡æ“¬
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockDb),
  credential: {
    applicationDefault: jest.fn()
  }
}));

// ?´æ¥ä¿®æ”¹å°å…¥å¾Œç? admin å°è±¡
const admin = require('firebase-admin');
// æ·»å? FieldValue.serverTimestamp
admin.firestore.FieldValue = {
  serverTimestamp: serverTimestampMock
};
// æ·»å? Timestamp é¡å?
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

// æ¨¡æ“¬ uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-item-uuid-123')
}));

// æ¨¡æ“¬ functions.logger
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// æº–å?æ¸¬è©¦
// ä¸ç›´?¥å??¥express?„Request?ŒResponseä»¥é¿?è?ä¸Šå±¤è®Šæ•¸è¡ç?
// const { Request, Response } = require('express');

describe('MenuItem Handlers - createMenuItem', () => {
  // å°å…¥è¢«æ¸¬è©¦ç??•ç???
  let { createMenuItem } = require('../menuItem.handlers');

  // ?Ÿå?æ¨¡ç??„å??¨ï??¹ä¾¿?‘å€‘åœ¨æ¸¬è©¦?ä¿®?¹æ¨¡?¬å¯¦??
  const handlers = require('../menuItem.handlers');
  
  // æ¸¬è©¦?¸æ?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testCategoryId = 'category-1';

  beforeEach(() => {
    // æ¸…ç??€?‰æ¨¡??
    mockSet.mockClear();
    mockDoc.mockClear();
    mockCollection.mockClear();
    mockGet.mockClear();
    mockSafeParse.mockReset();
    
    // æ³¨å…¥æ¨¡æ“¬?„createMenuItemSchema
    handlers.createMenuItemSchema = createMenuItemSchema;
    
    // ?µå»ºæ¨¡æ“¬è«‹æ??ŒéŸ¿??
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
        name: '?†çš®?æ?',
        description: 'é¦™è?å¤šæ??„æ??Œé???,
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
    
    // é»˜è??…æ?ä¸‹ï?Zodé©—è??šé?
    mockSafeParse.mockReturnValue({
      success: true,
      data: mockRequest.body
    });
  });

  // æ¸¬è©¦æ¡ˆä?1: ?å??µå»º?œå–®?é?
  test('?å??µå»º?œå–®?é?ä¸¦è???01?€??, async () => {
    // æ¨¡æ“¬?†é?å­˜åœ¨
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });
    
    // æ¨¡æ“¬?µå»ºå¾Œç??…ç›®?¥è©¢
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: 'test-item-uuid-123',
        name: '?†çš®?æ?',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() }
      })
    });
    
    // ?·è?æ¸¬è©¦
    await createMenuItem(mockRequest, mockResponse);
    
    // é©—è? Firestore ?ä?
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testCategoryId);
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith('test-item-uuid-123');
    expect(mockSet).toHaveBeenCalledTimes(1);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(201);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: '?œå–®?…ç›®?µå»º?å?'
    }));
  });

  // æ¸¬è©¦æ¡ˆä?2: ?¨æˆ¶ç¼ºå?ç§Ÿæˆ¶ID
  test('?¶ç”¨?¶ç¼ºå°‘ç??¶ID?‚æ?è¿”å?403?¯èª¤', async () => {
    // ä¿®æ”¹è«‹æ?ï¼Œä½¿?¨æˆ¶ç¼ºå?ç§Ÿæˆ¶ID
    mockRequest.user = {
      uid: testUserId,
      role: 'tenant_admin'
      // ?…æ?ä¸è¨­ç½?tenantId
    };
    
    // ?·è?æ¸¬è©¦
    await createMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'æ²’æ?æ¬Šé?ï¼šç”¨?¶ç¼ºå°‘ç??¶ID'
    }));
    
    // ä¸æ?è©²åŸ·è¡Œå¯«?¥æ?ä½?
    expect(mockSet).not.toHaveBeenCalled();
  });

  // æ¸¬è©¦æ¡ˆä?3: é©—è?å¤±æ?
  test('?¶è¼¸?¥é?è­‰å¤±?—æ??‰è???00?¯èª¤', async () => {
    // è¨­ç½® Zod é©—è?å¤±æ?
    mockSafeParse.mockReturnValue({
      success: false,
      error: {
        errors: [{ message: '?œå–®?…ç›®?ç¨±ä¸èƒ½?ºç©º' }]
      }
    });
    
    // ?·è?æ¸¬è©¦
    await createMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'ä¼ºæ??¨å…§?¨éŒ¯èª?
    }));
    
    // ä¸æ?è©²åŸ·è¡Œå¯«?¥æ?ä½?
    expect(mockSet).not.toHaveBeenCalled();
  });

  // æ¸¬è©¦æ¡ˆä?4: ?¾ä??°æ?å®šç??œå–®?†é?
  test('?¶æ‰¾ä¸åˆ°?‡å??„è??®å?é¡æ??‰è???04?¯èª¤', async () => {
    // è¨­ç½® mockGet è¿”å?ä¸å??¨ç??‡æ?
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // ?·è?æ¸¬è©¦
    await createMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: '?‡å??„è??®å?é¡ä?å­˜åœ¨'
    }));
    
    // ä¸æ?è©²åŸ·è¡Œå¯«?¥æ?ä½?
    expect(mockSet).not.toHaveBeenCalled();
  });

  // æ¸¬è©¦æ¡ˆä?5: ?—è©¦è¨ªå??¶ä?ç§Ÿæˆ¶?„è??®å?é¡?
  test('?¶å?è©¦ä½¿?¨å…¶ä»–ç??¶ç??œå–®?†é??‚æ?è¿”å?403?¯èª¤', async () => {
    // è¨­ç½® mockGet è¿”å??¶ä?ç§Ÿæˆ¶?„å?é¡?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: 'other-tenant-id', // ?¶ä?ç§Ÿæˆ¶
        name: 'Other Tenant Category'
      })
    });
    
    // ?·è?æ¸¬è©¦
    await createMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'æ²’æ?æ¬Šé?ï¼šç„¡æ³•è¨ª?å…¶ä»–ç??¶ç??œå–®?†é?'
    }));
    
    // ä¸æ?è©²åŸ·è¡Œå¯«?¥æ?ä½?
    expect(mockSet).not.toHaveBeenCalled();
  });

  // æ¸¬è©¦æ¡ˆä?6: ?¸æ?åº«å¯«?¥éŒ¯èª?
  test('?¶æ•¸?šåº«å¯«å…¥?¯èª¤?‚æ?è¿”å?500?¯èª¤', async () => {
    // è¨­ç½® mockGet è¿”å??‰æ??„å?é¡?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        tenantId: testTenantId,
        name: 'Main Dishes'
      })
    });
    
    // è¨­ç½® mockSet ?‹å‡º?°å¸¸
    const testError = new Error('?¸æ?åº«å¯«?¥å¤±??);
    mockSet.mockRejectedValueOnce(testError);
    
    // ?·è?æ¸¬è©¦
    await createMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'ä¼ºæ??¨å…§?¨éŒ¯èª?
    }));
  });
});

describe('MenuItem Handlers - listMenuItems', () => {
  // å°å…¥è¢«æ¸¬è©¦ç??•ç???
  let { listMenuItems } = require('../menuItem.handlers');
  
  // ?ç½®?€?‰æ¨¡??
  beforeEach(() => {
    jest.clearAllMocks();
    
    // è¨­ç½® where, orderBy, limit, startAfter ?¹æ??„é?è¨­æ¨¡??
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
  
  // æ¸¬è©¦?¸æ?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testCategoryId = 'category-1';
  
  // ?µå»ºå¸¸è??„æ¸¬è©¦è??®å??…æ•¸??
  const createTestMenuItem = (id, overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
    
    return {
      id: id || `item-${Math.random().toString(36).substring(2, 7)}`,
      tenantId: testTenantId,
      name: `æ¸¬è©¦?é? ${id}`,
      description: `æ¸¬è©¦?é? ${id} ?„æ?è¿°`,
      categoryId: testCategoryId,
      categoryName: 'ä¸»è?',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['?±é?', '?¨è–¦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };
  
  const setupMockRequestResponse = (queryParams = {}) => {
    // ?µå»ºæ¨¡æ“¬è«‹æ??ŒéŸ¿??
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
  
  // æ¸¬è©¦æ¡ˆä?1: ?å??²å??œå–®?é??—è¡¨ï¼ˆç„¡?æ¿¾æ¢ä»¶ï¼?
  test('?å??²å??œå–®?é??—è¡¨ä¸¦è???00?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?µå»ºæ¸¬è©¦?¸æ?
    const testItems = [
      createTestMenuItem('item-1'),
      createTestMenuItem('item-2'),
      createTestMenuItem('item-3')
    ];
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
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
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è? Firestore ?ä?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', testTenantId);
    expect(mockOrderBy).toHaveBeenCalledWith('categoryId', 'asc');
    expect(mockOrderBy).toHaveBeenCalledWith('name', 'asc');
    expect(mockLimit).toHaveBeenCalledWith(20);
    
    // é©—è??¿æ?
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
    
    // é©—è?è¿”å??¸æ??„æ??“æˆ³å·²æ ¼å¼å?
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(typeof item.createdAt).toBe('string');
      expect(typeof item.updatedAt).toBe('string');
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?2: ç§Ÿæˆ¶?”é›¢
  test('ç§Ÿæˆ¶?”é›¢ - ?ªè??ç•¶?ç??¶ç??é?', async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?µå»ºæ¸¬è©¦?¸æ? - å·²ç??‡è¨­ Firestore ?¥è©¢?ªè??ç•¶?ç??¶ç??…ç›®
    const testItems = [
      createTestMenuItem('item-1', { tenantId: testTenantId }),
      createTestMenuItem('item-2', { tenantId: testTenantId })
    ];
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
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
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è? Firestore ?ä? - æª¢æŸ¥?¯å¦?‰ç”¨äº†ç??¶é???
    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', testTenantId);
    
    // é©—è??¿æ? - ?‰åª?…å«?¶å?ç§Ÿæˆ¶?„å???
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    expect(responseData.length).toBe(2);
    responseData.forEach(item => {
      expect(item.tenantId).toBe(testTenantId);
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?3: ?†é??è¼¯ (limit)
  test('?†é??è¼¯ - ?¹æ? limit ?ƒæ•¸è¿”å?æ­?¢º?„æ•¸??, async () => {
    // ?ç½®æ¯é?10??
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      limit: 10
    });
    
    // ?µå»º 10 ?‹æ¸¬è©¦å???
    const testItems = Array.from({ length: 10 }, (_, i) => 
      createTestMenuItem(`item-${i+1}`)
    );
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
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
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è??†é??ƒæ•¸
    expect(mockLimit).toHaveBeenCalledWith(10);
    
    // é©—è??¿æ?
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(responseData.items.length).toBe(10);
    expect(responseData.pagination).toEqual({
      pageSize: 10,
      hasMore: true,  // ? ç‚ºè¿”å?äº†å?å¥½ç???limit ?„é??®æ•¸
      lastVisible: expect.any(Object)
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?4: ?‰å?é¡ID?æ¿¾
  test('?æ¿¾æ¢ä»¶ - ?¹æ? categoryId ?æ¿¾', async () => {
    // ?ç½®?‰å?é¡ID?æ¿¾
    const specificCategoryId = 'specific-category-id';
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      categoryId: specificCategoryId
    });
    
    // ?µå»ºæ¸¬è©¦?¸æ?ï¼ˆéƒ½å±¬æ–¼?Œä??†é?ï¼?
    const testItems = [
      createTestMenuItem('item-1', { categoryId: specificCategoryId }),
      createTestMenuItem('item-2', { categoryId: specificCategoryId })
    ];
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
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
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è??æ¿¾æ¢ä»¶
    expect(mockWhere).toHaveBeenCalledWith('categoryId', '==', specificCategoryId);
    
    // é©—è?è¿”å??„æ•¸?šéƒ½å±¬æ–¼?‡å??†é?
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(item.categoryId).toBe(specificCategoryId);
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?5: ?‰å??¨ç??‹é?æ¿?
  test('?æ¿¾æ¢ä»¶ - ?¹æ? isActive ?æ¿¾', async () => {
    // ?ç½®?ªé¡¯ç¤ºå??¨ç??é?
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      isActive: 'true' // ?¥è©¢?ƒæ•¸?¯å?ç¬¦ä¸²
    });
    
    // ?µå»ºæ¸¬è©¦?¸æ?ï¼ˆéƒ½?¯å??¨ç??‹ï?
    const testItems = [
      createTestMenuItem('item-1', { isActive: true }),
      createTestMenuItem('item-2', { isActive: true })
    ];
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
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
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è??æ¿¾æ¢ä»¶ - å­—ç¬¦ä¸?'true' ?‰è??›ç‚ºå¸ƒçˆ¾??true
    expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
    
    // é©—è?è¿”å??„æ•¸?šéƒ½?¯å??¨ç???
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(item.isActive).toBe(true);
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?6: ?‰åº«å­˜ç??‹é?æ¿?
  test('?æ¿¾æ¢ä»¶ - ?¹æ? stockStatus ?æ¿¾', async () => {
    // ?ç½®?ªé¡¯ç¤ºç‰¹å®šåº«å­˜ç??‹ç??é?
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      stockStatus: 'low_stock'
    });
    
    // ?µå»ºæ¸¬è©¦?¸æ?ï¼ˆéƒ½?¯ç›¸?Œåº«å­˜ç??‹ï?
    const testItems = [
      createTestMenuItem('item-1', { stockStatus: 'low_stock' }),
      createTestMenuItem('item-2', { stockStatus: 'low_stock' })
    ];
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
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
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è??æ¿¾æ¢ä»¶
    expect(mockWhere).toHaveBeenCalledWith('stockStatus', '==', 'low_stock');
    
    // é©—è?è¿”å??„æ•¸?šéƒ½?¯ç‰¹å®šåº«å­˜ç???
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    responseData.forEach(item => {
      expect(item.stockStatus).toBe('low_stock');
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?7: æ¸¸æ??†é?
  test('æ¸¸æ??†é? - ä½¿ç”¨ lastItemId ??lastCategoryId ?ƒæ•¸', async () => {
    // è¨­ç½®æ¸¸æ??†é??ƒæ•¸
    const lastItemId = 'last-item-id';
    const lastCategoryId = 'last-category-id';
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      lastItemId,
      lastCategoryId
    });
    
    // ?µå»ºæ¸¬è©¦?¸æ? - æ¨¡æ“¬?€å¾Œä??‹é???
    const lastItem = createTestMenuItem(lastItemId, { 
      categoryId: lastCategoryId,
      name: 'Last Item Name'
    });
    
    // ?µå»ºä¸‹ä??ç??…ç›®
    const nextPageItems = [
      createTestMenuItem('next-item-1'),
      createTestMenuItem('next-item-2')
    ];
    
    // æ¨¡æ“¬?²å?ä¸Šä??æ?å¾Œä??‹é??®ç??‡æ?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => lastItem
    });
    
    // æ¨¡æ“¬ä¸‹ä??æŸ¥è©¢ç???
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
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è??¯å¦æ­?¢º?²å?äº†ä?ä¸€?æ?å¾Œä??‹é???
    expect(mockDoc).toHaveBeenCalledWith(lastItemId);
    
    // é©—è??¯å¦æ­?¢ºè¨­ç½®äº?startAfter
    expect(mockStartAfter).toHaveBeenCalledWith(lastCategoryId, lastItem.name);
    
    // é©—è?è¿”å??„æ˜¯ä¸‹ä??ç??¸æ?
    const responseData = jsonSpy.mock.calls[0][0].data.items;
    expect(responseData.length).toBe(2);
    expect(responseData[0].id).toBe('next-item-1');
    expect(responseData[1].id).toBe('next-item-2');
  });
  
  // æ¸¬è©¦æ¡ˆä?8: ç©ºå?è¡¨æ?æ³?
  test('è¿”å?ç©ºå?è¡?- ?¶æŸ¥è©¢ç??œç‚ºç©ºæ?', async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ç©ºå?è¡?
    mockGet.mockResolvedValueOnce({
      forEach: () => {} // ç©ºå‡½?¸ï?ä¸èª¿?¨å?èª?
    });
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è??¿æ?
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
  
  // æ¸¬è©¦æ¡ˆä?9: ?¡æ??„åº«å­˜ç??‹å€?
  test('?¯èª¤?•ç? - ?¡æ??„åº«å­˜ç??‹å€¼è???00?¯èª¤', async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??- ä½¿ç”¨?¡æ??„åº«å­˜ç??‹å€?
    const { mockRequest, mockResponse } = setupMockRequestResponse({
      stockStatus: 'invalid_status'
    });
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('?¡æ??„åº«å­˜ç??‹å€?)
    }));
  });
  
  // æ¸¬è©¦æ¡ˆä?10: ?¨æˆ¶ç¼ºå?ç§Ÿæˆ¶ID
  test('?¯èª¤?•ç? - ?¶ç”¨?¶ç¼ºå°‘ç??¶ID?‚æ?è¿”å?500?¯èª¤', async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ä¿®æ”¹è«‹æ?ï¼Œä½¿?¨æˆ¶ç¼ºå?ç§Ÿæˆ¶ID
    mockRequest.user = {
      uid: testUserId,
      role: 'tenant_admin'
      // ?…æ?ä¸è¨­ç½?tenantId
    };
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è??¿æ? - æ³¨æ?ï¼šç•¶?å¯¦?¾æ˜¯??500 ?¯èª¤ä¸­æ??²é€™ç¨®?…æ?ï¼Œæœª?ç¢º?•ç?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'ä¼ºæ??¨å…§?¨éŒ¯èª?
    }));
  });
  
  // æ¸¬è©¦æ¡ˆä?11: Firestore ?¥è©¢å¤±æ?
  test('?¯èª¤?•ç? - ??Firestore ?¥è©¢å¤±æ??‚æ?è¿”å?500?¯èª¤', async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢?‹å‡º?°å¸¸
    const testError = new Error('?¸æ?åº«æŸ¥è©¢å¤±??);
    mockGet.mockRejectedValueOnce(testError);
    
    // ?·è?æ¸¬è©¦
    await listMenuItems(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'ä¼ºæ??¨å…§?¨éŒ¯èª?,
      error: '?¸æ?åº«æŸ¥è©¢å¤±??
    }));
  });
});

describe('MenuItem Handlers - getMenuItemById', () => {
  // å°å…¥è¢«æ¸¬è©¦ç??•ç???
  let { getMenuItemById } = require('../menuItem.handlers');
  
  // ?ç½®?€?‰æ¨¡??
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // æ¸¬è©¦?¸æ?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testItemId = 'test-item-id';
  
  // ?µå»ºæ¸¬è©¦?œå–®?é??¸æ?
  const createTestMenuItem = (overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
    
    return {
      id: testItemId,
      tenantId: testTenantId,
      name: 'æ¸¬è©¦?é?',
      description: 'æ¸¬è©¦?é??„æ?è¿?,
      categoryId: 'category-1',
      categoryName: 'ä¸»è?',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['?±é?', '?¨è–¦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };
  
  const setupMockRequestResponse = (params = {}) => {
    // ?µå»ºæ¨¡æ“¬è«‹æ??ŒéŸ¿??
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
  
  // æ¸¬è©¦æ¡ˆä?1: ?å??²å??œå–®?é?
  test('?å??²å??œå–®?é?ä¸¦è???00?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?µå»ºæ¸¬è©¦?¸æ?
    const testItem = createTestMenuItem();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // ?·è?æ¸¬è©¦
    await getMenuItemById(mockRequest, mockResponse);
    
    // é©—è? Firestore ?ä?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockGet).toHaveBeenCalled();
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        id: testItemId,
        name: 'æ¸¬è©¦?é?',
        tenantId: testTenantId
      })
    });
    
    // é©—è??‚é??³æ ¼å¼å?
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(typeof responseData.createdAt).toBe('string');
    expect(typeof responseData.updatedAt).toBe('string');
  });
  
  // æ¸¬è©¦æ¡ˆä?2: ?¾ä??°æ?å®šç??œå–®?é?
  test('?¾ä??°æ?å®šç??œå–®?é??‚è???04?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ä¸å??¨ç??‡æ?
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // ?·è?æ¸¬è©¦
    await getMenuItemById(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '?¾ä??°æ?å®šç??œå–®?…ç›®'
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?3: ç§Ÿæˆ¶?”é›¢ - ?—è©¦è¨ªå??¶ä?ç§Ÿæˆ¶?„è??®å???
  test('ç§Ÿæˆ¶?”é›¢: è¨ªå??¶ä?ç§Ÿæˆ¶?„è??®å??…æ?è¿”å?403?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?µå»ºæ¸¬è©¦?¸æ? - å±¬æ–¼?¶ä?ç§Ÿæˆ¶
    const otherTenantItem = createTestMenuItem({
      tenantId: 'other-tenant-id'
    });
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantItem
    });
    
    // ?·è?æ¸¬è©¦
    await getMenuItemById(mockRequest, mockResponse);
    
    // é©—è?ç§Ÿæˆ¶?”é›¢æª¢æŸ¥
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: 'æ²’æ?æ¬Šé?ï¼šç„¡æ³•è¨ª?å…¶ä»–ç??¶ç??œå–®?…ç›®'
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?4: è«‹æ?ç¼ºå?å¿…è??„é???ID
  test('ç¼ºå?å¿…è??„é??®ID?‚è???00?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿?‰ï?ä½†ä??ä? itemId
    const { mockRequest, mockResponse } = setupMockRequestResponse({ itemId: undefined });
    
    // ?·è?æ¸¬è©¦
    await getMenuItemById(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: 'ç¼ºå?å¿…è??„è??®é??®ID?ƒæ•¸'
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?5: Firestore ?¥è©¢å¤±æ?
  test('Firestore ?¥è©¢å¤±æ??‚è???00?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢å¤±æ?
    const testError = new Error('?¸æ?åº«æŸ¥è©¢å¤±??);
    mockGet.mockRejectedValueOnce(testError);
    
    // ?·è?æ¸¬è©¦
    await getMenuItemById(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: 'ä¼ºæ??¨å…§?¨éŒ¯èª?,
      error: '?¸æ?åº«æŸ¥è©¢å¤±??
    });
  });
});

describe('MenuItem Handlers - updateMenuItem', () => {
  // å°å…¥è¢«æ¸¬è©¦ç??•ç???
  let { updateMenuItem } = require('../menuItem.handlers');
  
  // ?ç½®?€?‰æ¨¡??
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // æ¸¬è©¦?¸æ?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testStoreId = 'test-store-id';
  const testUserId = 'test-user-123';
  const testItemId = 'test-item-id';
  const testCategoryId = 'category-1';
  const testNewCategoryId = 'category-2';
  
  // ?µå»ºæ¸¬è©¦?œå–®?é??¸æ?
  const createTestMenuItem = (overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
    
    return {
      id: testItemId,
      tenantId: testTenantId,
      name: 'æ¸¬è©¦?é?',
      description: 'æ¸¬è©¦?é??„æ?è¿?,
      categoryId: testCategoryId,
      categoryName: 'ä¸»è?',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['?±é?', '?¨è–¦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };
  
  const setupMockRequestResponse = (itemId = testItemId, updateData = {}) => {
    // ?µå»ºæ¨¡æ“¬è«‹æ??ŒéŸ¿??
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
  
  // æ¸¬è©¦æ¡ˆä?1: ?å??´æ–°?¨å?æ¬„ä?
  test('?å??´æ–°?¨å?æ¬„ä?ä¸¦è???00?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??- ?ªæ›´?°å?ç¨±å??¹æ ¼
    const updateData = {
      name: '?´æ–°?„å??…å?ç¨?,
      price: 60
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);
    
    // ?µå»ºæ¸¬è©¦?¸æ?
    const testItem = createTestMenuItem();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ?²å??¾æ??é?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // æ¨¡æ“¬?´æ–°?ä?
    const mockUpdate = jest.fn().mockResolvedValue(true);
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate
    });
    
    // æ¨¡æ“¬?²å??´æ–°å¾Œç??é?
    const updatedItem = {
      ...testItem,
      ...updateData,
      updatedAt: new admin.firestore.Timestamp(Date.now() / 1000 + 100, 0) // ?‡è¨­?´æ–°?‚é?æ¯”å‰µå»ºæ??“æ?
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => updatedItem
    });
    
    // ?·è?æ¸¬è©¦
    await updateMenuItem(mockRequest, mockResponse);
    
    // é©—è? Firestore ?ä?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockGet).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    
    // é©—è??´æ–°?¸æ?
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).toHaveProperty('name', '?´æ–°?„å??…å?ç¨?);
    expect(updateArg).toHaveProperty('price', 60);
    expect(updateArg).toHaveProperty('updatedAt');
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '?œå–®?é??´æ–°?å?',
      data: expect.objectContaining({
        id: testItemId,
        name: '?´æ–°?„å??…å?ç¨?,
        price: 60
      })
    });
    
    // é©—è??‚é??³æ ¼å¼å?
    const responseData = jsonSpy.mock.calls[0][0].data;
    expect(typeof responseData.createdAt).toBe('string');
    expect(typeof responseData.updatedAt).toBe('string');
  });
  
  // æ¸¬è©¦æ¡ˆä?2: ?¾ä??°æ?å®šç??œå–®?é?
  test('?¾ä??°æ?å®šç??œå–®?é??‚è???04?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ä¸å??¨ç??‡æ?
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // ?·è?æ¸¬è©¦
    await updateMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '?¾ä??°æ?å®šç??œå–®?é?'
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?3: ç§Ÿæˆ¶?”é›¢ - ?—è©¦?´æ–°?¶ä?ç§Ÿæˆ¶?„è??®å???
  test('ç§Ÿæˆ¶?”é›¢: ?´æ–°?¶ä?ç§Ÿæˆ¶?„è??®å??…æ?è¿”å?403?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?µå»ºæ¸¬è©¦?¸æ? - å±¬æ–¼?¶ä?ç§Ÿæˆ¶
    const otherTenantItem = createTestMenuItem({
      tenantId: 'other-tenant-id'
    });
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantItem
    });
    
    // ?·è?æ¸¬è©¦
    await updateMenuItem(mockRequest, mockResponse);
    
    // é©—è?ç§Ÿæˆ¶?”é›¢æª¢æŸ¥
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: 'æ²’æ?æ¬Šé?ï¼šç„¡æ³•æ›´?°å…¶ä»–ç??¶ç??œå–®?é?'
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?4: ?´æ–°CategoryID - ?å?
  test('?å??´æ–°?†é?IDä¸¦å?æ­¥æ›´?°å?é¡å?ç¨?, async () => {
    // æº–å?æ¸¬è©¦?¸æ? - ?´æ–°?†é?ID
    const updateData = {
      categoryId: testNewCategoryId
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);
    
    // ?µå»ºæ¸¬è©¦?¸æ?
    const testItem = createTestMenuItem();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ?²å??¾æ??é?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // æ¨¡æ“¬?²å??°å?é¡?
    const newCategory = {
      id: testNewCategoryId,
      tenantId: testTenantId,
      name: '?°å?é¡å?ç¨?
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => newCategory
    });
    
    // æ¨¡æ“¬?´æ–°?ä?
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
    
    // æ¨¡æ“¬?²å??´æ–°å¾Œç??é?
    const updatedItem = {
      ...testItem,
      categoryId: testNewCategoryId,
      categoryName: '?°å?é¡å?ç¨?,
      updatedAt: new admin.firestore.Timestamp(Date.now() / 1000 + 100, 0)
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => updatedItem
    });
    
    // ?·è?æ¸¬è©¦
    await updateMenuItem(mockRequest, mockResponse);
    
    // é©—è? Firestore ?ä?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockDoc).toHaveBeenCalledWith(testNewCategoryId);
    
    // é©—è??´æ–°?¸æ??…å«categoryName
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).toHaveProperty('categoryId', testNewCategoryId);
    expect(updateArg).toHaveProperty('categoryName', '?°å?é¡å?ç¨?);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '?œå–®?é??´æ–°?å?',
      data: expect.objectContaining({
        categoryId: testNewCategoryId,
        categoryName: '?°å?é¡å?ç¨?
      })
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?5: ?´æ–°CategoryID - ?¾ä??°æ–°?†é?
  test('?´æ–°?†é?ID?‚æ‰¾ä¸åˆ°?°å?é¡è???04?€??, async () => {
    // æº–å?æ¸¬è©¦?¸æ? - ?¡æ??„å?é¡ID
    const updateData = {
      categoryId: 'non-existent-category'
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);
    
    // ?µå»ºæ¸¬è©¦?¸æ?
    const testItem = createTestMenuItem();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ?²å??¾æ??é?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // æ¨¡æ“¬?²å??°å?é¡?- ä¸å???
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // ?·è?æ¸¬è©¦
    await updateMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '?‡å??„æ–°?œå–®?†é?ä¸å???
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?6: ?´æ–°CategoryID - ?¶ä?ç§Ÿæˆ¶?„å?é¡?
  test('?´æ–°?†é?ID?‚ä½¿?¨å…¶ä»–ç??¶ç??†é?è¿”å?403?€??, async () => {
    // æº–å?æ¸¬è©¦?¸æ? - ?¶ä?ç§Ÿæˆ¶?„å?é¡ID
    const updateData = {
      categoryId: 'other-tenant-category'
    };
    const { mockRequest, mockResponse } = setupMockRequestResponse(testItemId, updateData);
    
    // ?µå»ºæ¸¬è©¦?¸æ?
    const testItem = createTestMenuItem();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ?²å??¾æ??é?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // æ¨¡æ“¬?²å??°å?é¡?- å±¬æ–¼?¶ä?ç§Ÿæˆ¶
    const otherTenantCategory = {
      id: 'other-tenant-category',
      tenantId: 'other-tenant-id',
      name: '?¶ä?ç§Ÿæˆ¶?„å?é¡?
    };
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantCategory
    });
    
    // ?·è?æ¸¬è©¦
    await updateMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: 'æ²’æ?æ¬Šé?ï¼šç„¡æ³•ä½¿?¨å…¶ä»–ç??¶ç??œå–®?†é?'
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?7: Firestore ?´æ–°å¤±æ?
  test('Firestore ?´æ–°å¤±æ??‚è???00?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    //
    const testItem = createTestMenuItem();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ?é?å­˜åœ¨
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // æ¨¡æ“¬?´æ–°?ä?å¤±æ?
    const mockUpdate = jest.fn().mockRejectedValue(new Error('?¸æ?åº«æ›´?°å¤±??));
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate
    });
    
    // ?·è?æ¸¬è©¦
    await updateMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: 'ä¼ºæ??¨å…§?¨éŒ¯èª?,
      error: '?¸æ?åº«æ›´?°å¤±??
    });
  });
});

describe('MenuItem Handlers - deleteMenuItem', () => {
  // å°å…¥è¢«æ¸¬è©¦ç??•ç???
  let { deleteMenuItem } = require('../menuItem.handlers');
  
  // ?ç½®?€?‰æ¨¡??
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // æ¸¬è©¦?¸æ?
  let mockRequest, mockResponse;
  let jsonSpy, statusJsonSpy;
  const testTenantId = 'test-tenant-id';
  const testUserId = 'test-user-123';
  const testItemId = 'test-item-id';
  
  // ?µå»ºæ¸¬è©¦?œå–®?é??¸æ?
  const createTestMenuItem = (overrides = {}) => {
    const timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
    
    return {
      id: testItemId,
      tenantId: testTenantId,
      name: 'æ¸¬è©¦?é?',
      description: 'æ¸¬è©¦?é??„æ?è¿?,
      categoryId: 'category-1',
      categoryName: 'ä¸»è?',
      price: 50,
      stockStatus: 'in_stock',
      isRecommended: false,
      isSpecial: false,
      isActive: true,
      tags: ['?±é?', '?¨è–¦'],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...overrides
    };
  };
  
  const setupMockRequestResponse = (itemId = testItemId) => {
    // ?µå»ºæ¨¡æ“¬è«‹æ??ŒéŸ¿??
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
  
  // æ¸¬è©¦æ¡ˆä?1: ?å??ªé™¤?œå–®?é?
  test('?å??ªé™¤?œå–®?é?ä¸¦è???00?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?µå»ºæ¸¬è©¦?¸æ?
    const testItem = createTestMenuItem();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // æ¨¡æ“¬?ªé™¤?ä?
    const mockDelete = jest.fn().mockResolvedValue(true);
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });
    
    // ?·è?æ¸¬è©¦
    await deleteMenuItem(mockRequest, mockResponse);
    
    // é©—è? Firestore ?ä?
    expect(mockCollection).toHaveBeenCalledWith('menuItems');
    expect(mockDoc).toHaveBeenCalledWith(testItemId);
    expect(mockGet).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(200);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      message: '?œå–®?…ç›® test-item-id å·²æ??Ÿåˆª??
    });
  });
  
  // æ¸¬è©¦æ¡ˆä?2: ?¾ä??°æ?å®šç??œå–®?é?
  test('?¾ä??°æ?å®šç??œå–®?é??‚è???04?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ä¸å??¨ç??‡æ?
    mockGet.mockResolvedValueOnce({
      exists: false
    });
    
    // æ¨¡æ“¬?ªé™¤?ä? (ä¸æ?è©²è¢«èª¿ç”¨)
    const mockDelete = jest.fn();
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });
    
    // ?·è?æ¸¬è©¦
    await deleteMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(404);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: '?¾ä??°æ?å®šç??œå–®?é?'
    });
    
    // é©—è? delete ?¹æ??ªè¢«èª¿ç”¨
    expect(mockDelete).not.toHaveBeenCalled();
  });
  
  // æ¸¬è©¦æ¡ˆä?3: ç§Ÿæˆ¶?”é›¢ - ?—è©¦?ªé™¤?¶ä?ç§Ÿæˆ¶?„è??®å???
  test('ç§Ÿæˆ¶?”é›¢: ?ªé™¤?¶ä?ç§Ÿæˆ¶?„è??®å??…æ?è¿”å?403?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?µå»ºæ¸¬è©¦?¸æ? - å±¬æ–¼?¶ä?ç§Ÿæˆ¶
    const otherTenantItem = createTestMenuItem({
      tenantId: 'other-tenant-id'
    });
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ?
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => otherTenantItem
    });
    
    // æ¨¡æ“¬?ªé™¤?ä? (ä¸æ?è©²è¢«èª¿ç”¨)
    const mockDelete = jest.fn();
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });
    
    // ?·è?æ¸¬è©¦
    await deleteMenuItem(mockRequest, mockResponse);
    
    // é©—è?ç§Ÿæˆ¶?”é›¢æª¢æŸ¥
    expect(statusJsonSpy).toHaveBeenCalledWith(403);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: 'æ²’æ?æ¬Šé?ï¼šç„¡æ³•åˆª?¤å…¶ä»–ç??¶ç??œå–®?é?'
    });
    
    // é©—è? delete ?¹æ??ªè¢«èª¿ç”¨
    expect(mockDelete).not.toHaveBeenCalled();
  });
  
  // æ¸¬è©¦æ¡ˆä?4: Firestore ?ªé™¤å¤±æ?
  test('Firestore ?ªé™¤å¤±æ??‚è???00?€??, async () => {
    // æº–å?æ¸¬è©¦è«‹æ??ŒéŸ¿??
    const { mockRequest, mockResponse } = setupMockRequestResponse();
    
    // ?µå»ºæ¸¬è©¦?¸æ?
    const testItem = createTestMenuItem();
    
    // æ¨¡æ“¬ Firestore ?¥è©¢çµæ? - ?é?å­˜åœ¨
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => testItem
    });
    
    // æ¨¡æ“¬?ªé™¤?ä?å¤±æ?
    const mockDelete = jest.fn().mockRejectedValue(new Error('?¸æ?åº«åˆª?¤å¤±??));
    mockDoc.mockReturnValue({
      get: mockGet,
      delete: mockDelete
    });
    
    // ?·è?æ¸¬è©¦
    await deleteMenuItem(mockRequest, mockResponse);
    
    // é©—è??¿æ?
    expect(statusJsonSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      message: 'ä¼ºæ??¨å…§?¨éŒ¯èª?,
      error: '?¸æ?åº«åˆª?¤å¤±??
    });
  });
}); 
