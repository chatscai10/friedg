const express = require("express");
const {
  getMemberCoupons,
  validateCoupon,
  markCouponUsed
} = require("./coupon.handlers");
const { checkAuth } = require("../middleware/auth.middleware");

// 創建路由實例
const router = express.Router();

// GET /api/coupons - 獲取當前會員的優惠券列表
router.get("/", checkAuth, getMemberCoupons);

// POST /api/coupons/validate - 驗證優惠券是否可用
router.post("/validate", checkAuth, validateCoupon);

// POST /api/coupons/mark-used - 標記優惠券已使用
router.post("/mark-used", checkAuth, markCouponUsed);

module.exports = router; 