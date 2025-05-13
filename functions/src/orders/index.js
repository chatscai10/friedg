/**
 * 訂單模組 - 索引文件
 * 確保Firebase Admin正確初始化
 */

const admin = require("firebase-admin");

// 避免多次初始化Firebase應用
try {
  admin.app();
} catch (error) {
  // 如果沒有已初始化的應用實例，則在此處初始化
  admin.initializeApp();
  console.log("Firebase Admin初始化成功 (orders模組)");
}

// 導入處理程序
const { getOrders, createOrder, getOrderById, updateOrderStatus } = require("./orders.handlers");

// 導出處理程序
module.exports = {
  getOrders,
  createOrder,
  getOrderById,
  updateOrderStatus,
}; 