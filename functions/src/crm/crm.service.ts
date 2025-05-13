import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { UserProfile, CustomerNote } from '../users/user.types';

const logger = functions.logger;
const db = admin.firestore();

/**
 * 根據用戶 ID 獲取客戶資料
 * @param userId 用戶 ID
 * @param tenantId 租戶 ID
 * @returns 客戶資料或 null
 */
export async function getCustomerById(userId: string, tenantId: string): Promise<UserProfile | null> {
  logger.info(`開始獲取客戶資料，userId: ${userId}, tenantId: ${tenantId}`);
  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.warn(`客戶文檔未找到，userId: ${userId}`);
      return null;
    }

    const userData = userDoc.data();
    if (!userData || userData.tenantId !== tenantId) {
      logger.warn(`客戶文檔數據為空或租戶不匹配，userId: ${userId}, tenantId: ${tenantId}`);
      return null;
    }

    // 構建客戶資料，包括 CRM 相關字段
    const customerProfile: UserProfile = {
      uid: userId,
      email: userData.email || null,
      displayName: userData.displayName || null,
      photoURL: userData.photoURL || null,
      phoneNumber: userData.phoneNumber || null,
      firstName: userData.firstName || undefined,
      lastName: userData.lastName || undefined,
      gender: userData.gender || undefined,
      birthday: userData.birthday || undefined,
      addresses: userData.addresses || undefined,
      alternatePhoneNumber: userData.alternatePhoneNumber || undefined,
      tags: userData.tags || undefined,
      customerSince: userData.customerSince || userData.registeredAt || undefined,
      lastActivityDate: userData.lastActivityDate || userData.lastLoginAt || undefined,
      totalSpent: userData.totalSpent || undefined,
      orderCount: userData.orderCount || undefined,
      membershipTier: userData.membershipTier || undefined,
      membershipPoints: userData.membershipPoints || undefined,
      source: userData.source || undefined,
      preferredContactMethod: userData.preferredContactMethod || undefined,
      status: userData.status || undefined,
      lastUpdated: userData.lastUpdated || undefined,
    };

    logger.info(`成功獲取客戶資料，userId: ${userId}`);
    return customerProfile;

  } catch (error: any) {
    logger.error(`獲取客戶資料時發生錯誤，userId: ${userId}`, { error: error.message, stack: error.stack });
    throw new Error(`獲取客戶資料失敗: ${error.message}`);
  }
}

/**
 * 更新客戶資料
 * @param userId 用戶 ID
 * @param tenantId 租戶 ID
 * @param data 要更新的資料
 * @returns 更新後的客戶資料
 */
export async function updateCustomer(
  userId: string,
  tenantId: string,
  data: Partial<UserProfile>
): Promise<UserProfile> {
  logger.info(`開始更新客戶資料，userId: ${userId}, tenantId: ${tenantId}`, { data });
  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.error(`客戶文檔未找到，userId: ${userId}`);
      throw new Error('客戶不存在');
    }

    const userData = userDoc.data();
    if (!userData || userData.tenantId !== tenantId) {
      logger.error(`客戶文檔數據為空或租戶不匹配，userId: ${userId}, tenantId: ${tenantId}`);
      throw new Error('客戶不存在或租戶不匹配');
    }

    // 準備要更新的數據，僅包含允許修改的 CRM 相關字段
    const updateData: Record<string, any> = {};
    
    // 基本資料
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.photoURL !== undefined) updateData.photoURL = data.photoURL;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    
    // CRM 相關資料
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.birthday !== undefined) updateData.birthday = data.birthday;
    if (data.addresses !== undefined) updateData.addresses = data.addresses;
    if (data.alternatePhoneNumber !== undefined) updateData.alternatePhoneNumber = data.alternatePhoneNumber;
    if (data.preferredContactMethod !== undefined) updateData.preferredContactMethod = data.preferredContactMethod;
    
    // 可由管理員更新的字段
    if (data.membershipTier !== undefined) updateData.membershipTier = data.membershipTier;
    if (data.membershipPoints !== undefined) updateData.membershipPoints = data.membershipPoints;
    if (data.source !== undefined) updateData.source = data.source;
    if (data.status !== undefined) updateData.status = data.status;
    
    // 添加更新時間戳
    updateData.lastUpdated = admin.firestore.FieldValue.serverTimestamp();

    // 執行更新
    await userDocRef.update(updateData);

    // 獲取並返回更新後的客戶資料
    const updatedCustomer = await getCustomerById(userId, tenantId);
    if (!updatedCustomer) {
      throw new Error('更新後無法獲取客戶資料');
    }

    logger.info(`成功更新客戶資料，userId: ${userId}`);
    return updatedCustomer;

  } catch (error: any) {
    logger.error(`更新客戶資料時發生錯誤，userId: ${userId}`, { error: error.message, stack: error.stack });
    throw new Error(`更新客戶資料失敗: ${error.message}`);
  }
}

/**
 * 列出客戶
 * @param filters 過濾條件
 * @param tenantId 租戶 ID
 * @param limit 每頁數量
 * @param cursor 分頁游標
 * @returns 客戶列表及下一頁游標
 */
export async function listCustomers(
  filters: {
    query?: string;
    tags?: string[];
    minTotalSpent?: number;
    maxTotalSpent?: number;
    minOrderCount?: number;
    status?: 'active' | 'inactive' | 'blocked';
    membershipTier?: string;
    source?: string;
    lastActivityDateStart?: admin.firestore.Timestamp;
    lastActivityDateEnd?: admin.firestore.Timestamp;
  },
  tenantId: string,
  limit: number = 10,
  cursor?: string
): Promise<{ customers: UserProfile[]; nextCursor?: string; totalCount: number }> {
  logger.info(`開始列出客戶，tenantId: ${tenantId}`, { filters, limit, cursor });
  try {
    let query = db.collection('users')
      .where('tenantId', '==', tenantId)
      .where('userType', '==', 'customer');

    // 應用過濾條件
    if (filters.tags && filters.tags.length > 0) {
      // 由於 Firestore 不支持對數組的多個元素進行確切匹配，所以這裡只過濾一個標籤
      query = query.where('tags', 'array-contains', filters.tags[0]);
    }

    if (filters.minTotalSpent !== undefined) {
      query = query.where('totalSpent', '>=', filters.minTotalSpent);
    }

    if (filters.maxTotalSpent !== undefined) {
      query = query.where('totalSpent', '<=', filters.maxTotalSpent);
    }

    if (filters.minOrderCount !== undefined) {
      query = query.where('orderCount', '>=', filters.minOrderCount);
    }

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    if (filters.membershipTier) {
      query = query.where('membershipTier', '==', filters.membershipTier);
    }

    if (filters.source) {
      query = query.where('source', '==', filters.source);
    }

    if (filters.lastActivityDateStart) {
      query = query.where('lastActivityDate', '>=', filters.lastActivityDateStart);
    }

    if (filters.lastActivityDateEnd) {
      query = query.where('lastActivityDate', '<=', filters.lastActivityDateEnd);
    }

    // 根據 lastUpdated 排序
    query = query.orderBy('lastUpdated', 'desc');
    
    // 應用游標
    if (cursor) {
      const cursorDocRef = db.collection('users').doc(cursor);
      const cursorDoc = await cursorDocRef.get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    // 限制結果數量
    query = query.limit(limit);

    // 執行查詢
    const snapshot = await query.get();
    const customers: UserProfile[] = [];
    let nextCursor: string | undefined;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data) {
        // 構建客戶資料對象
        const customerProfile: UserProfile = {
          uid: doc.id,
          email: data.email || null,
          displayName: data.displayName || null,
          photoURL: data.photoURL || null,
          phoneNumber: data.phoneNumber || null,
          firstName: data.firstName || undefined,
          lastName: data.lastName || undefined,
          gender: data.gender || undefined,
          tags: data.tags || undefined,
          customerSince: data.customerSince || data.registeredAt || undefined,
          lastActivityDate: data.lastActivityDate || data.lastLoginAt || undefined,
          totalSpent: data.totalSpent || undefined,
          orderCount: data.orderCount || undefined,
          membershipTier: data.membershipTier || undefined,
          membershipPoints: data.membershipPoints || undefined,
          source: data.source || undefined,
          preferredContactMethod: data.preferredContactMethod || undefined,
          status: data.status || undefined,
          lastUpdated: data.lastUpdated || undefined,
        };
        customers.push(customerProfile);
        
        // 保存最後一個文檔 ID 作為下一頁游標
        nextCursor = doc.id;
      }
    });

    // 過濾文本查詢 (模糊匹配顯示名稱、姓名、電話或電郵)
    if (filters.query) {
      const queryLower = filters.query.toLowerCase();
      const filteredCustomers = customers.filter((customer) => {
        return (
          (customer.displayName && customer.displayName.toLowerCase().includes(queryLower)) ||
          (customer.firstName && customer.firstName.toLowerCase().includes(queryLower)) ||
          (customer.lastName && customer.lastName.toLowerCase().includes(queryLower)) ||
          (customer.phoneNumber && customer.phoneNumber.includes(filters.query!)) ||
          (customer.email && customer.email.toLowerCase().includes(queryLower))
        );
      });
      
      if (filteredCustomers.length < customers.length) {
        // 如果過濾後數量減少，則清空下一頁游標
        nextCursor = undefined;
      }
      
      // 返回過濾後的結果
      return {
        customers: filteredCustomers,
        nextCursor,
        totalCount: filteredCustomers.length,
      };
    }

    // 計算總數（這只是近似值，實際應用中可能需要更準確的計數）
    // 注意：在實際應用中，可能需要單獨查詢計數或使用計數器
    const countQuery = db.collection('users')
      .where('tenantId', '==', tenantId)
      .where('userType', '==', 'customer');
    const countSnapshot = await countQuery.count().get();
    const totalCount = countSnapshot.data().count || 0;

    logger.info(`成功列出客戶，tenantId: ${tenantId}，找到 ${customers.length} 個客戶`);
    return {
      customers,
      nextCursor: customers.length === limit ? nextCursor : undefined,
      totalCount,
    };

  } catch (error: any) {
    logger.error(`列出客戶時發生錯誤，tenantId: ${tenantId}`, { error: error.message, stack: error.stack });
    throw new Error(`列出客戶失敗: ${error.message}`);
  }
}

/**
 * 向客戶添加標籤
 * @param userId 用戶 ID
 * @param tenantId 租戶 ID
 * @param tag 標籤
 * @returns Promise<void>
 */
export async function addTagToCustomer(userId: string, tenantId: string, tag: string): Promise<void> {
  logger.info(`開始向客戶添加標籤，userId: ${userId}, tenantId: ${tenantId}, tag: ${tag}`);
  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.error(`客戶文檔未找到，userId: ${userId}`);
      throw new Error('客戶不存在');
    }

    const userData = userDoc.data();
    if (!userData || userData.tenantId !== tenantId) {
      logger.error(`客戶文檔數據為空或租戶不匹配，userId: ${userId}, tenantId: ${tenantId}`);
      throw new Error('客戶不存在或租戶不匹配');
    }

    // 使用 arrayUnion 添加標籤
    await userDocRef.update({
      tags: FieldValue.arrayUnion(tag),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`成功向客戶添加標籤，userId: ${userId}, tag: ${tag}`);

  } catch (error: any) {
    logger.error(`向客戶添加標籤時發生錯誤，userId: ${userId}, tag: ${tag}`, { error: error.message, stack: error.stack });
    throw new Error(`向客戶添加標籤失敗: ${error.message}`);
  }
}

/**
 * 從客戶移除標籤
 * @param userId 用戶 ID
 * @param tenantId 租戶 ID
 * @param tag 標籤
 * @returns Promise<void>
 */
export async function removeTagFromCustomer(userId: string, tenantId: string, tag: string): Promise<void> {
  logger.info(`開始從客戶移除標籤，userId: ${userId}, tenantId: ${tenantId}, tag: ${tag}`);
  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.error(`客戶文檔未找到，userId: ${userId}`);
      throw new Error('客戶不存在');
    }

    const userData = userDoc.data();
    if (!userData || userData.tenantId !== tenantId) {
      logger.error(`客戶文檔數據為空或租戶不匹配，userId: ${userId}, tenantId: ${tenantId}`);
      throw new Error('客戶不存在或租戶不匹配');
    }

    // 使用 arrayRemove 移除標籤
    await userDocRef.update({
      tags: FieldValue.arrayRemove(tag),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`成功從客戶移除標籤，userId: ${userId}, tag: ${tag}`);

  } catch (error: any) {
    logger.error(`從客戶移除標籤時發生錯誤，userId: ${userId}, tag: ${tag}`, { error: error.message, stack: error.stack });
    throw new Error(`從客戶移除標籤失敗: ${error.message}`);
  }
}

/**
 * 向客戶添加備註
 * @param userId 用戶 ID
 * @param tenantId 租戶 ID
 * @param noteData 備註數據
 * @returns 添加的備註
 */
export async function addNoteToCustomer(
  userId: string,
  tenantId: string,
  noteData: Omit<CustomerNote, 'noteId' | 'timestamp'>
): Promise<CustomerNote> {
  logger.info(`開始向客戶添加備註，userId: ${userId}, tenantId: ${tenantId}`, { noteData });
  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.error(`客戶文檔未找到，userId: ${userId}`);
      throw new Error('客戶不存在');
    }

    const userData = userDoc.data();
    if (!userData || userData.tenantId !== tenantId) {
      logger.error(`客戶文檔數據為空或租戶不匹配，userId: ${userId}, tenantId: ${tenantId}`);
      throw new Error('客戶不存在或租戶不匹配');
    }

    // 創建備註文檔
    const notesCollectionRef = userDocRef.collection('notes');
    const newNoteRef = notesCollectionRef.doc();
    const timestamp = admin.firestore.Timestamp.now();
    
    const newNote: CustomerNote = {
      noteId: newNoteRef.id,
      text: noteData.text,
      addedBy: noteData.addedBy,
      addedByName: noteData.addedByName,
      timestamp,
      isImportant: noteData.isImportant || false,
    };

    // 添加備註到子集合
    await newNoteRef.set(newNote);

    // 更新用戶文檔的最後更新時間
    await userDocRef.update({
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`成功向客戶添加備註，userId: ${userId}, noteId: ${newNote.noteId}`);
    return newNote;

  } catch (error: any) {
    logger.error(`向客戶添加備註時發生錯誤，userId: ${userId}`, { error: error.message, stack: error.stack });
    throw new Error(`向客戶添加備註失敗: ${error.message}`);
  }
}

/**
 * 獲取客戶備註
 * @param userId 用戶 ID
 * @param tenantId 租戶 ID
 * @param limit 限制數量
 * @returns 備註列表
 */
export async function getCustomerNotes(
  userId: string,
  tenantId: string,
  limit: number = 10
): Promise<CustomerNote[]> {
  logger.info(`開始獲取客戶備註，userId: ${userId}, tenantId: ${tenantId}, limit: ${limit}`);
  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.error(`客戶文檔未找到，userId: ${userId}`);
      throw new Error('客戶不存在');
    }

    const userData = userDoc.data();
    if (!userData || userData.tenantId !== tenantId) {
      logger.error(`客戶文檔數據為空或租戶不匹配，userId: ${userId}, tenantId: ${tenantId}`);
      throw new Error('客戶不存在或租戶不匹配');
    }

    // 查詢子集合中的備註
    const notesQuery = userDocRef.collection('notes')
      .orderBy('timestamp', 'desc')
      .limit(limit);
    
    const notesSnapshot = await notesQuery.get();
    const notes: CustomerNote[] = [];

    notesSnapshot.forEach((doc) => {
      const noteData = doc.data() as CustomerNote;
      notes.push(noteData);
    });

    logger.info(`成功獲取客戶備註，userId: ${userId}，找到 ${notes.length} 條備註`);
    return notes;

  } catch (error: any) {
    logger.error(`獲取客戶備註時發生錯誤，userId: ${userId}`, { error: error.message, stack: error.stack });
    throw new Error(`獲取客戶備註失敗: ${error.message}`);
  }
} 