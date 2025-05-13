const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

// Firestore引用
const db = admin.firestore();

/**
 * 推薦碼服務
 * 提供推薦碼生成、驗證、應用等功能
 */
class ReferralService {
  /**
   * 為會員生成推薦碼
   * @param {string} memberId - 會員ID
   * @returns {Promise<string>} - 生成的推薦碼
   */
  async generateReferralCode(memberId) {
    try {
      // 查詢會員是否存在
      const memberRef = db.collection("members").doc(memberId);
      const memberDoc = await memberRef.get();
      
      if (!memberDoc.exists) {
        throw new Error(`會員 ${memberId} 不存在`);
      }
      
      // 如果會員已有推薦碼，則直接返回
      const memberData = memberDoc.data();
      if (memberData.referralCode) {
        return memberData.referralCode;
      }
      
      // 生成唯一推薦碼
      let referralCode = this._generateUniqueCode();
      let isUnique = false;
      let attempts = 0;
      
      // 確保推薦碼唯一性
      while (!isUnique && attempts < 5) {
        const existingDoc = await db.collection("members")
          .where("referralCode", "==", referralCode)
          .limit(1)
          .get();
          
        if (existingDoc.empty) {
          isUnique = true;
        } else {
          referralCode = this._generateUniqueCode();
          attempts++;
        }
      }
      
      if (!isUnique) {
        throw new Error("無法生成唯一推薦碼，請稍後再試");
      }
      
      // 更新會員記錄
      await memberRef.update({
        referralCode: referralCode,
        updatedAt: FieldValue.serverTimestamp()
      });
      
      return referralCode;
    } catch (error) {
      console.error("生成推薦碼錯誤:", error);
      throw error;
    }
  }
  
  /**
   * 應用推薦碼 (會員A使用會員B的推薦碼)
   * @param {string} memberId - 使用推薦碼的會員ID
   * @param {string} referralCode - 要使用的推薦碼
   * @returns {Promise<Object>} - 操作結果
   */
  async applyReferralCode(memberId, referralCode) {
    const batch = db.batch();
    
    try {
      // 查詢會員記錄
      const memberRef = db.collection("members").doc(memberId);
      const memberDoc = await memberRef.get();
      
      if (!memberDoc.exists) {
        throw new Error("會員不存在");
      }
      
      const memberData = memberDoc.data();
      
      // 檢查會員是否已經有推薦關係
      if (memberData.referredBy) {
        throw new Error("您已經使用過推薦碼，不能重複使用");
      }
      
      // 檢查是否是新會員 (註冊時間需要在過去30天內)
      if (memberData.createdAt) {
        const registrationDate = memberData.createdAt.toDate();
        const now = new Date();
        const daysSinceRegistration = Math.floor((now - registrationDate) / (1000 * 60 * 60 * 24));
        
        // 如果註冊超過30天，不能使用推薦碼
        if (daysSinceRegistration > 30) {
          throw new Error("推薦碼只能在註冊後30天內使用");
        }
      }
      
      // 查詢推薦碼所屬的會員
      const referrerQuery = await db.collection("members")
        .where("referralCode", "==", referralCode)
        .limit(1)
        .get();
        
      if (referrerQuery.empty) {
        throw new Error("無效的推薦碼");
      }
      
      const referrerDoc = referrerQuery.docs[0];
      const referrerId = referrerDoc.id;
      const referrerData = referrerDoc.data();
      
      // 防止自我推薦
      if (referrerId === memberId) {
        throw new Error("不能使用自己的推薦碼");
      }
      
      // 防止循環推薦
      if (await this._isCircularReferral(referrerId, memberId)) {
        throw new Error("不能形成循環推薦關係");
      }
      
      // 檢查推薦人是否達到限制
      if (referrerData.referralCount >= 50) { // 設定合理的上限
        throw new Error("推薦人已達到推薦上限");
      }
      
      // 更新被推薦會員信息
      batch.update(memberRef, {
        referredBy: referrerId,
        referredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // 更新推薦人統計
      const referrerRef = db.collection("members").doc(referrerId);
      batch.update(referrerRef, {
        referralCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // 創建推薦記錄
      const referralRecordRef = db.collection("referralRecords").doc();
      batch.set(referralRecordRef, {
        referrerId: referrerId,
        refereeId: memberId,
        referralCode: referralCode,
        status: "pending", // 初始為待處理狀態
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        // 待處理: 可能需要達成條件後才發放獎勵
        rewardStatus: "pending", 
        tenantId: memberData.tenantId,
        storeId: memberData.storeId
      });
      
      // 執行批次操作
      await batch.commit();
      
      // 處理獎勵發放（可以立即發放或設置條件觸發）
      await this._processReferralReward(referralRecordRef.id);
      
      return {
        success: true,
        referrerId: referrerId,
        referralRecordId: referralRecordRef.id
      };
    } catch (error) {
      console.error("應用推薦碼錯誤:", error);
      throw error;
    }
  }
  
  /**
   * 獲取會員的推薦記錄
   * @param {string} memberId - 會員ID
   * @param {string} type - 記錄類型 (referrer: 推薦人, referee: 被推薦人, all: 全部)
   * @returns {Promise<Array>} - 推薦記錄列表
   */
  async getMemberReferrals(memberId, type = "all") {
    try {
      let query;
      
      if (type === "referrer" || type === "all") {
        // 獲取作為推薦人的記錄
        const asReferrerQuery = db.collection("referralRecords")
          .where("referrerId", "==", memberId)
          .orderBy("createdAt", "desc");
          
        const asReferrerDocs = await asReferrerQuery.get();
        const asReferrerRecords = asReferrerDocs.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: "referrer",
          createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toISOString() : null,
          updatedAt: doc.data().updatedAt ? doc.data().updatedAt.toDate().toISOString() : null
        }));
        
        if (type === "referrer") {
          return asReferrerRecords;
        }
        
        // 獲取作為被推薦人的記錄
        const asRefereeQuery = db.collection("referralRecords")
          .where("refereeId", "==", memberId)
          .orderBy("createdAt", "desc");
          
        const asRefereeDocs = await asRefereeQuery.get();
        const asRefereeRecords = asRefereeDocs.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: "referee",
          createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toISOString() : null,
          updatedAt: doc.data().updatedAt ? doc.data().updatedAt.toDate().toISOString() : null
        }));
        
        // 合併兩種記錄並按時間排序
        return [...asReferrerRecords, ...asRefereeRecords]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else if (type === "referee") {
        // 僅獲取作為被推薦人的記錄
        const asRefereeQuery = db.collection("referralRecords")
          .where("refereeId", "==", memberId)
          .orderBy("createdAt", "desc");
          
        const asRefereeDocs = await asRefereeQuery.get();
        return asRefereeDocs.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: "referee",
          createdAt: doc.data().createdAt ? doc.data().createdAt.toDate().toISOString() : null,
          updatedAt: doc.data().updatedAt ? doc.data().updatedAt.toDate().toISOString() : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error("獲取推薦記錄錯誤:", error);
      throw error;
    }
  }
  
  /**
   * 生成隨機推薦碼（6位英數字混合）
   * @private
   * @returns {string} - 生成的隨機碼
   */
  _generateUniqueCode() {
    // 生成8位英數字混合推薦碼
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符 O, 0, 1, I
    const codeLength = 6;
    let code = '';
    
    const bytes = crypto.randomBytes(codeLength);
    for (let i = 0; i < codeLength; i++) {
      const index = bytes[i] % characters.length;
      code += characters.charAt(index);
    }
    
    return code;
  }
  
  /**
   * 檢查是否形成循環推薦關係
   * @private
   * @param {string} referrerId - 推薦人ID
   * @param {string} refereeId - 被推薦人ID
   * @returns {Promise<boolean>} - 是否形成循環
   */
  async _isCircularReferral(referrerId, refereeId) {
    // 檢查是否會形成循環推薦關係
    let currentId = referrerId;
    const visited = new Set();
    
    while (currentId) {
      if (visited.has(currentId)) {
        return true; // 檢測到循環
      }
      
      if (currentId === refereeId) {
        return true; // 這將形成循環
      }
      
      visited.add(currentId);
      
      // 獲取當前會員的推薦人
      const currentMemberRef = db.collection("members").doc(currentId);
      const currentMemberDoc = await currentMemberRef.get();
      
      if (!currentMemberDoc.exists || !currentMemberDoc.data().referredBy) {
        break; // 沒有推薦人，終止檢查
      }
      
      currentId = currentMemberDoc.data().referredBy;
    }
    
    return false;
  }
  
  /**
   * 處理推薦獎勵
   * @private
   * @param {string} referralRecordId - 推薦記錄ID
   * @returns {Promise<void>}
   */
  async _processReferralReward(referralRecordId) {
    try {
      // 獲取推薦記錄
      const recordRef = db.collection("referralRecords").doc(referralRecordId);
      const recordDoc = await recordRef.get();
      
      if (!recordDoc.exists) {
        throw new Error("推薦記錄不存在");
      }
      
      const recordData = recordDoc.data();
      
      // 檢查記錄狀態
      if (recordData.status !== "pending") {
        return; // 已處理，不需再處理
      }
      
      // 標記記錄為已處理
      await recordRef.update({
        status: "processed",
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // 獲取當前獎勵配置
      const rewardConfigQuery = await db.collection("referralRewardConfigs")
        .where("tenantId", "==", recordData.tenantId)
        .where("isActive", "==", true)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
        
      if (rewardConfigQuery.empty) {
        console.log("沒有找到活躍的推薦獎勵配置");
        return;
      }
      
      const rewardConfig = rewardConfigQuery.docs[0].data();
      
      // 為推薦人創建優惠券
      if (rewardConfig.referrerReward) {
        await this._createCouponForMember(
          recordData.referrerId, 
          rewardConfig.referrerReward.type,
          rewardConfig.referrerReward.value,
          rewardConfig.referrerReward.validDays || 30,
          `推薦新會員獎勵`,
          recordData.tenantId,
          recordData.storeId
        );
      }
      
      // 為被推薦人創建優惠券
      if (rewardConfig.refereeReward) {
        await this._createCouponForMember(
          recordData.refereeId, 
          rewardConfig.refereeReward.type,
          rewardConfig.refereeReward.value,
          rewardConfig.refereeReward.validDays || 30,
          `新會員推薦獎勵`,
          recordData.tenantId,
          recordData.storeId
        );
      }
      
      // 更新獎勵狀態
      await recordRef.update({
        rewardStatus: "issued",
        rewardIssuedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      
    } catch (error) {
      console.error("處理推薦獎勵錯誤:", error);
      throw error;
    }
  }
  
  /**
   * 為會員創建優惠券
   * @private
   * @param {string} memberId - 會員ID
   * @param {string} type - 優惠券類型 ('percentage', 'fixed')
   * @param {number} value - 優惠券值 (百分比或固定金額)
   * @param {number} validDays - 優惠券有效天數
   * @param {string} description - 優惠券描述
   * @param {string} tenantId - 租戶ID
   * @param {string} storeId - 店鋪ID
   * @returns {Promise<string>} - 創建的優惠券ID
   */
  async _createCouponForMember(memberId, type, value, validDays, description, tenantId, storeId) {
    try {
      // 計算過期時間
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setDate(now.getDate() + validDays);
      
      // 創建優惠券記錄
      const couponRef = db.collection("coupons").doc();
      await couponRef.set({
        code: this._generateCouponCode(),
        type: type,
        value: value,
        description: description,
        memberId: memberId,
        tenantId: tenantId,
        storeId: storeId,
        issuedAt: FieldValue.serverTimestamp(),
        expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
        status: "active",
        usageCount: 0,
        maxUsage: 1, // 默認只能使用一次
        source: "referral", // 來源是推薦系統
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

module.exports = new ReferralService(); 