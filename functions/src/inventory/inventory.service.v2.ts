import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { StockItem, MenuItemStockDoc, InventoryServiceError } from './inventory.types.v2';
import { getLogger } from '../utils/logging.utils';
import { InventoryItemStockSchema, StockDeductionItem } from './inventory.types.v2';

const logger = getLogger('InventoryServiceV2');

const db = admin.firestore();
const menuItemsCollection = db.collection('menuItems'); // Assuming collection name

export class InventoryServiceV2 {
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  /**
   * Deducts stock for a list of items within a Firestore transaction.
   * Throws InventoryServiceError if stock is insufficient or item not found/manages stock.
   * @param transaction Firestore transaction object.
   * @param itemsToDeduct Array of items with menuItemId and quantityToDeduct.
   * @param orderId Optional, for logging purposes.
   */
  async deductStock(
    transaction: FirebaseFirestore.Transaction,
    itemsToDeduct: StockItem[],
    orderId?: string,
  ): Promise<void> {
    functions.logger.info(`[InventoryServiceV2] Deducting stock for order: ${orderId || 'N/A'}`, { items: itemsToDeduct });

    if (!itemsToDeduct || itemsToDeduct.length === 0) {
      functions.logger.warn('[InventoryServiceV2] No items provided for stock deduction.');
      return; // Or throw error if this is unexpected
    }

    for (const item of itemsToDeduct) {
      const menuItemRef = menuItemsCollection.doc(item.menuItemId);
      let menuItemData: MenuItemStockDoc;

      try {
        const doc = await transaction.get(menuItemRef);
        if (!doc.exists) {
          functions.logger.error(`[InventoryServiceV2] Menu item ${item.menuItemId} not found for stock deduction.`);
          throw new InventoryServiceError(
            `Item ${item.menuItemId} not found. Stock deduction failed.`, 
            404, 
            true, 
            { itemId: item.menuItemId, reason: 'not_found' }
          );
        }
        menuItemData = doc.data() as MenuItemStockDoc;
      } catch (e: any) {
        // Catch transaction.get errors if any, though typically they are Firestore internal
        functions.logger.error(`[InventoryServiceV2] Error fetching menu item ${item.menuItemId} in transaction.`, { error: e.message });
        throw new InventoryServiceError(
            `Error fetching item ${item.menuItemId}. Stock deduction failed.`, 
            500, 
            false, 
            { itemId: item.menuItemId, reason: 'fetch_error' }
          );
      }
        

      if (!menuItemData.manageStock) {
        functions.logger.info(`[InventoryServiceV2] Item ${item.menuItemId} (${menuItemData.name}) does not manage stock. Skipping deduction.`);
        continue; // Skip if stock management is not enabled for this item
      }

      if (!menuItemData.stock || typeof menuItemData.stock.current !== 'number') {
        functions.logger.error(`[InventoryServiceV2] Item ${item.menuItemId} (${menuItemData.name}) has invalid stock data.`, { stockData: menuItemData.stock });
        throw new InventoryServiceError(
            `Item ${item.menuItemId} (${menuItemData.name}) has invalid stock data. Deduction failed.`, 
            500, 
            true, 
            { itemId: item.menuItemId, reason: 'invalid_stock_data' }
          );
      }

      const newStockLevel = menuItemData.stock.current - item.quantityToDeduct;
      if (newStockLevel < 0) {
        functions.logger.error(
            `[InventoryServiceV2] Insufficient stock for item ${item.menuItemId} (${menuItemData.name}). Required: ${item.quantityToDeduct}, Available: ${menuItemData.stock.current}`
        );
        throw new InventoryServiceError(
          `Insufficient stock for ${menuItemData.name}. Only ${menuItemData.stock.current} available.`,
          400, // Bad request because client order cannot be fulfilled
          true,
          { itemId: item.menuItemId, reason: 'insufficient_stock', required: item.quantityToDeduct, available: menuItemData.stock.current }
        );
      }

      transaction.update(menuItemRef, { 'stock.current': newStockLevel });
      functions.logger.info(
        `[InventoryServiceV2] Stock for item ${item.menuItemId} (${menuItemData.name}) updated in transaction. New level: ${newStockLevel}`
      );
      
      // TODO: Consider emitting an event if stock reaches lowStockThreshold
      // if (menuItemData.stock.lowStockThreshold && newStockLevel <= menuItemData.stock.lowStockThreshold) {
      //   functions.logger.warn(`[InventoryServiceV2] Item ${item.menuItemId} (${menuItemData.name}) has reached low stock threshold.`);
      //   // Emit event: lowStockAlert({ itemId: item.menuItemId, currentStock: newStockLevel });
      // }
    }
    functions.logger.info(`[InventoryServiceV2] All stock deductions processed successfully in transaction for order: ${orderId || 'N/A'}`);
  }

  /**
   * 在事務中扣減指定店鋪的多個商品的庫存。
   * @param itemsToDeduct 需要扣減的商品列表，包含 itemId 和 quantity。
   * @param transaction Firestore transaction 物件。
   * @param storeId 店鋪 ID，用於定位商品庫存記錄 (假設庫存是分店鋪管理的，例如在 menuItems 中)
   * @throws InventoryServiceError 如果任何商品未找到、庫存數據無效、或庫存不足。
   */
  async deductStockInTransaction(
    itemsToDeduct: StockDeductionItem[],
    transaction: admin.firestore.Transaction,
    storeId: string // storeId of the order
  ): Promise<void> {
    logger.info(`Attempting to deduct stock in transaction for store ${storeId}...`, { itemCount: itemsToDeduct.length });

    for (const item of itemsToDeduct) {
      if (!item.itemId || typeof item.quantity !== 'number' || item.quantity <= 0) {
        logger.warn('[InventoryServiceV2] Invalid item in itemsToDeduct, skipping.', { item, storeId });
        continue;
      }
      const menuItemRef = menuItemsCollection.doc(item.itemId); // item.itemId IS the document ID in menuItems
      const menuItemDoc = await transaction.get(menuItemRef);

      if (!menuItemDoc.exists) {
        logger.error(`[InventoryServiceV2] Menu item ${item.itemId} not found. Cannot deduct stock for store ${storeId}.`);
        // Ensure the error message is informative for the client/caller
        throw new InventoryServiceError(`訂購的商品 ID: ${item.itemId} 找不到。`, 404, true, { itemId: item.itemId, storeId, reason: 'item_not_found_in_menuItems_collection' });
      }

      const menuItemData = menuItemDoc.data() as MenuItemStockDoc & { storeId?: string; tenantId?: string }; // Assuming these fields exist

      // CRITICAL: Validate that the menu item belongs to the specified storeId
      if (menuItemData.storeId !== storeId) {
        logger.error(`[InventoryServiceV2] Menu item ${item.itemId} storeId mismatch. Order storeId: ${storeId}, item's actual storeId: ${menuItemData.storeId}.`);
        throw new InventoryServiceError(
          `商品 ${item.itemId} (來自菜單) 與訂單的店鋪 ${storeId} 不匹配。商品實際屬於店鋪 ${menuItemData.storeId}。`,
          400, // Bad Request, as the item from order is inconsistent with the store
          true,
          { itemId: item.itemId, orderStoreId: storeId, itemStoreId: menuItemData.storeId, reason: 'item_store_mismatch' }
        );
      }
      
      // TODO: Consider tenantId validation as well if applicable and if tenantId is part of menuItemData
      // if (menuItemData.tenantId && currentTenantId && menuItemData.tenantId !== currentTenantId) { ... }


      if (menuItemData.manageStock === true) {
        const currentStock = menuItemData.stock?.current; // Use optional chaining
        if (typeof currentStock !== 'number') {
          logger.error(`[InventoryServiceV2] Stock data for item ${item.itemId} in store ${storeId} is malformed (current stock not a number).`, { stockData: menuItemData.stock });
          throw new InventoryServiceError(`商品 ${menuItemData.name || item.itemId} 的庫存數據格式錯誤。`, 500, true, { itemId: item.itemId, storeId, reason: 'malformed_stock_data' });
        }

        if (currentStock < item.quantity) {
          logger.error(`[InventoryServiceV2] Insufficient stock for item ${item.itemId} in store ${storeId}. Required: ${item.quantity}, Available: ${currentStock}.`);
          throw new InventoryServiceError(`商品 ${menuItemData.name || item.itemId} 庫存不足 (店鋪 ${storeId})。剩餘 ${currentStock}，需要 ${item.quantity}。`, 409, true, { itemId: item.itemId, storeId, required: item.quantity, available: currentStock, reason: 'insufficient_stock' });
        }

        const newStock = currentStock - item.quantity;
        transaction.update(menuItemRef, { 'stock.current': newStock, 'updatedAt': admin.firestore.FieldValue.serverTimestamp() }); // Also update timestamp
        logger.info(`[InventoryServiceV2] Stock for item ${item.itemId} in store ${storeId} updated from ${currentStock} to ${newStock}.`);
      } else {
        logger.info(`[InventoryServiceV2] Stock management not enabled for item ${item.itemId} in store ${storeId}, skipping deduction.`);
      }
    }
    logger.info(`Stock deduction process completed for transaction in store ${storeId}.`);
  }

  /**
   * Restores stock for a list of items within a Firestore transaction.
   * Typically used when an order is cancelled.
   * Throws InventoryServiceError if item not found or stock data is invalid.
   * @param itemsToRestore Array of items with itemId and quantity to restore.
   * @param transaction Firestore transaction object.
   * @param storeId The ID of the store where stock is being restored (for logging/context).
   */
  async restoreStockInTransaction(
    itemsToRestore: StockDeductionItem[], // Reusing StockDeductionItem for simplicity, quantity is positive
    transaction: admin.firestore.Transaction,
    storeId: string
  ): Promise<void> {
    logger.info(`Attempting to restore stock in transaction for store ${storeId}...`, { itemCount: itemsToRestore.length });

    for (const item of itemsToRestore) {
       if (!item.itemId || typeof item.quantity !== 'number' || item.quantity <= 0) {
        logger.warn('[InventoryServiceV2] Invalid item in itemsToRestore, skipping.', { item, storeId });
        continue;
      }
      const menuItemRef = menuItemsCollection.doc(item.itemId); // item.itemId IS the document ID
      const menuItemDoc = await transaction.get(menuItemRef);

      if (!menuItemDoc.exists) {
        // If item doesn't exist, we can't restore stock to it. Log a warning.
        // This might happen if a menu item was deleted after an order was placed.
        logger.warn(`[InventoryServiceV2] Menu item ${item.itemId} not found. Cannot restore stock for store ${storeId}.`);
        // Depending on business logic, this could be an error or just a warning.
        // For now, let's not throw an error that would fail the whole transaction,
        // as other items might still need stock restored.
        // Consider if a more robust error handling or notification is needed here.
        continue; 
      }
      
      const menuItemData = menuItemDoc.data() as MenuItemStockDoc & { storeId?: string; tenantId?: string };

      // CRITICAL: Validate that the menu item belongs to the specified storeId
      if (menuItemData.storeId !== storeId) {
        logger.error(`[InventoryServiceV2] Menu item ${item.itemId} storeId mismatch during stock restoration. Order storeId: ${storeId}, item's actual storeId: ${menuItemData.storeId}.`);
        // This is a more severe issue during restoration, as it implies data inconsistency.
        throw new InventoryServiceError(
          `試圖為商品 ${item.itemId} 恢復庫存，但其歸屬店鋪 ${menuItemData.storeId} 與訂單店鋪 ${storeId} 不匹配。`,
          500, // Internal server error, indicates a data integrity problem
          true,
          { itemId: item.itemId, orderStoreId: storeId, itemStoreId: menuItemData.storeId, reason: 'item_store_mismatch_on_restore' }
        );
      }

      if (menuItemData.manageStock === true) {
        const currentStock = menuItemData.stock?.current;
        if (typeof currentStock !== 'number') {
          logger.warn(`[InventoryServiceV2] Stock data for item ${item.itemId} in store ${storeId} is malformed (current stock not a number). Cannot restore stock reliably.`, { stockData: menuItemData.stock });
          // Similar to item not found, log and continue to not fail entire batch.
          continue;
        }

        const newStock = currentStock + item.quantity;
        transaction.update(menuItemRef, { 'stock.current': newStock, 'updatedAt': admin.firestore.FieldValue.serverTimestamp() }); // Also update timestamp
        logger.info(`[InventoryServiceV2] Stock for item ${item.itemId} in store ${storeId} restored from ${currentStock} to ${newStock}.`);
      } else {
        logger.info(`[InventoryServiceV2] Stock management not enabled for item ${item.itemId} in store ${storeId}, skipping restoration.`);
      }
    }
    logger.info(`Stock restoration process completed for transaction in store ${storeId}.`);
  }

  // TODO: Add methods for stock replenishment, adjustments, queries, etc. if needed.
  // async replenishStock(transaction: FirebaseFirestore.Transaction, itemsToReplenish: StockItem[]): Promise<void> { ... }
} 