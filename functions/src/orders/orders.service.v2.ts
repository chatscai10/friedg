import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { CreateOrderPayload, OrderDoc, OrderServiceError } from './orders.types.v2';
import { InventoryServiceV2, InventoryServiceError } from '../inventory/inventory.service.v2';
import { UserRecord } from 'firebase-admin/auth';
import { getLogger } from '../utils/logging.utils';
import { idempotencyService } from '../utils/idempotency';
import crypto from 'crypto';

const db = admin.firestore();
const ordersCollection = db.collection('orders');
const logger = getLogger('OrderServiceV2');

export class OrderServiceV2 {
  private inventoryService: InventoryServiceV2;

  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    this.inventoryService = new InventoryServiceV2(db);
  }

  async createOrder(payload: CreateOrderPayload, currentUser: UserRecord): Promise<OrderDoc> {
    const keyParts = [
      currentUser.uid,
      payload.storeId,
      ...payload.items.map(item => `${item.itemId}_${item.quantity}_${item.price}`),
      payload.totalAmount
    ];
    const hash = crypto.createHash('sha256').update(keyParts.join('|')).digest('hex');
    const idempotencyKey = `createOrder-${hash}`;

    logger.info('Attempting to create order with idempotency', { idempotencyKey, customerId: currentUser.uid, storeId: payload.storeId });

    return idempotencyService.process(
      idempotencyKey,
      async () => {
        logger.info('Idempotency check passed, proceeding with order creation', { idempotencyKey, customerId: currentUser.uid, storeId: payload.storeId, itemCount: payload.items.length });

        const serverCalculatedTotalAmount = payload.items.reduce((sum, item) => {
          if (item.price < 0 || item.quantity <= 0) {
            logger.error('Invalid item price or quantity during total amount calculation', { item, idempotencyKey });
            throw new OrderServiceError('訂單項目包含無效的價格或數量。', { item }, 'invalid_item_data');
          }
          return sum + (item.price * item.quantity);
        }, 0);

        if (serverCalculatedTotalAmount <= 0) {
          logger.error('Calculated total amount is not positive.', { serverCalculatedTotalAmount, idempotencyKey });
          throw new OrderServiceError('訂單總金額必須為正數。', undefined, 'invalid_total_amount');
        }
        
        if (payload.totalAmount !== undefined && payload.totalAmount !== serverCalculatedTotalAmount) {
            logger.warn('Client totalAmount mismatch server calculation. Using server value.', { clientTotal: payload.totalAmount, serverTotal: serverCalculatedTotalAmount, idempotencyKey});
        }
        const finalTotalAmount = serverCalculatedTotalAmount;

        const orderRef = ordersCollection.doc();
        const orderId = orderRef.id;
        logger.info('Generated new orderId for this attempt', { orderId, idempotencyKey });

        try {
          await db.runTransaction(async (transaction) => {
            const stockItemsToDeduct = payload.items.map(item => ({
              itemId: item.itemId,
              quantity: item.quantity,
            }));
            
            logger.debug(`Deducting stock for order ${orderId}`, { stockItemsToDeduct, idempotencyKey });
            await this.inventoryService.deductStockInTransaction(stockItemsToDeduct, transaction, payload.storeId);
            logger.info(`Stock deducted successfully for order ${orderId}`, { idempotencyKey });

            const now = new Date();
            const newOrder: OrderDoc = {
              id: orderId,
              customerId: currentUser.uid,
              storeId: payload.storeId,
              items: payload.items,
              totalAmount: finalTotalAmount,
              status: 'pending_payment' as OrderDoc['status'],
              notes: payload.notes,
              createdAt: admin.firestore.Timestamp.fromDate(now),
              updatedAt: admin.firestore.Timestamp.fromDate(now),
            };
            transaction.set(orderRef, newOrder);
            logger.info(`Order document ${orderId} created in transaction`, { idempotencyKey });
          });

          logger.info(`Order ${orderId} transaction completed successfully.`, { idempotencyKey, customerId: currentUser.uid });
          
          const createdOrderDocSnap = await orderRef.get();
          if (!createdOrderDocSnap.exists) {
              logger.error(`Failed to retrieve created order after transaction: ${orderId}`, { idempotencyKey });
              throw new OrderServiceError(`訂單創建後無法立即讀取: ${orderId}`, undefined, 'read_after_create_failed');
          }
          const orderData = createdOrderDocSnap.data() as any;
          return {
            ...orderData,
            createdAt: (orderData.createdAt as admin.firestore.Timestamp).toDate(),
            updatedAt: (orderData.updatedAt as admin.firestore.Timestamp).toDate(),
          } as OrderDoc;

        } catch (error: any) {
          logger.error(`Error creating order ${orderId} within idempotency block: ${error.message}`, { error, orderId, payload, idempotencyKey });
          if (error instanceof InventoryServiceError) {
            throw new OrderServiceError(`庫存操作失敗: ${error.message}`, { originalErrorName: error.name, originalErrorDetails: error.details, storeId: payload.storeId }, 'inventory_error');
          }
          if (error instanceof OrderServiceError) {
            throw error;
          }
          throw new OrderServiceError(`創建訂單失敗: ${error.message || '未知錯誤'}`, { originalError: error }, 'create_failed');
        }
      },
      payload
    );
  }

  async getOrderById(orderId: string, userId: string, userRoles: string[] = []): Promise<OrderDoc | null> {
    logger.info(`Fetching order ${orderId} for user ${userId}`);
    const orderRef = ordersCollection.doc(orderId);
    const doc = await orderRef.get();

    if (!doc.exists) {
      logger.warn(`Order ${orderId} not found.`);
      return null;
    }

    const order = doc.data() as OrderDoc;

    const isOwner = order.customerId === userId;
    const isAdminOrStaff = userRoles.includes('admin') || userRoles.includes('staff');

    if (!isOwner && !isAdminOrStaff) {
      logger.warn(`User ${userId} not authorized to view order ${orderId}. Owner: ${order.customerId}`, { userRoles });
      throw new OrderServiceError('您無權查看此訂單。', { orderId, userId }, 'permission_denied');
    }
    
    return {
        ...order,
        createdAt: (order.createdAt as admin.firestore.Timestamp).toDate(),
        updatedAt: (order.updatedAt as admin.firestore.Timestamp).toDate(),
    } as OrderDoc;
  }

  async updateOrderStatus(orderId: string, newStatus: OrderDoc['status'], userId: string, userRoles: string[] = []): Promise<Partial<OrderDoc>> {
    const idempotencyKey = `updateOrderStatus-${orderId}-${newStatus}-${userId}`;
    logger.info(`Attempting to update status for order ${orderId} to ${newStatus} by user ${userId} with idempotencyKey ${idempotencyKey}`);
    
    return idempotencyService.process(
      idempotencyKey,
      async () => {
        const orderRef = ordersCollection.doc(orderId);
        const isAdminOrStaff = userRoles.includes('admin') || userRoles.includes('staff');
        // Additional role for specific transitions, e.g., customer cancelling their own pending order
        // const isCustomer = userRoles.includes('customer'); 

        if (!isAdminOrStaff) {
            logger.warn(`User ${userId} not authorized to update status for order ${orderId}.`, { userRoles, idempotencyKey });
            throw new OrderServiceError('您無權修改訂單狀態。', { orderId, userId, newStatus }, 'permission_denied' );
        }

        try {
          const updatedOrderFields = await db.runTransaction(async (transaction) => {
            const orderDoc = await transaction.get(orderRef);
            if (!orderDoc.exists) {
              logger.error(`Order ${orderId} not found during status update.`, { idempotencyKey });
              throw new OrderServiceError('訂單不存在，無法更新狀態。', { orderId }, 'not_found' );
            }

            const currentOrder = orderDoc.data() as OrderDoc;
            const currentStatus = currentOrder.status;

            // --- State Transition Logic ---
            // Rule: Completed or Cancelled orders cannot be changed further by general staff/admin flow.
            if (currentStatus === 'completed' || currentStatus === 'cancelled') {
              logger.warn(`Order ${orderId} is already in a final state (${currentStatus}). Cannot update to ${newStatus}.`, { idempotencyKey });
              throw new OrderServiceError(`訂單已處於最終狀態 (${currentStatus})，無法更新。`, { orderId, currentStatus, newStatus }, 'invalid_state_transition' );
            }

            // Rule: Specific transitions
            switch (newStatus) {
              case 'confirmed':
                if (currentStatus !== 'pending_payment' && currentStatus !== 'pending_confirmation') {
                  throw new OrderServiceError(`無法將狀態從 ${currentStatus} 更新為 confirmed。`, { orderId, currentStatus }, 'invalid_state_transition' );
                }
                // Potentially, specific roles for confirmation
                break;
              case 'preparing':
                if (currentStatus !== 'confirmed') {
                  throw new OrderServiceError(`無法將狀態從 ${currentStatus} 更新為 preparing。`, { orderId, currentStatus }, 'invalid_state_transition' );
                }
                break;
              case 'ready_for_pickup':
                if (currentStatus !== 'preparing') {
                  throw new OrderServiceError(`無法將狀態從 ${currentStatus} 更新為 ready_for_pickup。`, { orderId, currentStatus }, 'invalid_state_transition' );
                }
                break;
              case 'completed':
                if (currentStatus !== 'ready_for_pickup' && currentStatus !== 'delivering') { // Assuming 'delivering' is a possible state
                  throw new OrderServiceError(`無法將狀態從 ${currentStatus} 更新為 completed。`, { orderId, currentStatus }, 'invalid_state_transition' );
                }
                // TODO: Add logic for loyalty points, finalising payment, etc.
                break;
              case 'cancelled':
                // Allow cancellation from most non-final states by admin/staff
                // Customers might only be able to cancel 'pending_payment' or 'pending_confirmation' themselves.
                if (currentStatus === 'completed') { // Already handled above, but good to be explicit
                     throw new OrderServiceError(`無法取消已完成的訂單。`, { orderId, currentStatus }, 'invalid_state_transition' );
                }
                // --- Stock Restoration Logic for Cancellation ---
                if (currentOrder.items && currentOrder.items.length > 0) {
                  const stockItemsToRestore = currentOrder.items.map(item => ({
                    itemId: item.itemId,
                    quantity: item.quantity,
                  }));
                  logger.info(`Restoring stock for cancelled order ${orderId}`, { items: stockItemsToRestore, idempotencyKey });
                  await this.inventoryService.restoreStockInTransaction(stockItemsToRestore, transaction, currentOrder.storeId);
                  logger.info(`Stock restored successfully for cancelled order ${orderId}`, { idempotencyKey });
                }
                break;
              // Add more cases for other statuses like 'failed_payment', 'pending_confirmation' etc.
              default:
                // If the newStatus is not explicitly handled, assume it's a valid direct update for now or throw error
                logger.warn(`Status transition from ${currentStatus} to ${newStatus} is not explicitly defined. Allowing for now.`, { orderId, idempotencyKey });
            }
            // --- End State Transition Logic ---

            const newUpdatedAt = admin.firestore.Timestamp.now();
            const updateData: Partial<OrderDoc> = { status: newStatus, updatedAt: newUpdatedAt };
            
            // Add a history entry for the status change
            const historyEntry = {
                status: newStatus,
                updatedAt: newUpdatedAt,
                updatedBy: userId,
                // previousStatus: currentStatus, // Optional: if needed for history
            };
            updateData.statusHistory = admin.firestore.FieldValue.arrayUnion(historyEntry) as any;

            transaction.update(orderRef, updateData);
            logger.info(`Order ${orderId} status updated to ${newStatus} in transaction.`, { idempotencyKey });
            
            // Return the fields that were effectively updated for the response.
            // The full currentOrder might be stale if other fields could change outside this status update.
            return { id: orderId, status: newStatus, updatedAt: newUpdatedAt.toDate(), statusHistory: [historyEntry] };

          }); // End of Firestore Transaction
          
          logger.info(`Order ${orderId} status successfully updated to ${newStatus}.`, { idempotencyKey });
          return updatedOrderFields;

        } catch (error: any) {
          logger.error(`Error updating status for order ${orderId} to ${newStatus} within idempotency block: ${error.message}`, { error, idempotencyKey });
           if (error instanceof OrderServiceError) {
            throw error;
          }
          // Ensure a generic OrderServiceError is thrown for other errors within the processor
          throw new OrderServiceError(`更新訂單狀態失敗: ${error.message || '未知錯誤'}`, { orderId, newStatus }, 'update_failed' );
        }
      } // End of Idempotency Processor
    ); // End of idempotencyService.process
  }
  
  // TODO: Add methods for querying orders (e.g., by customer, by store, by status)
  // async listOrdersByCustomer(customerId: string, limit: number = 10, lastVisible?: any): Promise<OrderDoc[]> { ... }
} 