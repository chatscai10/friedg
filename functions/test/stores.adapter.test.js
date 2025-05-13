const chai = require('chai');
const expect = chai.expect;

// 導入要測試的模組
const storesAdapter = require('../src/stores/stores.adapter');
const {
  mapApiStatusToInternal,
  mapInternalStatusToApi,
  fromApiCreateRequest,
  fromApiUpdateRequest,
  fromApiStatusUpdateRequest,
  toApiStore,
  toApiStores
} = storesAdapter;

describe('Stores Adapter Tests', () => {
  describe('mapApiStatusToInternal', () => {
    it('should correctly map "active" status', () => {
      const result = mapApiStatusToInternal('active');
      expect(result).to.deep.equal({ isActive: true });
    });

    it('should correctly map "inactive" status', () => {
      const result = mapApiStatusToInternal('inactive');
      expect(result).to.deep.equal({ isActive: false });
    });

    it('should correctly map "temporary_closed" status', () => {
      const result = mapApiStatusToInternal('temporary_closed');
      expect(result).to.deep.equal({ isActive: false });
    });

    it('should correctly map "permanently_closed" status', () => {
      const result = mapApiStatusToInternal('permanently_closed');
      expect(result).to.deep.equal({ isActive: false, isDeleted: true });
    });

    it('should provide default for invalid status', () => {
      // @ts-ignore：故意測試無效值的處理
      const result = mapApiStatusToInternal('invalid_status');
      expect(result).to.deep.equal({ isActive: true });
    });
  });

  describe('mapInternalStatusToApi', () => {
    it('should map active store (isActive=true) to "active"', () => {
      const result = mapInternalStatusToApi(true);
      expect(result).to.equal('active');
    });

    it('should map inactive store (isActive=false) to "inactive"', () => {
      const result = mapInternalStatusToApi(false);
      expect(result).to.equal('inactive');
    });

    it('should map deleted store (isDeleted=true) to "permanently_closed"', () => {
      const result = mapInternalStatusToApi(true, true);
      expect(result).to.equal('permanently_closed');
    });

    it('should prioritize isDeleted over isActive', () => {
      const result = mapInternalStatusToApi(false, true);
      expect(result).to.equal('permanently_closed');
    });
  });

  describe('fromApiCreateRequest', () => {
    it('should transform API create request to internal request', () => {
      const apiRequest = {
        name: '測試店鋪',
        storeCode: 'TEST001',
        tenantId: 'tenant-123',
        status: 'active',
        address: {
          street: '台北市信義區信義路五段7號',
          city: '台北市',
          state: '台灣',
          postalCode: '110',
          country: '台灣'
        },
        location: {
          latitude: 25.033964,
          longitude: 121.564468
        },
        contactInfo: {
          email: 'test@example.com',
          phone: '02-12345678',
          contactPerson: '王小明'
        }
      };

      const result = fromApiCreateRequest(apiRequest);

      expect(result).to.deep.include({
        storeName: '測試店鋪',
        storeCode: 'TEST001',
        tenantId: 'tenant-123',
        isActive: true,
        address: '台北市信義區信義路五段7號',
        email: 'test@example.com',
        phoneNumber: '02-12345678',
        contactPerson: '王小明'
      });

      expect(result.geolocation).to.deep.include({
        latitude: 25.033964,
        longitude: 121.564468,
        address: '台北市信義區信義路五段7號'
      });

      expect(result.settings).to.be.an('object');
    });

    it('should handle missing optional properties', () => {
      const apiRequest = {
        name: '最簡單店鋪',
        storeCode: 'MIN001',
        tenantId: 'tenant-123',
        status: 'active'
      };

      const result = fromApiCreateRequest(apiRequest);

      expect(result).to.deep.include({
        storeName: '最簡單店鋪',
        storeCode: 'MIN001',
        tenantId: 'tenant-123',
        isActive: true,
        address: '',
        email: '',
        phoneNumber: '',
        contactPerson: ''
      });

      expect(result.geolocation).to.be.undefined;
      expect(result.settings).to.be.an('object');
    });

    it('should correctly transform status value', () => {
      const apiRequest = {
        name: '暫停營業店鋪',
        storeCode: 'TEMP001',
        tenantId: 'tenant-123',
        status: 'temporary_closed'
      };

      const result = fromApiCreateRequest(apiRequest);
      expect(result.isActive).to.be.false;
    });
  });

  describe('fromApiUpdateRequest', () => {
    it('should transform API update request to internal request', () => {
      const apiRequest = {
        name: '更新店名',
        storeCode: 'UPDATE001',
        status: 'inactive',
        address: {
          street: '新地址',
          city: '新城市',
        },
        contactInfo: {
          email: 'new@example.com',
          phone: '02-87654321',
          contactPerson: '李大方'
        }
      };

      const result = fromApiUpdateRequest(apiRequest);

      expect(result).to.deep.include({
        storeName: '更新店名',
        storeCode: 'UPDATE001',
        isActive: false,
        address: '新地址',
        email: 'new@example.com',
        phoneNumber: '02-87654321',
        contactPerson: '李大方'
      });
    });

    it('should handle partial updates correctly', () => {
      const apiRequest = {
        name: '只更新店名'
      };

      const result = fromApiUpdateRequest(apiRequest);
      
      expect(result).to.deep.equal({
        storeName: '只更新店名'
      });
    });

    it('should handle empty contactInfo properties correctly', () => {
      const apiRequest = {
        contactInfo: {
          // 空的contactInfo對象
        }
      };

      const result = fromApiUpdateRequest(apiRequest);
      expect(result).to.deep.equal({});
    });

    it('should only include defined properties from contactInfo', () => {
      const apiRequest = {
        contactInfo: {
          email: 'partial@example.com'
          // 沒有phone和contactPerson
        }
      };

      const result = fromApiUpdateRequest(apiRequest);
      expect(result).to.deep.equal({
        email: 'partial@example.com'
      });
    });
  });

  describe('fromApiStatusUpdateRequest', () => {
    it('should convert active status correctly', () => {
      const apiRequest = {
        status: 'active',
        reason: '重新開業'
      };

      const result = fromApiStatusUpdateRequest(apiRequest);
      expect(result).to.deep.equal({
        isActive: true
      });
    });

    it('should convert inactive status correctly', () => {
      const apiRequest = {
        status: 'inactive',
        reason: '暫停營業'
      };

      const result = fromApiStatusUpdateRequest(apiRequest);
      expect(result).to.deep.equal({
        isActive: false
      });
    });

    it('should convert temporary_closed status correctly', () => {
      const apiRequest = {
        status: 'temporary_closed',
        reason: '裝修中'
      };

      const result = fromApiStatusUpdateRequest(apiRequest);
      expect(result).to.deep.equal({
        isActive: false
      });
    });
  });

  describe('toApiStore', () => {
    it('should transform internal store model to API model', () => {
      const internalStore = {
        storeId: 'store_123',
        storeName: '內部店鋪',
        storeCode: 'INT001',
        tenantId: 'tenant-123',
        isActive: true,
        address: '台北市信義區信義路五段7號',
        email: 'store@example.com',
        phoneNumber: '02-12345678',
        contactPerson: '張店長',
        geolocation: {
          latitude: 25.033964,
          longitude: 121.564468,
          address: '台北市信義區信義路五段7號'
        },
        gpsFence: {
          enabled: true,
          radius: 100,
          center: {
            latitude: 25.033964,
            longitude: 121.564468
          }
        },
        printerConfig: {
          receiptPrinter: {
            name: '收據印表機',
            model: 'HP-123',
            enabled: true
          }
        },
        createdAt: new Date('2025-07-01T12:00:00Z'),
        updatedAt: new Date('2025-07-15T15:30:00Z'),
        createdBy: 'user-123',
        updatedBy: 'user-456'
      };

      const result = toApiStore(internalStore);

      expect(result).to.deep.include({
        id: 'store_123',
        name: '內部店鋪',
        storeCode: 'INT001',
        status: 'active',
        tenantId: 'tenant-123'
      });

      expect(result.address).to.deep.include({
        street: '台北市信義區信義路五段7號'
      });

      expect(result.location).to.deep.include({
        latitude: 25.033964,
        longitude: 121.564468
      });

      expect(result.contactInfo).to.deep.include({
        email: 'store@example.com',
        phone: '02-12345678',
        contactPerson: '張店長'
      });

      expect(result.gpsFence).to.deep.include({
        enabled: true,
        radius: 100,
        center: {
          latitude: 25.033964,
          longitude: 121.564468
        }
      });

      expect(result.printerSettings).to.deep.include({
        enabled: true
      });

      expect(result.createdAt).to.equal('2025-07-01T12:00:00.000Z');
      expect(result.updatedAt).to.equal('2025-07-15T15:30:00.000Z');
    });

    it('should handle missing optional properties', () => {
      const internalStore = {
        storeId: 'store_456',
        storeName: '簡單店鋪',
        storeCode: 'SIMPLE001',
        tenantId: 'tenant-123',
        isActive: true,
        address: '',
        email: '',
        phoneNumber: '',
        contactPerson: '',
        createdAt: '2025-07-01T12:00:00Z', // 字串格式
        updatedAt: '2025-07-15T15:30:00Z', // 字串格式
        createdBy: 'user-123',
        updatedBy: 'user-456'
      };

      const result = toApiStore(internalStore);

      expect(result).to.deep.include({
        id: 'store_456',
        name: '簡單店鋪',
        status: 'active',
        tenantId: 'tenant-123'
      });

      expect(result.address).to.deep.include({
        street: ''
      });

      expect(result.location).to.be.undefined;
      expect(result.gpsFence).to.be.undefined;
      expect(result.printerSettings).to.be.undefined;
      
      expect(result.contactInfo).to.deep.include({
        email: '',
        phone: '',
        contactPerson: ''
      });

      expect(result.createdAt).to.equal('2025-07-01T12:00:00Z');
      expect(result.updatedAt).to.equal('2025-07-15T15:30:00Z');
    });

    it('should transform status correctly based on isActive and isDeleted', () => {
      const tests = [
        { input: { isActive: true, isDeleted: false }, expected: 'active' },
        { input: { isActive: false, isDeleted: false }, expected: 'inactive' },
        { input: { isActive: true, isDeleted: true }, expected: 'permanently_closed' },
        { input: { isActive: false, isDeleted: true }, expected: 'permanently_closed' }
      ];

      tests.forEach(test => {
        const store = {
          storeId: 'test_store',
          storeName: '測試狀態店鋪',
          storeCode: 'TEST',
          tenantId: 'tenant-123',
          isActive: test.input.isActive,
          isDeleted: test.input.isDeleted,
          address: '',
          email: '',
          phoneNumber: '',
          contactPerson: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123',
          updatedBy: 'user-123'
        };

        const result = toApiStore(store);
        expect(result.status).to.equal(test.expected);
      });
    });
  });

  describe('toApiStores', () => {
    it('should transform an array of internal store models to API models', () => {
      const internalStores = [
        {
          storeId: 'store_1',
          storeName: '店鋪1',
          storeCode: 'STORE1',
          tenantId: 'tenant-123',
          isActive: true,
          address: '地址1',
          email: 'store1@example.com',
          phoneNumber: '02-11111111',
          contactPerson: '張店長',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123',
          updatedBy: 'user-123'
        },
        {
          storeId: 'store_2',
          storeName: '店鋪2',
          storeCode: 'STORE2',
          tenantId: 'tenant-123',
          isActive: false,
          address: '地址2',
          email: 'store2@example.com',
          phoneNumber: '02-22222222',
          contactPerson: '李店長',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123',
          updatedBy: 'user-123'
        }
      ];

      const result = toApiStores(internalStores);

      expect(result).to.be.an('array').with.lengthOf(2);
      
      expect(result[0]).to.deep.include({
        id: 'store_1',
        name: '店鋪1',
        status: 'active',
        tenantId: 'tenant-123'
      });

      expect(result[1]).to.deep.include({
        id: 'store_2',
        name: '店鋪2',
        status: 'inactive',
        tenantId: 'tenant-123'
      });
    });

    it('should return an empty array when input is empty', () => {
      const result = toApiStores([]);
      expect(result).to.be.an('array').that.is.empty;
    });
  });
}); 