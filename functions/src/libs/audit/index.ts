/**
 * 操作日誌 (Audit Log) 模組 - 入口文件
 */

// 導出所有類型定義
export * from './types';

// 導出所有服務函數
export {
  logAuditEvent,
  createPartitionIndex,
  purgeOldAuditLogs
} from './audit.service';

// 導出API處理函數
export {
  queryAuditLogs,
  getAuditLogDetail
} from './handlers';

// 導出實用工具函數
export * from './utils';

// 導出路由
import routes from './routes';
export { routes };

/**
 * 操作日誌 (Audit Log) 模組 - 模塊導出
 */
import * as auditService from './audit.service';
import { AuditAction } from './audit.types';

// 匯出所有服務函數
export * from './audit.service';

// 匯出類型定義
export * from './audit.types';

// 也匯出默認對象（便於使用）
export default {
  ...auditService,
  AuditAction,
}; 