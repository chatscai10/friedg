import { Request, Response } from 'express';
import * as functions from 'firebase-functions';
import { getUserProfile, updateUserProfile, updateUserStatus } from './user.service';
import { UpdateProfileSchema } from './user.validators';

// 日誌記錄
const logger = functions.logger;

/**
 * 獲取當前用戶Profile的處理器
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export async function getProfileHandler(req: Request, res: Response): Promise<Response> {
  // 從請求中獲取驗證過的用戶ID (應由認證中間件提供)
  const userId = req.user?.uid;
  
  if (!userId) {
    logger.error('獲取用戶Profile時缺少用戶ID，可能是未經過認證中間件');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: '用戶未認證或認證信息無效'
    });
  }

  try {
    // 調用Service層獲取用戶資料
    const userProfile = await getUserProfile(userId);

    // 檢查用戶是否存在
    if (!userProfile) {
      logger.warn(`找不到用戶Profile，UID: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: '找不到用戶資料'
      });
    }

    // 返回用戶資料
    logger.info(`成功獲取用戶Profile，UID: ${userId}`);
    return res.status(200).json({
      success: true,
      data: userProfile
    });

  } catch (error: any) {
    logger.error(`獲取用戶Profile時發生錯誤，UID: ${userId}`, { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: '獲取用戶資料時發生錯誤'
    });
  }
}

/**
 * 更新當前用戶Profile的處理器
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export async function updateProfileHandler(req: Request, res: Response): Promise<Response> {
  // 從請求中獲取驗證過的用戶ID (應由認證中間件提供)
  const userId = req.user?.uid;
  
  if (!userId) {
    logger.error('更新用戶Profile時缺少用戶ID，可能是未經過認證中間件');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: '用戶未認證或認證信息無效'
    });
  }

  // 驗證請求體
  const validationResult = UpdateProfileSchema.safeParse(req.body);

  if (!validationResult.success) {
    // 驗證失敗，返回錯誤信息
    const formattedErrors = validationResult.error.format();
    logger.warn(`用戶Profile更新請求驗證失敗，UID: ${userId}`, { errors: formattedErrors });
    
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: '請求數據格式無效',
      details: formattedErrors
    });
  }

  // 獲取驗證後的請求數據
  const validatedData = validationResult.data;

  // 如果請求體為空對象，則提示用戶
  if (Object.keys(validatedData).length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: '請求未包含任何要更新的資料'
    });
  }

  try {
    // 調用Service層更新用戶資料
    await updateUserProfile(userId, validatedData);

    // 返回成功響應
    logger.info(`成功更新用戶Profile，UID: ${userId}`, { updatedFields: Object.keys(validatedData) });
    return res.status(200).json({
      success: true,
      message: '成功更新用戶資料'
    });

  } catch (error: any) {
    // 根據錯誤類型返回適當的HTTP狀態碼
    if (error.message && error.message.includes('用戶不存在')) {
      logger.warn(`更新不存在的用戶Profile，UID: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: '找不到用戶資料'
      });
    }

    logger.error(`更新用戶Profile時發生錯誤，UID: ${userId}`, { 
      error: error.message, 
      stack: error.stack,
      data: validatedData 
    });
    
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: '更新用戶資料時發生錯誤'
    });
  }
}

/**
 * 更新用戶狀態的處理器
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export async function updateUserStatus(req: Request, res: Response): Promise<Response> {
  const userId = req.params.userId;
  const { status } = req.body;
  const tenantId = req.user?.tenantId || 'unknown';
  
  logger.info(`接收到更新用戶狀態請求，UID: ${userId}`, { status });
  
  // 檢查狀態值是否有效
  const validStatuses = ['active', 'inactive', 'suspended', 'deleted'];
  if (!status || !validStatuses.includes(status)) {
    logger.warn(`無效的用戶狀態值: ${status}`);
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: '無效的用戶狀態，允許的值為: active, inactive, suspended, deleted'
    });
  }
  
  try {
    // 調用Service層更新用戶狀態
    const result = await updateUserStatus(userId, status, tenantId);
    
    if (result.error) {
      // 根據錯誤代碼返回適當的HTTP狀態碼
      switch (result.code) {
        case 'USER_NOT_FOUND':
          return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: result.error
          });
        case 'TENANT_MISMATCH':
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: result.error
          });
        default:
          return res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: result.error
          });
      }
    }
    
    // 返回成功響應
    logger.info(`成功更新用戶狀態，UID: ${userId}`, { status });
    return res.status(200).json({
      success: true,
      message: '成功更新用戶狀態',
      data: result.data
    });
    
  } catch (error: any) {
    logger.error(`更新用戶狀態處理過程中發生錯誤，UID: ${userId}`, { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: '處理更新用戶狀態請求時發生錯誤'
    });
  }
} 