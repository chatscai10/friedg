import * as functionsTest from 'firebase-functions-test';
import { setUserRoleV2, adminApiV2 } from '../userManagement.v2'; // Updated import
import * as admin from 'firebase-admin';
import * as express from 'express';

// Initialize firebase-functions-test. OFFLINE MODE
const testEnv = functionsTest();

// Mock Firebase Admin SDK
const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mockListUsers = jest.fn();
const mockGetUser = jest.fn();

jest.mock('firebase-admin', () => {
  const originalAdmin = jest.requireActual('firebase-admin'); // Get actual firebase-admin
  return {
    ...originalAdmin, // Spread originalAdmin to keep other functionalities like firestore.FieldValue
    initializeApp: jest.fn(),
    auth: () => ({
      setCustomUserClaims: mockSetCustomUserClaims,
      listUsers: mockListUsers,
      getUser: mockGetUser, // Add mock for getUser if needed by setUserRoleV2 for admin check
    }),
    // firestore: jest.fn().mockReturnValue({ ... }) // Mock firestore if used
  };
});

// Mock the middleware for listUsersApiV2 if they are not tested here directly
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateRequest: jest.fn((req, res, next) => {
    // Simulate authentication: extract 'user' from a custom header or a query param for testing
    if (req.headers.authorization === 'Bearer admin_token') {
      req.user = { uid: 'adminUserId', email: 'admin@example.com', role: 'admin' };
    } else if (req.headers.authorization === 'Bearer non_admin_token') {
      req.user = { uid: 'nonAdminUserId', email: 'user@example.com', role: 'customer' };
    }
    next();
  }),
  authorizeRoles: (...roles) => jest.fn((req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      next();
    } else if (req.user) {
      res.status(403).send({ error: 'Permission denied. Insufficient role.' });
    } else {
      // This case should ideally be caught by authenticateRequest
      res.status(401).send({ error: 'Authentication required.' });
    }
  }),
}));


describe("User Management V2 Cloud Functions", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  afterAll(() => {
    testEnv.cleanup();
  });

  describe("setUserRoleV2 (Callable Function)", () => {
    const wrappedSetUserRole = testEnv.wrap(setUserRoleV2);

    it("should allow an admin to set a valid role for a user", async () => {
      mockGetUser.mockResolvedValueOnce({ uid: 'adminUserId', customClaims: { role: 'admin' } }); // Admin performing action
      const context = { auth: { uid: 'adminUserId', token: { /* no role here, rely on customClaims check */ } } };
      const data = { userId: 'targetUserId', role: 'employee' };
      const result = await wrappedSetUserRole(data, context);
      expect(result.success).toBe(true);
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('targetUserId', { role: 'employee' });
    });

    it("should prevent non-admin users from setting roles", async () => {
      mockGetUser.mockResolvedValueOnce({ uid: 'nonAdminUserId', customClaims: { role: 'customer' } }); // Non-admin
      const context = { auth: { uid: 'nonAdminUserId', token: { /* no role */ } } };
      const data = { userId: 'targetUserId', role: 'employee' };
      await expect(wrappedSetUserRole(data, context)).rejects.toThrow(/Permission denied/);
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });

    it("should reject invalid role strings", async () => {
      mockGetUser.mockResolvedValueOnce({ uid: 'adminUserId', customClaims: { role: 'admin' } });
      const context = { auth: { uid: 'adminUserId', token: { /* no role */ } } };
      const data = { userId: 'targetUserId', role: 'invalid_role_string' };
      await expect(wrappedSetUserRole(data, context)).rejects.toThrow(/Invalid role specified/);
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });

    it("should require authentication for the calling user", async () => {
      const data = { userId: 'targetUserId', role: 'employee' };
      // Test with no auth context
      await expect(wrappedSetUserRole(data, {})).rejects.toThrow(/The function must be called while authenticated/);
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });

    it("should require target userId and role in data", async () => {
      mockGetUser.mockResolvedValueOnce({ uid: 'adminUserId', customClaims: { role: 'admin' } });
      const context = { auth: { uid: 'adminUserId', token: { /* no role */ } } };
      await expect(wrappedSetUserRole({ role: 'employee' } as any, context)).rejects.toThrow(/User ID and role must be provided/);
      await expect(wrappedSetUserRole({ userId: 'targetUserId' } as any, context)).rejects.toThrow(/User ID and role must be provided/);
    });
  });

  describe("listUsersApiV2 (HTTPS Function - Express App)", () => {
    // Use supertest for testing Express apps is a common practice.
    // For simplicity here, we'll mock req/res and call the app directly if it's a simple handler.
    // If adminApiV2 is an Express app, we'd typically do:
    // const request = require('supertest');
    // await request(adminApiV2).get('/?pageToken=testToken&maxResults=5').set('Authorization', 'Bearer admin_token')...

    it("should allow admin to list users and return a list of users", async () => {
      mockListUsers.mockResolvedValueOnce({ users: [{uid: 'user1', email: 'user1@example.com'}], pageToken: undefined });
      
      const req = {
        method: 'GET',
        headers: { authorization: 'Bearer admin_token' },
        query: {}
      } as unknown as express.Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn(), // For error cases from middleware
      } as unknown as express.Response;

      await adminApiV2(req, res); // adminApiV2 is the Express app

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        users: expect.arrayContaining([expect.objectContaining({uid: 'user1'})]),
        nextPageToken: undefined,
      }));
      expect(mockListUsers).toHaveBeenCalledWith(100, undefined); // Default values
    });

    it("should prevent non-admins from listing users", async () => {
      const req = {
        method: 'GET',
        headers: { authorization: 'Bearer non_admin_token' }, // Non-admin token
        query: {}
      } as unknown as express.Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn(), // For error cases from middleware
      } as unknown as express.Response;

      await adminApiV2(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith({ error: 'Permission denied. Insufficient role.' });
      expect(mockListUsers).not.toHaveBeenCalled();
    });

    it("should handle pagination (pageToken and maxResults)", async () => {
      mockListUsers.mockResolvedValueOnce({ users: [], pageToken: 'nextPage' });
      const req = {
        method: 'GET',
        headers: { authorization: 'Bearer admin_token' },
        query: { pageToken: 'testToken', maxResults: '5' }
      } as unknown as express.Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        send: jest.fn(),
      } as unknown as express.Response;
      
      await adminApiV2(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        users: [],
        nextPageToken: 'nextPage',
      }));
      expect(mockListUsers).toHaveBeenCalledWith(5, 'testToken');
    });

    it("should return 400 if maxResults is not a number", async () => {
        const req = {
            method: 'GET',
            headers: { authorization: 'Bearer admin_token' },
            query: { maxResults: 'not-a-number' }
        } as unknown as express.Request;
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn(),
        } as unknown as express.Response;

        await adminApiV2(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: "Invalid maxResults. Must be a number." });
    });
  });
}); 