import * as sinon from 'sinon';

class MockTimestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now() {
    return new MockTimestamp(Math.floor(Date.now() / 1000), 0);
  }

  static fromDate(date: Date) {
    return new MockTimestamp(Math.floor(date.getTime() / 1000), 0);
  }

  toDate() {
    return new Date(this.seconds * 1000);
  }
}

const firestoreMock = {
  collection: sinon.stub().returnsThis(),
  doc: sinon.stub().returnsThis(),
  where: sinon.stub().returnsThis(),
  orderBy: sinon.stub().returnsThis(),
  limit: sinon.stub().returnsThis(),
  get: sinon.stub().resolves({
    empty: true,
    docs: [],
    size: 0,
  }),
  set: sinon.stub().resolves(),
  update: sinon.stub().resolves(),
  delete: sinon.stub().resolves(),
  add: sinon.stub().resolves({ id: 'mock-id' }),
  batch: sinon.stub().returns({
    set: sinon.stub(),
    update: sinon.stub(),
    delete: sinon.stub(),
    commit: sinon.stub().resolves(),
  }),
  runTransaction: sinon.stub().callsFake(async (callback) => {
    const transaction = {
      get: sinon.stub().resolves({
        exists: false,
        data: () => null
      }),
      set: sinon.stub(),
      update: sinon.stub(),
      delete: sinon.stub(),
    };
    return await callback(transaction);
  }),
  FieldValue: {
    serverTimestamp: () => new MockTimestamp(Math.floor(Date.now() / 1000), 0),
    increment: (num: number) => num,
    arrayUnion: (...elements: any[]) => elements,
    arrayRemove: (...elements: any[]) => [],
  },
  Timestamp: MockTimestamp
};

export const admin = {
  initializeApp: sinon.stub().returns({}),
  credential: {
    applicationDefault: sinon.stub(),
    cert: sinon.stub()
  },
  firestore: sinon.stub().returns(firestoreMock),
  auth: sinon.stub().returns({
    createUser: sinon.stub(),
    updateUser: sinon.stub(),
    getUserByEmail: sinon.stub(),
    verifyIdToken: sinon.stub(),
  }),
  apps: [{ name: 'mock-app' }]
};

export const createCollectionRef = (documents = {}) => {
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
  };
};

export function reset() {
  sinon.resetHistory();
} 