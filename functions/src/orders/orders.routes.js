const express = require("express");
const { checkAuth, checkRole } = require("../middleware/auth.middleware");
const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  recordPayment,
  getOrderStatistics,
  generateOrderReceipt,
  getOrderReceipt,
} = require("./orders.handlers");

// eslint-disable-next-line new-cap
const router = express.Router();

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: 獲取訂單列表
 *     description: 根據查詢參數獲取符合條件的訂單列表
 *     tags: [Orders]
 *     parameters:
 *       - name: storeId
 *         in: query
 *         description: 店鋪ID
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         description: 訂單狀態
 *         schema:
 *           type: string
 *           enum: [pending, preparing, ready, completed, cancelled]
 *       - name: page
 *         in: query
 *         description: 頁碼
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: 每頁記錄數
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: 成功獲取訂單列表
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權訪問
 *       403:
 *         description: 權限不足
 */
router.get("/", checkAuth, getOrders);

/**
 * @swagger
 * /orders/{orderId}:
 *   get:
 *     summary: 獲取特定訂單詳情
 *     description: 根據訂單ID獲取完整的訂單詳情
 *     tags: [Orders]
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         description: 訂單ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功獲取訂單詳情
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權訪問
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 訂單不存在
 */
router.get("/:orderId", checkAuth, getOrderById);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: 創建新訂單
 *     description: 創建一個新的訂單，包含訂單項目、顧客資訊等
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - storeId
 *               - items
 *     responses:
 *       201:
 *         description: 訂單創建成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權訪問
 *       403:
 *         description: 權限不足
 *       409:
 *         description: 資源衝突，如庫存不足或無法處理
 */
router.post("/", checkAuth, createOrder);

/**
 * @swagger
 * /orders/{orderId}/status:
 *   put:
 *     summary: 更新訂單狀態
 *     description: 更新指定訂單的狀態，如從待處理改為準備中等
 *     tags: [Orders]
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         description: 訂單ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, preparing, ready, completed, cancelled]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: 訂單狀態更新成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權訪問
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 訂單不存在
 *       422:
 *         description: 無法處理的狀態變更
 */
router.put("/:orderId/status", checkAuth, checkRole(["TenantAdmin", "StoreManager", "admin"]), updateOrderStatus);

/**
 * @swagger
 * /orders/{orderId}/payment:
 *   post:
 *     summary: 記錄訂單支付
 *     description: 為指定訂單記錄支付資訊
 *     tags: [Orders]
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         description: 訂單ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *               - amount
 *     responses:
 *       200:
 *         description: 支付記錄成功
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權訪問
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 訂單不存在
 *       409:
 *         description: 訂單已支付或處於無法支付的狀態
 */
router.post("/:orderId/payment", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), recordPayment);

/**
 * @swagger
 * /orders/stats:
 *   get:
 *     summary: 獲取訂單統計數據
 *     description: 根據時間範圍等參數獲取訂單相關統計數據
 *     tags: [Orders]
 *     parameters:
 *       - name: storeId
 *         in: query
 *         description: 店鋪ID
 *         schema:
 *           type: string
 *       - name: from
 *         in: query
 *         description: 起始日期（ISO 8601格式）
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: to
 *         in: query
 *         description: 結束日期（ISO 8601格式）
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: groupBy
 *         in: query
 *         description: 統計分組方式
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: 成功獲取統計資料
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權訪問
 *       403:
 *         description: 權限不足
 */
router.get("/stats", checkAuth, checkRole(["TenantAdmin", "StoreManager"]), getOrderStatistics);

/**
 * @swagger
 * /orders/{orderId}/receipt/generate:
 *   post:
 *     summary: 產生訂單收據
 *     description: 為指定訂單產生（或重新產生）收據
 *     tags: [Orders]
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         description: 訂單ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 收據產生請求已接受
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權訪問
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 訂單不存在
 */
router.post("/:orderId/receipt/generate", checkAuth, checkRole(["TenantAdmin", "StoreManager", "admin"]), generateOrderReceipt);

/**
 * @swagger
 * /orders/{orderId}/receipt:
 *   get:
 *     summary: 獲取訂單收據
 *     description: 獲取指定訂單的收據內容或連結
 *     tags: [Orders]
 *     parameters:
 *       - name: orderId
 *         in: path
 *         required: true
 *         description: 訂單ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功獲取收據
 *       400:
 *         description: 請求參數錯誤
 *       401:
 *         description: 未授權訪問
 *       403:
 *         description: 權限不足
 *       404:
 *         description: 訂單或收據不存在
 */
router.get("/:orderId/receipt", checkAuth, checkRole(["TenantAdmin", "StoreManager", "admin"]), getOrderReceipt);

module.exports = router;