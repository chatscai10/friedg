const sinon = require("sinon");

// 創建一個模擬的 Firestore
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

// 模擬 Firebase Admin SDK
const firestoreMock = createFirestoreMock();
const admin = {
  initializeApp: sinon.stub().returns({}),
  credential: {
    applicationDefault: sinon.stub(),
    cert: sinon.stub(),
  },
  firestore: sinon.stub().returns(firestoreMock),
  storage: sinon.stub(),
  auth: sinon.stub(),
  database: sinon.stub(),
  messaging: sinon.stub(),
};

// 初始化 mock Firebase Admin SDK
admin.initializeApp();

// 導出模擬對象
module.exports = {
  admin,
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
  reset: () => {
    sinon.resetHistory();
    // 重新初始化 Firebase
    admin.initializeApp();
  },
}; 