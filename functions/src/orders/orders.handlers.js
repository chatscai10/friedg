/** 
 * Handler to get a list of orders, filtered by userId OR storeId, with pagination. 
 * Permissions: 
 * - If userId is provided: Requester must be the user OR TenantAdmin/StoreManager with permission. 
 * - If storeId is provided: Requester must be TenantAdmin/StoreManager with permission. 
 * @param {import("express").Request} req Express request object. 
 * @param {import("express").Response} res Express response object. 
 * @returns {Promise<void>} A promise that resolves when the response is sent. 
 */
const admin = require("firebase-admin");
const db = admin.firestore();
const { Timestamp, FieldValue } = require("firebase-admin/firestore");

exports.getOrders = async (req, res) => {
  const { userId, storeId, page = 1, limit = 10 } = req.query;
  const requestingUser = req.user;
  
  // 1. Validation & Permission Pre-checks
  if (!requestingUser) {
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }
  
  if (!userId && !storeId) {
    return res.status(400).send({ message: "Missing required query parameter: Must provide either userId or storeId." });
  }
  
  if (userId && storeId) {
    return res.status(400).send({ message: "Invalid query parameters: Provide either userId or storeId, not both." });
  }
  
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).send({ message: "Invalid page number." });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) { // Limit max page size
    return res.status(400).send({ message: "Invalid limit value (must be 1-100)." });
  }
  
  // 2. Build Base Query & Check Permissions
  const ordersRef = db.collection("orders");
  let baseQuery = ordersRef;
  let canQuery = false;
  
  try {
    if (userId) {
      // User is querying their own orders
      if (requestingUser.uid === userId) {
        canQuery = true;
        baseQuery = baseQuery.where("userId", "==", userId);
      } else {
        // Admin querying a specific user's orders - Requires fetching user/order tenant/store info
        // For simplicity now, let's assume admins query by storeId instead of userId.
        // More complex permission checks for admins viewing specific user orders can be added later.
        console.warn(`Admin query by userId (${userId}) requested by ${requestingUser.uid}. Allowing if admin, but storeId preferred.`);
        
        if (requestingUser.role === "TenantAdmin" || requestingUser.role === "StoreManager") {
          // Need to ensure the target userId belongs to the admin's scope (tenant/store).
          // This requires fetching the member data or assuming orders contain tenantId/storeId.
          // Assuming orders have tenantId for TenantAdmin check:
          if (requestingUser.role === "TenantAdmin") {
            // To check rigorously, we'd query the order/user first, but let's filter post-query or just filter by tenant for now
            baseQuery = baseQuery.where("userId", "==", userId).where("tenantId", "==", requestingUser.tenantId);
            canQuery = true; // TenantAdmin can query any user in their tenant
          } else { // StoreManager
            // StoreManager querying specific user - check if user is in their store
            baseQuery = baseQuery.where("userId", "==", userId).where("storeId", "==", requestingUser.storeId);
            canQuery = true; // StoreManager can query any user in their store
          }
        }
      }
    } else if (storeId) {
      // Admin querying by storeId
      if (requestingUser.role === "TenantAdmin") {
        // TenantAdmin needs to verify the store belongs to their tenant
        const storeRef = db.collection("stores").doc(storeId);
        const storeSnap = await storeRef.get();
        
        if (storeSnap.exists && storeSnap.data().tenantId === requestingUser.tenantId) {
          canQuery = true;
          baseQuery = baseQuery.where("storeId", "==", storeId).where("tenantId", "==", requestingUser.tenantId);
        } else {
          console.warn(`TenantAdmin ${requestingUser.uid} requested invalid store ${storeId}`);
          return res.status(403).send({ message: `Forbidden: Store ${storeId} not accessible.` });
        }
      } else if (requestingUser.role === "StoreManager") {
        // StoreManager can only query their own store
        if (requestingUser.storeId === storeId) {
          canQuery = true;
          baseQuery = baseQuery.where("storeId", "==", storeId);
        } else {
          console.warn(`StoreManager ${requestingUser.uid} requested invalid store ${storeId}`);
          return res.status(403).send({ message: `Forbidden: Cannot access orders for store ${storeId}.` });
        }
      } else if (requestingUser.role === "admin") {
        // Assuming 'admin' role can query any store provided in the query param
        // WARNING: Consider if 'admin' should have limitations, e.g., based on their own storeId or tenantId if applicable.
        // For now, allow querying the specified storeId directly.
        console.log(`Admin user ${requestingUser.uid} querying store ${storeId}`);
        canQuery = true;
        baseQuery = baseQuery.where("storeId", "==", storeId);
      }
    }
    
    if (!canQuery) {
      // This case should ideally be caught earlier, but acts as a safeguard
      console.error(`Query Permission Denied: User ${requestingUser.uid}, Query: ${JSON.stringify(req.query)}`);
      return res.status(403).send({ message: "Forbidden: You do not have permission to perform this query." });
    }
    
    // 3. Execute Query with Pagination
    // Get total count for pagination metadata
    const countSnapshot = await baseQuery.count().get();
    const totalOrders = countSnapshot.data().count;
    const totalPages = Math.ceil(totalOrders / limitNum);
    
    if (totalOrders === 0) {
      return res.status(200).send({
        orders: [],
        pagination: { totalOrders: 0, currentPage: 1, totalPages: 0, limit: limitNum }
      });
    }
    
    if (pageNum > totalPages && totalOrders > 0) {
      return res.status(400).send({ message: `Invalid page number. Maximum page is ${totalPages}` });
    }
    
    // Calculate offset for basic pagination
    const offset = (pageNum - 1) * limitNum;
    
    // Query for the actual data page
    const dataQuery = baseQuery
      .orderBy("createdAt", "desc")
      .limit(limitNum)
      .offset(offset);
      
    const dataSnapshot = await dataQuery.get();
    const orders = dataSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    // 4. Return Response
    res.status(200).send({
      orders: orders,
      pagination: {
        totalOrders: totalOrders,
        currentPage: pageNum,
        totalPages: totalPages,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error(`Error listing orders with query ${JSON.stringify(req.query)}:`, error);
    res.status(500).send({ message: "Failed to list orders.", error: error.message });
  }
};

/** 
 * Handler to create a new order. 
 * Validates items, options, calculates totals based on backend prices. 
 * @param {import("express").Request} req Express request object. 
 * @param {import("express").Response} res Express response object. 
 * @returns {Promise<void>} A promise that resolves when the response is sent. 
 */
exports.createOrder = async (req, res) => {
  const { storeId, items, deliveryInfo, paymentMethod, notes } = req.body;
  const requestingUser = req.user;
  
  // 1. Basic Validation & Authorization
  if (!requestingUser) {
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }
  
  // Assuming only authenticated users (members) can create orders for themselves
  const userId = requestingUser.uid;
  const tenantId = requestingUser.tenantId; // Assuming tenantId is in user token
  
  if (!storeId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).send({ message: "Missing or invalid required fields: storeId and items array are required." });
  }
  
  // Fetch store details (optional, could combine with item validation if items have storeId)
  const storeRef = db.collection("stores").doc(storeId);
  const storeSnap = await storeRef.get();
  
  if (!storeSnap.exists) {
    return res.status(400).send({ message: `Invalid storeId: ${storeId} not found.` });
  }
  
  // Optional: Check if store belongs to user's tenant if applicable
  // if (storeSnap.data().tenantId !== tenantId) {
  //    return res.status(403).send({ message: `Forbidden: Store ${storeId} not accessible.` });
  // }
  
  const validatedItems = [];
  let subtotal = 0;
  
  try {
    // 2. Item & Option Validation and Price Calculation
    for (const item of items) {
      if (!item.menuItemId || !item.quantity || item.quantity <= 0) {
        return res.status(400).send({ 
          message: `Invalid item data: Each item requires menuItemId and positive quantity. Problem: ${JSON.stringify(item)}` 
        });
      }
      
      const menuItemRef = db.collection("menuItems").doc(item.menuItemId);
      const menuItemSnap = await menuItemRef.get();
      
      if (!menuItemSnap.exists || !menuItemSnap.data().isActive || menuItemSnap.data().storeId !== storeId) {
        return res.status(400).send({ 
          message: `Invalid or unavailable menu item: ${item.menuItemId} for store ${storeId}.` 
        });
      }
      
      const menuItemData = menuItemSnap.data();
      const baseItemPrice = menuItemData.price; // Price from backend
      
      let itemOptionsTotalAdjustment = 0;
      const validatedOptions = [];
      
      // Validate options if provided
      if (item.options && Array.isArray(item.options)) {
        for (const option of item.options) {
          if (!option.menuOptionId) {
            return res.status(400).send({ 
              message: `Invalid option data for item ${item.menuItemId}: menuOptionId is required.` 
            });
          }
          
          const menuOptionRef = db.collection("menuOptions").doc(option.menuOptionId);
          const menuOptionSnap = await menuOptionRef.get();
          
          if (!menuOptionSnap.exists || !menuOptionSnap.data().isActive || menuOptionSnap.data().menuItemId !== item.menuItemId) {
            return res.status(400).send({ 
              message: `Invalid or unavailable menu option: ${option.menuOptionId} for item ${item.menuItemId}.` 
            });
          }
          
          const menuOptionData = menuOptionSnap.data();
          itemOptionsTotalAdjustment += menuOptionData.priceAdjustment; // Adjustment from backend
          
          validatedOptions.push({
            menuOptionId: option.menuOptionId,
            name: menuOptionData.name, // Store name for clarity
            priceAdjustment: menuOptionData.priceAdjustment,
          });
        }
      }
      
      const finalItemPrice = baseItemPrice + itemOptionsTotalAdjustment;
      const itemTotal = finalItemPrice > 0 ? finalItemPrice * item.quantity : 0;
      
      subtotal += itemTotal;
      
      validatedItems.push({
        menuItemId: item.menuItemId,
        name: menuItemData.name, // Store name for clarity
        quantity: item.quantity,
        unitPrice: finalItemPrice > 0 ? finalItemPrice : 0, // Calculated unit price after options, clamped to 0 if negative
        options: validatedOptions,
        itemTotal: itemTotal,
      });
    }
    
    // 3. Calculate Final Total (Simplified: subtotal = totalAmount)
    // TODO: Add logic for taxes, delivery fees, discounts later
    const totalAmount = subtotal;
    
    // 4. Create Order Document
    const now = Timestamp.now();
    const newOrderData = {
      userId: userId,
      storeId: storeId,
      tenantId: tenantId,
      items: validatedItems, // Use validated items with backend prices
      subtotal: subtotal,
      totalAmount: totalAmount,
      status: "pending", // Initial status
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deliveryInfo: deliveryInfo || null,
      paymentMethod: paymentMethod || null,
      notes: notes || null,
      // Add other relevant fields like order number if needed
    };
    
    const orderRef = await db.collection("orders").add(newOrderData);
    
    // 5. Return Success Response
    res.status(201).send({
      message: "Order created successfully.",
      orderId: orderRef.id,
      order: { id: orderRef.id, ...newOrderData }, // Return the created order data
    });
  } catch (error) {
    console.error(`Error creating order for user ${userId} at store ${storeId}:`, error);
    
    // Distinguish validation errors from server errors if possible
    if (error.message && error.message.startsWith("Invalid")) { // Basic check
      res.status(400).send({ message: "Order creation failed due to invalid input.", error: error.message });
    } else {
      res.status(500).send({ message: "Failed to create order due to an internal error.", error: error.message });
    }
  }
};

// Define valid order statuses
const VALID_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "delivering",
  "completed",
  "cancelled",
];

/** 
 * Handler to update the status of an existing order. 
 * Permissions: TenantAdmin, StoreManager (managing the order's store). 
 * @param {import("express").Request} req Express request object. 
 * @param {import("express").Response} res Express response object. 
 * @returns {Promise<void>} A promise that resolves when the response is sent. 
 */
exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const requestingUser = req.user;
  
  // 1. Basic Validation & Authorization Pre-check
  if (!requestingUser) {
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }
  
  if (!status || !VALID_ORDER_STATUSES.includes(status)) {
    return res.status(400).send({ 
      message: `Invalid status provided. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}.` 
    });
  }
  
  // Check admin roles
  if (requestingUser.role !== "TenantAdmin" && requestingUser.role !== "StoreManager") {
    return res.status(403).send({ 
      message: "Forbidden: Only admins or store managers can update order status." 
    });
  }
  
  const orderRef = db.collection("orders").doc(orderId);
  
  try {
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      return res.status(404).send({ message: `Order with ID ${orderId} not found.` });
    }
    
    const orderData = orderSnap.data();
    
    // 2. Authorization Check (Tenant/Store Scope)
    let canUpdate = false;
    
    if (requestingUser.role === "TenantAdmin") {
      // TenantAdmin can update if the order belongs to their tenant
      if (orderData.tenantId === requestingUser.tenantId) {
        canUpdate = true;
      } else {
        console.warn(`TenantAdmin ${requestingUser.uid} attempted to update order ${orderId} outside their tenant (${orderData.tenantId}).`);
      }
    } else if (requestingUser.role === "StoreManager") {
      // StoreManager can update if the order belongs to their store
      if (orderData.storeId === requestingUser.storeId) {
        canUpdate = true;
      } else {
        console.warn(`StoreManager ${requestingUser.uid} attempted to update order ${orderId} outside their store (${orderData.storeId}).`);
      }
    }
    
    // ADD DETAILED LOGGING FOR PERMISSION CHECK
    console.log(`CHECKING PERMISSION: Order Store ID = "${orderData.storeId}" (Type: ${typeof orderData.storeId}), User Store ID = "${requestingUser.storeId}" (Type: ${typeof requestingUser.storeId})`);
    
    if (!canUpdate) {
      console.log(`Permission denied for user ${requestingUser.uid} to update status for order ${orderId}. Required Store: ${orderData.storeId}, User Store: ${requestingUser.storeId}`);
      return res.status(403).send({ 
        message: `Forbidden: You do not have permission to update the status for order ${orderId}.` 
      });
    }
    
    // 3. Update Order Status
    const updateData = {
      status: status,
      updatedAt: FieldValue.serverTimestamp(),
    };
    
    await orderRef.update(updateData);
    
    // 4. Return Success Response
    const updatedOrderSnap = await orderRef.get(); // Fetch updated data to return
    res.status(200).send({
      message: "Order status updated successfully.",
      order: { id: updatedOrderSnap.id, ...updatedOrderSnap.data() },
    });
  } catch (error) {
    console.error(`Error updating status for order ${orderId} to ${status}:`, error);
    res.status(500).send({ 
      message: "Failed to update order status due to an internal error.", 
      error: error.message 
    });
  }
};

/** 
 * Handler to get a specific order by its ID. 
 * Permissions: 
 * - Requester must be the user who placed the order OR TenantAdmin/StoreManager with permission. 
 * @param {import("express").Request} req Express request object. 
 * @param {import("express").Response} res Express response object. 
 * @returns {Promise<void>} A promise that resolves when the response is sent. 
 */
exports.getOrderById = async (req, res) => {
  const { orderId } = req.params;
  const requestingUser = req.user;
  
  // 1. Validation
  if (!requestingUser) {
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }
  
  if (!orderId) {
    return res.status(400).send({ message: "Missing required parameter: orderId." });
  }
  
  const orderRef = db.collection("orders").doc(orderId);
  
  try {
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      return res.status(404).send({ message: `Order not found: ${orderId}` });
    }
    
    const orderData = orderSnap.data();
    
    // 2. Permission Check
    let canView = false;
    
    // User viewing their own order
    if (requestingUser.uid === orderData.userId) {
      canView = true;
    }
    // Admin/Manager viewing order within their scope
    else if (requestingUser.role === "TenantAdmin" && requestingUser.tenantId === orderData.tenantId) {
      canView = true;
    }
    else if (requestingUser.role === "StoreManager" && requestingUser.storeId === orderData.storeId) {
      canView = true;
    }
    
    if (!canView) {
      console.warn(`Permission Denied: User ${requestingUser.uid} tried to access order ${orderId}`);
      return res.status(403).send({ 
        message: "Forbidden: You do not have permission to view this order." 
      });
    }
    
    // 3. Return Order Data
    res.status(200).send({ id: orderSnap.id, ...orderData });
  } catch (error) {
    console.error(`Error fetching order ${orderId}:`, error);
    res.status(500).send({ 
      message: "Failed to fetch order details.", 
      error: error.message 
    });
  }
};

/** 
 * Handler to update non-core fields (deliveryInfo, notes) of an existing order. 
 * Restrictions: Only allowed if order status is 'pending' and requester is the creator. 
 * @param {import("express").Request} req Express request object. 
 * @param {import("express").Response} res Express response object. 
 * @returns {Promise<void>} A promise that resolves when the response is sent. 
 */
exports.updateOrder = async (req, res) => {
  const { orderId } = req.params;
  const { deliveryInfo, notes } = req.body; // Only these fields are considered
  const requestingUser = req.user;
  
  // 1. Basic Pre-checks
  if (!requestingUser) {
    // Should be caught by checkAuth, but defensive check
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }
  
  if (!orderId) {
    return res.status(400).send({ message: "Missing orderId parameter." });
  }
  
  // Check if at least one valid field to update is provided
  if (deliveryInfo === undefined && notes === undefined) {
    return res.status(400).send({ 
      message: "No valid fields provided for update. Only 'deliveryInfo' and 'notes' can be updated." 
    });
  }
  
  const orderRef = db.collection("orders").doc(orderId);
  
  try {
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      return res.status(404).send({ message: `Order with ID ${orderId} not found.` });
    }
    
    const orderData = orderSnap.data();
    
    // 2. Precondition Checks (Status and Ownership)
    if (orderData.status !== "pending") {
      return res.status(403).send({ 
        message: `Forbidden: Order can only be updated when status is 'pending'. Current status: ${orderData.status}` 
      });
    }
    
    if (orderData.userId !== requestingUser.uid) {
      console.warn(`User ${requestingUser.uid} attempted to update order ${orderId} owned by ${orderData.userId}.`);
      return res.status(403).send({ message: "Forbidden: You do not have permission to update this order." });
    }
    
    // 3. Prepare and Execute Update
    const updateData = {};
    
    if (deliveryInfo !== undefined) {
      updateData.deliveryInfo = deliveryInfo; // Allow setting to null/empty object
    }
    
    if (notes !== undefined) {
      updateData.notes = notes; // Allow setting to null/empty string
    }
    
    // Only proceed if there's something to update besides timestamp
    if (Object.keys(updateData).length === 0) {
      return res.status(400).send({ 
        message: "No valid fields provided for update. Only 'deliveryInfo' and 'notes' can be updated." 
      });
      // Or return 304 Not Modified? Let's stick to 400 for now.
    }
    
    updateData.updatedAt = FieldValue.serverTimestamp(); // Use FieldValue
    await orderRef.update(updateData);
    
    // 4. Return Success Response
    const updatedOrderSnap = await orderRef.get(); // Fetch updated data
    res.status(200).send({ id: updatedOrderSnap.id, ...updatedOrderSnap.data() });
  } catch (error) {
    console.error(`Error updating order ${orderId}:`, error);
    res.status(500).send({ 
      message: "Failed to update order due to an internal error.", 
      error: error.message 
    });
  }
};

/** 
 * Handler to record a payment against an order. 
 * Permissions: TenantAdmin, StoreManager (managing the order's store). 
 * TODO: Implement payment gateway integration or manual recording logic. 
 * @param {import("express").Request} req Express request object. 
 * @param {import("express").Response} res Express response object. 
 * @returns {Promise<void>} A promise that resolves when the response is sent. 
 */
exports.recordPayment = async (req, res) => {
  const { orderId } = req.params;
  const { paymentMethod, amount, transactionId, paymentStatus = 'completed' } = req.body;
  const requestingUser = req.user;
  
  // 1. Basic Validation & Authorization Pre-check
  if (!requestingUser) {
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }
  
  if (!orderId || !paymentMethod || amount === undefined || amount <= 0) {
    return res.status(400).send({ 
      message: "Missing required fields: orderId, paymentMethod, and positive amount are required." 
    });
  }
  
  // Add more validation for paymentStatus if needed
  // Check admin roles
  if (requestingUser.role !== "TenantAdmin" && requestingUser.role !== "StoreManager") {
    return res.status(403).send({ message: "Forbidden: Only admins or store managers can record payments." });
  }
  
  const orderRef = db.collection("orders").doc(orderId);
  
  try {
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      return res.status(404).send({ message: `Order with ID ${orderId} not found.` });
    }
    
    const orderData = orderSnap.data();
    
    // 2. Authorization Check (Tenant/Store Scope)
    let canRecord = false;
    
    if (requestingUser.role === "TenantAdmin" && orderData.tenantId === requestingUser.tenantId) {
      canRecord = true;
    } else if (requestingUser.role === "StoreManager" && orderData.storeId === requestingUser.storeId) {
      canRecord = true;
    }
    
    if (!canRecord) {
      console.warn(`User ${requestingUser.uid} attempt to record payment for order ${orderId} denied.`);
      return res.status(403).send({ 
        message: "Forbidden: You do not have permission to record payments for this order." 
      });
    }
    
    // Optional: Check if order is already paid or in a state allowing payment recording
    // if (orderData.paymentDetails && orderData.paymentDetails.status === 'completed') {
    //   return res.status(409).send({ message: "Conflict: Order payment has already been recorded as completed." });
    // }
    
    // Add checks for order status (e.g., cannot record payment for 'cancelled' order)
    
    // 3. Prepare Payment Data
    const paymentDetails = {
      method: paymentMethod,
      amount: amount,
      status: paymentStatus, // e.g., 'pending', 'completed', 'failed'
      transactionId: transactionId || null,
      recordedAt: FieldValue.serverTimestamp(),
      recordedBy: requestingUser.uid,
    };
    
    // 4. Update Order with Payment Details
    // We might store payment details in a subcollection or directly on the order doc.
    // Storing directly for simplicity here.
    await orderRef.update({
      paymentDetails: paymentDetails, // Overwrites previous payment details if any
      updatedAt: FieldValue.serverTimestamp(),
      // Optionally update order status based on payment status, e.g., if payment 'completed'
      // status: paymentStatus === 'completed' ? 'confirmed' : orderData.status,
    });
    
    // 5. Return Success Response
    const updatedOrderSnap = await orderRef.get();
    res.status(200).send({
      message: "Payment recorded successfully.",
      order: { id: updatedOrderSnap.id, ...updatedOrderSnap.data() },
    });
  } catch (error) {
    console.error(`Error recording payment for order ${orderId}:`, error);
    res.status(500).send({ 
      message: "Failed to record payment due to an internal error.", 
      error: error.message 
    });
  }
};

/** 
 * Handler to get order statistics. 
 * Permissions: TenantAdmin, StoreManager (managing the order's store). 
 * TODO: Implement actual statistics calculation logic (grouping, aggregation). 
 * @param {import("express").Request} req Express request object. 
 * @param {import("express").Response} res Express response object. 
 * @returns {Promise<void>} A promise that resolves when the response is sent. 
 */
exports.getOrderStatistics = async (req, res) => {
  const { storeId, from, to, groupBy = 'day' } = req.query;
  const requestingUser = req.user;
  
  // 1. Basic Validation & Authorization Pre-check
  if (!requestingUser) {
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }
  
  // Check admin roles
  if (requestingUser.role !== "TenantAdmin" && requestingUser.role !== "StoreManager") {
    return res.status(403).send({ message: "Forbidden: Only admins or store managers can view statistics." });
  }
  
  // Basic validation for query params (add more robust date/group validation later)
  if (!storeId && requestingUser.role === 'TenantAdmin') {
    // TenantAdmin might query across all stores in tenant, or must specify storeId
    // For now, let's require storeId or implement tenant-wide logic later
    // return res.status(400).send({ message: "TenantAdmin must specify a storeId or use a tenant-wide endpoint." });
  }
  
  const targetStoreId = requestingUser.role === 'StoreManager' ? requestingUser.storeId : storeId;
  
  if (!targetStoreId) {
    return res.status(400).send({ message: "Missing storeId parameter." });
  }
  
  // 2. Authorization Check (Tenant/Store Scope)
  if (requestingUser.role === "StoreManager" && requestingUser.storeId !== targetStoreId) {
    return res.status(403).send({ 
      message: "Forbidden: StoreManager can only view statistics for their assigned store." 
    });
  }
  
  // TODO: Add check for TenantAdmin to ensure targetStoreId is within their tenant.
  console.log(`Fetching stats for store ${targetStoreId}, Params: ${JSON.stringify(req.query)}`);
  
  // 3. --- Placeholder Logic ---
  // TODO: Replace with actual Firestore query and aggregation based on from, to, groupBy
  try {
    // Example: Count orders in the store within the time range
    let query = db.collection('orders').where('storeId', '==', targetStoreId);
    
    // Add time range filtering based on 'from' and 'to' using Firestore Timestamps
    // Add aggregation/grouping logic based on 'groupBy'
    
    // --- Dummy Data ---
    const dummyStats = {
      totalOrders: Math.floor(Math.random() * 100),
      totalRevenue: Math.floor(Math.random() * 50000),
      averageOrderValue: Math.random() * 500,
      groupBy: groupBy,
      period: { from, to },
      storeId: targetStoreId
    };
    // --- End Dummy Data ---
    
    // 4. Return Statistics
    res.status(200).send(dummyStats);
  } catch (error) {
    console.error(`Error fetching statistics for store ${targetStoreId}:`, error);
    res.status(500).send({ 
      message: "Failed to fetch order statistics due to an internal error.", 
      error: error.message 
    });
  }
};

/** 
 * Handler to generate an order receipt. 
 * Permissions: TenantAdmin, StoreManager (managing the order's store) or the order owner. 
 * @param {import("express").Request} req Express request object. 
 * @param {import("express").Response} res Express response object. 
 * @returns {Promise<void>} A promise that resolves when the response is sent. 
 */
exports.generateOrderReceipt = async (req, res) => {
  const { orderId } = req.params;
  const requestingUser = req.user;
  
  // 1. Basic Validation & Authorization Pre-check
  if (!requestingUser) {
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }
  
  if (!orderId) {
    return res.status(400).send({ message: "Missing required parameter: orderId." });
  }
  
  const orderRef = db.collection("orders").doc(orderId);
  
  try {
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      return res.status(404).send({ message: `Order with ID ${orderId} not found.` });
    }
    
    const orderData = orderSnap.data();
    
    // 2. Permission Check (Allow owner or admins/managers)
    let canGenerate = false;
    
    // User generating receipt for their own order
    if (requestingUser.uid === orderData.userId) {
      canGenerate = true;
    } 
    // Admin/Manager generating receipt for order within their scope
    else if (requestingUser.role === "TenantAdmin" && requestingUser.tenantId === orderData.tenantId) {
      canGenerate = true;
    }
    else if (requestingUser.role === "StoreManager" && requestingUser.storeId === orderData.storeId) {
      canGenerate = true;
    }
    
    if (!canGenerate) {
      console.warn(`User ${requestingUser.uid} attempt to generate receipt for order ${orderId} denied.`);
      return res.status(403).send({ 
        message: "Forbidden: You do not have permission to generate receipts for this order." 
      });
    }
    
    // 3. --- Placeholder Logic ---
    // TODO: Implement actual receipt generation (e.g., call a PDF service, Cloud Function)
    //       and update the order document with the receipt URL or status.
    console.log(`Receipt generation triggered for order ${orderId} by ${requestingUser.uid}.`);
    
    const receiptUrl = `https://example.com/receipts/${orderId}?t=${Date.now()}`;
    
    await orderRef.update({
      receiptUrl: receiptUrl, // Store a dummy URL for now
      receiptGeneratedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    // --- End Placeholder Logic ---
    
    // 4. Return Success Response (acknowledging the request)
    res.status(200).send({
      message: "Receipt generation process started.",
      orderId: orderId,
      receiptUrl: receiptUrl // Optionally return the generated URL immediately
    });
  } catch (error) {
    console.error(`Error triggering receipt generation for order ${orderId}:`, error);
    res.status(500).send({ 
      message: "Failed to generate receipt due to an internal error.", 
      error: error.message 
    });
  }
}; 