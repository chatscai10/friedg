import { Request, Response } from 'express';
import { LoyaltyService } from './loyalty.service';
import { validateTenantId } from '../middleware/tenant';

const loyaltyService = new LoyaltyService();

/**
 * 創建會員等級規則
 */
export async function createTierRule(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const data = { ...req.body, tenantId, createdBy: req.user.uid };
    
    const tierId = await loyaltyService.createTierRule(data);
    
    return res.status(201).json({
      success: true,
      tierId,
      message: '會員等級規則創建成功'
    });
  } catch (error) {
    console.error('創建會員等級規則錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '創建會員等級規則時發生錯誤'
    });
  }
}

/**
 * 更新會員等級規則
 */
export async function updateTierRule(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    const { tierId } = req.params;
    
    if (!tierId) {
      return res.status(400).json({ error: '缺少 tierId 參數' });
    }
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    // 檢查規則是否存在
    const existingRule = await loyaltyService.getTierRule(tierId);
    
    if (!existingRule) {
      return res.status(404).json({ error: '找不到此等級規則' });
    }
    
    // 檢查是否為同一租戶
    if (existingRule.tenantId !== tenantId) {
      return res.status(403).json({ error: '無權更新此等級規則' });
    }
    
    await loyaltyService.updateTierRule(tierId, req.body);
    
    return res.status(200).json({
      success: true,
      message: '會員等級規則更新成功'
    });
  } catch (error) {
    console.error('更新會員等級規則錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '更新會員等級規則時發生錯誤'
    });
  }
}

/**
 * 獲取會員等級規則
 */
export async function getTierRule(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    const { tierId } = req.params;
    
    if (!tierId) {
      return res.status(400).json({ error: '缺少 tierId 參數' });
    }
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const rule = await loyaltyService.getTierRule(tierId);
    
    if (!rule) {
      return res.status(404).json({ error: '找不到此等級規則' });
    }
    
    // 檢查是否為同一租戶
    if (rule.tenantId !== tenantId) {
      return res.status(403).json({ error: '無權查看此等級規則' });
    }
    
    return res.status(200).json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('獲取會員等級規則錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '獲取會員等級規則時發生錯誤'
    });
  }
}

/**
 * 列出會員等級規則
 */
export async function listTierRules(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const onlyActive = req.query.active === 'true';
    
    const rules = await loyaltyService.listTierRules(tenantId, onlyActive);
    
    return res.status(200).json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('列出會員等級規則錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '列出會員等級規則時發生錯誤'
    });
  }
}

/**
 * 創建獎勵
 */
export async function createReward(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const data = { ...req.body, tenantId, createdBy: req.user.uid };
    
    const rewardId = await loyaltyService.createReward(data);
    
    return res.status(201).json({
      success: true,
      rewardId,
      message: '獎勵創建成功'
    });
  } catch (error) {
    console.error('創建獎勵錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '創建獎勵時發生錯誤'
    });
  }
}

/**
 * 更新獎勵
 */
export async function updateReward(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    const { rewardId } = req.params;
    
    if (!rewardId) {
      return res.status(400).json({ error: '缺少 rewardId 參數' });
    }
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    // 檢查獎勵是否存在
    const existingReward = await loyaltyService.getReward(rewardId);
    
    if (!existingReward) {
      return res.status(404).json({ error: '找不到此獎勵' });
    }
    
    // 檢查是否為同一租戶
    if (existingReward.tenantId !== tenantId) {
      return res.status(403).json({ error: '無權更新此獎勵' });
    }
    
    await loyaltyService.updateReward(rewardId, req.body);
    
    return res.status(200).json({
      success: true,
      message: '獎勵更新成功'
    });
  } catch (error) {
    console.error('更新獎勵錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '更新獎勵時發生錯誤'
    });
  }
}

/**
 * 獲取獎勵
 */
export async function getReward(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    const { rewardId } = req.params;
    
    if (!rewardId) {
      return res.status(400).json({ error: '缺少 rewardId 參數' });
    }
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const reward = await loyaltyService.getReward(rewardId);
    
    if (!reward) {
      return res.status(404).json({ error: '找不到此獎勵' });
    }
    
    // 檢查是否為同一租戶
    if (reward.tenantId !== tenantId) {
      return res.status(403).json({ error: '無權查看此獎勵' });
    }
    
    return res.status(200).json({
      success: true,
      data: reward
    });
  } catch (error) {
    console.error('獲取獎勵錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '獲取獎勵時發生錯誤'
    });
  }
}

/**
 * 列出獎勵
 */
export async function listRewards(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const onlyActive = req.query.active === 'true';
    
    const rewards = await loyaltyService.listRewards(tenantId, onlyActive);
    
    return res.status(200).json({
      success: true,
      data: rewards
    });
  } catch (error) {
    console.error('列出獎勵錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '列出獎勵時發生錯誤'
    });
  }
}

/**
 * 調整用戶積分
 */
export async function adjustPoints(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    const { userId, points, type, source, sourceId, description } = req.body;
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    if (!userId || points === undefined || !type || !source) {
      return res.status(400).json({ error: '缺少必要參數' });
    }
    
    // 調整積分
    const transaction = await loyaltyService.adjustPoints(
      userId,
      tenantId,
      points,
      type,
      source,
      sourceId,
      description,
      req.user.uid
    );
    
    // 評估並更新等級
    const tierResult = await loyaltyService.evaluateAndUpdateTier(userId, tenantId);
    
    return res.status(200).json({
      success: true,
      transaction,
      tierUpdate: tierResult,
      message: `積分調整成功 (${points > 0 ? '+' : ''}${points})`
    });
  } catch (error) {
    console.error('調整用戶積分錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '調整用戶積分時發生錯誤'
    });
  }
} 