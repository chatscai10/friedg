const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore"); // Import FieldValue
// const functions = require("firebase-functions"); // Not used yet

// TODO: Implement actual database interactions (Firestore)
const db = admin.firestore(); // Used implicitly by collection references if needed later
// Assuming collection names like menuCategories, menuItems, menuOptions

/**
 * Handler to get the menu for a specific store.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.getMenuForStore = async (req, res) => {
  const storeId = req.params.storeId;
  console.log(`Handler: getMenuForStore called for store: ${storeId}`);

  try {
    if (!storeId) {
      return res.status(400).send({ message: "Missing storeId parameter." });
    }

    // 1. Fetch active categories for the store
    const categoriesQuery = db.collection("menuCategories")
      .where("storeId", "==", storeId)
      .where("isActive", "==", true) // Assuming an "isActive" field
      .orderBy("displayOrder", "asc"); // Assuming a field for ordering
    const categoriesSnap = await categoriesQuery.get();
    const categories = categoriesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (categories.length === 0) {
      // No active categories found for this store
      return res.status(200).send({ menu: { categories: [] } }); // Return empty menu structure
    }

    // 2. Fetch active items for these categories
    const categoryIds = categories.map((cat) => cat.id);
    // Note: Firestore "in" query limit is 30 elements per query. Handle pagination or larger sets if needed.
    const itemsQuery = db.collection("menuItems")
      .where("categoryId", "in", categoryIds)
      .where("isActive", "==", true)
      .orderBy("displayOrder", "asc");
    const itemsSnap = await itemsQuery.get();
    const items = itemsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 3. Fetch active options for these items (Simplified example)
    const itemIds = items.map((item) => item.id);
    const options = []; // Use const if not reassigned, but it is reassigned via push
    if (itemIds.length > 0) {
      // Split itemIds into chunks of 30 for "in" query limitation
      const itemChunks = [];
      for (let i = 0; i < itemIds.length; i += 30) {
        itemChunks.push(itemIds.slice(i, i + 30));
      }

      const optionPromises = itemChunks.map((chunk) =>
        db.collection("menuOptions")
          .where("itemId", "in", chunk) // Adjust based on your data model (e.g., optionGroupId)
          .where("isActive", "==", true)
          .get(), // Removed trailing comma issue by removing comma
      );

      const optionSnapshots = await Promise.all(optionPromises);
      optionSnapshots.forEach((snap) => {
        snap.docs.forEach((doc) => {
          options.push({ id: doc.id, ...doc.data() });
        });
      });
      // TODO: Consider ordering options if needed.
    }

    // 4. Structure the response data
    const structuredMenu = categories.map((category) => {
      const categoryItems = items
        .filter((item) => item.categoryId === category.id)
        .map((item) => {
          // Find options related to this item
          const itemOptions = options.filter((opt) => opt.itemId === item.id); // Adjust if using option groups
          return { ...item, options: itemOptions }; // Add options array to each item
        });
      return { ...category, items: categoryItems }; // Add items array to each category
    });

    res.status(200).send({ menu: structuredMenu }); // Send structured menu
  } catch (error) {
    console.error(`Error fetching menu for store ${storeId}:`, error);
    res.status(500).send({ message: "Failed to fetch menu.", error: error.message });
  }
};

// --- Placeholder Handlers for Admin CRUD --- //

// Categories
/**
 * Handler to create a new menu category.
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.createMenuCategory = async (req, res) => {
  const { name, storeId, displayOrder = 0 } = req.body; // Assume these fields
  const requestingUser = req.user; // From checkAuth middleware

  // 1. Basic Validation
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).send({ message: "Invalid or missing category name." });
  }
  if (!storeId || typeof storeId !== "string") {
    return res.status(400).send({ message: "Invalid or missing storeId." });
  }
  // Add more validation as needed (e.g., displayOrder type)

  // 2. Permission Check
  const tenantId = requestingUser.tenantId;
  if (!tenantId) {
    return res.status(403).send({ message: "Forbidden: Requesting user has no tenantId." });
  }
  if (requestingUser.role === "StoreManager" && requestingUser.storeId !== storeId) {
    return res.status(403).send({ message: "Forbidden: StoreManager can only manage categories for their assigned store." });
  }
  // Note: checkRole middleware already confirmed TenantAdmin or StoreManager

  try {
    // 3. Prepare data for Firestore
    const newCategoryData = {
      name: name.trim(),
      tenantId: tenantId, // From the requesting user
      storeId: storeId,
      displayOrder: Number(displayOrder) || 0, // Ensure number, default to 0
      isActive: true, // Default to active
      createdAt: FieldValue.serverTimestamp(), // Use FieldValue
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue
      // Add createdBy: requestingUser.uid if needed
    };

    // 4. Add to Firestore
    const docRef = await db.collection("menuCategories").add(newCategoryData);
    console.log(`Successfully created menu category with ID: ${docRef.id}`);

    // 5. Return success response
    res.status(201).send({ id: docRef.id, ...newCategoryData });
  } catch (error) {
    console.error("Error creating menu category:", error);
    res.status(500).send({ message: "Failed to create menu category.", error: error.message });
  }
};

/**
 * Handler to get menu categories for a specific store.
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.getMenuCategoriesByStore = async (req, res) => {
  const { storeId } = req.params;
  const requestingUser = req.user; // From checkAuth middleware

  // 1. Basic Validation
  if (!storeId) {
    return res.status(400).send({ message: "Missing storeId parameter." });
  }

  // 2. Permission Check
  // TenantAdmin can view any store in their tenant
  // StoreManager can only view their own store
  if (requestingUser.role === "StoreManager" && requestingUser.storeId !== storeId) {
    return res.status(403).send({ message: "Forbidden: StoreManager can only view categories for their assigned store." });
  }
  // Optional: Add tenantId check if needed (already implicitly checked by StoreManager storeId check)
  // if (requestingUser.role === "TenantAdmin" && requestingUser.tenantId !== ???) { ... }
  // We assume TenantAdmin can see all stores in their tenant, so no extra tenant check here for now.

  try {
    // 3. Query Firestore
    const categoriesQuery = db.collection("menuCategories")
      .where("storeId", "==", storeId)
      // .where("isActive", "==", true) // Uncomment if only active needed for backend management
      .orderBy("displayOrder", "asc"); // Assuming a field for ordering

    const snapshot = await categoriesQuery.get();

    if (snapshot.empty) {
      return res.status(200).send([]); // Return empty array if no categories found
    }

    const categories = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 4. Return categories
    res.status(200).send(categories);
  } catch (error) {
    console.error(`Error fetching menu categories for store ${storeId}:`, error);
    res.status(500).send({ message: "Failed to fetch menu categories.", error: error.message });
  }
};

/**
 * Handler to update an existing menu category.
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.updateMenuCategory = async (req, res) => {
  const { categoryId } = req.params;
  const updateData = req.body; // e.g., { name, displayOrder, isActive }
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!categoryId) {
    return res.status(400).send({ message: "Missing categoryId parameter." });
  }
  // Basic validation for incoming data (can be more specific)
  if (typeof updateData !== "object" || updateData === null || Object.keys(updateData).length === 0) {
    return res.status(400).send({ message: "Invalid or empty update data." });
  }
  // Prevent updating immutable fields (like tenantId, storeId, createdAt)
  delete updateData.tenantId;
  delete updateData.storeId;
  delete updateData.createdAt;
  delete updateData.id; // Prevent client sending the ID in body

  const categoryRef = db.collection("menuCategories").doc(categoryId);

  try {
    const categorySnap = await categoryRef.get();

    if (!categorySnap.exists) {
      return res.status(404).send({ message: "Menu category not found." });
    }

    const categoryData = categorySnap.data();

    // 2. Permission Check
    // TenantAdmin can update any category in their tenant
    // StoreManager can only update categories in their own store
    if (requestingUser.tenantId !== categoryData.tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot access category in another tenant." });
    }
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== categoryData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only update categories for their assigned store." });
    }

    // 3. Prepare Update Payload
    const payload = {
      ...updateData,
      // Ensure name is trimmed if provided
      ...(updateData.name && { name: updateData.name.trim() }),
      // Ensure displayOrder is a number if provided
      ...(updateData.displayOrder !== undefined && { displayOrder: Number(updateData.displayOrder) || 0 }),
      // Ensure isActive is a boolean if provided
      ...(updateData.isActive !== undefined && { isActive: Boolean(updateData.isActive) }),
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue
      // updatedBy: requestingUser.uid // Optional tracking
    };

    // Remove undefined fields from payload to avoid issues with Firestore merge
    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    // Ensure numeric fields are numbers, boolean fields are booleans, etc.
    if (payload.displayOrder !== undefined) payload.displayOrder = Number(payload.displayOrder) || 0;
    if (payload.isActive !== undefined) payload.isActive = Boolean(payload.isActive);

    payload.updatedAt = FieldValue.serverTimestamp(); // Use FieldValue

    // 4. Update Firestore Document
    await categoryRef.update(payload);
    console.log(`Successfully updated menu category: ${categoryId}`);

    // 5. Return success response
    res.status(200).send({ message: "Menu category updated successfully.", id: categoryId });
  } catch (error) {
    console.error(`Error updating menu category ${categoryId}:`, error);
    res.status(500).send({ message: "Failed to update menu category.", error: error.message });
  }
};

/**
 * Handler to soft delete a menu category (sets isActive to false).
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.deleteMenuCategory = async (req, res) => {
  const { categoryId } = req.params;
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!categoryId) {
    return res.status(400).send({ message: "Missing categoryId parameter." });
  }

  const categoryRef = db.collection("menuCategories").doc(categoryId);

  try {
    const categorySnap = await categoryRef.get();

    if (!categorySnap.exists) {
      // Return success even if not found, as the desired state (deleted) is achieved.
      // Or return 404 if strict feedback is needed.
      console.log(`Menu category ${categoryId} not found for deletion, considered successful.`);
      return res.status(200).send({ message: "Menu category already deleted or not found." });
      // return res.status(404).send({ message: "Menu category not found." });
    }

    const categoryData = categorySnap.data();

    // 2. Permission Check
    if (requestingUser.tenantId !== categoryData.tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot access category in another tenant." });
    }
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== categoryData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only delete categories for their assigned store." });
    }

    // 3. Perform Soft Delete (Update isActive and timestamp)
    await categoryRef.update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue
      // deletedBy: requestingUser.uid // Optional tracking
    });
    console.log(`Successfully soft deleted menu category: ${categoryId}`);

    // 4. Return success response
    res.status(200).send({ message: "Menu category deleted successfully (soft delete).", id: categoryId });
  } catch (error) {
    console.error(`Error deleting menu category ${categoryId}:`, error);
    res.status(500).send({ message: "Failed to delete menu category.", error: error.message });
  }
};

// Items
/**
 * Handler to create a new menu item.
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.createMenuItem = async (req, res) => {
  // Assuming body includes: name, description, price, categoryId, storeId, displayOrder, etc.
  const { categoryId, storeId, name, price, ...otherData } = req.body;
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!categoryId || typeof categoryId !== "string") {
    return res.status(400).send({ message: "Invalid or missing categoryId." });
  }
  if (!storeId || typeof storeId !== "string") {
    return res.status(400).send({ message: "Invalid or missing storeId." });
  }
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).send({ message: "Invalid or missing item name." });
  }
  if (price === undefined || typeof price !== "number" || price < 0) {
    return res.status(400).send({ message: "Invalid or missing item price." });
  }
  // Add other validations as needed

  // 2. Permission and Category Validation
  const tenantId = requestingUser.tenantId;
  if (!tenantId) {
    return res.status(403).send({ message: "Forbidden: Requesting user has no tenantId." });
  }

  const categoryRef = db.collection("menuCategories").doc(categoryId);

  try {
    const categorySnap = await categoryRef.get();

    if (!categorySnap.exists) {
      return res.status(404).send({ message: `Parent category (${categoryId}) not found.` });
    }

    const categoryData = categorySnap.data();

    // Verify category belongs to the correct tenant and store (important permission check)
    if (categoryData.tenantId !== tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot add item to a category in another tenant." });
    }
    // Ensure storeId from request body matches the parent category's storeId
    if (categoryData.storeId !== storeId) {
      return res.status(400).send({ message: "Store ID in request body does not match parent category's store ID." });
    }
    // Check if StoreManager is allowed to manage this category's store
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== categoryData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only add items to categories in their assigned store." });
    }

    // 3. Prepare Item Data
    const newItemData = {
      name: name.trim(),
      description: otherData.description || "", // Optional field
      price: price,
      categoryId: categoryId,
      tenantId: tenantId,
      storeId: storeId,
      displayOrder: Number(otherData.displayOrder) || 0,
      isActive: true,
      imageUrl: otherData.imageUrl || null,
      tags: otherData.tags || [],
      createdAt: FieldValue.serverTimestamp(), // Use FieldValue
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue
      // createdBy: requestingUser.uid,
    };

    // 4. Add Item to Firestore
    const docRef = await db.collection("menuItems").add(newItemData);
    console.log(`Successfully created menu item with ID: ${docRef.id}`);

    // 5. Return Success Response
    res.status(201).send({ id: docRef.id, ...newItemData });
  } catch (error) {
    console.error("Error creating menu item:", error);
    res.status(500).send({ message: "Failed to create menu item.", error: error.message });
  }
};

/**
 * Handler to get menu items for a specific category.
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.getMenuItemsByCategory = async (req, res) => {
  const { categoryId } = req.params;
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!categoryId) {
    return res.status(400).send({ message: "Missing categoryId parameter." });
  }

  const categoryRef = db.collection("menuCategories").doc(categoryId);

  try {
    const categorySnap = await categoryRef.get();

    if (!categorySnap.exists) {
      return res.status(404).send({ message: `Parent category (${categoryId}) not found.` });
    }

    const categoryData = categorySnap.data();

    // 2. Permission Check
    // TenantAdmin can view items in any category within their tenant.
    // StoreManager can view items only in categories belonging to their assigned store.
    if (requestingUser.tenantId !== categoryData.tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot access items in a category from another tenant." });
    }
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== categoryData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only view items in categories for their assigned store." });
    }

    // 3. Query Firestore for items in this category
    const itemsQuery = db.collection("menuItems")
      .where("categoryId", "==", categoryId)
      // .where("isActive", "==", true) // Uncomment if only active items are needed for admin view
      .orderBy("displayOrder", "asc");

    const snapshot = await itemsQuery.get();

    if (snapshot.empty) {
      return res.status(200).send([]); // Return empty array if no items found
    }

    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 4. Return items
    res.status(200).send(items);
  } catch (error) {
    console.error(`Error fetching menu items for category ${categoryId}:`, error);
    res.status(500).send({ message: "Failed to fetch menu items.", error: error.message });
  }
};

/**
 * Handler to update an existing menu item.
 * Requires TenantAdmin or StoreManager role.
 * Does not allow changing the categoryId.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.updateMenuItem = async (req, res) => {
  const { itemId } = req.params;
  const updateData = req.body; // e.g., { name, description, price, displayOrder, isActive }
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!itemId) {
    return res.status(400).send({ message: "Missing itemId parameter." });
  }
  if (typeof updateData !== "object" || updateData === null || Object.keys(updateData).length === 0) {
    return res.status(400).send({ message: "Invalid or empty update data." });
  }

  // Prevent disallowed updates
  delete updateData.tenantId;
  delete updateData.storeId;
  delete updateData.categoryId; // Explicitly disallow changing category via this endpoint
  delete updateData.createdAt;
  delete updateData.id; // Prevent client sending the ID in body

  // Add more specific validation (e.g., price >= 0)
  if (updateData.price !== undefined && (typeof updateData.price !== "number" || updateData.price < 0)) {
    return res.status(400).send({ message: "Invalid item price." });
  }
  if (updateData.name !== undefined && (typeof updateData.name !== "string" || updateData.name.trim() === "")) {
    return res.status(400).send({ message: "Invalid item name." });
  }

  const itemRef = db.collection("menuItems").doc(itemId);

  try {
    const itemSnap = await itemRef.get();

    if (!itemSnap.exists) {
      return res.status(404).send({ message: "Menu item not found." });
    }

    const itemData = itemSnap.data();

    // 2. Permission Check
    // TenantAdmin can update any item in their tenant
    // StoreManager can only update items in their own store
    if (requestingUser.tenantId !== itemData.tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot access item in another tenant." });
    }
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== itemData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only update items for their assigned store." });
    }

    // 3. Prepare Update Payload
    const payload = {
      ...updateData,
      // Ensure name is trimmed if provided
      ...(updateData.name && { name: updateData.name.trim() }),
      // Ensure description is handled correctly if provided
      ...(updateData.description !== undefined && { description: updateData.description ? updateData.description.trim() : null }),
      // Ensure displayOrder is a number if provided
      ...(updateData.displayOrder !== undefined && { displayOrder: Number(updateData.displayOrder) || 0 }),
      // Ensure isActive is a boolean if provided
      ...(updateData.isActive !== undefined && { isActive: Boolean(updateData.isActive) }),
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue
      // Add updatedBy: requestingUser.uid if needed
    };

    // Ensure numeric fields are numbers, boolean fields are booleans, etc.
    if (payload.displayOrder !== undefined) payload.displayOrder = Number(payload.displayOrder) || 0;
    if (payload.isActive !== undefined) payload.isActive = Boolean(payload.isActive);

    // 4. Update Firestore Document
    await itemRef.update(payload);
    console.log(`Successfully updated menu item: ${itemId}`);

    // 5. Return success response
    res.status(200).send({ message: "Menu item updated successfully.", id: itemId });
  } catch (error) {
    console.error(`Error updating menu item ${itemId}:`, error);
    res.status(500).send({ message: "Failed to update menu item.", error: error.message });
  }
};

/**
 * Handler to soft delete a menu item (sets isActive to false).
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.deleteMenuItem = async (req, res) => {
  const { itemId } = req.params;
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!itemId) {
    return res.status(400).send({ message: "Missing itemId parameter." });
  }

  const itemRef = db.collection("menuItems").doc(itemId);

  try {
    const itemSnap = await itemRef.get();

    if (!itemSnap.exists) {
      // Consider item already deleted, return success
      console.log(`Menu item ${itemId} not found for deletion, considered successful.`);
      return res.status(200).send({ message: "Menu item already deleted or not found." });
    }

    const itemData = itemSnap.data();

    // 2. Permission Check
    if (requestingUser.tenantId !== itemData.tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot access item in another tenant." });
    }
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== itemData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only delete items for their assigned store." });
    }

    // 3. Perform Soft Delete (Update isActive and timestamp)
    await itemRef.update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue
      // deletedBy: requestingUser.uid // Optional tracking
    });
    console.log(`Successfully soft deleted menu item: ${itemId}`);

    // 4. Return success response
    res.status(200).send({ message: "Menu item deleted successfully (soft delete).", id: itemId });
  } catch (error) {
    console.error(`Error deleting menu item ${itemId}:`, error);
    res.status(500).send({ message: "Failed to delete menu item.", error: error.message });
  }
};

// Options
/**
 * Handler to create a new menu option.
 * Requires TenantAdmin or StoreManager role.
 * Assumes options are directly linked to items via itemId.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.createMenuOption = async (req, res) => {
  // Assume body includes: name, priceAdjustment, itemId, storeId, displayOrder, isDefault
  const { itemId, storeId, name, priceAdjustment = 0, ...otherData } = req.body;
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!itemId || typeof itemId !== "string") {
    return res.status(400).send({ message: "Invalid or missing itemId." });
  }
  if (!storeId || typeof storeId !== "string") {
    // storeId is crucial for permission checks later, even if redundant with item's storeId
    return res.status(400).send({ message: "Invalid or missing storeId." });
  }
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).send({ message: "Invalid or missing option name." });
  }
  if (typeof priceAdjustment !== "number") {
    return res.status(400).send({ message: "Invalid priceAdjustment. Must be a number." });
  }
  // Add other validations as needed (e.g., displayOrder, isDefault type)

  // 2. Permission and Item Validation
  const tenantId = requestingUser.tenantId;
  if (!tenantId) {
    return res.status(403).send({ message: "Forbidden: Requesting user has no tenantId." });
  }

  const itemRef = db.collection("menuItems").doc(itemId);

  try {
    const itemSnap = await itemRef.get();

    if (!itemSnap.exists) {
      return res.status(404).send({ message: `Parent menu item (${itemId}) not found.` });
    }

    const itemData = itemSnap.data();

    // Verify item belongs to the correct tenant and store
    if (itemData.tenantId !== tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot add option to an item in another tenant." });
    }
    // Ensure storeId from request body matches the parent item's storeId
    if (itemData.storeId !== storeId) {
      return res.status(400).send({ message: "Store ID in request body does not match parent item's store ID." });
    }
    // Check if StoreManager is allowed to manage this item's store
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== itemData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only add options to items in their assigned store." });
    }
    // Optional: Check if parent item is active? Depending on business logic.
    // if (!itemData.isActive) {
    //   return res.status(400).send({ message: "Cannot add option to an inactive item." });
    // }

    // 3. Prepare Option Data
    const newOptionData = {
      name: name.trim(),
      priceAdjustment: Number(priceAdjustment),
      itemId: itemId, // Link to the parent item
      tenantId: tenantId,
      storeId: storeId, // Redundant but potentially useful for direct queries/rules
      displayOrder: Number(otherData.displayOrder) || 0,
      isDefault: Boolean(otherData.isDefault) || false,
      isActive: true, // Default to active
      createdAt: FieldValue.serverTimestamp(), // Use FieldValue
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue
      // createdBy: requestingUser.uid,
    };

    // 4. Add Option to Firestore
    const docRef = await db.collection("menuOptions").add(newOptionData);
    console.log(`Successfully created menu option with ID: ${docRef.id}`);

    // 5. Return Success Response
    res.status(201).send({ id: docRef.id, ...newOptionData });
  } catch (error) {
    console.error("Error creating menu option:", error);
    res.status(500).send({ message: "Failed to create menu option.", error: error.message });
  }
};

/**
 * Handler to get menu options for a specific item.
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.getMenuOptionsByItem = async (req, res) => {
  const { itemId } = req.params;
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!itemId) {
    return res.status(400).send({ message: "Missing itemId parameter." });
  }

  const itemRef = db.collection("menuItems").doc(itemId);

  try {
    const itemSnap = await itemRef.get();

    if (!itemSnap.exists) {
      return res.status(404).send({ message: `Parent menu item (${itemId}) not found.` });
    }

    const itemData = itemSnap.data();

    // 2. Permission Check (Verify access to the parent item)
    if (requestingUser.tenantId !== itemData.tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot access options for an item in another tenant." });
    }
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== itemData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only view options for items in their assigned store." });
    }

    // 3. Query Firestore for options associated with this item
    const optionsQuery = db.collection("menuOptions")
      .where("itemId", "==", itemId)
      // .where("isActive", "==", true) // Return all options for now (active and inactive)
      .orderBy("displayOrder", "asc");

    const snapshot = await optionsQuery.get();

    if (snapshot.empty) {
      return res.status(200).send([]); // Return empty array if no options found
    }

    const options = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 4. Return options
    res.status(200).send(options);
  } catch (error) {
    console.error(`Error fetching menu options for item ${itemId}:`, error);
    res.status(500).send({ message: "Failed to fetch menu options.", error: error.message });
  }
};

/**
 * Handler to update an existing menu option.
 * Requires TenantAdmin or StoreManager role.
 * Does not allow changing itemId or storeId.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.updateMenuOption = async (req, res) => {
  const { optionId } = req.params;
  const updateData = req.body; // e.g., { name, priceAdjustment, displayOrder, isActive, isDefault }
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!optionId) {
    return res.status(400).send({ message: "Missing optionId parameter." });
  }
  if (typeof updateData !== "object" || updateData === null || Object.keys(updateData).length === 0) {
    return res.status(400).send({ message: "Invalid or empty update data." });
  }

  // Prevent disallowed updates
  delete updateData.tenantId;
  delete updateData.storeId;
  delete updateData.itemId;
  delete updateData.createdAt;
  delete updateData.id;

  // Add specific validations
  if (updateData.priceAdjustment !== undefined && typeof updateData.priceAdjustment !== "number") {
    return res.status(400).send({ message: "Invalid priceAdjustment. Must be a number." });
  }
  if (updateData.name !== undefined && (typeof updateData.name !== "string" || updateData.name.trim() === "")) {
    return res.status(400).send({ message: "Invalid option name." });
  }

  const optionRef = db.collection("menuOptions").doc(optionId);

  try {
    const optionSnap = await optionRef.get();

    if (!optionSnap.exists) {
      return res.status(404).send({ message: "Menu option not found." });
    }

    const optionData = optionSnap.data();

    // 2. Permission Check
    if (requestingUser.tenantId !== optionData.tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot access option in another tenant." });
    }
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== optionData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only update options for their assigned store." });
    }

    // 3. Prepare Update Payload
    const payload = {
      ...updateData,
      ...(updateData.name && { name: updateData.name.trim() }),
      ...(updateData.displayOrder !== undefined && { displayOrder: Number(updateData.displayOrder) || 0 }),
      ...(updateData.isActive !== undefined && { isActive: Boolean(updateData.isActive) }),
      ...(updateData.isDefault !== undefined && { isDefault: Boolean(updateData.isDefault) }),
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue
      // Add updatedBy: requestingUser.uid if needed
    };

    // Ensure numeric fields are numbers, boolean fields are booleans, etc.
    if (payload.priceAdjustment !== undefined) payload.priceAdjustment = Number(payload.priceAdjustment);
    if (payload.displayOrder !== undefined) payload.displayOrder = Number(payload.displayOrder) || 0;
    if (payload.isActive !== undefined) payload.isActive = Boolean(payload.isActive);

    // 4. Update Firestore Document
    await optionRef.update(payload);
    console.log(`Successfully updated menu option: ${optionId}`);

    // 5. Return success response
    res.status(200).send({ message: "Menu option updated successfully.", id: optionId });
  } catch (error) {
    console.error(`Error updating menu option ${optionId}:`, error);
    res.status(500).send({ message: "Failed to update menu option.", error: error.message });
  }
};

/**
 * Handler to soft delete a menu option (sets isActive to false).
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.deleteMenuOption = async (req, res) => {
  const { optionId } = req.params;
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!optionId) {
    return res.status(400).send({ message: "Missing optionId parameter." });
  }

  const optionRef = db.collection("menuOptions").doc(optionId);

  try {
    const optionSnap = await optionRef.get();

    if (!optionSnap.exists) {
      // Consider option already deleted, return success
      console.log(`Menu option ${optionId} not found for deletion, considered successful.`);
      return res.status(200).send({ message: "Menu option already deleted or not found." });
    }

    const optionData = optionSnap.data();

    // 2. Permission Check
    if (requestingUser.tenantId !== optionData.tenantId) {
      return res.status(403).send({ message: "Forbidden: Cannot access option in another tenant." });
    }
    if (requestingUser.role === "StoreManager" && requestingUser.storeId !== optionData.storeId) {
      return res.status(403).send({ message: "Forbidden: StoreManager can only delete options for their assigned store." });
    }

    // 3. Perform Soft Delete
    await optionRef.update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue
      // deletedBy: requestingUser.uid // Optional tracking
    });
    console.log(`Successfully soft deleted menu option: ${optionId}`);

    // 4. Return success response
    res.status(200).send({ message: "Menu option deleted successfully (soft delete).", id: optionId });
  } catch (error) {
    console.error(`Error deleting menu option ${optionId}:`, error);
    res.status(500).send({ message: "Failed to delete menu option.", error: error.message });
  }
};

/** Handler to get all menu categories for the requesting user's tenant.
 * Requires TenantAdmin or StoreManager role.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} 
 */
exports.getAllMenuCategories = async (req, res) => {
  const requestingUser = req.user; // From checkAuth middleware

  // 1. Permission Check (already handled by checkRole, but good practice)
  if (!requestingUser || !requestingUser.tenantId) {
    return res.status(403).send({ message: "Forbidden: Missing user or tenant information." });
  }
  const tenantId = requestingUser.tenantId;

  try {
    // 2. Query Firestore for all categories within the tenant
    const categoriesQuery = db.collection("menuCategories")
      .where("tenantId", "==", tenantId)
      .orderBy("displayOrder", "asc"); // Order is optional but good for consistency

    const snapshot = await categoriesQuery.get();

    if (snapshot.empty) {
      return res.status(200).send([]); // Return empty array if no categories found
    }

    const categories = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 3. Return categories
    res.status(200).send(categories);

  } catch (error) {
    console.error(`Error fetching all menu categories for tenant ${tenantId}:`, error);
    res.status(500).send({ message: "Failed to fetch menu categories.", error: error.message });
  }
};
