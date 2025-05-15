import * as functions from 'firebase-functions';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import {
  LinePayRequestBodySchema,
  LinePayConfirmCallbackBodySchema,
  PaymentServiceError,
  ApiErrorResponse,
} from './linepay.types.v2';
import { LinePayServiceV2 } from './linepay.service.v2';

// Helper to get customerId from authenticated request
// This assumes usage of an auth middleware that adds `user` to `req`
const getCustomerIdFromRequest = (req: Request): string | undefined => {
  return (req as any).user?.uid; // Adjust based on your actual auth middleware structure
};

export class LinePayHandlersV2 {
  private linePayService: LinePayServiceV2;

  constructor() {
    this.linePayService = new LinePayServiceV2();
  }

  /**
   * Handler for POST /line/request
   * Initiates a LINE Pay payment request.
   */
  requestPaymentHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedBody = LinePayRequestBodySchema.parse(req.body);
      const customerId = getCustomerIdFromRequest(req);

      if (!customerId) {
        functions.logger.warn('[LinePayHandlersV2] Customer ID not found in authenticated request.');
        // This should ideally be caught by auth middleware, but as a safeguard:
        return res.status(401).json({ message: 'Authentication required.' } as ApiErrorResponse);
      }

      functions.logger.info(`[LinePayHandlersV2] Received payment request for order: ${validatedBody.originalSystemOrderId} by customer: ${customerId}`);
      const result = await this.linePayService.requestPayment(validatedBody, customerId);
      return res.status(200).json(result);

    } catch (error: any) {
      functions.logger.error('[LinePayHandlersV2] Error in requestPaymentHandler', { error: error.message, stack: error.stack, details: (error as PaymentServiceError).details });
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid request body.',
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        } as ApiErrorResponse);
      }
      // Pass to generic error handler middleware
      next(error);
    }
  };

  /**
   * Handler for POST /line/confirm_callback (called by PWA)
   * Confirms a LINE Pay transaction after user is redirected back to PWA.
   */
  confirmPaymentCallbackHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedBody = LinePayConfirmCallbackBodySchema.parse(req.body);
      // const customerId = getCustomerIdFromRequest(req); // Optional: for audit logging if needed

      functions.logger.info(`[LinePayHandlersV2] Received payment confirmation callback for LINE Pay transaction: ${validatedBody.linePayTransactionId}`);
      const result = await this.linePayService.confirmPayment(validatedBody);
      
      if (result.status === 'paid') {
        return res.status(200).json(result);
      } else if (result.status === 'already_processed') {
        // It's not an error per se, but the client might want to know it was already done.
        return res.status(200).json(result); 
      } else {
        // payment_failed or other issues handled by service
        return res.status(400).json(result); // Or map to appropriate status codes
      }

    } catch (error: any) {
      functions.logger.error('[LinePayHandlersV2] Error in confirmPaymentCallbackHandler', { error: error.message, stack: error.stack, details: (error as PaymentServiceError).details });
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: 'Invalid request body.',
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        } as ApiErrorResponse);
      }
       // Pass to generic error handler middleware
      next(error);
    }
  };

  /**
   * Handler for GET /line/user_redirect_after_payment (LINE Pay redirects user browser here first)
   * This endpoint receives the redirect from LINE Pay, extracts necessary info, and then redirects user to PWA's processing page.
   * This is NOT the confirm API callback from LINE Pay server, but a browser redirect.
   */
  userRedirectAfterPaymentHandler = (req: Request, res: Response) => {
    const { transactionId, orderId, paymentSpecificOrderId } = req.query;
    // orderId from LINE Pay redirect is our paymentSpecificOrderId
    // We also passed originalSystemOrderId in the confirmUrl construction for PWA to pick up

    functions.logger.info('[LinePayHandlersV2] User redirected from LINE Pay.', { query: req.query });

    if (!transactionId || !orderId) { // orderId here is the paymentSpecificOrderId
      functions.logger.error('[LinePayHandlersV2] Missing transactionId or orderId in LINE Pay redirect query.');
      // Redirect to a generic error page on PWA
      const errorRedirectUrl = `${functions.config().customer_pwa?.base_url}/checkout/error?message=InvalidRedirectParams`;
      return res.redirect(errorRedirectUrl);
    }

    // Construct the PWA processing page URL with all necessary parameters
    // The PWA page will then call our backend's /line/confirm_callback endpoint.
    // The `originalSystemOrderId` is already part of the confirmUrl query string set during `requestPayment` for PWA.
    // We ensure `linePayTransactionId` and `paymentSpecificOrderId` are passed.
    const pwaProcessingUrl = new URL(CUSTOMER_PWA_PAYMENT_PROCESSING_URL);
    pwaProcessingUrl.searchParams.set('linePayTransactionId', transactionId as string);
    pwaProcessingUrl.searchParams.set('paymentSpecificOrderId', orderId as string); 
    // If originalSystemOrderId was also directly in LINE Pay redirect (not typical), pass it too.
    // For now, assume it was part of the confirmUrl built for LINE Pay and PWA will extract from its own URL query params.

    functions.logger.info(`[LinePayHandlersV2] Redirecting user to PWA processing page: ${pwaProcessingUrl.toString()}`);
    return res.redirect(pwaProcessingUrl.toString());
  };
} 