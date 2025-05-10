import express from 'express';
import {
  listCustomersHandler,
  getCustomerHandler,
  updateCustomerHandler,
  addTagToCustomerHandler,
  removeTagFromCustomerHandler,
  addNoteToCustomerHandler,
  getCustomerNotesHandler,
} from './crm.handlers';
import { withAuthentication } from '../middleware/auth.middleware';
import { checkTenantAccess } from '../middleware/tenant.middleware';
import { checkPermissions } from '../middleware/checkPermissions';

const router = express.Router();

// 使用租戶和認證中介軟體
router.use(withAuthentication);
router.use(checkTenantAccess);

// 客戶列表路由
router.get('/customers', checkPermissions('crm', 'read'), listCustomersHandler);

// 客戶詳情路由
router.get('/customers/:customerId', checkPermissions('crm', 'read'), getCustomerHandler);

// 更新客戶資料路由
router.patch('/customers/:customerId', checkPermissions('crm', 'update'), updateCustomerHandler);

// 客戶標籤相關路由
router.post('/customers/:customerId/tags', checkPermissions('crm', 'update'), addTagToCustomerHandler);
router.delete('/customers/:customerId/tags/:tag', checkPermissions('crm', 'update'), removeTagFromCustomerHandler);

// 客戶備註相關路由
router.get('/customers/:customerId/notes', checkPermissions('crm', 'read'), getCustomerNotesHandler);
router.post('/customers/:customerId/notes', checkPermissions('crm', 'update'), addNoteToCustomerHandler);

export default router; 