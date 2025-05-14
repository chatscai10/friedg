/**
 * 測試 menuItem.handlers.js 中的函數
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
// 模擬 firebase-admin
var serverTimestampMock = jest.fn().mockReturnValue('mocked_server_timestamp');
var mockSet = jest.fn().mockResolvedValue(true);
var mockGet = jest.fn();
var mockDoc = jest.fn().mockReturnValue({
    set: mockSet,
    get: mockGet,
    update: jest.fn().mockResolvedValue(true),
    "delete": jest.fn().mockResolvedValue(true)
});
// 模擬 count() 函數
var mockCount = jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({
        data: function () { return ({ count: 10 }); }
    })
});
// 模擬 Firestore 查詢函數
var mockWhere = jest.fn().mockReturnThis();
var mockOrderBy = jest.fn().mockReturnThis();
var mockLimit = jest.fn().mockReturnThis();
var mockOffset = jest.fn().mockReturnThis();
var mockStartAfter;
var mockCollection = jest.fn().mockImplementation(function () { return ({
    doc: mockDoc,
    where: mockWhere,
    orderBy: mockOrderBy,
    get: mockGet,
    limit: mockLimit,
    offset: mockOffset,
    count: mockCount,
    startAfter: mockStartAfter
}); });
var mockDb = { collection: mockCollection };
// 模擬 Zod 驗證
var mockSafeParse = jest.fn();
var createMenuItemSchema = {
    safeParse: mockSafeParse
};
// 必須在被測試模塊之前進行模擬
jest.mock('firebase-admin', function () { return ({
    initializeApp: jest.fn(),
    firestore: jest.fn(function () { return mockDb; }),
    credential: {
        applicationDefault: jest.fn()
    }
}); });
// 直接修改導入後的 admin 對象
var admin = require('firebase-admin');
// 添加 FieldValue.serverTimestamp
admin.firestore.FieldValue = {
    serverTimestamp: serverTimestampMock
};
// 添加 Timestamp 類別
admin.firestore.Timestamp = /** @class */ (function () {
    function Timestamp(seconds, nanoseconds) {
        this.seconds = seconds;
        this.nanoseconds = nanoseconds;
    }
    Timestamp.prototype.toDate = function () {
        return new Date(this.seconds * 1000);
    };
    return Timestamp;
}());
// 模擬 uuid
jest.mock('uuid', function () { return ({
    v4: jest.fn().mockReturnValue('test-item-uuid-123')
}); });
// 模擬 functions.logger
jest.mock('firebase-functions', function () { return ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}); });
// 準�?測試
// 不直?��??�express?�Request?�Response以避?��?上層變數衝�?
// const { Request, Response } = require('express');
describe('MenuItem Handlers - createMenuItem', function () {
    // 導入被測試�??��???
    var createMenuItem = require('../menuItem.handlers').createMenuItem;
    // ?��?模�??��??��??�便?�們在測試?�修?�模?�實??
    var handlers = require('../menuItem.handlers');
    // 測試?��?
    var mockRequest, mockResponse;
    var jsonSpy, statusJsonSpy;
    var testTenantId = 'test-tenant-id';
    var testStoreId = 'test-store-id';
    var testUserId = 'test-user-123';
    var testCategoryId = 'category-1';
    beforeEach(function () {
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
    test('成功創建菜單項目並返回201狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // 模擬分類存在
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return ({
                            tenantId: testTenantId,
                            name: 'Main Dishes'
                        }); }
                    });
                    // 模擬創建後的項目查詢
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return ({
                            id: 'test-item-uuid-123',
                            name: '脆皮雞腿',
                            createdAt: { toDate: function () { return new Date(); } },
                            updatedAt: { toDate: function () { return new Date(); } }
                        }); }
                    });
                    // 執行測試
                    return [4 /*yield*/, createMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _a.sent();
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
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例2: 用戶缺少租戶ID
    test('用戶缺少租戶ID時應返回403錯誤', function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // 修改請求，使用戶缺少租戶ID
                    mockRequest.user = {
                        uid: testUserId,
                        role: 'tenant_admin'
                        // 故意不設置tenantId
                    };
                    // 執行測試
                    return [4 /*yield*/, createMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _a.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(403);
                    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                        success: false,
                        message: '沒有權限：用戶缺少租戶ID'
                    }));
                    // 不應該執行寫入操作
                    expect(mockSet).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例3: 驗證失敗
    test('輸入驗證失敗時應返回500錯誤', function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // 設置 Zod 驗證失敗
                    mockSafeParse.mockReturnValue({
                        success: false,
                        error: {
                            errors: [{ message: '菜單項目名稱不能為空' }]
                        }
                    });
                    // 執行測試
                    return [4 /*yield*/, createMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _a.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(500);
                    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                        success: false,
                        message: '伺服器內部錯誤'
                    }));
                    // 不應該執行寫入操作
                    expect(mockSet).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例4: 找不到指定的菜單分類
    test('找不到指定的菜單分類時應返回404錯誤', function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // 設置 mockGet 返回不存在的分類
                    mockGet.mockResolvedValueOnce({
                        exists: false
                    });
                    // 執行測試
                    return [4 /*yield*/, createMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _a.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(404);
                    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                        success: false,
                        message: '指定的菜單分類不存在'
                    }));
                    // 不應該執行寫入操作
                    expect(mockSet).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例5: 嘗試訪問其他租戶的菜單分類
    test('嘗試使用其他租戶的菜單分類時應返回403錯誤', function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // 設置 mockGet 返回其他租戶的分類
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return ({
                            tenantId: 'other-tenant-id',
                            name: 'Other Tenant Category'
                        }); }
                    });
                    // 執行測試
                    return [4 /*yield*/, createMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _a.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(403);
                    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                        success: false,
                        message: '沒有權限：無法訪問其他租戶的菜單分類'
                    }));
                    // 不應該執行寫入操作
                    expect(mockSet).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例6: 資料庫寫入錯誤
    test('資料庫寫入錯誤時應返回500錯誤', function () { return __awaiter(_this, void 0, void 0, function () {
        var testError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // 設置 mockGet 返回存在的分類
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return ({
                            tenantId: testTenantId,
                            name: 'Main Dishes'
                        }); }
                    });
                    testError = new Error('資料庫寫入失敗');
                    mockSet.mockRejectedValueOnce(testError);
                    // 執行測試
                    return [4 /*yield*/, createMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _a.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(500);
                    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                        success: false,
                        message: '伺服器內部錯誤'
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('MenuItem Handlers - listMenuItems', function () {
    // 導入被測試的函數
    var listMenuItems = require('../menuItem.handlers').listMenuItems;
    // 設置測試模擬
    beforeEach(function () {
        jest.clearAllMocks();
        // 設置 where, orderBy, limit, startAfter 等查詢模擬
        mockWhere.mockReturnThis();
        mockOrderBy.mockReturnThis();
        mockLimit.mockReturnThis();
        mockStartAfter = jest.fn().mockReturnThis();
        mockCollection.mockImplementation(function () { return ({
            doc: mockDoc,
            where: mockWhere,
            orderBy: mockOrderBy,
            limit: mockLimit,
            startAfter: mockStartAfter,
            get: mockGet
        }); });
    });
    // 測試變量
    var mockRequest, mockResponse;
    var jsonSpy, statusJsonSpy;
    var testTenantId = 'test-tenant-id';
    var testStoreId = 'test-store-id';
    var testUserId = 'test-user-123';
    var testCategoryId = 'category-1';
    // 創建常用的測試菜單項目數據
    var createTestMenuItem = function (id, overrides) {
        if (overrides === void 0) { overrides = {}; }
        var timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
        return __assign({ id: id || "item-".concat(Math.random().toString(36).substring(2, 7)), tenantId: testTenantId, name: "\u6E2C\u8A66\u9805\u76EE ".concat(id), description: "\u6E2C\u8A66\u9805\u76EE ".concat(id, " \u7684\u63CF\u8FF0"), categoryId: testCategoryId, categoryName: '主菜', price: 50, stockStatus: 'in_stock', isRecommended: false, isSpecial: false, isActive: true, tags: ['熱門', '推薦'], createdAt: timestamp, updatedAt: timestamp }, overrides);
    };
    var setupMockRequestResponse = function (queryParams) {
        if (queryParams === void 0) { queryParams = {}; }
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
            query: __assign({ limit: 20 }, queryParams)
        };
        mockResponse = {
            status: statusJsonSpy,
            json: jsonSpy
        };
        return { mockRequest: mockRequest, mockResponse: mockResponse };
    };
    // 測試案例1: 成功獲取菜單項目列表（無過濾條件）
    test('成功獲取菜單項目列表並返回200狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testItems, responseData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItems = [
                        createTestMenuItem('item-1'),
                        createTestMenuItem('item-2'),
                        createTestMenuItem('item-3')
                    ];
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        forEach: function (callback) {
                            testItems.forEach(function (item, index) {
                                callback({
                                    data: function () { return item; },
                                    id: item.id
                                });
                            });
                        }
                    });
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
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
                    responseData = jsonSpy.mock.calls[0][0].data.items;
                    responseData.forEach(function (item) {
                        expect(typeof item.createdAt).toBe('string');
                        expect(typeof item.updatedAt).toBe('string');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例2: 租戶隔離
    test('租戶隔離 - 只返回當前租戶的項目', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testItems, responseData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItems = [
                        createTestMenuItem('item-1', { tenantId: testTenantId }),
                        createTestMenuItem('item-2', { tenantId: testTenantId })
                    ];
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        forEach: function (callback) {
                            testItems.forEach(function (item) {
                                callback({
                                    data: function () { return item; },
                                    id: item.id
                                });
                            });
                        }
                    });
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證 Firestore 調用 - 檢查是否使用了租戶過濾
                    expect(mockWhere).toHaveBeenCalledWith('tenantId', '==', testTenantId);
                    responseData = jsonSpy.mock.calls[0][0].data.items;
                    expect(responseData.length).toBe(2);
                    responseData.forEach(function (item) {
                        expect(item.tenantId).toBe(testTenantId);
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例3: 分頁邏輯 (limit)
    test('分頁邏輯 - 使用 limit 參數返回指定數量', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testItems, responseData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse({
                        limit: 10
                    }), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItems = Array.from({ length: 10 }, function (_, i) {
                        return createTestMenuItem("item-".concat(i + 1));
                    });
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        forEach: function (callback) {
                            testItems.forEach(function (item) {
                                callback({
                                    data: function () { return item; },
                                    id: item.id
                                });
                            });
                        }
                    });
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證分頁參數
                    expect(mockLimit).toHaveBeenCalledWith(10);
                    responseData = jsonSpy.mock.calls[0][0].data;
                    expect(responseData.items.length).toBe(10);
                    expect(responseData.pagination).toEqual({
                        pageSize: 10,
                        hasMore: true,
                        lastVisible: expect.any(Object)
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例4: 分類ID過濾
    test('過濾條件 - 使用 categoryId 過濾', function () { return __awaiter(_this, void 0, void 0, function () {
        var specificCategoryId, _a, mockRequest, mockResponse, testItems, responseData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    specificCategoryId = 'specific-category-id';
                    _a = setupMockRequestResponse({
                        categoryId: specificCategoryId
                    }), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItems = [
                        createTestMenuItem('item-1', { categoryId: specificCategoryId }),
                        createTestMenuItem('item-2', { categoryId: specificCategoryId })
                    ];
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        forEach: function (callback) {
                            testItems.forEach(function (item) {
                                callback({
                                    data: function () { return item; },
                                    id: item.id
                                });
                            });
                        }
                    });
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證過濾條件
                    expect(mockWhere).toHaveBeenCalledWith('categoryId', '==', specificCategoryId);
                    responseData = jsonSpy.mock.calls[0][0].data.items;
                    responseData.forEach(function (item) {
                        expect(item.categoryId).toBe(specificCategoryId);
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例5: 活動狀態過濾
    test('過濾條件 - 使用 isActive 過濾', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testItems, responseData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse({
                        isActive: 'true' // 查詢參數是字符串
                    }), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItems = [
                        createTestMenuItem('item-1', { isActive: true }),
                        createTestMenuItem('item-2', { isActive: true })
                    ];
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        forEach: function (callback) {
                            testItems.forEach(function (item) {
                                callback({
                                    data: function () { return item; },
                                    id: item.id
                                });
                            });
                        }
                    });
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證過濾條件 - 字符串'true' 應轉為布爾值true
                    expect(mockWhere).toHaveBeenCalledWith('isActive', '==', true);
                    responseData = jsonSpy.mock.calls[0][0].data.items;
                    responseData.forEach(function (item) {
                        expect(item.isActive).toBe(true);
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例6: 庫存狀態過濾
    test('過濾條件 - 使用 stockStatus 過濾', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testItems, responseData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse({
                        stockStatus: 'low_stock'
                    }), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItems = [
                        createTestMenuItem('item-1', { stockStatus: 'low_stock' }),
                        createTestMenuItem('item-2', { stockStatus: 'low_stock' })
                    ];
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        forEach: function (callback) {
                            testItems.forEach(function (item) {
                                callback({
                                    data: function () { return item; },
                                    id: item.id
                                });
                            });
                        }
                    });
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證過濾條件
                    expect(mockWhere).toHaveBeenCalledWith('stockStatus', '==', 'low_stock');
                    responseData = jsonSpy.mock.calls[0][0].data.items;
                    responseData.forEach(function (item) {
                        expect(item.stockStatus).toBe('low_stock');
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例7: 游標分頁
    test('游標分頁 - 使用 lastItemId 和 lastCategoryId 參數', function () { return __awaiter(_this, void 0, void 0, function () {
        var lastItemId, lastCategoryId, _a, mockRequest, mockResponse, lastItem, nextPageItems, responseData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    lastItemId = 'last-item-id';
                    lastCategoryId = 'last-category-id';
                    _a = setupMockRequestResponse({
                        lastItemId: lastItemId,
                        lastCategoryId: lastCategoryId
                    }), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    lastItem = createTestMenuItem(lastItemId, {
                        categoryId: lastCategoryId,
                        name: 'Last Item Name'
                    });
                    nextPageItems = [
                        createTestMenuItem('next-item-1'),
                        createTestMenuItem('next-item-2')
                    ];
                    // 模擬獲取上一頁最後一個項目的查詢
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return lastItem; }
                    });
                    // 模擬下一頁查詢結果
                    mockGet.mockResolvedValueOnce({
                        forEach: function (callback) {
                            nextPageItems.forEach(function (item) {
                                callback({
                                    data: function () { return item; },
                                    id: item.id
                                });
                            });
                        }
                    });
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證是否正確獲取了上一頁最後一個項目
                    expect(mockDoc).toHaveBeenCalledWith(lastItemId);
                    // 驗證是否正確設置了startAfter
                    expect(mockStartAfter).toHaveBeenCalledWith(lastCategoryId, lastItem.name);
                    responseData = jsonSpy.mock.calls[0][0].data.items;
                    expect(responseData.length).toBe(2);
                    expect(responseData[0].id).toBe('next-item-1');
                    expect(responseData[1].id).toBe('next-item-2');
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例8: 空列表結果
    test('返回空列表 - 當查詢結果為空時', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    // 模擬 Firestore 查詢結果 - 空結果
                    mockGet.mockResolvedValueOnce({
                        forEach: function () { } // 空函數，不調用回調
                    });
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
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
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例9: 無效庫存狀態值
    test('錯誤處理 - 無效庫存狀態值返回400錯誤', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse({
                        stockStatus: 'invalid_status'
                    }), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(400);
                    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                        success: false,
                        message: expect.stringContaining('無效的庫存狀態值')
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例10: 用戶缺少租戶ID
    test('錯誤處理 - 用戶缺少租戶ID時應返回500錯誤', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    // 修改請求，使用戶缺少租戶ID
                    mockRequest.user = {
                        uid: testUserId,
                        role: 'tenant_admin'
                        // 故意不設置tenantId
                    };
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應 - 注意：當前實現是在500 錯誤中處理這種情況，未明確區分
                    expect(statusJsonSpy).toHaveBeenCalledWith(500);
                    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                        success: false,
                        message: '伺服器內部錯誤'
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例11: Firestore 查詢失敗
    test('錯誤處理 - 當 Firestore 查詢失敗時應返回500錯誤', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testError;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testError = new Error('資料庫查詢失敗');
                    mockGet.mockRejectedValueOnce(testError);
                    // 執行測試
                    return [4 /*yield*/, listMenuItems(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(500);
                    expect(jsonSpy).toHaveBeenCalledWith(expect.objectContaining({
                        success: false,
                        message: '伺服器內部錯誤',
                        error: '資料庫查詢失敗'
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('MenuItem Handlers - getMenuItemById', function () {
    // 導入被測試的函數
    var getMenuItemById = require('../menuItem.handlers').getMenuItemById;
    // 設置測試模擬
    beforeEach(function () {
        jest.clearAllMocks();
    });
    // 測試變量
    var mockRequest, mockResponse;
    var jsonSpy, statusJsonSpy;
    var testTenantId = 'test-tenant-id';
    var testStoreId = 'test-store-id';
    var testUserId = 'test-user-123';
    var testItemId = 'test-item-id';
    // 創建測試菜單項目數據
    var createTestMenuItem = function (overrides) {
        if (overrides === void 0) { overrides = {}; }
        var timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
        return __assign({ id: testItemId, tenantId: testTenantId, name: '測試項目', description: '測試項目的描述', categoryId: 'category-1', categoryName: '主菜', price: 50, stockStatus: 'in_stock', isRecommended: false, isSpecial: false, isActive: true, tags: ['熱門', '推薦'], createdAt: timestamp, updatedAt: timestamp }, overrides);
    };
    var setupMockRequestResponse = function (params) {
        if (params === void 0) { params = {}; }
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
            params: __assign({ itemId: testItemId }, params)
        };
        mockResponse = {
            status: statusJsonSpy,
            json: jsonSpy
        };
        return { mockRequest: mockRequest, mockResponse: mockResponse };
    };
    // 測試案例1: 成功獲取菜單項目
    test('成功獲取菜單項目並返回200狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testItem, responseData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItem = createTestMenuItem();
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return testItem; }
                    });
                    // 執行測試
                    return [4 /*yield*/, getMenuItemById(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
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
                    responseData = jsonSpy.mock.calls[0][0].data;
                    expect(typeof responseData.createdAt).toBe('string');
                    expect(typeof responseData.updatedAt).toBe('string');
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例2: 找不到指定的菜單項目
    test('找不到指定的菜單項目時應返回404狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    // 模擬 Firestore 查詢結果 - 不存在的項目
                    mockGet.mockResolvedValueOnce({
                        exists: false
                    });
                    // 執行測試
                    return [4 /*yield*/, getMenuItemById(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(404);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '找不到指定的菜單項目'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例3: 租戶隔離 - 嘗試訪問其他租戶的菜單項目
    test('租戶隔離: 訪問其他租戶的菜單項目時應返回403狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, otherTenantItem;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    otherTenantItem = createTestMenuItem({
                        tenantId: 'other-tenant-id'
                    });
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return otherTenantItem; }
                    });
                    // 執行測試
                    return [4 /*yield*/, getMenuItemById(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證租戶隔離檢查
                    expect(statusJsonSpy).toHaveBeenCalledWith(403);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '沒有權限：無法訪問其他租戶的菜單項目'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例4: 請求缺少必要的項目ID
    test('缺少必要的項目ID時應返回400狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse({ itemId: undefined }), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    // 執行測試
                    return [4 /*yield*/, getMenuItemById(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(400);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '缺少必要的菜單項目ID參數'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例5: Firestore 查詢失敗
    test('Firestore 查詢失敗時應返回500狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testError;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testError = new Error('資料庫查詢失敗');
                    mockGet.mockRejectedValueOnce(testError);
                    // 執行測試
                    return [4 /*yield*/, getMenuItemById(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(500);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '伺服器內部錯誤',
                        error: '資料庫查詢失敗'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('MenuItem Handlers - updateMenuItem', function () {
    // 導入被測試的函數
    var updateMenuItem = require('../menuItem.handlers').updateMenuItem;
    // 設置測試模擬
    beforeEach(function () {
        jest.clearAllMocks();
    });
    // 測試變量
    var mockRequest, mockResponse;
    var jsonSpy, statusJsonSpy;
    var testTenantId = 'test-tenant-id';
    var testStoreId = 'test-store-id';
    var testUserId = 'test-user-123';
    var testItemId = 'test-item-id';
    var testCategoryId = 'category-1';
    var testNewCategoryId = 'category-2';
    // 創建測試菜單項目數據
    var createTestMenuItem = function (overrides) {
        if (overrides === void 0) { overrides = {}; }
        var timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
        return __assign({ id: testItemId, tenantId: testTenantId, name: '測試項目', description: '測試項目的描述', categoryId: testCategoryId, categoryName: '主菜', price: 50, stockStatus: 'in_stock', isRecommended: false, isSpecial: false, isActive: true, tags: ['熱門', '推薦'], createdAt: timestamp, updatedAt: timestamp }, overrides);
    };
    var setupMockRequestResponse = function (itemId, updateData) {
        if (itemId === void 0) { itemId = testItemId; }
        if (updateData === void 0) { updateData = {}; }
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
            params: { itemId: itemId },
            body: updateData
        };
        mockResponse = {
            status: statusJsonSpy,
            json: jsonSpy
        };
        return { mockRequest: mockRequest, mockResponse: mockResponse };
    };
    // 測試案例1: 成功更新多個欄位
    test('成功更新多個欄位並返回200狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var updateData, _a, mockRequest, mockResponse, testItem, mockUpdate, updatedItem, updateArg, responseData;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    updateData = {
                        name: '更新後的名稱',
                        price: 60
                    };
                    _a = setupMockRequestResponse(testItemId, updateData), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItem = createTestMenuItem();
                    // 模擬 Firestore 查詢結果 - 項目存在
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return testItem; }
                    });
                    mockUpdate = jest.fn().mockResolvedValue(true);
                    mockDoc.mockReturnValue({
                        get: mockGet,
                        update: mockUpdate
                    });
                    updatedItem = __assign(__assign(__assign({}, testItem), updateData), { updatedAt: new admin.firestore.Timestamp(Date.now() / 1000 + 100, 0) // 假設更新時間比創建時間晚
                     });
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return updatedItem; }
                    });
                    // 執行測試
                    return [4 /*yield*/, updateMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證 Firestore 調用
                    expect(mockCollection).toHaveBeenCalledWith('menuItems');
                    expect(mockDoc).toHaveBeenCalledWith(testItemId);
                    expect(mockGet).toHaveBeenCalled();
                    expect(mockUpdate).toHaveBeenCalled();
                    updateArg = mockUpdate.mock.calls[0][0];
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
                    responseData = jsonSpy.mock.calls[0][0].data;
                    expect(typeof responseData.createdAt).toBe('string');
                    expect(typeof responseData.updatedAt).toBe('string');
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例2: 找不到指定的菜單項目
    test('找不到指定的菜單項目時應返回404狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    // 模擬 Firestore 查詢結果 - 不存在的項目
                    mockGet.mockResolvedValueOnce({
                        exists: false
                    });
                    // 執行測試
                    return [4 /*yield*/, updateMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(404);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '找不到指定的菜單項目'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例3: 租戶隔離 - 嘗試更新其他租戶的菜單項目
    test('租戶隔離: 更新其他租戶的菜單項目時應返回403狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, otherTenantItem;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    otherTenantItem = createTestMenuItem({
                        tenantId: 'other-tenant-id'
                    });
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return otherTenantItem; }
                    });
                    // 執行測試
                    return [4 /*yield*/, updateMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證租戶隔離檢查
                    expect(statusJsonSpy).toHaveBeenCalledWith(403);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '沒有權限：無法更新其他租戶的菜單項目'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例4: 更新CategoryID - 成功
    test('成功更新分類ID並同步更新分類名稱', function () { return __awaiter(_this, void 0, void 0, function () {
        var updateData, _a, mockRequest, mockResponse, testItem, newCategory, mockUpdate, updatedItem, updateArg;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    updateData = {
                        categoryId: testNewCategoryId
                    };
                    _a = setupMockRequestResponse(testItemId, updateData), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItem = createTestMenuItem();
                    // 模擬 Firestore 查詢結果 - 項目存在
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return testItem; }
                    });
                    newCategory = {
                        id: testNewCategoryId,
                        tenantId: testTenantId,
                        name: '新分類名稱'
                    };
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return newCategory; }
                    });
                    mockUpdate = jest.fn().mockResolvedValue(true);
                    mockDoc.mockReturnValueOnce({
                        get: mockGet,
                        update: mockUpdate
                    }).mockReturnValueOnce({
                        get: mockGet
                    }).mockReturnValueOnce({
                        get: mockGet,
                        update: mockUpdate
                    });
                    updatedItem = __assign(__assign({}, testItem), { categoryId: testNewCategoryId, categoryName: '新分類名稱', updatedAt: new admin.firestore.Timestamp(Date.now() / 1000 + 100, 0) });
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return updatedItem; }
                    });
                    // 執行測試
                    return [4 /*yield*/, updateMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證 Firestore 調用
                    expect(mockCollection).toHaveBeenCalledWith('menuItems');
                    expect(mockCollection).toHaveBeenCalledWith('menuCategories');
                    expect(mockDoc).toHaveBeenCalledWith(testItemId);
                    expect(mockDoc).toHaveBeenCalledWith(testNewCategoryId);
                    updateArg = mockUpdate.mock.calls[0][0];
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
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例5: 更新CategoryID - 找不到新分類
    test('更新分類ID時找不到新分類應返回404狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var updateData, _a, mockRequest, mockResponse, testItem;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    updateData = {
                        categoryId: 'non-existent-category'
                    };
                    _a = setupMockRequestResponse(testItemId, updateData), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItem = createTestMenuItem();
                    // 模擬 Firestore 查詢結果 - 項目存在
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return testItem; }
                    });
                    // 模擬新分類數據 - 不存在
                    mockGet.mockResolvedValueOnce({
                        exists: false
                    });
                    // 執行測試
                    return [4 /*yield*/, updateMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(404);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '指定更新的菜單分類不存在'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例6: 更新CategoryID - 其他租戶分類
    test('更新分類ID時使用其他租戶分類應返回403狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var updateData, _a, mockRequest, mockResponse, testItem, otherTenantCategory;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    updateData = {
                        categoryId: 'other-tenant-category'
                    };
                    _a = setupMockRequestResponse(testItemId, updateData), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItem = createTestMenuItem();
                    // 模擬 Firestore 查詢結果 - 項目存在
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return testItem; }
                    });
                    otherTenantCategory = {
                        id: 'other-tenant-category',
                        tenantId: 'other-tenant-id',
                        name: '其他租戶分類'
                    };
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return otherTenantCategory; }
                    });
                    // 執行測試
                    return [4 /*yield*/, updateMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(403);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '沒有權限：無法使用其他租戶的菜單分類'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例7: Firestore 更新失敗
    test('Firestore 更新失敗時應返回500狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testItem, mockUpdate;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItem = createTestMenuItem();
                    // 模擬 Firestore 查詢結果 - 項目存在
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return testItem; }
                    });
                    mockUpdate = jest.fn().mockRejectedValue(new Error('資料庫更新失敗'));
                    mockDoc.mockReturnValue({
                        get: mockGet,
                        update: mockUpdate
                    });
                    // 執行測試
                    return [4 /*yield*/, updateMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(500);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '伺服器內部錯誤',
                        error: '資料庫更新失敗'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('MenuItem Handlers - deleteMenuItem', function () {
    // 導入被測試的函數
    var deleteMenuItem = require('../menuItem.handlers').deleteMenuItem;
    // 設置測試模擬
    beforeEach(function () {
        jest.clearAllMocks();
    });
    // 測試變量
    var mockRequest, mockResponse;
    var jsonSpy, statusJsonSpy;
    var testTenantId = 'test-tenant-id';
    var testUserId = 'test-user-123';
    var testItemId = 'test-item-id';
    // 創建測試菜單項目數據
    var createTestMenuItem = function (overrides) {
        if (overrides === void 0) { overrides = {}; }
        var timestamp = new admin.firestore.Timestamp(Date.now() / 1000, 0);
        return __assign({ id: testItemId, tenantId: testTenantId, name: '測試項目', description: '測試項目的描述', categoryId: 'category-1', categoryName: '主菜', price: 50, stockStatus: 'in_stock', isRecommended: false, isSpecial: false, isActive: true, tags: ['熱門', '推薦'], createdAt: timestamp, updatedAt: timestamp }, overrides);
    };
    var setupMockRequestResponse = function (itemId) {
        if (itemId === void 0) { itemId = testItemId; }
        // 創建模擬請求和響應
        jsonSpy = jest.fn();
        statusJsonSpy = jest.fn().mockReturnValue({ json: jsonSpy });
        mockRequest = {
            user: {
                uid: testUserId,
                tenantId: testTenantId,
                role: 'tenant_admin'
            },
            params: { itemId: itemId }
        };
        mockResponse = {
            status: statusJsonSpy,
            json: jsonSpy
        };
        return { mockRequest: mockRequest, mockResponse: mockResponse };
    };
    // 測試案例1: 成功刪除菜單項目
    test('成功刪除菜單項目並返回200狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testItem, mockDelete;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItem = createTestMenuItem();
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return testItem; }
                    });
                    mockDelete = jest.fn().mockResolvedValue(true);
                    mockDoc.mockReturnValue({
                        get: mockGet,
                        "delete": mockDelete
                    });
                    // 執行測試
                    return [4 /*yield*/, deleteMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
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
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例2: 找不到指定的菜單項目
    test('找不到指定的菜單項目時應返回404狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, mockDelete;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    // 模擬 Firestore 查詢結果 - 不存在的項目
                    mockGet.mockResolvedValueOnce({
                        exists: false
                    });
                    mockDelete = jest.fn();
                    mockDoc.mockReturnValue({
                        get: mockGet,
                        "delete": mockDelete
                    });
                    // 執行測試
                    return [4 /*yield*/, deleteMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(404);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '找不到指定的菜單項目'
                    });
                    // 驗證 delete 方法未被調用
                    expect(mockDelete).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例3: 租戶隔離 - 嘗試刪除其他租戶的菜單項目
    test('租戶隔離: 刪除其他租戶的菜單項目時應返回403狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, otherTenantItem, mockDelete;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    otherTenantItem = createTestMenuItem({
                        tenantId: 'other-tenant-id'
                    });
                    // 模擬 Firestore 查詢結果
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return otherTenantItem; }
                    });
                    mockDelete = jest.fn();
                    mockDoc.mockReturnValue({
                        get: mockGet,
                        "delete": mockDelete
                    });
                    // 執行測試
                    return [4 /*yield*/, deleteMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證租戶隔離檢查
                    expect(statusJsonSpy).toHaveBeenCalledWith(403);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '沒有權限：無法刪除其他租戶的菜單項目'
                    });
                    // 驗證 delete 方法未被調用
                    expect(mockDelete).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    // 測試案例4: Firestore 刪除失敗
    test('Firestore 刪除失敗時應返回500狀態', function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, mockRequest, mockResponse, testItem, mockDelete;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setupMockRequestResponse(), mockRequest = _a.mockRequest, mockResponse = _a.mockResponse;
                    testItem = createTestMenuItem();
                    // 模擬 Firestore 查詢結果 - 項目存在
                    mockGet.mockResolvedValueOnce({
                        exists: true,
                        data: function () { return testItem; }
                    });
                    mockDelete = jest.fn().mockRejectedValue(new Error('資料庫刪除失敗'));
                    mockDoc.mockReturnValue({
                        get: mockGet,
                        "delete": mockDelete
                    });
                    // 執行測試
                    return [4 /*yield*/, deleteMenuItem(mockRequest, mockResponse)];
                case 1:
                    // 執行測試
                    _b.sent();
                    // 驗證響應
                    expect(statusJsonSpy).toHaveBeenCalledWith(500);
                    expect(jsonSpy).toHaveBeenCalledWith({
                        success: false,
                        message: '伺服器內部錯誤',
                        error: '資料庫刪除失敗'
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
