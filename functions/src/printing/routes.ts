/**
 * 雲端出單 (Cloud Printing) 模組 - 路由
 */
import * as express from 'express';
import { 
  createPrintJob, 
  getPrintJobs, 
  updatePrintJobStatus,
  cancelPrintJob
} from './handlers';
import { PrintJobStatus } from './types';
import { checkAuth, checkTenantAccess, checkStoreAccess } from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @route   POST /api/printing/jobs
 * @desc    創建新的列印任務
 * @access  需驗證 + 商店權限
 */
router.post(
  '/jobs', 
  checkAuth,
  checkTenantAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      // 確保有必要的權限
      const user = (req as any).user;
      const tenantId = req.body.tenantId || user.tenantId;
      const storeId = req.body.storeId || user.storeId;
      
      if (!storeId) {
        return res.status(400).json({
          status: 'error',
          message: '缺少商店ID'
        });
      }
      
      // 準備列印任務數據
      const jobData = {
        ...req.body,
        tenantId,
        storeId,
        createdBy: user.uid,
        source: 'user'
      };
      
      // 創建列印任務
      const printJob = await createPrintJob(jobData);
      
      return res.status(201).json({
        status: 'success',
        data: printJob,
        message: '列印任務已創建，等待處理'
      });
    } catch (error: any) {
      console.error('創建列印任務時發生錯誤:', error);
      return res.status(500).json({
        status: 'error',
        message: '創建列印任務時出錯',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/printing/jobs
 * @desc    獲取商店的列印任務列表
 * @access  需驗證 + 商店權限
 */
router.get(
  '/jobs', 
  checkAuth,
  checkTenantAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = (req as any).user;
      const storeId = req.query.storeId as string || user.storeId;
      
      if (!storeId) {
        return res.status(400).json({
          status: 'error',
          message: '缺少商店ID'
        });
      }
      
      // 解析查詢參數
      let status: PrintJobStatus | undefined = undefined;
      if (req.query.status && Object.values(PrintJobStatus).includes(req.query.status as PrintJobStatus)) {
        status = req.query.status as PrintJobStatus;
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      
      // 獲取列印任務列表
      const printJobs = await getPrintJobs(storeId, status, limit);
      
      return res.status(200).json({
        status: 'success',
        data: printJobs,
        message: '成功獲取列印任務列表'
      });
    } catch (error: any) {
      console.error('獲取列印任務列表時發生錯誤:', error);
      return res.status(500).json({
        status: 'error',
        message: '獲取列印任務列表時出錯',
        error: error.message
      });
    }
  }
);

/**
 * @route   PUT /api/printing/jobs/:jobId/status
 * @desc    更新列印任務狀態 (主要供列印橋接器使用)
 * @access  需驗證 + API金鑰驗證
 * @note    這個路由將在後續實作列印橋接器時完善安全驗證
 */
router.put(
  '/jobs/:jobId/status', 
  checkAuth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { jobId } = req.params;
      const { status, statusMessage } = req.body;
      
      if (!jobId || !status) {
        return res.status(400).json({
          status: 'error',
          message: '缺少任務ID或狀態'
        });
      }
      
      // 確認狀態有效
      if (!Object.values(PrintJobStatus).includes(status)) {
        return res.status(400).json({
          status: 'error',
          message: '無效的任務狀態'
        });
      }
      
      // 更新任務狀態
      const updatedJob = await updatePrintJobStatus(jobId, status, statusMessage);
      
      return res.status(200).json({
        status: 'success',
        data: updatedJob,
        message: '列印任務狀態已更新'
      });
    } catch (error: any) {
      console.error('更新列印任務狀態時發生錯誤:', error);
      return res.status(500).json({
        status: 'error',
        message: '更新列印任務狀態時出錯',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/printing/jobs/:jobId
 * @desc    取消列印任務
 * @access  需驗證 + 商店權限
 */
router.delete(
  '/jobs/:jobId', 
  checkAuth,
  checkTenantAccess,
  async (req: express.Request, res: express.Response) => {
    try {
      const { jobId } = req.params;
      
      if (!jobId) {
        return res.status(400).json({
          status: 'error',
          message: '缺少任務ID'
        });
      }
      
      // 取消任務
      const success = await cancelPrintJob(jobId);
      
      if (!success) {
        return res.status(400).json({
          status: 'error',
          message: '無法取消任務，可能已在處理中或已完成'
        });
      }
      
      return res.status(200).json({
        status: 'success',
        message: '列印任務已取消'
      });
    } catch (error: any) {
      console.error('取消列印任務時發生錯誤:', error);
      return res.status(500).json({
        status: 'error',
        message: '取消列印任務時出錯',
        error: error.message
      });
    }
  }
);

export default router; 