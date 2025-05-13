import { Request, Response, NextFunction } from 'express';
import { validateResourceAccess } from '../resource';

describe('資源訪問中間件測試', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('應接受包含資源 ID 的請求 (params)', () => {
    req.params = { id: 'resource-123' };
    
    const middleware = validateResourceAccess('test');
    middleware(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('應接受包含資源 ID 的請求 (query)', () => {
    req.query = { id: 'resource-123' };
    
    const middleware = validateResourceAccess('test');
    middleware(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('應接受包含資源 ID 的請求 (body)', () => {
    req.body = { id: 'resource-123' };
    
    const middleware = validateResourceAccess('test');
    middleware(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('應拒絕缺少資源 ID 的請求', () => {
    const middleware = validateResourceAccess('test');
    middleware(req as Request, res as Response, next);
    
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('test資源ID')
    }));
  });
}); 