import * as functions from 'firebase-functions';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateOrderPayloadSchema, OrderServiceError } from './orders.types.v2';
import { OrderServiceV2 } from './orders.service.v2';
import { ApiErrorResponse } from '../payments/linepay.types.v2'; // Generic error response
import { UserRecord } from 'firebase-admin/auth';
import { getLogger } from '../utils/logging.utils';
import { ZodError } from 'zod';

const logger = getLogger('OrderHandlersV2');

// Augment Express Request type to include currentUser
interface AuthenticatedRequest extends Request {
  currentUser?: UserRecord;
  userRoles?: string[]; // Assuming roles are populated by auth middleware
}

const getCustomerIdFromRequest = (req: Request): string | undefined => {
  return (req as any).user?.uid;
};

export class OrderHandlersV2 {
  private orderService: OrderServiceV2;

  constructor() {
    this.orderService = new OrderServiceV2();
  }

  createOrderHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    logger.info('Handling createOrder request');
    try {
      if (!req.currentUser) {
        logger.warn('User not authenticated for createOrderHandler');
        return res.status(401).json({ error: '用戶未認證。' });
      }

      const payload = CreateOrderPayloadSchema.parse(req.body);
      // Override or ensure customerId from payload matches authenticated user if necessary
      // For now, we trust the payload or assume it has been validated/set appropriately if needed.
      // If payload.customerId is not part of schema, use req.currentUser.uid directly.
      // Current CreateOrderPayloadSchema has customerId, if it should always be the token user, adjust schema or logic here.
      // Let's assume payload.customerId could be for someone else if an admin is creating it.
      // However, the service uses req.currentUser.uid to set customerId on the order.
      // This means payload.customerId in CreateOrderPayloadSchema might be redundant if OrderService always uses currentUser.uid.
      // For simplicity, let's ensure payload.customerId matches currentUser.uid or is an admin action (not implemented yet).

      // Let's refine: The service already uses currentUser.uid for the order's customerId.
      // So, the customerId in CreateOrderPayload is more like a target customer IF an admin is creating order for someone else.
      // For normal user, it is expected that payload.customerId (if present) should match currentUser.uid.
      // For now, we will let the service use `currentUser.uid` as the actual `order.customerId`.
      // The `payload.customerId` from request body is effectively ignored by `OrderServiceV2.createOrder` for `order.customerId` field.
      // This is fine as service sets the definitive customerId from token.
      
      const order = await this.orderService.createOrder(payload, req.currentUser);
      logger.info('Order created successfully by handler', { orderId: order.id });
      return res.status(201).json(order);
    } catch (error: any) {
      logger.error('Error in createOrderHandler', { error: error.message, details: error.details, stack: error.stack });
      if (error instanceof ZodError) {
        return res.status(400).json({ error: '請求數據格式錯誤。', code: 'validation_error', details: error.flatten().fieldErrors });
      }
      if (error instanceof OrderServiceError) {
        switch (error.code) {
          case 'invalid_item_data':
          case 'invalid_total_amount':
            return res.status(400).json({ error: error.message, code: error.code, details: error.details });
          case 'inventory_error': // Specific inventory issues might be a conflict
            return res.status(409).json({ error: error.message, code: error.code, details: error.details });
          case 'read_after_create_failed': // This is a server-side issue
             logger.error('Critical: Failed to read order immediately after creation', { orderId: error.details?.orderId, idempotencyKey: error.details?.idempotencyKey });
            return res.status(500).json({ error: '訂單創建過程中發生內部錯誤，請稍後再試。', code: error.code });
          case 'create_failed':
          default:
            return res.status(500).json({ error: error.message, code: error.code || 'create_order_failed', details: error.details });
        }
      }
      return next(error); // Pass to global error handler for unhandled errors
    }
  };

  getOrderByIdHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { orderId } = req.params;
    logger.info(`Handling getOrderById request for order: ${orderId}`);
    try {
      if (!req.currentUser) {
        logger.warn('User not authenticated for getOrderByIdHandler');
        return res.status(401).json({ error: '用戶未認證。' });
      }

      const order = await this.orderService.getOrderById(orderId, req.currentUser.uid, req.userRoles || []);
      if (!order) {
        logger.warn(`Order ${orderId} not found by handler`);
        return res.status(404).json({ error: '訂單未找到。' });
      }
      logger.info(`Order ${orderId} retrieved successfully by handler`);
      return res.status(200).json(order);
    } catch (error: any) {
      logger.error(`Error in getOrderByIdHandler for order ${orderId}`, { error: error.message, details: error.details });
      if (error instanceof OrderServiceError) {
        switch (error.code) {
          case 'permission_denied':
            return res.status(403).json({ error: error.message, code: error.code });
          case 'not_found': // Though service currently returns null for not_found
            return res.status(404).json({ error: error.message, code: error.code });
          default:
            return res.status(500).json({ error: error.message, code: error.code || 'get_order_failed' });
        }
      }
      return next(error);
    }
  };

  updateOrderStatusHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { orderId } = req.params;
    logger.info(`Handling updateOrderStatus request for order: ${orderId}`);
    try {
      if (!req.currentUser || !req.userRoles) {
        logger.warn('User not authenticated or roles not available for updateOrderStatusHandler');
        return res.status(401).json({ error: '用戶未認證或缺少必要權限信息。' });
      }

      const { status } = UpdateOrderStatusPayloadSchema.parse(req.body);
      
      const updatedOrder = await this.orderService.updateOrderStatus(orderId, status, req.currentUser.uid, req.userRoles);
      logger.info(`Order ${orderId} status updated successfully by handler to ${status}`);
      return res.status(200).json(updatedOrder);
    } catch (error: any) {
      logger.error(`Error in updateOrderStatusHandler for order ${orderId}`, { error: error.message, details: error.details });
      if (error instanceof ZodError) {
        return res.status(400).json({ error: '請求數據格式錯誤。', code: 'validation_error', details: error.flatten().fieldErrors });
      }
      if (error instanceof OrderServiceError) {
        switch (error.code) {
          case 'permission_denied':
            return res.status(403).json({ error: error.message, code: error.code, details: error.details });
          case 'not_found':
            return res.status(404).json({ error: error.message, code: error.code, details: error.details });
          case 'invalid_state_transition':
            return res.status(409).json({ error: error.message, code: error.code, details: error.details }); // 409 Conflict due to resource state
          case 'update_failed': // Generic update failure from service
          default:
            return res.status(500).json({ error: error.message, code: error.code || 'update_status_failed', details: error.details });
        }
      }
      return next(error);
    }
  };
  
  // Example for listing orders (basic structure, needs more work for pagination, filtering)
  // listOrdersHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  //   logger.info('Handling listOrders request');
  //   try {
  //     if (!req.currentUser) {
  //       return res.status(401).json({ error: '用戶未認證。' });
  //     }
  //     // TODO: Implement pagination, filtering by status, date range, etc.
  //     // const { limit, startAfter, statusFilter } = req.query;
  //     // const orders = await this.orderService.getOrdersForUser(req.currentUser.uid, req.userRoles, { limit, startAfter, statusFilter });
  //     // For now, a placeholder:
  //     return res.status(501).json({ message: 'Order listing not fully implemented yet.' });
  //   } catch (error: any) {
  //     logger.error('Error in listOrdersHandler', { error: error.message });
  //     return next(error);
  //   }
  // };
} 