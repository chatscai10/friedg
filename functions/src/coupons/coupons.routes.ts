import * as express from 'express';
import * as handlers from './coupons.handlers';
import { authenticate } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { roleMiddleware } from '../middleware/rbac';

const router = express.Router();

// 鑑權中間件
router.use(authenticate);
router.use(tenantMiddleware);

/**
 * 優惠券模板管理路由
 */
router.post(
  '/admin/coupons/templates',
  roleMiddleware(['coupons:manage_templates']),
  handlers.createTemplate
);

router.put(
  '/admin/coupons/templates/:templateId',
  roleMiddleware(['coupons:manage_templates']),
  handlers.updateTemplate
);

router.get(
  '/admin/coupons/templates/:templateId',
  roleMiddleware(['coupons:manage_templates']),
  handlers.getTemplate
);

router.get(
  '/admin/coupons/templates',
  roleMiddleware(['coupons:manage_templates']),
  handlers.listTemplates
);

/**
 * 優惠券實例操作路由
 */
router.post(
  '/admin/coupons/issue',
  roleMiddleware(['coupons:issue']),
  handlers.issueCoupon
);

router.get(
  '/admin/coupons',
  roleMiddleware(['coupons:view']),
  handlers.getUserCoupons
);

/**
 * 優惠券驗證路由 (前端結帳流程可能調用)
 */
router.post(
  '/coupons/validate',
  handlers.validateCoupon
);

export default router; 