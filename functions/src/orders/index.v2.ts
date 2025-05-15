/**
 * 訂單模塊 - Gen 2 版本
 * 使用 Firebase Functions v2 API
 */

import express from 'express';
import * as functions from 'firebase-functions';
import cors from 'cors';
import ordersRouterV2 from './orders.routes.v2';
import { globalErrorHandler, requestLogger } from '../middleware/common.middleware';

const app = express(); // Renamed to 'app' for clarity within this file

// Enable CORS for all origins (adjust as needed for production)
app.use(cors({ origin: true }));

// Middleware for parsing JSON bodies
app.use(express.json());

// Top-level request logger (optional if already applied in router, but can be good for base path logging)
// ordersApiV2.use(requestLogger); // Routers already use it, so perhaps not needed here unless for /base itself

// Mount the orders router
app.use('/', ordersRouterV2); // Mounts at the root of this specific API service

// Global error handler for this API
// This should be the last middleware applied to the app
app.use(globalErrorHandler);

export { app as ordersApiV2 }; // Export the Express app instance
functions.logger.info('[Orders API v2] Initialized and ready.');
