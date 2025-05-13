import { Response, NextFunction } from 'express';
import { validateRoles } from '../rbac';
import { AuthenticatedRequest } from '../auth';
import { createMockUser } from '../../../test/utils/mock-generator';

describe('RBAC 中間件測試', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      user: createMockUser({ role: 'staff' })
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('應允許具有正確角色的用戶繼續', () => {
    const middleware = validateRoles(['admin', 'staff']);
    middleware(req as AuthenticatedRequest, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('應拒絕未授權角色的用戶', () => {
    const middleware = validateRoles(['admin', 'manager']);
    middleware(req as AuthenticatedRequest, res as Response, next);
    
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PERMISSION_DENIED'
    }));
  });

  it('應拒絕未認證的用戶', () => {
    req.user = undefined;
    const middleware = validateRoles(['admin']);
    middleware(req as AuthenticatedRequest, res as Response, next);
    
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'UNAUTHENTICATED'
    }));
  });

  it('應處理角色權限錯誤', () => {
    // 只有 role 屬性，但無其他必要資訊
    req.user = { role: 'staff' } as any;
    
    const middleware = validateRoles(['admin']);
    middleware(req as AuthenticatedRequest, res as Response, next);
    
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PERMISSION_DENIED'
    }));
  });
}); 