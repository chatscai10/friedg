const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

// Assuming Firestore is initialized elsewhere and db is available
const db = admin.firestore();

/**
 * Handler to get a specific member's details by their ID.
 * Permissions:
 * - Member can get their own data.
 * - TenantAdmin can get any member in their tenant.
 * - StoreManager can get any member in their assigned store.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.getMemberById = async (req, res) => {
  const { memberId } = req.params; // Assuming memberId is the Firestore document ID (might be userId)
  const requestingUser = req.user; // From checkAuth middleware

  // Basic validation
  if (!memberId) {
    return res.status(400).send({ message: "Missing memberId parameter." });
  }
  if (!requestingUser) {
    // Should be caught by checkAuth, but double-check
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }

  const memberRef = db.collection("members").doc(memberId);

  try {
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      return res.status(404).send({ message: "Member not found." });
    }

    const memberData = memberSnap.data();

    // Permission Checks
    let canAccess = false;

    // 1. Is the requester the member themselves?
    //    Requires member doc to have a 'userId' field matching auth uid.
    if (memberData.userId && requestingUser.uid === memberData.userId) {
      canAccess = true;
    }

    // 2. Is the requester a TenantAdmin for the member's tenant?
    if (!canAccess && requestingUser.role === "TenantAdmin" &&
        memberData.tenantId && requestingUser.tenantId === memberData.tenantId) {
      canAccess = true;
    }

    // 3. Is the requester a StoreManager for the member's store?
    if (!canAccess && requestingUser.role === "StoreManager" &&
        memberData.storeId && requestingUser.storeId === memberData.storeId) {
      canAccess = true;
    }

    if (!canAccess) {
      console.warn(`Forbidden access attempt: User ${requestingUser.uid} tried to access member ${memberId}`);
      return res.status(403).send({ message: "Forbidden: You do not have permission to view this member's data." });
    }

    // TODO: Implement data filtering based on requester if needed.
    // For now, return all data if access is granted.
    const responseData = { id: memberSnap.id, ...memberData };

    res.status(200).send(responseData);
  } catch (error) {
    console.error(`Error fetching member ${memberId}:`, error);
    res.status(500).send({ message: "Failed to fetch member data.", error: error.message });
  }
};

/**
 * Handler to create a new member.
 * Permissions:
 * - TenantAdmin can create members for any store within their tenant.
 * - StoreManager can create members only for their assigned store.
 * Assumes phone number must be unique within the tenant.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.createMember = async (req, res) => {
  // Assuming body includes: name, phone, email (optional), storeId
  const { name, phone, email, storeId } = req.body;
  const requestingUser = req.user;

  // 1. Basic Validation & Permission Pre-checks
  if (!requestingUser || !requestingUser.tenantId) {
    return res.status(403).send({ message: "Forbidden: Requesting user has no tenantId." });
  }
  const tenantId = requestingUser.tenantId;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).send({ message: "Invalid or missing member name." });
  }
  if (!phone || typeof phone !== "string" || phone.trim() === "") { // Add more robust phone validation if needed
    return res.status(400).send({ message: "Invalid or missing phone number." });
  }
  if (email && typeof email !== "string") { // Email is optional
    return res.status(400).send({ message: "Invalid email format." });
  }
  if (!storeId || typeof storeId !== "string") {
    return res.status(400).send({ message: "Invalid or missing storeId." });
  }

  // 2. StoreManager Specific Permission Check
  if (requestingUser.role === "StoreManager" && requestingUser.storeId !== storeId) {
    return res.status(403).send({ message: "Forbidden: StoreManager can only create members for their assigned store." });
  }
  // Note: checkRole middleware already ensures user is TenantAdmin or StoreManager

  // 3. Data Logic Validation (e.g., Uniqueness)
  const cleanedPhone = phone.trim(); // Use a cleaned version for checks
  const membersRef = db.collection("members");

  try {
    // Check if store exists and belongs to the tenant (optional but recommended)
    const storeRef = db.collection("stores").doc(storeId); // Assuming a 'stores' collection
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists || storeSnap.data().tenantId !== tenantId) {
      // If StoreManager check passed, this implies an internal inconsistency or admin error
      console.error(`Consistency Error: Store ${storeId} not found or not in tenant ${tenantId} during member creation by ${requestingUser.uid}`);
      return res.status(400).send({ message: `Invalid storeId: Store ${storeId} not found within your tenant.` });
    }

    // Check for phone number uniqueness within the tenant
    const phoneQuery = membersRef
      .where("tenantId", "==", tenantId)
      .where("phone", "==", cleanedPhone);
    const phoneSnapshot = await phoneQuery.get();

    if (!phoneSnapshot.empty) {
      return res.status(409).send({ message: `Conflict: Phone number ${cleanedPhone} already exists for a member in this tenant.` });
    }

    // TODO: Add email uniqueness check if required by business logic

    // 4. Prepare Member Data
    const newMemberData = {
      name: name.trim(),
      phone: cleanedPhone,
      email: email ? email.trim() : null,
      storeId: storeId, // Store the member is associated with (e.g., registration store)
      tenantId: tenantId,
      userId: null, // Initially null, to be linked later if needed
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // Add other fields like membershipLevel, points, etc. later
      // createdBy: requestingUser.uid, // Optional tracking
    };

    // 5. Add Member to Firestore
    const docRef = await membersRef.add(newMemberData);
    console.log(`Successfully created member with ID: ${docRef.id}`);

    // 6. Return Success Response
    res.status(201).send({ id: docRef.id, ...newMemberData });
  } catch (error) {
    console.error("Error creating member:", error);
    // Specific check for Firestore errors vs logic errors if needed
    res.status(500).send({ message: "Failed to create member.", error: error.message });
  }
};

/**
 * Handler to get a list of members, filtered by storeId, with pagination.
 * Permissions:
 * - TenantAdmin can list members for any store within their tenant (storeId required).
 * - StoreManager can list members only for their assigned store (storeId required).
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.getMembers = async (req, res) => {
  const { storeId, page = 1, limit = 10 } = req.query;
  const requestingUser = req.user;

  // 1. Validation & Permission Checks
  if (!requestingUser || !requestingUser.tenantId) {
    return res.status(403).send({ message: "Forbidden: Requesting user context is invalid." });
  }
  const tenantId = requestingUser.tenantId;

  if (!storeId || typeof storeId !== "string") {
    return res.status(400).send({ message: "Missing or invalid storeId query parameter." });
  }

  // StoreManager specific check: Can only query their own store
  if (requestingUser.role === "StoreManager" && requestingUser.storeId !== storeId) {
    return res.status(403).send({ message: `Forbidden: StoreManager can only list members for their assigned store (${requestingUser.storeId}).` });
  }

  // TenantAdmin check: Ensure the requested storeId belongs to their tenant
  if (requestingUser.role === "TenantAdmin") {
    try {
      const storeRef = db.collection("stores").doc(storeId);
      const storeSnap = await storeRef.get();
      if (!storeSnap.exists || storeSnap.data().tenantId !== tenantId) {
        return res.status(403).send({ message: `Forbidden: Store ${storeId} does not exist or does not belong to your tenant.` });
      }
    } catch (error) {
      console.error(`Error verifying store ${storeId} for TenantAdmin ${requestingUser.uid}:`, error);
      return res.status(500).send({ message: "Error verifying store access.", error: error.message });
    }
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).send({ message: "Invalid page number." });
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) { // Limit max page size
    return res.status(400).send({ message: "Invalid limit value (must be 1-100)." });
  }

  // 2. Firestore Query
  const membersRef = db.collection("members");
  const baseQuery = membersRef
    .where("tenantId", "==", tenantId) // Ensure query is scoped to tenant
    .where("storeId", "==", storeId);

  try {
    // Get total count for pagination metadata
    const countSnapshot = await baseQuery.count().get();
    const totalMembers = countSnapshot.data().count;
    const totalPages = Math.ceil(totalMembers / limitNum);

    if (totalMembers === 0) {
      return res.status(200).send({
        members: [],
        pagination: { totalMembers: 0, currentPage: 1, totalPages: 0, limit: limitNum },
      });
    }

    if (pageNum > totalPages && totalMembers > 0) {
      return res.status(400).send({ message: `Invalid page number. Maximum page is ${totalPages}` });
    }

    // Calculate offset for basic pagination (consider startAfter for larger datasets)
    const offset = (pageNum - 1) * limitNum;

    // Query for the actual data page
    const dataQuery = baseQuery
      .orderBy("createdAt", "desc") // Sort by creation date descending
      .limit(limitNum)
      .offset(offset);

    const dataSnapshot = await dataQuery.get();
    const members = dataSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 3. Return Response
    res.status(200).send({
      members: members,
      pagination: {
        totalMembers: totalMembers,
        currentPage: pageNum,
        totalPages: totalPages,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error(`Error listing members for store ${storeId}:`, error);
    res.status(500).send({ message: "Failed to list members.", error: error.message });
  }
};

/**
 * Handler to update an existing member's details.
 * Permissions:
 * - TenantAdmin can update members within their tenant.
 * - StoreManager can update members within their assigned store.
 * Allowed fields: name, email, isActive.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.updateMember = async (req, res) => {
  const { memberId } = req.params;
  const updateData = req.body;
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!memberId) {
    return res.status(400).send({ message: "Missing memberId parameter." });
  }
  if (typeof updateData !== "object" || updateData === null || Object.keys(updateData).length === 0) {
    return res.status(400).send({ message: "Invalid or empty update data." });
  }
  if (!requestingUser) {
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }

  // 2. Filter Allowed Fields & Specific Validation
  const allowedUpdates = {};
  if (updateData.name !== undefined) {
    if (typeof updateData.name !== "string" || updateData.name.trim() === "") {
      return res.status(400).send({ message: "Invalid member name." });
    }
    allowedUpdates.name = updateData.name.trim();
  }
  if (updateData.email !== undefined) {
    // Basic email format check (consider a more robust library if needed)
    if (typeof updateData.email !== "string" || !/\S+@\S+\.\S+/.test(updateData.email)) {
      if (updateData.email !== null) { // Allow setting email to null
        return res.status(400).send({ message: "Invalid email format." });
      }
    }
    allowedUpdates.email = updateData.email ? updateData.email.trim() : null;
  }
  if (updateData.isActive !== undefined) {
    allowedUpdates.isActive = Boolean(updateData.isActive);
  }

  if (Object.keys(allowedUpdates).length === 0) {
    return res.status(400).send({ message: "No valid fields provided for update." });
  }

  const memberRef = db.collection("members").doc(memberId);

  try {
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      return res.status(404).send({ message: "Member not found." });
    }

    const memberData = memberSnap.data();

    // 3. Permission Check
    let canUpdate = false;
    if (requestingUser.role === "TenantAdmin" && requestingUser.tenantId === memberData.tenantId) {
      canUpdate = true;
    }
    if (!canUpdate && requestingUser.role === "StoreManager" && requestingUser.storeId === memberData.storeId) {
      canUpdate = true;
    }

    if (!canUpdate) {
      console.warn(`Forbidden update attempt: User ${requestingUser.uid} (role: ${requestingUser.role}) tried to update member ${memberId}`);
      return res.status(403).send({ message: "Forbidden: You do not have permission to update this member." });
    }

    // 4. Prepare Update Payload
    const payload = {
      ...allowedUpdates,
      updatedAt: FieldValue.serverTimestamp(),
      // updatedBy: requestingUser.uid // Optional tracking
    };

    // 5. Update Firestore Document
    await memberRef.update(payload);
    console.log(`Successfully updated member: ${memberId}`);

    // 6. Return Success Response (potentially the updated document)
    // const updatedDoc = await memberRef.get(); // Fetch updated data to return
    res.status(200).send({ message: "Member updated successfully.", id: memberId /* , data: updatedDoc.data() */ });
  } catch (error) {
    console.error(`Error updating member ${memberId}:`, error);
    res.status(500).send({ message: "Failed to update member.", error: error.message });
  }
};

/**
 * Handler to soft delete a member (sets isActive to false).
 * Permissions:
 * - TenantAdmin can delete members within their tenant.
 * - StoreManager can delete members within their assigned store.
 * @param {import("express").Request} req Express request object.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.deleteMember = async (req, res) => {
  const { memberId } = req.params;
  const requestingUser = req.user;

  // 1. Basic Validation
  if (!memberId) {
    return res.status(400).send({ message: "Missing memberId parameter." });
  }
  if (!requestingUser) {
    return res.status(401).send({ message: "Unauthorized: No user context." });
  }

  const memberRef = db.collection("members").doc(memberId);

  try {
    const memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      // Consider member already deleted, return success
      console.log(`Member ${memberId} not found for deletion, considered successful.`);
      return res.status(200).send({ message: "Member already deleted or not found." });
    }

    const memberData = memberSnap.data();

    // 2. Permission Check
    let canDelete = false;
    if (requestingUser.role === "TenantAdmin" && requestingUser.tenantId === memberData.tenantId) {
      canDelete = true;
    }
    if (!canDelete && requestingUser.role === "StoreManager" && requestingUser.storeId === memberData.storeId) {
      canDelete = true;
    }

    if (!canDelete) {
      console.warn(`Forbidden delete attempt: User ${requestingUser.uid} (role: ${requestingUser.role}) tried to delete member ${memberId}`);
      return res.status(403).send({ message: "Forbidden: You do not have permission to delete this member." });
    }

    // 3. Perform Soft Delete
    await memberRef.update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
      // deletedBy: requestingUser.uid // Optional tracking
    });
    console.log(`Successfully soft deleted member: ${memberId}`);

    // 4. Return success response
    res.status(200).send({ message: "Member deleted successfully (soft delete).", id: memberId });
  } catch (error) {
    console.error(`Error deleting member ${memberId}:`, error);
    res.status(500).send({ message: "Failed to delete member.", error: error.message });
  }
};

/**
 * Handler to link an authenticated user (via checkAuth) to an existing member record
 * based on matching phone number within the same tenant. Assumes req.user contains
 * uid, tenantId, and phoneNumber. Only links if the member record has userId=null.
 * @param {import("express").Request} req Express request object with user context.
 * @param {import("express").Response} res Express response object.
 * @returns {Promise<void>} A promise that resolves when the response is sent.
 */
exports.linkAuthToMember = async (req, res) => {
  const requestingUser = req.user;

  // 1. Validate User Context
  if (!requestingUser || !requestingUser.uid || !requestingUser.tenantId) {
    return res.status(401).send({ message: "Unauthorized: Invalid user context." });
  }
  if (!requestingUser.phoneNumber) {
    console.warn(`User ${requestingUser.uid} attempting to link without phone number.`);
    return res.status(400).send({ message: "Bad Request: User phone number not available for linking." });
  }

  const { uid, tenantId, phoneNumber } = requestingUser;
  const membersRef = db.collection("members");

  try {
    // 2. Find Member Record
    const memberQuery = membersRef
      .where("tenantId", "==", tenantId)
      .where("phone", "==", phoneNumber)
      .where("userId", "==", null) // Crucial: Only link unlinked members
      .limit(2); // Limit to detect duplicates

    const snapshot = await memberQuery.get();

    if (snapshot.empty) {
      console.log(`No unlinked member found for user ${uid} with phone ${phoneNumber} in tenant ${tenantId}.`);
      return res.status(404).send({ message: "Not Found: No matching unlinked member record found for your phone number." });
    }

    if (snapshot.size > 1) {
      // This indicates a data integrity issue (multiple unlinked members with the same phone in the same tenant)
      console.error(`Data Integrity Issue: Multiple unlinked members found for phone ${phoneNumber} in tenant ${tenantId}.`);
      return res.status(409).send({ message: "Conflict: Multiple potential member records found. Please contact support." });
    }

    // 3. Update the Unique Member Record
    const memberDoc = snapshot.docs[0];
    const memberId = memberDoc.id;
    const memberRef = memberDoc.ref;

    const updatePayload = {
      userId: uid, // Link the Auth UID
      isActive: true, // Activate the member upon linking
      updatedAt: FieldValue.serverTimestamp(),
      // updatedBy: uid // Optional tracking
    };

    await memberRef.update(updatePayload);
    console.log(`Successfully linked Auth user ${uid} to member ${memberId} (phone: ${phoneNumber})`);

    // 4. Return Success Response (optionally return updated member data)
    const updatedMemberSnap = await memberRef.get(); // Fetch updated data
    res.status(200).send({ id: updatedMemberSnap.id, ...updatedMemberSnap.data() });

  } catch (error) {
    console.error(`Error linking auth for user ${uid} (phone: ${phoneNumber}):`, error);
    res.status(500).send({ message: "Failed to link account due to an internal error.", error: error.message });
  }
};

