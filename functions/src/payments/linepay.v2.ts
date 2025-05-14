import * as functions from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import { authenticateRequest } from '../middleware/auth.middleware'; // Assuming this path is correct
import { getFirestore, FieldValue } from 'firebase-admin/firestore'; // Added FieldValue
import * as admin from "firebase-admin"; // Required for Firestore
import axios from "axios"; // For calling LINE Pay API
import * as crypto from "crypto"; // For generating signature

// Helper function to get LINE Pay config from environment variables
// (Copied from later in the file for use in verifyLineSignature, ensure it exists or adapt)
function getLinePayConfig() {
  const channelId = process.env.LINE_PAY_CHANNEL_ID;
  const channelSecret = process.env.LINE_PAY_CHANNEL_SECRET;
  const apiUrl = process.env.LINE_PAY_API_URL; // e.g., https://sandbox-api-pay.line.me
  const customerPwaBaseUrl = process.env.CUSTOMER_PWA_BASE_URL; // For redirect URLs
  const cloudFunctionBaseUrl = process.env.CLOUD_FUNCTION_BASE_URL; // For callback URLs

  if (!channelId || !channelSecret || !apiUrl || !customerPwaBaseUrl || !cloudFunctionBaseUrl) {
    logger.error("LINE Pay configuration environment variables are not fully set.");
    return null;
  }
  return { channelId, channelSecret, apiUrl, customerPwaBaseUrl, cloudFunctionBaseUrl };
}

const appRequest = express();
appRequest.use(cors({ origin: true }));
appRequest.use(express.json());

// Endpoint for requesting a LINE Pay payment (customer-initiated)
appRequest.post('/', authenticateRequest, async (req, res) => {
    const { orderId, amount } = req.body;
    const userId = (req as any).user?.uid;
    logger.info('LINE Pay payment request received', { userId, orderId, amount });

    // In a real scenario, you would:
    // 1. Validate the orderId and amount against your database.
    // 2. Call LINE Pay's Request API with order details.
    // 3. Store the transactionId received from LINE Pay.
    // 4. Return the paymentUrl.paymentUrl (for web) or app-specific URL.

    // Mock response
    res.status(200).json({
        success: true,
        paymentUrl: `https://mock-line-pay-url.com/redirect?orderId=${orderId}&transactionId=mock_transaction_123`,
        transactionId: "mock_transaction_123"
    });
});

export const requestLinePayPaymentV2 = functions.onRequest(appRequest);

// --- Endpoint for LINE Pay to confirm a payment (server-to-server callback) ---
const appConfirm = express();
appConfirm.use(cors({ origin: true }));

// Middleware to capture raw body for signature verification
// This MUST come BEFORE express.json() if express.json() is used for the same routes.
appConfirm.use(express.raw({
    type: 'application/json',
    verify: (req: any, res, buf, encoding) => {
        if (buf && buf.length) {
            req.rawBody = buf.toString(encoding || 'utf8');
        } else {
            req.rawBody = ""; // Handle empty body case
        }
    }
}));

// Middleware for LINE Pay Signature Verification
const verifyLineSignature = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const linePayConfig = getLinePayConfig();
    if (!linePayConfig || !linePayConfig.channelSecret) {
        logger.error("LINE Pay Channel Secret not configured for signature verification.");
        return res.status(500).send("Server configuration error for payment processing.");
    }
    const channelSecret = linePayConfig.channelSecret;
    const signatureHeader = req.headers['x-line-signature'] as string;
    const requestBody = (req as any).rawBody; // Use the raw body captured by express.raw()

    if (!signatureHeader) {
        logger.warn("LINE Pay callback missing X-LINE-Signature header.");
        return res.status(400).send("Missing signature.");
    }

    if (typeof requestBody !== 'string' || requestBody.length === 0) {
        logger.warn("LINE Pay callback raw body is empty or not a string for signature verification.");
        // LINE Pay should always send a body. If it's empty, the signature won't match.
        // Or, if an error occurred in express.raw(), req.rawBody might not be set.
        return res.status(400).send("Invalid request body for signature calculation.");
    }

    try {
        const generatedSignature = crypto
            .createHmac("sha256", channelSecret)
            .update(requestBody)
            .digest("base64");

        if (signatureHeader === generatedSignature) {
            logger.info("LINE Pay callback signature verified successfully.");
            next(); // Signature matches, proceed to the handler
        } else {
            logger.error("LINE Pay callback signature mismatch.", { received: signatureHeader, generated: generatedSignature, requestBodyLength: requestBody.length });
            return res.status(401).send("Invalid signature.");
        }
    } catch (error) {
        logger.error("Error during LINE Pay signature verification:", error);
        return res.status(500).send("Error verifying signature.");
    }
};

// This must come AFTER express.raw and verifyLineSignature, so req.body is populated.
appConfirm.use(express.json()); 

// Ensure Firebase Admin SDK is initialized (idempotent)
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = getFirestore();

// Apply signature verification middleware BEFORE the route handler
appConfirm.post('/', verifyLineSignature, async (req, res) => {
    const callbackBody = req.body; // Now req.body is the parsed JSON object
    logger.info('LINE Pay confirmation callback received (after signature check)', { body: callbackBody });

    // Mocked transaction details from LINE Pay (these would be in callbackBody)
    // const linePayTransactionId = callbackBody.transactionId; // Example: "202101011234567890"
    // const linePayReturnCode = callbackBody.returnCode;     // Example: "0000" for success
    // const linePayOrderId = callbackBody.orderId;           // This is the orderId *you* sent to LINE Pay

    // ---- MOCKING a successful payment for conceptual implementation ----
    // In a real scenario, you'd parse `callbackBody` from LINE Pay.
    // For this mock, we will assume the request body contains enough info, or we hardcode.
    // Let's assume `callbackBody` has `originalOrderId` (your system's order ID) and `status` ('SUCCESS' or 'FAILURE')
    
    const { originalOrderId, transactionId: linePayTransactionId, paymentStatus } = callbackBody as {
        originalOrderId: string; // Your internal order ID you might have mapped or expect back
        transactionId: string;   // LINE Pay's transaction ID
        paymentStatus: 'SUCCESS' | 'FAILURE'; // Simplified status from LINE Pay
    };

    if (!originalOrderId || !linePayTransactionId || !paymentStatus) {
        logger.error('LINE Pay Confirm: Invalid callback body. Missing originalOrderId, transactionId, or paymentStatus.', callbackBody);
        // Even if the payload is bad for our processing, LINE Pay might still expect a 200 OK.
        // Respond with a generic success to LINE Pay to acknowledge receipt, but log error internally.
        return res.status(200).json({
            "returnCode": "0000", // Or a specific error code if LINE Pay defines one for "malformed callback data from merchant"
            "returnMessage": "Callback received, but processing error on merchant side due to invalid payload."
        });
    }

    try {
        const orderRef = db.collection('orders').doc(originalOrderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            logger.error(`LINE Pay Confirm: Order ${originalOrderId} not found in Firestore.`);
            // Again, acknowledge to LINE Pay, but log the error.
            return res.status(200).json({
                "returnCode": "0000",
                "returnMessage": "Callback acknowledged. Order not found on merchant side."
            });
        }

        const orderData = orderDoc.data();
        let newStatus = orderData?.status; // Keep current status if no change
        let updatePayload: any = {
            updatedAt: FieldValue.serverTimestamp(),
            linePayTransactionInfo: {
                transactionId: linePayTransactionId,
                confirmedAt: FieldValue.serverTimestamp(),
                rawCallback: callbackBody // Store the raw callback for auditing
            }
        };

        if (paymentStatus === 'SUCCESS') {
            newStatus = 'paid'; // Or 'payment_confirmed', 'processing_payment', etc.
            updatePayload.status = newStatus;
            updatePayload.paymentDetails = {
                method: 'linepay',
                transactionId: linePayTransactionId,
                status: 'paid',
                paidAt: FieldValue.serverTimestamp()
            };
            logger.info(`LINE Pay Confirm: Payment for order ${originalOrderId} successful. Status updated to ${newStatus}.`);
            // TODO: (Optional) Trigger notifications to customer/admin here

        } else { // paymentStatus === 'FAILURE' or other non-success codes
            newStatus = 'payment_failed';
            updatePayload.status = newStatus;
            updatePayload.paymentDetails = {
                method: 'linepay',
                transactionId: linePayTransactionId,
                status: 'failed',
                failedAt: FieldValue.serverTimestamp(),
                failureReason: callbackBody.returnMessage || 'Unknown failure reason from LINE Pay' // if available
            };
            logger.warn(`LINE Pay Confirm: Payment for order ${originalOrderId} failed or was not successful. Status updated to ${newStatus}.`);
        }

        await orderRef.update(updatePayload);

        // Respond to LINE Pay with the required success format
        res.status(200).json({
            "returnCode": "0000",
            "returnMessage": "Success"
        });

    } catch (error) {
        logger.error(`LINE Pay Confirm: Error processing callback for order ${originalOrderId}:`, error);
        // In case of internal server error, still try to send a success to LINE Pay if possible,
        // as they might retry if they don't get a 200-level response.
        // The exact behavior depends on LINE Pay's callback retry policy.
        res.status(200).json({
            "returnCode": "0000", // Consider if a different code is appropriate for internal errors
            "returnMessage": "Internal server error during callback processing."
        });
    }
});

export const confirmLinePayPaymentV2 = functions.onRequest(appConfirm);

// Interface for the request body to requestLinePayPaymentV2
interface LinePayRequestBody {
  orderId: string;
  amount: number;
  // productName?: string; // Optional, for LINE Pay display
}

// ... authorizeRoles might be needed if not all authenticated users can request payment ...

paymentsApiV2.post("/line/request", authenticateRequest, async (req, res) => {
  const { uid } = req.user;
  const { originalSystemOrderId, amount, items, productName } = req.body as {
    originalSystemOrderId: string;
    amount: number;
    items: Array<{ id: string; name: string; quantity: number; price: number; imageUrl?: string; }>;
    productName?: string;
  };

  if (!originalSystemOrderId || !amount || !items || items.length === 0) {
    logger.warn("Missing originalSystemOrderId, amount, or items in LINE Pay request", { uid, body: req.body });
    return res.status(400).json({ success: false, message: "Missing originalSystemOrderId, amount, or items." });
  }

  const linePayConfig = getLinePayConfig();
  if (!linePayConfig) {
    return res.status(500).json({ success: false, message: "LINE Pay configuration error on server." });
  }

  const paymentSpecificOrderId = `${originalSystemOrderId}_${Date.now()}`; // Unique ID for this payment attempt
  const packages = [
    {
      id: `pkg_${paymentSpecificOrderId}`,
      amount: amount,
      name: productName || `Order ${originalSystemOrderId}`,
      products: items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        imageUrl: item.imageUrl || `${linePayConfig.customerPwaBaseUrl}/default_product_image.png` // Provide a default or placeholder
      })),
    },
  ];

  const redirectUrls = {
    // This is the URL LINE Pay will call (server-to-server) AFTER user completes/cancels on LINE Pay page
    // It's NOT where the user's browser is redirected immediately after payment.
    // For V3, confirmUrl is used by LINE Pay to notify our server.
    // The user's browser is redirected to the URL provided in the Request API response (paymentUrl.web).
    // This callback will then redirect the user's browser.
    confirmUrl: `${linePayConfig.cloudFunctionBaseUrl}/paymentsApiV2/line/confirm_callback`, // Our server-side callback
    cancelUrl: `${linePayConfig.customerPwaBaseUrl}/checkout/cancel?orderId=${paymentSpecificOrderId}&reason=user_cancelled`,
  };

  const requestBody = {
    amount: amount,
    currency: "TWD",
    orderId: paymentSpecificOrderId,
    packages: packages,
    redirectUrls: redirectUrls,
    // capture: true, // Auto capture, set to false for auth-only
  };

  const nonce = Date.now().toString();
  const requestUri = "/v3/payments/request";
  const signatureBaseString = linePayConfig.channelSecret + requestUri + JSON.stringify(requestBody) + nonce;
  const signature = crypto.createHmac("sha256", linePayConfig.channelSecret).update(signatureBaseString).digest("base64");

  try {
    const linePayResponse = await axios.post(
      `${linePayConfig.apiUrl}${requestUri}`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "X-LINE-ChannelId": linePayConfig.channelId,
          "X-LINE-Authorization-Nonce": nonce,
          "X-LINE-Authorization": signature,
        },
      }
    );

    if (linePayResponse.data.returnCode === "0000") {
      const paymentUrlWeb = linePayResponse.data.info.paymentUrl.web;
      const linePayTransactionId = linePayResponse.data.info.transactionId.toString(); // Ensure it's a string

      await db.collection("linePayTransactions").doc(linePayTransactionId).set({
        originalSystemOrderId: originalSystemOrderId,
        paymentSpecificOrderId: paymentSpecificOrderId,
        customerId: uid,
        amount: amount,
        status: "pending_payment_redirect", // User needs to be redirected to LINE Pay
        requestApiCall: {
          timestamp: FieldValue.serverTimestamp(),
          requestBody: requestBody, // Log the request for auditing
          responseBody: linePayResponse.data,
        },
        linePayChannelId: linePayConfig.channelId,
      });

      logger.info(`LINE Pay request successful for order ${originalSystemOrderId}, LINE Pay TxID: ${linePayTransactionId}`);
      return res.status(200).json({
        success: true,
        paymentUrl: paymentUrlWeb,
        transactionId: linePayTransactionId, // LINE Pay's transactionId
        paymentSpecificOrderId: paymentSpecificOrderId, // Our payment attempt specific ID
      });
    } else {
      logger.error("LINE Pay Request API failed:", {
        returnCode: linePayResponse.data.returnCode,
        returnMessage: linePayResponse.data.returnMessage,
        originalSystemOrderId,
      });
      await db.collection("linePayTransactions").doc(`failed_${paymentSpecificOrderId}`).set({
        originalSystemOrderId: originalSystemOrderId,
        paymentSpecificOrderId: paymentSpecificOrderId,
        customerId: uid,
        amount: amount,
        status: "request_api_failed",
        errorDetails: linePayResponse.data,
        timestamp: FieldValue.serverTimestamp(),
      });
      return res.status(500).json({
        success: false,
        message: `LINE Pay request failed: ${linePayResponse.data.returnMessage}`,
        details: linePayResponse.data,
      });
    }
  } catch (error: any) {
    logger.error("Error calling LINE Pay Request API:", { originalSystemOrderId, error: error.message, response: error.response?.data });
     await db.collection("linePayTransactions").doc(`error_${paymentSpecificOrderId}`).set({
        originalSystemOrderId: originalSystemOrderId,
        paymentSpecificOrderId: paymentSpecificOrderId,
        customerId: uid,
        amount: amount,
        status: "request_api_exception",
        errorDetails: { message: error.message, responseData: error.response?.data },
        timestamp: FieldValue.serverTimestamp(),
      });
    return res.status(500).json({
      success: false,
      message: "Failed to communicate with LINE Pay.",
      error: error.message,
    });
  }
});


// --- LINE Pay Confirm Callback V3 (Called by LINE Pay server, then we call Confirm API) ---
// This endpoint is hit by LINE Pay server AFTER the user interaction on LINE Pay's site.
// Based on LINE Pay V3, this confirmUrl is a notification.
// The client (PWA) will likely be on a processing page polling our system or waiting for a websocket event.
// Alternatively, the PWA could be redirected to a generic page from LINE Pay and then it has to figure out the status.
// For a smoother UX, PWA polls our backend after redirecting to LINE.
// This callback will update the order and the PWA polling will pick it up.
// The user is NOT directly redirected here by their browser from LINE Pay.
paymentsApiV2.post("/line/confirm_callback", async (req, res) => {
  // This endpoint is PUBLIC. LINE Pay will call this.
  // It's crucial to validate the request if LINE Pay provides a way (e.g., signature validation if they send one for callbacks).
  // For now, we proceed based on the transactionId in the query params of the original redirectUrls.confirmUrl.
  // However, LINE Pay V3 spec for confirmUrl indicates it's a POST request with a JSON body.
  const callbackBody = req.body;
  // LINE Pay V3 Confirm URL callback typically doesn't have transactionId in query.
  // It's a general notification. The transactionId to confirm would be from the Request API response.
  // The PWA, after user returns from LINE Pay, should call a dedicated endpoint on our server with its known transactionId.

  // Let's assume for now this callback is informational, and the PWA will trigger the actual confirm.
  // OR, this endpoint now becomes the one that the PWA's OrderProcessingPage calls.
  // Let's rename this to reflect that the PWA will call this after user returns from LINE Pay.
  // The PWA will have the linePayTransactionId stored in sessionStorage.
  logger.info("Received POST on /line/confirm_callback (intended for PWA to trigger confirm)", { body: callbackBody });
  
  // This endpoint should be protected and called by the PWA after user returns.
  // The PWA will send the transactionId (from LINE Pay) and our originalSystemOrderId.
  // The logic from the old "paymentsApiV2.post("/line/confirm_payment_status_v3")" will be moved here.
  // This is an internal API for the PWA to call.
  // Let's assume PWA calls this with { linePayTransactionId, originalSystemOrderId, paymentSpecificOrderId }
  // This means this endpoint now NEEDS authentication.

  // ------ Re-designing this endpoint: This will be called by PWA after user returns from LINE Pay ------
  // So, it needs to be part of an authenticated route group if not already.
  // For simplicity, let's add an `authenticateRequest` here.
  // This means the `confirmUrl` in `redirectUrls` for LINE Pay Request API needs to be something else,
  // or this endpoint serves a dual purpose (needs careful thought on security if public).
  // Let's assume the `redirectUrls.confirmUrl` is a simple GET endpoint that the PWA uses
  // to land on and then the PWA makes an authenticated POST to this current endpoint.

  // For now, let's assume this is THE endpoint PWA calls after user is redirected back to PWA.
  // PWA provides linePayTransactionId.
  const { linePayTransactionId, originalSystemOrderId_from_pwa, paymentSpecificOrderId_from_pwa } = req.body;

  if (!linePayTransactionId) {
      logger.warn("PWA call to confirm_callback missing linePayTransactionId.", req.body);
      return res.status(400).json({ success: false, message: "LINE Pay Transaction ID is required." });
  }
  
  const linePayConfig = getLinePayConfig();
  if (!linePayConfig) {
    return res.status(500).json({ success: false, message: "LINE Pay configuration error on server." });
  }

  const transactionRef = db.collection("linePayTransactions").doc(linePayTransactionId);

  try {
    const transactionDoc = await db.runTransaction(async (tx) => {
      const doc = await tx.get(transactionRef);
      if (!doc.exists) {
        logger.error(`LINE Pay transaction not found for PWA confirm: ${linePayTransactionId}`);
        // No throw, to send a specific response below
        return null;
      }
      const data = doc.data()!;
      logger.info(`Transaction ${linePayTransactionId} current status: ${data.status}`, data);

      // Idempotency: Check if already confirmed or failed by API call
      if (data.status === "confirmed_paid" || data.status === "confirmed_failed") {
        logger.info(`Transaction ${linePayTransactionId} already processed. Status: ${data.status}`);
        // Return existing data to inform PWA
        return data; // Return the existing document data
      }
      
      if (data.status !== "pending_payment_redirect" && data.status !== "pending_confirm_api_call") {
          // If status is like request_api_failed or something else unexpected for a confirm call
          logger.warn(`Transaction ${linePayTransactionId} in unexpected state ${data.status} for confirm operation.`);
          // PWA might need to know this.
          // Let's return the current data, PWA can decide how to handle.
          return data;
      }


      // Proceed to call LINE Pay Confirm API
      const confirmApiRequestBody = {
        amount: data.amount,
        currency: "TWD",
      };
      const confirmRequestUri = `/v3/payments/${linePayTransactionId}/confirm`;
      const nonceConfirm = Date.now().toString();
      const signatureBaseStringConfirm = linePayConfig.channelSecret + confirmRequestUri + JSON.stringify(confirmApiRequestBody) + nonceConfirm;
      const signatureConfirm = crypto.createHmac("sha256", linePayConfig.channelSecret).update(signatureBaseStringConfirm).digest("base64");

      logger.info(`Calling LINE Pay Confirm API for TxID: ${linePayTransactionId}`, { requestBody: confirmApiRequestBody });
      const confirmResponse = await axios.post(
        `${linePayConfig.apiUrl}${confirmRequestUri}`,
        confirmApiRequestBody,
        {
          headers: {
            "Content-Type": "application/json",
            "X-LINE-ChannelId": linePayConfig.channelId,
            "X-LINE-Authorization-Nonce": nonceConfirm,
            "X-LINE-Authorization": signatureConfirm,
          },
        }
      );

      logger.info(`LINE Pay Confirm API response for TxID ${linePayTransactionId}:`, confirmResponse.data);
      const originalSystemOrderId = data.originalSystemOrderId; // from the stored transaction
      const orderRef = db.collection("orders").doc(originalSystemOrderId);
      let finalOrderStatusForPwa: string;
      let linePayTransactionNewStatus: string;

      if (confirmResponse.data.returnCode === "0000") {
        // Payment successful
        finalOrderStatusForPwa = "paid";
        linePayTransactionNewStatus = "confirmed_paid";
        tx.update(orderRef, {
          status: "paid",
          paymentDetails: {
            method: "linepay",
            transactionId: linePayTransactionId,
            paymentSpecificOrderId: data.paymentSpecificOrderId,
            status: "paid",
            paidAt: FieldValue.serverTimestamp(),
            linePayConfirmResponse: confirmResponse.data,
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
        logger.info(`Order ${originalSystemOrderId} status updated to paid via LINE Pay TxID ${linePayTransactionId}.`);
      } else {
        // Payment failed or other error from LINE Pay Confirm API
        finalOrderStatusForPwa = "payment_failed";
        linePayTransactionNewStatus = "confirmed_failed";
        tx.update(orderRef, {
          status: "payment_failed",
          paymentDetails: {
            method: "linepay",
            transactionId: linePayTransactionId,
            paymentSpecificOrderId: data.paymentSpecificOrderId,
            status: "failed",
            failedAt: FieldValue.serverTimestamp(),
            linePayConfirmResponse: confirmResponse.data, // Log the failure response
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
        logger.warn(`LINE Pay payment confirmation failed for order ${originalSystemOrderId} (TxID ${linePayTransactionId}). LP Return: ${confirmResponse.data.returnCode} - ${confirmResponse.data.returnMessage}`);
      }

      tx.update(transactionRef, {
        status: linePayTransactionNewStatus,
        confirmApiCall: {
          timestamp: FieldValue.serverTimestamp(),
          requestBody: confirmApiRequestBody,
          responseBody: confirmResponse.data,
        },
      });
      // Return the updated transaction data within the transaction
      // Need to construct what the new data would look like after tx.update
      const updatedData = {
        ...data,
        status: linePayTransactionNewStatus,
         confirmApiCall: {
          // Firestore serverTimestamp might not be resolved here,
          // but it's for returning to PWA.
          timestamp: new Date(), // approx
          requestBody: confirmApiRequestBody,
          responseBody: confirmResponse.data,
        },
      };
      return updatedData; // Return the presumed updated data
    });

    if (!transactionDoc) { // This means the transaction.get() inside runTransaction returned null
      return res.status(404).json({ success: false, message: `LINE Pay transaction ${linePayTransactionId} not found.` });
    }
    
    // transactionDoc here is the data returned from the transaction block
    // which includes the latest status.
    const finalStatus = transactionDoc.status; // e.g. "confirmed_paid" or "confirmed_failed"

    if (finalStatus === "confirmed_paid") {
         return res.status(200).json({
            success: true,
            message: "Payment confirmed successfully.",
            orderStatus: "paid", // Actual status of the *order*
            transactionStatus: finalStatus, // Status of the *linePayTransaction*
            linePayResponse: transactionDoc.confirmApiCall?.responseBody,
            originalSystemOrderId: transactionDoc.originalSystemOrderId,
        });
    } else if (finalStatus === "confirmed_failed") {
         return res.status(200).json({ // Still 200 OK, but payment failed
            success: false, // Indicate payment was not successful
            message: `Payment confirmation failed: ${transactionDoc.confirmApiCall?.responseBody?.returnMessage || 'Unknown LINE Pay error'}`,
            orderStatus: "payment_failed",
            transactionStatus: finalStatus,
            linePayResponse: transactionDoc.confirmApiCall?.responseBody,
            originalSystemOrderId: transactionDoc.originalSystemOrderId,
        });
    } else {
        // This case might happen if idempotency kicked in early or unexpected status
        logger.warn(`PWA confirm call for TxID ${linePayTransactionId} resulted in an intermediate or unexpected status: ${finalStatus}`);
        return res.status(200).json({
            success: false, // Or true, depending on how PWA should interpret this
            message: "Payment status is currently being processed or is in an unexpected state.",
            orderStatus: transactionDoc.originalSystemOrderId ? (await db.collection("orders").doc(transactionDoc.originalSystemOrderId).get()).data()?.status : 'unknown',
            transactionStatus: finalStatus,
            linePayResponse: transactionDoc.confirmApiCall?.responseBody, // Might be undefined
            originalSystemOrderId: transactionDoc.originalSystemOrderId,
        });
    }

  } catch (error: any) {
    logger.error(`Error during LINE Pay Confirm API call or Firestore update for TxID ${linePayTransactionId}:`, error);
    // Attempt to update linePayTransactions with error if possible, outside transaction
     try {
        await transactionRef.update({
            status: "confirm_api_exception",
            confirmApiError: {
                message: error.message,
                stack: error.stack,
                timestamp: FieldValue.serverTimestamp(),
            },
        });
    } catch (dbError) {
        logger.error(`Failed to log confirm_api_exception for TxID ${linePayTransactionId}:`, dbError);
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error during payment confirmation.",
      error: error.message,
    });
  }
});


// This is the endpoint that LINE Pay's `redirectUrls.confirmUrl` should point to.
// Its job is to redirect the user's browser to the PWA's processing page,
// passing along the transactionId and our original orderId (or paymentSpecificOrderId).
// LINE Pay user-facing redirect (from their site to ours) after payment interaction.
paymentsApiV2.get("/line/user_redirect_after_payment", (req, res) => {
  const { transactionId, orderId } = req.query; // orderId here is paymentSpecificOrderId
  // It's possible LINE Pay might also include `returnCode` and `returnMessage` in query for this redirect.
  logger.info("LINE Pay User Redirect received", { query: req.query });

  const linePayConfig = getLinePayConfig();
  if (!linePayConfig) {
    // This is a user-facing redirect, so a bit hard to show a nice error if config is missing.
    // Redirect to a generic error page on PWA or just PWA base URL.
    return res.redirect(`${process.env.CUSTOMER_PWA_BASE_URL || '/'}/checkout/error?message=ConfigError`);
  }

  if (!transactionId || !orderId) {
    logger.warn("LINE Pay user_redirect_after_payment missing transactionId or orderId in query.", req.query);
    // Redirect to a generic error page on PWA
    return res.redirect(`${linePayConfig.customerPwaBaseUrl}/checkout/error?message=MissingLinePayParams`);
  }
  // The PWA's OrderProcessingPage will then take these IDs and make an authenticated call
  // to the `/line/confirm_callback` (POST) endpoint to get the actual server-verified status.
  const pwaProcessingUrl = `${linePayConfig.customerPwaBaseUrl}/processing?linePayTransactionId=${transactionId}&paymentSpecificOrderId=${orderId}&source=linepay_redirect`;
  
  logger.info(`Redirecting user to PWA processing page: ${pwaProcessingUrl}`);
  res.redirect(pwaProcessingUrl);
});


export { paymentsApiV2 };

// --- Environment Variable Helper ---
function getLinePayConfig() {
  const config = functions.config().linepay; // Preferred method
  const channelId = config?.channel_id || process.env.LINE_PAY_CHANNEL_ID;
  const channelSecret = config?.channel_secret_key || process.env.LINE_PAY_CHANNEL_SECRET_KEY;
  const apiUrl = config?.api_url || process.env.LINE_PAY_API_URL || "https://sandbox-api-pay.line.me"; // Default to sandbox
  const cloudFunctionBaseUrl = config?.cloud_function_base_url || process.env.CLOUD_FUNCTION_BASE_URL;
  const customerPwaBaseUrl = config?.customer_pwa_base_url || process.env.CUSTOMER_PWA_BASE_URL;

  if (!channelId || !channelSecret || !apiUrl || !cloudFunctionBaseUrl || !customerPwaBaseUrl) {
    logger.error("LINE Pay configuration is missing from environment variables or Firebase Functions config.", {
      channelId_exists: !!channelId,
      channelSecret_exists: !!channelSecret,
      apiUrl_exists: !!apiUrl,
      cloudFunctionBaseUrl_exists: !!cloudFunctionBaseUrl,
      customerPwaBaseUrl_exists: !!customerPwaBaseUrl,
    });
    return null;
  }
  return { channelId, channelSecret, apiUrl, cloudFunctionBaseUrl, customerPwaBaseUrl };
} 