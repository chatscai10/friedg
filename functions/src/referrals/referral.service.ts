import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as crypto from 'crypto';
import { 
  GenerateReferralCodeResult, 
  MemberReferralAttributes,
  ApplyReferralCodeInput,
  ApplyReferralCodeResult,
  ReferralRecord,
  GetMemberReferralsParams
} from './referral.types';

const logger = functions.logger;
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * 為指定會員生成唯一的推薦碼
 * @param userId 會員的 Firebase UID
 * @returns 包含生成推薦碼的對象
 * @throws 如果會員不存在或生成失敗則拋出錯誤
 */
export async function generateReferralCode(userId: string): Promise<GenerateReferralCodeResult> {
  try {
    logger.info(`開始為會員 ${userId} 生成推薦碼`);
    
    // 查詢會員是否存在
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      logger.error(`會員 ${userId} 不存在`);
      throw new Error(`會員 ${userId} 不存在`);
    }
    
    // 如果會員已有推薦碼，則直接返回
    const userData = userDoc.data() as MemberReferralAttributes & Record<string, any>;
    if (userData.referralCode) {
      logger.info(`會員 ${userId} 已有推薦碼: ${userData.referralCode}`);
      return {
        referralCode: userData.referralCode
      };
    }
    
    // 生成唯一推薦碼
    let referralCode = _generateUniqueCode();
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    // 確保推薦碼唯一性
    while (!isUnique && attempts < maxAttempts) {
      const existingDocs = await db.collection('users')
        .where('referralCode', '==', referralCode)
        .limit(1)
        .get();
        
      if (existingDocs.empty) {
        isUnique = true;
      } else {
        logger.warn(`推薦碼 ${referralCode} 已存在，重新生成（嘗試 ${attempts + 1}/${maxAttempts}）`);
        referralCode = _generateUniqueCode();
        attempts++;
      }
    }
    
    if (!isUnique) {
      logger.error(`無法生成唯一推薦碼，已嘗試 ${maxAttempts} 次`);
      throw new Error('無法生成唯一推薦碼，請稍後再試');
    }
    
    // 更新會員記錄
    await userRef.update({
      referralCode: referralCode,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    logger.info(`成功為會員 ${userId} 生成推薦碼: ${referralCode}`);
    
    return {
      referralCode: referralCode
    };
  } catch (error) {
    logger.error(`生成推薦碼錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * 應用推薦碼 (會員A使用會員B的推薦碼)
 * @param refereeUserId 被推薦人的用戶ID
 * @param input 包含推薦碼的輸入對象
 * @returns 操作結果
 * @throws 如果推薦碼無效或應用失敗則拋出錯誤
 */
export async function applyReferralCode(
  refereeUserId: string, 
  input: ApplyReferralCodeInput
): Promise<ApplyReferralCodeResult> {
  logger.info(`開始應用推薦碼，被推薦人ID: ${refereeUserId}, 推薦碼: ${input.code}`);
  const batch = db.batch();
  
  try {
    // 查詢被推薦人的用戶記錄
    const refereeRef = db.collection('users').doc(refereeUserId);
    const refereeDoc = await refereeRef.get();
    
    if (!refereeDoc.exists) {
      logger.error(`被推薦人 ${refereeUserId} 不存在`);
      throw new Error('被推薦人不存在');
    }
    
    const refereeData = refereeDoc.data() as MemberReferralAttributes & Record<string, any>;
    
    // 檢查被推薦人是否已經有推薦關係
    if (refereeData.referredBy) {
      logger.warn(`被推薦人 ${refereeUserId} 已經使用過推薦碼`);
      throw new Error('您已經使用過推薦碼，不能重複使用');
    }
    
    // 檢查是否是新會員 (註冊時間需要在過去30天內)
    if (refereeData.createdAt || refereeData.registeredAt) {
      const registrationDate = (refereeData.createdAt || refereeData.registeredAt).toDate();
      const now = new Date();
      const daysSinceRegistration = Math.floor((now.getTime() - registrationDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // 如果註冊超過30天，不能使用推薦碼
      if (daysSinceRegistration > 30) {
        logger.warn(`被推薦人 ${refereeUserId} 註冊已超過30天，不能使用推薦碼`);
        throw new Error('推薦碼只能在註冊後30天內使用');
      }
    }
    
    // 查詢推薦碼所屬的會員
    const referrerQuery = await db.collection('users')
      .where('referralCode', '==', input.code)
      .limit(1)
      .get();
      
    if (referrerQuery.empty) {
      logger.error(`推薦碼 ${input.code} 無效，找不到對應會員`);
      throw new Error('無效的推薦碼');
    }
    
    const referrerDoc = referrerQuery.docs[0];
    const referrerId = referrerDoc.id;
    const referrerData = referrerDoc.data() as MemberReferralAttributes & Record<string, any>;
    
    // 防止自我推薦
    if (referrerId === refereeUserId) {
      logger.warn(`會員 ${refereeUserId} 嘗試使用自己的推薦碼`);
      throw new Error('不能使用自己的推薦碼');
    }
    
    // 防止循環推薦
    if (await _isCircularReferral(referrerId, refereeUserId)) {
      logger.warn(`檢測到循環推薦關係，推薦人ID: ${referrerId}, 被推薦人ID: ${refereeUserId}`);
      throw new Error('不能形成循環推薦關係');
    }
    
    // 檢查推薦人是否達到限制
    const maxReferrals = 50; // 設定合理的上限
    if ((referrerData.referralCount || 0) >= maxReferrals) {
      logger.warn(`推薦人 ${referrerId} 已達到推薦上限 ${maxReferrals}`);
      throw new Error('推薦人已達到推薦上限');
    }
    
    // 獲取租戶ID和店鋪ID (如果存在)
    const tenantId = refereeData.tenantId || '';
    const storeId = refereeData.storeId || null;
    
    if (!tenantId) {
      logger.error(`被推薦人 ${refereeUserId} 沒有關聯的租戶ID`);
      throw new Error('無法確定租戶ID');
    }
    
    // 更新被推薦會員信息
    batch.update(refereeRef, {
      referredBy: referrerId,
      referredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // 更新推薦人統計
    const referrerRef = db.collection('users').doc(referrerId);
    batch.update(referrerRef, {
      referralCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // 創建推薦記錄
    const referralRecordRef = db.collection('referralRecords').doc();
    const referralRecord: Omit<ReferralRecord, 'id'> = {
      referrerId: referrerId,
      refereeId: refereeUserId,
      referralCode: input.code,
      status: 'pending',
      rewardStatus: 'pending',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      tenantId: tenantId,
      ...(storeId && { storeId }),
    };
    
    batch.set(referralRecordRef, referralRecord);
    
    // 執行批次操作
    await batch.commit();
    logger.info(`成功應用推薦碼，創建推薦記錄 ${referralRecordRef.id}`);
    
    // 處理獎勵發放（可以立即發放或設置條件觸發）
    // 暫時將處理獎勵的函數標記為 TODO
    // await _processReferralReward(referralRecordRef.id);
    logger.info(`需要處理推薦獎勵 for 記錄ID: ${referralRecordRef.id}`);
    
    return {
      success: true,
      referrerId: referrerId,
      referralRecordId: referralRecordRef.id
    };
  } catch (error) {
    logger.error(`應用推薦碼錯誤: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // 重新拋出定制的錯誤，以便在 handler 中區分處理
    if (error instanceof Error) {
      // 保留原始錯誤訊息
      throw error;
    } else {
      throw new Error('應用推薦碼失敗');
    }
  }
}

/**
 * 獲取會員的推薦記錄
 * @param userId 會員ID
 * @param params 查詢參數，包括記錄類型 (推薦人/被推薦人/全部)
 * @returns 推薦記錄列表
 * @throws 如果查詢失敗則拋出錯誤
 */
export async function getMemberReferrals(
  userId: string, 
  params: GetMemberReferralsParams = {}
): Promise<ReferralRecord[]> {
  try {
    // 獲取查詢類型，默認為 'all'
    const type = params.type || 'all';
    logger.info(`開始獲取會員 ${userId} 的推薦記錄，類型: ${type}`);
    
    // 查詢會員信息以獲取 tenantId
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      logger.error(`會員 ${userId} 不存在`);
      throw new Error('會員不存在');
    }
    
    const userData = userDoc.data() as MemberReferralAttributes & Record<string, any>;
    const userTenantId = userData.tenantId;
    
    if (!userTenantId) {
      logger.warn(`會員 ${userId} 沒有關聯的租戶ID`);
    }
    
    // 聲明結果數組
    let referralRecords: ReferralRecord[] = [];
    
    // 根據類型執行不同的查詢
    if (type === 'referrer' || type === 'all') {
      // 查詢作為推薦人的記錄
      logger.info(`查詢會員 ${userId} 作為推薦人的記錄`);
      let referrerQuery = db.collection('referralRecords')
        .where('referrerId', '==', userId)
        .orderBy('createdAt', 'desc');
      
      // 如果有租戶ID，可以進一步過濾
      if (userTenantId) {
        referrerQuery = referrerQuery.where('tenantId', '==', userTenantId);
      }
      
      const referrerDocs = await referrerQuery.get();
      
      // 映射推薦人記錄
      const asReferrerRecords = referrerDocs.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          type: 'referrer' as const, // 指定記錄類型為推薦人
          // 確保 Timestamp 是 Firestore Timestamp 類型，如果需要轉換為 Date 或 ISO 字符串，這裡處理
        } as ReferralRecord;
      });
      
      referralRecords = [...referralRecords, ...asReferrerRecords];
      logger.info(`找到 ${asReferrerRecords.length} 條作為推薦人的記錄`);
    }
    
    if (type === 'referee' || type === 'all') {
      // 查詢作為被推薦人的記錄
      logger.info(`查詢會員 ${userId} 作為被推薦人的記錄`);
      let refereeQuery = db.collection('referralRecords')
        .where('refereeId', '==', userId)
        .orderBy('createdAt', 'desc');
      
      // 如果有租戶ID，可以進一步過濾
      if (userTenantId) {
        refereeQuery = refereeQuery.where('tenantId', '==', userTenantId);
      }
      
      const refereeDocs = await refereeQuery.get();
      
      // 映射被推薦人記錄
      const asRefereeRecords = refereeDocs.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          type: 'referee' as const, // 指定記錄類型為被推薦人
          // 確保 Timestamp 是 Firestore Timestamp 類型，如果需要轉換為 Date 或 ISO 字符串，這裡處理
        } as ReferralRecord;
      });
      
      referralRecords = [...referralRecords, ...asRefereeRecords];
      logger.info(`找到 ${asRefereeRecords.length} 條作為被推薦人的記錄`);
    }
    
    // 如果是查詢全部記錄，按創建時間排序
    if (type === 'all') {
      referralRecords.sort((a, b) => {
        // 確保比較的是同一類型的值
        const timeA = a.createdAt instanceof admin.firestore.Timestamp ? a.createdAt.toMillis() : a.createdAt;
        const timeB = b.createdAt instanceof admin.firestore.Timestamp ? b.createdAt.toMillis() : b.createdAt;
        return timeB - timeA; // 降序排列
      });
    }
    
    logger.info(`成功獲取會員 ${userId} 的推薦記錄，共 ${referralRecords.length} 條`);
    return referralRecords;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`獲取推薦記錄錯誤: ${errorMessage}`);
    throw error;
  }
}

/**
 * 生成隨機推薦碼（6位英數字混合）
 * @private
 * @returns 生成的隨機碼
 */
function _generateUniqueCode(): string {
  // 生成6位英數字混合推薦碼
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
 * @param referrerId 推薦人ID
 * @param refereeId 被推薦人ID
 * @returns 是否形成循環
 */
async function _isCircularReferral(referrerId: string, refereeId: string): Promise<boolean> {
  // 檢查是否會形成循環推薦關係
  let currentId = referrerId;
  const visited = new Set<string>();
  
  while (currentId) {
    if (visited.has(currentId)) {
      return true; // 檢測到循環
    }
    
    if (currentId === refereeId) {
      return true; // 這將形成循環
    }
    
    visited.add(currentId);
    
    // 獲取當前會員的推薦人
    const currentUserRef = db.collection('users').doc(currentId);
    const currentUserDoc = await currentUserRef.get();
    
    if (!currentUserDoc.exists) {
      break; // 沒有這個用戶，終止檢查
    }
    
    const userData = currentUserDoc.data() as MemberReferralAttributes & Record<string, any>;
    if (!userData.referredBy) {
      break; // 沒有推薦人，終止檢查
    }
    
    currentId = userData.referredBy;
  }
  
  return false;
} 