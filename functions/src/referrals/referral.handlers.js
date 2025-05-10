const admin = require("firebase-admin");
const referralService = require("./referral.service");
const z = require("zod");

// Zod schemas for validation
const referralCodeSchema = z.object({
  code: z.string().min(4).max(8)
});

/**
 * 生成會員推薦碼
 * @param {import("express").Request} req - Express請求對象
 * @param {import("express").Response} res - Express回應對象
 * @returns {Promise<void>}
 */
exports.generateReferralCode = async (req, res) => {
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
    
    // 使用推薦碼服務生成推薦碼
    const referralCode = await referralService.generateReferralCode(memberId);
    
    return res.status(200).json({
      status: "success",
      data: {
        referralCode: referralCode
      }
    });
  } catch (error) {
    console.error("生成推薦碼錯誤:", error);
    return res.status(500).json({
      status: "error",
      message: "服務器錯誤",
      error: error.message
    });
  }
};

/**
 * 會員應用推薦碼
 * @param {import("express").Request} req - Express請求對象
 * @param {import("express").Response} res - Express回應對象
 * @returns {Promise<void>}
 */
exports.applyReferralCode = async (req, res) => {
  try {
    // 驗證請求
    const validationResult = referralCodeSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        message: "無效的請求數據",
        errors: validationResult.error.errors
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
    
    const memberId = user.memberId;
    const { code } = validationResult.data;
    
    // 使用推薦碼服務應用推薦碼
    const result = await referralService.applyReferralCode(memberId, code);
    
    return res.status(200).json({
      status: "success",
      data: result
    });
  } catch (error) {
    console.error("應用推薦碼錯誤:", error);
    
    // 處理業務邏輯錯誤
    if (
      error.message.includes("您已經使用過推薦碼") ||
      error.message.includes("無效的推薦碼") ||
      error.message.includes("不能使用自己的推薦碼") ||
      error.message.includes("不能形成循環推薦關係")
    ) {
      return res.status(400).json({
        status: "error",
        message: error.message
      });
    }
    
    return res.status(500).json({
      status: "error",
      message: "服務器錯誤",
      error: error.message
    });
  }
};

/**
 * 獲取會員的推薦記錄
 * @param {import("express").Request} req - Express請求對象
 * @param {import("express").Response} res - Express回應對象
 * @returns {Promise<void>}
 */
exports.getMemberReferrals = async (req, res) => {
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
    // 獲取查詢參數，默認獲取所有推薦記錄
    const type = req.query.type || "all";
    
    // 使用推薦碼服務獲取推薦記錄
    const referrals = await referralService.getMemberReferrals(memberId, type);
    
    return res.status(200).json({
      status: "success",
      data: referrals
    });
  } catch (error) {
    console.error("獲取推薦記錄錯誤:", error);
    return res.status(500).json({
      status: "error",
      message: "服務器錯誤",
      error: error.message
    });
  }
}; 