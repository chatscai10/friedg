const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore"); // Import FieldValue
const { z } = require("zod"); // 引入zod库用于验证
// const functions = require("firebase-functions"); // Unused import

// TODO: Implement actual database interactions (Firestore)
const db = admin.firestore();
const employeesCollection = db.collection("employees"); // Assuming collection name
const storesCollection = db.collection("stores"); // Added for store validation
const VALID_EMPLOYEE_ROLES = ["StoreManager", "StoreStaff"]; // Define valid roles - fixed single quotes

// 生成唯一的员工 ID (格式: emp_xxxx)
function generateEmployeeId() {
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `emp_${randomStr}`;
}

/**
 * 使用 Zod 定义创建员工的验证模式
 */
const createEmployeeSchema = z.object({
  name: z.string().min(1, "姓名不能为空"),
  phone: z.string().min(1, "电话号码不能为空"),
  email: z.string().email("无效的电子邮件格式").optional(),
  storeId: z.string().min(1, "所属分店 ID 不能为空"),
  position: z.string().min(1, "职位不能为空"),
  roleLevel: z.number().int().min(1, "权限等级必须是大于等于1的整数"),
  lineUserId: z.string().optional(),
  // 可选字段
  status: z.enum(["active", "suspended", "left"]).default("active"),
});

/**
 * Validate required fields for creating an employee.
 * @param {object} data The request body.
 * @return {string|null} Error message or null if valid.
 */
// eslint-disable-next-line no-unused-vars
function validateCreateEmployeeData(data) {
  if (!data.email || typeof data.email !== "string") {
    return "Invalid or missing email.";
  }
  if (!data.password || typeof data.password !== "string" || data.password.length < 6) {
    return "Invalid or missing password (must be at least 6 characters).";
  }
  if (!data.displayName || typeof data.displayName !== "string") {
    return "Invalid or missing displayName.";
  }
  if (!data.role || typeof data.role !== "string") {
    // Role validity check will be done separately
    return "Invalid or missing role.";
  }
  if (!data.storeId || typeof data.storeId !== "string") {
    return "Invalid or missing storeId.";
  }
  // Add other validations based on data_dictionary_v1.md
  return null;
}

/**
 * Create a new employee: Creates Firebase Auth user and Firestore employee document.
 */
exports.createEmployee = async (data, context, user) => {
  try {
    // 1. 驗證請求數據
    const validationResult = createEmployeeSchema.safeParse(data);
    
    if (!validationResult.success) {
      throw new Error(`請求參數錯誤：${validationResult.error.errors[0].message}`);
    }
    
    // 驗證通過，獲取驗證後的數據
    const validatedData = validationResult.data;
    const { name, phone, email, storeId, position, roleLevel, lineUserId, status } = validatedData;
    
    // 2. 使用從中間件傳遞的用戶信息進行權限檢查
    const requestingUser = user;
    
    // 3. 驗證 StoreId 存在性和租戶所有權 (租戶隔離已由中間件處理)
    const tenantId = requestingUser.tenantId;
    
    // StoreManager 只能為自己的商店創建員工
    if (requestingUser.role === "store_manager" && requestingUser.storeId !== storeId) {
      throw new Error(`未授權：店鋪管理員只能為其分配的商店創建員工（${requestingUser.storeId}）`);
    }

    // 檢查店鋪是否存在
    const storeRef = storesCollection.doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      throw new Error(`未找到 ID 為 ${storeId} 的商店`);
    }

    const storeData = storeSnap.data();
    // 對於租戶管理員，驗證商店是否屬於其租戶
    if (requestingUser.role === "tenant_admin" && storeData.tenantId !== tenantId) {
      console.warn(`TenantAdmin ${requestingUser.uid} 嘗試在不屬於其租戶的商店 ${storeId} 中創建員工`);
      throw new Error(`未授權：商店 ${storeId} 不屬於您的租戶`);
    }

    // 4. 生成唯一員工 ID
    const employeeId = generateEmployeeId();
    
    // 5. 創建員工數據對象
    const employeeData = {
      employeeId,
      name,
      phone,
      email: email || null,
      storeId,
      position,
      roleLevel,
      status,
      lineUserId: lineUserId || null,
      tenantId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: requestingUser.uid,
    };

    // 6. 保存到 Firestore
    await employeesCollection.doc(employeeId).set(employeeData);
    console.log(`Successfully created employee: ${employeeId}`);

    // 7. 返回成功響應（使用客戶端可讀的時間戳替換 FieldValue.serverTimestamp()）
    const now = new Date().toISOString();
    return {
      ...employeeData,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    console.error("Error creating employee:", error);
    throw new Error(error.message || "系統內部錯誤");
  }
};

/**
 * Get a single employee by ID.
 */
exports.getEmployeeById = async (req, res) => {
  const employeeId = req.params.employeeId;
  
  try {
    // 1. 获取请求用户信息（用于权限检查）
    const requestingUser = req.user;
    if (!requestingUser || !requestingUser.uid) {
      console.error("Unauthorized access attempt: Missing or invalid user context");
      return res.status(401).json({
        status: "error",
        errorCode: "E401",
        message: "未授权：缺少有效的用户凭证"
      });
    }
    
    // 2. 获取租户 ID 并进行基本验证
    const tenantId = requestingUser.tenantId;
    if (!tenantId) {
      console.error(`Critical: Requesting user ${requestingUser.uid} is missing tenantId claim.`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授权：请求用户上下文无效（缺少 tenantId）"
      });
    }
    
    // 3. 获取员工资料
    let employeeDocSnap;
    console.log(`DEBUG in handler: Firestore instance type:`, typeof db, Object.keys(db));
    
    try {
      // 將數據庫查詢包裝在專門的 try/catch 塊中
      employeeDocSnap = await db.collection('employees').doc(employeeId).get();
    } catch (dbError) {
      // 專門處理數據庫查詢錯誤
      console.error(`Database error when fetching employee ${employeeId}:`, dbError);
      return res.status(500).json({
        status: "error",
        errorCode: "E500",
        message: "获取员工资料时发生系统错误"
      });
    }
    
    // 扩展调试信息
    console.log(`DEBUG in handler: Raw employeeSnap:`, JSON.stringify(employeeDocSnap));
    console.log(`DEBUG in handler: Raw employeeSnap.data():`, employeeDocSnap.data());
    console.log(`DEBUG in handler: Raw employeeSnap exists:`, employeeDocSnap.exists);
    console.log(`DEBUG in handler: Raw employeeSnap constructor:`, employeeDocSnap.constructor && employeeDocSnap.constructor.name);
    
    if (!employeeDocSnap.exists) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: `未找到 ID 为 ${employeeId} 的员工`
      });
    }
    
    const employeeData = employeeDocSnap.data();
    console.log(`DEBUG in handler: Employee Data:`, JSON.stringify(employeeData));
    
    // 4. 执行租户隔离检查
    if (employeeData.tenantId !== tenantId) {
      console.log(`DEBUG in handler: tenantId comparison: Employee tenantId=${employeeData.tenantId} (${typeof employeeData.tenantId}) User tenantId=${tenantId} (${typeof tenantId}) Equality: ${employeeData.tenantId === tenantId}`);
      console.error(`Tenant isolation violation: User ${requestingUser.uid} from tenant ${tenantId} attempted to access employee ${employeeId} from tenant ${employeeData.tenantId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "禁止访问：您没有权限查看此员工资料"
      });
    }
    
    // 角色级权限检查
    let hasPermission = false;
    
    // TenantAdmin 可以访问其租户下的所有员工
    if (requestingUser.role === "TenantAdmin") {
      hasPermission = true;
    }
    
    // StoreManager 只能访问其管理的商店的员工
    if (requestingUser.role === "StoreManager" && requestingUser.storeId === employeeData.storeId) {
      hasPermission = true;
    }
    
    if (!hasPermission) {
      console.warn(`Permission denied: User ${requestingUser.uid} (role: ${requestingUser.role}) attempted to access employee ${employeeId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "禁止访问：您没有权限查看此员工资料"
      });
    }
    
    // 5. 返回员工详细资料（根据资料字典规范转换格式）
    const response = {
      employeeId: employeeData.employeeId,
      userId: employeeData.userId || null,  // Firebase Auth User ID
      tenantId: employeeData.tenantId,
      storeId: employeeData.storeId,
      employeeCode: employeeData.employeeId,  // 使用 employeeId 作为代码
      firstName: employeeData.name,  // TODO: 处理名字拆分逻辑
      lastName: "",  // 现在暂时假设没有姓氏
      fullName: employeeData.name,
      position: employeeData.position,
      employmentType: employeeData.employmentType || "full_time",  // 默认全职
      status: employeeData.status || "active",
      hireDate: employeeData.hireDate || null,
      terminationDate: employeeData.terminationDate || null,
      roleLevel: employeeData.roleLevel,
      contactInfo: {
        phone: employeeData.phone,
        email: employeeData.email || null,
        emergencyContactName: employeeData.emergencyContact?.name || null,
        emergencyContactPhone: employeeData.emergencyContact?.phone || null,
        address: employeeData.address || null,
      },
      createdAt: employeeData.createdAt?.toDate?.() || null,
      updatedAt: employeeData.updatedAt?.toDate?.() || null,
    };
    
    // 转换日期为 ISO 格式
    if (response.createdAt) {
      response.createdAt = response.createdAt.toISOString();
    }
    if (response.updatedAt) {
      response.updatedAt = response.updatedAt.toISOString();
    }
    if (response.hireDate) {
      response.hireDate = response.hireDate.toISOString();
    }
    if (response.terminationDate) {
      response.terminationDate = response.terminationDate.toISOString();
    }
    
    return res.status(200).json({
      status: "success",
      data: response
    });
  } catch (error) {
    // 处理其他未捕获的错误
    console.error(`Error retrieving employee ${employeeId}:`, error);
    
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "获取员工资料时发生系统错误"
    });
  }
};

/**
 * List employees, potentially filtered by storeId and with pagination.
 */
exports.listEmployeesByStore = async (req, res) => {
  try {
    // 1. 获取查询参数
    const {
      storeId,
      page = 1,
      limit = 20,
      sort = "createdAt",
      order = "desc",
      status,
      query: searchQuery
    } = req.query;

    // 转换分页参数为数字
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    
    // 参数合法性检查
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "页码必须是大于等于1的整数"
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "每页数量必须是1-100之间的整数"
      });
    }

    // 偏移量计算
    const offset = (pageNum - 1) * limitNum;

    // 2. 获取请求用户信息（用于权限检查）
    const requestingUser = req.user;
    if (!requestingUser || !requestingUser.uid) {
      console.error("Unauthorized access attempt: Missing or invalid user context");
      return res.status(401).json({
        status: "error",
        errorCode: "E401",
        message: "未授权：缺少有效的用户凭证"
      });
    }

    // 3. 租户隔离检查
    const tenantId = requestingUser.tenantId;
    if (!tenantId) {
      console.error(`Critical: Requesting user ${requestingUser.uid} is missing tenantId claim.`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授权：请求用户上下文无效（缺少 tenantId）"
      });
    }

    // 4. 构建查询
    let query = employeesCollection.where("tenantId", "==", tenantId);
    
    // 5. 权限检查和查询条件设置
    if (requestingUser.role === "StoreManager") {
      // 店铺管理员只能查看自己店铺的员工
      const managerStoreId = requestingUser.storeId;
      
      if (!managerStoreId) {
        console.error(`Critical: StoreManager ${requestingUser.uid} is missing storeId claim.`);
        return res.status(403).json({
          status: "error",
          errorCode: "E403",
          message: "未授权：店铺管理员缺少店铺ID"
        });
      }
      
      // 如果查询参数指定了 storeId，检查是否为管理员所属店铺
      if (storeId && storeId !== managerStoreId) {
        console.warn(`StoreManager ${requestingUser.uid} attempted to query employees of another store: ${storeId}`);
        return res.status(403).json({
          status: "error",
          errorCode: "E403",
          message: "禁止访问：您只能查看自己管理的店铺的员工"
        });
      }
      
      // 无论查询参数如何，都限定为管理员的店铺
      query = query.where("storeId", "==", managerStoreId);
    } else if (requestingUser.role === "TenantAdmin") {
      // 租户管理员可以查看整个租户的员工，如果指定了 storeId 则按指定筛选
      if (storeId) {
        // 确认店铺存在且属于该租户（可选步骤，但建议做）
        try {
          const storeRef = storesCollection.doc(storeId);
          const storeDoc = await storeRef.get();
          
          if (!storeDoc.exists) {
            return res.status(404).json({
              status: "error", 
              errorCode: "E404",
              message: `店铺不存在: ${storeId}`
            });
          }
          
          const storeData = storeDoc.data();
          if (storeData.tenantId !== tenantId) {
            console.warn(`TenantAdmin ${requestingUser.uid} attempted to query employees from another tenant's store: ${storeId}`);
            return res.status(403).json({
              status: "error",
              errorCode: "E403",
              message: "禁止访问：指定的店铺不属于您的租户"
            });
          }
          
          // 店铺存在且属于该租户，添加筛选条件
          query = query.where("storeId", "==", storeId);
        } catch (error) {
          console.error(`Error verifying store ${storeId}:`, error);
          return res.status(500).json({
            status: "error",
            errorCode: "E500",
            message: "验证店铺信息时发生错误"
          });
        }
      }
    } else {
      // 其他角色无权查看员工列表
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "禁止访问：您没有权限查看员工列表"
      });
    }
    
    // 6. 添加其他筛选条件
    if (status) {
      query = query.where("status", "==", status);
    }
    
    // 7. 添加排序
    query = query.orderBy(sort, order);
    
    // 8. 执行计数查询（用于分页）
    let totalCount = 0;
    try {
      const countSnapshot = await query.count().get();
      totalCount = countSnapshot.data().count;
    } catch (error) {
      console.error("Error counting employees:", error);
      // 继续处理，将使用 0 作为总数，前端可能需要处理这种情况
    }
    
    // 9. 添加分页限制
    query = query.limit(limitNum).offset(offset);
    
    // 10. 执行查询
    const querySnapshot = await query.get();
    
    // 转换数据
    const employees = [];
    querySnapshot.forEach(doc => {
      const employeeData = doc.data();
      
      // 转换为规范要求的数據結構
      const formattedEmployee = {
        employeeId: employeeData.employeeId,
        userId: employeeData.uid || null,
        tenantId: employeeData.tenantId,
        storeId: employeeData.storeId,
        employeeCode: employeeData.employeeId,
        firstName: employeeData.name?.split(" ")[0] || "",
        lastName: employeeData.name?.split(" ")[1] || "",
        fullName: employeeData.name || "",
        position: employeeData.position || "",
        employmentType: employeeData.employmentType || "full_time",
        status: employeeData.status || "active",
        hireDate: employeeData.hireDate || null,
        terminationDate: employeeData.terminationDate || null,
        roleLevel: employeeData.roleLevel || 1,
        contactInfo: {
          phone: employeeData.phone || "",
          email: employeeData.email || "",
          emergencyContact: employeeData.emergencyContact?.name || "",
          emergencyPhone: employeeData.emergencyContact?.phone || "",
        },
        createdAt: employeeData.createdAt?.toDate?.() 
          ? employeeData.createdAt.toDate().toISOString() 
          : new Date().toISOString(),
        updatedAt: employeeData.updatedAt?.toDate?.() 
          ? employeeData.updatedAt.toDate().toISOString() 
          : new Date().toISOString(),
      };
      
      employees.push(formattedEmployee);
    });
    
    // 11. 构建分页元数据
    const pagination = {
      totalItems: totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      pageSize: limitNum,
      hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
      hasPreviousPage: pageNum > 1,
    };
    
    // 12. 返回成功响应
    return res.status(200).json({
      status: "success",
      data: employees,
      pagination,
    });
    
  } catch (error) {
    console.error("Error listing employees:", error);
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "获取员工列表时发生系统错误",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update an existing employee.
 */
exports.updateEmployee = async (req, res) => {
  const employeeId = req.params.employeeId;
  const updatePayload = req.body;
  
  try {
    // 1. 获取请求用户信息（用于权限检查）
    const requestingUser = req.user;
    if (!requestingUser || !requestingUser.uid) {
      console.error("Unauthorized access attempt: Missing or invalid user context");
      return res.status(401).json({
        status: "error",
        errorCode: "E401",
        message: "未授权：缺少有效的用户凭证",
      });
    }
    
    // 2. 获取租户 ID 并进行基本验证
    const tenantId = requestingUser.tenantId;
    if (!tenantId) {
      console.error(`Critical: Requesting user ${requestingUser.uid} is missing tenantId claim.`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授权：请求用户上下文无效（缺少 tenantId）",
      });
    }
    
    // 3. 验证请求体中的数据
    // 定义更新员工的验证模式（使用 Zod）
    const updateEmployeeSchema = z.object({
      firstName: z.string().min(1, "名字不能為空").optional(),
      lastName: z.string().min(1, "姓氏不能為空").optional(),
      position: z.string().min(1, "職位不能為空").optional(),
      employmentType: z.enum(["full_time", "part_time", "contract", "intern", "temporary"]).optional(),
      status: z.enum(["active", "inactive", "on_leave", "terminated"]).optional(),
      hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "雇用日期格式不正確 (YYYY-MM-DD)").optional(),
      terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "離職日期格式不正確 (YYYY-MM-DD)").optional(),
      roleLevel: z.number().int().min(1, "權限等級必須是大於等於1的整數").optional(),
      contactInfo: z.object({
        phone: z.string().optional(),
        email: z.string().email("電子郵件格式不正確").optional(),
        emergencyContact: z.string().optional(),
        emergencyPhone: z.string().optional(),
      }).optional(),
    });
    
    const validationResult = updateEmployeeSchema.safeParse(updatePayload);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`,
        details: validationResult.error.errors,
      });
    }
    
    // 驗證通過，獲取驗證後的數據
    const validatedData = validationResult.data;
    
    // 4. 從數據庫中獲取當前員工記錄
    const employeeRef = employeesCollection.doc(employeeId);
    const employeeSnap = await employeeRef.get();
    
    // 檢查員工是否存在
    if (!employeeSnap.exists) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: `未找到 ID 為 ${employeeId} 的員工`,
      });
    }
    
    const employeeData = employeeSnap.data();
    
    // 5. 權限檢查和租戶隔離
    // 檢查租戶隔離 - 確保只能訪問自己租戶下的員工
    if (employeeData.tenantId !== tenantId) {
      console.warn(`Tenant isolation violation: User ${requestingUser.uid} from tenant ${tenantId} attempted to update employee ${employeeId} from tenant ${employeeData.tenantId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "禁止訪問：您沒有權限更新此員工資料",
      });
    }
    
    // 角色級權限檢查
    let hasPermission = false;
    
    // TenantAdmin 可以更新其租戶下的所有員工
    if (requestingUser.role === "TenantAdmin") {
      hasPermission = true;
    }
    
    // StoreManager 只能更新其管理的商店的員工
    if (requestingUser.role === "StoreManager" && requestingUser.storeId === employeeData.storeId) {
      hasPermission = true;
    }
    
    if (!hasPermission) {
      console.warn(`Permission denied: User ${requestingUser.uid} (role: ${requestingUser.role}) attempted to update employee ${employeeId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "禁止訪問：您沒有權限更新此員工資料",
      });
    }
    
    // 6. 防止更新不可變字段
    // 這些字段是不允許通過這個 API 更新的
    const immutableFields = ["employeeId", "uid", "userId", "tenantId", "storeId", "createdAt", "createdBy"];
    for (const field of immutableFields) {
      delete updatePayload[field];
    }
    
    // 檢查權限級別的變更 - 只有 TenantAdmin 能夠變更權限級別
    if (updatePayload.roleLevel !== undefined && requestingUser.role !== "TenantAdmin") {
      console.warn(`Unauthorized role level change attempt: ${requestingUser.uid} (${requestingUser.role}) tried to change employee ${employeeId} role level to ${updatePayload.roleLevel}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "禁止操作：只有租戶管理員可以變更員工的權限級別",
      });
    }
    
    // 7. 構建要更新的數據對象 - 轉換為與數據庫模型一致的結構
    const updateData = {};
    
    // 處理名字和姓氏 (如果兩者都存在則合併為完整名字)
    if (validatedData.firstName !== undefined || validatedData.lastName !== undefined) {
      // 獲取現有的名字資訊
      const currentFirstName = employeeData.name?.split(" ")[0] || "";
      const currentLastName = employeeData.name?.split(" ")[1] || "";
      
      // 使用新提供的值或保留現有值
      const newFirstName = validatedData.firstName !== undefined ? validatedData.firstName : currentFirstName;
      const newLastName = validatedData.lastName !== undefined ? validatedData.lastName : currentLastName;
      
      // 合併為完整名字
      updateData.name = `${newFirstName} ${newLastName}`.trim();
    }
    
    // 複製其他已驗證的字段
    if (validatedData.position !== undefined) updateData.position = validatedData.position;
    if (validatedData.employmentType !== undefined) updateData.employmentType = validatedData.employmentType;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.roleLevel !== undefined) updateData.roleLevel = validatedData.roleLevel;
    
    // 處理日期字段 - 轉換為 Firestore 時間戳或保持日期字符串
    if (validatedData.hireDate !== undefined) {
      // 可以保持為字符串或轉換為 Firestore 時間戳
      updateData.hireDate = validatedData.hireDate;
    }
    
    if (validatedData.terminationDate !== undefined) {
      // 可以保持為字符串或轉換為 Firestore 時間戳
      updateData.terminationDate = validatedData.terminationDate;
    }
    
    // 處理聯繫信息 - 使用深度合併
    if (validatedData.contactInfo) {
      updateData.phone = validatedData.contactInfo.phone !== undefined ? 
        validatedData.contactInfo.phone : employeeData.phone;
      
      updateData.email = validatedData.contactInfo.email !== undefined ? 
        validatedData.contactInfo.email : employeeData.email;
      
      // 更新或創建緊急聯繫人信息
      updateData.emergencyContact = {
        name: validatedData.contactInfo.emergencyContact || 
          (employeeData.emergencyContact ? employeeData.emergencyContact.name : ""),
        phone: validatedData.contactInfo.emergencyPhone || 
          (employeeData.emergencyContact ? employeeData.emergencyContact.phone : ""),
      };
    }
    
    // 8. 添加審計字段
    updateData.updatedAt = FieldValue.serverTimestamp();
    updateData.updatedBy = requestingUser.uid;
    
    // 9. 檢查是否有有效的字段要更新
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "沒有提供有效的更新字段",
      });
    }
    
    // 10. 更新數據庫中的員工記錄
    await employeeRef.update(updateData);
    
    // 11. 獲取更新後的完整記錄
    const updatedEmployeeSnap = await employeeRef.get();
    const updatedEmployeeData = updatedEmployeeSnap.data();
    
    // 12. 將數據庫結構轉換為 API 響應結構
    const responseData = {
      employeeId: updatedEmployeeData.employeeId,
      userId: updatedEmployeeData.uid || null,
      tenantId: updatedEmployeeData.tenantId,
      storeId: updatedEmployeeData.storeId,
      employeeCode: updatedEmployeeData.employeeId, // 可能需要調整為專用的員工編號字段
      firstName: updatedEmployeeData.name?.split(" ")[0] || "",
      lastName: updatedEmployeeData.name?.split(" ")[1] || "",
      fullName: updatedEmployeeData.name || "",
      position: updatedEmployeeData.position || "",
      employmentType: updatedEmployeeData.employmentType || "full_time",
      status: updatedEmployeeData.status || "active",
      hireDate: updatedEmployeeData.hireDate || null,
      terminationDate: updatedEmployeeData.terminationDate || null,
      roleLevel: updatedEmployeeData.roleLevel || 1,
      contactInfo: {
        phone: updatedEmployeeData.phone || "",
        email: updatedEmployeeData.email || "",
        emergencyContact: updatedEmployeeData.emergencyContact?.name || "",
        emergencyPhone: updatedEmployeeData.emergencyContact?.phone || "",
      },
      createdAt: updatedEmployeeData.createdAt?.toDate?.() 
        ? updatedEmployeeData.createdAt.toDate().toISOString() 
        : new Date().toISOString(),
      updatedAt: updatedEmployeeData.updatedAt?.toDate?.() 
        ? updatedEmployeeData.updatedAt.toDate().toISOString() 
        : new Date().toISOString(),
    };
    
    // 13. 返回成功響應
    return res.status(200).json({
      status: "success",
      message: "員工資料更新成功",
      data: responseData,
    });
    
  } catch (error) {
    console.error(`Error updating employee ${employeeId}:`, error);
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "更新員工資料時發生系統錯誤",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete (or disable) an employee.
 */
exports.deleteEmployee = async (req, res) => {
  const employeeId = req.params.employeeId;
  
  try {
    // 1. 獲取請求用戶資訊（用於權限檢查）
    const requestingUser = req.user;
    if (!requestingUser || !requestingUser.uid) {
      console.error("Unauthorized access attempt: Missing or invalid user context");
      return res.status(401).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：缺少有效的用戶憑證",
      });
    }
    
    // 2. 獲取租戶 ID 並進行基本驗證
    const tenantId = requestingUser.tenantId;
    if (!tenantId) {
      console.error(`Critical: Requesting user ${requestingUser.uid} is missing tenantId claim.`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：請求用戶上下文無效（缺少 tenantId）",
      });
    }
    
    // 3. 從數據庫中獲取員工記錄
    const employeeRef = employeesCollection.doc(employeeId);
    const employeeSnap = await employeeRef.get();
    
    // 檢查員工是否存在
    if (!employeeSnap.exists) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: `未找到 ID 為 ${employeeId} 的員工`,
      });
    }
    
    const employeeData = employeeSnap.data();

    // 4. 權限檢查和租戶隔離
    // 檢查租戶隔離 - 確保只能刪除自己租戶下的員工
    if (employeeData.tenantId !== tenantId) {
      console.warn(`Tenant isolation violation: User ${requestingUser.uid} from tenant ${tenantId} attempted to delete employee ${employeeId} from tenant ${employeeData.tenantId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "禁止訪問：您沒有權限刪除此員工",
      });
    }
    
    // 角色級權限檢查
    let hasPermission = false;
    
    // TenantAdmin 可以刪除其租戶下的所有員工
    if (requestingUser.role === "TenantAdmin") {
      hasPermission = true;
    }
    
    // StoreManager 只能刪除其管理的商店的員工
    if (requestingUser.role === "StoreManager" && requestingUser.storeId === employeeData.storeId) {
      hasPermission = true;
    }
    
    if (!hasPermission) {
      console.warn(`Permission denied: User ${requestingUser.uid} (role: ${requestingUser.role}) attempted to delete employee ${employeeId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "禁止訪問：您沒有權限刪除此員工",
      });
    }
    
    // 5. 檢查員工當前狀態，避免重複刪除
    if (employeeData.status === "terminated" || employeeData.status === "deleted") {
      console.warn(`Attempt to delete already deleted employee: ${employeeId}`);
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "員工已被刪除或終止",
      });
    }
    
    // 6. 執行軟刪除操作
    const updatePayload = {
      status: "terminated", // 使用 terminated 表示終止雇傭關係
      terminationDate: new Date().toISOString().split("T")[0], // 設置終止日期為當前日期 (YYYY-MM-DD 格式)
      updatedAt: FieldValue.serverTimestamp(),
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: requestingUser.uid, // 追踪刪除者
    };
    
    // 執行更新操作
    await employeeRef.update(updatePayload);

    // 7. 記錄操作並返回成功響應
    console.log(`Employee ${employeeId} successfully soft deleted by user ${requestingUser.uid}`);
    
    // 返回 204 No Content 狀態碼，表示操作成功且無響應體
    return res.status(204).send();

  } catch (error) {
    console.error(`Error deleting employee ${employeeId}:`, error);
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "刪除員工時發生系統錯誤",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
