import { Router } from 'express';
// import * as functions from 'firebase-functions'; // No longer needed directly here if logger used from common
import { LinePayHandlersV2 } from './linepay.handlers.v2';
// import { PaymentServiceError, ApiErrorResponse } from './linepay.types.v2'; // Error types handled by global
import { requestLogger, globalErrorHandler } from '../../middleware/common.middleware'; // Import common middlewares
import { authenticateRequestMiddlewarePlaceholder as authenticateRequestMiddleware } from '../../middleware/auth.middleware'; // Placeholder for actual auth

const router = Router();
const linePayHandlers = new LinePayHandlersV2();

// Apply common request logger to all routes in this router
router.use(requestLogger);

// --- LINE Pay Routes ---

// POST /request - PWA calls this to initiate payment
// Requires authentication to identify the customer
router.post(
  '/request',
  authenticateRequestMiddleware,
  linePayHandlers.requestPaymentHandler
);

// GET /user_redirect_after_payment - LINE Pay redirects the user's browser here after payment attempt
// This endpoint will then redirect the user to a PWA page.
// No explicit app authentication needed here as it's a browser redirect from LINE.
router.get(
  '/user_redirect_after_payment',
  linePayHandlers.userRedirectAfterPaymentHandler
);

// POST /confirm_callback - PWA calls this after user is redirected back to PWA's processing page.
// This endpoint confirms the payment with LINE Pay server-side.
// Should ideally be authenticated if sensitive actions beyond payment confirmation occur,
// but for now, relies on the unguessable linePayTransactionId and internal checks.
// Consider if any customer-specific data is updated here that needs auth.
router.post(
  '/confirm_callback',
  linePayHandlers.confirmPaymentCallbackHandler
);

// TODO: Add a route for LINE Pay Webhook if needed in the future for server-to-server notifications.
// router.post('/webhook', linePayHandlers.webhookHandler);

export const linePayRouterV2 = router;
// No longer export linePayGlobalErrorHandlerV2, use the common one at app level 