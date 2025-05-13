import { Request, Response } from 'express';
import { z } from 'zod';
import { validateRequest, validateBody, createMockValidator } from '../validation.middleware';

describe('Validation Middleware Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('validateRequest', () => {
    it('should validate body, params, and query successfully', () => {
      const bodySchema = z.object({ name: z.string() });
      const paramsSchema = z.object({ id: z.string() });
      const querySchema = z.object({ filter: z.string() });

      req.body = { name: 'Test User' };
      req.params = { id: '123' };
      req.query = { filter: 'active' };

      const middleware = validateRequest({
        body: bodySchema,
        params: paramsSchema,
        query: querySchema
      });

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when body validation fails', () => {
      const bodySchema = z.object({ name: z.string() });
      req.body = { name: 123 }; // 類型錯誤

      const middleware = validateRequest({ body: bodySchema });
      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: '請求資料驗證失敗'
      }));
    });
  });

  describe('validateBody', () => {
    it('should validate body successfully', () => {
      const schema = z.object({ email: z.string().email() });
      req.body = { email: 'test@example.com' };

      const middleware = validateBody(schema);
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when validation fails', () => {
      const schema = z.object({ email: z.string().email() });
      req.body = { email: 'invalid-email' }; // 無效的郵箱格式

      const middleware = validateBody(schema);
      middleware(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createMockValidator', () => {
    it('should always call next without validation', () => {
      req.body = { invalidField: true }; // 無效資料

      const middleware = createMockValidator();
      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
}); 