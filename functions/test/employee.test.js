// 在任何其他導入前，先 mock firebase-admin
const mockEmployees = require("./employee.mock");
const sinon = require("sinon");
const { expect } = require("chai");
const { v4: uuidv4 } = require("uuid");

// 使用 proxyquire 來替換 employee.handlers.js 中的 firebase-admin 引用
const proxyquire = require("proxyquire").noCallThru();
const employeeHandlersPath = "../src/employees/employee.handlers";

// 模擬 uuid 函數，使其返回固定值
const uuidStub = sinon.stub();
uuidStub.returns("test-uuid-123");

const employeeHandlers = proxyquire(employeeHandlersPath, {
  "firebase-admin": mockEmployees.admin,
  "uuid": { v4: uuidStub }
});

describe("Employee Handlers - createEmployee", function() {
  this.timeout(5000);
  
  let req, res;
  let storeDoc;

  beforeEach(() => {
    mockEmployees.reset();
    
    req = {
      body: {
        name: "測試員工",
        phone: "0912345678",
        email: "test@example.com",
        storeId: "test-store-123",
        position: "店員",
        roleLevel: 1,
        status: "active"
      },
      user: {
        uid: "test-user-123",
        role: "TenantAdmin",
        storeId: "test-store-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };

    // 模擬店鋪數據
    const storeData = {
      id: "test-store-123",
      name: "測試店鋪",
      tenantId: "test-tenant-123"
    };

    // 設置 stores 集合 mock - 確保商店存在
    const storesCollection = mockEmployees.createCollectionRef({
      "test-store-123": storeData
    });
    mockEmployees.firestoreMock.collection.withArgs("stores").returns(storesCollection);

    // 設置 employees 集合 mock - 初始為空集合
    const employeesCollection = mockEmployees.createCollectionRef({});
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
  });

  it("應該成功創建員工並返回 201 狀態", async () => {
    await employeeHandlers.createEmployee(req, res);
    
    // 驗證響應
    sinon.assert.calledWith(res.status, 201);
    sinon.assert.calledOnce(res.json);
    
    // 檢查響應數據
    const responseData = res.json.firstCall.args[0];
    expect(responseData).to.be.an("object");
    expect(responseData).to.have.property("status", "success");
    expect(responseData).to.have.property("data");
    expect(responseData.data).to.have.property("employeeId");
    expect(responseData.data).to.have.property("name", "測試員工");
    expect(responseData.data).to.have.property("email", "test@example.com");
    expect(responseData.data).to.have.property("storeId", "test-store-123");
  });

  it("當缺少必要字段時應返回 400", async () => {
    req.body = {
      // 缺少 name 和 phone
      storeId: "test-store-123",
      position: "店員",
      roleLevel: 1
    };
    
    await employeeHandlers.createEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("请求参数错误");
  });

  it("當用戶未授權時應返回 401", async () => {
    req.user = null;
    
    await employeeHandlers.createEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 401);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("未授权");
  });

  it("當店鋪管理員嘗試為其他店鋪創建員工時應返回 403", async () => {
    req.user.role = "StoreManager";
    req.body.storeId = "other-store-123";
    
    await employeeHandlers.createEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 403);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("店铺管理员只能为其分配的商店创建员工");
  });

  it("當店鋪不存在時應返回 404", async () => {
    // 模擬店鋪不存在
    const emptyStoresCollection = mockEmployees.createCollectionRef({});
    mockEmployees.firestoreMock.collection.withArgs("stores").returns(emptyStoresCollection);
    
    await employeeHandlers.createEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 404);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("未找到");
  });

  it("當租戶管理員嘗試在不屬於其租戶的店鋪中創建員工時應返回 403", async () => {
    // 模擬店鋪屬於不同的租戶
    const differentTenantStoreData = {
      id: "test-store-123",
      name: "測試店鋪",
      tenantId: "different-tenant-123"
    };
    
    const storesCollection = mockEmployees.createCollectionRef({
      "test-store-123": differentTenantStoreData
    });
    
    mockEmployees.firestoreMock.collection.withArgs("stores").returns(storesCollection);
    
    await employeeHandlers.createEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 403);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("不属于您的租户");
  });

  it("應該處理數據庫錯誤並返回 500", async () => {
    // 模擬數據庫錯誤
    const employeesCollection = mockEmployees.createCollectionRef({});
    // 正確模擬 add 方法的拒絕
    employeesCollection.add.rejects(new Error("Database error"));
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.createEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 500);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("系统内部错误");
  });
});

describe("Employee Handlers - getEmployeeById", function() {
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    mockEmployees.reset();
    
    req = {
      params: {
        employeeId: "emp_abcd"
      },
      user: {
        uid: "test-user-123",
        role: "TenantAdmin",
        storeId: "test-store-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };

    // 設置模擬員工數據
    const employeeData = {
      employeeId: "emp_abcd",
      name: "測試員工",
      phone: "0912345678",
      email: "test@example.com",
      storeId: "test-store-123",
      tenantId: "test-tenant-123",
      position: "店員",
      roleLevel: 1,
      status: "active",
      createdAt: {
        toDate: () => new Date("2023-01-01")
      },
      updatedAt: {
        toDate: () => new Date("2023-01-02")
      }
    };
    
    // 設置 employees 集合
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": employeeData
    });
    
    // 配置 collection 調用的返回值 - 確保每次調用 collection('employees') 返回相同的 mock 物件
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    // 直接驗證 mock 配置是否正確
    console.log("DEBUG: Mock setup - collection configured correctly:", 
      mockEmployees.firestoreMock.collection("employees") === employeesCollection);
    console.log("DEBUG: Mock setup - docRef exists:", 
      mockEmployees.firestoreMock.collection("employees").doc("emp_abcd") !== undefined);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("應該返回員工詳細信息", async () => {
    // 臨時調試 - 檢查mockEmployees中的數據結構
    const empCollection = mockEmployees.firestoreMock.collection('employees');
    const empDocRef = empCollection.doc('emp_abcd');
    const empDocSnap = await empDocRef.get();
    console.log("DEBUG: Employee Doc Data:", empDocSnap.data());
    console.log("DEBUG: Employee Doc tenantId:", empDocSnap.data().tenantId);
    console.log("DEBUG: Request User tenantId:", req.user.tenantId);
    console.log("DEBUG: Types - Doc tenantId:", typeof empDocSnap.data().tenantId, "User tenantId:", typeof req.user.tenantId);
    console.log("DEBUG: Equality check:", empDocSnap.data().tenantId === req.user.tenantId);
    
    // --- Add this Debug Code ---
    try {
        const mockFirestore = mockEmployees.admin.firestore(); // Get the mocked firestore instance
        const docSnap = await mockFirestore.collection('employees').doc('emp_abcd').get();
        console.log('DEBUG in test: Mock Firestore get().data() output:', docSnap.data());
        console.log('DEBUG in test: docSnap raw:', JSON.stringify(docSnap));
    } catch (e) {
        console.error('DEBUG in test: Error directly calling mock get()', e);
    }
    // --- End of Debug Code ---
    
    // 監聽函數調用
    const oldGetEmployeeById = employeeHandlers.getEmployeeById;
    employeeHandlers.getEmployeeById = async function(req, res) {
      // 調用原函數
      const result = await oldGetEmployeeById(req, res);
      
      // 檢查請求和響應
      console.log("DEBUG: Request params:", req.params);
      console.log("DEBUG: Request user:", req.user);
      console.log("DEBUG: Response status:", res.status.firstCall?.args);
      console.log("DEBUG: Response json:", res.json.firstCall?.args);
      
      return result;
    };
    
    await employeeHandlers.getEmployeeById(req, res);
    
    // 還原原始函數
    employeeHandlers.getEmployeeById = oldGetEmployeeById;
    
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    
    const responseData = res.json.firstCall.args[0];
    expect(responseData).to.have.property("status", "success");
    expect(responseData).to.have.property("data");
    expect(responseData.data).to.have.property("employeeId", "emp_abcd");
    expect(responseData.data).to.have.property("fullName", "測試員工");
    expect(responseData.data).to.have.property("storeId", "test-store-123");
  });

  it("當員工不存在時應返回 404", async () => {
    // 模擬員工不存在
    const emptyEmployeesCollection = mockEmployees.createCollectionRef({});
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(emptyEmployeesCollection);
    
    await employeeHandlers.getEmployeeById(req, res);
    
    expect(res.status.calledWith(404)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0].message).to.include("未找到");
  });

  it("當用戶未授權時應返回 401", async () => {
    req.user = null;
    
    await employeeHandlers.getEmployeeById(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0].message).to.include("未授权");
  });

  it("當嘗試訪問不同租戶的員工時應返回 403", async () => {
    // 模擬員工屬於不同的租戶
    const differentTenantEmployeeData = {
      employeeId: "emp_abcd",
      name: "測試員工",
      tenantId: "different-tenant-123",
      storeId: "test-store-123"
    };
    
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": differentTenantEmployeeData
    });
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.getEmployeeById(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0].message).to.include("禁止访问");
  });

  it("當店鋪管理員嘗試訪問其他店鋪的員工時應返回 403", async () => {
    req.user.role = "StoreManager";
    
    // 模擬員工屬於不同的店鋪
    const differentStoreEmployeeData = {
      employeeId: "emp_abcd",
      name: "測試員工",
      tenantId: "test-tenant-123",
      storeId: "different-store-123"
    };
    
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": differentStoreEmployeeData
    });
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.getEmployeeById(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0].message).to.include("禁止访问");
  });

  it("應該處理數據庫錯誤並返回 500", async () => {
    // 重置 mock，確保之前的測試不會影響
    mockEmployees.firestoreMock.collection.resetHistory();
    
    // 創建固定的模擬對象
    const mockDocRef = {
      get: sinon.stub().rejects(new Error("Database error"))
    };
    
    const mockCollection = {
      doc: sinon.stub().returns(mockDocRef)
    };
    
    // 設置模擬行為
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(mockCollection);
    
    // 添加調試日誌
    console.log("DEBUG db error test: Collection and doc ref set up with error mock");
    
    // 調用處理程序
    await employeeHandlers.getEmployeeById(req, res);
    
    // 驗證結果
    console.log("DEBUG after handler: res.status calls:", res.status.args);
    console.log("DEBUG after handler: res.json calls:", res.json.args);
    
    // 驗證是否返回了 500 狀態碼
    sinon.assert.calledWith(res.status, 500);
    
    // 驗證錯誤響應內容
    const errorResponse = res.json.firstCall.args[0];
    expect(errorResponse).to.have.property("status", "error");
    expect(errorResponse).to.have.property("errorCode", "E500");
    expect(errorResponse.message).to.equal("获取员工资料时发生系统错误");
  });
});

describe("Employee Handlers - updateEmployee", function() {
  this.timeout(5000);
  
  let req, res;
  let originalEmployeeData;

  beforeEach(() => {
    mockEmployees.reset();
    
    req = {
      params: {
        employeeId: "emp_abcd"
      },
      body: {
        firstName: "新名",
        lastName: "新姓",
        position: "資深店員",
        status: "on_leave",
        roleLevel: 2,
        contactInfo: {
          phone: "0955667788",
          email: "newemail@example.com",
          emergencyContact: "緊急聯絡人",
          emergencyPhone: "0911223344"
        }
      },
      user: {
        uid: "test-user-123",
        role: "TenantAdmin",
        storeId: "test-store-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };

    // 原始員工數據
    originalEmployeeData = {
      employeeId: "emp_abcd",
      name: "舊名 舊姓",
      phone: "0912345678",
      email: "old@example.com",
      storeId: "test-store-123",
      tenantId: "test-tenant-123",
      position: "店員",
      roleLevel: 1,
      status: "active",
      emergencyContact: {
        name: "舊聯絡人",
        phone: "0900000000"
      },
      createdAt: {
        toDate: () => new Date("2023-01-01")
      },
      updatedAt: {
        toDate: () => new Date("2023-01-02")
      }
    };

    // 設置 employees 集合和文檔引用
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": originalEmployeeData
    });
    
    // 配置 collection 調用的返回值
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
  });

  it("應該成功更新員工信息並返回更新後的數據", async () => {
    await employeeHandlers.updateEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 200);
    sinon.assert.calledOnce(res.json);
    
    const responseData = res.json.firstCall.args[0];
    expect(responseData).to.have.property("status", "success");
    expect(responseData).to.have.property("message", "員工資料更新成功");
    expect(responseData).to.have.property("data");
    expect(responseData.data).to.have.property("employeeId", "emp_abcd");
    expect(responseData.data).to.have.property("firstName", "新名");
    expect(responseData.data).to.have.property("lastName", "新姓");
    expect(responseData.data).to.have.property("position", "資深店員");
    expect(responseData.data).to.have.property("status", "on_leave");
    expect(responseData.data).to.have.property("roleLevel", 2);
    expect(responseData.data.contactInfo).to.have.property("phone", "0955667788");
    expect(responseData.data.contactInfo).to.have.property("email", "newemail@example.com");
  });

  it("當更新數據無效時應返回 400", async () => {
    req.body = {
      firstName: ""  // 名字不能為空
    };
    
    await employeeHandlers.updateEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("请求参数错误");
  });

  it("當員工不存在時應返回 404", async () => {
    // 模擬員工不存在
    const emptyEmployeesCollection = mockEmployees.createCollectionRef({});
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(emptyEmployeesCollection);
    
    await employeeHandlers.updateEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 404);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("未找到");
  });

  it("當嘗試更新不同租戶的員工時應返回 403", async () => {
    // 模擬員工屬於不同的租戶
    const differentTenantEmployeeData = {
      ...originalEmployeeData,
      tenantId: "different-tenant-123"
    };
    
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": differentTenantEmployeeData
    });
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.updateEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 403);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("禁止访问");
  });

  it("當店鋪管理員嘗試更新其他店鋪的員工時應返回 403", async () => {
    req.user.role = "StoreManager";
    
    // 模擬員工屬於不同的店鋪
    const differentStoreEmployeeData = {
      ...originalEmployeeData,
      storeId: "different-store-123"
    };
    
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": differentStoreEmployeeData
    });
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.updateEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 403);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("禁止访问");
  });

  it("當非租戶管理員嘗試變更權限級別時應返回 403", async () => {
    req.user.role = "StoreManager";
    
    await employeeHandlers.updateEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 403);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("只有租户管理员可以变更员工的权限级别");
  });

  it("當沒有提供有效的更新字段時應返回 400", async () => {
    req.body = {};  // 空的更新內容
    
    await employeeHandlers.updateEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("没有提供有效的更新字段");
  });

  it("應該處理數據庫錯誤並返回 500", async () => {
    // 模擬數據庫更新錯誤
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": originalEmployeeData
    });
    
    const docRef = employeesCollection.doc("emp_abcd");
    docRef.update.rejects(new Error("Database update error"));
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.updateEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 500);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("更新员工资料时发生系统错误");
  });
});

describe("Employee Handlers - deleteEmployee", function() {
  this.timeout(5000);
  
  let req, res;
  let employeeData;

  beforeEach(() => {
    mockEmployees.reset();
    
    req = {
      params: {
        employeeId: "emp_abcd"
      },
      user: {
        uid: "test-user-123",
        role: "TenantAdmin",
        storeId: "test-store-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub(),
      json: sinon.stub()
    };

    // 員工數據
    employeeData = {
      employeeId: "emp_abcd",
      name: "測試員工",
      phone: "0912345678",
      email: "test@example.com",
      storeId: "test-store-123",
      tenantId: "test-tenant-123",
      position: "店員",
      roleLevel: 1,
      status: "active",
      createdAt: {
        toDate: () => new Date("2023-01-01")
      },
      updatedAt: {
        toDate: () => new Date("2023-01-02")
      }
    };

    // 設置 employees 集合
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": employeeData
    });
    
    // 配置 collection 調用的返回值
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
  });

  it("應該成功執行軟刪除並返回 204 狀態", async () => {
    await employeeHandlers.deleteEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 204);
    sinon.assert.calledOnce(res.send);
    
    // 驗證調用 update 的參數
    const employeesCollection = mockEmployees.firestoreMock.collection("employees");
    const docRef = employeesCollection.doc("emp_abcd");
    const updateCall = docRef.update.getCall(0);
    
    expect(updateCall).to.not.be.null;
    expect(updateCall.args[0]).to.have.property("status", "terminated");
    expect(updateCall.args[0]).to.have.property("terminationDate");
    expect(updateCall.args[0]).to.have.property("deletedBy", "test-user-123");
  });

  it("當員工不存在時應返回 404", async () => {
    // 模擬員工不存在
    const emptyEmployeesCollection = mockEmployees.createCollectionRef({});
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(emptyEmployeesCollection);
    
    await employeeHandlers.deleteEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 404);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("未找到");
  });

  it("當用戶未授權時應返回 401", async () => {
    req.user = null;
    
    await employeeHandlers.deleteEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 401);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("未授权");
  });

  it("當嘗試刪除不同租戶的員工時應返回 403", async () => {
    // 模擬員工屬於不同的租戶
    const differentTenantEmployeeData = {
      ...employeeData,
      tenantId: "different-tenant-123"
    };
    
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": differentTenantEmployeeData
    });
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.deleteEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 403);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("禁止访问");
  });

  it("當店鋪管理員嘗試刪除其他店鋪的員工時應返回 403", async () => {
    req.user.role = "StoreManager";
    
    // 模擬員工屬於不同的店鋪
    const differentStoreEmployeeData = {
      ...employeeData,
      storeId: "different-store-123"
    };
    
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": differentStoreEmployeeData
    });
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.deleteEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 403);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("禁止访问");
  });

  it("當嘗試刪除已被刪除的員工時應返回 400", async () => {
    // 模擬已刪除的員工
    const terminatedEmployeeData = {
      ...employeeData,
      status: "terminated"
    };
    
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": terminatedEmployeeData
    });
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.deleteEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("员工已被删除或终止");
  });

  it("應該處理數據庫錯誤並返回 500", async () => {
    // 模擬數據庫錯誤
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_abcd": employeeData
    });
    
    const docRef = employeesCollection.doc("emp_abcd");
    docRef.update.rejects(new Error("Database error"));
    
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    await employeeHandlers.deleteEmployee(req, res);
    
    sinon.assert.calledWith(res.status, 500);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("删除员工时发生系统错误");
  });
});

describe("Employee Handlers - listEmployeesByStore", function() {
  this.timeout(5000);
  
  let req, res;
  let employees;

  beforeEach(() => {
    mockEmployees.reset();
    
    req = {
      query: {
        storeId: "test-store-123",
        page: "1",
        limit: "20",
        sort: "createdAt",
        order: "desc",
        status: "active"
      },
      user: {
        uid: "test-user-123",
        role: "TenantAdmin",
        storeId: "test-store-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };

    // 設置模擬員工數據
    employees = [
      {
        employeeId: "emp_0001",
        name: "測試員工1",
        phone: "0912345678",
        email: "test1@example.com",
        storeId: "test-store-123",
        tenantId: "test-tenant-123",
        position: "店長",
        roleLevel: 2,
        status: "active",
        createdAt: {
          toDate: () => new Date("2023-01-01")
        },
        updatedAt: {
          toDate: () => new Date("2023-01-02")
        }
      },
      {
        employeeId: "emp_0002",
        name: "測試員工2",
        phone: "0923456789",
        email: "test2@example.com",
        storeId: "test-store-123",
        tenantId: "test-tenant-123",
        position: "店員",
        roleLevel: 1,
        status: "active",
        createdAt: {
          toDate: () => new Date("2023-02-01")
        },
        updatedAt: {
          toDate: () => new Date("2023-02-02")
        }
      }
    ];
    
    // 建立一個包含測試員工的員工集合
    const employeesCollection = mockEmployees.createCollectionRef({
      "emp_0001": employees[0],
      "emp_0002": employees[1]
    });
    
    // 配置 collection 調用的返回值
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(employeesCollection);
    
    // 設置店鋪集合
    const storesCollection = mockEmployees.createCollectionRef({
      "test-store-123": { 
        id: "test-store-123", 
        name: "測試店鋪", 
        tenantId: "test-tenant-123" 
      }
    });
    mockEmployees.firestoreMock.collection.withArgs("stores").returns(storesCollection);
  });

  it("應該返回員工列表和分頁信息", async () => {
    await employeeHandlers.listEmployeesByStore(req, res);
    
    sinon.assert.calledWith(res.status, 200);
    sinon.assert.calledOnce(res.json);
    
    const responseData = res.json.firstCall.args[0];
    expect(responseData).to.have.property("status", "success");
    expect(responseData).to.have.property("data");
    expect(responseData.data).to.be.an("array");
    expect(responseData.data.length).to.equal(2);
    expect(responseData).to.have.property("pagination");
    expect(responseData.pagination).to.have.property("totalItems", 2);
    expect(responseData.pagination).to.have.property("currentPage", 1);
  });

  it("當分頁參數無效時應返回 400", async () => {
    req.query.page = "invalid";
    
    await employeeHandlers.listEmployeesByStore(req, res);
    
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("页码必须是大于等于1的整数");
  });

  it("當用戶未授權時應返回 401", async () => {
    req.user = null;
    
    await employeeHandlers.listEmployeesByStore(req, res);
    
    sinon.assert.calledWith(res.status, 401);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("未授权");
  });

  it("當店鋪管理員嘗試查詢其他店鋪的員工時應返回 403", async () => {
    req.user.role = "StoreManager";
    req.query.storeId = "other-store-123";
    
    await employeeHandlers.listEmployeesByStore(req, res);
    
    sinon.assert.calledWith(res.status, 403);
    sinon.assert.calledOnce(res.json);
    expect(res.json.firstCall.args[0].message).to.include("禁止访问");
  });

  it("應該處理數據庫錯誤並返回 500", async () => {
    // 創建一個帶有錯誤的 mock 集合
    const errorCollection = {
      where: sinon.stub().returnsThis(),
      orderBy: sinon.stub().returnsThis(),
      count: sinon.stub().returns({
        get: sinon.stub().rejects(new Error("Database error"))
      })
    };
    
    // 設置 mock
    mockEmployees.firestoreMock.collection.withArgs("employees").returns(errorCollection);
    
    await employeeHandlers.listEmployeesByStore(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0].message).to.include("获取员工列表时发生系统错误");
  });
}); 