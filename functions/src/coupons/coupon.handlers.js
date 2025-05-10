const couponService = require("./coupon.service");
const z = require("zod");

// Zod schemas for validation
const validateCouponSchema = z.object({
  code: z.string().min(5).max(20),
  orderAmount: z.number().positive()
});

/**
 * 獲取會員的優惠券列表
 * @param {import("express").Request} req - Express請求對象
 * @param {import("express").Response} res - Express回應對象
 * @returns {Promise<void>}
 */
exports.getMemberCoupons = async (req, res) => {
  try {
    // 從認證信息獲取會員ID
    const user = req.user;
    if (!user || !user.memberId) {
      return res.status(403).json({
        status: "error",
        message: "未授權：缺少會員ID"
      });
    }
    
    const memberId = user.memberId;
    
    // 獲取查詢參數，默認獲取有效優惠券
    const status = req.query.status || "active";
    
    // 使用優惠券服務獲取優惠券
    const coupons = await couponService.getMemberCoupons(memberId, status);
    
    return res.status(200).json({
      status: "success",
      data: coupons
    });
  } catch (error) {
    console.error("獲取優惠券錯誤:", error);
    return res.status(500).json({
      status: "error",
      message: "服務器錯誤",
      error: error.message
    });
  }
};

/**
 * 驗證優惠券是否可用
 * @param {import("express").Request} req - Express請求對象
 * @param {import("express").Response} res - Express回應對象
 * @returns {Promise<void>}
 */
exports.validateCoupon = async (req, res) => {
  try {
    // 驗證請求
    const validationResult = validateCouponSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        message: "無效的請求數據",
        errors: validationResult.error.errors
      });
    }
    
    // 從認證信息獲取會員ID
    const user = req.user;
    if (!user || !user.memberId || !user.tenantId) {
      return res.status(403).json({
        status: "error",
        message: "未授權：缺少會員ID或租戶ID"
      });
    }
    
    const memberId = user.memberId;
    const tenantId = user.tenantId;
    const { code, orderAmount } = validationResult.data;
    
    // 使用優惠券服務驗證優惠券
    const result = await couponService.validateCoupon(code, memberId, orderAmount, tenantId);
    
    return res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    console.error("驗證優惠券錯誤:", error);
    return res.status(500).json({
      status: "error",
      message: "服務器錯誤",
      error: error.message
    });
  }
};

/**
 * 標記優惠券已使用
 * @param {import("express").Request} req - Express請求對象
 * @param {import("express").Response} res - Express回應對象
 * @returns {Promise<void>}
 */
exports.markCouponUsed = async (req, res) => {
  try {
    const { couponId, orderId } = req.body;
    
    // 基本驗證
    if (!couponId || !orderId) {
      return res.status(400).json({
        status: "error",
        message: "缺少必要參數：couponId和orderId"
      });
    }
    
    // 從認證信息獲取會員ID
    const user = req.user;
    if (!user || !user.memberId) {
      return res.status(403).json({
        status: "error",
        message: "未授權：缺少會員ID"
      });
    }
    
    // 使用優惠券服務標記優惠券已使用
    const result = await couponService.markCouponUsed(couponId, orderId);
    
    return res.status(200).json({
      status: "success",
      data: {
        success: result
      }
    });
  } catch (error) {
    console.error("標記優惠券使用錯誤:", error);
    return res.status(500).json({
      status: "error",
      message: "服務器錯誤",
      error: error.message
    });
  }
}; 