import express from 'express';
import { 
  getPublicStoreProfileByIdHandler, 
  getNearbyStoresHandler, 
  initializeGeoDataHandler,
  getAllPublicStoresHandler,
  searchStoresHandler,
  getStoreRankingsHandler
} from './handlers';

// 創建路由器
const router = express.Router();

// 公開API路由，無需認證
// 獲取店家列表
router.get('/stores', getAllPublicStoresHandler);

// 獲取附近店家 (注意：此路由必須在:storeId的路由之前，否則會被視為storeId = "nearby")
router.get('/stores/nearby', getNearbyStoresHandler);

// 搜尋店家
router.get('/stores/search', searchStoresHandler);

// 獲取單個店家公開資料
router.get('/stores/:storeId', getPublicStoreProfileByIdHandler);

// 獲取店家排行榜
router.get('/rankings', getStoreRankingsHandler);

// 管理員API路由，需要權限認證
// 初始化店家地理資料
router.post('/admin/initialize-geo-data', initializeGeoDataHandler);

// 未來將實現的其他路由:
// GET /discovery/stores/featured - 獲取精選店家

export default router; 