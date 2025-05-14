/**
 * 授權管理API路由
 */

import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { LicenseService, LicenseType } from '../services/licenseService';
import { withAuthentication } from '../middleware/auth.middleware.fixed';
import { checkPermission } from '../middleware/permission.middleware';

const router = express.Router();
const licenseService = new LicenseService();

/**
 * 檢查當前租戶的授權狀態
 * GET /api/v1/license/check
 */
router.get('/check', 
  withAuthentication,
  async (req, res) => {
    try {
      // 從用戶令牌中獲取租戶ID
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'missing_tenant_id',
            message: '無法獲取租戶ID'
          }
        });
      }
      
      // 檢查授權
      const result = await licenseService.checkLicense(tenantId);
      
      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('檢查授權失敗:', error);
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'license_check_failed',
          message: '檢查授權失敗',
          details: error.message
        }
      });
    }
  }
);

/**
 * 激活授權
 * POST /api/v1/license/activate
 */
router.post('/activate', 
  withAuthentication,
  async (req, res) => {
    try {
      const { activationCode } = req.body;
      
      if (!activationCode) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'missing_activation_code',
            message: '缺少激活碼'
          }
        });
      }
      
      // 從用戶令牌中獲取租戶ID
      const tenantId = req.user?.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'missing_tenant_id',
            message: '無法獲取租戶ID'
          }
        });
      }
      
      // 激活授權
      const result = await licenseService.activateLicense(tenantId, activationCode);
      
      return res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('激活授權失敗:', error);
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'license_activation_failed',
          message: '激活授權失敗',
          details: error.message
        }
      });
    }
  }
);

/**
 * 創建新授權（僅限超級管理員）
 * POST /api/v1/license/create
 */
router.post('/create', 
  withAuthentication,
  checkPermission({ action: 'create', resource: 'licenses' }),
  async (req, res) => {
    try {
      const { tenantId, type, durationDays } = req.body;
      
      if (!tenantId || !type || !durationDays) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'missing_parameters',
            message: '缺少必要參數'
          }
        });
      }
      
      // 驗證授權類型
      if (!Object.values(LicenseType).includes(type)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'invalid_license_type',
            message: '無效的授權類型'
          }
        });
      }
      
      // 創建授權
      const license = await licenseService.createLicense(tenantId, type, durationDays);
      
      return res.json({
        success: true,
        data: license
      });
    } catch (error) {
      console.error('創建授權失敗:', error);
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'license_creation_failed',
          message: '創建授權失敗',
          details: error.message
        }
      });
    }
  }
);

/**
 * 延長授權期限（僅限超級管理員）
 * POST /api/v1/license/:licenseId/extend
 */
router.post('/:licenseId/extend', 
  withAuthentication,
  checkPermission({ action: 'update', resource: 'licenses' }),
  async (req, res) => {
    try {
      const { licenseId } = req.params;
      const { additionalDays } = req.body;
      
      if (!additionalDays || additionalDays <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'invalid_days',
            message: '延長天數必須大於0'
          }
        });
      }
      
      // 延長授權
      const license = await licenseService.extendLicense(licenseId, additionalDays);
      
      return res.json({
        success: true,
        data: license
      });
    } catch (error) {
      console.error('延長授權失敗:', error);
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'license_extension_failed',
          message: '延長授權失敗',
          details: error.message
        }
      });
    }
  }
);

/**
 * 更新授權狀態（僅限超級管理員）
 * PUT /api/v1/license/:licenseId
 */
router.put('/:licenseId', 
  withAuthentication,
  checkPermission({ action: 'update', resource: 'licenses' }),
  async (req, res) => {
    try {
      const { licenseId } = req.params;
      const updates = req.body;
      
      // 防止更新敏感字段
      delete updates.id;
      delete updates.tenantId;
      delete updates.licenseKey;
      delete updates.createdAt;
      
      // 更新授權
      const license = await licenseService.updateLicense(licenseId, updates);
      
      return res.json({
        success: true,
        data: license
      });
    } catch (error) {
      console.error('更新授權失敗:', error);
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'license_update_failed',
          message: '更新授權失敗',
          details: error.message
        }
      });
    }
  }
);

/**
 * 獲取授權詳情（僅限租戶管理員或超級管理員）
 * GET /api/v1/license/:licenseId
 */
router.get('/:licenseId', 
  withAuthentication,
  checkPermission({ action: 'read', resource: 'licenses' }),
  async (req, res) => {
    try {
      const { licenseId } = req.params;
      
      // 獲取授權
      const licenseDoc = await admin.firestore().collection('licenses').doc(licenseId).get();
      
      if (!licenseDoc.exists) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'license_not_found',
            message: '授權不存在'
          }
        });
      }
      
      const license = licenseDoc.data();
      
      // 檢查權限
      if (req.user?.role !== 'super_admin' && req.user?.tenantId !== license?.tenantId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'permission_denied',
            message: '無權訪問此授權'
          }
        });
      }
      
      return res.json({
        success: true,
        data: license
      });
    } catch (error) {
      console.error('獲取授權失敗:', error);
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'license_fetch_failed',
          message: '獲取授權失敗',
          details: error.message
        }
      });
    }
  }
);

export default router;
