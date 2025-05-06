const express = require("express");
const {
  getMemberById,
  createMember,
  getMembers, // Import list handler
  updateMember, // Import update handler
  deleteMember, // Import delete handler
  // Import other handlers later
  linkAuthToMember, // Import link handler
} = require("./members.handlers");
const { checkAuth, checkRole } = require("../middleware/auth.middleware"); // Import checkRole

// eslint-disable-next-line new-cap
const router = express.Router();

// GET /api/members - Get list of members (filtered, paginated)
router.get("/", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), getMembers);

// GET /api/members/:memberId - Get specific member details
// Permissions checked within the handler
router.get("/:memberId", checkAuth, getMemberById);

// POST /api/members - Create a new member
router.post("/", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), createMember);

// PUT /api/members/:memberId - Update member details
router.put("/:memberId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), updateMember);

// DELETE /api/members/:memberId - Soft delete a member
router.delete("/:memberId", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), deleteMember);

// POST /api/members/link-auth - Link authenticated user to member record by phone
router.post("/link-auth", checkAuth, linkAuthToMember);

// Add other member routes here (DELETE)

module.exports = router;
