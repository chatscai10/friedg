import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { CouponInstance, CouponRedemption, CouponTemplate } from './coupons.types';

const db = admin.firestore();

/**
 * 優惠券服務
 * 提供優惠券模板、實例創建、驗證、應用等功能
 */
export class CouponService {
  /**
   * === 優惠券模板管理 ===
   */

  /**
   * 創建優惠券模板
   * @param data 模板數據
   * @returns 創建的模板ID
   */
  async createTemplate(data: Omit<CouponTemplate, 'templateId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // 驗證必要欄位
      if (!data.tenantId || !data.name || !data.type || data.value === undefined || !data.maxUsagePerCoupon) {
        throw new Error('缺少必要欄位');
      }

      // 驗證優惠券類型
      if (!['percentage', 'fixed', 'freeItem', 'shipping'].includes(data.type)) {
        throw new Error('無效的優惠券類型');
      }

      // 驗證優惠券值
      if (data.type === 'percentage' && (data.value <= 0 || data.value > 100)) {
        throw new Error('百分比折扣必須在1-100之間');
      }

      if (['fixed', 'freeItem', 'shipping'].includes(data.type) && data.value <= 0) {
        throw new Error('優惠值必須大於0');
      }

      // 創建模板記錄
      const templateRef = db.collection('couponTemplates').doc();
      await templateRef.set({
        ...data,
        templateId: templateRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return templateRef.id;
    } catch (error) {
      console.error('創建優惠券模板錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新優惠券模板
   * @param templateId 模板ID
   * @param data 更新的數據
   * @returns 是否更新成功
   */
  async updateTemplate(templateId: string, data: Partial<CouponTemplate>): Promise<boolean> {
    try {
      // 不允許更新的欄位
      const forbiddenUpdates = ['templateId', 'tenantId', 'createdAt', 'createdBy'];
      
      // 過濾掉不允許更新的欄位
      const updateData: Record<string, any> = Object.entries(data)
        .filter(([key]) => !forbiddenUpdates.includes(key))
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
      
      // 添加更新時間戳
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      
      // 更新模板
      await db.collection('couponTemplates').doc(templateId).update(updateData);
      
      return true;
    } catch (error) {
      console.error('更新優惠券模板錯誤:', error);
      throw error;
    }
  }

  /**
   * 獲取優惠券模板
   * @param templateId 模板ID
   * @returns 模板數據
   */
  async getTemplate(templateId: string): Promise<CouponTemplate | null> {
    try {
      const doc = await db.collection('couponTemplates').doc(templateId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return doc.data() as CouponTemplate;
    } catch (error) {
      console.error('獲取優惠券模板錯誤:', error);
      throw error;
    }
  }

  /**
   * 列出租戶的所有優惠券模板
   * @param tenantId 租戶ID
   * @param onlyActive 是否只返回啟用的模板
   * @returns 模板列表
   */
  async listTemplates(tenantId: string, onlyActive = false): Promise<CouponTemplate[]> {
    try {
      let query = db.collection('couponTemplates').where('tenantId', '==', tenantId);
      
      if (onlyActive) {
        query = query.where('isActive', '==', true);
      }
      
      // 按創建時間排序
      const snapshot = await query.orderBy('createdAt', 'desc').get();
      
      return snapshot.docs.map(doc => doc.data() as CouponTemplate);
    } catch (error) {
      console.error('列出優惠券模板錯誤:', error);
      throw error;
    }
  }

  /**
   * === 優惠券實例操作 ===
   */

  /**
   * 創建優惠券實例
   * @param data 優惠券實例數據
   * @returns 創建的優惠券ID
   */
  async createCouponInstance(data: Omit<CouponInstance, 'couponId' | 'code' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // 驗證必要欄位
      if (!data.type || data.value === undefined || !data.memberId || !data.tenantId) {
        throw new Error('缺少必要欄位');
      }
      
      // 驗證優惠券類型
      if (!['percentage', 'fixed', 'freeItem', 'shipping'].includes(data.type)) {
        throw new Error('無效的優惠券類型');
      }
      
      // 驗證優惠券值
      if (data.type === 'percentage' && (data.value <= 0 || data.value > 100)) {
        throw new Error('百分比折扣必須在1-100之間');
      }
      
      if (['fixed', 'freeItem', 'shipping'].includes(data.type) && data.value <= 0) {
        throw new Error('優惠值必須大於0');
      }
      
      // 創建優惠券記錄
      const couponRef = db.collection('coupons').doc();
      await couponRef.set({
        ...data,
        couponId: couponRef.id,
        code: this._generateCouponCode(),
        status: 'active',
        usageCount: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      return couponRef.id;
    } catch (error) {
      console.error('創建優惠券錯誤:', error);
      throw error;
    }
  }

  /**
   * 根據代碼查找優惠券
   * @param code 優惠券代碼
   * @param tenantId 租戶ID
   * @returns 優惠券實例
   */
  async getCouponInstanceByCode(code: string, tenantId: string): Promise<CouponInstance | null> {
    try {
      const snapshot = await db.collection('coupons')
        .where('code', '==', code)
        .where('tenantId', '==', tenantId)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      return snapshot.docs[0].data() as CouponInstance;
    } catch (error) {
      console.error('查詢優惠券錯誤:', error);
      throw error;
    }
  }

  /**
   * 查詢用戶擁有的優惠券
   * @param userId 用戶ID
   * @param tenantId 租戶ID
   * @param status 優惠券狀態 (active, used, expired, all)
   * @returns 優惠券列表
   */
  async getCouponsByUserId(userId: string, tenantId: string, status = 'active'): Promise<CouponInstance[]> {
    try {
      let query = db.collection('coupons')
        .where('memberId', '==', userId)
        .where('tenantId', '==', tenantId);
      
      if (status !== 'all') {
        query = query.where('status', '==', status);
      }
      
      const snapshot = await query.orderBy('createdAt', 'desc').get();
      
      return snapshot.docs.map(doc => doc.data() as CouponInstance);
    } catch (error) {
      console.error('獲取用戶優惠券錯誤:', error);
      throw error;
    }
  }

  /**
   * 驗證優惠券
   * @param code 優惠券代碼
   * @param userId 用戶ID
   * @param tenantId 租戶ID
   * @param orderDetails 訂單詳情 (可選)
   * @returns 驗證結果與優惠券信息
   */
  async validateCoupon(
    code: string, 
    userId: string, 
    tenantId: string,
    orderDetails?: { amount: number, items?: Array<{ id: string, categoryId: string }> }
  ): Promise<{
    valid: boolean;
    message?: string;
    couponId?: string;
    couponData?: CouponInstance;
    discountAmount?: number;
    finalAmount?: number;
  }> {
    try {
      // 查詢優惠券
      const coupon = await this.getCouponInstanceByCode(code, tenantId);
      
      if (!coupon) {
        return {
          valid: false,
          message: '優惠券無效或不存在'
        };
      }
      
      // 檢查會員權限
      if (coupon.memberId !== userId) {
        return {
          valid: false,
          message: '此優惠券不屬於您'
        };
      }
      
      // 檢查狀態
      if (coupon.status !== 'active') {
        return {
          valid: false,
          message: `優惠券已${coupon.status === 'used' ? '使用' : coupon.status === 'expired' ? '過期' : '失效'}`
        };
      }
      
      // 檢查過期時間
      const now = new Date();
      const expiryDate = coupon.expiryDate.toDate();
      
      if (now > expiryDate) {
        // 自動更新過期優惠券狀態
        await db.collection('coupons').doc(coupon.couponId).update({
          status: 'expired',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return {
          valid: false,
          message: '優惠券已過期'
        };
      }
      
      // 檢查使用次數
      if (coupon.usageCount >= coupon.maxUsage) {
        return {
          valid: false,
          message: '優惠券已達到最大使用次數'
        };
      }
      
      // 如果提供了訂單詳情，進行額外檢查
      if (orderDetails) {
        // 檢查最低訂單金額約束
        if (coupon.constraints?.minOrderAmount && orderDetails.amount < coupon.constraints.minOrderAmount) {
          return {
            valid: false,
            message: `訂單金額需滿 ${coupon.constraints.minOrderAmount} 元才能使用此優惠券`
          };
        }
        
        // 計算折扣金額
        let discountAmount = 0;
        
        if (coupon.type === 'percentage') {
          discountAmount = (orderDetails.amount * coupon.value) / 100;
        } else if (coupon.type === 'fixed') {
          discountAmount = Math.min(coupon.value, orderDetails.amount); // 折扣金額不能超過訂單金額
        } else {
          // freeItem 和 shipping 類型的處理
          discountAmount = coupon.value;
        }
        
        // 檢查最大折扣約束
        if (coupon.constraints?.maxDiscountAmount && discountAmount > coupon.constraints.maxDiscountAmount) {
          discountAmount = coupon.constraints.maxDiscountAmount;
        }
        
        return {
          valid: true,
          couponId: coupon.couponId,
          couponData: coupon,
          discountAmount,
          finalAmount: orderDetails.amount - discountAmount
        };
      }
      
      // 如果沒有提供訂單詳情，只驗證優惠券有效性
      return {
        valid: true,
        couponId: coupon.couponId,
        couponData: coupon
      };
    } catch (error) {
      console.error('驗證優惠券錯誤:', error);
      throw error;
    }
  }

  /**
   * 標記優惠券已使用
   * @param couponId 優惠券ID
   * @param orderId 訂單ID
   * @param userId 用戶ID
   * @param tenantId 租戶ID
   * @returns 是否成功標記
   */
  async markCouponUsed(couponId: string, orderId: string, userId: string, tenantId: string): Promise<boolean> {
    // 使用事務確保數據一致性
    return await db.runTransaction(async (transaction) => {
      // 1. 獲取優惠券
      const couponRef = db.collection('coupons').doc(couponId);
      const couponDoc = await transaction.get(couponRef);
      
      if (!couponDoc.exists) {
        throw new Error('優惠券不存在');
      }
      
      const couponData = couponDoc.data() as CouponInstance;
      
      // 2. 檢查優惠券是否屬於該用戶和租戶
      if (couponData.memberId !== userId || couponData.tenantId !== tenantId) {
        throw new Error('無權使用此優惠券');
      }
      
      // 3. 檢查優惠券是否可用
      if (couponData.status !== 'active') {
        throw new Error(`優惠券已${couponData.status === 'used' ? '使用' : couponData.status === 'expired' ? '過期' : '失效'}`);
      }
      
      // 4. 更新使用次數
      const newUsageCount = couponData.usageCount + 1;
      
      // 5. 如果已達到最大使用次數，標記為已使用
      const newStatus = newUsageCount >= couponData.maxUsage ? 'used' : 'active';
      
      // 6. 更新優惠券
      transaction.update(couponRef, {
        usageCount: newUsageCount,
        status: newStatus,
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastOrderId: orderId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 7. 創建使用記錄
      const redemptionRef = db.collection('couponRedemptions').doc();
      const redemptionData: CouponRedemption = {
        redemptionId: redemptionRef.id,
        couponId,
        couponCode: couponData.code,
        orderId,
        memberId: userId,
        tenantId,
        storeId: couponData.storeId,
        discountType: couponData.type,
        discountValue: couponData.value,
        discountAmount: 0, // 實際折扣金額（在訂單完成後更新）
        orderAmount: 0, // 訂單金額（在訂單完成後更新）
        usedAt: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.Timestamp.now()
      };
      
      transaction.set(redemptionRef, redemptionData);
      
      return true;
    });
  }

  /**
   * 生成優惠券代碼
   * @returns 優惠券代碼
   */
  private _generateCouponCode(): string {
    // 生成10位英數字混合優惠券代碼
    return crypto.randomBytes(5).toString('hex').toUpperCase();
  }
} 