import { Request, Response } from 'express';
import { CouponService } from './coupons.service';
import { validateTenantId } from '../middleware/tenant';

const couponService = new CouponService();

/**
 * 創建優惠券模板
 */
export async function createTemplate(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const data = { ...req.body, tenantId, createdBy: req.user.uid };
    
    const templateId = await couponService.createTemplate(data);
    
    return res.status(201).json({
      success: true,
      templateId,
      message: '優惠券模板創建成功'
    });
  } catch (error) {
    console.error('創建優惠券模板錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '創建優惠券模板時發生錯誤'
    });
  }
}

/**
 * 更新優惠券模板
 */
export async function updateTemplate(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    const { templateId } = req.params;
    
    if (!templateId) {
      return res.status(400).json({ error: '缺少 templateId 參數' });
    }
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    // 檢查模板是否存在
    const existingTemplate = await couponService.getTemplate(templateId);
    
    if (!existingTemplate) {
      return res.status(404).json({ error: '找不到此優惠券模板' });
    }
    
    // 檢查是否為同一租戶
    if (existingTemplate.tenantId !== tenantId) {
      return res.status(403).json({ error: '無權更新此優惠券模板' });
    }
    
    await couponService.updateTemplate(templateId, req.body);
    
    return res.status(200).json({
      success: true,
      message: '優惠券模板更新成功'
    });
  } catch (error) {
    console.error('更新優惠券模板錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '更新優惠券模板時發生錯誤'
    });
  }
}

/**
 * 獲取優惠券模板
 */
export async function getTemplate(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    const { templateId } = req.params;
    
    if (!templateId) {
      return res.status(400).json({ error: '缺少 templateId 參數' });
    }
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const template = await couponService.getTemplate(templateId);
    
    if (!template) {
      return res.status(404).json({ error: '找不到此優惠券模板' });
    }
    
    // 檢查是否為同一租戶
    if (template.tenantId !== tenantId) {
      return res.status(403).json({ error: '無權查看此優惠券模板' });
    }
    
    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('獲取優惠券模板錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '獲取優惠券模板時發生錯誤'
    });
  }
}

/**
 * 列出優惠券模板
 */
export async function listTemplates(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const onlyActive = req.query.active === 'true';
    
    const templates = await couponService.listTemplates(tenantId, onlyActive);
    
    return res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('列出優惠券模板錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '列出優惠券模板時發生錯誤'
    });
  }
}

/**
 * 發放優惠券
 */
export async function issueCoupon(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    const { userId, templateId, ...couponData } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: '缺少 userId 參數' });
    }
    
    let finalData: any = {
      ...couponData,
      memberId: userId,
      tenantId,
      source: 'manual',
      sourceId: req.user.uid, // 操作者ID
    };
    
    // 如果提供了模板ID，從模板創建優惠券
    if (templateId) {
      const template = await couponService.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: '找不到此優惠券模板' });
      }
      
      // 檢查是否為同一租戶
      if (template.tenantId !== tenantId) {
        return res.status(403).json({ error: '無權使用此優惠券模板' });
      }
      
      // 使用模板數據
      finalData = {
        ...finalData,
        templateId,
        type: template.type,
        value: template.value,
        description: template.name,
        expiryDate: template.validityType === 'fixed' ? template.validEndDate : null,
        constraints: template.constraints,
        maxUsage: template.maxUsagePerCoupon,
      };
      
      // 如果是動態有效期
      if (template.validityType === 'dynamic' && template.validDays) {
        const now = new Date();
        now.setDate(now.getDate() + template.validDays);
        finalData.expiryDate = now;
      }
    }
    
    // 驗證必要欄位
    if (!finalData.type || finalData.value === undefined || !finalData.maxUsage || !finalData.description || !finalData.expiryDate) {
      return res.status(400).json({ error: '缺少必要欄位（type, value, maxUsage, description, expiryDate）' });
    }
    
    const couponId = await couponService.createCouponInstance(finalData);
    
    return res.status(201).json({
      success: true,
      couponId,
      message: '優惠券發放成功'
    });
  } catch (error) {
    console.error('發放優惠券錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '發放優惠券時發生錯誤'
    });
  }
}

/**
 * 獲取用戶優惠券
 */
export async function getUserCoupons(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    const { userId } = req.query;
    const status = req.query.status as string || 'active';
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: '缺少 userId 參數' });
    }
    
    const coupons = await couponService.getCouponsByUserId(userId as string, tenantId, status);
    
    return res.status(200).json({
      success: true,
      data: coupons
    });
  } catch (error) {
    console.error('獲取用戶優惠券錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '獲取用戶優惠券時發生錯誤'
    });
  }
}

/**
 * 驗證優惠券
 */
export async function validateCoupon(req: Request, res: Response) {
  try {
    const { tenantId } = res.locals;
    const { code, userId, orderDetails } = req.body;
    
    if (!validateTenantId(tenantId)) {
      return res.status(403).json({ error: '無效的租戶 ID' });
    }
    
    if (!code || !userId) {
      return res.status(400).json({ error: '缺少必要參數' });
    }
    
    const result = await couponService.validateCoupon(code, userId, tenantId, orderDetails);
    
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('驗證優惠券錯誤:', error);
    return res.status(500).json({
      success: false,
      error: (error as Error).message || '驗證優惠券時發生錯誤'
    });
  }
} 