/**
 * 動態股權系統 - 路由定義
 */

import express from 'express';
import * as handlers from './equity.handlers';
import { authenticateUser } from '../middleware/authenticateUser';

const router = express.Router();

/**
 * 以下是基本路由定義
 * 在實際使用時，middleware可以根據實際項目需求添加
 */

/**
 * [GET] /legal-config/:storeId
 * 獲取指定店鋪的法律配置
 */
router.get('/legal-config/:storeId', handlers.getLegalConfig);

/**
 * [PUT] /legal-config/:storeId
 * 更新指定店鋪的法律配置
 */
router.put('/legal-config/:storeId', handlers.updateLegalConfig);

/**
 * [POST] /valuations
 * 創建新的股價估值記錄
 */
router.post('/valuations', handlers.createValuation);

/**
 * [GET] /valuations
 * 查詢估值歷史
 */
router.get('/valuations', handlers.getValuations);

/**
 * [POST] /stores/:storeId/equity-pool/init
 * 初始化店鋪股權池
 */
router.post('/stores/:storeId/equity-pool/init', handlers.initializeEquityPool);

/**
 * [GET] /stores/:storeId/equity-pool
 * 獲取店鋪股權池狀態
 */
router.get('/stores/:storeId/equity-pool', handlers.getEquityPool);

/**
 * [PUT] /stores/:storeId/equity-pool
 * 更新店鋪股權池設定
 */
router.put('/stores/:storeId/equity-pool', handlers.updateEquityPool);

/**
 * [POST] /holdings
 * 創建員工持股記錄 (績效授予或認購)
 */
router.post('/holdings', handlers.createHolding);

/**
 * [GET] /holdings
 * 查詢持股記錄 (可按員工ID或店鋪ID過濾)
 */
router.get('/holdings', handlers.getHoldings);

/**
 * [PUT] /holdings/:holdingId/status
 * 更新持股狀態 (如激活、歸屬等)
 */
router.put('/holdings/:holdingId/status', handlers.updateHoldingStatus);

/**
 * [POST] /dividend-cycles
 * 創建分紅週期記錄
 */
router.post('/dividend-cycles', handlers.createDividendCycle);

/**
 * [GET] /dividend-cycles
 * 獲取分紅週期列表 (可按店鋪ID過濾)
 */
router.get('/dividend-cycles', handlers.getDividendCycles);

/**
 * [GET] /employees/me/equity-holdings
 * 獲取當前登入員工的持股記錄
 */
router.get('/employees/me/equity-holdings', authenticateUser, handlers.getMyHoldings);

/**
 * [GET] /employees/me/installment-plans
 * 獲取當前登入員工的分期付款計劃
 */
router.get('/employees/me/installment-plans', authenticateUser, handlers.getMyInstallmentPlans);

export default router; 