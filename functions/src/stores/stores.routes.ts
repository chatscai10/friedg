import { Router } from 'express';
// 導入驗證 Schema
import { 
  createStoreSchema,
  updateStoreSchema,
  listStoresQuerySchema,
  getStoreByIdParamsSchema,
  updateStoreParamsSchema,
  deleteStoreParamsSchema,
  deleteStoreQuerySchema,
  updateStoreStatusParamsSchema,
  updateStoreStatusBodySchema,
  updateStoreGPSFenceParamsSchema,
  updateStoreGPSFenceBodySchema,
  updateStorePrinterSettingsParamsSchema,
  updateStorePrinterSettingsBodySchema,
  updateStoreBusinessHoursParamsSchema,
  updateStoreBusinessHoursBodySchema,
  updateStoreAttendanceSettingsParamsSchema,
  updateStoreAttendanceSettingsBodySchema,
} from './stores.validation';
// 導入 Handler 函數
import {
  listStoresHandler,
  getStoreByIdHandler,
  createStoreHandler,
  updateStoreHandler,
  deleteStoreHandler,
  updateStoreStatusHandler,
  updateStoreGPSFenceHandler,
  updateStorePrinterSettingsHandler,
  updateStoreBusinessHoursHandler,
  updateStoreAttendanceSettingsHandler,
} from './stores.handlers';
// 導入中間件
import { authenticate } from '../middleware/authMiddleware'; // 假設存在認證中間件
import { authorize } from '../middleware/rbacMiddleware'; // 假設存在 RBAC 中間件
import { validateRequest } from '../middleware/validateRequest'; // 導入通用的驗證中間件

const router = Router();

// 應用認證中間件到所有 Store 相關路由
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Stores
 *   description: 店鋪管理相關 API
 */

/**
 * @swagger
 * /stores:
 *   get:
 *     summary: 獲取店鋪列表
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每頁數量
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt, name, status]
 *           default: createdAt
 *         description: 排序字段
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: 排序方向
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, temporary_closed, permanently_closed]
 *         description: 按狀態篩選
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         description: 按租戶ID篩選 (僅限超級管理員或跨租戶權限)
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: 搜尋關鍵字 (店鋪名稱、代碼、地址)
 *     responses:
 *       200:
 *         description: 成功獲取店鋪列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '../api-specs/openapi.yaml#/components/schemas/PaginatedStoresResponse' # 假設 openapi.yaml 中有定義此 Schema
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.get(
  '/',
  validateRequest({ query: listStoresQuerySchema }),
  // authorize(ResourceTypes.STORES, 'read'), // RBAC 權限控制
  listStoresHandler
);

/**
 * @swagger
 * /stores/{storeId}:
 *   get:
 *     summary: 獲取單個店鋪詳情
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 店鋪 ID
 *     responses:
 *       200:
 *         description: 成功獲取店鋪詳情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '../api-specs/openapi.yaml#/components/schemas/Store' # 假設 openapi.yaml 中有定義此 Schema
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/NotFoundError'
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.get(
  '/:storeId',
  validateRequest({ params: getStoreByIdParamsSchema }),
  // authorize(ResourceTypes.STORES, 'read'), // RBAC 權限控制
  getStoreByIdHandler
);

/**
 * @swagger
 * /stores:
 *   post:
 *     summary: 創建新店鋪
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '../api-specs/openapi.yaml#/components/schemas/CreateStoreRequest' # 假設 openapi.yaml 中有定義此 Schema
 *     responses:
 *       201:
 *         description: 店鋪創建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '../api-specs/openapi.yaml#/components/schemas/Store'
 *       400:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/BadRequestError'
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 *       409:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ConflictError'
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.post(
  '/',
  validateRequest({ body: createStoreSchema }),
  // authorize(ResourceTypes.STORES, 'create'), // RBAC 權限控制
  createStoreHandler
);

/**
 * @swagger
 * /stores/{storeId}:
 *   put:
 *     summary: 更新店鋪
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 店鋪 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '../api-specs/openapi.yaml#/components/schemas/UpdateStoreRequest' # 假設 openapi.yaml 中有定義此 Schema
 *     responses:
 *       200:
 *         description: 店鋪更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '../api-specs/openapi.yaml#/components/schemas/Store'
 *       400:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/BadRequestError'
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/NotFoundError'
 *       409:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ConflictError'
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.put(
  '/:storeId',
  validateRequest({ params: updateStoreParamsSchema, body: updateStoreSchema }),
  // authorize(ResourceTypes.STORES, 'update'), // RBAC 權限控制
  updateStoreHandler
);

/**
 * @swagger
 * /stores/{storeId}:
 *   delete:
 *     summary: 刪除店鋪 (邏輯刪除，可選物理刪除)
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 店鋪 ID
 *       - in: query
 *         name: hardDelete
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 是否執行物理刪除 (僅限超級管理員)
 *     responses:
 *       204:
 *         description: 店鋪刪除成功 (無內容)
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/NotFoundError'
 *       409:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ConflictError' # 例如，店鋪下有活躍員工
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.delete(
  '/:storeId',
  validateRequest({ params: deleteStoreParamsSchema, query: deleteStoreQuerySchema }),
  // authorize(ResourceTypes.STORES, 'delete'), // RBAC 權限控制
  deleteStoreHandler
);

/**
 * @swagger
 * /stores/{storeId}/status:
 *   patch:
 *     summary: 更新店鋪狀態
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 店鋪 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, temporary_closed, permanently_closed]
 *                 description: 新狀態
 *               reason:
 *                 type: string
 *                 description: 狀態變更原因
 *     responses:
 *       200:
 *         description: 店鋪狀態更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 status:
 *                   type: string
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/BadRequestError'
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/NotFoundError'
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.patch(
  '/:storeId/status',
  validateRequest({ params: updateStoreStatusParamsSchema, body: updateStoreStatusBodySchema }),
  // authorize(ResourceTypes.STORES, 'update'), // RBAC 權限控制
  updateStoreStatusHandler
);

/**
 * @swagger
 * /stores/{storeId}/gps-fence:
 *   put:
 *     summary: 更新店鋪 GPS 圍欄設定
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 店鋪 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '../api-specs/openapi.yaml#/components/schemas/GPSFence' # 假設 openapi.yaml 中有定義此 Schema
 *     responses:
 *       200:
 *         description: GPS 圍欄設定更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 gpsFence:
 *                   $ref: '../api-specs/openapi.yaml#/components/schemas/GPSFence'
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/BadRequestError'
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/NotFoundError'
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.put(
  '/:storeId/gps-fence',
  validateRequest({ params: updateStoreGPSFenceParamsSchema, body: updateStoreGPSFenceBodySchema }),
  // authorize(ResourceTypes.STORES, 'update'), // RBAC 權限控制
  updateStoreGPSFenceHandler
);

/**
 * @swagger
 * /stores/{storeId}/printer-settings:
 *   put:
 *     summary: 更新店鋪印表機設定
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 店鋪 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '../api-specs/openapi.yaml#/components/schemas/PrinterSettings' # 假設 openapi.yaml 中有定義此 Schema
 *     responses:
 *       200:
 *         description: 印表機設定更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 printerSettings:
 *                   $ref: '../api-specs/openapi.yaml#/components/schemas/PrinterSettings'
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/BadRequestError'
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/NotFoundError'
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.put(
  '/:storeId/printer-settings',
  validateRequest({ params: updateStorePrinterSettingsParamsSchema, body: updateStorePrinterSettingsBodySchema }),
  // authorize(ResourceTypes.STORES, 'update'), // RBAC 權限控制
  updateStorePrinterSettingsHandler
);

/**
 * @swagger
 * /stores/{storeId}/business-hours:
 *   put:
 *     summary: 更新店鋪營業時間
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 店鋪 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '../api-specs/openapi.yaml#/components/schemas/BusinessHours' # 假設 openapi.yaml 中有定義此 Schema
 *     responses:
 *       200:
 *         description: 營業時間更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 operatingHours:
 *                   $ref: '../api-specs/openapi.yaml#/components/schemas/BusinessHours' # 注意这里 Schema 名称與類型定義OperatingHours對應
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/BadRequestError'
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/NotFoundError'
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.put(
  '/:storeId/business-hours',
  validateRequest({ params: updateStoreBusinessHoursParamsSchema, body: updateStoreBusinessHoursBodySchema }),
  // authorize(ResourceTypes.STORES, 'update'), // RBAC 權限控制
  updateStoreBusinessHoursHandler
);

/**
 * @swagger
 * /stores/{storeId}/attendance-settings:
 *   put:
 *     summary: 更新店鋪考勤設定
 *     tags: [Stores]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: 店鋪 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '../api-specs/openapi.yaml#/components/schemas/AttendanceSettings' # 假設 openapi.yaml 中有定義此 Schema
 *     responses:
 *       200:
 *         description: 考勤設定更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 attendanceSettings:
 *                   $ref: '../api-specs/openapi.yaml#/components/schemas/AttendanceSettings'
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/BadRequestError'
 *       401:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '../api-specs/openapi.yaml#/components/responses/NotFoundError'
 */
// 應用 validateRequest 中間件和 RBAC 中間件
router.put(
  '/:storeId/attendance-settings',
  validateRequest({ params: updateStoreAttendanceSettingsParamsSchema, body: updateStoreAttendanceSettingsBodySchema }),
  // authorize(ResourceTypes.STORES, 'update'), // RBAC 權限控制
  updateStoreAttendanceSettingsHandler
);

export default router;