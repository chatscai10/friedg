const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const z = require("zod");

// Firestore引用
const db = admin.firestore();

// Zod schema for reward configuration validation
const rewardSchema = z.object({
  type: z.enum(["percentage", "fixed"]),
  value: z.number().positive(),
  validDays: z.number().int().positive().optional()
});

const rewardConfigSchema = z.object({
  tenantId: z.string().min(1),
  referrerReward: rewardSchema,
  refereeReward: rewardSchema,
  description: z.string().optional(),
  isActive: z.boolean().default(true)
});

/**
 * 獲取租戶的推薦獎勵配置
 * @param {import("express").Request} req - Express請求對象
 * @param {import("express").Response} res - Express回應對象
 * @returns {Promise<void>}
 */
exports.getRewardConfig = async (req, res) => {
  try {
    const user = req.user;
    
    // 驗證權限（需要租戶管理員或更高權限）
    if (!user || !user.tenantId || (user.role !== "TenantAdmin" && user.role !== "SystemAdmin")) {
      return res.status(403).json({
        status: "error",
        message: "未授權：需要租戶管理員或系統管理員權限"
      });
    }
    
    const tenantId = user.tenantId;
    
    // 查詢獎勵配置
    const rewardConfigQuery = await db.collection("referralRewardConfigs")
      .where("tenantId", "==", tenantId)
      .where("isActive", "==", true)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
      
    if (rewardConfigQuery.empty) {
      // 如果沒有配置，返回默認配置
      return res.status(200).json({
        status: "success",
        data: {
          default: true,
          tenantId: tenantId,
          referrerReward: {
            type: "percentage",
            value: 10,
            validDays: 30
          },
          refereeReward: {
            type: "fixed",
            value: 100,
            validDays: 30
          },
          description: "默認推薦獎勵配置",
          isActive: true
        }
      });
    }
    
    // 返回最新配置
    const configDoc = rewardConfigQuery.docs[0];
    const configData = configDoc.data();
    
    return res.status(200).json({
      status: "success",
      data: {
        id: configDoc.id,
        ...configData,
        createdAt: configData.createdAt ? configData.createdAt.toDate().toISOString() : null,
        updatedAt: configData.updatedAt ? configData.updatedAt.toDate().toISOString() : null
      }
    });
  } catch (error) {
    console.error("獲取推薦獎勵配置錯誤:", error);
    return res.status(500).json({
      status: "error",
      message: "服務器錯誤",
      error: error.message
    });
  }
};

/**
 * 更新租戶的推薦獎勵配置
 * @param {import("express").Request} req - Express請求對象
 * @param {import("express").Response} res - Express回應對象
 * @returns {Promise<void>}
 */
exports.updateRewardConfig = async (req, res) => {
  try {
    const user = req.user;
    
    // 驗證權限（需要租戶管理員或更高權限）
    if (!user || !user.tenantId || (user.role !== "TenantAdmin" && user.role !== "SystemAdmin")) {
      return res.status(403).json({
        status: "error",
        message: "未授權：需要租戶管理員或系統管理員權限"
      });
    }
    
    // 驗證請求數據
    const validationResult = rewardConfigSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        message: "無效的請求數據",
        errors: validationResult.error.errors
      });
    }
    
    const configData = validationResult.data;
    const tenantId = user.tenantId;
    
    // 確保tenantId與用戶一致
    if (configData.tenantId !== tenantId) {
      return res.status(403).json({
        status: "error",
        message: "未授權：不能為其他租戶設置獎勵配置"
      });
    }
    
    // 禁用舊的配置
    const oldConfigsQuery = await db.collection("referralRewardConfigs")
      .where("tenantId", "==", tenantId)
      .where("isActive", "==", true)
      .get();
      
    const batch = db.batch();
    
    oldConfigsQuery.docs.forEach(doc => {
      batch.update(doc.ref, {
        isActive: false,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    
    // 創建新配置
    const newConfigRef = db.collection("referralRewardConfigs").doc();
    batch.set(newConfigRef, {
      ...configData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: user.uid
    });
    
    // 執行批次操作
    await batch.commit();
    
    return res.status(200).json({
      status: "success",
      message: "推薦獎勵配置更新成功",
      data: {
        id: newConfigRef.id,
        ...configData
      }
    });
  } catch (error) {
    console.error("更新推薦獎勵配置錯誤:", error);
    return res.status(500).json({
      status: "error",
      message: "服務器錯誤",
      error: error.message
    });
  }
}; 