const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");

// Firestore 集合引用
const db = admin.firestore();
const storesCollection = db.collection("stores");
const tenantsCollection = db.collection("tenants");

/**
 * 使用 Zod 定義創建商店的驗證模式
 */
const createStoreSchema = z.object({
  storeName: z.string().min(1, "商店名稱不能為空").max(50, "商店名稱不能超過50個字元"),
  location: z.object({
    address: z.string().min(1, "地址不能為空"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }),
  contactInfo: z.object({
    email: z.string().email("無效的電子郵件格式").optional().nullable(),
    phone: z.string().min(1, "聯絡電話不能為空"),
    managerId: z.string().optional().nullable()
  }),
  openHours: z.array(
    z.object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "開始時間格式應為 HH:MM"),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "結束時間格式應為 HH:MM")
    })
  ).optional(),
  gpsFence: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radius: z.number().min(1, "打卡半徑必須大於0")
  }).optional(),
  status: z.enum(["active", "inactive", "temporary_closed", "permanently_closed"]).default("active")
}).strict();

/**
 * 創建新商店
 */
exports.createStore = async (req, res) => {
  try {
    // 1. 驗證請求數據
    const validationResult = createStoreSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    // 驗證通過，獲取驗證後的數據
    const validatedData = validationResult.data;
    
    // 2. 獲取請求用戶信息
    const requestingUser = req.user;
    const tenantId = requestingUser.tenantId;
    
    if (!tenantId) {
      console.error(`嚴重問題：請求用戶 ${requestingUser.uid} 缺少 tenantId 聲明。`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：請求用戶上下文無效（缺少 tenantId）"
      });
    }
    
    // 3. 使用 Firestore Transaction 確保租戶限制檢查和商店創建的原子性
    const result = await db.runTransaction(async (transaction) => {
      // 獲取租戶數據
      const tenantRef = tenantsCollection.doc(tenantId);
      const tenantDoc = await transaction.get(tenantRef);
      
      if (!tenantDoc.exists) {
        throw new Error(`找不到租戶資料 (ID: ${tenantId})`);
      }
      
      const tenantData = tenantDoc.data();
      
      // 檢查租戶的商店數量限制
      const currentStoreCount = tenantData.storeCount || 0;
      const maxStores = tenantData.limits?.maxStores || 0;
      
      if (maxStores > 0 && currentStoreCount >= maxStores) {
        throw new Error(`已達到最大商店數量限制 (${maxStores})`);
      }
      
      // 生成唯一的 storeId (UUID)
      const storeId = uuidv4();
      
      // 準備商店數據
      const storeData = {
        storeId,
        tenantId,
        storeName: validatedData.storeName,
        location: validatedData.location,
        contactInfo: validatedData.contactInfo,
        status: validatedData.status,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      // 添加可選欄位
      if (validatedData.openHours) {
        storeData.openHours = validatedData.openHours;
      }
      
      if (validatedData.gpsFence) {
        storeData.gpsFence = validatedData.gpsFence;
      }
      
      // 創建新商店文檔
      const storeRef = storesCollection.doc(storeId);
      transaction.set(storeRef, storeData);
      
      // 更新租戶的商店計數
      transaction.update(tenantRef, {
        storeCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // 返回創建的商店數據
      return {
        storeRef,
        storeData
      };
    });
    
    // 4. 獲取包含服務器時間戳的文檔
    const storeSnapshot = await result.storeRef.get();
    const createdStoreData = storeSnapshot.data();
    
    // 5. 格式化時間戳為 ISO 字符串
    const responseData = {
      ...createdStoreData,
      createdAt: createdStoreData.createdAt ? createdStoreData.createdAt.toDate().toISOString() : null,
      updatedAt: createdStoreData.updatedAt ? createdStoreData.updatedAt.toDate().toISOString() : null
    };
    
    // 6. 返回成功響應
    return res.status(201).json(responseData);
    
  } catch (error) {
    console.error("創建商店時出錯:", error);
    
    // 根據錯誤類型返回適當的錯誤響應
    if (error.message?.includes("找不到租戶資料")) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: error.message
      });
    }
    
    if (error.message?.includes("已達到最大商店數量限制")) {
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: error.message
      });
    }
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "創建商店時發生系統內部錯誤"
    });
  }
};

/**
 * 獲取單一商店資料
 */
exports.getStoreById = async (req, res) => {
  try {
    // 1. 從路徑參數獲取商店ID
    const storeId = req.params.storeId;
    
    if (!storeId) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "缺少商店ID參數"
      });
    }
    
    // 2. 獲取請求用戶信息（用於權限檢查）
    const requestingUser = req.user;
    const tenantId = requestingUser.tenantId;
    const userRole = requestingUser.role;
    
    if (!tenantId) {
      console.error(`嚴重問題：請求用戶 ${requestingUser.uid} 缺少 tenantId 聲明。`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：請求用戶上下文無效（缺少 tenantId）"
      });
    }
    
    // 3. 從 Firestore 獲取商店數據
    const storeRef = storesCollection.doc(storeId);
    const storeSnap = await storeRef.get();
    
    // 檢查商店是否存在
    if (!storeSnap.exists) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: `未找到ID為 ${storeId} 的商店資料`
      });
    }
    
    const storeData = storeSnap.data();
    
    // 4. 權限檢查
    // 確保請求用戶屬於該商店所屬的租戶
    if (storeData.tenantId !== tenantId) {
      console.warn(`未授權訪問嘗試：用戶 ${requestingUser.uid}（角色：${userRole}）嘗試訪問不屬於其租戶的商店 ${storeId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：您沒有權限查看此商店資料"
      });
    }
    
    // 如果請求者是 StoreManager，還需額外驗證該商店的 storeId 是否與 requestingUser.storeId 匹配
    if (userRole === "StoreManager" && requestingUser.storeId !== storeId) {
      console.warn(`未授權訪問嘗試：店長 ${requestingUser.uid} 嘗試訪問非其管理的商店 ${storeId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：店長只能查看自己管理的商店資料"
      });
    }
    
    // 5. 處理時間戳（將 Firestore Timestamp 轉換為 ISO 字符串）
    const responseData = {
      ...storeData
    };
    
    // 處理 createdAt 和 updatedAt 時間戳
    if (storeData.createdAt) {
      responseData.createdAt = storeData.createdAt.toDate().toISOString();
    }
    
    if (storeData.updatedAt) {
      responseData.updatedAt = storeData.updatedAt.toDate().toISOString();
    }
    
    // 6. 返回商店資料
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error("獲取商店資料時出錯:", error);
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "系統內部錯誤"
    });
  }
};

/**
 * 列表讀取商店資料 - 支持篩選與分頁
 */
exports.listStores = async (req, res) => {
  try {
    // 1. 獲取請求用戶信息（用於權限檢查和篩選）
    const requestingUser = req.user;
    const tenantId = requestingUser.tenantId;
    const userRole = requestingUser.role;
    
    if (!tenantId) {
      console.error(`嚴重問題：請求用戶 ${requestingUser.uid} 缺少 tenantId 聲明。`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：請求用戶上下文無效（缺少 tenantId）"
      });
    }
    
    // 2. 處理查詢參數
    const { limit = 10, lastVisible } = req.query;
    const parsedLimit = parseInt(limit, 10);
    
    // 驗證查詢參數
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "無效的 limit 參數，必須是介於 1-100 的數字"
      });
    }
    
    // 3. 建立查詢 - 始終基於 tenantId 篩選
    let query = storesCollection.where("tenantId", "==", tenantId);
    
    // 4. 根據用戶角色決定篩選邏輯
    if (userRole === "StoreManager") {
      // StoreManager 只能查看自己管理的商店
      const storeId = requestingUser.storeId;
      
      if (!storeId) {
        console.warn(`不完整的 StoreManager 用戶資料：用戶 ${requestingUser.uid} 缺少 storeId 聲明。`);
        return res.status(403).json({
          status: "error",
          errorCode: "E401",
          message: "未授權：店長用戶上下文無效（缺少 storeId）"
        });
      }
      
      query = query.where("storeId", "==", storeId);
    }
    
    // 5. 添加排序（默認按更新時間降序）
    query = query.orderBy("updatedAt", "desc");
    
    // 6. 處理分頁
    if (lastVisible) {
      try {
        // 若提供了 lastVisible，將其解碼並用於游標分頁
        const lastVisibleDoc = await storesCollection.doc(lastVisible).get();
        
        if (!lastVisibleDoc.exists) {
          return res.status(400).json({
            status: "error",
            errorCode: "E400",
            message: "無效的 lastVisible 參數"
          });
        }
        
        // 使用上次看到的文檔作為開始位置
        query = query.startAfter(lastVisibleDoc);
      } catch (error) {
        console.error("分頁處理出錯:", error);
        return res.status(400).json({
          status: "error",
          errorCode: "E400",
          message: "無效的 lastVisible 參數"
        });
      }
    }
    
    // 7. 添加限制
    query = query.limit(parsedLimit);
    
    // 8. 執行查詢
    const snapshot = await query.get();
    
    // 9. 提取數據並處理時間戳
    const stores = [];
    let lastDoc = null;
    
    snapshot.forEach((doc) => {
      const storeData = doc.data();
      
      // 轉換時間戳為 ISO 字符串
      const formattedStore = {
        ...storeData,
        createdAt: storeData.createdAt ? storeData.createdAt.toDate().toISOString() : null,
        updatedAt: storeData.updatedAt ? storeData.updatedAt.toDate().toISOString() : null
      };
      
      stores.push(formattedStore);
      lastDoc = doc;
    });
    
    // 10. 構建分頁信息
    const pagination = {
      limit: parsedLimit,
      total: stores.length,
      hasMore: stores.length === parsedLimit,
      lastVisible: lastDoc ? lastDoc.id : null
    };
    
    // 11. 返回結果
    return res.status(200).json({
      stores,
      pagination
    });
    
  } catch (error) {
    console.error("獲取商店列表時出錯:", error);
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "獲取商店列表時發生系統內部錯誤"
    });
  }
};

/**
 * 定義商店更新的驗證模式（部分更新模式）
 * 所有欄位都是可選的，但如果提供，則需符合特定驗證規則
 */
const updateStoreSchema = z.object({
  // 可更新欄位（所有欄位都設為可選）
  storeName: z.string().min(1, "商店名稱不能為空").max(50, "商店名稱不能超過50個字元").optional(),
  location: z.object({
    address: z.string().min(1, "地址不能為空"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).optional(),
  contactInfo: z.object({
    email: z.string().email("無效的電子郵件格式").optional().nullable(),
    phone: z.string().min(1, "聯絡電話不能為空"),
    managerId: z.string().optional().nullable()
  }).optional(),
  openHours: z.array(
    z.object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "開始時間格式應為 HH:MM"),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "結束時間格式應為 HH:MM")
    })
  ).optional(),
  gpsFence: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    radius: z.number().min(1, "打卡半徑必須大於0")
  }).optional(),
  status: z.enum(["active", "inactive", "temporary_closed", "permanently_closed"]).optional()
}).strict();

/**
 * 更新商店資料（部分更新模式）
 */
exports.updateStore = async (req, res) => {
  try {
    // 1. 從路徑參數獲取商店ID
    const storeId = req.params.storeId;
    
    if (!storeId) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "缺少商店ID參數"
      });
    }
    
    // 2. 獲取請求用戶信息（用於權限檢查）
    const requestingUser = req.user;
    const tenantId = requestingUser.tenantId;
    const userRole = requestingUser.role;
    
    if (!tenantId) {
      console.error(`嚴重問題：請求用戶 ${requestingUser.uid} 缺少 tenantId 聲明。`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：請求用戶上下文無效（缺少 tenantId）"
      });
    }
    
    // 3. 驗證請求數據
    const validationResult = updateStoreSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: `請求參數錯誤：${validationResult.error.errors[0].message}`
      });
    }
    
    // 驗證通過，獲取驗證後的數據
    const validatedData = validationResult.data;
    
    // 4. 從 Firestore 獲取商店數據（驗證存在性以及權限檢查）
    const storeRef = storesCollection.doc(storeId);
    const storeSnap = await storeRef.get();
    
    // 檢查商店是否存在
    if (!storeSnap.exists) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: `未找到ID為 ${storeId} 的商店資料`
      });
    }
    
    const storeData = storeSnap.data();
    
    // 5. 權限檢查
    // 確保請求用戶屬於該商店所屬的租戶
    if (storeData.tenantId !== tenantId) {
      console.warn(`未授權更新嘗試：用戶 ${requestingUser.uid}（角色：${userRole}）嘗試更新不屬於其租戶的商店 ${storeId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：您沒有權限更新此商店資料"
      });
    }
    
    // 如果請求者是 StoreManager，還需額外驗證該商店的 storeId 是否與 requestingUser.storeId 匹配
    if (userRole === "StoreManager" && requestingUser.storeId !== storeId) {
      console.warn(`未授權更新嘗試：店長 ${requestingUser.uid} 嘗試更新非其管理的商店 ${storeId}`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：店長只能更新自己管理的商店資料"
      });
    }
    
    // 6. 準備更新數據
    const updatePayload = { ...validatedData };
    
    // 7. 角色限制 - StoreManager 只能更新特定欄位
    if (userRole === "StoreManager") {
      // 定義 StoreManager 可更新的欄位
      const allowedFields = ["storeName", "location", "contactInfo", "openHours"];
      
      // 過濾掉不允許更新的欄位
      Object.keys(updatePayload).forEach(key => {
        if (!allowedFields.includes(key)) {
          console.warn(`店長 ${requestingUser.uid} 嘗試更新受限欄位 ${key}，已自動移除`);
          delete updatePayload[key];
        }
      });
      
      // 如果 contactInfo 存在，確保不更新 managerId
      if (updatePayload.contactInfo && "managerId" in updatePayload.contactInfo) {
        console.warn(`店長 ${requestingUser.uid} 嘗試更新 managerId，已自動移除`);
        delete updatePayload.contactInfo.managerId;
      }
    }
    
    // 8. 保護不可變欄位（適用於所有角色）
    const immutableFields = ["storeId", "tenantId", "createdAt"];
    immutableFields.forEach(field => {
      if (field in updatePayload) {
        delete updatePayload[field];
      }
    });
    
    // 9. 添加更新時間戳
    updatePayload.updatedAt = FieldValue.serverTimestamp();
    
    // 10. 更新商店數據
    await storeRef.update(updatePayload);
    
    // 11. 獲取更新後的商店資料
    const updatedStoreSnap = await storeRef.get();
    const updatedStoreData = updatedStoreSnap.data();
    
    // 12. 處理時間戳（將 Firestore Timestamp 轉換為 ISO 字符串）
    const responseData = { ...updatedStoreData };
    
    // 處理 createdAt 和 updatedAt 時間戳
    if (updatedStoreData.createdAt) {
      responseData.createdAt = updatedStoreData.createdAt.toDate().toISOString();
    }
    
    if (updatedStoreData.updatedAt) {
      responseData.updatedAt = updatedStoreData.updatedAt.toDate().toISOString();
    }
    
    // 13. 返回更新後的商店資料
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error("更新商店資料時出錯:", error);
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "更新商店資料時發生系統內部錯誤"
    });
  }
};

/**
 * 刪除商店資料（軟刪除，標記為永久關閉）
 */
exports.deleteStore = async (req, res) => {
  try {
    // 1. 從路徑參數獲取商店ID
    const storeId = req.params.storeId;
    
    if (!storeId) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: "缺少商店ID參數"
      });
    }
    
    // 2. 獲取請求用戶信息（用於權限檢查）
    const requestingUser = req.user;
    const tenantId = requestingUser.tenantId;
    
    if (!tenantId) {
      console.error(`嚴重問題：請求用戶 ${requestingUser.uid} 缺少 tenantId 聲明。`);
      return res.status(403).json({
        status: "error",
        errorCode: "E401",
        message: "未授權：請求用戶上下文無效（缺少 tenantId）"
      });
    }
    
    // 3. 使用 Transaction 確保狀態更新和租戶計數更新的原子性
    const result = await db.runTransaction(async (transaction) => {
      // 3.1 獲取商店數據
      const storeRef = storesCollection.doc(storeId);
      const storeDoc = await transaction.get(storeRef);
      
      // 檢查商店是否存在
      if (!storeDoc.exists) {
        throw new Error(`未找到ID為 ${storeId} 的商店資料`);
      }
      
      const storeData = storeDoc.data();
      
      // 3.2 確保請求者屬於該商店所屬的租戶（雖然中間件已驗證，但這是額外的安全檢查）
      if (storeData.tenantId !== tenantId) {
        throw new Error(`未授權：您沒有權限刪除此商店資料`);
      }
      
      // 3.3 檢查商店當前狀態
      if (storeData.status === "permanently_closed" || storeData.status === "inactive") {
        throw new Error(`商店 ${storeId} 已處於非活動狀態，無需重複操作`);
      }
      
      // 3.4 獲取租戶引用
      const tenantRef = tenantsCollection.doc(tenantId);
      const tenantDoc = await transaction.get(tenantRef);
      
      if (!tenantDoc.exists) {
        throw new Error(`找不到租戶資料 (ID: ${tenantId})`);
      }
      
      // 3.5 執行軟刪除 - 更新商店狀態
      transaction.update(storeRef, {
        status: "permanently_closed",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: requestingUser.uid
      });
      
      // 3.6 更新租戶的商店計數
      transaction.update(tenantRef, {
        storeCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      return {
        storeId: storeData.storeId,
        storeName: storeData.storeName
      };
    });
    
    // 4. 返回成功響應
    return res.status(200).json({
      status: "success",
      message: `商店 ${result.storeName} (ID: ${result.storeId}) 已標記為永久關閉`
    });
    
  } catch (error) {
    console.error("刪除商店時出錯:", error);
    
    // 根據錯誤類型返回適當的錯誤響應
    if (error.message?.includes("未找到ID為")) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: error.message
      });
    }
    
    if (error.message?.includes("未授權：您沒有權限")) {
      return res.status(403).json({
        status: "error",
        errorCode: "E403",
        message: error.message
      });
    }
    
    if (error.message?.includes("已處於非活動狀態")) {
      return res.status(400).json({
        status: "error",
        errorCode: "E400",
        message: error.message
      });
    }
    
    if (error.message?.includes("找不到租戶資料")) {
      return res.status(404).json({
        status: "error",
        errorCode: "E404",
        message: error.message
      });
    }
    
    // 返回標準錯誤格式
    return res.status(500).json({
      status: "error",
      errorCode: "E500",
      message: "刪除商店時發生系統內部錯誤"
    });
  }
}; 