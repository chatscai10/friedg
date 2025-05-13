// 在任何其他導入前，我們先 mock firebase-admin
const mockAdmin = require('./firebase-admin.mock');
const sinon = require('sinon');
const { expect } = require('chai');
const axios = require('axios');

// 使用 proxyquire 來替換 auth.handlers.js 中的 firebase-admin 引用
const proxyquire = require('proxyquire').noCallThru();
const handlersPath = '../src/auth/auth.handlers';

const authHandlers = proxyquire(handlersPath, {
  'firebase-admin': mockAdmin.admin,
  'axios': axios
});

describe('Auth Handlers - signUp', function() {
  // 增加測試超時時間
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    // 重置所有的 mock
    mockAdmin.reset();
    
    // 設置請求和響應物件的 mock
    req = {
      body: {
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
        phoneNumber: '+886912345678'
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置成功的 createUser 響應
    mockAdmin.authMock.createUser.resolves({
      uid: 'test-uid-123',
      email: 'test@example.com',
      displayName: 'Test User',
      emailVerified: false,
      phoneNumber: '+886912345678',
      disabled: false,
      metadata: {
        creationTime: '2023-05-01T10:00:00.000Z'
      }
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should create a new user and return 201 status with user data', async () => {
    await authHandlers.signUp(req, res);

    // 確認 createUser 被調用且參數正確
    expect(mockAdmin.authMock.createUser.calledOnce).to.be.true;
    expect(mockAdmin.authMock.createUser.firstCall.args[0]).to.deep.equal({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
      disabled: false,
      phoneNumber: '+886912345678'
    });

    // 檢查響應狀態和數據
    expect(res.status.calledWith(201)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.have.property('user');
    expect(responseData.user).to.have.property('uid', 'test-uid-123');
    expect(responseData.user).to.have.property('email', 'test@example.com');
    expect(responseData.user).to.have.property('displayName', 'Test User');
    expect(responseData).to.have.property('idToken');
    expect(responseData).to.have.property('refreshToken');
  });

  it('should return 400 when required fields are missing', async () => {
    req.body = { email: 'test@example.com' }; // 缺少密碼和顯示名稱
    
    await authHandlers.signUp(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('required');
  });

  it('should return 400 when email format is invalid', async () => {
    req.body.email = 'invalid-email';
    
    await authHandlers.signUp(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('Invalid email');
  });

  it('should return 400 when password is too short', async () => {
    req.body.password = '12345'; // 少於6個字符
    
    await authHandlers.signUp(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('must be at least 6 characters');
  });

  it('should return 409 when email already exists', async () => {
    const error = new Error('Email already exists');
    error.code = 'auth/email-already-exists';
    mockAdmin.authMock.createUser.rejects(error);
    
    await authHandlers.signUp(req, res);
    
    expect(res.status.calledWith(409)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('already in use');
  });

  it('should return 500 for other errors', async () => {
    const error = new Error('Something went wrong');
    mockAdmin.authMock.createUser.rejects(error);
    
    await authHandlers.signUp(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('Failed to sign up');
  });
});

describe('Auth Handlers - signIn', function() {
  // 增加測試超時時間
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    // 重置所有的 mock
    mockAdmin.reset();
    
    // 設置請求和響應物件的 mock
    req = {
      body: {
        email: 'test@example.com',
        password: 'password123'
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置成功的 getUserByEmail 響應
    mockAdmin.authMock.getUserByEmail.resolves({
      uid: 'test-uid-123',
      email: 'test@example.com',
      displayName: 'Test User',
      emailVerified: false,
      phoneNumber: '+886912345678',
      disabled: false,
      metadata: {
        creationTime: '2023-05-01T10:00:00.000Z'
      }
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should authenticate user and return 200 status with user data and tokens', async () => {
    await authHandlers.signIn(req, res);

    // 確認 getUserByEmail 被調用且參數正確
    expect(mockAdmin.authMock.getUserByEmail.calledOnce).to.be.true;
    expect(mockAdmin.authMock.getUserByEmail.firstCall.args[0]).to.equal('test@example.com');

    // 檢查響應狀態和數據
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.have.property('user');
    expect(responseData.user).to.have.property('uid', 'test-uid-123');
    expect(responseData.user).to.have.property('email', 'test@example.com');
    expect(responseData.user).to.have.property('displayName', 'Test User');
    expect(responseData).to.have.property('idToken');
    expect(responseData).to.have.property('refreshToken');
    expect(responseData).to.have.property('expiresIn');
  });

  it('should return 400 when required fields are missing', async () => {
    req.body = { email: 'test@example.com' }; // 缺少密碼
    
    await authHandlers.signIn(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('required');
  });

  it('should return 400 when email format is invalid', async () => {
    req.body.email = 'invalid-email';
    
    await authHandlers.signIn(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('Invalid email');
  });

  it('should return 401 when user is not found', async () => {
    const error = new Error('User not found');
    error.code = 'auth/user-not-found';
    mockAdmin.authMock.getUserByEmail.rejects(error);
    
    await authHandlers.signIn(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('Invalid email or password');
  });

  it('should return 403 when user account is disabled', async () => {
    mockAdmin.authMock.getUserByEmail.resolves({
      uid: 'test-uid-123',
      email: 'test@example.com',
      displayName: 'Test User',
      emailVerified: false,
      disabled: true, // 帳戶被禁用
      metadata: {
        creationTime: '2023-05-01T10:00:00.000Z'
      }
    });
    
    await authHandlers.signIn(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('disabled');
  });

  it('should return 500 for other errors', async () => {
    const error = new Error('Something went wrong');
    mockAdmin.authMock.getUserByEmail.rejects(error);
    
    await authHandlers.signIn(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include('Failed to sign in');
  });
});

describe("Auth Handlers - signOut", function() {
  // 增加測試超時時間
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    // 重置所有的 mock
    mockAdmin.reset();
    
    // 設置請求和響應物件的 mock
    req = {
      headers: {
        authorization: "Bearer valid-token-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置成功的 verifyIdToken 響應
    mockAdmin.authMock.verifyIdToken.resolves({
      uid: "test-uid-123",
      email: "test@example.com"
    });

    // 設置成功的 revokeRefreshTokens 響應
    mockAdmin.authMock.revokeRefreshTokens.resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should successfully sign out user and return 200 status with success true", async () => {
    await authHandlers.signOut(req, res);

    // 確認 verifyIdToken 被調用且參數正確
    expect(mockAdmin.authMock.verifyIdToken.calledOnce).to.be.true;
    expect(mockAdmin.authMock.verifyIdToken.firstCall.args[0]).to.equal("valid-token-123");

    // 確認 revokeRefreshTokens 被調用且參數正確
    expect(mockAdmin.authMock.revokeRefreshTokens.calledOnce).to.be.true;
    expect(mockAdmin.authMock.revokeRefreshTokens.firstCall.args[0]).to.equal("test-uid-123");

    // 檢查響應狀態和數據
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0]).to.deep.equal({ success: true });
  });

  it("should return 401 when no authorization header is provided", async () => {
    req.headers = {}; // 移除 authorization 頭
    
    await authHandlers.signOut(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Authentication required");
  });

  it("should return 401 when authorization header doesn't start with Bearer", async () => {
    req.headers.authorization = "InvalidFormat token-123";
    
    await authHandlers.signOut(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Authentication required");
  });

  it("should return 401 when token is empty", async () => {
    req.headers.authorization = "Bearer ";
    
    await authHandlers.signOut(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Invalid token format");
  });

  it("should return 401 when token is expired", async () => {
    const error = new Error("Token expired");
    error.code = "auth/id-token-expired";
    mockAdmin.authMock.verifyIdToken.rejects(error);
    
    await authHandlers.signOut(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("expired");
  });

  it("should return 401 when token is invalid", async () => {
    const error = new Error("Invalid token");
    error.code = "auth/invalid-id-token";
    mockAdmin.authMock.verifyIdToken.rejects(error);
    
    await authHandlers.signOut(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Invalid token");
  });

  it("should return 500 for other unexpected errors", async () => {
    const error = new Error("Something went wrong");
    mockAdmin.authMock.verifyIdToken.rejects(error);
    
    await authHandlers.signOut(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Failed to sign out");
  });
});

describe("Auth Handlers - refreshToken", function() {
  // 增加測試超時時間
  this.timeout(5000);
  
  let req, res, axiosPostStub;

  beforeEach(() => {
    // 重置所有的 mock
    mockAdmin.reset();
    
    // 設置請求和響應物件的 mock
    req = {
      body: {
        refreshToken: "valid-refresh-token-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 模擬 axios.post 的回應
    axiosPostStub = sinon.stub(axios, 'post');
    axiosPostStub.resolves({
      data: {
        id_token: "new-id-token-456",
        refresh_token: "new-refresh-token-789",
        expires_in: "3600"
      }
    });

    // 設置環境變量
    process.env.FIREBASE_API_KEY = "test-api-key";
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.FIREBASE_API_KEY;
  });

  it("should successfully refresh token and return new tokens", async () => {
    await authHandlers.refreshToken(req, res);

    // 確認 axios.post 被調用且參數正確
    expect(axiosPostStub.calledOnce).to.be.true;
    const [url, data] = axiosPostStub.firstCall.args;
    expect(url).to.include("https://securetoken.googleapis.com/v1/token");
    expect(url).to.include("key=test-api-key");
    expect(data).to.deep.equal({
      grant_type: "refresh_token",
      refresh_token: "valid-refresh-token-123"
    });

    // 檢查響應狀態和數據
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0]).to.deep.equal({
      idToken: "new-id-token-456",
      refreshToken: "new-refresh-token-789",
      expiresIn: "3600"
    });
  });

  it("should return 400 when refresh token is missing", async () => {
    req.body = {}; // 移除 refreshToken
    
    await authHandlers.refreshToken(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("required");
  });

  it("should return 401 when refresh token is expired or invalid", async () => {
    // 設置 axios 返回錯誤
    axiosPostStub.rejects({
      response: {
        data: {
          error: {
            message: "TOKEN_EXPIRED"
          }
        }
      }
    });
    
    await authHandlers.refreshToken(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("expired or invalid");
  });

  it("should return 403 when user account is disabled", async () => {
    // 設置 axios 返回錯誤
    axiosPostStub.rejects({
      response: {
        data: {
          error: {
            message: "USER_DISABLED"
          }
        }
      }
    });
    
    await authHandlers.refreshToken(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("disabled");
  });

  it("should return 401 when user not found", async () => {
    // 設置 axios 返回錯誤
    axiosPostStub.rejects({
      response: {
        data: {
          error: {
            message: "USER_NOT_FOUND"
          }
        }
      }
    });
    
    await authHandlers.refreshToken(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("not found");
  });

  it("should return 500 for network or other unexpected errors", async () => {
    // 設置 axios 返回網絡錯誤
    axiosPostStub.rejects(new Error("Network Error"));
    
    await authHandlers.refreshToken(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Failed to refresh");
  });
});

describe("Auth Handlers - resetPassword", function() {
  // 增加測試超時時間
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    // 重置所有的 mock
    mockAdmin.reset();
    
    // 設置請求和響應物件的 mock
    req = {
      body: {
        email: "test@example.com"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置成功的 getUserByEmail 響應
    mockAdmin.authMock.getUserByEmail.resolves({
      uid: "test-uid-123",
      email: "test@example.com"
    });

    // 設置成功的 generatePasswordResetLink 響應
    mockAdmin.authMock.generatePasswordResetLink.resolves("https://example.com/reset-password-link");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should return 200 status when email is valid and user exists", async () => {
    await authHandlers.resetPassword(req, res);
    
    // 驗證 auth.getUserByEmail 被調用
    sinon.assert.calledWith(mockAdmin.authMock.getUserByEmail, "test@example.com");
    
    // 驗證 auth.generatePasswordResetLink 被調用
    sinon.assert.calledWith(mockAdmin.authMock.generatePasswordResetLink, "test@example.com", sinon.match.object);
    
    // 驗證響應
    sinon.assert.calledWith(res.status, 200);
    sinon.assert.calledWith(res.send, sinon.match({
      success: true,
      message: sinon.match.string
    }));
  });

  it("should return 400 status when email is missing", async () => {
    req.body = {}; // 空的請求體
    
    await authHandlers.resetPassword(req, res);
    
    // 驗證響應
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledWith(res.send, sinon.match({
      message: "Email is required."
    }));
  });

  it("should return 400 status when email format is invalid", async () => {
    req.body.email = "invalid-email";
    
    await authHandlers.resetPassword(req, res);
    
    // 驗證響應
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledWith(res.send, sinon.match({
      message: "Invalid email format."
    }));
  });

  it("should return 200 status even when user does not exist (for security)", async () => {
    // 模擬用戶不存在的情況
    mockAdmin.authMock.getUserByEmail.rejects({ code: "auth/user-not-found" });
    
    await authHandlers.resetPassword(req, res);
    
    // 驗證 auth.getUserByEmail 被調用
    sinon.assert.calledWith(mockAdmin.authMock.getUserByEmail, "test@example.com");
    
    // 驗證響應 - 即使用戶不存在，也應該返回成功以避免洩露用戶是否存在的信息
    sinon.assert.calledWith(res.status, 200);
    sinon.assert.calledWith(res.send, sinon.match({
      success: true,
      message: sinon.match.string
    }));
  });

  it("should handle errors from generatePasswordResetLink", async () => {
    // 模擬生成重設連結時的錯誤
    mockAdmin.authMock.generatePasswordResetLink.rejects(new Error("Failed to generate reset link"));
    
    await authHandlers.resetPassword(req, res);
    
    // 驗證響應
    sinon.assert.calledWith(res.status, 500);
    sinon.assert.calledWith(res.send, sinon.match({
      message: "Failed to send password reset email."
    }));
  });

  it("should handle auth/invalid-email error", async () => {
    // 模擬 auth/invalid-email 錯誤
    mockAdmin.authMock.getUserByEmail.rejects({ code: "auth/invalid-email" });
    
    await authHandlers.resetPassword(req, res);
    
    // 驗證響應
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledWith(res.send, sinon.match({
      message: "The email address is not valid."
    }));
  });
});

describe("Auth Handlers - verifyEmail", function() {
  // 增加測試超時時間
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    // 重置所有的 mock
    mockAdmin.reset();
    
    // 設置請求和響應物件的 mock
    req = {
      headers: {
        authorization: "Bearer valid-token-123"
      },
      body: {
        redirectUrl: "https://example.com/after-verification"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置成功的 verifyIdToken 響應
    mockAdmin.authMock.verifyIdToken.resolves({
      uid: "test-uid-123",
      email: "test@example.com"
    });

    // 設置成功的 getUser 響應
    mockAdmin.authMock.getUser.resolves({
      uid: "test-uid-123",
      email: "test@example.com",
      emailVerified: false,
      displayName: "Test User"
    });

    // 設置成功的 generateEmailVerificationLink 響應
    mockAdmin.authMock.generateEmailVerificationLink.resolves("https://example.com/verify-email?oobCode=code123");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should successfully send verification email and return 200 status", async () => {
    await authHandlers.verifyEmail(req, res);

    // 驗證 verifyIdToken 被調用且參數正確
    sinon.assert.calledWith(mockAdmin.authMock.verifyIdToken, "valid-token-123");
    
    // 驗證 getUser 被調用且參數正確
    sinon.assert.calledWith(mockAdmin.authMock.getUser, "test-uid-123");
    
    // 驗證 generateEmailVerificationLink 被調用且參數正確
    sinon.assert.calledWith(
      mockAdmin.authMock.generateEmailVerificationLink, 
      "test@example.com", 
      sinon.match({
        url: "https://example.com/after-verification",
        handleCodeInApp: true
      })
    );
    
    // 驗證響應
    sinon.assert.calledWith(res.status, 200);
    sinon.assert.calledWith(res.send, sinon.match({
      success: true,
      message: sinon.match.string
    }));
  });

  it("should use default redirect URL when none is provided", async () => {
    // 移除請求中的 redirectUrl
    delete req.body.redirectUrl;
    
    // 設置環境變量
    const originalEnv = process.env.EMAIL_VERIFICATION_REDIRECT_URL;
    process.env.EMAIL_VERIFICATION_REDIRECT_URL = "https://custom-default.com/verified";
    
    await authHandlers.verifyEmail(req, res);
    
    // 驗證 generateEmailVerificationLink 使用了默認 URL
    sinon.assert.calledWith(
      mockAdmin.authMock.generateEmailVerificationLink, 
      "test@example.com", 
      sinon.match({
        url: "https://custom-default.com/verified",
        handleCodeInApp: true
      })
    );
    
    // 恢復環境變量
    process.env.EMAIL_VERIFICATION_REDIRECT_URL = originalEnv;
  });

  it("should return 400 when email is already verified", async () => {
    // 模擬郵件已驗證的用戶
    mockAdmin.authMock.getUser.resolves({
      uid: "test-uid-123",
      email: "test@example.com",
      emailVerified: true,
      displayName: "Test User"
    });
    
    await authHandlers.verifyEmail(req, res);
    
    // 驗證響應
    sinon.assert.calledWith(res.status, 400);
    sinon.assert.calledWith(res.send, sinon.match({
      message: "Email is already verified."
    }));
  });

  it("should return 401 when no authorization header is provided", async () => {
    req.headers = {}; // 移除 authorization 頭
    
    await authHandlers.verifyEmail(req, res);
    
    sinon.assert.calledWith(res.status, 401);
    sinon.assert.calledWith(res.send, sinon.match({
      message: sinon.match(/authentication required/i)
    }));
  });

  it("should return 401 when authorization header doesn't start with Bearer", async () => {
    req.headers.authorization = "Basic invalid-format";
    
    await authHandlers.verifyEmail(req, res);
    
    sinon.assert.calledWith(res.status, 401);
    sinon.assert.calledWith(res.send, sinon.match({
      message: sinon.match(/authentication required/i)
    }));
  });

  it("should return 401 when token is empty", async () => {
    req.headers.authorization = "Bearer ";
    
    await authHandlers.verifyEmail(req, res);
    
    sinon.assert.calledWith(res.status, 401);
    sinon.assert.calledWith(res.send, sinon.match({
      message: "Invalid token format."
    }));
  });

  it("should return 401 when token is expired", async () => {
    // 模擬 token 過期錯誤
    const error = new Error("Token expired");
    error.code = "auth/id-token-expired";
    mockAdmin.authMock.verifyIdToken.rejects(error);
    
    await authHandlers.verifyEmail(req, res);
    
    sinon.assert.calledWith(res.status, 401);
    sinon.assert.calledWith(res.send, sinon.match({
      message: sinon.match(/expired/i)
    }));
  });

  it("should return 401 when user is not found", async () => {
    // 模擬用戶不存在錯誤
    const error = new Error("User not found");
    error.code = "auth/user-not-found";
    mockAdmin.authMock.getUser.rejects(error);
    
    await authHandlers.verifyEmail(req, res);
    
    sinon.assert.calledWith(res.status, 401);
    sinon.assert.calledWith(res.send, sinon.match({
      message: "User not found."
    }));
  });

  it("should return 429 when too many requests error occurs", async () => {
    // 模擬請求過多錯誤
    const error = new Error("Too many requests");
    error.code = "auth/too-many-requests";
    mockAdmin.authMock.generateEmailVerificationLink.rejects(error);
    
    await authHandlers.verifyEmail(req, res);
    
    sinon.assert.calledWith(res.status, 429);
    sinon.assert.calledWith(res.send, sinon.match({
      message: sinon.match(/too many requests/i)
    }));
  });

  it("should return 500 for other unexpected errors", async () => {
    // 模擬其他未知錯誤
    mockAdmin.authMock.generateEmailVerificationLink.rejects(new Error("Unknown error"));
    
    await authHandlers.verifyEmail(req, res);
    
    sinon.assert.calledWith(res.status, 500);
    sinon.assert.calledWith(res.send, sinon.match({
      message: "Failed to send verification email.",
      error: "Unknown error"
    }));
  });
}); 