import { Request, Response } from 'express';

/**
 * 獲取當前用戶Profile的處理器 (簡化版)
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export async function getProfileHandler(req: Request, res: Response): Promise<Response> {
  // 從請求中獲取驗證過的用戶ID (應由認證中間件提供)
  const userId = req.user?.uid || 'test-user-001';
  
  try {
    // 模擬用戶資料
    const userProfile = {
      uid: userId,
      email: `${userId}@example.com`,
      displayName: `測試用戶 ${userId}`,
      photoURL: 'https://via.placeholder.com/150',
      phoneNumber: '0912345678',
      membershipTier: 'standard',
      membershipPoints: 100,
      lifetimePoints: 250
    };

    // 返回用戶資料
    console.log(`成功獲取用戶Profile (模擬)，UID: ${userId}`);
    return res.status(200).json({
      success: true,
      data: userProfile
    });

  } catch (error: any) {
    console.error(`獲取用戶Profile時發生錯誤，UID: ${userId}`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: '獲取用戶資料時發生錯誤'
    });
  }
}

/**
 * 更新當前用戶Profile的處理器 (簡化版)
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export async function updateProfileHandler(req: Request, res: Response): Promise<Response> {
  // 從請求中獲取驗證過的用戶ID (應由認證中間件提供)
  const userId = req.user?.uid || 'test-user-001';
  
  try {
    // 模擬資料更新 (不實際儲存，只記錄請求)
    console.log(`成功更新用戶Profile (模擬)，UID: ${userId}`, req.body);
    
    // 返回成功響應
    return res.status(200).json({
      success: true,
      message: '成功更新用戶資料'
    });

  } catch (error: any) {
    console.error(`更新用戶Profile時發生錯誤，UID: ${userId}`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: '更新用戶資料時發生錯誤'
    });
  }
}

/**
 * 更新用戶狀態的處理器 (簡化版)
 * @param req Express請求對象
 * @param res Express響應對象
 * @returns Promise<Response>
 */
export async function updateUserStatus(req: Request, res: Response): Promise<Response> {
  const userId = req.params.userId;
  const { status } = req.body;
  
  console.log(`接收到更新用戶狀態請求 (模擬)，UID: ${userId}`, { status });
  
  // 檢查狀態值是否有效
  const validStatuses = ['active', 'inactive', 'suspended', 'deleted'];
  if (!status || !validStatuses.includes(status)) {
    console.warn(`無效的用戶狀態值: ${status}`);
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: '無效的用戶狀態，允許的值為: active, inactive, suspended, deleted'
    });
  }
  
  try {
    // 模擬更新用戶狀態 (不實際儲存，只記錄請求)
    console.log(`成功更新用戶狀態 (模擬)，UID: ${userId}`, { status });
    
    // 返回成功響應
    return res.status(200).json({
      success: true,
      message: '成功更新用戶狀態',
      data: {
        uid: userId,
        status: status,
        displayName: `測試用戶 ${userId}`,
        email: `${userId}@example.com`,
        updatedAt: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error(`更新用戶狀態處理過程中發生錯誤，UID: ${userId}`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: '處理更新用戶狀態請求時發生錯誤'
    });
  }
} 