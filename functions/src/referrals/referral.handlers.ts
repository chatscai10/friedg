import { Request, Response } from 'express';
import * as functions from 'firebase-functions';
import { 
  generateReferralCode, 
  applyReferralCode, 
  getMemberReferrals 
} from './referral.service';
import { 
  ApplyReferralCodeSchema, 
  GetReferralsQuerySchema 
} from './referral.validators';

const logger = functions.logger;

/**
 * 生成會員推薦碼
 * @param req Express請求對象
 * @param res Express回應對象
 * @returns Promise<Response>
 */
export async function generateReferralCodeHandler(req: Request, res: Response): Promise<Response> {
  try {
    // 從認證信息獲取會員ID
    const user = req.user;
    if (!user || !user.uid) {
      logger.error('生成推薦碼失敗：未獲取到有效的用戶ID');
      return res.status(403).json({
        status: 'error',
        message: '未授權：缺少用戶ID'
      });
    }
    
    const userId = user.uid;
    
    // 使用推薦碼服務生成推薦碼
    logger.info(`開始為用戶 ${userId} 生成推薦碼`);
    const result = await generateReferralCode(userId);
    
    logger.info(`成功為用戶 ${userId} 生成推薦碼: ${result.referralCode}`);
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`生成推薦碼錯誤: ${errorMessage}`);
    
    // 處理特定錯誤類型
    if (error instanceof Error && error.message.includes('不存在')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: '服務器錯誤',
      error: errorMessage
    });
  }
}

/**
 * 會員應用推薦碼
 * @param req Express請求對象
 * @param res Express回應對象
 * @returns Promise<Response>
 */
export async function applyReferralCodeHandler(req: Request, res: Response): Promise<Response> {
  try {
    // 驗證請求
    const validationResult = ApplyReferralCodeSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.warn(`推薦碼應用失敗：無效的輸入數據，錯誤: ${JSON.stringify(validationResult.error.errors)}`);
      return res.status(400).json({
        status: 'error',
        message: '無效的請求數據',
        errors: validationResult.error.errors
      });
    }
    
    // 從認證信息獲取會員ID
    const user = req.user;
    if (!user || !user.uid) {
      logger.error('應用推薦碼失敗：未獲取到有效的用戶ID');
      return res.status(403).json({
        status: 'error',
        message: '未授權：缺少用戶ID'
      });
    }
    
    const refereeUserId = user.uid;
    const { code } = validationResult.data;
    
    // 使用推薦碼服務應用推薦碼
    logger.info(`用戶 ${refereeUserId} 開始應用推薦碼: ${code}`);
    const result = await applyReferralCode(refereeUserId, { code });
    
    logger.info(`用戶 ${refereeUserId} 成功應用推薦碼: ${code}，創建記錄ID: ${result.referralRecordId}`);
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`應用推薦碼錯誤: ${errorMessage}`);
    
    // 處理業務邏輯錯誤
    if (error instanceof Error) {
      if (
        error.message.includes('已經使用過推薦碼') ||
        error.message.includes('無效的推薦碼') ||
        error.message.includes('不能使用自己的推薦碼') ||
        error.message.includes('不能形成循環推薦關係') ||
        error.message.includes('推薦碼只能在註冊後30天內使用') ||
        error.message.includes('推薦人已達到推薦上限')
      ) {
        return res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
      
      if (error.message.includes('不存在')) {
        return res.status(404).json({
          status: 'error',
          message: error.message
        });
      }
    }
    
    return res.status(500).json({
      status: 'error',
      message: '服務器錯誤',
      error: errorMessage
    });
  }
}

/**
 * 獲取會員的推薦記錄
 * @param req Express請求對象
 * @param res Express回應對象
 * @returns Promise<Response>
 */
export async function getMemberReferralsHandler(req: Request, res: Response): Promise<Response> {
  try {
    // 驗證查詢參數
    const validationResult = GetReferralsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      logger.warn(`獲取推薦記錄失敗：無效的查詢參數，錯誤: ${JSON.stringify(validationResult.error.errors)}`);
      return res.status(400).json({
        status: 'error',
        message: '無效的查詢參數',
        errors: validationResult.error.errors
      });
    }
    
    // 從認證信息獲取會員ID
    const user = req.user;
    if (!user || !user.uid) {
      logger.error('獲取推薦記錄失敗：未獲取到有效的用戶ID');
      return res.status(403).json({
        status: 'error',
        message: '未授權：缺少用戶ID'
      });
    }
    
    const userId = user.uid;
    const params = validationResult.data;
    
    // 使用推薦碼服務獲取推薦記錄
    logger.info(`開始獲取用戶 ${userId} 的推薦記錄，類型: ${params.type}`);
    const referrals = await getMemberReferrals(userId, params);
    
    logger.info(`成功獲取用戶 ${userId} 的推薦記錄，共 ${referrals.length} 條`);
    return res.status(200).json({
      status: 'success',
      data: referrals
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`獲取推薦記錄錯誤: ${errorMessage}`);
    
    if (error instanceof Error && error.message.includes('不存在')) {
      return res.status(404).json({
        status: 'error',
        message: error.message
      });
    }
    
    return res.status(500).json({
      status: 'error',
      message: '服務器錯誤',
      error: errorMessage
    });
  }
} 