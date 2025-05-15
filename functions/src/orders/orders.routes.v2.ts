import { Router, Request, Response, NextFunction } from 'express';
import * as functions from 'firebase-functions';
import { OrderHandlersV2 } from './orders.handlers.v2';
import { requestLogger } from '../../middleware/common.middleware';
import {
    authenticateFirebaseToken,
    authorizeRoles
} from '../../middleware/auth.middleware';

const ordersRouterV2 = Router();
const orderHandlers = new OrderHandlersV2();

ordersRouterV2.use(requestLogger);

// POST / - Create a new order (customer authenticated)
ordersRouterV2.post('/', authenticateFirebaseToken, orderHandlers.createOrderHandler);

// GET /:orderId - Get an order by ID (customer can get their own, admin can get any - service layer handles fine-grained auth)
ordersRouterV2.get('/:orderId', authenticateFirebaseToken, orderHandlers.getOrderByIdHandler);

// PUT /:orderId/status - Update order status (admin or staff only)
ordersRouterV2.put(
  '/:orderId/status',
  authenticateFirebaseToken,
  authorizeRoles(['admin', 'staff']),
  orderHandlers.updateOrderStatusHandler
);

// TODO: Add routes for listing orders (e.g., for customer, for admin with filters)
// Example: ordersRouterV2.get('/', authenticateFirebaseToken, authorizeRoles(['admin', 'staff']), orderHandlers.listOrdersForAdminHandler);
// Example: ordersRouterV2.get('/my', authenticateFirebaseToken, orderHandlers.listMyOrdersHandler);

export default ordersRouterV2; 