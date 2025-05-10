const sinon = require('sinon');

// 創建一個對象來模擬 Firestore 的行為
const firestoreMock = {
  collection: sinon.stub(),
  doc: sinon.stub(),
  where: sinon.stub(),
  orderBy: sinon.stub(),
  limit: sinon.stub(),
  offset: sinon.stub(),
  get: sinon.stub(),
  set: sinon.stub(),
  add: sinon.stub(),
  update: sinon.stub(),
  delete: sinon.stub(),
  startAfter: sinon.stub()
};

// 模擬文檔快照
const docSnapshotMock = {
  exists: true,
  id: 'test-doc-id',
  data: sinon.stub(),
  ref: {
    set: sinon.stub(),
    update: sinon.stub(),
    delete: sinon.stub()
  }
};

// 模擬查詢快照
const querySnapshotMock = {
  docs: [],
  empty: false,
  size: 0,
  forEach: sinon.stub()
};

// 模擬 FieldValue
const fieldValueMock = {
  serverTimestamp: () => 'server-timestamp',
  increment: (n) => `increment-${n}`,
  arrayUnion: (...items) => `array-union-${items.join(',')}`,
  arrayRemove: (...items) => `array-remove-${items.join(',')}`
};

// 創建 admin 模擬
const admin = {
  initializeApp: sinon.stub(),
  firestore: sinon.stub().returns(firestoreMock),
  credential: {
    applicationDefault: sinon.stub()
  },
  apps: []
};

// 將 FieldValue 添加到 firestore 對象
admin.firestore.FieldValue = fieldValueMock;

// 構建模擬鏈
firestoreMock.collection.returns(firestoreMock);
firestoreMock.doc.returns(docSnapshotMock.ref);
firestoreMock.where.returns(firestoreMock);
firestoreMock.orderBy.returns(firestoreMock);
firestoreMock.limit.returns(firestoreMock);
firestoreMock.offset.returns(firestoreMock);
firestoreMock.startAfter.returns(firestoreMock);
firestoreMock.get.resolves(querySnapshotMock);

module.exports = {
  admin,
  firestoreMock,
  docSnapshotMock,
  querySnapshotMock,
  fieldValueMock,
  // 重置所有的 stub
  reset: () => {
    sinon.resetHistory();
    querySnapshotMock.docs = [];
    querySnapshotMock.empty = false;
    querySnapshotMock.size = 0;
    docSnapshotMock.exists = true;
    docSnapshotMock.data.returns({});
  }
}; 