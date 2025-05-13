import * as admin from 'firebase-admin';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as functions from 'firebase-functions';

// 導入自定義類型和驗證模式
import { 
  MenuCategory, 
  MenuCategoryInput,
  UpdateMenuCategoryInput,
  MenuCategoryQueryParams
} from './menuCategory.validators';

// Firestore數據庫引用
const db = admin.firestore();

/**
 * 處理創建新的菜單分類請求
 * @param req Express請求對象，包含經過驗證的請求體數據
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const createMenuCategory = async (req: Request, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理創建菜單分類請求', { structuredData: true });
  
  try {
    // 1. 獲取當前用戶信息（透過認證中間件注入）
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!user || !user.uid) {
      logger.error('創建菜單分類失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 2. 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('創建菜單分類失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    // 3. 使用已驗證的請求體數據（通過validateRequest中間件驗證過）
    // req.body已經是經過Zod驗證的MenuCategoryInput類型
    const validatedData = req.body as MenuCategoryInput;
    
    // 4. 生成唯一ID和準備數據
    const categoryId = uuidv4();
    
    // 5. 構建完整的MenuCategory對象
    const categoryData: Omit<MenuCategory, 'createdAt' | 'updatedAt'> & { 
      createdAt: admin.firestore.FieldValue;
      updatedAt: admin.firestore.FieldValue;
    } = {
      id: categoryId,
      tenantId: user.tenantId,
      name: validatedData.name,
      description: validatedData.description || '',
      displayOrder: validatedData.displayOrder,
      type: validatedData.type,
      imageUrl: validatedData.imageUrl || '',
      isActive: validatedData.isActive ?? true,
      createdBy: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    logger.info('準備創建菜單分類', { 
      categoryId,
      tenantId: user.tenantId,
      type: validatedData.type,
      name: validatedData.name
    });
    
    // 6. 寫入數據庫
    await db.collection('menuCategories').doc(categoryId).set(categoryData);
    
    logger.info('菜單分類創建成功', { categoryId, tenantId: user.tenantId });
    
    // 7. 將服務器時間戳格式化為ISO字符串，用於API響應
    // 由於服務器時間戳在此時無法直接獲取，返回當前時間作為替代
    const now = new Date().toISOString();
    const responseData = {
      ...categoryData,
      createdAt: now,
      updatedAt: now
    };
    
    // 8. 返回成功響應（HTTP 201 Created）
    return res.status(201).json({
      success: true,
      message: '菜單分類創建成功',
      data: responseData,
    });
    
  } catch (error) {
    // 9. 捕獲並處理錯誤
    logger.error('創建菜單分類時發生錯誤', { 
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
 * 處理獲取菜單分類詳情請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const getMenuCategoryById = async (req: Request, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理獲取菜單分類詳情請求', { structuredData: true });
  
  try {
    // 1. 獲取請求參數和用戶信息
    const { categoryId } = req.params;
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    // 驗證用戶資訊
    if (!user || !user.uid) {
      logger.error('獲取菜單分類詳情失敗: 找不到有效的用戶信息');
      return res.status(401).json({
        success: false,
        message: '未授權：找不到有效的用戶信息',
      });
    }
    
    // 檢查租戶隔離
    if (!user.tenantId) {
      logger.error('獲取菜單分類詳情失敗: 用戶缺少租戶ID', { uid: user.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    if (!categoryId) {
      logger.error('獲取菜單分類詳情失敗: 缺少必要的分類ID參數');
      return res.status(400).json({
        success: false,
        message: '缺少必要的分類ID參數',
      });
    }
    
    logger.info('查詢菜單分類詳情', { categoryId, tenantId: user.tenantId });
    
    // 2. 從數據庫獲取分類
    const categoryDoc = await db.collection('menuCategories').doc(categoryId).get();
    
    // 3. 檢查分類是否存在
    if (!categoryDoc.exists) {
      logger.info('找不到指定的菜單分類', { categoryId });
      return res.status(404).json({
        success: false,
        message: '找不到指定的菜單分類',
      });
    }
    
    const categoryData = categoryDoc.data() as FirebaseFirestore.DocumentData;
    
    // 4. 租戶隔離檢查
    if (categoryData.tenantId !== user.tenantId) {
      logger.info('租戶隔離檢查失敗: 無法訪問其他租戶的菜單分類', { 
        categoryId, 
        requestTenantId: user.tenantId, 
        resourceTenantId: categoryData.tenantId 
      });
      return res.status(403).json({
        success: false,
        message: '沒有權限：無法訪問其他租戶的菜單分類',
      });
    }
    
    // 5. 格式化時間戳並返回數據
    const formattedData = {
      ...categoryData,
      createdAt: categoryData.createdAt ? categoryData.createdAt.toDate().toISOString() : null,
      updatedAt: categoryData.updatedAt ? categoryData.updatedAt.toDate().toISOString() : null,
    };
    
    logger.info('成功獲取菜單分類詳情', { categoryId, tenantId: user.tenantId });
    
    return res.status(200).json({
      success: true,
      data: formattedData,
    });
    
  } catch (error) {
    logger.error('獲取菜單分類詳情時出錯', { 
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
 * 處理獲取菜單分類列表請求
 * @param req Express請求對象，包含驗證後的查詢參數
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const listMenuCategories = async (req: Request, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理獲取菜單分類列表請求', { structuredData: true });
  
  try {
    // 1. 獲取用戶信息和查詢參數
    const user = req.user as { uid: string; tenantId?: string; role: string };
    // 由於已經過validateRequest中間件處理，req.query中的參數已經轉換為正確的類型
    const { isActive, type } = req.query as unknown as MenuCategoryQueryParams;
    
    // 檢查租戶隔離
    if (!user || !user.tenantId) {
      logger.error('獲取菜單分類列表失敗: 用戶缺少租戶ID', { uid: user?.uid });
      return res.status(403).json({
        success: false,
        message: '沒有權限：用戶缺少租戶ID',
      });
    }
    
    logger.info('查詢菜單分類', { 
      tenantId: user.tenantId, 
      isActive, 
      type,
      userRole: user.role
    });
    
    // 2. 構建 Firestore 查詢
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('menuCategories')
      .where('tenantId', '==', user.tenantId);
    
    // 處理 isActive 過濾
    if (isActive !== 'all') {
      query = query.where('isActive', '==', isActive);
    }
    
    // 處理 type 過濾
    if (type !== undefined) {
      if (typeof type === 'string') {
        // 單一類型過濾
        query = query.where('type', '==', type);
      } else if (Array.isArray(type) && type.length > 0) {
        // 多類型過濾 (使用 'in' 操作符)
        query = query.where('type', 'in', type);
      }
    }
    
    // 添加排序條件
    query = query.orderBy('displayOrder', 'asc').orderBy('name', 'asc');
    
    // 3. 執行查詢
    const snapshot = await query.get();
    
    // 4. 處理查詢結果
    const categories = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
      };
    });
    
    logger.info(`成功獲取 ${categories.length} 個菜單分類`, { 
      tenantId: user.tenantId,
      count: categories.length 
    });
    
    // 5. 返回結果
    return res.status(200).json({
      success: true,
      data: categories,
    });
    
  } catch (error) {
    logger.error('獲取菜單分類列表時出錯:', error instanceof Error ? error.message : error);
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 處理更新菜單分類請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const updateMenuCategory = async (req: Request, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理更新菜單分類請求', { structuredData: true });
  
  try {
    // 1. 獲取請求參數和用戶信息
    const { categoryId } = req.params;
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的分類ID參數',
      });
    }
    
    // 2. 檢查分類是否存在
    const categoryRef = db.collection('menuCategories').doc(categoryId);
    const categoryDoc = await categoryRef.get();
    
    if (!categoryDoc.exists) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的菜單分類',
      });
    }
    
    const categoryData = categoryDoc.data() as FirebaseFirestore.DocumentData;
    
    // 3. 租戶隔離檢查
    if (categoryData.tenantId !== user.tenantId) {
      return res.status(403).json({
        success: false,
        message: '沒有權限：無法更新其他租戶的菜單分類',
      });
    }
    
    // 4. 使用已驗證的請求體數據（通過validateRequest中間件驗證過）
    const validatedData = req.body as UpdateMenuCategoryInput;
    
    // 5. 準備更新數據
    const updateData: Partial<MenuCategory> & { updatedAt: admin.firestore.FieldValue } = {
      ...validatedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    logger.info('準備更新菜單分類', { categoryId, updateData });
    
    // 6. 更新數據庫
    await categoryRef.update(updateData);
    
    logger.info('菜單分類更新成功', { categoryId });
    
    // 7. 獲取最新的數據
    const updatedDoc = await categoryRef.get();
    const updatedData = updatedDoc.data() as FirebaseFirestore.DocumentData;
    
    // 8. 格式化時間戳並返回數據
    const formattedData = {
      ...updatedData,
      createdAt: updatedData.createdAt ? updatedData.createdAt.toDate().toISOString() : null,
      updatedAt: updatedData.updatedAt ? updatedData.updatedAt.toDate().toISOString() : null,
    };
    
    return res.status(200).json({
      success: true,
      message: '菜單分類更新成功',
      data: formattedData,
    });
    
  } catch (error) {
    logger.error('更新菜單分類時出錯:', error);
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
};

/**
 * 處理刪除菜單分類請求
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export const deleteMenuCategory = async (req: Request, res: Response): Promise<Response> => {
  const logger = functions.logger;
  logger.info('處理刪除菜單分類請求', { structuredData: true });
  
  try {
    // 1. 獲取請求參數和用戶信息
    const { categoryId } = req.params;
    const user = req.user as { uid: string; tenantId?: string; role: string };
    
    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的分類ID參數',
      });
    }
    
    // 2. 檢查分類是否存在
    const categoryRef = db.collection('menuCategories').doc(categoryId);
    const categoryDoc = await categoryRef.get();
    
    if (!categoryDoc.exists) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的菜單分類',
      });
    }
    
    const categoryData = categoryDoc.data() as FirebaseFirestore.DocumentData;
    
    // 3. 租戶隔離檢查
    if (categoryData.tenantId !== user.tenantId) {
      return res.status(403).json({
        success: false,
        message: '沒有權限：無法刪除其他租戶的菜單分類',
      });
    }
    
    // 4. 檢查該分類是否有相關菜單項目
    const menuItemsQuery = await db.collection('menuItems')
      .where('categoryId', '==', categoryId)
      .limit(1)
      .get();
    
    if (!menuItemsQuery.empty) {
      return res.status(400).json({
        success: false,
        message: '無法刪除：該分類下存在菜單項目，請先刪除或移動這些項目',
      });
    }
    
    // 5. 刪除分類
    await categoryRef.delete();
    
    logger.info('菜單分類刪除成功', { categoryId });
    
    return res.status(200).json({
      success: true,
      message: '菜單分類刪除成功',
    });
    
  } catch (error) {
    logger.error('刪除菜單分類時出錯:', error);
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error instanceof Error ? error.message : '未知錯誤',
    });
  }
}; 