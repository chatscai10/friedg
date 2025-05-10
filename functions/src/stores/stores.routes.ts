import { Router } from 'express';
import { 
  listStores,
  getStoreById,
  createStore,
  updateStore,
  updateStoreStatus,
  deleteStore,
  updateGPSFence,
  updatePrinterConfig
} from './stores.handlers';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateUser } from '../middleware/authenticateUser';
import { checkPermissions } from '../middleware/checkPermissions';
import { 
  createStoreSchema, 
  updateStoreSchema, 
  updateStoreStatusSchema,
  gpsFenceSchema,
  printerConfigSchema
} from './stores.validation';

// 創建路由實例
const router = Router();

// 應用認證中介軟體到所有 stores 路由
router.use(authenticateUser);

// 獲取分店列表
// GET /stores
router.get(
  '/',
  checkPermissions('stores', 'read'),
  listStores
);

// 獲取單個分店
// GET /stores/:storeId
router.get(
  '/:storeId',
  checkPermissions('stores', 'read'),
  getStoreById
);

// 創建新分店
// POST /stores
router.post(
  '/',
  checkPermissions('stores', 'create'),
  validateRequest(createStoreSchema),
  createStore
);

// 更新分店
// PUT /stores/:storeId
router.put(
  '/:storeId',
  checkPermissions('stores', 'update'),
  validateRequest(updateStoreSchema),
  updateStore
);

// 更新分店狀態
// PATCH /stores/:storeId/status
router.patch(
  '/:storeId/status',
  checkPermissions('stores', 'update'),
  validateRequest(updateStoreStatusSchema),
  updateStoreStatus
);

// 刪除分店
// DELETE /stores/:storeId
router.delete(
  '/:storeId',
  checkPermissions('stores', 'delete'),
  deleteStore
);

// 更新分店 GPS 圍欄
// PUT /stores/:storeId/gps-fence
router.put(
  '/:storeId/gps-fence',
  checkPermissions('stores', 'update'),
  validateRequest(gpsFenceSchema),
  updateGPSFence
);

// 更新分店印表機設定
// PUT /stores/:storeId/printer-config
router.put(
  '/:storeId/printer-config',
  checkPermissions('stores', 'update'),
  validateRequest(printerConfigSchema),
  updatePrinterConfig
);

export default router; 