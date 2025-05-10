const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { z } = require("zod");
const db = admin.firestore();
const rolesCollection = db.collection("roles");
const tenantsCollection = db.collection("tenants");

// 定義合法的資源類型和操作類型（來自 rbac/types.ts）
const VALID_RESOURCES = [
  'tenants', 'stores', 'users', 'employees', 
  'menuItems', 'menuCategories', 'menuOptions', 
  'orders', 'orderItems', 'inventoryItems', 
  'inventoryCounts', 'inventoryOrders', 'schedules', 
  'attendances', 'leaves', 'payrolls', 'bonusTasks', 'bonusRecords',
  'ratings', 'announcements', 'knowledgeBase', 'votes', 'auditLogs',
  'systemConfigs', 'adSlots', 'adContents', 'referralCodes', 'referralUsages', 
  'pickupNumbers', 'roles'
];

const VALID_ACTIONS = [
  'create', 'read', 'update', 'delete', 
  'approve', 'reject', 'cancel', 'complete', 
  'print', 'export', 'discount', 'refund'
];

// 角色等級（數值越小權限越高）
const ROLE_LEVELS = {
  SUPER_ADMIN: 1,
  TENANT_ADMIN: 2,
  STORE_MANAGER: 3,
  SHIFT_LEADER: 4,
  SENIOR_STAFF: 5,
  STAFF: 6,
  TRAINEE: 7,
  CUSTOMER: 99
};

/**
 * 使用 Zod 定義創建角色的驗證模式
 */
const createRoleSchema = z.object({
  // 基本信息
  roleId: z.string()
    .min(1, "角色ID不能為空")
    .regex(/^[a-z0-9_]+$/, "角色ID只能包含小寫字母、數字和下劃線"),
  roleName: z.string().min(1, "角色名稱不能為空"),
  description: z.string().optional(),
  
  // 權限與等級
  level: z.number().int().min(2, "權限等級必須大於1的整數"),
  permissions: z.record(
    z.string(), // 資源名稱
    z.array(z.string()) // 操作列表
  ),
  
  // 範圍與類型
  tenantId: z.string().nullish(),
  isSystemRole: z.boolean().optional().default(false),
  
  // 狀態
  isActive: z.boolean().optional().default(true)
}).strict();

/**
 * 創建新角色
 */
exports.createRole = async (req, res) => {
  try {
    // 1. 獲取請求用戶信息（用於權限檢查）
    const requestingUser = req.user;
    const userRole = requestingUser.role;
    const userTenantId = requestingUser.tenantId;
    
    // 從用戶聲明中獲取用戶等級
    let userLevel;
    
    // 根據角色確定用戶等級
    if (userRole === "super_admin") {
      userLevel = ROLE_LEVELS.SUPER_ADMIN;
    } else if (userRole === "tenant_admin") {
      userLevel = ROLE_LEVELS.TENANT_ADMIN;
    } else {
      // 如果不是 super_admin 或 tenant_admin，返回 403
      console.warn(`用戶 ${requestingUser.uid} 嘗試創建角色，但角色不是 super_admin 或 tenant_admin。`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：只有 SuperAdmin 和 TenantAdmin 可以創建角色"
      });
    }
    
    // 2. 驗證請求數據
    const validationResult = createRoleSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    // 驗證通過，獲取驗證後的數據
    const validatedData = validationResult.data;
    
    // 3. 根據用戶角色處理 tenantId 和 isSystemRole
    if (userRole === "tenant_admin") {
      // TenantAdmin 只能為自己的租戶創建角色，且不能創建系統角色
      validatedData.tenantId = userTenantId;
      validatedData.isSystemRole = false;
    } else if (validatedData.isSystemRole && validatedData.tenantId !== null) {
      // SuperAdmin 創建的系統角色必須沒有 tenantId
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "系統角色不能綁定租戶ID"
      });
    } else if (validatedData.tenantId !== null && userRole === "super_admin") {
      // SuperAdmin 創建租戶特定角色時，檢查租戶是否存在
      const tenantDoc = await tenantsCollection.doc(validatedData.tenantId).get();
      if (!tenantDoc.exists) {
        return res.status(404).json({
          status: "error",
          errorCode: "E404",
          message: `找不到 ID 為 ${validatedData.tenantId} 的租戶`
        });
      }
    }
    
    // 4. 驗證權限等級（用戶不能創建比自己權限高或相同的角色）
    if (validatedData.level <= userLevel) {
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：不能創建權限等級高於或等於自己的角色"
      });
    }
    
    // 5. 驗證權限是否合法
    for (const [resource, actions] of Object.entries(validatedData.permissions)) {
      // 檢查資源是否合法
      if (!VALID_RESOURCES.includes(resource)) {
        return res.status(400).json({
          status: "error",
          errorCode: "E400",
          message: `無效的資源名稱: ${resource}`
        });
      }
      
      // 檢查操作是否合法
      for (const action of actions) {
        if (!VALID_ACTIONS.includes(action)) {
          return res.status(400).json({
            status: "error",
            errorCode: "E400",
            message: `無效的操作: ${action}`
          });
        }
      }
    }
    
    // 6. 檢查 roleId 唯一性
    let roleQuery;
    if (validatedData.tenantId) {
      // 租戶角色唯一性檢查（在該租戶範圍內）
      roleQuery = rolesCollection.where("roleId", "==", validatedData.roleId)
                              .where("tenantId", "==", validatedData.tenantId);
    } else {
      // 全局角色唯一性檢查
      roleQuery = rolesCollection.where("roleId", "==", validatedData.roleId)
                              .where("tenantId", "==", null);
    }
    
    const existingRoles = await roleQuery.get();
    if (!existingRoles.empty) {
      return res.status(409).json({
        status: "error",
        errorCode: "E409",
        message: `角色ID ${validatedData.roleId} 已存在`
      });
    }
    
    // 7. 添加審計欄位
    const roleData = {
      ...validatedData,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: requestingUser.uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: requestingUser.uid
    };
    
    // 8. 寫入 Firestore
    const roleRef = rolesCollection.doc(validatedData.roleId);
    await roleRef.set(roleData);
    
    // 9. 返回成功響應（將 FieldValue 轉為 ISO 時間格式）
    const now = new Date().toISOString();
    const responseData = {
      ...roleData,
      createdAt: now,
      updatedAt: now
    };
    
    return res.status(201).json(responseData);
    
  } catch (error) {
    console.error("創建角色時出錯:", error);
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "系統內部錯誤"
    });
  }
};

/**
 * 獲取單一角色資料
 */
exports.getRoleById = async (req, res) => {
  try {
    // 1. 從路徑參數獲取角色ID
    const roleId = req.params.roleId;
    
    if (!roleId) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "缺少角色ID參數"
      });
    }
    
    // 2. 獲取請求用戶信息（用於權限檢查）
    const requestingUser = req.user;
    const userRole = requestingUser.role;
    const userTenantId = requestingUser.tenantId;
    
    // 3. 從 Firestore 獲取角色資料
    const roleRef = rolesCollection.doc(roleId);
    const roleDoc = await roleRef.get();
    
    // 檢查角色是否存在
    if (!roleDoc.exists) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: `找不到 ID 為 ${roleId} 的角色`
      });
    }
    
    // 獲取角色資料
    const roleData = roleDoc.data();
    
    // 4. 權限檢查：租戶隔離
    if (roleData.tenantId !== null) {  // 這是租戶特定的角色
      if (userRole !== "super_admin" && roleData.tenantId !== userTenantId) {
        // 非 SuperAdmin 用戶不能查看其他租戶的角色
        console.warn(`用戶 ${requestingUser.uid} (${userRole}) 嘗試查看租戶 ${roleData.tenantId} 的角色，但其屬於租戶 ${userTenantId}`);
        return res.status(403).json({
          status: "error",
          errorCode: "E403",
          message: "未授權：您無權查看此角色"
        });
      }
    }
    
    // 到這裡，訪問權限已確認
    // - SuperAdmin 可以查看任何角色
    // - TenantAdmin 和 StoreManager 可以查看系統角色和自己租戶的角色
    
    // 5. 處理時間戳並返回結果
    // 轉換 Firestore 時間戳為 ISO 字符串
    const response = {
      ...roleData
    };
    
    if (roleData.createdAt) {
      response.createdAt = roleData.createdAt.toDate().toISOString();
    }
    
    if (roleData.updatedAt) {
      response.updatedAt = roleData.updatedAt.toDate().toISOString();
    }
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error("獲取角色資料時出錯:", error);
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "系統內部錯誤"
    });
  }
};

/**
 * 列表讀取角色資料
 * 注意：當前實現沒有分頁功能，將來可能需要添加
 */
exports.listRoles = async (req, res) => {
  try {
    // 1. 獲取請求用戶信息（用於權限檢查和篩選）
    const requestingUser = req.user;
    const userRole = requestingUser.role;
    const userTenantId = requestingUser.tenantId;
    
    // 2. 根據用戶角色確定查詢條件
    let roles = [];
    
    if (userRole === "super_admin") {
      // SuperAdmin 可查看所有角色
      console.log("SuperAdmin 查詢所有角色");
      const allRolesSnap = await rolesCollection.get();
      
      allRolesSnap.forEach(doc => {
        roles.push({
          ...doc.data(),
          roleId: doc.id
        });
      });
    } else {
      // TenantAdmin 和 StoreManager 只能查看系統角色和自己租戶的角色
      // 需要執行兩個查詢並合併結果
      console.log(`${userRole} 查詢系統角色和租戶角色，租戶ID：${userTenantId}`);
      
      // 查詢 1: 系統角色 (tenantId === null)
      const systemRolesQuery = rolesCollection.where("tenantId", "==", null);
      
      // 查詢 2: 租戶特定角色 (tenantId === userTenantId)
      const tenantRolesQuery = rolesCollection.where("tenantId", "==", userTenantId);
      
      // 並行執行兩個查詢
      const [systemRolesSnap, tenantRolesSnap] = await Promise.all([
        systemRolesQuery.get(),
        tenantRolesQuery.get()
      ]);
      
      // 合併結果
      systemRolesSnap.forEach(doc => {
        roles.push({
          ...doc.data(),
          roleId: doc.id
        });
      });
      
      tenantRolesSnap.forEach(doc => {
        roles.push({
          ...doc.data(),
          roleId: doc.id
        });
      });
    }
    
    // 3. 處理時間戳
    roles = roles.map(role => {
      const processedRole = { ...role };
      
      // 轉換時間戳為 ISO 字符串
      if (role.createdAt && typeof role.createdAt.toDate === 'function') {
        processedRole.createdAt = role.createdAt.toDate().toISOString();
      }
      
      if (role.updatedAt && typeof role.updatedAt.toDate === 'function') {
        processedRole.updatedAt = role.updatedAt.toDate().toISOString();
      }
      
      return processedRole;
    });
    
    // 4. 返回結果
    return res.status(200).json(roles);
    
  } catch (error) {
    console.error("列表讀取角色資料時出錯:", error);
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "系統內部錯誤"
    });
  }
};

/**
 * 使用 Zod 定義更新角色的驗證模式（部分更新模式）
 * 所有欄位都是可選的，但如果提供，則需符合特定驗證規則
 */
const updateRoleSchema = z.object({
  // 基本信息
  roleName: z.string().min(1, "角色名稱不能為空").optional(),
  description: z.string().optional(),
  
  // 權限與等級
  level: z.number().int().min(2, "權限等級必須大於1的整數").optional(),
  permissions: z.record(
    z.string(), // 資源名稱
    z.array(z.string()) // 操作列表
  ).optional(),
  
  // 狀態
  isActive: z.boolean().optional()
}).strict();

/**
 * 驗證權限物件的結構與內容
 * @param {Object} permissions 權限物件 {[resource]: string[]}
 * @returns {Object} {valid: boolean, error: string|null}
 */
function validatePermissionsObject(permissions) {
  if (!permissions || typeof permissions !== "object") {
    return { valid: false, error: "permissions 必須是一個物件" };
  }
  
  for (const [resource, actions] of Object.entries(permissions)) {
    // 檢查資源是否合法
    if (!VALID_RESOURCES.includes(resource)) {
      return { valid: false, error: `無效的資源名稱: ${resource}` };
    }
    
    // 檢查操作是否合法
    if (!Array.isArray(actions)) {
      return { valid: false, error: `資源 ${resource} 的操作必須是陣列` };
    }
    
    for (const action of actions) {
      if (!VALID_ACTIONS.includes(action)) {
        return { valid: false, error: `無效的操作: ${action}` };
      }
    }
  }
  
  return { valid: true, error: null };
}

/**
 * 更新角色資料（部分更新）
 */
exports.updateRole = async (req, res) => {
  try {
    // 1. 從路徑參數獲取角色ID
    const roleId = req.params.roleId;
    
    if (!roleId) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "缺少角色ID參數"
      });
    }
    
    // 2. 獲取請求用戶信息（用於權限檢查）
    const requestingUser = req.user;
    const userRole = requestingUser.role;
    const userTenantId = requestingUser.tenantId;
    
    // 從用戶聲明中獲取用戶等級
    let userLevel;
    
    // 根據角色確定用戶等級
    if (userRole === "super_admin") {
      userLevel = ROLE_LEVELS.SUPER_ADMIN;
    } else if (userRole === "tenant_admin") {
      userLevel = ROLE_LEVELS.TENANT_ADMIN;
    } else {
      // 如果不是 super_admin 或 tenant_admin，返回 403
      console.warn(`用戶 ${requestingUser.uid} 嘗試更新角色，但角色不是 super_admin 或 tenant_admin。`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：只有 SuperAdmin 和 TenantAdmin 可以更新角色"
      });
    }
    
    // 3. 從 Firestore 獲取角色資料
    const roleRef = rolesCollection.doc(roleId);
    const roleDoc = await roleRef.get();
    
    // 檢查角色是否存在
    if (!roleDoc.exists) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: `找不到 ID 為 ${roleId} 的角色`
      });
    }
    
    // 獲取角色資料
    const roleData = roleDoc.data();
    
    // 4. 權限檢查
    
    // 4.1 租戶範圍檢查：非 SuperAdmin 不能更新其他租戶的角色
    if (roleData.tenantId !== null && userRole !== "super_admin" && roleData.tenantId !== userTenantId) {
      console.warn(`TenantAdmin ${requestingUser.uid} 嘗試更新租戶 ${roleData.tenantId} 的角色，但其屬於租戶 ${userTenantId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：您無權更新此角色"
      });
    }
    
    // 4.2 系統角色限制
    if (roleData.isSystemRole && userRole !== "super_admin") {
      // TenantAdmin 不能更新系統角色
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：只有 SuperAdmin 可以更新系統角色"
      });
    }
    
    // 4.3 等級檢查：不能修改與自己同級或更高級別的角色
    if (roleData.level <= userLevel) {
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：不能更新權限等級高於或等於自己的角色"
      });
    }
    
    // 5. 驗證請求數據
    const validationResult = updateRoleSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    // 驗證通過，獲取驗證後的數據
    const updatePayload = validationResult.data;
    
    // 6. 等級檢查：如果嘗試修改角色級別，新的級別也必須大於請求者的級別
    if (updatePayload.level !== undefined && updatePayload.level <= userLevel) {
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：不能將角色更新為權限等級高於或等於自己的級別"
      });
    }
    
    // 7. 權限內容驗證
    if (updatePayload.permissions) {
      const permissionValidation = validatePermissionsObject(updatePayload.permissions);
      if (!permissionValidation.valid) {
        return res.status(400).json({
          status: "error",
          errorCode: "E400",
          message: permissionValidation.error
        });
      }
    }
    
    // 8. 系統角色的特殊處理
    if (roleData.isSystemRole && userRole === "super_admin") {
      // SuperAdmin 更新系統角色時，可能會有一些限制
      // 例如，不更改核心的權限結構
      // 這部分邏輯可能需要根據實際業務需求調整
    }
    
    // 9. 構建最終的更新資料
    const updatedData = {
      ...updatePayload,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: requestingUser.uid
    };
    
    // 10. 更新 Firestore
    await roleRef.update(updatedData);
    
    // 11. 重新獲取更新後的角色資料
    const updatedRoleDoc = await roleRef.get();
    const updatedRoleData = updatedRoleDoc.data();
    
    // 處理時間戳
    const response = {
      ...updatedRoleData
    };
    
    if (updatedRoleData.createdAt) {
      response.createdAt = updatedRoleData.createdAt.toDate().toISOString();
    }
    
    if (updatedRoleData.updatedAt) {
      response.updatedAt = updatedRoleData.updatedAt.toDate().toISOString();
    }
    
    // 12. 返回成功響應
    return res.status(200).json(response);
    
  } catch (error) {
    console.error("更新角色資料時出錯:", error);
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "系統內部錯誤"
    });
  }
};

/**
 * 刪除角色資料
 */
exports.deleteRole = async (req, res) => {
  try {
    // 1. 從路徑參數獲取角色ID
    const roleId = req.params.roleId;
    
    if (!roleId) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "缺少角色ID參數"
      });
    }
    
    // 2. 獲取請求用戶信息（用於權限檢查）
    const requestingUser = req.user;
    const userRole = requestingUser.role;
    const userTenantId = requestingUser.tenantId;
    
    // 從用戶聲明中獲取用戶等級
    let userLevel;
    
    // 根據角色確定用戶等級
    if (userRole === "super_admin") {
      userLevel = ROLE_LEVELS.SUPER_ADMIN;
    } else if (userRole === "tenant_admin") {
      userLevel = ROLE_LEVELS.TENANT_ADMIN;
    } else {
      // 如果不是 super_admin 或 tenant_admin，返回 403
      console.warn(`用戶 ${requestingUser.uid} 嘗試刪除角色，但角色不是 super_admin 或 tenant_admin。`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：只有 SuperAdmin 和 TenantAdmin 可以刪除角色"
      });
    }
    
    // 3. 從 Firestore 獲取角色資料
    const roleRef = rolesCollection.doc(roleId);
    const roleDoc = await roleRef.get();
    
    // 檢查角色是否存在
    if (!roleDoc.exists) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: `找不到 ID 為 ${roleId} 的角色`
      });
    }
    
    // 獲取角色資料
    const roleData = roleDoc.data();
    
    // 4. 系統角色限制
    if (roleData.isSystemRole) {
      // 系統角色絕對禁止刪除
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：禁止刪除系統角色"
      });
    }
    
    // 5. 租戶範圍檢查：非 SuperAdmin 不能刪除其他租戶的角色
    if (roleData.tenantId !== null && userRole !== "super_admin" && roleData.tenantId !== userTenantId) {
      console.warn(`TenantAdmin ${requestingUser.uid} 嘗試刪除租戶 ${roleData.tenantId} 的角色，但其屬於租戶 ${userTenantId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：您無權刪除此角色"
      });
    }
    
    // 6. 等級檢查：不能刪除與自己同級或更高級別的角色
    if (roleData.level <= userLevel) {
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: "未授權：不能刪除權限等級高於或等於自己的角色"
      });
    }
    
    // 7. 檢查是否有員工使用此角色 (暫不實現)
    // 未來可能需要檢查 employees 集合中是否有員工被分配了這個角色
    // 如果有關聯的員工，可能需要禁止刪除或提供警告
    
    // 8. 執行刪除操作
    await roleRef.delete();
    
    // 9. 返回成功響應
    return res.status(200).json({
      status: "success",
      message: `角色 ${roleId} 已成功刪除`
    });
    
  } catch (error) {
    console.error("刪除角色資料時出錯:", error);
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "系統內部錯誤"
    });
  }
}; 