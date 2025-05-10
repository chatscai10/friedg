const firebase = require("@firebase/rules-unit-testing");
const fs = require("fs");
const { getFirestore, connectFirestoreEmulator } = require("firebase/firestore");
const { initializeApp } = require("firebase/app");

const PROJECT_ID = "friedg-test";
const FIRESTORE_EMULATOR_HOST = "localhost";
const FIRESTORE_EMULATOR_PORT = 8080;

// 輔助函數 - 獲取已驗證的 Firestore 客戶端 (帶有指定的自定義聲明)
function getAuthedFirestore(auth) {
  return firebase.initializeTestApp({
    projectId: PROJECT_ID,
    auth: auth,
  }).firestore();
}

// 獲取超級管理員客戶端
function getSuperAdminFirestore() {
  return getAuthedFirestore({ 
    uid: "superadmin-uid", 
    email: "superadmin@test.com",
    role: "super_admin",
    roleLevel: 0
  });
}

// 獲取租戶管理員 A 客戶端
function getTenantAdminAFirestore() {
  return getAuthedFirestore({ 
    uid: "tenantadmin-a-uid", 
    email: "tenantadmin_a@test.com",
    role: "tenant_admin",
    roleLevel: 1,
    tenantId: "tenant1"
  });
}

// 獲取租戶管理員 B 客戶端
function getTenantAdminBFirestore() {
  return getAuthedFirestore({ 
    uid: "tenantadmin-b-uid", 
    email: "tenantadmin_b@test.com",
    role: "tenant_admin",
    roleLevel: 1,
    tenantId: "tenant2"
  });
}

// 獲取店長 A1 客戶端
function getStoreManagerA1Firestore() {
  return getAuthedFirestore({ 
    uid: "storemanager-a1-uid", 
    email: "storemanager_a1@test.com",
    role: "store_manager",
    roleLevel: 2,
    tenantId: "tenant1",
    storeId: "store1"
  });
}

// 獲取店長 A2 客戶端
function getStoreManagerA2Firestore() {
  return getAuthedFirestore({ 
    uid: "storemanager-a2-uid", 
    email: "storemanager_a2@test.com",
    role: "store_manager",
    roleLevel: 2,
    tenantId: "tenant1",
    storeId: "store2"
  });
}

// 獲取班長 A1 客戶端
function getShiftLeaderA1Firestore() {
  return getAuthedFirestore({ 
    uid: "shiftleader-a1-uid", 
    email: "shiftleader_a1@test.com",
    role: "shift_leader",
    roleLevel: 3,
    tenantId: "tenant1",
    storeId: "store1"
  });
}

// 獲取員工 A1-Self 客戶端
function getEmployeeA1SelfFirestore() {
  return getAuthedFirestore({ 
    uid: "uid-employee1", 
    email: "employee_a1_self@test.com",
    role: "staff",
    roleLevel: 5,
    tenantId: "tenant1",
    storeId: "store1"
  });
}

// 獲取員工 A1-Other 客戶端
function getEmployeeA1OtherFirestore() {
  return getAuthedFirestore({ 
    uid: "employee-a1-other-uid", 
    email: "employee_a1_other@test.com",
    role: "staff",
    roleLevel: 5,
    tenantId: "tenant1",
    storeId: "store1"
  });
}

// 獲取員工 A2 客戶端
function getEmployeeA2Firestore() {
  return getAuthedFirestore({ 
    uid: "uid-employee3", 
    email: "employee_a2@test.com",
    role: "staff",
    roleLevel: 5,
    tenantId: "tenant1",
    storeId: "store2"
  });
}

// 獲取未驗證客戶端
function getUnauthenticatedFirestore() {
  return firebase.initializeTestApp({
    projectId: PROJECT_ID,
    auth: null
  }).firestore();
}

// 清理函數 - 在測試開始前設置初始狀態
async function setupInitialData(adminApp) {
  const adminFirestore = adminApp.firestore();
  
  // 清除現有數據
  const employeesRef = adminFirestore.collection('employees');
  const snapshot = await employeesRef.get();
  const batch = adminFirestore.batch();
  
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }
  
  await batch.commit();
  
  // 添加測試員工數據
  await adminFirestore.collection('employees').doc('employee1').set({
    uid: 'uid-employee1', 
    employeeId: 'employee1', 
    displayName: '測試員工1', 
    email: 'employee_a1_self@test.com',
    tenantId: 'tenant1', 
    storeId: 'store1', 
    roleLevel: 5, 
    status: 'active'
  });
  
  await adminFirestore.collection('employees').doc('employee2').set({
    uid: 'uid-employee2', 
    employeeId: 'employee2', 
    displayName: '測試員工2',
    email: 'employee2@test.com', 
    tenantId: 'tenant1', 
    storeId: 'store1', 
    roleLevel: 5, 
    status: 'active'
  });
  
  await adminFirestore.collection('employees').doc('employee3').set({
    uid: 'uid-employee3', 
    employeeId: 'employee3', 
    displayName: '測試員工3',
    email: 'employee_a2@test.com', 
    tenantId: 'tenant1', 
    storeId: 'store2', 
    roleLevel: 5, 
    status: 'active'
  });
  
  await adminFirestore.collection('employees').doc('employee4').set({
    uid: 'uid-employee4', 
    employeeId: 'employee4', 
    displayName: '測試店長',
    email: 'test_manager@test.com', 
    tenantId: 'tenant1', 
    storeId: 'store1', 
    roleLevel: 2, 
    status: 'active'
  });
  
  await adminFirestore.collection('employees').doc('employee5').set({
    uid: 'uid-employee5', 
    employeeId: 'employee5', 
    displayName: '測試員工5',
    email: 'employee5@test.com', 
    tenantId: 'tenant2', 
    storeId: 'store3', 
    roleLevel: 5, 
    status: 'active'
  });
  
  // 添加薪資歷史記錄
  await adminFirestore.collection('employees').doc('employee1')
    .collection('payrollHistory').doc('entry1').set({
      amount: 25000,
      date: new Date(),
      description: '五月薪資'
    });
    
  console.log("測試數據設置完成");
}

// 1. 讀取單個員工記錄測試案例 (get)
async function testReadSingleEmployee() {
  console.log("\n=== 測試讀取單個員工記錄 (get) ===");
  
  const testCases = [
    {
      name: "SuperAdmin 讀取 employee1",
      db: getSuperAdminFirestore(),
      docPath: "employees/employee1",
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 讀取同租戶 employee1",
      db: getTenantAdminAFirestore(),
      docPath: "employees/employee1",
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 讀取不同租戶 employee5",
      db: getTenantAdminAFirestore(),
      docPath: "employees/employee5",
      expectSuccess: false
    },
    {
      name: "StoreManager A1 讀取同店 employee1",
      db: getStoreManagerA1Firestore(),
      docPath: "employees/employee1",
      expectSuccess: true
    },
    {
      name: "StoreManager A1 讀取不同店 employee3",
      db: getStoreManagerA1Firestore(),
      docPath: "employees/employee3",
      expectSuccess: false
    },
    {
      name: "ShiftLeader A1 讀取同店 employee1",
      db: getShiftLeaderA1Firestore(),
      docPath: "employees/employee1",
      expectSuccess: true
    },
    {
      name: "Employee A1-Self 讀取自己 employee1",
      db: getEmployeeA1SelfFirestore(),
      docPath: "employees/employee1",
      expectSuccess: true
    },
    {
      name: "Employee A1-Other 讀取他人 employee1",
      db: getEmployeeA1OtherFirestore(),
      docPath: "employees/employee1",
      expectSuccess: false
    },
    {
      name: "未驗證用戶讀取 employee1",
      db: getUnauthenticatedFirestore(),
      docPath: "employees/employee1",
      expectSuccess: false
    }
  ];
  
  for (const testCase of testCases) {
    try {
      await firebase.assertSucceeds(testCase.db.doc(testCase.docPath).get());
      if (testCase.expectSuccess) {
        console.log(`✅ 通過: ${testCase.name}`);
      } else {
        console.log(`❌ 失敗: ${testCase.name} - 期望失敗但成功了`);
      }
    } catch (error) {
      if (testCase.expectSuccess) {
        console.log(`❌ 失敗: ${testCase.name} - ${error.message}`);
      } else {
        console.log(`✅ 通過: ${testCase.name}`);
      }
    }
  }
}

// 2. 讀取員工列表測試案例 (list)
async function testListEmployees() {
  console.log("\n=== 測試讀取員工列表 (list) ===");
  
  const testCases = [
    {
      name: "SuperAdmin 無條件列表",
      db: getSuperAdminFirestore(),
      query: db => db.collection('employees'),
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 正確限制範圍",
      db: getTenantAdminAFirestore(),
      query: db => db.collection('employees').where('tenantId', '==', 'tenant1').limit(100),
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 無條件查詢",
      db: getTenantAdminAFirestore(),
      query: db => db.collection('employees'),
      expectSuccess: false
    },
    {
      name: "TenantAdmin A 查詢其他租戶",
      db: getTenantAdminAFirestore(),
      query: db => db.collection('employees').where('tenantId', '==', 'tenant2').limit(100),
      expectSuccess: false
    },
    {
      name: "StoreManager A1 正確限制範圍",
      db: getStoreManagerA1Firestore(),
      query: db => db.collection('employees')
                  .where('tenantId', '==', 'tenant1')
                  .where('storeId', '==', 'store1')
                  .limit(50),
      expectSuccess: true
    },
    {
      name: "StoreManager A1 缺少店鋪條件",
      db: getStoreManagerA1Firestore(),
      query: db => db.collection('employees').where('tenantId', '==', 'tenant1').limit(50),
      expectSuccess: false
    },
    {
      name: "ShiftLeader A1 正確限制範圍",
      db: getShiftLeaderA1Firestore(),
      query: db => db.collection('employees')
                  .where('tenantId', '==', 'tenant1')
                  .where('storeId', '==', 'store1')
                  .limit(30),
      expectSuccess: true
    },
    {
      name: "Employee A1-Self 嘗試列表查詢",
      db: getEmployeeA1SelfFirestore(),
      query: db => db.collection('employees')
                  .where('tenantId', '==', 'tenant1')
                  .where('storeId', '==', 'store1'),
      expectSuccess: false
    },
    {
      name: "未驗證用戶嘗試列表查詢",
      db: getUnauthenticatedFirestore(),
      query: db => db.collection('employees'),
      expectSuccess: false
    }
  ];
  
  for (const testCase of testCases) {
    try {
      await firebase.assertSucceeds(testCase.query(testCase.db).get());
      if (testCase.expectSuccess) {
        console.log(`✅ 通過: ${testCase.name}`);
      } else {
        console.log(`❌ 失敗: ${testCase.name} - 期望失敗但成功了`);
      }
    } catch (error) {
      if (testCase.expectSuccess) {
        console.log(`❌ 失敗: ${testCase.name} - ${error.message}`);
      } else {
        console.log(`✅ 通過: ${testCase.name}`);
      }
    }
  }
}

// 3. 創建員工測試案例 (create)
async function testCreateEmployee() {
  console.log("\n=== 測試創建員工 (create) ===");
  
  const newEmployeeBase = {
    displayName: '新員工',
    email: 'new@test.com',
    tenantId: 'tenant1',
    storeId: 'store1',
    roleLevel: 5,
    status: 'active'
  };
  
  const testCases = [
    {
      name: "SuperAdmin 創建員工",
      db: getSuperAdminFirestore(),
      docPath: "employees/new-employee-1",
      data: { ...newEmployeeBase },
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 創建同租戶店長",
      db: getTenantAdminAFirestore(),
      docPath: "employees/new-employee-2",
      data: { ...newEmployeeBase, roleLevel: 2 },
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 創建高權限角色",
      db: getTenantAdminAFirestore(),
      docPath: "employees/new-employee-3",
      data: { ...newEmployeeBase, roleLevel: 0 },
      expectSuccess: false
    },
    {
      name: "TenantAdmin A 創建其他租戶員工",
      db: getTenantAdminAFirestore(),
      docPath: "employees/new-employee-4",
      data: { ...newEmployeeBase, tenantId: 'tenant2' },
      expectSuccess: false
    },
    {
      name: "StoreManager A1 創建同店低權限員工",
      db: getStoreManagerA1Firestore(),
      docPath: "employees/new-employee-5",
      data: { ...newEmployeeBase, roleLevel: 4 },
      expectSuccess: true
    },
    {
      name: "StoreManager A1 創建同級權限角色",
      db: getStoreManagerA1Firestore(),
      docPath: "employees/new-employee-6",
      data: { ...newEmployeeBase, roleLevel: 2 },
      expectSuccess: false
    },
    {
      name: "ShiftLeader A1 嘗試創建員工",
      db: getShiftLeaderA1Firestore(),
      docPath: "employees/new-employee-7",
      data: { ...newEmployeeBase },
      expectSuccess: false
    },
    {
      name: "Employee A1-Self 嘗試創建員工",
      db: getEmployeeA1SelfFirestore(),
      docPath: "employees/new-employee-8",
      data: { ...newEmployeeBase },
      expectSuccess: false
    },
    {
      name: "未驗證用戶嘗試創建員工",
      db: getUnauthenticatedFirestore(),
      docPath: "employees/new-employee-9",
      data: { ...newEmployeeBase },
      expectSuccess: false
    }
  ];
  
  for (const testCase of testCases) {
    try {
      await firebase.assertSucceeds(testCase.db.doc(testCase.docPath).set(testCase.data));
      if (testCase.expectSuccess) {
        console.log(`✅ 通過: ${testCase.name}`);
      } else {
        console.log(`❌ 失敗: ${testCase.name} - 期望失敗但成功了`);
      }
    } catch (error) {
      if (testCase.expectSuccess) {
        console.log(`❌ 失敗: ${testCase.name} - ${error.message}`);
      } else {
        console.log(`✅ 通過: ${testCase.name}`);
      }
    }
  }
}

// 4. 修改員工測試案例 (update)
async function testUpdateEmployee() {
  console.log("\n=== 測試修改員工 (update) ===");
  
  const testCases = [
    {
      name: "SuperAdmin 修改 employee1",
      db: getSuperAdminFirestore(),
      docPath: "employees/employee1",
      data: { displayName: '已更新名稱-SuperAdmin' },
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 降低權限",
      db: getTenantAdminAFirestore(),
      docPath: "employees/employee1",
      data: { displayName: '已更新名稱-TenantAdmin', roleLevel: 4 },
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 提升至高權限",
      db: getTenantAdminAFirestore(),
      docPath: "employees/employee4",
      data: { roleLevel: 0 },
      expectSuccess: false,
      merge: true
    },
    {
      name: "TenantAdmin A 修改其他租戶員工",
      db: getTenantAdminAFirestore(),
      docPath: "employees/employee5",
      data: { displayName: '已更新名稱' },
      expectSuccess: false,
      merge: true
    },
    {
      name: "StoreManager A1 修改同店員工",
      db: getStoreManagerA1Firestore(),
      docPath: "employees/employee1",
      data: { displayName: '已更新名稱-StoreManager' },
      expectSuccess: true,
      merge: true
    },
    {
      name: "StoreManager A1 修改不同店員工",
      db: getStoreManagerA1Firestore(),
      docPath: "employees/employee3",
      data: { displayName: '已更新名稱' },
      expectSuccess: false,
      merge: true
    },
    {
      name: "Employee A1-Self 修改自己非敏感欄位",
      db: getEmployeeA1SelfFirestore(),
      docPath: "employees/employee1",
      data: { displayName: '已更新名稱-Self', phoneNumber: '0987654321' },
      expectSuccess: true,
      merge: true
    },
    {
      name: "Employee A1-Self 修改自己的權限",
      db: getEmployeeA1SelfFirestore(),
      docPath: "employees/employee1",
      data: { roleLevel: 4 },
      expectSuccess: false,
      merge: true
    },
    {
      name: "Employee A1-Other 修改他人資料",
      db: getEmployeeA1OtherFirestore(),
      docPath: "employees/employee2",
      data: { displayName: '已更新名稱' },
      expectSuccess: false,
      merge: true
    },
    {
      name: "未驗證用戶修改員工",
      db: getUnauthenticatedFirestore(),
      docPath: "employees/employee1",
      data: { displayName: '已更新名稱' },
      expectSuccess: false,
      merge: true
    }
  ];
  
  for (const testCase of testCases) {
    try {
      if (testCase.merge) {
        await firebase.assertSucceeds(testCase.db.doc(testCase.docPath).update(testCase.data));
      } else {
        await firebase.assertSucceeds(testCase.db.doc(testCase.docPath).set(testCase.data, { merge: true }));
      }
      
      if (testCase.expectSuccess) {
        console.log(`✅ 通過: ${testCase.name}`);
      } else {
        console.log(`❌ 失敗: ${testCase.name} - 期望失敗但成功了`);
      }
    } catch (error) {
      if (testCase.expectSuccess) {
        console.log(`❌ 失敗: ${testCase.name} - ${error.message}`);
      } else {
        console.log(`✅ 通過: ${testCase.name}`);
      }
    }
  }
}

// 5. 刪除員工測試案例 (delete)
async function testDeleteEmployee() {
  console.log("\n=== 測試刪除員工 (delete) ===");
  
  const testCases = [
    {
      name: "SuperAdmin 刪除 employee1",
      db: getSuperAdminFirestore(),
      docPath: "employees/employee1",
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 刪除同租戶員工",
      db: getTenantAdminAFirestore(),
      docPath: "employees/employee2",
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 刪除其他租戶員工",
      db: getTenantAdminAFirestore(),
      docPath: "employees/employee5",
      expectSuccess: false
    },
    {
      name: "StoreManager A1 嘗試刪除員工",
      db: getStoreManagerA1Firestore(),
      docPath: "employees/employee3",
      expectSuccess: false
    },
    {
      name: "ShiftLeader A1 嘗試刪除員工",
      db: getShiftLeaderA1Firestore(),
      docPath: "employees/employee4",
      expectSuccess: false
    },
    {
      name: "Employee A1-Self 嘗試自行刪除",
      db: getEmployeeA1SelfFirestore(),
      docPath: "employees/employee1",
      expectSuccess: false
    },
    {
      name: "未驗證用戶嘗試刪除員工",
      db: getUnauthenticatedFirestore(),
      docPath: "employees/employee1",
      expectSuccess: false
    }
  ];
  
  for (const testCase of testCases) {
    try {
      await firebase.assertSucceeds(testCase.db.doc(testCase.docPath).delete());
      if (testCase.expectSuccess) {
        console.log(`✅ 通過: ${testCase.name}`);
      } else {
        console.log(`❌ 失敗: ${testCase.name} - 期望失敗但成功了`);
      }
    } catch (error) {
      if (testCase.expectSuccess) {
        console.log(`❌ 失敗: ${testCase.name} - ${error.message}`);
      } else {
        console.log(`✅ 通過: ${testCase.name}`);
      }
    }
  }
}

// 6. 薪資歷史子集合測試案例 (payrollHistory)
async function testPayrollHistory() {
  console.log("\n=== 測試薪資歷史子集合 (payrollHistory) ===");
  
  const testCases = [
    {
      name: "SuperAdmin 讀取薪資記錄",
      db: getSuperAdminFirestore(),
      docPath: "employees/employee1/payrollHistory/entry1",
      operation: "read",
      expectSuccess: true
    },
    {
      name: "SuperAdmin 寫入薪資記錄",
      db: getSuperAdminFirestore(),
      docPath: "employees/employee1/payrollHistory/newEntry",
      operation: "write",
      data: { amount: 26000, date: new Date(), description: '加薪' },
      expectSuccess: true
    },
    {
      name: "TenantAdmin A 讀取同租戶薪資記錄",
      db: getTenantAdminAFirestore(),
      docPath: "employees/employee1/payrollHistory/entry1",
      operation: "read",
      expectSuccess: true
    },
    {
      name: "StoreManager A1 寫入同店員工薪資記錄",
      db: getStoreManagerA1Firestore(),
      docPath: "employees/employee1/payrollHistory/newEntry2",
      operation: "write",
      data: { amount: 24000, date: new Date(), description: '績效獎金' },
      expectSuccess: true
    },
    {
      name: "Employee A1-Self 讀取自己的薪資記錄",
      db: getEmployeeA1SelfFirestore(),
      docPath: "employees/employee1/payrollHistory/entry1",
      operation: "read",
      expectSuccess: true
    },
    {
      name: "Employee A1-Self 寫入自己的薪資記錄",
      db: getEmployeeA1SelfFirestore(),
      docPath: "employees/employee1/payrollHistory/newEntry3",
      operation: "write",
      data: { amount: 30000, date: new Date(), description: '自己加薪' },
      expectSuccess: false
    },
    {
      name: "Employee A1-Other 讀取他人薪資記錄",
      db: getEmployeeA1OtherFirestore(),
      docPath: "employees/employee2/payrollHistory/entry1",
      operation: "read",
      expectSuccess: false
    }
  ];
  
  for (const testCase of testCases) {
    try {
      if (testCase.operation === "read") {
        await firebase.assertSucceeds(testCase.db.doc(testCase.docPath).get());
      } else if (testCase.operation === "write") {
        await firebase.assertSucceeds(testCase.db.doc(testCase.docPath).set(testCase.data));
      }
      
      if (testCase.expectSuccess) {
        console.log(`✅ 通過: ${testCase.name}`);
      } else {
        console.log(`❌ 失敗: ${testCase.name} - 期望失敗但成功了`);
      }
    } catch (error) {
      if (testCase.expectSuccess) {
        console.log(`❌ 失敗: ${testCase.name} - ${error.message}`);
      } else {
        console.log(`✅ 通過: ${testCase.name}`);
      }
    }
  }
}

// 主測試函數
async function runAllTests() {
  console.log("=== 開始測試 Firestore 安全規則 ===");
  
  // 加載安全規則
  const rules = fs.readFileSync("firestore.rules", "utf8");
  
  try {
    // 載入規則到模擬器
    await firebase.loadFirestoreRules({
      projectId: PROJECT_ID,
      rules: rules,
    });
    console.log("成功載入安全規則");
    
    // 設置初始數據
    const adminApp = firebase.initializeAdminApp({ projectId: PROJECT_ID });
    await setupInitialData(adminApp);
    
    // 執行所有測試案例
    await testReadSingleEmployee();
    await testListEmployees();
    await testCreateEmployee();
    await testUpdateEmployee();
    await testDeleteEmployee();
    await testPayrollHistory();
    
    console.log("\n=== 測試完成 ===");
  } catch (error) {
    console.error("測試過程中發生錯誤:", error);
  } finally {
    // 清理所有應用
    await Promise.all(firebase.apps().map(app => app.delete()));
    console.log("清理測試環境完成");
  }
}

// 執行測試
runAllTests(); 