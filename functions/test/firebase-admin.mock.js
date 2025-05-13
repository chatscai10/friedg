const sinon = require('sinon');

// 創建一個對象來模擬 firebase-admin 的行為
const admin = {
  initializeApp: sinon.stub().returns({}),
  credential: {
    applicationDefault: sinon.stub(),
    cert: sinon.stub()
  },
  auth: sinon.stub(),
  firestore: sinon.stub(),
  storage: sinon.stub(),
  database: sinon.stub(),
  messaging: sinon.stub(),
  apps: [{initialized: true}] // 模擬已初始化的應用
};

// 確保默認應用被初始化（避免 "The default Firebase app does not exist" 錯誤）
// 將初始化移到這裡，在其他所有功能之前
admin.initializeApp();

// 創建 Firestore 相關的 mock
function createFirestoreMock() {
  // 模擬 Firestore 集合參考
  const createCollectionRef = (documents = {}) => {
    const docs = Object.entries(documents).map(([id, data]) => ({
      id,
      data: () => ({ id, ...data }),
      exists: true,
      ref: {
        collection: sinon.stub(),
        set: sinon.stub().resolves(),
        update: sinon.stub().resolves(),
      },
    }));

    return {
      doc: sinon.stub().callsFake((id) => {
        const docData = documents[id];
        return {
          id,
          get: sinon.stub().resolves({
            exists: !!docData,
            data: () => docData ? { id, ...docData } : undefined,
            id,
          }),
          set: sinon.stub().resolves(),
          update: sinon.stub().resolves(),
          collection: sinon.stub().returns(createCollectionRef({})),
        };
      }),
      where: sinon.stub().returnsThis(),
      orderBy: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      get: sinon.stub().resolves({
        empty: docs.length === 0,
        docs,
        size: docs.length,
      }),
      add: sinon.stub().callsFake((data) => {
        const id = data.id || `mock-id-${Date.now()}`;
        return Promise.resolve({ id });
      }),
    };
  };

  // 創建 Timestamp 類
  class Timestamp {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }

    static now() {
      return new Timestamp(Math.floor(Date.now() / 1000), 0);
    }

    static fromDate(date) {
      return new Timestamp(Math.floor(date.getTime() / 1000), 0);
    }

    toDate() {
      return new Date(this.seconds * 1000);
    }
  }

  // 主要的 Firestore 模擬對象
  const firestoreMock = {
    collection: sinon.stub().callsFake((name) => createCollectionRef({})),
    batch: () => ({
      set: sinon.stub(),
      update: sinon.stub(),
      delete: sinon.stub(),
      commit: sinon.stub().resolves(),
    }),
    runTransaction: sinon.stub().callsFake(async (callback) => {
      const transaction = {
        get: sinon.stub().callsFake(async (docRef) => {
          return await docRef.get();
        }),
        set: sinon.stub(),
        update: sinon.stub(),
        delete: sinon.stub(),
      };
      return await callback(transaction);
    }),
    FieldValue: {
      serverTimestamp: () => new Timestamp(Math.floor(Date.now() / 1000), 0),
      increment: (num) => num,
      arrayUnion: (...elements) => elements,
      arrayRemove: (...elements) => [],
    },
    Timestamp,
  };

  return firestoreMock;
}

// 創建 auth 相關的 mock
const authMock = {
  createUser: sinon.stub(),
  updateUser: sinon.stub(),
  deleteUser: sinon.stub(),
  getUser: sinon.stub(),
  getUserByEmail: sinon.stub(),
  setCustomUserClaims: sinon.stub(),
  verifyIdToken: sinon.stub(),
  generateEmailVerificationLink: sinon.stub(),
  generatePasswordResetLink: sinon.stub(),
  revokeRefreshTokens: sinon.stub()
};

// 設置 auth() 方法返回 authMock
admin.auth.returns(authMock);

// 創建 Firestore mock 並設置 firestore() 方法
const firestoreMock = createFirestoreMock();
admin.firestore.returns(firestoreMock);

module.exports = {
  admin,
  authMock,
  firestoreMock,
  createCollectionRef: (documents = {}) => {
    return {
      doc: sinon.stub().callsFake((id) => {
        const docData = documents[id] || null;
        return {
          id,
          get: sinon.stub().resolves({
            exists: !!docData,
            data: () => docData ? { id, ...docData } : undefined,
            id,
          }),
          set: sinon.stub().resolves(),
          update: sinon.stub().resolves(),
          collection: sinon.stub().returns({
            doc: sinon.stub().returns({
              get: sinon.stub().resolves({ exists: false, data: () => null }),
              set: sinon.stub().resolves(),
              update: sinon.stub().resolves(),
            }),
          }),
        };
      }),
      where: sinon.stub().returnsThis(),
      orderBy: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      get: sinon.stub().resolves({
        empty: Object.keys(documents).length === 0,
        docs: Object.entries(documents).map(([id, data]) => ({
          id,
          data: () => ({ id, ...data }),
          exists: true,
        })),
        size: Object.keys(documents).length,
      }),
      add: sinon.stub().callsFake((data) => {
        const id = data.id || `mock-id-${Date.now()}`;
        return Promise.resolve({ id });
      }),
    };
  },
  // 重置所有的 stub
  reset: () => {
    sinon.resetHistory();
    // 確保在重置後重新初始化
    admin.initializeApp();
  }
}; 