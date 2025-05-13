import { Router } from 'express';
import { 
  listStores,
  getStoreById,
  createStore,
  updateStoreLocation,
  updateStoreBusinessHours
} from './stores.handlers';
import { validateRequest } from '../middleware/validation.middleware';
import { withAuthentication } from '../middleware/auth.middleware';
import { checkPermissions } from '../middleware/checkPermissions';

// 創建路由實例
const router = Router();

// 獲取分店列表
// GET /stores
router.get(
  '/',
  withAuthentication,
  listStores
);

// 獲取單個分店
// GET /stores/:storeId
router.get(
  '/:storeId',
  withAuthentication,
  getStoreById
);

// 創建新分店
// POST /stores
router.post(
  '/',
  withAuthentication,
  checkPermissions([{ action: 'create', resource: 'stores' }]),
  createStore
);

// 更新分店地理位置
// PUT /stores/:storeId/location
router.put(
  '/:storeId/location',
  withAuthentication,
  checkPermissions([{ action: 'update', resource: 'stores' }]),
  updateStoreLocation
);

// 更新分店營業時間
// PUT /stores/:storeId/business-hours
router.put(
  '/:storeId/business-hours',
  withAuthentication,
  checkPermissions([{ action: 'update', resource: 'stores' }]),
  updateStoreBusinessHours
);

export default router; 