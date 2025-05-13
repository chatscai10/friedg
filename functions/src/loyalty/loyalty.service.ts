import * as admin from 'firebase-admin';
import { LoyaltyPointTransaction, LoyaltyReward, LoyaltyTierRule, PointRedemption } from './loyalty.types';

const db = admin.firestore();

/**
 * 忠誠度計劃服務
 */
export class LoyaltyService {
  /**
   * === 會員等級規則管理 ===
   */

  /**
   * 創建會員等級規則
   * @param data 等級規則數據
   * @returns 創建的等級ID
   */
  async createTierRule(data: Omit<LoyaltyTierRule, 'tierId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // 驗證必要欄位
      if (!data.tenantId || !data.name || !data.level || data.pointsThreshold === undefined || data.pointsMultiplier === undefined) {
        throw new Error('缺少必要欄位');
      }

      // 創建等級規則記錄
      const ruleRef = db.collection('loyaltyTierRules').doc();
      await ruleRef.set({
        ...data,
        tierId: ruleRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return ruleRef.id;
    } catch (error) {
      console.error('創建會員等級規則錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新會員等級規則
   * @param tierId 等級ID
   * @param data 更新的數據
   * @returns 是否更新成功
   */
  async updateTierRule(tierId: string, data: Partial<LoyaltyTierRule>): Promise<boolean> {
    try {
      // 不允許更新的欄位
      const forbiddenUpdates = ['tierId', 'tenantId', 'createdAt', 'createdBy'];
      
      // 過濾掉不允許更新的欄位
      const updateData: Record<string, any> = Object.entries(data)
        .filter(([key]) => !forbiddenUpdates.includes(key))
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
      
      // 添加更新時間戳
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      
      // 更新等級規則
      await db.collection('loyaltyTierRules').doc(tierId).update(updateData);
      
      return true;
    } catch (error) {
      console.error('更新會員等級規則錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取會員等級規則
   * @param tierId 等級ID
   * @returns 等級規則數據
   */
  async getTierRule(tierId: string): Promise<LoyaltyTierRule | null> {
    try {
      const doc = await db.collection('loyaltyTierRules').doc(tierId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return doc.data() as LoyaltyTierRule;
    } catch (error) {
      console.error('獲取會員等級規則錯誤:', error);
      throw error;
    }
  }

  /**
   * 列出租戶的所有會員等級規則
   * @param tenantId 租戶ID
   * @param onlyActive 是否只返回啟用的規則
   * @returns 等級規則列表
   */
  async listTierRules(tenantId: string, onlyActive = false): Promise<LoyaltyTierRule[]> {
    try {
      let query = db.collection('loyaltyTierRules').where('tenantId', '==', tenantId);
      
      if (onlyActive) {
        query = query.where('isActive', '==', true);
      }
      
      // 按等級排序
      const snapshot = await query.orderBy('level').get();
      
      return snapshot.docs.map(doc => doc.data() as LoyaltyTierRule);
    } catch (error) {
      console.error('列出會員等級規則錯誤:', error);
      throw error;
    }
  }

  /**
   * === 獎勵管理 ===
   */

  /**
   * 創建獎勵
   * @param data 獎勵數據
   * @returns 創建的獎勵ID
   */
  async createReward(data: Omit<LoyaltyReward, 'rewardId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // 驗證必要欄位
      if (!data.tenantId || !data.name || !data.type || data.pointsCost === undefined || data.value === undefined) {
        throw new Error('缺少必要欄位');
      }

      // 創建獎勵記錄
      const rewardRef = db.collection('loyaltyRewards').doc();
      await rewardRef.set({
        ...data,
        rewardId: rewardRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return rewardRef.id;
    } catch (error) {
      console.error('創建獎勵錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新獎勵
   * @param rewardId 獎勵ID
   * @param data 更新的數據
   * @returns 是否更新成功
   */
  async updateReward(rewardId: string, data: Partial<LoyaltyReward>): Promise<boolean> {
    try {
      // 不允許更新的欄位
      const forbiddenUpdates = ['rewardId', 'tenantId', 'createdAt', 'createdBy'];
      
      // 過濾掉不允許更新的欄位
      const updateData: Record<string, any> = Object.entries(data)
        .filter(([key]) => !forbiddenUpdates.includes(key))
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
      
      // 添加更新時間戳
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      
      // 更新獎勵
      await db.collection('loyaltyRewards').doc(rewardId).update(updateData);
      
      return true;
    } catch (error) {
      console.error('更新獎勵錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取獎勵
   * @param rewardId 獎勵ID
   * @returns 獎勵數據
   */
  async getReward(rewardId: string): Promise<LoyaltyReward | null> {
    try {
      const doc = await db.collection('loyaltyRewards').doc(rewardId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return doc.data() as LoyaltyReward;
    } catch (error) {
      console.error('獲取獎勵錯誤:', error);
      throw error;
    }
  }

  /**
   * 列出租戶的所有獎勵
   * @param tenantId 租戶ID
   * @param onlyActive 是否只返回啟用的獎勵
   * @returns 獎勵列表
   */
  async listRewards(tenantId: string, onlyActive = false): Promise<LoyaltyReward[]> {
    try {
      let query = db.collection('loyaltyRewards').where('tenantId', '==', tenantId);
      
      if (onlyActive) {
        query = query.where('isActive', '==', true);
      }
      
      // 按點數成本排序
      const snapshot = await query.orderBy('pointsCost').get();
      
      return snapshot.docs.map(doc => doc.data() as LoyaltyReward);
    } catch (error) {
      console.error('列出獎勵錯誤:', error);
      throw error;
    }
  }

  /**
   * === 積分與等級操作 ===
   */

  /**
   * 調整用戶積分
   * @param userId 用戶ID
   * @param tenantId 租戶ID
   * @param points 積分數量 (正數為增加，負數為扣除)
   * @param type 交易類型
   * @param source 積分來源
   * @param sourceId 來源ID
   * @param description 描述
   * @param operatedBy 操作者ID
   * @returns 創建的積分交易記錄
   */
  async adjustPoints(
    userId: string,
    tenantId: string,
    points: number,
    type: LoyaltyPointTransaction['type'],
    source: LoyaltyPointTransaction['source'],
    sourceId?: string,
    description?: string,
    operatedBy?: string
  ): Promise<LoyaltyPointTransaction> {
    // 使用事務確保數據一致性
    return await db.runTransaction(async (transaction) => {
      // 1. 獲取用戶當前積分
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('用戶不存在');
      }
      
      const userData = userDoc.data() as any;
      
      // 2. 計算新的積分餘額
      const currentPoints = userData.membershipPoints || 0;
      const lifetimePoints = userData.lifetimePoints || 0;
      
      // 如果是扣除積分，檢查餘額是否足夠
      if (points < 0 && currentPoints < Math.abs(points)) {
        throw new Error('積分餘額不足');
      }
      
      const newBalance = currentPoints + points;
      
      // 如果是增加積分，更新歷史累計總積分
      const newLifetimePoints = points > 0 ? lifetimePoints + points : lifetimePoints;
      
      // 3. 創建積分交易記錄
      const transactionRef = db.collection('loyaltyPointTransactions').doc();
      const transactionData: LoyaltyPointTransaction = {
        transactionId: transactionRef.id,
        memberId: userId,
        tenantId,
        amount: points,
        balance: newBalance,
        type,
        source,
        sourceId,
        description: description || `積分${points > 0 ? '增加' : '扣除'}: ${Math.abs(points)}`,
        operatedBy,
        createdAt: admin.firestore.Timestamp.now(),
      };
      
      transaction.set(transactionRef, transactionData);
      
      // 4. 更新用戶積分
      transaction.update(userRef, {
        membershipPoints: newBalance,
        lifetimePoints: newLifetimePoints,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return transactionData;
    });
  }

  /**
   * 評估並更新用戶等級
   * @param userId 用戶ID
   * @param tenantId 租戶ID
   * @returns 等級評估結果
   */
  async evaluateAndUpdateTier(userId: string, tenantId: string): Promise<{ 
    previousTier: string, 
    newTier: string, 
    isUpgrade: boolean 
  }> {
    // 使用事務確保數據一致性
    return await db.runTransaction(async (transaction) => {
      // 1. 獲取用戶資料
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('用戶不存在');
      }
      
      const userData = userDoc.data() as any;
      const lifetimePoints = userData.lifetimePoints || 0;
      const currentTier = userData.membershipTier || '';
      
      // 2. 獲取該租戶的所有等級規則
      const tierRulesSnapshot = await db.collection('loyaltyTierRules')
        .where('tenantId', '==', tenantId)
        .where('isActive', '==', true)
        .orderBy('pointsThreshold', 'desc') // 從高到低排序
        .get();
      
      if (tierRulesSnapshot.empty) {
        throw new Error('租戶沒有定義等級規則');
      }
      
      const tierRules = tierRulesSnapshot.docs.map(doc => doc.data() as LoyaltyTierRule);
      
      // 3. 根據積分確定新等級
      let newTierRule = tierRules[tierRules.length - 1]; // 默認為最低等級
      
      for (const rule of tierRules) {
        if (lifetimePoints >= rule.pointsThreshold) {
          newTierRule = rule;
          break;
        }
      }
      
      const newTier = newTierRule.name;
      const isUpgrade = currentTier !== newTier;
      
      // 4. 計算下一等級所需的積分
      let pointsToNextTier = 0;
      let nextTierName = '';
      
      // 找到比當前新等級高一級的等級
      const currentTierIndex = tierRules.findIndex(r => r.name === newTier);
      if (currentTierIndex > 0) { // 不是最高等級
        const nextTierRule = tierRules[currentTierIndex - 1];
        pointsToNextTier = nextTierRule.pointsThreshold - lifetimePoints;
        nextTierName = nextTierRule.name;
      }
      
      // 5. 計算等級有效期
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setDate(now.getDate() + newTierRule.validityPeriod);
      
      // 6. 更新用戶等級信息
      transaction.update(userRef, {
        membershipTier: newTier,
        tierQualificationDate: admin.firestore.FieldValue.serverTimestamp(),
        tierExpiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
        pointsToNextTier: pointsToNextTier,
        nextTierName: nextTierName || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return {
        previousTier: currentTier,
        newTier,
        isUpgrade,
      };
    });
  }
} 