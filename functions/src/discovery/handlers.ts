import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { 
  PublicStoreProfile, 
  StoreStatus, 
  BusinessHours, 
  StoreLocation, 
  StoreContact,
  RankingType,
  RankingPeriod,
  StoreRankingResult,
  RankedStoreItem
} from './types';
import { GeoFirestore } from 'geofirestore';

/**
 * 根據ID獲取店家公開資料
 * 
 * @param storeId 店家ID
 * @returns 店家公開資料，如果不存在或不公開則返回null
 */
export async function getPublicStoreProfileById(storeId: string): Promise<PublicStoreProfile | null> {
  const db = admin.firestore();
  
  try {
    // 1. 檢查publicStoreProfiles集合是否存在此店家資料
    const publicProfileRef = db.collection('publicStoreProfiles').doc(storeId);
    const publicProfileDoc = await publicProfileRef.get();
    
    // 如果存在公開資料，直接返回
    if (publicProfileDoc.exists) {
      const data = publicProfileDoc.data() as PublicStoreProfile;
      
      // 轉換時間戳為Date對象
      return {
        ...data,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt,
        updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
          ? data.updatedAt.toDate() 
          : data.updatedAt,
        lastSyncedAt: data.lastSyncedAt instanceof admin.firestore.Timestamp 
          ? data.lastSyncedAt.toDate() 
          : data.lastSyncedAt,
        specialOffers: data.specialOffers?.map(offer => ({
          ...offer,
          startDate: offer.startDate instanceof admin.firestore.Timestamp 
            ? offer.startDate.toDate() 
            : offer.startDate,
          endDate: offer.endDate instanceof admin.firestore.Timestamp 
            ? offer.endDate.toDate() 
            : offer.endDate,
        }))
      };
    }
    
    // 2. 如果公開資料不存在，嘗試從stores集合獲取並轉換
    const storeRef = db.collection('stores').doc(storeId);
    const storeDoc = await storeRef.get();
    
    if (!storeDoc.exists) {
      return null; // 店家不存在
    }
    
    const storeData = storeDoc.data();
    
    // 3. 檢查店家是否允許公開資訊
    if (!storeData?.isPublicVisible) {
      return null; // 店家資訊不公開
    }
    
    // 4. 轉換store資料為PublicStoreProfile格式
    const businessHours: BusinessHours[] = [];
    
    // 處理營業時間格式轉換
    if (storeData.openHours && Array.isArray(storeData.openHours)) {
      // 假設stores集合中的openHours是按星期排序的數組
      storeData.openHours.forEach((hours, index) => {
        businessHours.push({
          day: index,
          isOpen: hours.isOpen !== false, // 默認為營業
          openTime: hours.start,
          closeTime: hours.end,
          breakStart: hours.breakStart,
          breakEnd: hours.breakEnd
        });
      });
    }
    
    // 處理地理位置轉換
    const location: StoreLocation = {
      address: storeData.location?.address || '',
      city: storeData.location?.city || '',
      district: storeData.location?.district,
      postalCode: storeData.location?.postalCode,
      lat: storeData.location?.lat || 0,
      lng: storeData.location?.lng || 0
    };
    
    // 處理聯絡資訊轉換
    const contact: StoreContact = {
      phone: storeData.contactInfo?.phone || '',
      email: storeData.contactInfo?.email,
      websiteUrl: storeData.contactInfo?.websiteUrl,
      lineId: storeData.contactInfo?.lineId,
      facebookUrl: storeData.contactInfo?.facebookUrl,
      instagramUrl: storeData.contactInfo?.instagramUrl
    };
    
    // 把店家狀態轉換成公開格式
    let status: StoreStatus = 'active';
    if (storeData.status === 'inactive') status = 'temporarily_closed';
    if (storeData.status === 'temporary_closed') status = 'temporarily_closed';
    if (storeData.status === 'permanently_closed') status = 'permanently_closed';
    if (storeData.status === 'coming_soon') status = 'coming_soon';
    
    // 5. 創建公開資料對象
    const publicProfile: PublicStoreProfile = {
      id: storeId,
      tenantId: storeData.tenantId,
      name: storeData.storeName || '',
      slug: storeData.slug || storeData.storeName?.toLowerCase().replace(/\s+/g, '-') || '',
      description: storeData.description || '',
      shortDescription: storeData.shortDescription || '',
      logoUrl: storeData.logoUrl || '',
      coverImageUrl: storeData.coverImageUrl || '',
      images: storeData.images || [],
      location,
      contact,
      businessHours,
      tags: storeData.tags || [],
      categories: storeData.categories || [],
      status,
      rating: storeData.rating || 0,
      ratingCount: storeData.ratingCount || 0,
      hasOnlineOrdering: !!storeData.hasOnlineOrdering,
      onlineOrderingUrl: storeData.onlineOrderingUrl || '',
      specialOffers: storeData.specialOffers || [],
      featuredMenuItems: storeData.featuredMenuItems || [],
      amenities: storeData.amenities || [],
      createdAt: storeData.createdAt instanceof admin.firestore.Timestamp 
        ? storeData.createdAt.toDate() 
        : new Date(),
      updatedAt: storeData.updatedAt instanceof admin.firestore.Timestamp 
        ? storeData.updatedAt.toDate() 
        : new Date(),
      lastSyncedAt: new Date()
    };
    
    return publicProfile;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取店家公開資料失敗 (ID: ${storeId}):`, error);
    throw new Error(`獲取店家公開資料時發生錯誤: ${errorMessage}`);
  }
}

/**
 * API處理函式 - 獲取單個店家公開資料
 * 端點: GET /discovery/stores/:storeId
 */
export async function getPublicStoreProfileByIdHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { storeId } = req.params;
    
    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        message: '缺少店家ID參數'
      });
    }
    
    const storeProfile = await getPublicStoreProfileById(storeId);
    
    if (!storeProfile) {
      return res.status(404).json({
        status: 'error',
        message: '店家不存在或資訊不公開'
      });
    }
    
    return res.status(200).json({
      status: 'success',
      data: storeProfile
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API獲取店家公開資料失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `獲取店家資料時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * 獲取附近店家
 * 
 * @param lat 緯度
 * @param lng 經度
 * @param radius 搜尋半徑 (公里)
 * @param limit 返回結果數量限制
 * @returns 附近店家列表
 */
export async function getNearbyStores(
  lat: number,
  lng: number,
  radius: number = 5,
  limit: number = 20
): Promise<PublicStoreProfile[]> {
  const db = admin.firestore();
  
  try {
    // 初始化GeoFirestore
    const geoFirestore = new GeoFirestore(db);
    const geoCollection = geoFirestore.collection('publicStoreProfiles');
    
    // 執行地理位置查詢
    const geoQuery = geoCollection.near({
      center: new admin.firestore.GeoPoint(lat, lng),
      radius: radius // 公里為單位
    }).limit(limit);
    
    const geoQuerySnapshot = await geoQuery.get();
    
    // 處理查詢結果
    const storePromises: Promise<PublicStoreProfile | null>[] = [];
    
    geoQuerySnapshot.docs.forEach(doc => {
      const storeId = doc.id;
      // 使用已有的函式獲取完整公開資料
      storePromises.push(getPublicStoreProfileById(storeId));
    });
    
    // 等待所有查詢完成
    const stores = await Promise.all(storePromises);
    
    // 過濾掉 null 結果
    return stores.filter((store): store is PublicStoreProfile => store !== null);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取附近店家失敗 (lat: ${lat}, lng: ${lng}, radius: ${radius}):`, error);
    throw new Error(`獲取附近店家時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 將店家資料准備為GeoFirestore可用格式
 * 
 * @param storeId 店家ID
 * @param lat 緯度
 * @param lng 經度
 * @returns 是否成功
 */
export async function prepareStoreGeoData(storeId: string, lat: number, lng: number): Promise<boolean> {
  const db = admin.firestore();
  
  try {
    // 獲取店家資料
    const storeProfile = await getPublicStoreProfileById(storeId);
    
    if (!storeProfile) {
      console.warn(`無法為不存在或不公開的店家(ID: ${storeId})準備地理資料`);
      return false;
    }
    
    // 初始化GeoFirestore
    const geoFirestore = new GeoFirestore(db);
    const geoCollection = geoFirestore.collection('publicStoreProfiles');
    
    // 更新店家資料以包含地理位置資訊
    await geoCollection.doc(storeId).set({
      ...storeProfile,
      // GeoFirestore需要coordinates字段
      coordinates: new admin.firestore.GeoPoint(lat || storeProfile.location.lat, lng || storeProfile.location.lng)
    }, { merge: true });
    
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`準備店家地理資料失敗 (ID: ${storeId}):`, error);
    throw new Error(`準備店家地理資料時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 批量處理店家地理資料
 * 用於初始化或更新多個店家的GeoFirestore資料
 * 
 * @param storeIds 店家ID陣列，若為空則處理所有公開店家
 * @returns 處理結果統計
 */
export async function batchPrepareStoreGeoData(storeIds?: string[]): Promise<{total: number, success: number, failed: number}> {
  const db = admin.firestore();
  const result = {total: 0, success: 0, failed: 0};
  
  try {
    let stores: {id: string, lat: number, lng: number}[] = [];
    
    // 如果提供了特定的storeIds
    if (storeIds && storeIds.length > 0) {
      // 獲取這些特定店家的資料
      const storePromises = storeIds.map(id => getPublicStoreProfileById(id));
      const storeProfiles = await Promise.all(storePromises);
      
      // 過濾有效的店家並提取需要的資訊
      stores = storeProfiles
        .filter((store): store is PublicStoreProfile => store !== null)
        .map(store => ({
          id: store.id,
          lat: store.location.lat,
          lng: store.location.lng
        }));
    } else {
      // 如果沒有提供storeIds，獲取所有publicStoreProfiles文檔
      const publicProfilesSnapshot = await db.collection('publicStoreProfiles').get();
      
      stores = publicProfilesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          lat: data.location?.lat || 0,
          lng: data.location?.lng || 0
        };
      });
    }
    
    result.total = stores.length;
    
    // 批量處理每家店
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_LIMIT = 500; // Firestore一次最多處理500個文檔
    
    for (const store of stores) {
      try {
        // 如果沒有有效的經緯度，跳過
        if (!store.lat || !store.lng) {
          console.warn(`店家 ${store.id} 缺少有效的經緯度，已跳過`);
          result.failed++;
          continue;
        }
        
        // 直接使用 Firestore 原生的 DocumentReference
        const docRef = db.collection('publicStoreProfiles').doc(store.id);
        
        // 設置 GeoFirestore 所需的 coordinates 屬性
        batch.set(docRef, {
          coordinates: new admin.firestore.GeoPoint(store.lat, store.lng)
        }, { merge: true });
        
        batchCount++;
        
        // 如果達到批次上限，提交並重置
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`已處理 ${batchCount} 筆地理資料`);
          batchCount = 0;
        }
        
        result.success++;
      } catch (error) {
        console.error(`處理店家 ${store.id} 地理資料時發生錯誤:`, error);
        result.failed++;
      }
    }
    
    // 提交剩餘的批次
    if (batchCount > 0) {
      await batch.commit();
      console.log(`已處理最後 ${batchCount} 筆地理資料`);
    }
    
    console.log(`批量處理地理資料完成: 總計 ${result.total} 筆, 成功 ${result.success} 筆, 失敗 ${result.failed} 筆`);
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`批量處理店家地理資料失敗:`, error);
    throw new Error(`批量處理店家地理資料時發生錯誤: ${errorMessage}`);
  }
}

/**
 * API處理函式 - 獲取附近店家
 * 端點: GET /discovery/stores/nearby
 */
export async function getNearbyStoresHandler(req: Request, res: Response): Promise<Response> {
  try {
    // 從查詢參數中獲取地理位置信息
    const { lat, lng, radius, limit } = req.query;
    
    // 參數驗證
    if (!lat || !lng) {
      return res.status(400).json({
        status: 'error',
        message: '缺少必要的地理位置參數 (lat, lng)'
      });
    }
    
    // 轉換參數
    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const searchRadius = radius ? parseFloat(radius as string) : 5; // 默認5公里
    const resultLimit = limit ? parseInt(limit as string, 10) : 20; // 默認20筆
    
    // 參數範圍驗證
    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({
        status: 'error',
        message: '緯度參數無效 (有效範圍: -90 到 90)'
      });
    }
    
    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        status: 'error',
        message: '經度參數無效 (有效範圍: -180 到 180)'
      });
    }
    
    if (isNaN(searchRadius) || searchRadius <= 0 || searchRadius > 50) {
      return res.status(400).json({
        status: 'error',
        message: '搜尋半徑參數無效 (有效範圍: 0 到 50 公里)'
      });
    }
    
    // 執行查詢
    const nearbyStores = await getNearbyStores(latitude, longitude, searchRadius, resultLimit);
    
    // 返回結果
    return res.status(200).json({
      status: 'success',
      data: {
        stores: nearbyStores,
        meta: {
          count: nearbyStores.length,
          center: { lat: latitude, lng: longitude },
          radius: searchRadius,
          limit: resultLimit
        }
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API獲取附近店家失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `獲取附近店家時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * API處理函式 - 初始化店家地理資料
 * 端點: POST /discovery/admin/initialize-geo-data
 * 注意：此API應該受到權限保護，只允許管理員調用
 */
export async function initializeGeoDataHandler(req: Request, res: Response): Promise<Response> {
  try {
    // 驗證管理員權限（在實際部署時，應加入驗證邏輯）
    // 例如：檢查請求中的token，驗證調用者是否有admin權限
    
    // 從請求體中獲取可選的storeIds列表
    const { storeIds } = req.body;
    
    // 執行批量處理
    const result = await batchPrepareStoreGeoData(storeIds);
    
    // 返回處理結果
    return res.status(200).json({
      status: 'success',
      message: `地理資料初始化完成: 總計 ${result.total} 筆, 成功 ${result.success} 筆, 失敗 ${result.failed} 筆`,
      data: result
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API初始化店家地理資料失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `初始化地理資料時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * 獲取所有公開店家資料
 * 
 * @param limit 返回結果數量限制
 * @param offset 偏移量，用於分頁
 * @param sortBy 排序欄位
 * @returns 店家列表
 */
export async function getAllPublicStores(
  limit: number = 20,
  offset: number = 0,
  sortBy: string = 'name'
): Promise<PublicStoreProfile[]> {
  const db = admin.firestore();
  
  try {
    // 查詢publicStoreProfiles集合
    let query: admin.firestore.Query<admin.firestore.DocumentData> = db.collection('publicStoreProfiles');
    
    // 添加簡單排序
    query = query.orderBy(sortBy);
    
    // 添加分頁
    query = query.limit(limit).offset(offset);
    
    // 執行查詢
    const querySnapshot = await query.get();
    
    // 處理結果
    const stores: PublicStoreProfile[] = [];
    
    for (const doc of querySnapshot.docs) {
      const data = doc.data() as PublicStoreProfile;
      
      // 轉換時間戳為Date對象
      const storeProfile: PublicStoreProfile = {
        ...data,
        id: doc.id,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate() 
          : data.createdAt,
        updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
          ? data.updatedAt.toDate() 
          : data.updatedAt,
        lastSyncedAt: data.lastSyncedAt instanceof admin.firestore.Timestamp 
          ? data.lastSyncedAt.toDate() 
          : data.lastSyncedAt,
        specialOffers: data.specialOffers?.map(offer => ({
          ...offer,
          startDate: offer.startDate instanceof admin.firestore.Timestamp 
            ? offer.startDate.toDate() 
            : offer.startDate,
          endDate: offer.endDate instanceof admin.firestore.Timestamp 
            ? offer.endDate.toDate() 
            : offer.endDate,
        }))
      };
      
      stores.push(storeProfile);
    }
    
    return stores;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取所有公開店家失敗:`, error);
    throw new Error(`獲取所有公開店家時發生錯誤: ${errorMessage}`);
  }
}

/**
 * API處理函式 - 獲取所有公開店家
 * 端點: GET /discovery/stores
 */
export async function getAllPublicStoresHandler(req: Request, res: Response): Promise<Response> {
  try {
    // 從查詢參數中獲取分頁和排序信息
    const { limit, offset, sort } = req.query;
    
    // 轉換參數
    const resultLimit = limit ? parseInt(limit as string, 10) : 20; // 默認20筆
    const resultOffset = offset ? parseInt(offset as string, 10) : 0; // 默認0
    const sortBy = sort as string || 'name'; // 默認按名稱排序
    
    // 參數驗證
    if (isNaN(resultLimit) || resultLimit < 1 || resultLimit > 100) {
      return res.status(400).json({
        status: 'error',
        message: '返回數量限制參數無效 (有效範圍: 1 到 100)'
      });
    }
    
    if (isNaN(resultOffset) || resultOffset < 0) {
      return res.status(400).json({
        status: 'error',
        message: '偏移量參數無效 (必須大於或等於0)'
      });
    }
    
    // 執行查詢
    const stores = await getAllPublicStores(resultLimit, resultOffset, sortBy);
    
    // 返回結果
    return res.status(200).json({
      status: 'success',
      data: {
        stores,
        meta: {
          count: stores.length,
          limit: resultLimit,
          offset: resultOffset,
          sortBy
        }
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API獲取所有公開店家失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `獲取店家列表時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * 搜尋店家
 * 
 * @param params 搜尋參數
 * @returns 符合條件的店家列表
 */
export async function searchStores(
  params: {
    query?: string;
    category?: string;
    tag?: string;
    limit?: number;
    offset?: number;
  }
): Promise<PublicStoreProfile[]> {
  const db = admin.firestore();
  const { query, category, tag, limit = 20, offset = 0 } = params;
  
  try {
    // 從 publicStoreProfiles 集合開始查詢
    let baseQuery = db.collection('publicStoreProfiles')
                     .where('status', 'in', ['active', 'temporarily_closed']); // 只查詢有效的店家
    
    let queryResults: PublicStoreProfile[] = [];
    
    // 如果有提供標籤參數
    if (tag && tag.trim()) {
      // 標籤使用 array-contains 查詢
      baseQuery = baseQuery.where('tags', 'array-contains', tag.trim());
    }
    
    // 如果有提供分類參數
    if (category && category.trim()) {
      // 分類也使用 array-contains 查詢
      baseQuery = baseQuery.where('categories', 'array-contains', category.trim());
    }
    
    // 關鍵字查詢需要特殊處理，因為Firestore不支持同時使用多個array-contains
    if (query && query.trim()) {
      const searchTerm = query.trim();
      
      // 若已使用標籤或分類，需要執行查詢後在結果中過濾
      if (tag || category) {
        // 先執行標籤/分類查詢
        const snapshot = await baseQuery.get();
        
        // 在結果中過濾店名前綴匹配
        const filteredDocs = snapshot.docs.filter(doc => {
          const data = doc.data();
          const storeName = data.name.toLowerCase();
          return storeName.startsWith(searchTerm.toLowerCase());
        });
        
        // 處理結果
        const storePromises = filteredDocs.map(doc => getPublicStoreProfileById(doc.id));
        const stores = await Promise.all(storePromises);
        queryResults = stores.filter((store): store is PublicStoreProfile => store !== null);
      } else {
        // 若無標籤/分類查詢，直接使用前綴匹配查詢店名
        const nameEndPrefix = searchTerm + '\uf8ff';
        const nameQuery = baseQuery
          .where('name', '>=', searchTerm)
          .where('name', '<=', nameEndPrefix)
          .limit(limit + offset); // 先獲取更多，後續手動跳過offset
        
        const snapshot = await nameQuery.get();
        
        // 處理結果
        const storePromises = snapshot.docs
          .slice(offset) // 手動處理偏移
          .map(doc => getPublicStoreProfileById(doc.id));
        
        const stores = await Promise.all(storePromises);
        queryResults = stores.filter((store): store is PublicStoreProfile => store !== null);
      }
    } else {
      // 若無關鍵字查詢，直接執行標籤/分類查詢
      baseQuery = baseQuery.limit(limit).offset(offset);
      const snapshot = await baseQuery.get();
      
      // 處理結果
      const storePromises = snapshot.docs.map(doc => getPublicStoreProfileById(doc.id));
      const stores = await Promise.all(storePromises);
      queryResults = stores.filter((store): store is PublicStoreProfile => store !== null);
    }
    
    return queryResults;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`搜尋店家失敗:`, error);
    throw new Error(`搜尋店家時發生錯誤: ${errorMessage}`);
  }
}

/**
 * API處理函式 - 搜尋店家
 * 端點: GET /discovery/stores/search
 */
export async function searchStoresHandler(req: Request, res: Response): Promise<Response> {
  try {
    // 從查詢參數中獲取搜尋條件
    const { query, category, tag, limit, offset } = req.query;
    
    // 轉換參數
    const searchParams = {
      query: query as string | undefined,
      category: category as string | undefined,
      tag: tag as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 20, // 默認20筆
      offset: offset ? parseInt(offset as string, 10) : 0 // 默認0
    };
    
    // 參數驗證
    if (searchParams.limit < 1 || searchParams.limit > 100 || isNaN(searchParams.limit)) {
      return res.status(400).json({
        status: 'error',
        message: '返回數量限制參數無效 (有效範圍: 1 到 100)'
      });
    }
    
    if (searchParams.offset < 0 || isNaN(searchParams.offset)) {
      return res.status(400).json({
        status: 'error',
        message: '偏移量參數無效 (必須大於或等於0)'
      });
    }
    
    // 至少需要一個搜尋條件
    if (!searchParams.query && !searchParams.category && !searchParams.tag) {
      return res.status(400).json({
        status: 'error',
        message: '搜尋請求必須提供至少一個搜尋條件 (query, category 或 tag)'
      });
    }
    
    // 執行搜尋
    const stores = await searchStores(searchParams);
    
    // 返回結果
    return res.status(200).json({
      status: 'success',
      data: {
        stores,
        meta: {
          count: stores.length,
          ...searchParams
        }
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API搜尋店家失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `搜尋店家時發生系統錯誤: ${errorMessage}`
    });
  }
}

/**
 * 計算店家排行榜
 * 
 * @param type 排行榜類型
 * @param period 時間範圍
 * @param limit 返回結果數量限制
 * @returns 排行榜結果
 */
export async function calculateStoreRankings(
  type: RankingType = 'top_rated',
  period: RankingPeriod = 'all_time',
  limit: number = 20
): Promise<StoreRankingResult> {
  const db = admin.firestore();
  
  try {
    // 定義排行榜ID
    const rankingId = `${type}_${period}`;
    
    // 根據排行榜類型設置標題
    let title = '';
    switch (type) {
      case 'top_rated':
        title = '評價最高的店家';
        break;
      case 'most_popular':
        title = '最受歡迎的店家';
        break;
      case 'trending':
        title = '近期熱門店家';
        break;
      case 'new_stores':
        title = '新加入的店家';
        break;
      case 'featured':
        title = '精選推薦店家';
        break;
      case 'special_offers':
        title = '特別優惠店家';
        break;
      default:
        title = '店家排行榜';
    }
    
    // 定義排行榜描述
    let description = '';
    switch (period) {
      case 'all_time':
        description = '歷史最佳';
        break;
      case 'this_week':
        description = '本週精選';
        break;
      case 'this_month':
        description = '本月精選';
        break;
      case 'last_30_days':
        description = '近30天熱門';
        break;
      case 'last_90_days':
        description = '近3個月熱門';
        break;
    }
    
    // 設定時間範圍篩選條件
    const now = admin.firestore.Timestamp.now().toDate();
    let startDate = new Date(now);
    
    switch (period) {
      case 'this_week':
        // 本週開始日期 (星期日)
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'this_month':
        // 本月開始日期
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'last_30_days':
        // 30天前
        startDate.setDate(now.getDate() - 30);
        break;
      case 'last_90_days':
        // 90天前
        startDate.setDate(now.getDate() - 90);
        break;
      case 'all_time':
      default:
        // 不設時間限制
        startDate = new Date(0);
    }
    
    // 根據排行榜類型進行計算
    let rankedStores: RankedStoreItem[] = [];
    let totalCount = 0;
    let minScore = 0;
    let maxScore = 0;
    let averageScore = 0;
    
    switch (type) {
      case 'top_rated':
        // 獲取評分最高的店家
        const ratingQuery = db.collection('publicStoreProfiles')
          .where('status', 'in', ['active', 'temporarily_closed'])
          .where('rating', '>', 0)
          .orderBy('rating', 'desc')
          .orderBy('ratingCount', 'desc')
          .limit(limit * 2); // 取多一些，後面會過濾
        
        const ratingSnapshot = await ratingQuery.get();
        
        if (!ratingSnapshot.empty) {
          totalCount = ratingSnapshot.size;
          let totalScore = 0;
          
          // 處理每個店家資料
          ratingSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            const score = data.rating || 0;
            
            // 更新統計數據
            if (index === 0) {
              minScore = maxScore = score;
            } else {
              minScore = Math.min(minScore, score);
              maxScore = Math.max(maxScore, score);
            }
            totalScore += score;
            
            // 只處理有評分的店家
            if (score > 0) {
              rankedStores.push({
                storeId: doc.id,
                rank: index + 1,
                name: data.name || '',
                score: score,
                imageUrl: data.logoUrl || '',
                location: {
                  city: data.location?.city || '',
                  district: data.location?.district || ''
                },
                tags: (data.tags || []).slice(0, 3),
                category: (data.categories && data.categories.length > 0) ? data.categories[0] : undefined
              });
            }
          });
          
          // 計算平均分數
          averageScore = totalScore / totalCount;
        }
        break;
        
      case 'most_popular':
        // 實際應用中，可能需要從訂單集合計算各店家的訂單數量
        // 這裡簡化為使用 ratingCount 作為人氣指標
        const popularityQuery = db.collection('publicStoreProfiles')
          .where('status', 'in', ['active', 'temporarily_closed'])
          .where('ratingCount', '>', 0)
          .orderBy('ratingCount', 'desc')
          .limit(limit);
        
        const popularitySnapshot = await popularityQuery.get();
        
        if (!popularitySnapshot.empty) {
          totalCount = popularitySnapshot.size;
          let totalScore = 0;
          
          popularitySnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            const score = data.ratingCount || 0;
            
            if (index === 0) {
              minScore = maxScore = score;
            } else {
              minScore = Math.min(minScore, score);
              maxScore = Math.max(maxScore, score);
            }
            totalScore += score;
            
            rankedStores.push({
              storeId: doc.id,
              rank: index + 1,
              name: data.name || '',
              score: score,
              imageUrl: data.logoUrl || '',
              location: {
                city: data.location?.city || '',
                district: data.location?.district || ''
              },
              tags: (data.tags || []).slice(0, 3),
              category: (data.categories && data.categories.length > 0) ? data.categories[0] : undefined
            });
          });
          
          averageScore = totalScore / totalCount;
        }
        break;
        
      case 'new_stores':
        // 獲取最新加入的店家
        const newStoresQuery = db.collection('publicStoreProfiles')
          .where('status', 'in', ['active', 'temporarily_closed'])
          .orderBy('createdAt', 'desc')
          .limit(limit);
        
        const newStoresSnapshot = await newStoresQuery.get();
        
        if (!newStoresSnapshot.empty) {
          totalCount = newStoresSnapshot.size;
          
          newStoresSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            const createdAtTimestamp = data.createdAt;
            let createdDate: Date;
            
            if (createdAtTimestamp instanceof admin.firestore.Timestamp) {
              createdDate = createdAtTimestamp.toDate();
            } else if (createdAtTimestamp instanceof Date) {
              createdDate = createdAtTimestamp;
            } else {
              createdDate = new Date();
            }
            
            // 計算店家創建至今的天數
            const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            
            rankedStores.push({
              storeId: doc.id,
              rank: index + 1,
              name: data.name || '',
              score: daysSinceCreation, // 顯示已創建天數
              imageUrl: data.logoUrl || '',
              location: {
                city: data.location?.city || '',
                district: data.location?.district || ''
              },
              tags: (data.tags || []).slice(0, 3),
              category: (data.categories && data.categories.length > 0) ? data.categories[0] : undefined
            });
          });
        }
        break;
        
      case 'featured':
        // 獲取精選店家 (假設已經在publicStoreProfiles中標記了featured欄位)
        const featuredQuery = db.collection('publicStoreProfiles')
          .where('status', 'in', ['active', 'temporarily_closed'])
          .where('featured', '==', true)
          .limit(limit);
        
        const featuredSnapshot = await featuredQuery.get();
        
        if (!featuredSnapshot.empty) {
          totalCount = featuredSnapshot.size;
          
          // 添加所有精選店家
          const featuredStores = featuredSnapshot.docs.map((doc, index) => {
            const data = doc.data();
            return {
              storeId: doc.id,
              rank: index + 1,
              name: data.name || '',
              score: data.rating || 0, // 使用評分作為參考指標
              imageUrl: data.logoUrl || '',
              location: {
                city: data.location?.city || '',
                district: data.location?.district || ''
              },
              tags: (data.tags || []).slice(0, 3),
              category: (data.categories && data.categories.length > 0) ? data.categories[0] : undefined,
              isPaid: data.isPaidFeatured || false
            };
          });
          
          // 將付費置頂的排在前面
          rankedStores = featuredStores.sort((a, b) => {
            // 先按照是否付費排序
            if (a.isPaid && !b.isPaid) return -1;
            if (!a.isPaid && b.isPaid) return 1;
            // 再按照評分排序
            return b.score - a.score;
          });
          
          // 重新計算排名
          rankedStores.forEach((store, index) => {
            store.rank = index + 1;
          });
        }
        break;
        
      case 'special_offers':
        // 獲取有特別優惠的店家
        const specialOffersQuery = db.collection('publicStoreProfiles')
          .where('status', 'in', ['active', 'temporarily_closed'])
          .where('specialOffers', '!=', null)
          .limit(limit * 2); // 取多一些，後面會過濾
        
        const specialOffersSnapshot = await specialOffersQuery.get();
        
        if (!specialOffersSnapshot.empty) {
          // 過濾出有效的特別優惠
          const validOfferStores = specialOffersSnapshot.docs
            .filter(doc => {
              const data = doc.data();
              const offers = data.specialOffers || [];
              
              // 判斷是否有有效期內的優惠
              return offers.some((offer: any) => {
                let endDate: Date | null = null;
                
                if (offer.endDate instanceof admin.firestore.Timestamp) {
                  endDate = offer.endDate.toDate();
                } else if (offer.endDate instanceof Date) {
                  endDate = offer.endDate;
                }
                
                // 如果沒有結束日期或結束日期在當前日期之後，則優惠有效
                return !endDate || endDate > now;
              });
            })
            .map((doc, index) => {
              const data = doc.data();
              const offers = data.specialOffers || [];
              
              // 計算優惠的數量作為分數
              const validOffersCount = offers.filter((offer: any) => {
                let endDate: Date | null = null;
                
                if (offer.endDate instanceof admin.firestore.Timestamp) {
                  endDate = offer.endDate.toDate();
                } else if (offer.endDate instanceof Date) {
                  endDate = offer.endDate;
                }
                
                return !endDate || endDate > now;
              }).length;
              
              return {
                storeId: doc.id,
                rank: index + 1,
                name: data.name || '',
                score: validOffersCount,
                imageUrl: data.logoUrl || '',
                location: {
                  city: data.location?.city || '',
                  district: data.location?.district || ''
                },
                tags: (data.tags || []).slice(0, 3),
                category: (data.categories && data.categories.length > 0) ? data.categories[0] : undefined
              };
            });
          
          totalCount = validOfferStores.length;
          
          // 按照有效優惠數量排序
          rankedStores = validOfferStores
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
          
          // 重新計算排名
          rankedStores.forEach((store, index) => {
            store.rank = index + 1;
          });
          
          if (rankedStores.length > 0) {
            // 計算統計數據
            const scores = rankedStores.map(store => store.score);
            minScore = Math.min(...scores);
            maxScore = Math.max(...scores);
            averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          }
        }
        break;
        
      default:
        // 默認使用評分排行
        const defaultQuery = db.collection('publicStoreProfiles')
          .where('status', 'in', ['active', 'temporarily_closed'])
          .orderBy('rating', 'desc')
          .limit(limit);
        
        const defaultSnapshot = await defaultQuery.get();
        
        if (!defaultSnapshot.empty) {
          totalCount = defaultSnapshot.size;
          let totalScore = 0;
          
          defaultSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            const score = data.rating || 0;
            
            if (index === 0) {
              minScore = maxScore = score;
            } else {
              minScore = Math.min(minScore, score);
              maxScore = Math.max(maxScore, score);
            }
            totalScore += score;
            
            rankedStores.push({
              storeId: doc.id,
              rank: index + 1,
              name: data.name || '',
              score: score,
              imageUrl: data.logoUrl || '',
              location: {
                city: data.location?.city || '',
                district: data.location?.district || ''
              },
              tags: (data.tags || []).slice(0, 3),
              category: (data.categories && data.categories.length > 0) ? data.categories[0] : undefined
            });
          });
          
          averageScore = totalScore / totalCount;
        }
    }
    
    // 限制結果數量
    rankedStores = rankedStores.slice(0, limit);
    
    // 創建排行榜結果
    const rankingResult: StoreRankingResult = {
      id: rankingId,
      type,
      period,
      title,
      description,
      rankedStores,
      calculatedAt: now,
      nextUpdateAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 預設24小時後更新
      metaData: {
        totalCount,
        minScore,
        maxScore,
        averageScore
      }
    };
    
    // 將排行榜結果保存到 Firestore
    await db.collection('storeRankings').doc(rankingId).set({
      ...rankingResult,
      calculatedAt: admin.firestore.Timestamp.fromDate(rankingResult.calculatedAt),
      nextUpdateAt: rankingResult.nextUpdateAt ? admin.firestore.Timestamp.fromDate(rankingResult.nextUpdateAt) : null,
      // 確保所有 Date 類型都轉換為 Timestamp
      rankedStores: rankingResult.rankedStores
    });
    
    return rankingResult;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`計算店家排行榜失敗 (type: ${type}, period: ${period}):`, error);
    throw new Error(`計算店家排行榜時發生錯誤: ${errorMessage}`);
  }
}

/**
 * 獲取店家排行榜
 * 
 * @param type 排行榜類型
 * @param period 時間範圍
 * @returns 排行榜結果
 */
export async function getStoreRankings(
  type: RankingType = 'top_rated',
  period: RankingPeriod = 'all_time'
): Promise<StoreRankingResult> {
  const db = admin.firestore();
  
  try {
    // 定義排行榜ID
    const rankingId = `${type}_${period}`;
    
    // 從 Firestore 獲取預計算的排行榜結果
    const rankingDoc = await db.collection('storeRankings').doc(rankingId).get();
    
    // 如果存在預計算結果，直接返回
    if (rankingDoc.exists) {
      const data = rankingDoc.data() as any;
      
      const result: StoreRankingResult = {
        ...data,
        calculatedAt: data.calculatedAt instanceof admin.firestore.Timestamp 
          ? data.calculatedAt.toDate() 
          : data.calculatedAt,
        nextUpdateAt: data.nextUpdateAt instanceof admin.firestore.Timestamp 
          ? data.nextUpdateAt.toDate() 
          : null
      };
      
      return result;
    }
    
    // 如果沒有預計算結果，重新計算並返回
    console.log(`未找到預計算的排行榜結果 (${rankingId})，進行即時計算`);
    return await calculateStoreRankings(type, period);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error(`獲取店家排行榜失敗 (type: ${type}, period: ${period}):`, error);
    throw new Error(`獲取店家排行榜時發生錯誤: ${errorMessage}`);
  }
}

/**
 * API處理函式 - 獲取店家排行榜
 * 端點: GET /discovery/rankings
 */
export async function getStoreRankingsHandler(req: Request, res: Response): Promise<Response> {
  try {
    // 從查詢參數中獲取排行榜類型和時間範圍
    const { type, period } = req.query;
    
    // 驗證排行榜類型
    const rankingType = type ? String(type) as RankingType : 'top_rated';
    const validTypes: RankingType[] = ['top_rated', 'most_popular', 'trending', 'new_stores', 'featured', 'special_offers'];
    
    if (!validTypes.includes(rankingType)) {
      return res.status(400).json({
        status: 'error',
        message: `排行榜類型無效，有效類型: ${validTypes.join(', ')}`
      });
    }
    
    // 驗證時間範圍
    const rankingPeriod = period ? String(period) as RankingPeriod : 'all_time';
    const validPeriods: RankingPeriod[] = ['all_time', 'this_week', 'this_month', 'last_30_days', 'last_90_days'];
    
    if (!validPeriods.includes(rankingPeriod)) {
      return res.status(400).json({
        status: 'error',
        message: `時間範圍無效，有效範圍: ${validPeriods.join(', ')}`
      });
    }
    
    // 獲取排行榜結果
    const rankings = await getStoreRankings(rankingType, rankingPeriod);
    
    // 返回結果
    return res.status(200).json({
      status: 'success',
      data: rankings
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    console.error('API獲取店家排行榜失敗:', error);
    
    return res.status(500).json({
      status: 'error',
      message: `獲取店家排行榜時發生系統錯誤: ${errorMessage}`
    });
  }
} 