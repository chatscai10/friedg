const express = require("express");
const {
  generateReferralCode,
  applyReferralCode,
  getMemberReferrals
} = require("./referral.handlers");
const {
  getRewardConfig,
  updateRewardConfig
} = require("./referralReward.handlers");
const { checkAuth, checkRole } = require("../middleware/auth.middleware");

// 創建路由實例
const router = express.Router();

// 會員推薦碼接口
// GET /api/referrals/my-code - 獲取或生成當前會員的推薦碼
router.get("/my-code", checkAuth, generateReferralCode);

// POST /api/referrals/apply - 應用推薦碼
router.post("/apply", checkAuth, applyReferralCode);

// GET /api/referrals - 獲取當前會員的推薦記錄
router.get("/", checkAuth, getMemberReferrals);

// 管理員獎勵配置接口
// GET /api/referrals/reward-config - 獲取租戶的推薦獎勵配置
router.get("/reward-config", checkAuth, checkRole(["TenantAdmin", "SystemAdmin"]), getRewardConfig);

// PUT /api/referrals/reward-config - 更新租戶的推薦獎勵配置
router.put("/reward-config", checkAuth, checkRole(["TenantAdmin", "SystemAdmin"]), updateRewardConfig);

module.exports = router; 