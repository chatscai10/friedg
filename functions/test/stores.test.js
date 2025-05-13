const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const expect = chai.expect;
chai.use(sinonChai);

// 模擬 Firebase Admin SDK
const admin = require('firebase-admin');
const firebaseMock = require('./firebase-admin.mock');
const { mockFirestore, mockAuth } = firebaseMock;

// 要測試的功能
const storeHandlers = require('../src/stores/stores.handlers');
const { listStores, getStoreById, createStore, updateStore, 
        updateStoreStatus, deleteStore, updateGPSFence, 
        updatePrinterConfig } = storeHandlers;

// 導入適配層，用於測試驗證
const storesAdapter = require('../src/stores/stores.adapter');
const { 
  toApiStore, 
  fromApiCreateRequest, 
  fromApiUpdateRequest, 
  fromApiStatusUpdateRequest 
} = storesAdapter;

describe('Store API Tests', () => {
  let req, res;

  beforeEach(() => {
    // 重置 Firebase Admin 模擬
    firebaseMock.reset();

    // 模擬 Express 請求與響應
    req = {
      params: {},
      query: {},
      body: {},
      user: {
        uid: 'test-user-id',
        role: 'tenant_admin',
        tenantId: 'test-tenant-id',
        roleLevel: 50,
        permissions: {
          stores: {
            create: true,
            read: true,
            update: true,
            delete: true
          }
        }
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.spy()
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  // 測試獲取店鋪列表
  describe('listStores', () => {
    it('should return paginated list of stores for a tenant', async () => {
      // 模擬 Firestore 返回的數據
      const mockStores = [
        {
          storeId: 'store_123',
          storeName: '測試店鋪1',
          storeCode: 'TEST001',
          tenantId: 'test-tenant-id',
          isActive: true,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin-user',
          updatedBy: 'admin-user'
        },
        {
          storeId: 'store_456',
          storeName: '測試店鋪2',
          storeCode: 'TEST002',
          tenantId: 'test-tenant-id',
          isActive: true,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin-user',
          updatedBy: 'admin-user'
        }
      ];

      // 模擬 Firestore 的查詢
      const mockCollection = mockFirestore.collection('stores');
      mockCollection.mockReturnData(mockStores);
      mockCollection.mockCountResult(2);

      await listStores(req, res);

      expect(res.status).to.have.been.calledWith(200);
      // 檢查是否使用了適配層將內部模型轉換為API模型
      expect(res.json).to.have.been.calledWithMatch({
        status: 'success',
        data: sinon.match.array.deepEquals(mockStores.map(store => toApiStore(store))),
        pagination: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1
        }
      });
    });

    it('should return empty list when no stores found', async () => {
      // 模擬空數據
      const mockCollection = mockFirestore.collection('stores');
      mockCollection.mockReturnData([]);
      mockCollection.mockCountResult(0);

      await listStores(req, res);

      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWithMatch({
        status: 'success',
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0
        }
      });
    });

    it('should reject unauthorized access', async () => {
      // 模擬未授權的請求
      req.user = null;

      await listStores(req, res);

      expect(res.status).to.have.been.calledWith(401);
      expect(res.json).to.have.been.calledWithMatch({
        status: 'error',
        message: sinon.match.string
      });
    });
  });

  // 測試獲取單個店鋪
  describe('getStoreById', () => {
    it('should return a specific store when found', async () => {
      // 設置請求參數
      req.params.storeId = 'store_123';

      // 模擬店鋪數據
      const mockStore = {
        storeId: 'store_123',
        storeName: '測試店鋪',
        storeCode: 'TEST001',
        tenantId: 'test-tenant-id',
        isActive: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-user',
        updatedBy: 'admin-user'
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc('store_123');
      mockDoc.mockDocData(mockStore);

      await getStoreById(req, res);

      expect(res.status).to.have.been.calledWith(200);
      // 檢查是否使用了適配層將內部模型轉換為API模型
      expect(res.json).to.have.been.calledWithMatch({
        status: 'success',
        data: sinon.match.deepEquals(toApiStore(mockStore))
      });
    });

    it('should return 404 when store not found', async () => {
      // 設置請求參數
      req.params.storeId = 'non-existent-id';

      // 模擬不存在的店鋪
      const mockDoc = mockFirestore.collection('stores').doc('non-existent-id');
      mockDoc.mockDocNotExists();

      await getStoreById(req, res);

      expect(res.status).to.have.been.calledWith(404);
      expect(res.json).to.have.been.calledWithMatch({
        status: 'error',
        message: sinon.match.string
      });
    });

    it('should reject when user tries to access store from another tenant', async () => {
      // 設置請求參數
      req.params.storeId = 'store_123';

      // 模擬店鋪數據（不同租戶）
      const mockStore = {
        storeId: 'store_123',
        storeName: '測試店鋪',
        storeCode: 'TEST001',
        tenantId: 'different-tenant-id', // 不同的租戶 ID
        isActive: true,
        isDeleted: false
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc('store_123');
      mockDoc.mockDocData(mockStore);

      await getStoreById(req, res);

      expect(res.status).to.have.been.calledWith(403);
      expect(res.json).to.have.been.calledWithMatch({
        status: 'error',
        message: sinon.match.string
      });
    });
  });

  // 測試創建店鋪
  describe('createStore', () => {
    it('should create a new store with valid data', async () => {
      // 設置API格式的請求數據
      req.body = {
        name: '新測試店鋪',
        storeCode: 'TEST100',
        tenantId: 'test-tenant-id',
        status: 'active',
        address: {
          street: '測試地址 123 號'
        },
        contactInfo: {
          email: 'test@example.com',
          phone: '0912345678',
          contactPerson: '測試聯絡人'
        }
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc();
      mockDoc.mockDocCreate();

      // 創建預期的內部模型數據 (經過適配層轉換)
      const expectedInternalData = fromApiCreateRequest(req.body);

      await createStore(req, res);

      expect(res.status).to.have.been.calledWith(201);
      // 檢查是否返回正確轉換後的API模型
      expect(res.json).to.have.been.calledWithMatch({
        status: 'success',
        data: sinon.match({
          id: sinon.match.string,
          name: '新測試店鋪',
          storeCode: 'TEST100',
          tenantId: 'test-tenant-id',
          status: 'active'
        })
      });
    });

    it('should reject when user tries to create store for another tenant', async () => {
      // 設置API格式的請求數據（不同租戶）
      req.body = {
        name: '新測試店鋪',
        storeCode: 'TEST100',
        tenantId: 'different-tenant-id', // 不同的租戶 ID
        status: 'active',
        address: {
          street: '測試地址 123 號'
        },
        contactInfo: {
          email: 'test@example.com',
          phone: '0912345678',
          contactPerson: '測試聯絡人'
        }
      };

      await createStore(req, res);

      expect(res.status).to.have.been.calledWith(403);
      expect(res.json).to.have.been.calledWithMatch({
        status: 'error',
        message: sinon.match.string
      });
    });

    it('should reject when user has insufficient permissions', async () => {
      // 設置用戶為店鋪經理（無權創建店鋪）
      req.user.role = 'store_manager';
      
      // 設置API格式的請求數據
      req.body = {
        name: '新測試店鋪',
        storeCode: 'TEST100',
        tenantId: 'test-tenant-id',
        status: 'active',
        address: {
          street: '測試地址 123 號'
        },
        contactInfo: {
          email: 'test@example.com',
          phone: '0912345678',
          contactPerson: '測試聯絡人'
        }
      };

      await createStore(req, res);

      expect(res.status).to.have.been.calledWith(403);
      expect(res.json).to.have.been.calledWithMatch({
        status: 'error',
        message: sinon.match.string
      });
    });
  });

  // 測試更新店鋪
  describe('updateStore', () => {
    it('should update store with valid data', async () => {
      // 設置請求參數和API格式數據
      req.params.storeId = 'store_123';
      req.body = {
        name: '更新測試店鋪',
        status: 'active',
        contactInfo: {
          phone: '0987654321'
        }
      };

      // 模擬現有店鋪數據
      const mockStore = {
        storeId: 'store_123',
        storeName: '舊測試店鋪',
        storeCode: 'TEST001',
        address: '舊測試地址',
        phoneNumber: '0912345678',
        contactPerson: '舊聯絡人',
        email: 'old@example.com',
        tenantId: 'test-tenant-id',
        isActive: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin-user',
        updatedBy: 'admin-user'
      };

      // 根據適配層轉換預期的更新數據
      const expectedUpdateData = fromApiUpdateRequest(req.body);

      // 模擬更新後的店鋪數據
      const updatedMockStore = {
        ...mockStore,
        storeName: '更新測試店鋪', // 來自API的name會被轉為storeName
        phoneNumber: '0987654321', // 來自API的contactInfo.phone會被轉為phoneNumber
        updatedAt: new Date(),
        updatedBy: 'test-user-id'
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc('store_123');
      mockDoc.mockDocData(mockStore);
      mockDoc.mockUpdateDoc();
      mockDoc.mockDocData(updatedMockStore, true); // 第二次獲取時返回更新後的數據

      await updateStore(req, res);

      expect(res.status).to.have.been.calledWith(200);
      // 檢查是否返回正確轉換後的API模型
      expect(res.json).to.have.been.calledWithMatch({
        status: 'success',
        data: sinon.match({
          id: 'store_123',
          name: '更新測試店鋪',
          status: 'active',
          contactInfo: sinon.match({
            phone: '0987654321'
          })
        })
      });
    });

    it('should reject when store not found', async () => {
      // 設置請求參數和API格式數據
      req.params.storeId = 'non-existent-id';
      req.body = {
        name: '更新測試店鋪'
      };

      // 模擬不存在的店鋪
      const mockDoc = mockFirestore.collection('stores').doc('non-existent-id');
      mockDoc.mockDocNotExists();

      await updateStore(req, res);

      expect(res.status).to.have.been.calledWith(404);
      expect(res.json).to.have.been.calledWithMatch({
        status: 'error',
        message: sinon.match.string
      });
    });

    it('should reject when store manager tries to update another store', async () => {
      // 設置用戶為店鋪經理
      req.user.role = 'store_manager';
      req.user.storeId = 'different-store-id';
      
      // 設置請求參數和API格式數據
      req.params.storeId = 'store_123';
      req.body = {
        name: '更新測試店鋪'
      };

      // 模擬現有店鋪數據
      const mockStore = {
        storeId: 'store_123',
        storeName: '舊測試店鋪',
        tenantId: 'test-tenant-id',
        isActive: true,
        isDeleted: false
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc('store_123');
      mockDoc.mockDocData(mockStore);

      await updateStore(req, res);

      expect(res.status).to.have.been.calledWith(403);
      expect(res.json).to.have.been.calledWithMatch({
        status: 'error',
        message: sinon.match.string
      });
    });
  });

  // 測試其他API端點
  describe('Other Store Operations', () => {
    // 測試更新店鋪狀態
    it('should update store status', async () => {
      // 設置請求參數和API格式數據
      req.params.storeId = 'store_123';
      req.body = {
        status: 'inactive',
        reason: '暫停營業'
      };

      // 模擬現有店鋪數據
      const mockStore = {
        storeId: 'store_123',
        storeName: '測試店鋪',
        tenantId: 'test-tenant-id',
        isActive: true,
        isDeleted: false
      };

      // 根據適配層轉換預期的更新數據
      const expectedUpdateData = fromApiStatusUpdateRequest(req.body);

      // 模擬更新後的店鋪數據
      const updatedMockStore = {
        ...mockStore,
        isActive: false, // 來自API的inactive狀態
        updatedAt: new Date(),
        updatedBy: 'test-user-id'
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc('store_123');
      mockDoc.mockDocData(mockStore);
      mockDoc.mockUpdateDoc();
      mockDoc.mockDocData(updatedMockStore, true);

      await updateStoreStatus(req, res);

      expect(res.status).to.have.been.calledWith(200);
      // 檢查是否返回正確的API格式響應
      expect(res.json).to.have.been.calledWithMatch({
        status: 'success',
        data: sinon.match({
          id: 'store_123',
          status: 'inactive',
          updatedAt: sinon.match.string
        })
      });
    });

    // 測試刪除店鋪 (邏輯刪除)
    it('should logically delete a store', async () => {
      // 設置請求參數
      req.params.storeId = 'store_123';

      // 模擬現有店鋪數據
      const mockStore = {
        storeId: 'store_123',
        storeName: '測試店鋪',
        tenantId: 'test-tenant-id',
        isActive: true,
        isDeleted: false
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc('store_123');
      mockDoc.mockDocData(mockStore);
      mockDoc.mockUpdateDoc();

      // 模擬更新後的店鋪數據 (已被標記為刪除)
      const updatedMockStore = {
        ...mockStore,
        isActive: false, 
        isDeleted: true,
        updatedAt: new Date(),
        updatedBy: 'test-user-id'
      };
      mockDoc.mockDocData(updatedMockStore, true);

      await deleteStore(req, res);

      expect(res.status).to.have.been.calledWith(200);
      expect(res.json).to.have.been.calledWithMatch({
        status: 'success',
        message: sinon.match.string
      });
    });

    // 測試物理刪除店鋪 (僅超級管理員)
    it('should physically delete a store when super_admin requests hard delete', async () => {
      // 設置用戶為超級管理員
      req.user.role = 'super_admin';
      
      // 設置請求參數
      req.params.storeId = 'store_123';
      req.query.hardDelete = 'true';

      // 模擬現有店鋪數據
      const mockStore = {
        storeId: 'store_123',
        storeName: '測試店鋪',
        tenantId: 'test-tenant-id',
        isActive: true,
        isDeleted: false
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc('store_123');
      mockDoc.mockDocData(mockStore);
      mockDoc.mockDeleteDoc();

      await deleteStore(req, res);

      // 物理刪除應返回204狀態碼
      expect(res.status).to.have.been.calledWith(204);
    });

    // 測試更新GPS圍欄設定
    it('should update GPS fence settings', async () => {
      // 設置請求參數和數據
      req.params.storeId = 'store_123';
      req.body = {
        enabled: true,
        radius: 100,
        center: {
          latitude: 25.033964,
          longitude: 121.564468
        }
      };

      // 模擬現有店鋪數據
      const mockStore = {
        storeId: 'store_123',
        storeName: '測試店鋪',
        tenantId: 'test-tenant-id',
        isActive: true,
        isDeleted: false
      };

      // 模擬更新後的店鋪數據
      const updatedMockStore = {
        ...mockStore,
        gpsFence: {
          enabled: true,
          radius: 100,
          center: {
            latitude: 25.033964,
            longitude: 121.564468
          }
        },
        updatedAt: new Date(),
        updatedBy: 'test-user-id'
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc('store_123');
      mockDoc.mockDocData(mockStore);
      mockDoc.mockUpdateDoc();
      mockDoc.mockDocData(updatedMockStore, true);

      await updateGPSFence(req, res);

      expect(res.status).to.have.been.calledWith(200);
      // 檢查是否返回API格式的GPS圍欄數據
      expect(res.json).to.have.been.calledWithMatch({
        status: 'success',
        data: sinon.match({
          enabled: true,
          radius: 100,
          center: {
            latitude: 25.033964,
            longitude: 121.564468
          },
          updatedAt: sinon.match.string
        })
      });
    });

    // 測試更新印表機設定
    it('should update printer configuration', async () => {
      // 設置請求參數和數據
      req.params.storeId = 'store_123';
      req.body = {
        receiptPrinter: {
          name: '測試印表機',
          model: 'HP-123',
          enabled: true
        },
        settings: {
          autoPrint: true,
          printCustomerCopy: true
        }
      };

      // 模擬現有店鋪數據
      const mockStore = {
        storeId: 'store_123',
        storeName: '測試店鋪',
        tenantId: 'test-tenant-id',
        isActive: true,
        isDeleted: false
      };

      // 模擬更新後的店鋪數據
      const updatedMockStore = {
        ...mockStore,
        printerConfig: {
          receiptPrinter: {
            name: '測試印表機',
            model: 'HP-123',
            enabled: true
          },
          settings: {
            autoPrint: true,
            printCustomerCopy: true
          }
        },
        updatedAt: new Date(),
        updatedBy: 'test-user-id'
      };

      // 模擬 Firestore 文檔
      const mockDoc = mockFirestore.collection('stores').doc('store_123');
      mockDoc.mockDocData(mockStore);
      mockDoc.mockUpdateDoc();
      mockDoc.mockDocData(updatedMockStore, true);

      await updatePrinterConfig(req, res);

      expect(res.status).to.have.been.calledWith(200);
      // 檢查是否返回API格式的印表機配置數據
      expect(res.json).to.have.been.calledWithMatch({
        status: 'success',
        data: sinon.match({
          receiptPrinter: {
            name: '測試印表機',
            model: 'HP-123',
            enabled: true
          },
          settings: {
            autoPrint: true,
            printCustomerCopy: true
          },
          updatedAt: sinon.match.string
        })
      });
    });
  });
}); 