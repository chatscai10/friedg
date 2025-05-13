const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

// Firestore引用
const db = admin.firestore();

/**
 * 優惠券服務
 * 提供優惠券創建、驗證、應用等功能
 */
class CouponService {
  /**
   * 建立新的優惠券
   * @param {Object} couponData - 優惠券資料
   * @returns {Promise<string>} - 創建的優惠券ID
   */
  async createCoupon(couponData) {
    try {
      // 驗證必要欄位
      if (!couponData.type || !couponData.value || !couponData.memberId || !couponData.tenantId) {
        throw new Error("缺少必要欄位");
      }
      
      // 驗證優惠券類型
      if (!["percentage", "fixed"].includes(couponData.type)) {
        throw new Error("無效的優惠券類型");
      }
      
      // 驗證優惠券值
      if (couponData.type === "percentage" && (couponData.value <= 0 || couponData.value > 100)) {
        throw new Error("百分比折扣必須在1-100之間");
      }
      
      if (couponData.type === "fixed" && couponData.value <= 0) {
        throw new Error("固定金額折扣必須大於0");
      }
      
      // 計算過期時間
      const now = new Date();
      const validDays = couponData.validDays || 30; // 默認30天有效期
      const expiryDate = new Date(now);
      expiryDate.setDate(now.getDate() + validDays);
      
      // 創建優惠券記錄
      const couponRef = db.collection("coupons").doc();
      await couponRef.set({
        code: this._generateCouponCode(),
        type: couponData.type,
        value: couponData.value,
        description: couponData.description || "優惠券",
        memberId: couponData.memberId,
        tenantId: couponData.tenantId,
        storeId: couponData.storeId,
        issuedAt: FieldValue.serverTimestamp(),
        expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
        status: "active",
        usageCount: 0,
        maxUsage: couponData.maxUsage || 1, // 默認只能使用一次
        source: couponData.source || "system",
        constraints: couponData.constraints || {}, // 可設置特定約束，如最低訂單金額
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      return couponRef.id;
    } catch (error) {
      console.error("創建優惠券錯誤:", error);
      throw error;
    }
  }
  
  /**
   * 驗證優惠券是否可用
   * @param {string} couponCode - 優惠券代碼
   * @param {string} memberId - 會員ID
   * @param {number} orderAmount - 訂單金額
   * @param {string} tenantId - 租戶ID
   * @returns {Promise<Object>} - 驗證結果與優惠券資訊
   */
  async validateCoupon(couponCode, memberId, orderAmount, tenantId) {
    try {
      // 查詢優惠券
      const couponQuery = await db.collection("coupons")
        .where("code", "==", couponCode)
        .where("status", "==", "active")
        .limit(1)
        .get();
      
      if (couponQuery.empty) {
        return {
          valid: false,
          message: "優惠券無效或已過期"
        };
      }
      
      const couponDoc = couponQuery.docs[0];
      const couponData = couponDoc.data();
      
      // 檢查會員權限
      if (couponData.memberId !== memberId) {
        return {
          valid: false,
          message: "此優惠券不屬於您"
        };
      }
      
      // 檢查租戶
      if (couponData.tenantId !== tenantId) {
        return {
          valid: false,
          message: "此優惠券不適用於當前店家"
        };
      }
      
      // 檢查過期時間
      const now = new Date();
      const expiryDate = couponData.expiryDate.toDate();
      
      if (now > expiryDate) {
        // 自動更新過期優惠券狀態
        await couponDoc.ref.update({
          status: "expired",
          updatedAt: FieldValue.serverTimestamp()
        });
        
        return {
          valid: false,
          message: "優惠券已過期"
        };
      }
      
      // 檢查使用次數
      if (couponData.usageCount >= couponData.maxUsage) {
        return {
          valid: false,
          message: "優惠券已達到最大使用次數"
        };
      }
      
      // 檢查最低訂單金額約束
      if (couponData.constraints && couponData.constraints.minOrderAmount && orderAmount < couponData.constraints.minOrderAmount) {
        return {
          valid: false,
          message: `訂單金額需滿 ${couponData.constraints.minOrderAmount} 元才能使用此優惠券`
        };
      }
      
      // 計算折扣金額
      let discountAmount = 0;
      
      if (couponData.type === "percentage") {
        discountAmount = (orderAmount * couponData.value) / 100;
      } else if (couponData.type === "fixed") {
        discountAmount = Math.min(couponData.value, orderAmount); // 折扣金額不能超過訂單金額
      }
      
      // 檢查最大折扣約束
      if (couponData.constraints && couponData.constraints.maxDiscountAmount && discountAmount > couponData.constraints.maxDiscountAmount) {
        discountAmount = couponData.constraints.maxDiscountAmount;
      }
      
      return {
        valid: true,
        couponId: couponDoc.id,
        couponData: {
          ...couponData,
          expiryDate: expiryDate.toISOString(),
          issuedAt: couponData.issuedAt ? couponData.issuedAt.toDate().toISOString() : null,
          createdAt: couponData.createdAt ? couponData.createdAt.toDate().toISOString() : null,
          updatedAt: couponData.updatedAt ? couponData.updatedAt.toDate().toISOString() : null
        },
        discountAmount: discountAmount,
        finalAmount: orderAmount - discountAmount
      };
    } catch (error) {
      console.error("驗證優惠券錯誤:", error);
      throw error;
    }
  }
  
  /**
   * 標記優惠券已使用
   * @param {string} couponId - 優惠券ID
   * @param {string} orderId - 使用優惠券的訂單ID
   * @returns {Promise<boolean>} - 標記結果
   */
  async markCouponUsed(couponId, orderId) {
    try {
      const couponRef = db.collection("coupons").doc(couponId);
      const couponDoc = await couponRef.get();
      
      if (!couponDoc.exists) {
        throw new Error("優惠券不存在");
      }
      
      const couponData = couponDoc.data();
      
      // 如果已達到最大使用次數，則標記為已使用
      const newUsageCount = couponData.usageCount + 1;
      const newStatus = newUsageCount >= couponData.maxUsage ? "used" : "active";
      
      // 更新優惠券
      await couponRef.update({
        usageCount: newUsageCount,
        status: newStatus,
        lastUsedAt: FieldValue.serverTimestamp(),
        lastOrderId: orderId,
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // 創建使用記錄
      const usageRef = db.collection("couponUsages").doc();
      await usageRef.set({
        couponId: couponId,
        orderId: orderId,
        memberId: couponData.memberId,
        tenantId: couponData.tenantId,
        storeId: couponData.storeId,
        usedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error("標記優惠券使用錯誤:", error);
      throw error;
    }
  }
  
  /**
   * 獲取會員的優惠券列表
   * @param {string} memberId - 會員ID
   * @param {string} status - 優惠券狀態 (active, used, expired, all)
   * @returns {Promise<Array>} - 優惠券列表
   */
  async getMemberCoupons(memberId, status = "active") {
    try {
      let query = db.collection("coupons")
        .where("memberId", "==", memberId);
      
      if (status !== "all") {
        query = query.where("status", "==", status);
      }
      
      const snapshot = await query.orderBy("createdAt", "desc").get();
      
      // 轉換時間戳為ISO字符串
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          expiryDate: data.expiryDate ? data.expiryDate.toDate().toISOString() : null,
          issuedAt: data.issuedAt ? data.issuedAt.toDate().toISOString() : null,
          lastUsedAt: data.lastUsedAt ? data.lastUsedAt.toDate().toISOString() : null,
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null
        };
      });
    } catch (error) {
      console.error("獲取會員優惠券錯誤:", error);
      throw error;
    }
  }
  
  /**
   * 生成優惠券代碼
   * @private
   * @returns {string} - 優惠券代碼
   */
  _generateCouponCode() {
    // 生成10位英數字混合優惠券代碼
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codeLength = 10;
    let code = '';
    
    const bytes = crypto.randomBytes(codeLength);
    for (let i = 0; i < codeLength; i++) {
      const index = bytes[i] % characters.length;
      code += characters.charAt(index);
    }
    
    return code;
  }
}

module.exports = new CouponService(); 