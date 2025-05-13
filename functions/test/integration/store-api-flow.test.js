/**
 * 店鋪 API 整合測試
 * 
 * 測試完整流程：
 * 1. 創建店鋪
 * 2. 獲取單個店鋪
 * 3. 獲取店鋪列表
 * 4. 更新店鋪
 * 5. 更新店鋪狀態
 * 6. 更新 GPS 圍欄
 * 7. 更新印表機配置
 * 8. 刪除店鋪
 * 
 * 以及多角色訪問和租戶隔離的場景
 * 
 * 整合測試重點：驗證適配層轉換邏輯在實際請求中的正確性
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;
const sinon = require('sinon');
const admin = require('firebase-admin');

// 使用 chai-http 進行 HTTP 請求測試
chai.use(chaiHttp);

// 導入 express app (或者模擬 functions)
let app;
if (process.env.FIREBASE_EMULATOR) {
  // 使用 Firebase 模擬器
  const { getEmulatorApp } = require('../utils/emulator-utils');
  app = getEmulatorApp();
} else {
  // 使用本地 express app
  const express = require('express');
  app = express();
  // 導入路由
  const storeRoutes = require('../../src/stores/stores.routes');
  app.use('/api/v1/stores', storeRoutes);
}

// 導入適配層函數用於驗證
const { 
  toApiStore, 
  fromApiCreateRequest, 
  fromApiUpdateRequest, 
  fromApiStatusUpdateRequest,
  mapApiStatusToInternal,
  mapInternalStatusToApi 
} = require('../../src/stores/stores.adapter');

// 測試用用戶 Token
let superAdminToken;
let tenantAdminToken;
let storeManagerToken;
let staffToken;

// 測試數據
const testTenant1 = {
  id: 'test-tenant-1',
  name: '測試租戶 1'
};

const testTenant2 = {
  id: 'test-tenant-2',
  name: '測試租戶 2'
};

// 用於保存測試過程中創建的 ID
const testData = {
  storeIds: {
    tenant1: null,
    tenant2: null
  }
};

describe('Store API Integration Tests', function() {
  this.timeout(10000); // 設置更長的超時時間

  // 測試前準備：設置測試環境和創建測試用戶
  before(async function() {
    // 啟動 Firestore 模擬
    if (process.env.FIREBASE_EMULATOR) {
      console.log('Using Firebase Emulator');
    } else {
      console.log('Using local app with mocked Firestore');
      // 模擬 Firestore
      const firebaseMock = require('../firebase-admin.mock');
      firebaseMock.initializeApp();
    }

    // 創建測試用戶和生成 Token
    // 實際項目中應使用 firebase auth 模擬器或 mock
    superAdminToken = await generateTestToken({
      uid: 'super-admin-user',
      role: 'super_admin',
      email: 'super@example.com'
    });

    tenantAdminToken = await generateTestToken({
      uid: 'tenant-admin-user',
      role: 'tenant_admin',
      email: 'tenant-admin@example.com',
      tenantId: testTenant1.id
    });

    storeManagerToken = await generateTestToken({
      uid: 'store-manager-user',
      role: 'store_manager',
      email: 'store-manager@example.com',
      tenantId: testTenant1.id,
      // 注意：storeId 將在創建店鋪後設置
    });

    staffToken = await generateTestToken({
      uid: 'staff-user',
      role: 'staff',
      email: 'staff@example.com',
      tenantId: testTenant1.id,
      // 注意：storeId 將在創建店鋪後設置
    });

    // 創建測試租戶
    await setupTestTenants([testTenant1, testTenant2]);
  });

  // 測試後清理
  after(async function() {
    // 清理測試數據
    await cleanupTestData();
  });

  // 測試：創建店鋪 (租戶管理員)
  describe('1. Create Store', function() {
    it('tenant admin should create a store successfully using API format', async function() {
      // 使用API規範格式的數據
      const storeData = {
        name: '測試店鋪 1',
        storeCode: 'TEST001',
        status: 'active',
        tenantId: testTenant1.id,
        address: {
          street: '測試地址 123 號',
          city: '台北市',
          state: '台灣',
          postalCode: '100',
          country: '台灣'
        },
        contactInfo: {
          email: 'test-store@example.com',
          phone: '0912345678',
          contactPerson: '測試聯絡人'
        },
        location: {
          latitude: 25.033964,
          longitude: 121.564468
        }
      };

      const res = await chai.request(app)
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send(storeData);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property('status', 'success');
      expect(res.body).to.have.property('data');
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('id');
      expect(res.body.data).to.have.property('name', storeData.name);
      expect(res.body.data).to.have.property('status', 'active');
      expect(res.body.data).to.have.property('tenantId', testTenant1.id);
      
      // 驗證嵌套對象
      expect(res.body.data).to.have.property('contactInfo');
      expect(res.body.data.contactInfo).to.have.property('email', storeData.contactInfo.email);
      expect(res.body.data.contactInfo).to.have.property('phone', storeData.contactInfo.phone);
      
      // 驗證地址格式
      expect(res.body.data).to.have.property('address');
      expect(res.body.data.address).to.have.property('street', storeData.address.street);

      // 保存創建的店鋪 ID 用於後續測試
      testData.storeIds.tenant1 = res.body.data.id;

      // 更新店鋪經理的 storeId
      storeManagerToken = await generateTestToken({
        uid: 'store-manager-user',
        role: 'store_manager',
        email: 'store-manager@example.com',
        tenantId: testTenant1.id,
        storeId: testData.storeIds.tenant1
      });

      staffToken = await generateTestToken({
        uid: 'staff-user',
        role: 'staff',
        email: 'staff@example.com',
        tenantId: testTenant1.id,
        storeId: testData.storeIds.tenant1
      });
    });

    it('staff should not be able to create a store', async function() {
      const storeData = {
        name: '員工嘗試創建的店鋪',
        storeCode: 'STAFF001',
        status: 'active',
        tenantId: testTenant1.id,
        address: {
          street: '測試地址 999 號'
        },
        contactInfo: {
          email: 'staff-store@example.com',
          phone: '0987654321',
          contactPerson: '測試員工'
        }
      };

      const res = await chai.request(app)
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(storeData);

      expect(res).to.have.status(403);
      expect(res.body).to.have.property('status', 'error');
    });

    it('should not create store for another tenant', async function() {
      const storeData = {
        name: '嘗試跨租戶創建的店鋪',
        storeCode: 'CROSS001',
        status: 'active',
        tenantId: testTenant2.id, // 不同租戶
        address: {
          street: '測試地址 888 號'
        },
        contactInfo: {
          email: 'cross-tenant@example.com',
          phone: '0912345678',
          contactPerson: '測試跨租戶'
        }
      };

      const res = await chai.request(app)
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${tenantAdminToken}`) // 租戶1的管理員
        .send(storeData);

      expect(res).to.have.status(403);
      expect(res.body).to.have.property('status', 'error');
    });

    it('super admin should create a store for any tenant using API format', async function() {
      const storeData = {
        name: '測試店鋪 2',
        storeCode: 'TEST002',
        status: 'active',
        tenantId: testTenant2.id,
        address: {
          street: '測試地址 456 號',
          city: '高雄市'
        },
        contactInfo: {
          email: 'test-store-2@example.com',
          phone: '0923456789',
          contactPerson: '測試聯絡人 2'
        },
        location: {
          latitude: 22.627278,
          longitude: 120.301435
        }
      };

      const res = await chai.request(app)
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(storeData);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property('status', 'success');
      expect(res.body.data).to.have.property('tenantId', testTenant2.id);
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('id');
      expect(res.body.data).to.have.property('name', storeData.name);
      expect(res.body.data).to.have.property('status', 'active');
      
      // 保存創建的店鋪 ID 用於後續測試
      testData.storeIds.tenant2 = res.body.data.id;
    });
  });

  // 測試：獲取單個店鋪
  describe('2. Get Store by ID', function() {
    it('should get a store by ID with API format response', async function() {
      const storeId = testData.storeIds.tenant1;

      const res = await chai.request(app)
        .get(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('id', storeId);
      expect(res.body.data).to.have.property('name');
      expect(res.body.data).to.have.property('status');
      expect(res.body.data).to.have.property('address');
      expect(res.body.data).to.have.property('contactInfo');
    });

    it('store manager should access their own store', async function() {
      const storeId = testData.storeIds.tenant1;

      const res = await chai.request(app)
        .get(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${storeManagerToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
    });

    it('should not access store from another tenant', async function() {
      const storeId = testData.storeIds.tenant2;

      const res = await chai.request(app)
        .get(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`); // 租戶1的管理員

      expect(res).to.have.status(403);
      expect(res.body).to.have.property('status', 'error');
    });

    it('super admin should access any store', async function() {
      const storeId = testData.storeIds.tenant2;

      const res = await chai.request(app)
        .get(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
    });
  });

  // 測試：獲取店鋪列表
  describe('3. List Stores', function() {
    it('tenant admin should get stores for their tenant in API format', async function() {
      const res = await chai.request(app)
        .get('/api/v1/stores')
        .set('Authorization', `Bearer ${tenantAdminToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      expect(res.body).to.have.property('data').to.be.an('array');
      expect(res.body.data.every(store => store.tenantId === testTenant1.id)).to.be.true;
      
      // 驗證API格式的回應
      if (res.body.data.length > 0) {
        const store = res.body.data[0];
        expect(store).to.have.property('id');
        expect(store).to.have.property('name');
        expect(store).to.have.property('status');
        expect(store).to.have.property('address');
        expect(store).to.have.property('contactInfo');
      }
    });

    it('super admin should get stores for all tenants', async function() {
      const res = await chai.request(app)
        .get('/api/v1/stores')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      expect(res.body).to.have.property('data').to.be.an('array');
      expect(res.body.data.length).to.be.at.least(2);
    });
  });

  // 測試：更新店鋪
  describe('4. Update Store', function() {
    it('tenant admin should update a store using API format', async function() {
      const storeId = testData.storeIds.tenant1;
      const updateData = {
        name: '已更新的測試店鋪 1',
        contactInfo: {
          phone: '0987654321'
        }
      };

      const res = await chai.request(app)
        .put(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send(updateData);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('name', updateData.name);
      expect(res.body.data).to.have.property('contactInfo');
      expect(res.body.data.contactInfo).to.have.property('phone', updateData.contactInfo.phone);
    });

    it('store manager should update their own store using API format', async function() {
      const storeId = testData.storeIds.tenant1;
      const updateData = {
        address: {
          street: '已更新的測試地址 123 號'
        }
      };

      const res = await chai.request(app)
        .put(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send(updateData);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('address');
      expect(res.body.data.address).to.have.property('street', updateData.address.street);
    });

    it('should not update store from another tenant', async function() {
      const storeId = testData.storeIds.tenant2;
      const updateData = {
        name: '嘗試跨租戶更新的店鋪'
      };

      const res = await chai.request(app)
        .put(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`) // 租戶1的管理員
        .send(updateData);

      expect(res).to.have.status(403);
      expect(res.body).to.have.property('status', 'error');
    });

    it('staff should not update a store', async function() {
      const storeId = testData.storeIds.tenant1;
      const updateData = {
        name: '員工嘗試更新的店鋪'
      };

      const res = await chai.request(app)
        .put(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(updateData);

      expect(res).to.have.status(403);
      expect(res.body).to.have.property('status', 'error');
    });
  });

  // 測試：更新店鋪狀態
  describe('5. Update Store Status', function() {
    it('tenant admin should update store status using API format', async function() {
      const storeId = testData.storeIds.tenant1;
      const updateData = {
        status: 'inactive',
        reason: '暫時停業'
      };

      const res = await chai.request(app)
        .patch(`/api/v1/stores/${storeId}/status`)
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send(updateData);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('status', 'inactive');
    });

    it('store manager should not update store status', async function() {
      const storeId = testData.storeIds.tenant1;
      const updateData = {
        status: 'active'
      };

      const res = await chai.request(app)
        .patch(`/api/v1/stores/${storeId}/status`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send(updateData);

      expect(res).to.have.status(403);
      expect(res.body).to.have.property('status', 'error');
    });
    
    it('tenant admin should change store to temporary_closed status', async function() {
      const storeId = testData.storeIds.tenant1;
      const updateData = {
        status: 'temporary_closed',
        reason: '裝修中'
      };

      const res = await chai.request(app)
        .patch(`/api/v1/stores/${storeId}/status`)
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send(updateData);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('status', 'temporary_closed');
    });
    
    it('tenant admin should reactivate store', async function() {
      const storeId = testData.storeIds.tenant1;
      const updateData = {
        status: 'active',
        reason: '重新開業'
      };

      const res = await chai.request(app)
        .patch(`/api/v1/stores/${storeId}/status`)
        .set('Authorization', `Bearer ${tenantAdminToken}`)
        .send(updateData);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('status', 'active');
    });
  });

  // 測試：更新 GPS 圍欄
  describe('6. Update GPS Fence', function() {
    it('store manager should update GPS fence using API format', async function() {
      const storeId = testData.storeIds.tenant1;
      const updateData = {
        enabled: true,
        radius: 100,
        center: {
          latitude: 25.105497,
          longitude: 121.597366
        }
      };

      const res = await chai.request(app)
        .put(`/api/v1/stores/${storeId}/gps-fence`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send(updateData);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('gpsFence');
      expect(res.body.data.gpsFence).to.have.property('enabled', true);
      expect(res.body.data.gpsFence).to.have.property('radius', 100);
      expect(res.body.data.gpsFence).to.have.property('center');
      expect(res.body.data.gpsFence.center).to.have.property('latitude', 25.105497);
      expect(res.body.data.gpsFence.center).to.have.property('longitude', 121.597366);
    });
    
    it('should get updated store with GPS fence data', async function() {
      const storeId = testData.storeIds.tenant1;

      const res = await chai.request(app)
        .get(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`);

      expect(res).to.have.status(200);
      expect(res.body.data).to.have.property('gpsFence');
      expect(res.body.data.gpsFence).to.have.property('enabled', true);
      expect(res.body.data.gpsFence).to.have.property('radius', 100);
    });
  });

  // 測試：更新印表機配置
  describe('7. Update Printer Config', function() {
    it('store manager should update printer config using API format', async function() {
      const storeId = testData.storeIds.tenant1;
      const updateData = {
        enabled: true,
        printerType: 'EPSON',
        apiUrl: 'https://print-server.example.com',
        apiKey: 'test-api-key-123',
        templates: {
          receipt: 'default-receipt',
          kitchen: 'default-kitchen',
          takeout: 'default-takeout'
        }
      };

      const res = await chai.request(app)
        .put(`/api/v1/stores/${storeId}/printer-config`)
        .set('Authorization', `Bearer ${storeManagerToken}`)
        .send(updateData);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證API格式的回應
      expect(res.body.data).to.have.property('printerSettings');
      expect(res.body.data.printerSettings).to.have.property('enabled', true);
      expect(res.body.data.printerSettings).to.have.property('printerType', 'EPSON');
      expect(res.body.data.printerSettings).to.have.property('apiUrl');
    });
    
    it('should get updated store with printer settings data', async function() {
      const storeId = testData.storeIds.tenant1;

      const res = await chai.request(app)
        .get(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`);

      expect(res).to.have.status(200);
      expect(res.body.data).to.have.property('printerSettings');
      expect(res.body.data.printerSettings).to.have.property('enabled', true);
    });
  });

  // 測試：刪除店鋪
  describe('8. Delete Store', function() {
    it('should not allow store manager to delete a store', async function() {
      const storeId = testData.storeIds.tenant1;

      const res = await chai.request(app)
        .delete(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${storeManagerToken}`);

      expect(res).to.have.status(403);
      expect(res.body).to.have.property('status', 'error');
    });

    it('tenant admin should delete a store (logical delete)', async function() {
      const storeId = testData.storeIds.tenant1;

      const res = await chai.request(app)
        .delete(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證刪除後的狀態
      const getRes = await chai.request(app)
        .get(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${tenantAdminToken}`);
        
      expect(getRes).to.have.status(200);
      expect(getRes.body.data).to.have.property('status', 'permanently_closed');
    });

    it('super admin should perform hard delete', async function() {
      const storeId = testData.storeIds.tenant2;

      const res = await chai.request(app)
        .delete(`/api/v1/stores/${storeId}?hardDelete=true`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('status', 'success');
      
      // 驗證完全刪除
      const getRes = await chai.request(app)
        .get(`/api/v1/stores/${storeId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);
        
      expect(getRes).to.have.status(404);
    });
  });
});

// 輔助函數：生成測試用 Token
async function generateTestToken(userClaims) {
  // 實際項目中應使用 Firebase Auth，這裡簡化處理
  if (process.env.FIREBASE_EMULATOR) {
    try {
      // 使用 Firebase Auth 模擬器
      return await admin.auth().createCustomToken(userClaims.uid, userClaims);
    } catch (error) {
      console.error('生成測試 Token 時出錯:', error);
      throw error;
    }
  } else {
    // 模擬：返回編碼的用戶聲明
    return Buffer.from(JSON.stringify(userClaims)).toString('base64');
  }
}

// 輔助函數：設置測試租戶
async function setupTestTenants(tenants) {
  if (process.env.FIREBASE_EMULATOR) {
    const db = admin.firestore();
    for (const tenant of tenants) {
      await db.collection('tenants').doc(tenant.id).set({
        ...tenant,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  } else {
    // 使用 mock
    const { mockFirestore } = require('../firebase-admin.mock');
    for (const tenant of tenants) {
      const mockDoc = mockFirestore.collection('tenants').doc(tenant.id);
      mockDoc.mockDocData(tenant);
    }
  }
}

// 輔助函數：清理測試數據
async function cleanupTestData() {
  if (process.env.FIREBASE_EMULATOR) {
    // 實際項目中應在 Firestore 模擬器中刪除測試數據
    const db = admin.firestore();
    
    // 刪除測試店鋪
    for (const [tenant, storeId] of Object.entries(testData.storeIds)) {
      if (storeId) {
        try {
          await db.collection('stores').doc(storeId).delete();
        } catch (error) {
          console.warn(`刪除測試店鋪 ${storeId} 時出錯:`, error);
        }
      }
    }
    
    // 刪除測試租戶
    try {
      await db.collection('tenants').doc(testTenant1.id).delete();
      await db.collection('tenants').doc(testTenant2.id).delete();
    } catch (error) {
      console.warn('刪除測試租戶時出錯:', error);
    }
  }
} 