import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as functions from 'firebase-functions';
import { logAction, AuditAction } from '../libs/audit'; // 引入審計日誌服務

// 定義擴展的Request類型，包含user屬性
interface CustomRequest extends Request {
  user?: {
    uid: string;
    tenantId?: string;
    storeId?: string;
    role: string;
  };
}

// 導入自定義類型和驗證模式
import { 
  MenuItemInput,
  MenuItemOptionGroup,
  NutritionInfo,
  UpdateMenuItemInput
} from './menuItem.validators';

// Firestore數據庫引用
const db = admin.firestore();

// 定義完整的MenuItem類型
export interface MenuItem {
  id: string;
  tenantId: string;
  storeId?: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  price: number;
  discountPrice?: number;
  costPrice?: number;
  imageUrl: string;
  thumbnailUrl?: string;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  stockQuantity?: number;
  unit?: string;
  preparationTime?: number;
  displayOrder?: number;
  isRecommended: boolean;
  isSpecial: boolean;
  isActive: boolean;
  nutritionInfo?: NutritionInfo;
  optionGroups: MenuItemOptionGroup[];
  tags: string[];
  createdBy: string;
  createdAt: Date | string | admin.firestore.Timestamp;
  updatedAt: Date | string | admin.firestore.Timestamp;
}

/**
 * 處理創建新的菜單品項請求
 * @param req Express請求對象，包含經過驗證的請求體數據
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const createMenuItem = async (req: CustomRequest, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理創建菜單品項請求', { structuredData: true });
  
  try {
    // 1. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; storeId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('創建菜單品項失敗: 找不到有效的用戶信息');
      
      // 記錄審計失敗日誌
      try {
        await logAction({
          userId: 'unknown',
          action: AuditAction.MENU_ITEM_CREATE,
          resourceType: 'menuItem',
          details: { 
            requestBody: req.body,
            reason: '未授權：找不到有效的用戶信息'
          },
          status: 'failure',
          errorMessage: '未授權：找不到有效的用戶信息',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (auditError) {
        logger.error('記錄審計日誌失敗', { error: auditError });
      }
      
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 2. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('創建菜單品項失敗: 用戶缺少租戶ID', { uid: user.uid });
      
      // 記錄審計失敗日誌
      try {
        await logAction({
          userId: user.uid,
          action: AuditAction.MENU_ITEM_CREATE,
          resourceType: 'menuItem',
          details: { 
            requestBody: req.body,
            reason: '沒有權限：用戶缺少租戶ID'
          },
          status: 'failure',
          errorMessage: '沒有權限：用戶缺少租戶ID',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (auditError) {
        logger.error('記錄審計日誌失敗', { error: auditError });
      }
      
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    // 3. 使用已驗證的請求體數據（通過validateRequest中間件驗證過）
    const validatedData = req.body as MenuItemInput;
    
    // 4. 驗證分類ID的存在性和租戶歸屬
    logger.info('驗證分類ID', { 
      categoryId: validatedData.categoryId, 
      tenantId: user.tenantId 
    });
    
    const categoryDoc = await db.collection('menuCategories').doc(validatedData.categoryId).get();
    
    if (!categoryDoc.exists) {
      logger.error('創建菜單品項失敗: 指定的菜單分類不存在', { 
        categoryId: validatedData.categoryId 
      });
      
      // 記錄審計失敗日誌
      try {
        await logAction({
          userId: user.uid,
          userName: user.displayName,
          tenantId: user.tenantId,
          storeId: user.storeId,
          action: AuditAction.MENU_ITEM_CREATE,
          resourceType: 'menuItem',
          details: { 
            requestBody: req.body,
            categoryId: validatedData.categoryId,
            reason: '指定的菜單分類不存在'
          },
          status: 'failure',
          errorMessage: '指定的菜單分類不存在',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (auditError) {
        logger.error('記錄審計日誌失敗', { error: auditError });
      }
      
      return res.status(404).json({
        success: false,
        message: '指定的菜單分類不存在',
      });
    }
    
    const categoryData = categoryDoc.data() as { tenantId: string; name: string };
    
    // 驗證分類是否屬於當前租戶
    if (categoryData.tenantId !== user.tenantId) {
      logger.error('創建菜單品項失敗: 無法訪問其他租戶的菜單分類', { 
        categoryId: validatedData.categoryId, 
        requestTenantId: user.tenantId, 
        resourceTenantId: categoryData.tenantId 
      });
      
      // 記錄審計失敗日誌
      try {
        await logAction({
          userId: user.uid,
          userName: user.displayName,
          tenantId: user.tenantId,
          storeId: user.storeId,
          action: AuditAction.MENU_ITEM_CREATE,
          resourceType: 'menuItem',
          details: { 
            requestBody: req.body,
            categoryId: validatedData.categoryId,
            requestTenantId: user.tenantId,
            resourceTenantId: categoryData.tenantId,
            reason: '沒有權限：無法訪問其他租戶的菜單分類'
          },
          status: 'failure',
          errorMessage: '沒有權限：無法訪問其他租戶的菜單分類',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (auditError) {
        logger.error('記錄審計日誌失敗', { error: auditError });
      }
      
      return res.status(403).json({
        success: false,
        message: '沒有權限：無法訪問其他租戶的菜單分類',
      });
    }
    
    // 5. 生成唯一ID和準備數據
    const itemId = uuidv4();
    
    // 添加分類名稱作為冗餘字段
    const categoryName = categoryData.name;
    
    // 6. 構建完整的MenuItem對象
    const itemData: Omit<MenuItem, 'createdAt' | 'updatedAt'> & { 
      createdAt: admin.firestore.FieldValue;
      updatedAt: admin.firestore.FieldValue;
    } = {
      id: itemId,
      tenantId: user.tenantId,
      storeId: user.storeId, // 如果用戶有storeId，則記錄，否則為undefined
      name: validatedData.name,
      description: validatedData.description || '',
      categoryId: validatedData.categoryId,
      categoryName,
      price: validatedData.price,
      discountPrice: validatedData.discountPrice,
      costPrice: validatedData.costPrice,
      imageUrl: validatedData.imageUrl || '',
      thumbnailUrl: validatedData.thumbnailUrl || '',
      stockStatus: validatedData.stockStatus,
      stockQuantity: validatedData.stockQuantity,
      unit: validatedData.unit || '',
      preparationTime: validatedData.preparationTime,
      displayOrder: validatedData.displayOrder || 0,
      isRecommended: validatedData.isRecommended ?? false,
      isSpecial: validatedData.isSpecial ?? false,
      isActive: validatedData.isActive ?? true,
      nutritionInfo: validatedData.nutritionInfo || {},
      optionGroups: validatedData.optionGroups || [],
      tags: validatedData.tags || [],
      createdBy: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    logger.info('準備創建菜單品項', { 
      itemId,
      tenantId: user.tenantId,
      categoryId: validatedData.categoryId,
      name: validatedData.name
    });
    
    // 7. 寫入數據庫
    await db.collection('menuItems').doc(itemId).set(itemData);
    
    logger.info('菜單品項創建成功', { itemId, tenantId: user.tenantId });
    
    // 8. 獲取剛剛創建的文檔以獲取服務器時間戳
    // 由於服務器時間戳無法在寫入後立即獲取，我們使用當前時間作為API響應中的時間
    const now = new Date().toISOString();
    
    // 9. 格式化返回數據
    const responseData = {
      ...itemData,
      createdAt: now,
      updatedAt: now
    };

    // 記錄審計成功日誌
    try {
      await logAction({
        userId: user.uid,
        userName: user.displayName,
        tenantId: user.tenantId,
        storeId: user.storeId,
        action: AuditAction.MENU_ITEM_CREATE,
        resourceType: 'menuItem',
        resourceId: itemId,
        details: { 
          name: validatedData.name,
          categoryId: validatedData.categoryId,
          categoryName,
          price: validatedData.price,
          isActive: validatedData.isActive ?? true,
          hasOptions: (validatedData.optionGroups?.length || 0) > 0,
          tagCount: (validatedData.tags?.length || 0)
        },
        status: 'success',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (auditError) {
      logger.error('記錄審計日誌失敗', { error: auditError });
      // 不影響主流程，繼續返回成功響應
    }
    
    // 10. 返回成功響應（HTTP 201 Created）
    return res.status(201).json({
      success: true,
      message: '菜單品項創建成功',
      data: responseData,
    });
    
  } catch (error) {
    // 11. 捕獲並處理錯誤
    functions.logger.error('創建菜單品項時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // 記錄審計失敗日誌
    try {
      await logAction({
        userId: req.user?.uid || 'unknown',
        userName: req.user?.displayName,
        tenantId: req.user?.tenantId,
        storeId: req.user?.storeId,
        action: AuditAction.MENU_ITEM_CREATE,
        resourceType: 'menuItem',
        details: { 
          requestBody: req.body,
          error: error instanceof Error ? error.message : '未知錯誤'
        },
        status: 'failure',
        errorMessage: '創建菜單品項時發生系統錯誤',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (auditError) {
      functions.logger.error('記錄審計日誌失敗', { error: auditError });
    }
    
    return res.status(500).json({
      success: false,
      message: '創建菜單品項時發生錯誤',
      error: error instanceof Error ? error.message : '未知錯誤'
    });
  }
};

/**
 * 處理獲取單個菜單品項詳情請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const getMenuItemById = async (req: CustomRequest, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理獲取菜單品項詳情請求', { structuredData: true });
  
  try {
    // 1. 獲取請求參數和用戶信息
    const { itemId } = req.params;
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    // 驗證用戶資訊
    if (!user || !user.uid) {
      logger.error('獲取菜單品項詳情失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('獲取菜單品項詳情失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    logger.info('查詢菜單品項詳情', { itemId, tenantId: user.tenantId });
    
    // 2. 從數據庫獲取菜單品項
    const itemDoc = await db.collection('menuItems').doc(itemId).get();
    
    // 3. 檢查菜單品項是否存在
    if (!itemDoc.exists) {
      logger.info('找不到指定的菜單品項', { itemId });
      return res.status(404).json({
        success: false,
        message: '找不到指定的菜單品項',
      });
    }
    
    const itemData = itemDoc.data() as FirebaseFirestore.DocumentData;
    
    // 4. 租戶隔離檢查
    if (itemData.tenantId !== user.tenantId) {
      logger.info('租戶隔離檢查失敗: 無法訪問其他租戶的菜單品項', { 
        itemId, 
        requestTenantId: user.tenantId, 
        resourceTenantId: itemData.tenantId 
      });
      return res.status(403).json({
        success: false,
        message: '沒有權限：無法訪問其他租戶的菜單品項',
      });
    }
    
    // 5. 格式化時間戳並返回數據
    const formattedData = {
      ...itemData,
      createdAt: itemData.createdAt ? itemData.createdAt.toDate().toISOString() : null,
      updatedAt: itemData.updatedAt ? itemData.updatedAt.toDate().toISOString() : null,
    };
    
    logger.info('成功獲取菜單品項詳情', { itemId, tenantId: user.tenantId });
    
    return res.status(200).json({
      success: true,
      data: formattedData,
    });
    
  } catch (error) {
    logger.error('獲取菜單品項詳情時出錯', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 處理獲取菜單品項列表請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const listMenuItems = async (req: Request, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理獲取菜單品項列表請求', { structuredData: true });
  
  try {
    // 1. 獲取當前用戶信息（通過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; storeId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('獲取菜單品項列表失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 2. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('獲取菜單品項列表失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    // 3. 使用已驗證的查詢參數
    const query = req.query as unknown as import('./menuItem.validators').ListMenuItemsQuery;
    
    logger.info('處理菜單品項列表查詢', { 
      tenantId: user.tenantId,
      queryParams: JSON.stringify(query)
    });
    
    // 4. 構建基礎查詢
    let baseQuery = db.collection('menuItems').where('tenantId', '==', user.tenantId);
    
    // 5. 應用過濾條件
    
    // 5.1 按分類ID過濾
    if (query.categoryId) {
      baseQuery = baseQuery.where('categoryId', '==', query.categoryId);
      logger.info('應用分類過濾', { categoryId: query.categoryId });
    }
    
    // 5.2 按啟用狀態過濾
    if (query.isActive !== undefined) {
      baseQuery = baseQuery.where('isActive', '==', query.isActive);
      logger.info('應用啟用狀態過濾', { isActive: query.isActive });
    }
    
    // 5.3 按推薦狀態過濾
    if (query.isRecommended !== undefined) {
      baseQuery = baseQuery.where('isRecommended', '==', query.isRecommended);
      logger.info('應用推薦狀態過濾', { isRecommended: query.isRecommended });
    }
    
    // 5.4 按特選狀態過濾
    if (query.isSpecial !== undefined) {
      baseQuery = baseQuery.where('isSpecial', '==', query.isSpecial);
      logger.info('應用特選狀態過濾', { isSpecial: query.isSpecial });
    }
    
    // 5.5 按庫存狀態過濾
    if (query.stockStatus) {
      baseQuery = baseQuery.where('stockStatus', '==', query.stockStatus);
      logger.info('應用庫存狀態過濾', { stockStatus: query.stockStatus });
    }
    
    // 5.6 按標籤過濾 (如果有)
    let tagsQuery = baseQuery;
    if (query.tags && query.tags.length > 0) {
      // Firestore 的 array-contains-any 最多支持 10 個值
      // 如果超過，會在稍後進行更精確的內存過濾
      const tagsForQuery = query.tags.slice(0, 10);
      tagsQuery = baseQuery.where('tags', 'array-contains-any', tagsForQuery);
      logger.info('應用標籤過濾', { tags: tagsForQuery });
      
      if (query.tags.length > 10) {
        logger.warn('標籤數量超過 Firestore 限制，僅使用前 10 個進行查詢', { 
          totalTags: query.tags.length, 
          usedTags: tagsForQuery.length 
        });
      }
    }
    
    // 6. 應用排序
    let sortedQuery = tagsQuery.orderBy(query.sort, query.order);
    logger.info('應用排序', { field: query.sort, direction: query.order });
    
    // 7. 執行查詢 - 獲取所有符合條件的菜單品項
    // 注意：這裡不應用分頁，因為我們需要先在內存中進行文本過濾
    logger.info('執行菜單品項列表查詢（不含分頁）');
    const snapshot = await sortedQuery.get();
    
    // 8. 處理查詢結果
    let menuItems = snapshot.docs.map(doc => {
      const data = doc.data() as MenuItem;
      
      // 格式化時間戳
      let formattedItem = {
        ...data,
        createdAt: data.createdAt instanceof admin.firestore.Timestamp 
          ? data.createdAt.toDate().toISOString() 
          : data.createdAt,
        updatedAt: data.updatedAt instanceof admin.firestore.Timestamp 
          ? data.updatedAt.toDate().toISOString() 
          : data.updatedAt
      };
      
      return formattedItem;
    });
    
    logger.info('從 Firestore 獲取到菜單品項', { count: menuItems.length });
    
    // 9. 處理 query 參數 (關鍵字搜索，在內存中執行)
    let filteredItems = menuItems;
    if (query.query) {
      const searchTerm = query.query.toLowerCase();
      logger.info('在後端進行關鍵字過濾', { searchTerm });
      
      filteredItems = menuItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        (item.description && item.description.toLowerCase().includes(searchTerm))
      );
      
      logger.info('關鍵字過濾後結果數量', { 
        before: menuItems.length, 
        after: filteredItems.length 
      });
    }
    
    // 10. 內存中執行其他可能的過濾 (例如，如果標籤超過10個)
    if (query.tags && query.tags.length > 10) {
      // Firestore 查詢已經應用了前10個標籤，現在我們在內存中處理所有標籤
      logger.info('在內存中進行完整標籤過濾', { totalTags: query.tags.length });
      
      filteredItems = filteredItems.filter(item => {
        // 品項必須包含至少一個請求的標籤
        return item.tags && item.tags.some(tag => query.tags!.includes(tag));
      });
      
      logger.info('標籤完整過濾後結果數量', { 
        count: filteredItems.length 
      });
    }
    
    // 11. 計算總記錄數並應用分頁
    const totalItems = filteredItems.length;
    const totalPages = Math.ceil(totalItems / query.limit);
    const startIndex = (query.page - 1) * query.limit;
    const endIndex = Math.min(startIndex + query.limit, totalItems);
    
    logger.info('計算分頁信息', { 
      totalItems, 
      totalPages, 
      currentPage: query.page,
      startIndex,
      endIndex
    });
    
    // 12. 在內存中應用分頁
    const paginatedItems = filteredItems.slice(startIndex, endIndex);
    
    // 13. 返回成功響應
    logger.info('菜單品項列表獲取成功', { 
      totalItems, 
      totalPages, 
      currentPage: query.page,
      returnedItems: paginatedItems.length
    });
    
    return res.status(200).json({
      success: true,
      message: '菜單品項列表獲取成功',
      pagination: {
        totalItems,
        totalPages,
        currentPage: query.page,
        limit: query.limit
      },
      data: paginatedItems
    });
    
  } catch (error) {
    // 14. 處理錯誤
    logger.error('獲取菜單品項列表時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 處理更新菜單品項請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const updateMenuItem = async (req: CustomRequest, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理更新菜單品項請求', { structuredData: true });
  
  try {
    // 1. 獲取請求參數和用戶信息
    const { itemId } = req.params;
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    // 2. 驗證用戶資訊
    if (!user || !user.uid) {
      logger.error('更新菜單品項失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 3. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('更新菜單品項失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    // 4. 使用已驗證的請求體數據（通過validateRequest中間件驗證過）
    const updateData = req.body as UpdateMenuItemInput;
    
    logger.info('更新菜單品項', { 
      itemId, 
      tenantId: user.tenantId,
      updateFields: Object.keys(updateData)
    });
    
    // 5. 獲取當前品項
    const itemRef = db.collection('menuItems').doc(itemId);
    const itemDoc = await itemRef.get();
    
    // 6. 檢查品項是否存在
    if (!itemDoc.exists) {
      logger.info('找不到指定的菜單品項', { itemId });
      return res.status(404).json({
        success: false,
        message: '找不到指定的菜單品項',
      });
    }
    
    const itemData = itemDoc.data() as MenuItem;
    
    // 7. 租戶隔離檢查
    if (itemData.tenantId !== user.tenantId) {
      logger.info('租戶隔離檢查失敗: 無法更新其他租戶的菜單品項', { 
        itemId, 
        requestTenantId: user.tenantId, 
        resourceTenantId: itemData.tenantId 
      });
      return res.status(403).json({
        success: false,
        message: '沒有權限：無法更新其他租戶的菜單品項',
      });
    }
    
    // 8. 如果要更新分類ID，驗證新分類的存在性和租戶歸屬
    let categoryName = itemData.categoryName;
    if (updateData.categoryId && updateData.categoryId !== itemData.categoryId) {
      logger.info('驗證新的分類ID', { 
        oldCategoryId: itemData.categoryId,
        newCategoryId: updateData.categoryId,
        tenantId: user.tenantId
      });
      
      const categoryDoc = await db.collection('menuCategories').doc(updateData.categoryId).get();
      
      if (!categoryDoc.exists) {
        logger.error('更新菜單品項失敗: 指定的新菜單分類不存在', { 
          categoryId: updateData.categoryId 
        });
        return res.status(404).json({
          success: false,
          message: '指定的新菜單分類不存在',
        });
      }
      
      const categoryData = categoryDoc.data() as { tenantId: string; name: string };
      
      // 驗證分類是否屬於當前租戶
      if (categoryData.tenantId !== user.tenantId) {
        logger.error('更新菜單品項失敗: 無法使用其他租戶的菜單分類', { 
          categoryId: updateData.categoryId, 
          requestTenantId: user.tenantId, 
          resourceTenantId: categoryData.tenantId 
        });
        return res.status(403).json({
          success: false,
          message: '沒有權限：無法使用其他租戶的菜單分類',
        });
      }
      
      // 更新分類名稱（冗餘字段）
      categoryName = categoryData.name;
    }
    
    // 9. 構建更新數據
    // 從 updateData 中提取實際更新欄位，避免類型衝突
    const updateObject: Record<string, any> = { ...updateData };

    // 添加更新時間戳
    updateObject.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    // 如果分類ID更新了，也更新分類名稱冗餘字段
    if (updateData.categoryId && updateData.categoryId !== itemData.categoryId) {
      updateObject.categoryName = categoryName;
    }
    
    logger.info('準備更新菜單品項', { 
      itemId,
      updateFields: Object.keys(updateObject)
    });
    
    // 10. 更新數據庫
    await itemRef.update(updateObject);
    
    logger.info('菜單品項更新成功', { itemId });
    
    // 11. 獲取更新後的完整文檔
    const updatedDoc = await itemRef.get();
    const updatedData = updatedDoc.data() as MenuItem;
    
    // 12. 格式化時間戳並返回更新後的數據
    const formattedData = {
      ...updatedData,
      createdAt: updatedData.createdAt instanceof admin.firestore.Timestamp 
        ? updatedData.createdAt.toDate().toISOString() 
        : updatedData.createdAt,
      updatedAt: updatedData.updatedAt instanceof admin.firestore.Timestamp 
        ? updatedData.updatedAt.toDate().toISOString() 
        : updatedData.updatedAt
    };
    
    // 13. 返回成功響應
    return res.status(200).json({
      success: true,
      message: '菜單品項更新成功',
      data: formattedData
    });
    
  } catch (error) {
    // 14. 捕獲並處理錯誤
    logger.error('更新菜單品項時發生錯誤', { 
      error: error instanceof Error ? error.message : '未知錯誤',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 處理刪除菜單品項請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const deleteMenuItem = async (req: CustomRequest, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理刪除菜單品項請求', { structuredData: true });
  
  try {
    // 1. 獲取請求參數和用戶信息
    const { itemId } = req.params;
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    // 2. 驗證用戶資訊
    if (!user || !user.uid) {
      logger.error('刪除菜單品項失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 3. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('刪除菜單品項失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    // 4. 驗證請求參數
    if (!itemId) {
      logger.warn('刪除菜單品項失敗: 缺少必要的菜單品項ID');
      return res.status(400).json({
        success: false,
        message: '缺少必要的菜單品項ID',
      });
    }
    
    // 5. 檢查品項是否存在
    const itemRef = db.collection('menuItems').doc(itemId);
    const itemDoc = await itemRef.get();
    
    // 5. 檢查品項是否存在
    if (!itemDoc.exists) {
      logger.info('找不到指定的菜單品項', { itemId });
      return res.status(404).json({
        success: false,
        message: '找不到指定的菜單品項',
      });
    }
    
    const itemData = itemDoc.data() as MenuItem;
    
    // 6. 租戶隔離檢查
    if (itemData.tenantId !== user.tenantId) {
      logger.info('租戶隔離檢查失敗: 無法刪除其他租戶的菜單品項', { 
        itemId, 
        requestTenantId: user.tenantId, 
        resourceTenantId: itemData.tenantId 
      });
      return res.status(403).json({
        success: false,
        message: '沒有權限：無法刪除其他租戶的菜單品項',
      });
    }
    
    // 7. 執行刪除操作
    logger.info('執行菜單品項刪除操作', { itemId });
    await itemRef.delete();
    
    logger.info('菜單品項刪除成功', { itemId, tenantId: user.tenantId });
    
    // 8. 返回成功響應 (HTTP 200 OK 帶有成功訊息)
    return res.status(200).json({
      success: true,
      message: `菜單項目 ${itemId} 已成功刪除`,
    });
    
  } catch (error) {
    console.error("刪除菜單品項時出錯:", error);
    return res.status(500).json({
      success: false,
      message: "伺服器內部錯誤",
      error: error.message,
    });
  }
}; 