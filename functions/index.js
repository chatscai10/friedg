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

// 初始化 Express 應用
const app = express();

// 註冊全局中間件
// 1. 啟用所有來源的 CORS (開發環境)
app.use(cors({ origin: true }));

// 2. 加載自定義中間件 (如果有)
// 確保先加載中間件，然後再加載依賴這些中間件的路由模組
// const authMiddleware = require("./lib/middleware/auth.middleware");
// app.use(authMiddleware); // 如果需要全局使用

// 3. 導入路由模組
// 在導入前確保所有依賴都已初始化
console.log("Loading routes modules...");

// --- Auth Management ---
console.log("Loading auth routes...");
const authRoutes = require("./lib/auth/auth.routes");
app.use("/api/auth", authRoutes);

// --- Phase 1: Employee Management ---
console.log("Loading employee routes...");
const employeeRoutes = require("./lib/employees/employee.routes");
app.use("/api/employees", employeeRoutes);

// --- Store Management ---
console.log("Loading store routes...");
const storeRoutes = require("./lib/stores/store.routes");
app.use("/api/stores", storeRoutes);

// --- Role Management ---
console.log("Loading role routes...");
const roleRoutes = require("./lib/roles/roles.routes");
app.use("/api/roles", roleRoutes);

// --- Attendance Management ---
console.log("Loading attendance routes...");
const attendanceRoutes = require("./lib/attendance/attendance.routes");
app.use("/api/attendance", attendanceRoutes);

// --- Scheduling Management (New) ---
console.log("Loading scheduling routes...");
const schedulingRoutes = require("./lib/scheduling/schedule.routes");
app.use("/api/schedules", schedulingRoutes);

// --- Leave Management (New) ---
console.log("Loading leave routes...");
const leaveRoutes = require("./lib/leave/leave.routes");
app.use("/api/leaves", leaveRoutes);

// --- Phase 2: Online Ordering & Membership Core ---
console.log("Loading menu routes...");
const menuRoutes = require("./lib/menus/menu.routes");
app.use("/menus", menuRoutes);

// 加載菜單分類路由
console.log("Loading menu category routes...");
const menuCategoryRoutes = require("./lib/menus/menuCategory.routes");
app.use("/api/menu-categories", menuCategoryRoutes);

// 加載菜單項目路由
console.log("Loading menu item routes...");
const menuItemRoutes = require("./lib/menus/menuItem.routes");
app.use("/api/menu-items", menuItemRoutes);

// 加載訂單路由
console.log("Loading order routes...");
const orderRoutes = require("./lib/orders/order.routes");
app.use("/api/orders", orderRoutes);

// 加載會員路由
console.log("Loading member routes...");
const memberRoutes = require("./lib/members/members.routes");
app.use("/api/members", memberRoutes);

// 加載推薦碼路由
console.log("Loading referral routes...");
const referralRoutes = require("./lib/referrals/referral.routes");
app.use("/api/referrals", referralRoutes);

// 加載優惠券路由
console.log("Loading coupon routes...");
const couponRoutes = require("./lib/coupons/coupon.routes");
app.use("/api/coupons", couponRoutes);

// 將 Express API 作為單個 Cloud Function 導出
console.log("Initializing Firebase Cloud Function...");
exports.api = functions.https.onRequest(app);

// 注意：不再直接導出個別函數，而是通過 Express 路由統一管理 API
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
