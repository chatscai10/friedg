import * as express from 'express';
import * as handlers from './loyalty.handlers';
import { authenticate } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';
import { roleMiddleware } from '../middleware/rbac';

const router = express.Router();

// 鑑權中間件
router.use(authenticate);
router.use(tenantMiddleware);

/**
 * 會員等級規則管理路由
 */
router.post(
  '/admin/loyalty/tiers',
  roleMiddleware(['loyalty:manage_rules']),
  handlers.createTierRule
);

router.put(
  '/admin/loyalty/tiers/:tierId',
  roleMiddleware(['loyalty:manage_rules']),
  handlers.updateTierRule
);

router.get(
  '/admin/loyalty/tiers/:tierId',
  roleMiddleware(['loyalty:manage_rules']),
  handlers.getTierRule
);

router.get(
  '/admin/loyalty/tiers',
  roleMiddleware(['loyalty:manage_rules']),
  handlers.listTierRules
);

/**
 * 獎勵管理路由
 */
router.post(
  '/admin/loyalty/rewards',
  roleMiddleware(['loyalty:manage_rewards']),
  handlers.createReward
);

router.put(
  '/admin/loyalty/rewards/:rewardId',
  roleMiddleware(['loyalty:manage_rewards']),
  handlers.updateReward
);

router.get(
  '/admin/loyalty/rewards/:rewardId',
  roleMiddleware(['loyalty:manage_rewards']),
  handlers.getReward
);

router.get(
  '/admin/loyalty/rewards',
  roleMiddleware(['loyalty:manage_rewards']),
  handlers.listRewards
);

/**
 * 積分管理路由
 */
router.post(
  '/admin/loyalty/adjust-points',
  roleMiddleware(['loyalty:adjust_points']),
  handlers.adjustPoints
);

export default router; 