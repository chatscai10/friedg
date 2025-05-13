const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const { z } = require("zod");

// Firestore database reference
const db = admin.firestore();

/** 
 * 驗證訂單項目 schema 
 */
const orderItemSchema = z.object({
  menuItemId: z.string().min(1, "菜單項目ID不能為空"),
  quantity: z.number().int().min(1, "數量必須為正數"),
  priceAtOrder: z.number().min(0, "下單時價格不能為負數"),
  specialInstructions: z.string().max(200, "特殊說明不能超過200個字符").optional(),
  options: z.array(z.object({
    optionId: z.string().min(1, "選項ID不能為空"),
    optionName: z.string().min(1, "選項名稱不能為空"),
    value: z.string().min(1, "選項值不為空"),
    additionalPrice: z.number().default(0),
  })).optional(),
}).strict();

/**
 * 驗證建立訂單請求 schema
 */
const createOrderSchema = z.object({
  storeId: z.string().min(1, "店鋪ID不能為空"),
  userId: z.string().optional(),
  customerName: z.string().max(50, "顧客姓名不能超過50個字符").optional(),
  customerPhone: z.string().max(20, "顧客電話不能超過20個字符").optional(),
  customerEmail: z.string().email("電子郵件格式不正確").optional(),
  orderType: z.enum(["dine-in", "takeout", "delivery"], {
    errorMap: () => ({ message: "訂單類型必須為指定選項" }),
  }).default("takeout"),
  tableNumber: z.string().max(10, "桌號不能超過10個字符").optional(),
  estimatedPickupTime: z.string().datetime("預計取餐時間格式不正確").optional(),
  specialInstructions: z.string().max(500, "特殊說明不能超過500個字符").optional(),
  items: z.array(orderItemSchema).min(1, "訂單必須包含至少一個項目"),
  discountCode: z.string().max(20, "折扣碼不超過20個字符").optional(),
  taxIncluded: z.boolean().default(true),
}).strict();

/**
 * 驗證更新訂單狀態請求 schema
 */
const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "preparing", "ready_for_pickup", "completed", "cancelled"], {
    errorMap: () => ({ message: "訂單狀態必須為指定選項" }),
  }),
  reason: z.string().max(200, "原因說明不能超過200個字符").optional(),
}).strict();

/**
 * 生成訂單編號
 * 格式：YYYYMMDD-StoreID-XXXX (XXXX為四位數隨機數)
 * @param {string} storeId 店鋪ID
 * @returns {string} 訂單編號
 */
function generateOrderNumber(storeId) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;
  
  // 生成4位隨機數
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  
  // 建立訂單編號
  return `${datePart}-${storeId}-${randomPart}`;
}

/** 
 * Handler to create a new order with transaction to check and update inventory
 * @param {import("express").Request} req Express request object
 * @param {import("express").Response} res Express response object
 * @returns {Promise<void>} 
 */
exports.createOrder = async (req, res) => {
  console.log("Handler: createOrder called");
  
  try {
    // 1. 檢查用戶信息
    const { uid, tenantId, role } = req.user;
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "沒有權限：用戶缺少租戶ID",
      });
    }
    
    // 2. 驗證輸入數據
    const validationResult = createOrderSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "驗證失敗",
        errors: validationResult.error.errors,
      });
    }
    
    const validatedData = validationResult.data;
    
    // 3. 驗證店鋪ID的有效性和租戶歸屬
    const storeRef = db.collection("stores").doc(validatedData.storeId);
    const storeDoc = await storeRef.get();
    
    if (!storeDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "找不到店鋪",
      });
    }
    
    const storeData = storeDoc.data();
    
    if (storeData.tenantId !== tenantId) {
      return res.status(403).json({
        success: false,
        message: "沒有權限：無法為其他租戶的店鋪創建訂單",
      });
    }
    
    // 如果是store_staff角色，檢查是否屬於該店鋪
    if (role === "store_staff" && req.user.storeId && req.user.storeId !== validatedData.storeId) {
      return res.status(403).json({
        success: false,
        message: "沒有權限：只能為自己所屬的店鋪建立訂單",
      });
    }
    
    // 設置訂單創建者ID
    const userId = uid;
    let customerId = null;
    let customerName = validatedData.customerName || "";
    let customerPhone = validatedData.customerPhone || "";
    let customerEmail = validatedData.customerEmail || "";
    
    if (role === "customer") {
      customerId = uid;
      
      // 如果客戶沒有提供聯繫信息，嘗試從用戶資料獲取
      if (!customerName || !customerPhone || !customerEmail) {
        try {
          const userDoc = await db.collection("users").doc(uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            customerName = customerName || userData.displayName || "";
            customerPhone = customerPhone || userData.phoneNumber || "";
            customerEmail = customerEmail || userData.email || "";
          }
        } catch (error) {
          console.warn("獲取用戶資料失敗:", error);
          // 繼續處理訂單，不中斷流程
        }
      }
    } else {
      // 非顧客角色，使用指定的userId或用戶自己的ID
      customerId = validatedData.userId || null;
    }
    
    // 4. 生成訂單ID和訂單編號
    const orderId = uuidv4();
    const orderNumber = generateOrderNumber(validatedData.storeId);
    
    // 5. 使用事務處理庫存和創建訂單
    const orderData = await db.runTransaction(async (transaction) => {
      // 5.1 檢查庫存並驗證價格
      for (const item of validatedData.items) {
        const menuItemRef = db.collection("menuItems").doc(item.menuItemId);
        const menuItemDoc = await transaction.get(menuItemRef);
        
        if (!menuItemDoc.exists) {
          throw new Error(`菜單項目 ${item.menuItemId} 不存在`);
        }
        
        const menuItem = menuItemDoc.data();
        
        // 租戶隔離檢查
        if (menuItem.tenantId !== tenantId) {
          throw new Error(`菜單項目 ${item.menuItemId} 不屬於當前租戶`);
        }
        
        // 檢查菜單項目是否激活
        if (!menuItem.isActive) {
          throw new Error(`菜單項目 ${menuItem.name} 已下架或未活動，無法售賣`);
        }
        
        // 檢查庫存
        if (menuItem.stockQuantity !== undefined && menuItem.stockQuantity < item.quantity) {
          throw new Error(`菜單項目 ${menuItem.name} 庫存不足，當前庫存 ${menuItem.stockQuantity}, 需求 ${item.quantity}`);
        }
        
        // 驗證價格
        const currentPrice = menuItem.discountPrice !== undefined && menuItem.discountPrice > 0 
          ? menuItem.discountPrice 
          : menuItem.price;
        
        // 允許±5% 的價格誤差，防止前端可能的價格不同步
        const priceErrorMargin = currentPrice * 0.05;
        if (Math.abs(item.priceAtOrder - currentPrice) > priceErrorMargin) {
          throw new Error(`菜單項目 ${menuItem.name} 價格已更新，請重新選擇`);
        }
      }
      
      // 5.2 更新庫存
      for (const item of validatedData.items) {
        const menuItemRef = db.collection("menuItems").doc(item.menuItemId);
        const menuItemDoc = await transaction.get(menuItemRef);
        const menuItem = menuItemDoc.data();
        
        // 如果有設置庫存數量，更新庫存
        if (menuItem.stockQuantity !== undefined) {
          const newStockQuantity = menuItem.stockQuantity - item.quantity;
          
          transaction.update(menuItemRef, {
            stockQuantity: newStockQuantity,
            // 更新庫存狀態
            stockStatus: newStockQuantity <= 0 ? "out_of_stock" : 
              (newStockQuantity < 5 ? "low_stock" : "in_stock"),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid,
          });
        }
      }
      
      // 5.3 準備訂單項目 - 獲取菜單項目詳細信息快照
      const orderItems = [];
      let subtotal = 0;
      
      for (const item of validatedData.items) {
        const menuItemRef = db.collection("menuItems").doc(item.menuItemId);
        const menuItemDoc = await transaction.get(menuItemRef);
        const menuItem = menuItemDoc.data();
        
        const totalItemPrice = item.priceAtOrder * item.quantity;
        subtotal += totalItemPrice;
        
        // 建立包含快照的訂單項目
        const orderItem = {
          menuItemId: item.menuItemId,
          menuItemName: menuItem.name,
          menuItemImage: menuItem.imageUrl || "",
          quantity: item.quantity,
          unitPrice: item.priceAtOrder,
          totalPrice: totalItemPrice,
          specialInstructions: item.specialInstructions || "",
          options: item.options || [],
        };
        
        orderItems.push(orderItem);
      }
      
      // 計算總價
      // 注意：這裡是實際計算，考慮稅費和折扣
      const taxAmount = 0; // 應該計算稅額
      const discountAmount = 0; // 應該計算折扣
      const totalAmount = subtotal - discountAmount + taxAmount;
      
      // 5.4 創建訂單數據
      const orderData = {
        id: orderId,
        orderNumber: orderNumber,
        tenantId: tenantId,
        storeId: validatedData.storeId,
        storeName: storeData.storeName || "",
        customerId: customerId,
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        status: "pending",
        orderType: validatedData.orderType,
        tableNumber: validatedData.tableNumber || "",
        estimatedPickupTime: validatedData.estimatedPickupTime || null,
        specialInstructions: validatedData.specialInstructions || "",
        items: orderItems,
        subtotal: subtotal,
        taxAmount: taxAmount,
        taxIncluded: validatedData.taxIncluded,
        discountAmount: discountAmount,
        discountCode: validatedData.discountCode || "",
        totalAmount: totalAmount,
        paymentStatus: "unpaid",
        paymentMethod: null,
        paymentTransactionId: null,
        assignedStaffId: role === "customer" ? null : uid,
        assignedStaffName: role === "customer" ? "" : (req.user.displayName || ""),
        isDeleted: false,
        userId: userId, // 標準化使用userId作為訂單創建者
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      // 5.5 寫入訂單到數據庫
      transaction.set(db.collection("orders").doc(orderId), orderData);
      
      return orderData;
    });
    
    // 6. 格式化時間戳並返回
    const formattedData = {
      ...orderData,
      createdAt: orderData.createdAt ? orderData.createdAt.toDate?.().toISOString() : new Date().toISOString(),
      updatedAt: orderData.updatedAt ? orderData.updatedAt.toDate?.().toISOString() : new Date().toISOString(),
    };
    
    // 7. 返回成功響應
    return res.status(201).json({
      success: true,
      message: "訂單創建成功",
      data: formattedData,
    });
  } catch (error) {
    console.error("創建訂單出錯", error);
    
    // 處理不同類型的業務錯誤，返回更好的錯誤訊息
    if (error.message) {
      // 庫存不足錯誤
      if (error.message.includes("庫存不足")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          errorCode: "INSUFFICIENT_STOCK",
        });
      }
      
      // 菜單項目激活相關錯誤
      if (error.message.includes("已下架")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          errorCode: "ITEM_NOT_AVAILABLE",
        });
      }
      
      // 價格不匹配錯誤
      if (error.message.includes("價格已更新")) {
        return res.status(409).json({
          success: false,
          message: error.message,
          errorCode: "PRICE_CHANGED",
        });
      }
      
      // 資源所有權限錯誤
      if (error.message.includes("不屬於當前租戶")) {
        return res.status(403).json({
          success: false,
          message: error.message,
          errorCode: "TENANT_MISMATCH",
        });
      }
      
      // 資源不存在錯誤
      if (error.message.includes("不存在")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          errorCode: "RESOURCE_NOT_FOUND",
        });
      }
    }
    
    // 通用服務器錯誤
    return res.status(500).json({
      success: false,
      message: "建立訂單時發生錯誤，請稍後再試",
      error: error.message,
      errorCode: "INTERNAL_SERVER_ERROR",
    });
  }
};

/** 
 * Handler to get an order by ID
 * @param {import("express").Request} req Express request object
 * @param {import("express").Response} res Express response object
 * @returns {Promise<void>} 
 */
exports.getOrderById = async (req, res) => {
  console.log("Handler: getOrderById called with ID:", req.params.orderId);
  
  try {
    // 1. 獲取請求參數和用戶信息
    const { orderId } = req.params;
    const { uid, tenantId, role, storeId } = req.user;
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "沒有權限：用戶缺少租戶ID",
      });
    }
    
    // 2. 從數據庫獲取訂單
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "找不到指定的訂單",
      });
    }
    
    // 3. 獲取訂單數據
    const orderData = orderDoc.data();
    
    // 4. 執行租戶隔離檢查
    if (orderData.tenantId !== tenantId) {
      console.log(`租戶權限錯誤: 請求租戶=${tenantId}, 訂單租戶=${orderData.tenantId}`);
      return res.status(403).json({
        success: false,
        message: "沒有權限：無法訪問其他租戶的訂單",
      });
    }
    
    // 5. 設定訪問權限邏輯
    let hasPermission = false;
    
    // 如果用戶是訂單的創建者，授予權限 
    if (uid === orderData.userId) {
      hasPermission = true;
      console.log(`用戶權限: 用戶${uid}是訂單${orderId}的創建者，授予訪問權限`);
    }
    
    // 管理員角色權限檢查 
    if (role === "tenant_admin") {
      hasPermission = true;
      console.log(`角色權限: 用戶${uid}具有tenant_admin角色，授予訪問權限`);
    } else if ((role === "store_manager" || role === "store_staff") && storeId === orderData.storeId) {
      hasPermission = true;
      console.log(`角色權限: 用戶${uid}具有${role}角色且屬於訂單所屬店鋪，授予訪問權限`);
    }
    
    // 檢查是否有權限訪問
    if (!hasPermission) {
      console.log(`權限錯誤: 用戶ID=${uid}, 角色=${role}, 訂單創建者=${orderData.userId}`);
      return res.status(403).json({
        success: false,
        message: "沒有權限：您無法訪問此訂單",
      });
    }
    
    // 7. 格式化時間戳
    const formattedData = {
      ...orderData,
      createdAt: orderData.createdAt ? orderData.createdAt.toDate?.().toISOString() : null,
      updatedAt: orderData.updatedAt ? orderData.updatedAt.toDate?.().toISOString() : null,
    };
    
    // 8. 返回訂單數據
    return res.status(200).json({
      success: true,
      message: "獲取訂單成功",
      data: formattedData,
    });
  } catch (error) {
    console.error("獲取訂單出錯:", error);
    return res.status(500).json({
      success: false,
      message: "伺服器內部錯誤",
      error: error.message,
    });
  }
};

/** 
 * Handler to list orders with filtering, sorting and pagination
 * @param {import("express").Request} req Express request object
 * @param {import("express").Response} res Express response object
 * @returns {Promise<void>} 
 */
exports.listOrders = async (req, res) => {
  console.log("Handler: listOrders called with query:", req.query);
  
  try {
    // 1. 檢查用戶信息
    const { tenantId, role, storeId } = req.user;
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "沒有權限：用戶缺少租戶ID",
      });
    }
    
    // 2. 解析查詢參數
    const {
      status, // 訂單狀態，逗號分隔(e.g., "pending,preparing")
      startDate, // 開始日期
      endDate, // 結束日期
      customerId, // 顧客ID
      storeIdParam, // 店鋪ID (適用於 tenant_admin 角色)
      limit = 10, // 每頁筆數，默認10
      lastVisible, // 游標(上次查詢後的最後一筆ID或創建時間)
    } = req.query;
    
    // 將limit轉為整數，並限制最大值為50
    const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
    
    // 3. 構建基本查詢
    let query = db.collection("orders").where("tenantId", "==", tenantId);
    
    // 根據 role 添加 storeId 篩選
    // - 如用戶為 store_manager 或store_staff，按照用戶所屬的店鋪進行篩選
    // - 如用戶為 tenant_admin 並提供了storeId 查詢參數，按照查詢參數篩選
    if (role === "store_manager" || role === "store_staff") {
      // 店長和店員只能查詢自己店鋪的訂單
      if (!storeId) {
        return res.status(403).json({
          success: false,
          message: "沒有權限：用戶缺少店鋪ID",
        });
      }
      
      query = query.where("storeId", "==", storeId);
    } else if (role === "tenant_admin" && storeIdParam) {
      // 如果是租戶管理員，並提供了特定店鋪ID，按該店鋪篩選
      query = query.where("storeId", "==", storeIdParam);
    }
    
    // 4. 添加可選的篩選條件
    
    // 訂單狀態篩選(支持多選)
    if (status) {
      const statusList = status.split(",").map((s) => s.trim());
      
      // 單一狀態可直接查詢，Firestore不支持直接"in" 查詢，需要連續在結果中篩選
      if (statusList.length === 1) {
        query = query.where("status", "==", statusList[0]);
      }
      // 對於多個狀態值，我們需要在查詢後進行客戶篩選，或者在這裡添加條件
      // 注意：在實際應用中可能需要使用複合查詢或建立多個狀態的索引
    }
    
    // 按顧客ID篩選
    if (customerId) {
      query = query.where("customerId", "==", customerId);
    }
    
    // 按時間範圍篩選
    if (startDate) {
      const startTimestamp = new Date(startDate);
      
      if (!isNaN(startTimestamp.getTime())) {
        query = query.where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startTimestamp));
      }
    }
    
    if (endDate) {
      const endTimestamp = new Date(endDate);
      
      if (!isNaN(endTimestamp.getTime())) {
        // 設置結束時間為當天的23:59:59
        endTimestamp.setHours(23, 59, 59, 999);
        query = query.where("createdAt", "<=", admin.firestore.Timestamp.fromDate(endTimestamp));
      }
    }
    
    // 5. 排序設置
    query = query.orderBy("createdAt", "desc");
    
    // 6. 分頁設置 - 基於游標
    if (lastVisible) {
      try {
        // 嘗試將lastVisible視為訂單ID
        const lastOrderRef = db.collection("orders").doc(lastVisible);
        const lastOrderDoc = await lastOrderRef.get();
        
        if (lastOrderDoc.exists) {
          // 如果文檔存在，使用它作為起始游標
          query = query.startAfter(lastOrderDoc);
        } else {
          // 如果不是文檔引用的ID，嘗試將它作為ISO格式日期
          const lastVisibleDate = new Date(lastVisible);
          
          if (!isNaN(lastVisibleDate.getTime())) {
            const lastTimestamp = admin.firestore.Timestamp.fromDate(lastVisibleDate);
            query = query.startAfter(lastTimestamp);
          }
        }
      } catch (error) {
        console.warn("解析分頁游標出錯:", error);
        // 忽略錯誤，繼續查詢
      }
    }
    
    // 7. 設置查詢筆數限制
    query = query.limit(parsedLimit);
    
    // 8. 執行查詢
    const snapshot = await query.get();
    
    // 9. 處理查詢結果
    const orders = [];
    let lastVisibleDoc = null;
    
    // 遍歷查詢結果
    snapshot.forEach((doc) => {
      const orderData = doc.data();
      
      // 對於多選狀態過濾，如果指定了多個狀態值
      if (status && status.includes(",")) {
        const statusList = status.split(",").map((s) => s.trim());
        if (!statusList.includes(orderData.status)) {
          return; // 跳過不符合條件的訂單
        }
      }
      
      // 格式化時間戳
      const formattedOrder = {
        ...orderData,
        createdAt: orderData.createdAt ? orderData.createdAt.toDate?.().toISOString() : null,
        updatedAt: orderData.updatedAt ? orderData.updatedAt.toDate?.().toISOString() : null,
      };
      
      orders.push(formattedOrder);
      lastVisibleDoc = doc;
    });
    
    // 10. 構建分頁信息
    const pagination = {
      limit: parsedLimit,
      hasMore: orders.length === parsedLimit,
      total: null, // Firestore 不直接支持計數，需要單獨查詢
    };
    
    // 添加下一頁游標信息
    if (lastVisibleDoc && pagination.hasMore) {
      const lastOrder = lastVisibleDoc.data();
      pagination.lastVisible = lastOrder.id; // 使用訂單ID作為游標
      
      // 也可以用創建時間作為備選游標
      pagination.lastCreatedAt = lastOrder.createdAt 
        ? lastOrder.createdAt.toDate?.().toISOString() 
        : null;
    }
    
    // 11. 返回訂單列表與分頁信息
    return res.status(200).json({
      success: true,
      orders: orders,
      pagination: pagination,
    });
  } catch (error) {
    console.error("獲取訂單列表出錯", error);
    return res.status(500).json({
      success: false,
      message: "伺服器內部錯誤",
      error: error.message,
    });
  }
};

/**
 * Handler to update the status of an existing order
 * @param {import("express").Request} req Express request object
 * @param {import("express").Response} res Express response object
 * @returns {Promise<void>}
 */
exports.updateOrderStatus = async (req, res) => {
  console.log("Handler: updateOrderStatus called");
  
  try {
    // 1. 檢查用戶信息
    const { uid, tenantId, role, storeId } = req.user;
    
    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "沒有權限：用戶缺少租戶ID",
      });
    }
    
    // 2. 獲取訂單ID並驗證
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "缺少訂單ID參數",
      });
    }
    
    // 3. 驗證請求體數據
    const validationResult = updateOrderStatusSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "驗證失敗",
        errors: validationResult.error.errors,
      });
    }
    
    const { status, reason } = validationResult.data;
    
    // 4. 獲取訂單數據
    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "找不到訂單",
      });
    }
    
    const orderData = orderDoc.data();
    
    // 5. 執行租戶隔離檢查
    if (orderData.tenantId !== tenantId) {
      console.log(`租戶權限錯誤: 請求租戶=${tenantId}, 訂單租戶=${orderData.tenantId}`);
      return res.status(403).json({
        success: false,
        message: "沒有權限：無法訪問其他租戶的訂單",
      });
    }
    
    // 6. 設定訪問權限邏輯
    let hasPermission = false;
    
    // 管理員角色權限檢查
    if (role === "tenant_admin") {
      hasPermission = true;
      console.log(`角色權限: 用戶${uid}具有tenant_admin角色，授予訪問權限`);
    } else if ((role === "store_manager" || role === "store_staff") && storeId === orderData.storeId) {
      hasPermission = true;
      console.log(`角色權限: 用戶${uid}具有${role}角色且屬於訂單所屬店鋪，授予訪問權限`);
    }
    
    // 檢查是否有權限訪問
    if (!hasPermission) {
      console.log(`權限錯誤: 用戶ID=${uid}, 角色=${role}, 訂單店鋪=${orderData.storeId}`);
      return res.status(403).json({
        success: false,
        message: "沒有權限：您無法更新此訂單狀態",
      });
    }
    
    // 7. 更新訂單狀態
    const updateData = {
      status: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // 如果提供了更新原因，也將其記錄
    if (reason) {
      updateData.statusChangeReason = reason;
    }
    
    // 添加狀態變更記錄
    // 如果尚未有狀態歷史記錄，則創建一個空數組
    if (!orderData.statusHistory) {
      updateData.statusHistory = [];
    } else {
      updateData.statusHistory = [...orderData.statusHistory];
    }
    
    // 將當前狀態添加到歷史記錄中
    updateData.statusHistory.push({
      status: status,
      changedAt: new Date(),
      changedBy: uid,
      reason: reason || null,
    });
    
    // 執行更新
    await orderRef.update(updateData);
    
    // 8. 返回成功響應
    return res.status(200).json({
      success: true,
      message: "訂單狀態更新成功",
      data: {
        orderId: orderId,
        status: status,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("更新訂單狀態出錯:", error);
    return res.status(500).json({
      success: false,
      message: "伺服器內部錯誤",
      error: error.message,
    });
  }
}; 