import * as admin from 'firebase-admin';
import { logger } from './logging.utils'; // Assuming logger is in logging.utils

const IDEMPOTENCY_COLLECTION = 'idempotencyKeys';

interface IdempotencyDoc {
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
  response: string; // JSON string of the response
  status: 'processing' | 'completed' | 'failed';
  requestHash?: string; // Hash of the request payload for more robust checks
}

export class IdempotencyService {
  private db: admin.firestore.Firestore;
  private collectionRef: admin.firestore.CollectionReference<IdempotencyDoc>;

  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp(); // Ensure Firebase is initialized
    }
    this.db = admin.firestore();
    this.collectionRef = this.db.collection(IDEMPOTENCY_COLLECTION) as admin.firestore.CollectionReference<IdempotencyDoc>;
  }

  /**
   * Processes a request with an idempotency key.
   * If the key exists and the request was completed, returns the stored response.
   * If the key exists and the request is processing, throws an error.
   * If the key does not exist, executes the processor function and stores the result.
   *
   * @param idempotencyKey The unique key for the request.
   * @param requestPayload The payload of the current request (used for hashing if needed).
   * @param processor A function that performs the actual processing and returns a Promise.
   * @param ttlMinutes Time-to-live for the idempotency key in minutes. Defaults to 1440 (24 hours).
   * @returns The result of the processor function.
   * @throws Error if the request is already processing or if processing fails.
   */
  async process<T>(
    idempotencyKey: string,
    processor: () => Promise<T>,
    requestPayload?: any, // Optional: for more robust duplicate checking by hashing payload
    ttlMinutes: number = 24 * 60,
  ): Promise<T> {
    const keyRef = this.collectionRef.doc(idempotencyKey);
    let operationResult: T;

    try {
      await this.db.runTransaction(async (transaction) => {
        const doc = await transaction.get(keyRef);

        if (doc.exists) {
          const data = doc.data() as IdempotencyDoc;
          logger.info('Idempotency key found', { idempotencyKey, status: data.status });

          if (data.status === 'completed') {
            // Request already completed, return stored response
            operationResult = JSON.parse(data.response) as T;
            return;
          } else if (data.status === 'processing') {
            // Request is currently processing, prevent concurrent execution
            logger.warn('Concurrent request detected with same idempotency key', { idempotencyKey });
            throw new Error(`Request with idempotency key ${idempotencyKey} is already processing.`);
          } else if (data.status === 'failed') {
            // Previous attempt failed, allow retry by treating as new (or implement specific retry logic)
            logger.warn('Previous request with this idempotency key failed. Allowing retry.', { idempotencyKey });
            // Fall through to mark as processing and execute
          }
        }

        // Mark as processing or update if it was 'failed'
        const now = admin.firestore.Timestamp.now();
        const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + ttlMinutes * 60 * 1000);
        
        const processingData: Partial<IdempotencyDoc> = {
            createdAt: doc.exists ? (doc.data() as IdempotencyDoc).createdAt : now, // Keep original createdAt if retrying failed
            updatedAt: now,
            expiresAt,
            status: 'processing',
        };
        if (requestPayload) {
            // Add hashing logic if needed, for now, storing as is or skipping.
            // processingData.requestHash = crypto.createHash('md5').update(JSON.stringify(requestPayload)).digest('hex');
        }
        transaction.set(keyRef, processingData, { merge: true });
        logger.info('Marked idempotency key as processing', { idempotencyKey });
      });

      // If operationResult is already set from a 'completed' state, return it.
      if (operationResult !== undefined) {
        return operationResult;
      }
      
      // Execute the actual operation OUTSIDE the initial transaction if it's long-running
      // to avoid holding the transaction open for too long.
      // The 'processing' state protects against concurrent starts.
      operationResult = await processor();

      // Store the successful result in a new transaction
      await this.db.runTransaction(async (transaction) => {
        const now = admin.firestore.Timestamp.now();
        const finalData: Partial<IdempotencyDoc> = {
          response: JSON.stringify(operationResult),
          status: 'completed',
          updatedAt: now, // Update timestamp
        };
        transaction.set(keyRef, finalData, { merge: true });
      });
      logger.info('Idempotency key marked as completed', { idempotencyKey });
      return operationResult;

    } catch (error: any) {
      logger.error('Error during idempotent operation', { idempotencyKey, error: error.message, stack: error.stack });
      // Mark as failed in Firestore
      await keyRef.set({
        status: 'failed',
        updatedAt: admin.firestore.Timestamp.now(),
        errorMessage: error.message,
      } as Partial<IdempotencyDoc>, { merge: true }).catch(logError => {
          logger.error('Failed to mark idempotency key as failed', { idempotencyKey, logError: logError.message });
      });
      throw error; // Re-throw the original error
    }
  }
}

// Singleton instance
export const idempotencyService = new IdempotencyService(); 