const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore"); // Import FieldValue
// const functions = require("firebase-functions"); // Unused import

// TODO: Implement actual database interactions (Firestore)
const db = admin.firestore();
const employeesCollection = db.collection("employees"); // Assuming collection name
const storesCollection = db.collection("stores"); // Added for store validation
const VALID_EMPLOYEE_ROLES = ["StoreManager", "StoreStaff"]; // Define valid roles - fixed single quotes

/**
 * Validate required fields for creating an employee.
 * @param {object} data The request body.
 * @return {string|null} Error message or null if valid.
 */
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
exports.createEmployee = async (req, res) => {
  const { email, password, displayName, role, storeId, ...otherData } = req.body;
  const requestingUser = req.user; // User making the request (from checkAuth middleware)

  // 1. Validate Input Data (Basic Fields)
  const validationError = validateCreateEmployeeData(req.body);
  if (validationError) {
    return res.status(400).send({ message: validationError });
  }

  // 1.5 Validate Role
  if (!VALID_EMPLOYEE_ROLES.includes(role)) {
    return res.status(400).send({ message: `Invalid role specified. Must be one of: ${VALID_EMPLOYEE_ROLES.join(", ")}` });
  }

  // 2. Check Permissions & Tenant Context
  const tenantId = requestingUser.tenantId; // Get tenantId from the requesting user's claims
  if (!tenantId) {
    console.error(`Critical: Requesting user ${requestingUser.uid} is missing tenantId claim.`);
    return res.status(403).send({ message: "Forbidden: Requesting user context is invalid (missing tenantId)." });
  }

  // StoreManager can only create for their own store.
  if (requestingUser.role === "StoreManager" && requestingUser.storeId !== storeId) {
    return res.status(403).send({ message: `Forbidden: StoreManager can only create employees for their assigned store (${requestingUser.storeId}).` });
  }
  // Note: The checkRole middleware already ensures the user is TenantAdmin or StoreManager.

  let newUserRecord = null;
  try {
    // 2.5 Validate Store Existence and Tenant Ownership
    const storeRef = storesCollection.doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      return res.status(404).send({ message: `Store with ID ${storeId} not found.` });
    }

    const storeData = storeSnap.data();
    // For TenantAdmin, verify the store belongs to their tenant.
    // (StoreManager check already implicitly verified this via requestingUser.storeId)
    if (requestingUser.role === "TenantAdmin" && storeData.tenantId !== tenantId) {
      console.warn(`TenantAdmin ${requestingUser.uid} attempted to create employee in store ${storeId} which belongs to different tenant ${storeData.tenantId}.`);
      return res.status(403).send({ message: `Forbidden: Store ${storeId} does not belong to your tenant.` });
    }

    // 3. Create Firebase Auth User
    newUserRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false, // Or true, depending on flow
      disabled: false,
    });
    console.log(`Successfully created new auth user: ${newUserRecord.uid}`);

    // 4. Set Custom Claims for the new user
    // IMPORTANT: Ensure tenantId and storeId are correctly associated
    await admin.auth().setCustomUserClaims(newUserRecord.uid, {
      role: role,
      tenantId: tenantId, // Assign the tenant of the creator
      storeId: storeId, // Assign the specified store
    });
    console.log(`Successfully set custom claims for user: ${newUserRecord.uid}`);

    // 5. Create Firestore Employee Document
    const employeeData = {
      uid: newUserRecord.uid, // Use auth UID as document ID
      email: email,
      displayName: displayName,
      role: role,
      tenantId: tenantId,
      storeId: storeId,
      createdAt: FieldValue.serverTimestamp(), // Use imported FieldValue
      updatedAt: FieldValue.serverTimestamp(), // Use imported FieldValue
      status: "active", // Default status
      ...otherData, // Include any other relevant fields from request
    };

    await employeesCollection.doc(newUserRecord.uid).set(employeeData);
    console.log(`Successfully created Firestore employee document for user: ${newUserRecord.uid}`);

    // 6. Return Success Response (excluding password)
    // eslint-disable-next-line no-unused-vars
    const { password: _, ...employeeDataWithoutPassword } = employeeData;
    // Manually add serverTimestamp to the returned object as it's not available
    // immediately after set() with serverTimestamp(). Client might need to refetch.
    // Alternatively, don't return timestamps or return approximate client time.
    // For now, let's omit them from the immediate response for simplicity.
    delete employeeDataWithoutPassword.createdAt;
    delete employeeDataWithoutPassword.updatedAt;
    return res.status(201).send(employeeDataWithoutPassword);
  } catch (error) {
    console.error("Error creating employee:", error);

    // Clean up Auth user if Firestore creation fails
    if (newUserRecord && newUserRecord.uid) {
      try {
        await admin.auth().deleteUser(newUserRecord.uid);
        console.log(`Cleaned up auth user ${newUserRecord.uid} after Firestore error.`);
      } catch (cleanupError) {
        console.error(`Failed to cleanup auth user ${newUserRecord.uid}:`, cleanupError);
        // Log this critical failure, manual cleanup might be needed
      }
    }

    if (error.code === "auth/email-already-exists") {
      return res.status(409).send({ message: "Email already in use." });
    }
    // Add more specific error handling based on Firebase error codes
    return res.status(500).send({ message: "Failed to create employee.", error: error.message });
  }
};

/**
 * Get a single employee by ID.
 */
exports.getEmployeeById = async (req, res) => {
  const employeeId = req.params.employeeId;
  // TODO: Check permissions (can user view this employee?)
  // TODO: Fetch employee document from Firestore
  console.log(`Handler: getEmployeeById called for ID: ${employeeId}`);
  res.status(501).send({ message: "Handler not implemented yet.", employeeId });
};

/**
 * List employees, potentially filtered by storeId and with pagination.
 */
exports.listEmployeesByStore = async (req, res) => {
  // eslint-disable-next-line no-unused-vars
  const { storeId, limit = 10, startAfter } = req.query;
  // TODO: Check permissions (can user view employees for this store?)
  // TODO: Implement Firestore query with filtering, ordering, pagination (limit, startAfter)
  console.log(`Handler: listEmployeesByStore called for store: ${storeId}`, req.query);
  res.status(501).send({ message: "Handler not implemented yet.", storeId });
};

/**
 * Update an existing employee.
 */
exports.updateEmployee = async (req, res) => {
  const employeeId = req.params.employeeId;
  const updatePayload = req.body;
  // TODO: Validate request body (e.g., allowed fields)
  // TODO: Check permissions (can user update this employee?)

  // Prevent updating immutable fields
  delete updatePayload.uid;
  delete updatePayload.email;
  delete updatePayload.tenantId;
  delete updatePayload.storeId;
  delete updatePayload.createdAt;

  if (Object.keys(updatePayload).length === 0) {
    return res.status(400).send({ message: "No valid fields provided for update." });
  }

  updatePayload.updatedAt = FieldValue.serverTimestamp();

  // TODO: Implement Firestore update logic within try/catch
  console.log(`Handler: updateEmployee called for ID: ${employeeId}`, updatePayload);
  res.status(501).send({ message: "Handler not implemented yet.", employeeId });
};

/**
 * Delete (or disable) an employee.
 */
exports.deleteEmployee = async (req, res) => {
  const employeeId = req.params.employeeId;
  const requestingUser = req.user;

  // TODO: Check permissions (can user delete this employee?)
  // Example: Check if requesting user is TenantAdmin or StoreManager of the employee's store
  const employeeRef = employeesCollection.doc(employeeId);

  try {
    const employeeSnap = await employeeRef.get();
    if (!employeeSnap.exists) {
      return res.status(404).send({ message: "Employee not found." });
    }
    const employeeData = employeeSnap.data();

    // Basic Permission Check (Placeholder - adapt as needed)
    let canDelete = false;
    if (requestingUser.role === "TenantAdmin" && requestingUser.tenantId === employeeData.tenantId) {
      canDelete = true;
    }
    if (!canDelete && requestingUser.role === "StoreManager" && requestingUser.storeId === employeeData.storeId) {
      canDelete = true;
    }

    if (!canDelete) {
      console.warn(`Forbidden delete attempt: User ${requestingUser.uid} (role: ${requestingUser.role}) tried to delete employee ${employeeId}`);
      return res.status(403).send({ message: "Forbidden: You do not have permission to delete this employee." });
    }

    // Option 1: Soft delete by updating status
    const updatePayload = {
      status: "inactive",
      updatedAt: FieldValue.serverTimestamp(), // Corrected trailing comma and indentation
      // deletedBy: requestingUser.uid // Optional: track who deleted
    };
    await employeeRef.update(updatePayload); // Actually perform the update

    // Option 2: Hard delete (use with caution)
    // await employeeRef.delete();
    // TODO: Also delete the corresponding Firebase Auth user if hard deleting
    // await admin.auth().deleteUser(employeeId); // Be careful with this!

    console.log(`Handler: Successfully soft deleted employee: ${employeeId}`);
    return res.status(200).send({ message: "Employee successfully disabled (soft deleted)." }); // Return 200 OK

  } catch (error) {
    console.error(`Error deleting employee ${employeeId}:`, error);
    return res.status(500).send({ message: "Failed to delete employee.", error: error.message });
  }
};
