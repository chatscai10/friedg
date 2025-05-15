import sinon from 'sinon';
import admin from 'firebase-admin';
import functions from 'firebase-functions';
import axios from 'axios';

// --- Mocks ---
// Mock Firebase Config (functions.config())
const mockFirebaseConfig = {
  linepay: {
    api_url: 'https://sandbox-test-api.line.me',
    channel_id: 'test-channel-id',
    secret_key: 'test-secret-key',
    confirm_base_url: 'https://test-functions.net/paymentsApiV2/line',
    cancel_base_url: 'https://test-pwa.web.app/cancel',
  },
  customer_pwa: {
    base_url: 'https://test-pwa.web.app',
  },
};
sinon.stub(functions, 'config').returns(mockFirebaseConfig);

// Mock Firebase Logger
const loggerStub = {
  info: sinon.stub(),
  error: sinon.stub(),
  warn: sinon.stub(),
  debug: sinon.stub(),
};
(functions as any).logger = loggerStub;

// Mock Firestore
const mockSet = sinon.stub();
const mockDoc = sinon.stub().returns({ set: mockSet });
const mockCollection = sinon.stub().returns({ doc: mockDoc });

// Attempt to stub admin.firestore() if it's a function, or db instance methods
if (typeof admin.firestore === 'function') {
    // If admin.firestore is a function (like admin.firestore()), stub it to return our mock db object
    const mockDb = { collection: mockCollection };
    sinon.stub(admin, 'firestore').get(() => () => mockDb); 
} else {
    // If admin.firestore is already an initialized instance (less common directly in new SDK versions for stubbing)
    // This case is harder to reliably mock without deeper SDK knowledge or a test initializer. 
    // For simplicity, assuming the get() trick works or direct stubbing of admin.firestore().collection is feasible.
    // As a fallback, if the above doesn't work in all environments, one might need to initialize a test app
    // and then stub methods on admin.firestore(testApp).collection(...).
    // The current mockCollection setup might suffice if LinePayService directly uses admin.firestore().collection().
}
// Ensure FieldValue is available
sinon.stub(admin.firestore, 'FieldValue').get(() => ({
  serverTimestamp: sinon.stub().returns('MOCK_SERVER_TIMESTAMP'),
}));

// Mock Axios
const mockAxiosPost = sinon.stub();
sinon.stub(axios, 'post').callsFake(mockAxiosPost);

// --- Import the service AFTER mocks are set up ---
import { LinePayServiceV2 } from './linepay.service.v2';
import { LinePayRequestBody, PaymentServiceError } from './linepay.types.v2';


describe('LinePayServiceV2', () => {
  let service: LinePayServiceV2;

  beforeEach(() => {
    sinon.resetHistory(); // Reset spies/stubs history before each test
    service = new LinePayServiceV2();
  });

  afterAll(() => {
    sinon.restore(); // Restore all stubs after tests are done
  });

  describe('requestPayment', () => {
    const mockCustomerId = 'cust-123';
    const mockPayload: LinePayRequestBody = {
      originalSystemOrderId: 'order-abc-123',
      amount: 100,
      currency: 'TWD',
      items: [{
        id: 'item-001',
        name: 'Test Item 1',
        quantity: 1,
        price: 100,
        imageUrl: 'https://example.com/item1.jpg',
      }],
    };

    it('should successfully request payment and store transaction on LINE Pay success', async () => {
      mockAxiosPost.resolves({
        data: {
          returnCode: '0000',
          returnMessage: 'Success.',
          info: {
            transactionId: 'line-trans-id-001',
            paymentUrl: { web: 'https://line.pay/payment_url' },
          },
        },
      });
      mockSet.resolves(); // Firestore set operation is successful

      const result = await service.requestPayment(mockPayload, mockCustomerId);

      expect(result.paymentUrl).toBe('https://line.pay/payment_url');
      expect(result.linePayTransactionId).toBe('line-trans-id-001');
      expect(result.paymentSpecificOrderId).toBeDefined();

      // Verify axios call (simplified check)
      expect(mockAxiosPost.calledOnce).toBe(true);
      const axiosArgs = mockAxiosPost.firstCall.args;
      expect(axiosArgs[0]).toBe('https://sandbox-test-api.line.me/v3/payments/request');
      expect(axiosArgs[1].orderId).toBe(result.paymentSpecificOrderId);
      expect(axiosArgs[1].amount).toBe(mockPayload.amount);

      // Verify Firestore call
      expect(mockCollection.calledWith('linePayTransactions')).toBe(true);
      expect(mockDoc.calledWith('line-trans-id-001')).toBe(true);
      expect(mockSet.calledOnce).toBe(true);
      const firestoreData = mockSet.firstCall.args[0];
      expect(firestoreData.originalSystemOrderId).toBe(mockPayload.originalSystemOrderId);
      expect(firestoreData.customerId).toBe(mockCustomerId);
      expect(firestoreData.status).toBe('pending_payment_redirect');
    });

    it('should throw PaymentServiceError if LINE Pay API returns an error code', async () => {
      mockAxiosPost.resolves({
        data: {
          returnCode: '1100', // Example error code
          returnMessage: 'LINE Pay API Error',
        },
      });

      await expect(service.requestPayment(mockPayload, mockCustomerId))
        .rejects.toThrow(PaymentServiceError);
      await expect(service.requestPayment(mockPayload, mockCustomerId))
        .rejects.toThrow('LINE Pay Error: LINE Pay API Error');
      
      expect(mockSet.notCalled).toBe(true); // Ensure Firestore was not called
    });

    it('should throw PaymentServiceError if axios call fails', async () => {
      mockAxiosPost.rejects(new Error('Network Error'));

      await expect(service.requestPayment(mockPayload, mockCustomerId))
        .rejects.toThrow(PaymentServiceError);
      await expect(service.requestPayment(mockPayload, mockCustomerId))
        .rejects.toThrow('Failed to process LINE Pay payment request.');
    });

    // Test for missing configuration (e.g., LINE_PAY_SECRET_KEY)
    it('should throw PaymentServiceError if essential LINE Pay config is missing', async () => {
        const originalConfig = functions.config();
        (functions as any).config = () => ({ // Simulate missing secret key
            ...originalConfig,
            linepay: { ...originalConfig.linepay, secret_key: undefined }
        });
        
        try {
            await expect(service.requestPayment(mockPayload, mockCustomerId))
                .rejects.toThrow(new RegExp('LINE Pay configuration error|LINE Pay service is not configured correctly'));
        } finally {
            (functions as any).config = () => originalConfig; // Restore config
        }
    });

  });

  describe('confirmPayment', () => {
    const mockLinePayTransactionId = 'line-trans-confirm-002';
    const mockConfirmPayload: any = { // Type from linepay.types.v2.ts
      linePayTransactionId: mockLinePayTransactionId,
    };

    const mockTransactionDocData: any = { // Type LinePayTransactionDoc
      originalSystemOrderId: 'order-original-456',
      paymentSpecificOrderId: 'pay-spec-789',
      customerId: 'cust-confirm-123',
      amount: 250,
      currency: 'TWD',
      status: 'pending_confirm_api', // Initial status for confirm test
      linePayOriginalTransactionId: mockLinePayTransactionId, // Matches payload
      requestPayload: { items: [], amount: 250, currency: 'TWD', originalSystemOrderId: 'order-original-456' },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    // Mock Firestore runTransaction, get, and update for confirmPayment
    let mockTransactionGetStub = sinon.stub();
    let mockTransactionUpdateStub = sinon.stub();
    
    const mockDbRunTransaction = async (updateFunction: (t: any) => Promise<any>) => {
        mockTransactionGetStub.reset();
        mockTransactionUpdateStub.reset();
        // Simulate the transaction object passed to the callback
        const mockTransactionObject = {
            get: mockTransactionGetStub,
            update: mockTransactionUpdateStub,
        };
        return updateFunction(mockTransactionObject);
    };

    let dbStub: any;

    beforeEach(() => {
        // Reset stubs used in confirmPayment
        mockTransactionGetStub.reset();
        mockTransactionUpdateStub.reset();
        mockAxiosPost.resetHistory(); // Also reset axios for confirm API call

        // Re-stub or ensure admin.firestore().runTransaction() is correctly mocked for this describe block
        // This is tricky because runTransaction is a method on the db instance, not admin.firestore itself typically.
        // The previous mock for admin.firestore() might need adjustment or this specific test block
        // might need its own more focused db instance mock.
        const dbInstance = admin.firestore();
        dbStub = sinon.stub(dbInstance, 'runTransaction').callsFake(mockDbRunTransaction);
    });

    afterEach(() => {
        if (dbStub) dbStub.restore();
    });

    it('should successfully confirm payment, update Firestore docs, and call LINE Pay Confirm API', async () => {
      mockTransactionGetStub.resolves({ exists: true, data: () => ({ ...mockTransactionDocData, status: 'pending_confirm_api' }) });
      mockAxiosPost.resolves({ // Mock successful LINE Pay Confirm API response
        data: { returnCode: '0000', returnMessage: 'Success.', info: { transactionId: mockLinePayTransactionId } },
      });
      mockTransactionUpdateStub.resolves(); // Both Firestore updates are successful

      const result = await service.confirmPayment(mockConfirmPayload);

      expect(result.status).toBe('paid');
      expect(result.message).toBe('Payment successful.');
      expect(result.originalSystemOrderId).toBe(mockTransactionDocData.originalSystemOrderId);

      // Verify Firestore get
      expect(mockTransactionGetStub.calledOnce).toBe(true);
      // Verify axios call to LINE Pay Confirm API
      expect(mockAxiosPost.calledOnce).toBe(true);
      const axiosConfirmArgs = mockAxiosPost.firstCall.args;
      expect(axiosConfirmArgs[0]).toContain(`/v3/payments/${mockLinePayTransactionId}/confirm`);
      expect(axiosConfirmArgs[1].amount).toBe(mockTransactionDocData.amount);
      // Verify Firestore updates (2 updates: one for linePayTransactions, one for orders)
      expect(mockTransactionUpdateStub.callCount).toBe(2);
      const linePayTxUpdateArgs = mockTransactionUpdateStub.getCall(0).args[1];
      const orderUpdateArgs = mockTransactionUpdateStub.getCall(1).args[1];
      expect(linePayTxUpdateArgs.status).toBe('confirmed_paid');
      expect(orderUpdateArgs.paymentStatus).toBe('paid');
      expect(orderUpdateArgs.status).toBe('processing'); 
    });

    it('should return "already_processed" if transaction status is already confirmed_paid', async () => {
      mockTransactionGetStub.resolves({ exists: true, data: () => ({ ...mockTransactionDocData, status: 'confirmed_paid' }) });
      
      const result = await service.confirmPayment(mockConfirmPayload);

      expect(result.status).toBe('paid');
      expect(result.message).toBe('Transaction already processed.');
      expect(mockAxiosPost.notCalled).toBe(true); // LINE Pay Confirm API should not be called
      expect(mockTransactionUpdateStub.notCalled).toBe(true); // No Firestore updates
    });
    
    it('should return "already_processed" if transaction status is already confirmed_failed', async () => {
      mockTransactionGetStub.resolves({ exists: true, data: () => ({ ...mockTransactionDocData, status: 'confirmed_failed' }) });
      
      const result = await service.confirmPayment(mockConfirmPayload);

      expect(result.status).toBe('payment_failed');
      expect(result.message).toBe('Transaction already processed.');
      expect(mockAxiosPost.notCalled).toBe(true);
      expect(mockTransactionUpdateStub.notCalled).toBe(true);
    });

    it('should throw PaymentServiceError if transaction document not found', async () => {
      mockTransactionGetStub.resolves({ exists: false });

      await expect(service.confirmPayment(mockConfirmPayload))
        .rejects.toThrow(PaymentServiceError);
      await expect(service.confirmPayment(mockConfirmPayload))
        .rejects.toThrow('Transaction not found.');
    });

    it('should handle LINE Pay Confirm API error and update statuses accordingly', async () => {
      mockTransactionGetStub.resolves({ exists: true, data: () => ({ ...mockTransactionDocData, status: 'pending_confirm_api' }) });
      mockAxiosPost.resolves({ // Mock LINE Pay Confirm API error response
        data: { returnCode: '1199', returnMessage: 'Confirm API Failed Specific Error', info: {} },
      });
      mockTransactionUpdateStub.resolves();

      const result = await service.confirmPayment(mockConfirmPayload);

      expect(result.status).toBe('payment_failed');
      expect(result.message).toContain('LINE Pay Confirm Error: Confirm API Failed Specific Error');
      
      expect(mockTransactionUpdateStub.callCount).toBe(2);
      const linePayTxUpdateArgs = mockTransactionUpdateStub.getCall(0).args[1];
      const orderUpdateArgs = mockTransactionUpdateStub.getCall(1).args[1];
      expect(linePayTxUpdateArgs.status).toBe('confirmed_failed');
      expect(orderUpdateArgs.paymentStatus).toBe('payment_failed');
    });
    
    it('should handle axios network error when calling LINE Pay Confirm API and update statuses', async () => {
        mockTransactionGetStub.resolves({ exists: true, data: () => ({ ...mockTransactionDocData, status: 'pending_confirm_api' }) });
        mockAxiosPost.rejects(new Error('Network error calling confirm'));
        mockTransactionUpdateStub.resolves();

        const result = await service.confirmPayment(mockConfirmPayload);
        expect(result.status).toBe('payment_failed');
        expect(result.message).toBe('Failed to confirm payment with LINE Pay due to an internal error.');

        expect(mockTransactionUpdateStub.callCount).toBe(2);
        const linePayTxUpdateArgs = mockTransactionUpdateStub.getCall(0).args[1];
        expect(linePayTxUpdateArgs.status).toBe('confirm_api_error');
    });

    it('should correctly handle user_cancelled_at_line status', async () => {
        mockTransactionGetStub.resolves({ exists: true, data: () => ({ ...mockTransactionDocData, status: 'user_cancelled_at_line' }) });
        mockTransactionUpdateStub.resolves();

        const result = await service.confirmPayment(mockConfirmPayload);

        expect(result.status).toBe('payment_failed');
        expect(result.message).toBe('Payment was cancelled by user at LINE Pay.');
        expect(mockAxiosPost.notCalled).toBe(true); // Confirm API should not be called
        // Check that the transaction was updated (or at least attempted to be, to maintain status)
        expect(mockTransactionUpdateStub.calledOnce).toBe(true);
        const linePayTxUpdateArgs = mockTransactionUpdateStub.firstCall.args[1];
        expect(linePayTxUpdateArgs.status).toBe('user_cancelled_at_line');
    });

    it('should throw PaymentServiceError for unexpected transaction status before confirm', async () => {
        mockTransactionGetStub.resolves({ exists: true, data: () => ({ ...mockTransactionDocData, status: 'confirmed_paid' }) }); // an already processed state
        // Re-test with status that should not proceed to confirm like 'confirmed_paid' but without the top-level idempotency catch
        // This tests the internal state check more directly
        const serviceInstance = new LinePayServiceV2();
        // Temporarily bypass the primary idempotency check for this specific test of internal logic
        const originalData = { ...mockTransactionDocData, status: 'confirmed_paid' };
        mockTransactionGetStub.resolves({ exists: true, data: () => originalData });
        
        // The primary idempotency check should catch this first in the actual service.
        // If we were to test the deeper check, we'd mock it to pass the first check.
        // For now, the existing idempotency tests for 'confirmed_paid' and 'confirmed_failed' cover the main behavior.
        // This test as written will be caught by the main idempotency, let's adjust to test internal state error.

        const unexpectedStateData = { ...mockTransactionDocData, status: 'something_else_unexpected' as any };
        mockTransactionGetStub.resolves({ exists: true, data: () => unexpectedStateData });

        await expect(serviceInstance.confirmPayment(mockConfirmPayload))
            .rejects.toThrow(PaymentServiceError);
        await expect(serviceInstance.confirmPayment(mockConfirmPayload))
            .rejects.toThrow('Transaction in unexpected state: something_else_unexpected');
    });

  }); // End of describe('confirmPayment')

}); 