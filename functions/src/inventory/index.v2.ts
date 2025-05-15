// functions/src/inventory/index.v2.ts
// This file is primarily for exporting the service if it were to be used by other APIs directly
// or if inventory had its own HTTP-triggered functions.
// For now, InventoryServiceV2 is mainly used by OrderServiceV2.

import * as functions from 'firebase-functions';
import { InventoryServiceV2 } from './inventory.service.v2';

// If Inventory had its own HTTP endpoints, an Express app would be set up here similar to payments/orders.
// Example of exporting the service for potential direct use (e.g. by scripts or other internal services)
const inventoryService = new InventoryServiceV2();
export { inventoryService }; // Not a Cloud Function itself, but exports the service instance.

functions.logger.info('[Inventory Module v2] Initialized (service exported).');

// If you wanted a callable function for e.g. manual stock adjustment:
// export const adjustStockCallable = functions.https.onCall(async (data, context) => {
//   if (!context.auth) {
//     throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
//   }
  // Check admin roles: (context.auth.token as any).roles?.includes('admin')
  // const { itemId, newQuantity } = data;
  // await inventoryService.adjustStockManually(itemId, newQuantity);
//   return { success: true };
// }); 