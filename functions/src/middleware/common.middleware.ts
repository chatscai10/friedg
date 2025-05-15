import { Request, Response, NextFunction } from 'express';
import * as functions from 'firebase-functions';
import { v4 as uuidv4 } from 'uuid';
import { PaymentServiceError } from '../payments/linepay.types.v2'; // Assuming this is a base error type or we need a more generic one
import { OrderServiceError } from '../orders/orders.types.v2';
import { InventoryServiceError } from '../inventory/inventory.types.v2';
import { ApiErrorResponse } from '../payments/linepay.types.v2'; // Re-use or define a common ApiErrorResponse

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  const entryLog = {
    correlationId,
    type: 'REQUEST_RECEIVED',
    method: req.method,
    path: req.path,
    sourceIp: req.ip || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'],
    query: req.query,
    // Avoid logging req.body by default due to PII/size. Log selectively in handlers.
  };
  functions.logger.info(`ENTRY: ${req.method} ${req.path}`, entryLog);

  const originalSend = res.send;
  res.send = function (body) {
    const exitLog = {
        correlationId,
        type: 'RESPONSE_SENT',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        // Be cautious logging full response body. Could log length or summary.
        // responseBodyLength: typeof body === 'string' ? body.length : undefined,
    };
    functions.logger.info(`EXIT: ${req.method} ${req.path} - ${res.statusCode}`, exitLog);
    return originalSend.apply(res, arguments as any);
  };

  next();
};

// More specific error type check
interface OperationalError extends Error {
    statusCode?: number;
    isOperational?: boolean;
    details?: any;
}

export const globalErrorHandler = (
  err: Error | OperationalError, 
  req: Request, 
  res: Response, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction 
) => {
  const correlationId = (req as any).correlationId || 'N/A';
  const errorLog = {
    correlationId,
    type: 'GLOBAL_ERROR',
    path: req.path,
    method: req.method,
    errorMessage: err.message,
    errorName: err.name,
    errorStack: err.stack, // Be cautious in production, might be too verbose or leak info
    isOperational: (err as OperationalError).isOperational,
    details: (err as OperationalError).details,
  };
  functions.logger.error(`ERROR: ${err.name} for ${req.method} ${req.path}`, errorLog);

  let statusCode = 500;
  let responseMessage = 'An unexpected internal server error occurred.';
  let errorDetails: any = undefined;

  if ((err as OperationalError).isOperational) {
    statusCode = (err as OperationalError).statusCode || 500;
    responseMessage = err.message;
    errorDetails = (err as OperationalError).details;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
      // JSON parsing error from Express body-parser
      statusCode = 400;
      responseMessage = 'Invalid JSON payload.';
  } else if (err.name === 'ZodError') { // Assuming ZodError has a specific structure
      statusCode = 400;
      responseMessage = 'Invalid request parameters.';
      errorDetails = (err as any).errors; // Zod errors array
  }
  // Add more specific error type checks as needed (e.g., from other libraries)

  // In production, avoid sending back raw error messages or stack traces for non-operational errors
  if (process.env.NODE_ENV === 'production' && !(err as OperationalError).isOperational && statusCode === 500) {
    responseMessage = 'An unexpected internal server error occurred.';
    errorDetails = undefined;
  }
  
  const errorResponse: ApiErrorResponse = { message: responseMessage };
  if (errorDetails) {
    errorResponse.errors = Array.isArray(errorDetails) ? errorDetails : [{ message: String(errorDetails) }];
  }

  // Ensure headers are not already sent
  if (!res.headersSent) {
    return res.status(statusCode).json(errorResponse);
  }
}; 