import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios'; // For calling LINE Pay API
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs
import crypto from 'crypto'; // For HMAC signature

import {
  LinePayRequestBody,
  LinePayRequestApiResponse,
  LinePayConfirmCallbackBody,
  LinePayConfirmApiResponse,
  LinePayTransactionDoc,
  PaymentServiceError,
} from './linepay.types.v2';

// Initialize Firestore (ideally done once in a central place, but for module-specific service, can be here if not already init)
// if (admin.apps.length === 0) {
//   admin.initializeApp(); // This might be handled by Firebase SDK itself when deployed
// }
const db = admin.firestore();
const linePayTransactionsCollection = db.collection('linePayTransactions');
const ordersCollection = db.collection('orders'); // Assuming orders collection name

// --- Environment Variables --- (Consider a centralized config service in future)
const LINE_PAY_API_URL = functions.config().linepay?.api_url || 'https://sandbox-api-pay.line.me';
const LINE_PAY_CHANNEL_ID = functions.config().linepay?.channel_id;
const LINE_PAY_SECRET_KEY = functions.config().linepay?.secret_key;
const LINE_PAY_CONFIRM_BASE_URL = functions.config().linepay?.confirm_base_url;
// const LINE_PAY_CANCEL_BASE_URL = functions.config().linepay?.cancel_base_url; // Might be used by PWA directly
const CUSTOMER_PWA_PAYMENT_PROCESSING_URL = `${functions.config().customer_pwa?.base_url}/processing`; // For redirecting user after LINE Pay interaction

// --- Helper Functions ---
const generateLinePaySignature = (uriPath: string, requestBody: string, nonce: string): string => {
  if (!LINE_PAY_SECRET_KEY) {
    functions.logger.error('LINE_PAY_SECRET_KEY is not configured.');
    throw new PaymentServiceError('LINE Pay configuration error.', 500, false);
  }
  const dataToSign = LINE_PAY_SECRET_KEY + uriPath + requestBody + nonce;
  return crypto.createHmac('sha256', LINE_PAY_SECRET_KEY).update(dataToSign).digest('base64');
};

// --- Service Class ---
export class LinePayServiceV2 {
  /**
   * Handles the request to LINE Pay API to initiate a payment.
   */
  async requestPayment(
    payload: LinePayRequestBody,
    customerId: string,
  ): Promise<LinePayRequestApiResponse> {
    functions.logger.info(`[LinePayServiceV2] Initiating payment request for order: ${payload.originalSystemOrderId}, customer: ${customerId}`);

    if (!LINE_PAY_CHANNEL_ID || !LINE_PAY_SECRET_KEY || !LINE_PAY_CONFIRM_BASE_URL) {
      functions.logger.error('[LinePayServiceV2] Essential LINE Pay configurations are missing.');
      throw new PaymentServiceError('LINE Pay service is not configured correctly.', 500, false);
    }

    const paymentSpecificOrderId = uuidv4(); // Unique ID for this specific payment attempt
    const nonce = uuidv4(); // Unique nonce for this request
    const requestUriPath = '/v3/payments/request';

    const lineApiRequestBody = {
      amount: payload.amount,
      currency: payload.currency,
      orderId: paymentSpecificOrderId, // Use our unique payment ID for LINE Pay
      packages: payload.items.map(item => ({
        id: item.id, // Product ID
        amount: item.price * item.quantity,
        name: item.name,
        products: [
          {
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            imageUrl: item.imageUrl,
          },
        ],
      })),
      redirectUrls: {
        // This URL is where LINE Pay will redirect the user's browser AFTER payment/cancellation on LINE Pay's side.
        // It should lead to a page on our PWA that can then call our backend's confirm_callback.
        confirmUrl: `${CUSTOMER_PWA_PAYMENT_PROCESSING_URL}?linePayTransactionId={transactionId}&originalSystemOrderId=${payload.originalSystemOrderId}&paymentSpecificOrderId=${paymentSpecificOrderId}`,
        cancelUrl: `${functions.config().linepay?.cancel_base_url}?originalSystemOrderId=${payload.originalSystemOrderId}`,
      },
      // options: { payment: { capture: true } } // auto capture, default true
    };

    const requestBodyString = JSON.stringify(lineApiRequestBody);
    const signature = generateLinePaySignature(requestUriPath, requestBodyString, nonce);

    const headers = {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': LINE_PAY_CHANNEL_ID,
      'X-LINE-Authorization-Nonce': nonce,
      'X-LINE-Authorization': signature,
    };

    let linePayApiResponse: any;
    try {
      functions.logger.info(`[LinePayServiceV2] Sending request to LINE Pay: ${LINE_PAY_API_URL}${requestUriPath}`, { body: lineApiRequestBody });
      const response = await axios.post(`${LINE_PAY_API_URL}${requestUriPath}`, lineApiRequestBody, { headers });
      linePayApiResponse = response.data;
      functions.logger.info('[LinePayServiceV2] Received response from LINE Pay Request API', { responseData: linePayApiResponse });

      if (linePayApiResponse.returnCode !== '0000') {
        functions.logger.error('[LinePayServiceV2] LINE Pay Request API returned an error.', { returnCode: linePayApiResponse.returnCode, returnMessage: linePayApiResponse.returnMessage, orderId: payload.originalSystemOrderId });
        throw new PaymentServiceError(`LINE Pay Error: ${linePayApiResponse.returnMessage}`, 400, true, linePayApiResponse);
      }

      const linePayTransactionId = linePayApiResponse.info.transactionId as string;
      const paymentUrl = linePayApiResponse.info.paymentUrl.web as string;

      // Store transaction details in Firestore
      const transactionDoc: LinePayTransactionDoc = {
        originalSystemOrderId: payload.originalSystemOrderId,
        paymentSpecificOrderId,
        customerId,
        amount: payload.amount,
        currency: payload.currency,
        status: 'pending_payment_redirect',
        linePayOriginalTransactionId: linePayTransactionId,
        requestPayload: payload, // Store the original request from our PWA
        requestApiResponse: linePayApiResponse,
        createdAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
      };

      await linePayTransactionsCollection.doc(linePayTransactionId).set(transactionDoc);
      functions.logger.info(`[LinePayServiceV2] Stored LINE Pay transaction: ${linePayTransactionId} for order: ${payload.originalSystemOrderId}`);

      return {
        paymentUrl,
        linePayTransactionId,
        paymentSpecificOrderId,
      };

    } catch (error: any) {
      functions.logger.error('[LinePayServiceV2] Error during LINE Pay request or storing transaction', {
        orderId: payload.originalSystemOrderId,
        error: error.message,
        stack: error.stack,
        axiosResponse: error.response?.data
      });
      if (error instanceof PaymentServiceError) throw error;
      throw new PaymentServiceError('Failed to process LINE Pay payment request.', 500, false, error.message);
    }
  }

  /**
   * Handles the confirmation of a LINE Pay transaction after user interaction.
   * This is typically called by our PWA after being redirected from LINE Pay.
   */
  async confirmPayment(
    confirmBody: LinePayConfirmCallbackBody,
    // customerId: string, // May not be needed if PWA calls this, or can be passed for audit
  ): Promise<LinePayConfirmApiResponse> {
    const { linePayTransactionId } = confirmBody;
    functions.logger.info(`[LinePayServiceV2] Initiating payment confirmation for LINE Pay transaction: ${linePayTransactionId}`);

    if (!LINE_PAY_CHANNEL_ID || !LINE_PAY_SECRET_KEY) {
        functions.logger.error('[LinePayServiceV2] Essential LINE Pay configurations for confirm are missing.');
        throw new PaymentServiceError('LINE Pay service is not configured correctly for confirmation.', 500, false);
    }

    const transactionDocRef = linePayTransactionsCollection.doc(linePayTransactionId);

    return await db.runTransaction(async (transaction) => {
      const transactionSnapshot = await transaction.get(transactionDocRef);

      if (!transactionSnapshot.exists) {
        functions.logger.warn(`[LinePayServiceV2] LINE Pay transaction document not found: ${linePayTransactionId}`);
        throw new PaymentServiceError('Transaction not found.', 404, true);
      }

      const transactionData = transactionSnapshot.data() as LinePayTransactionDoc;
      functions.logger.info('[LinePayServiceV2] Found transaction document', { transactionData });

      // Idempotency Check: If already processed, return current status
      if (transactionData.status === 'confirmed_paid' || transactionData.status === 'confirmed_failed') {
        functions.logger.info(`[LinePayServiceV2] Transaction ${linePayTransactionId} already processed. Status: ${transactionData.status}`);
        return {
          status: transactionData.status === 'confirmed_paid' ? 'paid' : 'payment_failed',
          message: 'Transaction already processed.',
          originalSystemOrderId: transactionData.originalSystemOrderId,
        };
      }
      
      // Check if it was user_cancelled or other states that shouldn't proceed to LINE confirm API
      if (transactionData.status === 'user_cancelled_at_line') {
        functions.logger.info(`[LinePayServiceV2] Transaction ${linePayTransactionId} was cancelled by user at LINE Pay.`);
        // Potentially update order status to 'payment_cancelled' or similar
        // For now, just reflect that it was cancelled.
        transaction.update(transactionDocRef, {
            status: 'user_cancelled_at_line', // keep it as is or a new status
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            status: 'payment_failed',
            message: 'Payment was cancelled by user at LINE Pay.',
            originalSystemOrderId: transactionData.originalSystemOrderId,
        };
      }

      // Ensure it's in a state that expects confirmation
      if (transactionData.status !== 'pending_payment_redirect' && transactionData.status !== 'pending_confirm_api') {
         functions.logger.warn(`[LinePayServiceV2] Transaction ${linePayTransactionId} is in an unexpected state for confirmation: ${transactionData.status}`);
         throw new PaymentServiceError(`Transaction in unexpected state: ${transactionData.status}`, 400, true);
      }

      // Proceed to call LINE Pay Confirm API
      const confirmUriPath = `/v3/payments/${transactionData.linePayOriginalTransactionId}/confirm`;
      const nonce = uuidv4();
      const confirmApiRequestBody = {
        amount: transactionData.amount,
        currency: transactionData.currency,
      };
      const requestBodyString = JSON.stringify(confirmApiRequestBody);
      const signature = generateLinePaySignature(confirmUriPath, requestBodyString, nonce);

      const headers = {
        'Content-Type': 'application/json',
        'X-LINE-ChannelId': LINE_PAY_CHANNEL_ID,
        'X-LINE-Authorization-Nonce': nonce,
        'X-LINE-Authorization': signature,
      };

      let linePayConfirmApiResponse: any;
      let newStatus: LinePayTransactionDoc['status'];
      let orderUpdateStatus: 'paid' | 'payment_failed';
      let apiResponseMessage: string;

      try {
        functions.logger.info(`[LinePayServiceV2] Sending request to LINE Pay Confirm API: ${LINE_PAY_API_URL}${confirmUriPath}`, { body: confirmApiRequestBody });
        const response = await axios.post(`${LINE_PAY_API_URL}${confirmUriPath}`, confirmApiRequestBody, { headers });
        linePayConfirmApiResponse = response.data;
        functions.logger.info('[LinePayServiceV2] Received response from LINE Pay Confirm API', { responseData: linePayConfirmApiResponse, linePayTransactionId });

        if (linePayConfirmApiResponse.returnCode === '0000') {
          newStatus = 'confirmed_paid';
          orderUpdateStatus = 'paid';
          apiResponseMessage = 'Payment successful.';
          functions.logger.info(`[LinePayServiceV2] Payment confirmed successfully for ${linePayTransactionId}`);
        } else {
          newStatus = 'confirmed_failed';
          orderUpdateStatus = 'payment_failed';
          apiResponseMessage = `LINE Pay Confirm Error: ${linePayConfirmApiResponse.returnMessage}`;
          functions.logger.error('[LinePayServiceV2] LINE Pay Confirm API returned an error.', { returnCode: linePayConfirmApiResponse.returnCode, returnMessage: linePayConfirmApiResponse.returnMessage, linePayTransactionId });
        }
      } catch (error: any) {
        functions.logger.error('[LinePayServiceV2] Error during LINE Pay Confirm API call', {
          linePayTransactionId,
          error: error.message,
          stack: error.stack,
          axiosResponse: error.response?.data
        });
        newStatus = 'confirm_api_error';
        orderUpdateStatus = 'payment_failed';
        apiResponseMessage = 'Failed to confirm payment with LINE Pay due to an internal error.';
        // Do not rethrow here, let the transaction update the status and then return a structured response
      }

      // Update linePayTransaction document
      transaction.update(transactionDocRef, {
        status: newStatus,
        confirmApiResponse: linePayConfirmApiResponse || null, // Store confirm API response
        errorMessage: newStatus !== 'confirmed_paid' ? apiResponseMessage : admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update original order status in Firestore
      const orderDocRef = ordersCollection.doc(transactionData.originalSystemOrderId);
      // We need to ensure the order exists and is in a state that can be updated.
      // For simplicity, we assume it exists and update it.
      // A more robust solution would check order status before updating.
      transaction.update(orderDocRef, {
        paymentStatus: orderUpdateStatus, // Assuming an 'paymentStatus' field on the order
        status: orderUpdateStatus === 'paid' ? 'processing' : 'payment_failed', // Example: update main order status
        linePayTransactionId: linePayTransactionId, // Link to the payment transaction
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      functions.logger.info(`[LinePayServiceV2] Updated original order ${transactionData.originalSystemOrderId} status to ${orderUpdateStatus}`);
      
      return {
        status: orderUpdateStatus,
        message: apiResponseMessage,
        originalSystemOrderId: transactionData.originalSystemOrderId,
      };
    });
  }
} 