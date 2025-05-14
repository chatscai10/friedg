import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import * as functionsV2 from 'firebase-functions/v2'; // For HttpsError in deductStock
import * as functionsV1 from 'firebase-functions'; // For v1 Firestore triggers

// Ensure Firebase Admin SDK is initialized (typically in index.ts)
// if (admin.apps.length === 0) {
//   admin.initializeApp();
// }

const LOW_STOCK_THRESHOLD = 5; // Consider making this configurable

// Interface for the structure within the 'stock' field of a menuItem
interface StockInfo {
  manageStock?: boolean;
  current?: number; // This represents the actual stock quantity
}

// Interface for the menuItem document data relevant to this trigger
interface MenuItemTriggerData {
  name?: string;
  stock?: StockInfo;
  stockStatus?: string; // This is a top-level field we'll be updating
}


interface OrderItemDetail {
  itemId: string;
  quantity: number;
  // Potentially other details like name, price for logging if needed
}

/**
 * Deducts stock for items in an order within a Firestore transaction.
 *
 * @param orderItems An array of items in the order with itemId and quantity.
 * @param transaction The Firestore transaction object.
 * @throws {functionsV2.https.HttpsError} if stock is insufficient for any item that requires stock management.
 */
export async function deductStock(
  orderItems: OrderItemDetail[],
  transaction: admin.firestore.Transaction
): Promise<void> {
  logger.info("[Inventory] Attempting to deduct stock...", {
    orderItemsCount: orderItems.length,
    items: orderItems.map((item) => ({ id: item.itemId, qty: item.quantity })),
  });

  if (!orderItems || orderItems.length === 0) {
    logger.info("[Inventory] No items provided for stock deduction.");
    return;
  }

  for (const orderItem of orderItems) {
    if (!orderItem.itemId || typeof orderItem.quantity !== 'number' || orderItem.quantity <= 0) {
      logger.warn("[Inventory] Invalid order item for stock deduction, skipping.", { orderItem });
      continue; // Skip invalid items, or throw an error if strictness is required
    }

    const menuItemRef = admin.firestore().collection('menuItems').doc(orderItem.itemId);
    const menuItemDoc = await transaction.get(menuItemRef);

    if (!menuItemDoc.exists) {
      logger.warn(`[Inventory] Menu item ${orderItem.itemId} not found for stock deduction.`);
      throw new functionsV2.https.HttpsError('not-found', `訂購的商品 ID: ${orderItem.itemId} 在菜單中找不到。`);
    }

    const menuItemData = menuItemDoc.data();
    const itemName = menuItemData?.name || orderItem.itemId;

    if (menuItemData?.stock?.manageStock === true) {
      const currentStock = menuItemData.stock.current;
      if (typeof currentStock !== 'number') {
        logger.error(`[Inventory] Stock data for item ${orderItem.itemId} is malformed (current stock not a number).`, { stockData: menuItemData.stock });
        throw new functionsV2.https.HttpsError('internal', `商品 '${itemName}' (ID: ${orderItem.itemId}) 的庫存數據格式錯誤。`);
      }

      if (currentStock < orderItem.quantity) {
        logger.error(`[Inventory] Insufficient stock for item ${orderItem.itemId}. Required: ${orderItem.quantity}, Available: ${currentStock}`);
        throw new functionsV2.https.HttpsError('out-of-stock', `商品 '${itemName}' (ID: ${orderItem.itemId}) 庫存不足，剩餘 ${currentStock}，需要 ${orderItem.quantity}`);
      }

      const newStock = currentStock - orderItem.quantity;
      transaction.update(menuItemRef, { 'stock.current': newStock });
      logger.info(`[Inventory] Stock for item ${orderItem.itemId} updated from ${currentStock} to ${newStock}.`);
    } else {
      logger.info(`[Inventory] Stock management not enabled for item ${orderItem.itemId}, skipping deduction.`);
    }
  }
  logger.info("[Inventory] Stock deduction process completed for all relevant items.");
}

export const onMenuItemWrite = functionsV1.region('asia-east1') // Adjust region as needed
  .firestore.document('menuItems/{menuItemId}')
  .onWrite(async (change, context) => {
    const { menuItemId } = context.params;
    const docRef = change.after.ref;

    if (!change.after.exists) {
      logger.info(`[Inventory-Trigger] MenuItem ${menuItemId} deleted. No status update needed.`);
      return null;
    }

    const dataAfter = change.after.data() as MenuItemTriggerData | undefined;
    const dataBefore = change.before.exists ? change.before.data() as MenuItemTriggerData | undefined : null;

    if (!dataAfter) {
        logger.warn(`[Inventory-Trigger] No data found for menuItem ${menuItemId} after write. Skipping.`);
        return null;
    }
    
    const manageStockAfter = dataAfter.stock?.manageStock;
    const stockQuantityAfter = dataAfter.stock?.current; // Use stock.current as the quantity
    const currentTopLevelStockStatus = dataAfter.stockStatus;

    const stockObjectBefore = dataBefore?.stock;
    const manageStockChanged = stockObjectBefore?.manageStock !== manageStockAfter;
    const stockQuantityChanged = stockObjectBefore?.current !== stockQuantityAfter;

    if (!manageStockChanged && !stockQuantityChanged && typeof currentTopLevelStockStatus === 'string') {
        logger.info(`[Inventory-Trigger] MenuItem ${menuItemId}: Monitored stock fields (stock.manageStock, stock.current) did not change, and stockStatus exists. Skipping update.`, 
          { manageStockAfter, stockQuantityAfter, currentTopLevelStockStatus });
        return null;
    }
    
    let newStockStatus = currentTopLevelStockStatus || 'in_stock';

    if (typeof manageStockAfter === 'boolean') {
        if (manageStockAfter === true) {
            const quantity = typeof stockQuantityAfter === 'number' ? stockQuantityAfter : 0;
            if (quantity <= 0) {
                newStockStatus = 'out_of_stock';
            } else if (quantity <= LOW_STOCK_THRESHOLD) {
                newStockStatus = 'low_stock';
            } else {
                newStockStatus = 'in_stock';
            }
        } else { // manageStockAfter is false
            newStockStatus = 'in_stock'; 
        }
    } else { 
        logger.info(`[Inventory-Trigger] MenuItem ${menuItemId}: stock.manageStock is undefined. Defaulting stockStatus to 'in_stock'.`);
        newStockStatus = 'in_stock';
    }

    if (newStockStatus !== currentTopLevelStockStatus) {
      logger.info(`[Inventory-Trigger] Updating stockStatus for menuItem ${menuItemId} from '${currentTopLevelStockStatus || 'N/A'}' to '${newStockStatus}'.`, 
        { manageStock: manageStockAfter, stockQuantity: stockQuantityAfter });
      try {
        await docRef.update({ stockStatus: newStockStatus });
        logger.info(`[Inventory-Trigger] Successfully updated stockStatus for ${menuItemId}.`);
      } catch (error) {
        logger.error(`[Inventory-Trigger] Error updating stockStatus for ${menuItemId}:`, error);
      }
    } else {
        logger.info(`[Inventory-Trigger] MenuItem ${menuItemId}: Calculated stockStatus '${newStockStatus}' is the same as current '${currentTopLevelStockStatus}'. No update needed.`);
    }
    return null;
  }); 