import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { createCustomerOrderHandler, getCustomerOrderStatusHandler } from '../customer.orders.handlers';
import { OrderStatus, PaymentStatus } from '../types';

// 模擬Firebase Admin及其方法
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        tenantId: 'test-tenant-id',
        name: 'Test Store'
      })
    }),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis()
  })),
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn()
  })),
  FieldValue: {
    serverTimestamp: jest.fn()
  }
}));

// 模擬訂單服務
jest.mock('../orders.service', () => ({
  createOrderWithTransaction: jest.fn().mockResolvedValue({
    id: 'order-123',
    orderNumber: 'TEST1234',
    status: 'pending',
    totalAmount: 100,
    estimatedPickupTime: null,
    paymentMethod: 'cash',
    paymentStatus: 'unpaid'
  }),
  getOrderById: jest.fn().mockResolvedValue({
    id: 'order-123',
    orderNumber: 'TEST1234',
    status: 'pending',
    totalAmount: 100,
    estimatedPickupTime: null,
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    customerId: 'customer-123',
    items: [
      {
        menuItemId: 'item-1',
        menuItemName: '脆皮雞排',
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100
      }
    ],
    storeId: 'store-123',
    storeName: 'Test Store',
    createdAt: new Date()
  })
}));

// 模擬Firebase Functions的logger
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// 配置測試用的請求和響應
const mockRequest = (body = {}, user = null, params = {}, query = {}) => {
  return {
    body,
    user,
    params,
    query,
    headers: { authorization: 'Bearer fake-token' }
  } as unknown as Request;
};

const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('Customer Orders Handlers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomerOrderHandler', () => {
    it('should successfully create an order for anonymous user', async () => {
      // 準備請求數據
      const req = mockRequest({
        storeId: 'store-123',
        customerName: '測試顧客',
        customerPhone: '0912345678',
        orderType: 'takeout',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2
          }
        ]
      });
      const res = mockResponse();

      // 呼叫處理函數
      await createCustomerOrderHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
          data: expect.objectContaining({
            orderId: expect.any(String),
            orderNumber: expect.any(String),
            status: expect.any(String),
            trackingCode: expect.any(String)
          })
        })
      );
    });

    it('should successfully create an order for authenticated user', async () => {
      // 準備請求數據
      const req = mockRequest(
        {
          storeId: 'store-123',
          customerName: '測試顧客',
          customerPhone: '0912345678',
          orderType: 'takeout',
          items: [
            {
              menuItemId: 'item-1',
              quantity: 2
            }
          ]
        },
        {
          uid: 'user-123',
          role: 'customer',
          customerId: 'customer-123'
        }
      );
      const res = mockResponse();

      // 呼叫處理函數
      await createCustomerOrderHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
          data: expect.objectContaining({
            orderId: expect.any(String),
            orderNumber: expect.any(String),
            status: expect.any(String)
          })
        })
      );
      // 驗證沒有trackingCode (已登入用戶)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            trackingCode: expect.any(String)
          })
        })
      );
    });

    it('should return 400 if request validation fails', async () => {
      // 準備不完整的請求數據
      const req = mockRequest({
        storeId: 'store-123',
        // 缺少必要的customerPhone
        orderType: 'takeout',
        items: [] // 空數組，不符合至少1個項目的要求
      });
      const res = mockResponse();

      // 呼叫處理函數
      await createCustomerOrderHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('驗證失敗')
        })
      );
    });

    it('should return 404 if store does not exist', async () => {
      // 模擬店鋪不存在
      jest.spyOn(admin.firestore(), 'collection').mockImplementationOnce(() => ({
        doc: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          exists: false
        })
      } as any));

      // 準備請求數據
      const req = mockRequest({
        storeId: 'nonexistent-store',
        customerName: '測試顧客',
        customerPhone: '0912345678',
        orderType: 'takeout',
        items: [
          {
            menuItemId: 'item-1',
            quantity: 2
          }
        ]
      });
      const res = mockResponse();

      // 呼叫處理函數
      await createCustomerOrderHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('店鋪不存在')
        })
      );
    });
  });

  describe('getCustomerOrderStatusHandler', () => {
    it('should return order status for authenticated user', async () => {
      // 準備請求數據
      const req = mockRequest(
        {},
        {
          uid: 'user-123',
          customerId: 'customer-123'
        },
        { orderId: 'order-123' }
      );
      const res = mockResponse();

      // 呼叫處理函數
      await getCustomerOrderStatusHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            orderId: expect.any(String),
            orderNumber: expect.any(String),
            status: expect.any(String),
            statusText: expect.any(String)
          })
        })
      );
    });

    it('should return order status for anonymous user with valid order number and phone', async () => {
      // 模擬訂單查詢結果
      jest.spyOn(admin.firestore(), 'collection').mockImplementationOnce(() => ({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [
            {
              data: () => ({
                id: 'order-123',
                orderNumber: 'TEST1234',
                status: OrderStatus.PENDING,
                totalAmount: 100,
                estimatedPickupTime: null,
                paymentStatus: PaymentStatus.UNPAID,
                storeId: 'store-123',
                storeName: 'Test Store',
                createdAt: new Date()
              })
            }
          ]
        })
      } as any));

      // 準備請求數據
      const req = mockRequest(
        {},
        undefined,
        { orderId: 'order-123' },
        { orderNumber: 'TEST1234', phone: '0912345678' }
      );
      const res = mockResponse();

      // 呼叫處理函數
      await getCustomerOrderStatusHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            orderNumber: expect.any(String),
            status: expect.any(String),
            statusText: expect.any(String)
          })
        })
      );
    });

    it('should return 400 if order ID is missing', async () => {
      // 準備請求數據
      const req = mockRequest({}, undefined, {});
      const res = mockResponse();

      // 呼叫處理函數
      await getCustomerOrderStatusHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('訂單ID')
        })
      );
    });

    it('should return 400 if anonymous user is missing order number or phone', async () => {
      // 準備請求數據
      const req = mockRequest(
        {},
        undefined,
        { orderId: 'order-123' },
        { /* 缺少orderNumber和phone */ }
      );
      const res = mockResponse();

      // 呼叫處理函數
      await getCustomerOrderStatusHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('訂單號和電話號碼')
        })
      );
    });

    it('should return 404 if order not found for anonymous user', async () => {
      // 模擬訂單查詢結果為空
      jest.spyOn(admin.firestore(), 'collection').mockImplementationOnce(() => ({
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: true,
          docs: []
        })
      } as any));

      // 準備請求數據
      const req = mockRequest(
        {},
        undefined,
        { orderId: 'nonexistent-order' },
        { orderNumber: 'NONEXIST', phone: '0912345678' }
      );
      const res = mockResponse();

      // 呼叫處理函數
      await getCustomerOrderStatusHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('未找到匹配的訂單')
        })
      );
    });

    it('should return 403 if authenticated user tries to access another user\'s order', async () => {
      // 模擬訂單屬於不同用戶
      const req = mockRequest(
        {},
        {
          uid: 'user-456',
          customerId: 'customer-456' // 不同於訂單的customerId
        },
        { orderId: 'order-123' }
      );
      const res = mockResponse();

      // 呼叫處理函數
      await getCustomerOrderStatusHandler(req, res);

      // 驗證結果
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('無權訪問')
        })
      );
    });
  });
}); 