import express from 'express';
import * as functions from 'firebase-functions';
import cors from 'cors'; // Corrected import name for cors
import { linePayRouterV2, linePayGlobalErrorHandlerV2 } from './linepay.routes.v2';

// Initialize Express app
const app = express();

// --- Global Middlewares ---
// Enable CORS - configure origins पुलिस (police) as needed for your PWA
app.use(cors({ origin: true })); // Allows all origins for now, refine in production

// Parse JSON request bodies
app.use(express.json());

// --- API Routes ---
// Mount the LINE Pay v2 router
// All routes under /paymentsApiV2/line will be handled by linePayRouterV2
app.use('/line', linePayRouterV2);

// --- Global Error Handler ---
// This must be registered AFTER all routes and other middlewares
app.use(linePayGlobalErrorHandlerV2);

// --- Expose Express app as a Firebase Function ---
// The name 'paymentsApiV2' should match the function name defined in firebase.json exports
export const paymentsApiV2 = functions.https.onRequest(app);

functions.logger.info('[Payments API v2] Initialized and ready.'); 