import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { 
  AdPlacement, 
  AdCampaign, 
  AdCreative, 
  AdPlacementAssignment,
  AdRequestContext,
  AdServeResponse
} from './types';

const db = admin.firestore();

// ========================
// 廣告位置 (AdPlacement) CRUD 操作
// ========================

/**
 * 創建新的廣告位置
 * 
 * @param data 廣告位置數據
 * @returns 創建的廣告位置ID和數據
 */
export async function createAdPlacement(data: Omit<AdPlacement, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string, data: AdPlacement }> {
  try {
    // 驗證必填字段
    if (!data.name || !data.type || !data.location || !data.size || !data.maxAdsPerView) {
      throw new Error('缺少必填字段: name, type, location, size, maxAdsPerView');
    }
    
    // 準備要保存的數據
    const now = admin.firestore.Timestamp.now();
    const adPlacementData: Omit<AdPlacement, 'id'> = {
      ...data,
      status: data.status || 'active',
      createdAt: now,
      updatedAt: now
    };
    
    // 創建文檔
    const docRef = await db.collection('adPlacements').add(adPlacementData);
    
    // 返回創建的數據
    return {
      id: docRef.id,
      data: {
        id: docRef.id,
        ...adPlacementData
      } as AdPlacement
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`創建廣告位置失敗:`, error);
    throw new Error(`創建廣告位置時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 根據ID獲取廣告位置
 * 
 * @param id 廣告位置ID
 * @returns 廣告位置數據，如果不存在則返回null
 */
export async function getAdPlacementById(id: string): Promise<AdPlacement | null> {
  try {
    const docRef = db.collection('adPlacements').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    const data = docSnap.data() as Omit<AdPlacement, 'id'>;
    
    // 轉換時間戳為Date對象
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt instanceof admin.firestore.Timestamp 
        ? data.createdAt.toDate() 
        : data.createdAt,
      updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
        ? data.updatedAt.toDate() 
        : data.updatedAt
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告位置失敗 (ID: ${id}):`, error);
    throw new Error(`獲取廣告位置時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 獲取廣告位置列表
 * 
 * @param filters 篩選條件
 * @returns 廣告位置列表
 */
export async function listAdPlacements(filters?: {
  status?: 'active' | 'inactive';
  type?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}): Promise<AdPlacement[]> {
  try {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('adPlacements');
    
    // 應用篩選條件
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    
    if (filters?.type) {
      query = query.where('type', '==', filters.type);
    }
    
    if (filters?.tenantId) {
      query = query.where('availableToTenants', 'array-contains', filters.tenantId);
    }
    
    // 應用排序、分頁
    query = query.orderBy('createdAt', 'desc');
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    // 執行查詢
    const querySnapshot = await query.get();
    
    // 處理結果
    const placements: AdPlacement[] = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data() as Omit<AdPlacement, 'id'>;
      
      placements.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt,
        updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
          ? data.updatedAt.toDate() 
          : data.updatedAt
      });
    });
    
    return placements;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告位置列表失敗:`, error);
    throw new Error(`獲取廣告位置列表時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 更新廣告位置
 * 
 * @param id 廣告位置ID
 * @param data 要更新的數據
 * @returns 更新後的廣告位置數據
 */
export async function updateAdPlacement(id: string, data: Partial<Omit<AdPlacement, 'id' | 'createdAt' | 'updatedAt'>>): Promise<AdPlacement | null> {
  try {
    const docRef = db.collection('adPlacements').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    // 準備更新數據
    const updateData = {
      ...data,
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    // 更新文檔
    await docRef.update(updateData);
    
    // 獲取更新後的數據
    return await getAdPlacementById(id);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`更新廣告位置失敗 (ID: ${id}):`, error);
    throw new Error(`更新廣告位置時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 更新廣告位置狀態
 * 
 * @param id 廣告位置ID
 * @param status 新狀態
 * @returns 更新後的廣告位置數據
 */
export async function updateAdPlacementStatus(id: string, status: 'active' | 'inactive'): Promise<AdPlacement | null> {
  return updateAdPlacement(id, { status });
}

/**
 * 刪除廣告位置
 * 
 * @param id 廣告位置ID
 * @returns 是否成功刪除
 */
export async function deleteAdPlacement(id: string): Promise<boolean> {
  try {
    const docRef = db.collection('adPlacements').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return false;
    }
    
    // 刪除文檔
    await docRef.delete();
    
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`刪除廣告位置失敗 (ID: ${id}):`, error);
    throw new Error(`刪除廣告位置時發生錯誤: ${errorMessage}`);
  }
}

// ========================
// 廣告活動 (AdCampaign) CRUD 操作
// ========================

/**
 * 創建新的廣告活動
 * 
 * @param data 廣告活動數據
 * @returns 創建的廣告活動ID和數據
 */
export async function createAdCampaign(data: Omit<AdCampaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string, data: AdCampaign }> {
  try {
    // 驗證必填字段
    if (!data.tenantId || !data.name || !data.budget || !data.startDate || !data.placementIds || !data.contentIds) {
      throw new Error('缺少必填字段: tenantId, name, budget, startDate, placementIds, contentIds');
    }
    
    // 準備要保存的數據
    const now = admin.firestore.Timestamp.now();
    const adCampaignData: Omit<AdCampaign, 'id'> = {
      ...data,
      status: data.status || 'draft',
      createdAt: now,
      updatedAt: now
    };
    
    // 創建文檔
    const docRef = await db.collection('adCampaigns').add(adCampaignData);
    
    // 返回創建的數據
    return {
      id: docRef.id,
      data: {
        id: docRef.id,
        ...adCampaignData
      } as AdCampaign
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`創建廣告活動失敗:`, error);
    throw new Error(`創建廣告活動時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 根據ID獲取廣告活動
 * 
 * @param id 廣告活動ID
 * @returns 廣告活動數據，如果不存在則返回null
 */
export async function getAdCampaignById(id: string): Promise<AdCampaign | null> {
  try {
    const docRef = db.collection('adCampaigns').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    const data = docSnap.data() as Omit<AdCampaign, 'id'>;
    
    // 轉換時間戳為Date對象
    return {
      id: docSnap.id,
      ...data,
      startDate: data.startDate instanceof admin.firestore.Timestamp 
        ? data.startDate.toDate() 
        : data.startDate,
      endDate: data.endDate instanceof admin.firestore.Timestamp 
        ? data.endDate.toDate() 
        : data.endDate,
      createdAt: data.createdAt instanceof admin.firestore.Timestamp 
        ? data.createdAt.toDate() 
        : data.createdAt,
      updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
        ? data.updatedAt.toDate() 
        : data.updatedAt,
      performance: data.performance ? {
        ...data.performance,
        lastUpdated: data.performance.lastUpdated instanceof admin.firestore.Timestamp 
          ? data.performance.lastUpdated.toDate() 
          : data.performance.lastUpdated
      } : undefined
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告活動失敗 (ID: ${id}):`, error);
    throw new Error(`獲取廣告活動時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 獲取廣告活動列表
 * 
 * @param filters 篩選條件
 * @returns 廣告活動列表
 */
export async function listAdCampaigns(filters?: {
  tenantId?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  limit?: number;
  offset?: number;
}): Promise<AdCampaign[]> {
  try {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('adCampaigns');
    
    // 應用篩選條件
    if (filters?.tenantId) {
      query = query.where('tenantId', '==', filters.tenantId);
    }
    
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    
    // 應用排序、分頁
    query = query.orderBy('createdAt', 'desc');
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    // 執行查詢
    const querySnapshot = await query.get();
    
    // 處理結果
    const campaigns: AdCampaign[] = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data() as Omit<AdCampaign, 'id'>;
      
      campaigns.push({
        id: doc.id,
        ...data,
        startDate: data.startDate instanceof admin.firestore.Timestamp 
          ? data.startDate.toDate() 
          : data.startDate,
        endDate: data.endDate instanceof admin.firestore.Timestamp 
          ? data.endDate.toDate() 
          : data.endDate,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt,
        updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
          ? data.updatedAt.toDate() 
          : data.updatedAt,
        performance: data.performance ? {
          ...data.performance,
          lastUpdated: data.performance.lastUpdated instanceof admin.firestore.Timestamp 
            ? data.performance.lastUpdated.toDate() 
            : data.performance.lastUpdated
        } : undefined
      });
    });
    
    return campaigns;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告活動列表失敗:`, error);
    throw new Error(`獲取廣告活動列表時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 更新廣告活動
 * 
 * @param id 廣告活動ID
 * @param data 要更新的數據
 * @returns 更新後的廣告活動數據
 */
export async function updateAdCampaign(id: string, data: Partial<Omit<AdCampaign, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): Promise<AdCampaign | null> {
  try {
    const docRef = db.collection('adCampaigns').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    // 準備更新數據
    const updateData = {
      ...data,
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    // 更新文檔
    await docRef.update(updateData);
    
    // 獲取更新後的數據
    return await getAdCampaignById(id);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`更新廣告活動失敗 (ID: ${id}):`, error);
    throw new Error(`更新廣告活動時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 更新廣告活動狀態
 * 
 * @param id 廣告活動ID
 * @param status 新狀態
 * @returns 更新後的廣告活動數據
 */
export async function updateAdCampaignStatus(id: string, status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'): Promise<AdCampaign | null> {
  return updateAdCampaign(id, { status });
}

/**
 * 刪除廣告活動
 * 
 * @param id 廣告活動ID
 * @returns 是否成功刪除
 */
export async function deleteAdCampaign(id: string): Promise<boolean> {
  try {
    const docRef = db.collection('adCampaigns').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return false;
    }
    
    // 刪除文檔
    await docRef.delete();
    
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`刪除廣告活動失敗 (ID: ${id}):`, error);
    throw new Error(`刪除廣告活動時發生錯誤: ${errorMessage}`);
  }
}

// ========================
// 廣告創意 (AdCreative) CRUD 操作
// ========================

/**
 * 創建新的廣告創意
 * 
 * @param data 廣告創意數據
 * @returns 創建的廣告創意ID和數據
 */
export async function createAdCreative(data: Omit<AdCreative, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string, data: AdCreative }> {
  try {
    // 驗證必填字段
    if (!data.tenantId || !data.name || !data.type || !data.content || !data.targetUrl) {
      throw new Error('缺少必填字段: tenantId, name, type, content, targetUrl');
    }
    
    // 驗證內容
    if (data.type === 'image' && !data.content.imageUrl) {
      throw new Error('圖片類型的創意必須提供 imageUrl');
    } else if (data.type === 'video' && !data.content.videoUrl) {
      throw new Error('視頻類型的創意必須提供 videoUrl');
    } else if (data.type === 'html' && !data.content.htmlContent) {
      throw new Error('HTML類型的創意必須提供 htmlContent');
    }
    
    // 準備要保存的數據
    const now = admin.firestore.Timestamp.now();
    const adCreativeData: Omit<AdCreative, 'id'> = {
      ...data,
      status: data.status || 'draft',
      approvalStatus: data.approvalStatus || 'pending',
      createdAt: now,
      updatedAt: now
    };
    
    // 創建文檔
    const docRef = await db.collection('adCreatives').add(adCreativeData);
    
    // 返回創建的數據
    return {
      id: docRef.id,
      data: {
        id: docRef.id,
        ...adCreativeData
      } as AdCreative
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`創建廣告創意失敗:`, error);
    throw new Error(`創建廣告創意時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 根據ID獲取廣告創意
 * 
 * @param id 廣告創意ID
 * @returns 廣告創意數據，如果不存在則返回null
 */
export async function getAdCreativeById(id: string): Promise<AdCreative | null> {
  try {
    const docRef = db.collection('adCreatives').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    const data = docSnap.data() as Omit<AdCreative, 'id'>;
    
    // 轉換時間戳為Date對象
    return {
      id: docSnap.id,
      ...data,
      startDate: data.startDate instanceof admin.firestore.Timestamp 
        ? data.startDate.toDate() 
        : data.startDate,
      endDate: data.endDate instanceof admin.firestore.Timestamp 
        ? data.endDate.toDate() 
        : data.endDate,
      createdAt: data.createdAt instanceof admin.firestore.Timestamp 
        ? data.createdAt.toDate() 
        : data.createdAt,
      updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
        ? data.updatedAt.toDate() 
        : data.updatedAt,
      performance: data.performance ? {
        ...data.performance,
        lastUpdated: data.performance.lastUpdated instanceof admin.firestore.Timestamp 
          ? data.performance.lastUpdated.toDate() 
          : data.performance.lastUpdated
      } : undefined
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告創意失敗 (ID: ${id}):`, error);
    throw new Error(`獲取廣告創意時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 獲取廣告創意列表
 * 
 * @param filters 篩選條件
 * @returns 廣告創意列表
 */
export async function listAdCreatives(filters?: {
  tenantId?: string;
  campaignId?: string;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  type?: 'image' | 'video' | 'html' | 'text';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  limit?: number;
  offset?: number;
}): Promise<AdCreative[]> {
  try {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('adCreatives');
    
    // 應用篩選條件
    if (filters?.tenantId) {
      query = query.where('tenantId', '==', filters.tenantId);
    }
    
    if (filters?.campaignId) {
      query = query.where('campaignId', '==', filters.campaignId);
    }
    
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    
    if (filters?.type) {
      query = query.where('type', '==', filters.type);
    }
    
    if (filters?.approvalStatus) {
      query = query.where('approvalStatus', '==', filters.approvalStatus);
    }
    
    // 應用排序、分頁
    query = query.orderBy('createdAt', 'desc');
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    // 執行查詢
    const querySnapshot = await query.get();
    
    // 處理結果
    const creatives: AdCreative[] = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data() as Omit<AdCreative, 'id'>;
      
      creatives.push({
        id: doc.id,
        ...data,
        startDate: data.startDate instanceof admin.firestore.Timestamp 
          ? data.startDate.toDate() 
          : data.startDate,
        endDate: data.endDate instanceof admin.firestore.Timestamp 
          ? data.endDate.toDate() 
          : data.endDate,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt,
        updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
          ? data.updatedAt.toDate() 
          : data.updatedAt,
        performance: data.performance ? {
          ...data.performance,
          lastUpdated: data.performance.lastUpdated instanceof admin.firestore.Timestamp 
            ? data.performance.lastUpdated.toDate() 
            : data.performance.lastUpdated
        } : undefined
      });
    });
    
    return creatives;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告創意列表失敗:`, error);
    throw new Error(`獲取廣告創意列表時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 更新廣告創意
 * 
 * @param id 廣告創意ID
 * @param data 要更新的數據
 * @returns 更新後的廣告創意數據
 */
export async function updateAdCreative(id: string, data: Partial<Omit<AdCreative, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>): Promise<AdCreative | null> {
  try {
    const docRef = db.collection('adCreatives').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    // 準備更新數據
    const updateData = {
      ...data,
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    // 更新文檔
    await docRef.update(updateData);
    
    // 獲取更新後的數據
    return await getAdCreativeById(id);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`更新廣告創意失敗 (ID: ${id}):`, error);
    throw new Error(`更新廣告創意時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 更新廣告創意狀態
 * 
 * @param id 廣告創意ID
 * @param status 新狀態
 * @returns 更新後的廣告創意數據
 */
export async function updateAdCreativeStatus(id: string, status: 'draft' | 'active' | 'paused' | 'archived'): Promise<AdCreative | null> {
  return updateAdCreative(id, { status });
}

/**
 * 更新廣告創意審核狀態
 * 
 * @param id 廣告創意ID
 * @param approvalStatus 新審核狀態
 * @param feedback 審核反饋
 * @returns 更新後的廣告創意數據
 */
export async function updateAdCreativeApprovalStatus(id: string, approvalStatus: 'pending' | 'approved' | 'rejected', feedback?: string): Promise<AdCreative | null> {
  return updateAdCreative(id, { 
    approvalStatus,
    ...(feedback && { approvalFeedback: feedback })
  });
}

/**
 * 刪除廣告創意
 * 
 * @param id 廣告創意ID
 * @returns 是否成功刪除
 */
export async function deleteAdCreative(id: string): Promise<boolean> {
  try {
    const docRef = db.collection('adCreatives').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return false;
    }
    
    // 刪除文檔
    await docRef.delete();
    
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`刪除廣告創意失敗 (ID: ${id}):`, error);
    throw new Error(`刪除廣告創意時發生錯誤: ${errorMessage}`);
  }
}

// ========================
// 廣告放置分配 (AdPlacementAssignment) CRUD 操作
// ========================

/**
 * 創建廣告放置分配
 * 用於將特定廣告創意分配到特定廣告位置
 * 
 * @param data 廣告放置分配數據
 * @returns 創建的分配ID和數據
 */
export async function createAdPlacementAssignment(data: Omit<AdPlacementAssignment, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string, data: AdPlacementAssignment }> {
  try {
    // 驗證必填字段
    if (!data.placementId || !data.creativeId || !data.tenantId || !data.priority || !data.startDate) {
      throw new Error('缺少必填字段: placementId, creativeId, tenantId, priority, startDate');
    }
    
    // 驗證廣告位置和創意是否存在
    const placementRef = db.collection('adPlacements').doc(data.placementId);
    const placementSnap = await placementRef.get();
    
    if (!placementSnap.exists) {
      throw new Error(`廣告位置 (ID: ${data.placementId}) 不存在`);
    }
    
    const creativeRef = db.collection('adCreatives').doc(data.creativeId);
    const creativeSnap = await creativeRef.get();
    
    if (!creativeSnap.exists) {
      throw new Error(`廣告創意 (ID: ${data.creativeId}) 不存在`);
    }
    
    // 驗證是否存在有效的廣告活動
    if (data.campaignId) {
      const campaignRef = db.collection('adCampaigns').doc(data.campaignId);
      const campaignSnap = await campaignRef.get();
      
      if (!campaignSnap.exists) {
        throw new Error(`廣告活動 (ID: ${data.campaignId}) 不存在`);
      }
    }
    
    // 驗證創意是否與該租戶相關
    const creativeData = creativeSnap.data() as AdCreative;
    if (creativeData.tenantId !== data.tenantId) {
      throw new Error(`廣告創意 (ID: ${data.creativeId}) 不屬於該租戶 (ID: ${data.tenantId})`);
    }
    
    // 如果指定了廣告活動，驗證該活動是否與該租戶相關
    if (data.campaignId) {
      const campaignRef = db.collection('adCampaigns').doc(data.campaignId);
      const campaignSnap = await campaignRef.get();
      
      if (campaignSnap.exists) {
        const campaignData = campaignSnap.data() as AdCampaign;
        if (campaignData.tenantId !== data.tenantId) {
          throw new Error(`廣告活動 (ID: ${data.campaignId}) 不屬於該租戶 (ID: ${data.tenantId})`);
        }
      }
    }
    
    // 準備要保存的數據
    const now = admin.firestore.Timestamp.now();
    const assignmentData: Omit<AdPlacementAssignment, 'id'> = {
      ...data,
      status: data.status || 'active',
      createdAt: now,
      updatedAt: now,
      performance: data.performance || {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        lastUpdated: now
      }
    };
    
    // 創建文檔
    const docRef = await db.collection('adPlacementAssignments').add(assignmentData);
    
    // 返回創建的數據
    return {
      id: docRef.id,
      data: {
        id: docRef.id,
        ...assignmentData
      } as AdPlacementAssignment
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`創建廣告放置分配失敗:`, error);
    throw new Error(`創建廣告放置分配時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 根據ID獲取廣告放置分配
 * 
 * @param id 廣告放置分配ID
 * @returns 廣告放置分配數據，如果不存在則返回null
 */
export async function getAdPlacementAssignmentById(id: string): Promise<AdPlacementAssignment | null> {
  try {
    const docRef = db.collection('adPlacementAssignments').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    const data = docSnap.data() as Omit<AdPlacementAssignment, 'id'>;
    
    // 轉換時間戳為Date對象
    return {
      id: docSnap.id,
      ...data,
      startDate: data.startDate instanceof admin.firestore.Timestamp 
        ? data.startDate.toDate() 
        : data.startDate,
      endDate: data.endDate instanceof admin.firestore.Timestamp 
        ? data.endDate.toDate() 
        : data.endDate,
      createdAt: data.createdAt instanceof admin.firestore.Timestamp 
        ? data.createdAt.toDate() 
        : data.createdAt,
      updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
        ? data.updatedAt.toDate() 
        : data.updatedAt,
      performance: data.performance ? {
        ...data.performance,
        lastUpdated: data.performance.lastUpdated instanceof admin.firestore.Timestamp 
          ? data.performance.lastUpdated.toDate() 
          : data.performance.lastUpdated
      } : undefined
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告放置分配失敗 (ID: ${id}):`, error);
    throw new Error(`獲取廣告放置分配時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 獲取廣告放置分配列表
 * 
 * @param filters 篩選條件
 * @returns 廣告放置分配列表
 */
export async function listAdPlacementAssignments(filters?: {
  placementId?: string;
  creativeId?: string;
  campaignId?: string;
  tenantId?: string;
  status?: 'active' | 'inactive' | 'scheduled' | 'completed';
  limit?: number;
  offset?: number;
}): Promise<AdPlacementAssignment[]> {
  try {
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('adPlacementAssignments');
    
    // 應用篩選條件
    if (filters?.placementId) {
      query = query.where('placementId', '==', filters.placementId);
    }
    
    if (filters?.creativeId) {
      query = query.where('creativeId', '==', filters.creativeId);
    }
    
    if (filters?.campaignId) {
      query = query.where('campaignId', '==', filters.campaignId);
    }
    
    if (filters?.tenantId) {
      query = query.where('tenantId', '==', filters.tenantId);
    }
    
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    
    // 應用排序、分頁
    // 首先按優先級排序，高優先級的排在前面
    query = query.orderBy('priority', 'desc');
    // 其次按創建時間排序，新的排在前面
    query = query.orderBy('createdAt', 'desc');
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    // 執行查詢
    const querySnapshot = await query.get();
    
    // 處理結果
    const assignments: AdPlacementAssignment[] = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data() as Omit<AdPlacementAssignment, 'id'>;
      
      assignments.push({
        id: doc.id,
        ...data,
        startDate: data.startDate instanceof admin.firestore.Timestamp 
          ? data.startDate.toDate() 
          : data.startDate,
        endDate: data.endDate instanceof admin.firestore.Timestamp 
          ? data.endDate.toDate() 
          : data.endDate,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt,
        updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
          ? data.updatedAt.toDate() 
          : data.updatedAt,
        performance: data.performance ? {
          ...data.performance,
          lastUpdated: data.performance.lastUpdated instanceof admin.firestore.Timestamp 
            ? data.performance.lastUpdated.toDate() 
            : data.performance.lastUpdated
        } : undefined
      });
    });
    
    return assignments;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告放置分配列表失敗:`, error);
    throw new Error(`獲取廣告放置分配列表時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 更新廣告放置分配
 * 
 * @param id 廣告放置分配ID
 * @param data 要更新的數據
 * @returns 更新後的廣告放置分配數據
 */
export async function updateAdPlacementAssignment(id: string, data: Partial<Omit<AdPlacementAssignment, 'id' | 'placementId' | 'creativeId' | 'tenantId' | 'createdAt' | 'updatedAt'>>): Promise<AdPlacementAssignment | null> {
  try {
    const docRef = db.collection('adPlacementAssignments').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    // 準備更新數據
    const updateData = {
      ...data,
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    // 更新文檔
    await docRef.update(updateData);
    
    // 獲取更新後的數據
    return await getAdPlacementAssignmentById(id);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`更新廣告放置分配失敗 (ID: ${id}):`, error);
    throw new Error(`更新廣告放置分配時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 更新廣告放置分配狀態
 * 
 * @param id 廣告放置分配ID
 * @param status 新狀態
 * @returns 更新後的廣告放置分配數據
 */
export async function updateAdPlacementAssignmentStatus(id: string, status: 'active' | 'inactive' | 'scheduled' | 'completed'): Promise<AdPlacementAssignment | null> {
  return updateAdPlacementAssignment(id, { status });
}

/**
 * 更新廣告放置分配的效能數據
 * 
 * @param id 廣告放置分配ID
 * @param impressions 新增的曝光次數
 * @param clicks 新增的點擊次數
 * @returns 更新後的廣告放置分配數據
 */
export async function updateAdPlacementAssignmentPerformance(id: string, impressions: number = 0, clicks: number = 0): Promise<AdPlacementAssignment | null> {
  try {
    const docRef = db.collection('adPlacementAssignments').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    const data = docSnap.data() as Record<string, any>;
    
    // 安全訪問performance屬性
    let currentImpressions = 0;
    let currentClicks = 0;
    
    // 檢查performance是否存在且包含有效的impressions和clicks值
    if (data.performance && typeof data.performance === 'object') {
      if (typeof data.performance.impressions === 'number') {
        currentImpressions = data.performance.impressions;
      }
      
      if (typeof data.performance.clicks === 'number') {
        currentClicks = data.performance.clicks;
      }
    }
    
    const newImpressions = currentImpressions + impressions;
    const newClicks = currentClicks + clicks;
    const newCtr = newImpressions > 0 ? (newClicks / newImpressions) * 100 : 0; // 點擊率百分比
    
    // 準備更新數據
    const updateData = {
      performance: {
        impressions: newImpressions,
        clicks: newClicks,
        ctr: newCtr,
        lastUpdated: admin.firestore.Timestamp.now()
      },
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    // 更新文檔
    await docRef.update(updateData);
    
    // 獲取更新後的數據
    return await getAdPlacementAssignmentById(id);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`更新廣告放置分配效能數據失敗 (ID: ${id}):`, error);
    throw new Error(`更新廣告放置分配效能數據時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 刪除廣告放置分配
 * 
 * @param id 廣告放置分配ID
 * @returns 是否成功刪除
 */
export async function deleteAdPlacementAssignment(id: string): Promise<boolean> {
  try {
    const docRef = db.collection('adPlacementAssignments').doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return false;
    }
    
    // 刪除文檔
    await docRef.delete();
    
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`刪除廣告放置分配失敗 (ID: ${id}):`, error);
    throw new Error(`刪除廣告放置分配時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 獲取適用於特定廣告位置的活躍分配
 * 此函數用於前端獲取當前應該在特定廣告位置顯示的廣告創意
 * 
 * @param placementId 廣告位置ID
 * @param limit 返回結果數量限制，默認為位置的maxAdsPerView
 * @returns 適用的廣告放置分配列表
 */
export async function getActiveAssignmentsForPlacement(placementId: string, limit?: number): Promise<AdPlacementAssignment[]> {
  try {
    // 先獲取廣告位置信息，確認最大顯示數
    const placementRef = db.collection('adPlacements').doc(placementId);
    const placementSnap = await placementRef.get();
    
    if (!placementSnap.exists) {
      throw new Error(`廣告位置 (ID: ${placementId}) 不存在`);
    }
    
    const placement = placementSnap.data() as AdPlacement;
    const maxDisplayCount = limit || placement.maxAdsPerView || 1;
    
    // 獲取當前日期時間
    const now = admin.firestore.Timestamp.now();
    const currentDate = now.toDate();
    const currentDay = currentDate.getDay(); // 0-6，0 表示週日
    const currentHour = currentDate.getHours(); // 0-23
    
    // 查詢活躍的廣告分配
    const query = db.collection('adPlacementAssignments')
      .where('placementId', '==', placementId)
      .where('status', '==', 'active')
      .where('startDate', '<=', now);
    
    const querySnapshot = await query.get();
    
    // 處理結果，過濾出符合當前時間條件的分配
    const eligibleAssignments: AdPlacementAssignment[] = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data() as Omit<AdPlacementAssignment, 'id'>;
      
      // 檢查結束日期（如果有）
      if (data.endDate && data.endDate instanceof admin.firestore.Timestamp && data.endDate < now) {
        return; // 跳過已過期的
      }
      
      // 檢查週幾排程（如果有）
      if (data.schedule?.daysOfWeek && !data.schedule.daysOfWeek.includes(currentDay)) {
        return; // 跳過不在今天排程的
      }
      
      // 檢查小時排程（如果有）
      if (data.schedule?.hoursOfDay && !data.schedule.hoursOfDay.includes(currentHour)) {
        return; // 跳過不在當前小時排程的
      }
      
      // 檢查曝光限制（如果有）
      if (data.impressionLimit && data.performance?.impressions !== undefined && data.performance.impressions >= data.impressionLimit) {
        return; // 跳過已達到曝光限制的
      }
      
      // 檢查點擊限制（如果有）
      if (data.clickLimit && data.performance?.clicks !== undefined && data.performance.clicks >= data.clickLimit) {
        return; // 跳過已達到點擊限制的
      }
      
      // 通過所有條件，添加到合格列表
      eligibleAssignments.push({
        id: doc.id,
        ...data,
        startDate: data.startDate instanceof admin.firestore.Timestamp 
          ? data.startDate.toDate() 
          : data.startDate,
        endDate: data.endDate instanceof admin.firestore.Timestamp 
          ? data.endDate.toDate() 
          : data.endDate,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt,
        updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
          ? data.updatedAt.toDate() 
          : data.updatedAt,
        performance: data.performance ? {
          ...data.performance,
          lastUpdated: data.performance.lastUpdated instanceof admin.firestore.Timestamp 
            ? data.performance.lastUpdated.toDate() 
            : data.performance.lastUpdated
        } : undefined
      });
    });
    
    // 按優先級排序
    eligibleAssignments.sort((a, b) => {
      // 首先按優先級排序（高到低）
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // 優先級相同，則按點擊率排序（高到低）
      const aCtr = a.performance?.ctr || 0;
      const bCtr = b.performance?.ctr || 0;
      
      if (aCtr !== bCtr) {
        return bCtr - aCtr;
      }
      
      // 點擊率相同，按創建時間排序（新到舊）
      const aCreatedAt = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const bCreatedAt = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      
      return bCreatedAt - aCreatedAt;
    });
    
    // 返回限制數量的結果
    return eligibleAssignments.slice(0, maxDisplayCount);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告位置的活躍分配失敗 (placementId: ${placementId}):`, error);
    throw new Error(`獲取廣告位置的活躍分配時發生錯誤: ${errorMessage}`);
  }
}

// ========================
// REST API 處理函式 - 廣告放置分配
// ========================

/**
 * API處理函式 - 創建廣告放置分配
 * 端點: POST /ads/assignments
 */
export async function createAdPlacementAssignmentHandler(req: Request, res: Response): Promise<Response> {
  try {
    const data = req.body;
    
    if (!data) {
      return res.status(400).json({
        status: 'error',
        message: '無效的請求數據'
      });
    }
    
    const result = await createAdPlacementAssignment(data);
    
    return res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API創建廣告放置分配失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `創建廣告放置分配時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * API處理函式 - 獲取廣告放置分配
 * 端點: GET /ads/assignments/:assignmentId
 */
export async function getAdPlacementAssignmentHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { assignmentId } = req.params;
    
    if (!assignmentId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少廣告放置分配ID參數'
      });
    }
    
    const assignment = await getAdPlacementAssignmentById(assignmentId);
    
    if (!assignment) {
      return res.status(404).json({
        status: 'error',
        message: '廣告放置分配不存在'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: assignment
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API獲取廣告放置分配失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `獲取廣告放置分配時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * API處理函式 - 獲取廣告放置分配列表
 * 端點: GET /ads/assignments
 */
export async function listAdPlacementAssignmentsHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { placementId, creativeId, campaignId, tenantId, status, limit, offset } = req.query;
    
    const filters = {
      placementId: placementId as string | undefined,
      creativeId: creativeId as string | undefined,
      campaignId: campaignId as string | undefined,
      tenantId: tenantId as string | undefined,
      status: status as 'active' | 'inactive' | 'scheduled' | 'completed' | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined
    };
    
    const assignments = await listAdPlacementAssignments(filters);
    
    return res.status(200).json({
      status: 'success',
      data: {
        assignments,
        count: assignments.length,
        ...filters
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API獲取廣告放置分配列表失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `獲取廣告放置分配列表時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * API處理函式 - 更新廣告放置分配
 * 端點: PATCH /ads/assignments/:assignmentId
 */
export async function updateAdPlacementAssignmentHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { assignmentId } = req.params;
    const data = req.body;
    
    if (!assignmentId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少廣告放置分配ID參數'
      });
    }
    
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '無效的更新數據'
      });
    }
    
    const updatedAssignment = await updateAdPlacementAssignment(assignmentId, data);
    
    if (!updatedAssignment) {
      return res.status(404).json({
        status: 'error',
        message: '廣告放置分配不存在'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: updatedAssignment
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API更新廣告放置分配失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `更新廣告放置分配時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * API處理函式 - 更新廣告放置分配狀態
 * 端點: PATCH /ads/assignments/:assignmentId/status
 */
export async function updateAdPlacementAssignmentStatusHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { assignmentId } = req.params;
    const { status } = req.body;
    
    if (!assignmentId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少廣告放置分配ID參數'
      });
    }
    
    if (!status || !['active', 'inactive', 'scheduled', 'completed'].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: '無效的狀態值，必須為 active, inactive, scheduled 或 completed'
      });
    }
    
    const updatedAssignment = await updateAdPlacementAssignmentStatus(assignmentId, status);
    
    if (!updatedAssignment) {
      return res.status(404).json({
        status: 'error',
        message: '廣告放置分配不存在'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: updatedAssignment
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API更新廣告放置分配狀態失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `更新廣告放置分配狀態時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * API處理函式 - 刪除廣告放置分配
 * 端點: DELETE /ads/assignments/:assignmentId
 */
export async function deleteAdPlacementAssignmentHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { assignmentId } = req.params;
    
    if (!assignmentId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少廣告放置分配ID參數'
      });
    }
    
    const success = await deleteAdPlacementAssignment(assignmentId);
    
    if (!success) {
      return res.status(404).json({
        status: 'error',
        message: '廣告放置分配不存在'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      message: '廣告放置分配已成功刪除'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API刪除廣告放置分配失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `刪除廣告放置分配時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * API處理函式 - 獲取廣告位置的活躍分配（前端廣告決策使用）
 * 端點: GET /ads/placements/:placementId/active-assignments
 */
export async function getActiveAssignmentsForPlacementHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { placementId } = req.params;
    const { limit } = req.query;
    
    if (!placementId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少廣告位置ID參數'
      });
    }
    
    const limitValue = limit ? parseInt(limit as string, 10) : undefined;
    
    const activeAssignments = await getActiveAssignmentsForPlacement(placementId, limitValue);
    
    // 更新曝光次數（記錄廣告被請求的事件）
    const updatePromises = activeAssignments.map(assignment => 
      updateAdPlacementAssignmentPerformance(assignment.id, 1, 0)
    );
    
    // 不等待更新完成，避免延遲響應
    Promise.all(updatePromises).catch(error => {
      console.error('更新廣告曝光次數失敗:', error);
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        assignments: activeAssignments,
        count: activeAssignments.length,
        placementId
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API獲取廣告位置活躍分配失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `獲取廣告位置活躍分配時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * API處理函式 - 記錄廣告點擊
 * 端點: GET /ads/assignments/:assignmentId/click
 */
export async function recordAdClickHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { assignmentId } = req.params;
    const { targetUrl } = req.query;
    
    if (!assignmentId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少廣告放置分配ID參數'
      });
    }
    
    // 更新點擊次數（非同步執行，不等待結果）
    updateAdPlacementAssignmentPerformance(assignmentId, 0, 1)
      .catch(error => {
        console.error(`更新廣告點擊次數失敗 (ID: ${assignmentId}):`, error);
      });
    
    // 如果提供了targetUrl，則重定向到該URL
    if (targetUrl) {
      // 確保返回值是Promise<Response>
      res.redirect(302, targetUrl as string);
      return res; // 這裡返回res以滿足Promise<Response>的類型要求
    }
    
    // 否則返回成功信息
    return res.status(200).json({
      status: 'success',
      message: '廣告點擊已記錄'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API記錄廣告點擊失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `記錄廣告點擊時發生系統錯誤: ${errorMessage}`
    });
  }
}

// ========================
// 廣告投放服務 (Ad Serving) 功能
// ========================

/**
 * 根據廣告位置ID獲取適合的廣告
 * 此函數是廣告投放的核心邏輯，將根據優先級和條件選擇最合適的廣告
 * 
 * @param placementId 廣告位置ID
 * @param context 廣告請求上下文（可選，用於更精確的廣告定向）
 * @returns 廣告服務響應，包含廣告創意信息和追蹤數據
 */
export async function getAdForPlacement(placementId: string, context?: AdRequestContext): Promise<AdServeResponse> {
  try {
    // 1. 獲取廣告位置信息，確認是否有效
    const placementRef = db.collection('adPlacements').doc(placementId);
    const placementSnap = await placementRef.get();
    
    if (!placementSnap.exists) {
      throw new Error(`廣告位置 (ID: ${placementId}) 不存在`);
    }
    
    const placement = placementSnap.data() as AdPlacement;
    
    // 如果廣告位置非活躍狀態，返回空
    if (placement.status !== 'active') {
      console.log(`廣告位置 (ID: ${placementId}) 狀態非活躍`);
      return { creative: null };
    }
    
    // 2. 獲取所有符合條件的活躍廣告分配
    // 使用已實現的功能獲取可能的活躍分配
    const eligibleAssignments = await getActiveAssignmentsForPlacement(placementId);
    
    if (eligibleAssignments.length === 0) {
      console.log(`廣告位置 (ID: ${placementId}) 沒有符合條件的活躍廣告分配`);
      return { creative: null };
    }
    
    // 3. 根據上下文進一步篩選（如果有上下文）
    let filteredAssignments = eligibleAssignments;
    
    if (context) {
      filteredAssignments = eligibleAssignments.filter(assignment => {
        // 如果沒有顯示條件，則默認通過篩選
        if (!assignment.displayConditions) {
          return true;
        }
        
        // 設備類型篩選
        if (
          context.deviceType && 
          assignment.displayConditions.deviceTypes && 
          !assignment.displayConditions.deviceTypes.includes(context.deviceType)
        ) {
          return false;
        }
        
        // 瀏覽器類型篩選
        if (
          context.browser && 
          assignment.displayConditions.browsers && 
          !assignment.displayConditions.browsers.includes(context.browser)
        ) {
          return false;
        }
        
        // 地理位置篩選 - 國家
        if (
          context.location?.country && 
          assignment.displayConditions.geoTargeting?.countries && 
          !assignment.displayConditions.geoTargeting.countries.includes(context.location.country)
        ) {
          return false;
        }
        
        // 地理位置篩選 - 城市
        if (
          context.location?.city && 
          assignment.displayConditions.geoTargeting?.cities && 
          !assignment.displayConditions.geoTargeting.cities.includes(context.location.city)
        ) {
          return false;
        }
        
        // 地理位置篩選 - 半徑
        if (
          context.location?.coordinates && 
          assignment.displayConditions.geoTargeting?.radius
        ) {
          const radius = assignment.displayConditions.geoTargeting.radius;
          const distance = calculateDistance(
            context.location.coordinates.lat,
            context.location.coordinates.lng,
            radius.lat,
            radius.lng
          );
          
          if (distance > radius.km) {
            return false;
          }
        }
        
        // 通過所有篩選
        return true;
      });
    }
    
    if (filteredAssignments.length === 0) {
      console.log(`廣告位置 (ID: ${placementId}) 沒有符合上下文條件的廣告分配`);
      return { creative: null };
    }
    
    // 4. 根據優先級選擇廣告
    // 先獲取最高優先級
    const highestPriority = Math.max(...filteredAssignments.map(a => a.priority));
    
    // 篩選出所有具有最高優先級的分配
    const highestPriorityAssignments = filteredAssignments.filter(a => a.priority === highestPriority);
    
    // 從最高優先級的分配中隨機選擇一個
    const randomIndex = Math.floor(Math.random() * highestPriorityAssignments.length);
    const selectedAssignment = highestPriorityAssignments[randomIndex];
    
    // 5. 獲取選中的廣告創意
    const creativeRef = db.collection('adCreatives').doc(selectedAssignment.creativeId);
    const creativeSnap = await creativeRef.get();
    
    if (!creativeSnap.exists) {
      console.error(`選中的廣告創意 (ID: ${selectedAssignment.creativeId}) 不存在`);
      return { creative: null };
    }
    
    const creative = creativeSnap.data() as AdCreative;
    
    // 創建一個不含效能數據和審核信息的簡化版創意對象返回給前端
    const sanitizedCreative: AdCreative = {
      ...creative,
      id: creativeSnap.id,
      performance: undefined,  // 不向前端透露效能數據
      approvalFeedback: undefined  // 不向前端透露審核反饋
    };
    
    // 6. 準備追蹤信息
    const baseUrl = process.env.API_BASE_URL || 'https://api.example.com';
    const trackingInfo = {
      impressionUrl: `${baseUrl}/ads/assignments/${selectedAssignment.id}/impression`,
      clickUrl: `${baseUrl}/ads/assignments/${selectedAssignment.id}/click`
    };
    
    // 7. 更新分配的曝光次數（非同步執行，不等待結果）
    updateAdPlacementAssignmentPerformance(selectedAssignment.id, 1, 0)
      .catch(error => {
        console.error(`更新廣告曝光次數失敗 (ID: ${selectedAssignment.id}):`, error);
      });
    
    // 8. 返回結果
    return {
      creative: sanitizedCreative,
      assignment: {
        id: selectedAssignment.id,
        placementId: selectedAssignment.placementId
      },
      trackingInfo
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取廣告位置的廣告失敗 (placementId: ${placementId}):`, error);
    throw new Error(`獲取廣告位置的廣告時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 計算兩個地理座標之間的距離（公里）
 * 使用Haversine公式
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 地球半徑，單位公里
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // 距離，單位公里
}

/**
 * API處理函式 - 廣告投放
 * 端點: GET /ads/serve
 * 查詢參數: placementId（必須）
 */
export async function serveAdHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { placementId } = req.query;
    
    if (!placementId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必需的參數: placementId'
      });
    }
    
    // 從請求中提取上下文信息
    const context: AdRequestContext = {
      deviceType: req.query.deviceType as 'desktop' | 'mobile' | 'tablet' | undefined,
      browser: req.headers['user-agent'],
      location: {
        country: req.query.country as string | undefined,
        city: req.query.city as string | undefined,
        coordinates: req.query.lat && req.query.lng ? {
          lat: parseFloat(req.query.lat as string),
          lng: parseFloat(req.query.lng as string)
        } : undefined
      },
      userInfo: {
        userId: req.query.userId as string || req.headers['x-user-id'] as string,
        tenantId: req.query.tenantId as string || req.headers['x-tenant-id'] as string,
        userAgent: req.headers['user-agent'],
        language: req.headers['accept-language']
      },
      timestamp: admin.firestore.Timestamp.now()
    };
    
    // 獲取廣告
    const adResponse = await getAdForPlacement(placementId as string, context);
    
    return res.status(200).json({
      status: 'success',
      data: adResponse
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API廣告投放請求失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `廣告投放請求處理時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * API處理函式 - 記錄廣告曝光
 * 端點: GET /ads/assignments/:assignmentId/impression
 */
export async function recordAdImpressionHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { assignmentId } = req.params;
    
    if (!assignmentId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少廣告放置分配ID參數'
      });
    }
    
    // 更新曝光次數（非同步執行，不等待結果）
    updateAdPlacementAssignmentPerformance(assignmentId, 1, 0)
      .catch(error => {
        console.error(`更新廣告曝光次數失敗 (ID: ${assignmentId}):`, error);
      });
    
    // 返回1x1透明像素圖片
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    // 1x1透明GIF的二進制數據
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return res.status(200).send(transparentGif);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API記錄廣告曝光失敗:', error);
    
    // 即使出錯也返回1x1透明像素圖片
    res.set('Content-Type', 'image/gif');
    const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return res.status(200).send(transparentGif);
  }
} 