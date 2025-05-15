import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const app = express();

app.get('/ping', (req, res) => {
  logger.info('Simple Ping received!', {structuredData: true});
  res.status(200).send('Simple Pong from Gen 2!');
});

export const simpleApi = onRequest(app);

// Initialize Firebase Admin SDK (once)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

functions.logger.info('Firebase Admin SDK initialized.');

// --- Import and re-export modularized V2 APIs ---

// Payments API (V2 - Refactored)
import { paymentsApiV2 } from './payments/index.v2';
export { paymentsApiV2 };

// Orders API (V2 - Refactored)
import { ordersApiV2 } from './orders/index.v2';
export { ordersApiV2 };

// Inventory Service (V2 - Refactored, service exported, not an API endpoint itself from here)
// import { inventoryService } from './inventory/index.v2';
// export { inventoryService }; // Not typically exported as an API endpoint, used by other services

// --- Potentially other APIs or callable functions from other modules ---
// e.g., User Management Callable functions, Admin APIs etc.
// Example: (ensure these are also refactored or use the new error handling patterns)
// import { setUserRoleV2, listUsersApiV2 } from './admin/userManagement.v2';
// export { setUserRoleV2, listUsersApiV2 };

// import { storesApiV2 } from './stores/index.v2'; // Assuming stores also follows this pattern
// export { storesApiV2 };

functions.logger.info('Cloud Functions V2 modules (payments, orders) are re-exported.');

// Cleanup: Ensure any old, non-refactored function exports for payments/orders are removed
// from this file or firebase.json if they were defined there directly.