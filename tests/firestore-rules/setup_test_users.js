const admin = require("firebase-admin");

// --- Configuration ---
// IMPORTANT: Ensure Auth emulator is running before executing this script!
// Set the FIRESTORE_EMULATOR_HOST environment variable so Admin SDK connects to the emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"; // Default Auth emulator port
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"; // Default Firestore emulator port

try {
  // Initialize without explicit credential when using emulators
  admin.initializeApp({
    projectId: "friedg", // Still provide your project ID
  });
  console.log("Firebase Admin SDK initialized for EMULATOR.");
} catch (e) {
  if (e.code !== 'app/duplicate-app') {
    console.error("Firebase Admin SDK initialization error:", e);
    process.exit(1);
  } else {
    console.log("Firebase Admin SDK already initialized.");
  }
}

// 依據測試計劃定義的測試用戶
const usersToCreate = [
  {
    email: "superadmin@test.com",
    password: "password123",
    displayName: "超級管理員",
    claims: { role: 'super_admin', roleLevel: 0 }
  },
  {
    email: "tenantadmin_a@test.com",
    password: "password123",
    displayName: "租戶管理員A",
    claims: { role: 'tenant_admin', roleLevel: 1, tenantId: 'tenant1' }
  },
  {
    email: "tenantadmin_b@test.com",
    password: "password123",
    displayName: "租戶管理員B",
    claims: { role: 'tenant_admin', roleLevel: 1, tenantId: 'tenant2' }
  },
  {
    email: "storemanager_a1@test.com",
    password: "password123",
    displayName: "店長A1",
    claims: { role: 'store_manager', roleLevel: 2, tenantId: 'tenant1', storeId: 'store1' }
  },
  {
    email: "storemanager_a2@test.com",
    password: "password123",
    displayName: "店長A2",
    claims: { role: 'store_manager', roleLevel: 2, tenantId: 'tenant1', storeId: 'store2' }
  },
  {
    email: "shiftleader_a1@test.com",
    password: "password123",
    displayName: "班長A1",
    claims: { role: 'shift_leader', roleLevel: 3, tenantId: 'tenant1', storeId: 'store1' }
  },
  {
    email: "employee_a1_self@test.com",
    password: "password123",
    displayName: "員工A1-Self",
    uid: "uid-employee1", // 指定 UID 與測試數據相匹配
    claims: { role: 'staff', roleLevel: 5, tenantId: 'tenant1', storeId: 'store1' }
  },
  {
    email: "employee_a1_other@test.com",
    password: "password123",
    displayName: "員工A1-Other",
    claims: { role: 'staff', roleLevel: 5, tenantId: 'tenant1', storeId: 'store1' }
  },
  {
    email: "employee_a2@test.com",
    password: "password123",
    displayName: "員工A2",
    uid: "uid-employee3", // 指定 UID 與測試數據相匹配
    claims: { role: 'staff', roleLevel: 5, tenantId: 'tenant1', storeId: 'store2' }
  }
];

// 測試數據 - 將在設置用戶後填充 Firestore
const testEmployees = [
  {
    uid: 'uid-employee1', 
    employeeId: 'employee1', 
    displayName: '測試員工1', 
    email: 'employee_a1_self@test.com',
    tenantId: 'tenant1', 
    storeId: 'store1', 
    roleLevel: 5, 
    status: 'active'
  },
  {
    uid: 'uid-employee2', 
    employeeId: 'employee2', 
    displayName: '測試員工2',
    email: 'employee2@test.com', 
    tenantId: 'tenant1', 
    storeId: 'store1', 
    roleLevel: 5, 
    status: 'active'
  },
  {
    uid: 'uid-employee3', 
    employeeId: 'employee3', 
    displayName: '測試員工3',
    email: 'employee_a2@test.com', 
    tenantId: 'tenant1', 
    storeId: 'store2', 
    roleLevel: 5, 
    status: 'active'
  },
  {
    uid: 'uid-employee4', 
    employeeId: 'employee4', 
    displayName: '測試店長',
    email: 'test_manager@test.com', 
    tenantId: 'tenant1', 
    storeId: 'store1', 
    roleLevel: 2, 
    status: 'active'
  },
  {
    uid: 'uid-employee5', 
    employeeId: 'employee5', 
    displayName: '測試員工5',
    email: 'employee5@test.com', 
    tenantId: 'tenant2', 
    storeId: 'store3', 
    roleLevel: 5, 
    status: 'active'
  }
];

// 添加一些薪資歷史記錄測試數據
const payrollHistoryEntries = [
  {
    employeeId: 'employee1',
    payrollId: 'entry1',
    amount: 25000,
    date: new Date(),
    description: '五月薪資'
  }
];

async function setupUsers() {
  console.log("啟動測試用戶設置...");

  for (const userData of usersToCreate) {
    let userRecord;
    try {
      // 檢查用戶是否已存在
      try {
        userRecord = await admin.auth().getUserByEmail(userData.email);
        console.log(`用戶 ${userData.email} 已存在 (UID: ${userRecord.uid})。更新聲明...`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // 用戶不存在，創建它們
          const createUserData = {
            email: userData.email,
            password: userData.password,
            displayName: userData.displayName,
            emailVerified: true,
            disabled: false,
          };
          
          // 如果指定了 UID，則使用它
          if (userData.uid) {
            createUserData.uid = userData.uid;
          }
          
          userRecord = await admin.auth().createUser(createUserData);
          console.log(`成功創建用戶 ${userData.email} (UID: ${userRecord.uid})`);
        } else {
          throw error;
        }
      }

      // 設置自定義聲明
      await admin.auth().setCustomUserClaims(userRecord.uid, userData.claims);
      console.log(`成功為 ${userData.email} 設置聲明:`, userData.claims);

    } catch (error) {
      console.error(`處理用戶 ${userData.email} 時失敗:`, error);
    }
  }

  console.log("測試用戶設置完成!");
}

async function setupFirestoreData() {
  console.log("開始設置 Firestore 測試數據...");
  
  const db = admin.firestore();
  
  // 清除現有數據
  const employeesRef = db.collection('employees');
  const snapshot = await employeesRef.get();
  const batch = db.batch();
  
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log("已清除現有員工數據");
  
  // 添加新的測試數據
  for (const employee of testEmployees) {
    await db.collection('employees').doc(employee.employeeId).set(employee);
    console.log(`已添加員工: ${employee.displayName}`);
  }
  
  // 添加薪資歷史記錄
  for (const entry of payrollHistoryEntries) {
    await db.collection('employees').doc(entry.employeeId)
      .collection('payrollHistory').doc(entry.payrollId).set({
        amount: entry.amount,
        date: entry.date,
        description: entry.description
      });
    console.log(`已添加薪資記錄: ${entry.employeeId}/${entry.payrollId}`);
  }
  
  console.log("Firestore 測試數據設置完成!");
}

async function main() {
  await setupUsers();
  await setupFirestoreData();
  console.log("所有設置完成!");
  process.exit(0);
}

main().catch((error) => {
  console.error("設置過程中發生錯誤:", error);
  process.exit(1);
}); 