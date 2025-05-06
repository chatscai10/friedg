const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

// Initialize Firebase Admin SDK (runs in Cloud Functions environment)
try {
  admin.initializeApp();
} catch (e) {
  console.error("Firebase Admin SDK initialization error", e);
}

const app = express();

// Enable CORS for all origins (for development)
app.use(cors({ origin: true }));

// Placeholder for future global middleware (e.g., authentication)
// app.use(authMiddleware);

// API Routes
// const menuRoutes = require("./src/menus/menu.routes"); // Reverted Phase 2 changes - Keeping this comment for clarity
const menuRoutes = require("./lib/menus/menu.routes"); // Changed from src to lib
const memberRoutes = require("./lib/members/members.routes"); // Changed from src to lib
const orderRoutes = require("./lib/orders/orders.routes"); // Changed from src to lib

// --- Phase 1: Employee Management ---
const employeeRoutes = require("./lib/employees/employee.routes"); // Changed from src to lib
app.use("/admin/employees", employeeRoutes); // Mount employee routes under /admin/employees

// --- Phase 2: Online Ordering & Membership Core ---
app.use("/menus", menuRoutes); // Mount menu routes under /menus
app.use("/members", memberRoutes); // Mount member routes under /members
app.use("/orders", orderRoutes); // Mount order routes under /orders

// Expose Express API as a single Cloud Function
exports.api = functions.https.onRequest(app);

// Import and export Order Cloud Functions
/* // Remove direct export of individual functions
const orderFunctions = require("./lib/orders");
exports.getOrders = orderFunctions.getOrders;
exports.getOrder = orderFunctions.getOrder;
exports.newOrder = orderFunctions.newOrder;
exports.updateOrderStatus = orderFunctions.updateStatus;
exports.recordPayment = orderFunctions.recordPayment;
exports.getOrderStatistics = orderFunctions.getOrderStatistics;
exports.generateOrderReceipt = orderFunctions.generateOrderReceipt;
exports.getOrderReceipt = orderFunctions.getOrderReceipt;
*/
