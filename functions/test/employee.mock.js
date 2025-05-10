const sinon = require("sinon");

// 創建一個對象來模擬 Firestore 的行為
const firestoreMock = {
  collection: sinon.stub(),
};

// 創建 admin 模擬
const admin = {
  initializeApp: sinon.stub(),
  firestore: sinon.stub().returns(firestoreMock),
  credential: {
    applicationDefault: sinon.stub(),
  },
  apps: [],
};

// 模擬 FieldValue
const fieldValueMock = {
  serverTimestamp: () => "server-timestamp",
  increment: (n) => `increment-${n}`,
  arrayUnion: (...items) => `array-union-${items.join(",")}`,
  arrayRemove: (...items) => `array-remove-${items.join(",")}`,
};

// 模擬 Timestamp
const timestampMock = {
  now: () => ({
    toDate: () => new Date(),
  }),
  fromDate: (date) => ({
    toDate: () => date,
  }),
};

// 將 FieldValue 添加到 firestore 對象
admin.firestore.FieldValue = fieldValueMock;
admin.firestore.Timestamp = timestampMock;

// 創建文檔引用的工廠函數
const createDocRef = (id, data = {}, exists = true) => {
  // 創建文檔快照
  const docSnap = {
    exists,
    id,
    ref: { id },
    data: () => exists ? { ...data, id } : null,
  };

  // 創建文檔引用
  const docRef = {
    id,
    get: sinon.stub().resolves(docSnap),
    set: sinon.stub().resolves(),
    update: sinon.stub().resolves(),
    delete: sinon.stub().resolves(),
    docSnap, // 添加直接引用，方便測試
  };

  // 為方法添加 rejects 函數 - 使用比較直接的方式
  const originalGet = docRef.get;
  docRef.get.rejects = function(error) {
    originalGet.restore && originalGet.restore();
    docRef.get = sinon.stub().rejects(error);
    return docRef;
  };

  const originalSet = docRef.set;
  docRef.set.rejects = function(error) {
    originalSet.restore && originalSet.restore();
    docRef.set = sinon.stub().rejects(error);
    return docRef;
  };

  const originalUpdate = docRef.update;
  docRef.update.rejects = function(error) {
    originalUpdate.restore && originalUpdate.restore();
    docRef.update = sinon.stub().rejects(error);
    return docRef;
  };

  const originalDelete = docRef.delete;
  docRef.delete.rejects = function(error) {
    originalDelete.restore && originalDelete.restore();
    docRef.delete = sinon.stub().rejects(error);
    return docRef;
  };

  return docRef;
};

// 創建查詢快照的工廠函數
const createQuerySnapshot = (docs = []) => {
  // 確保 docs 是一個數組
  let docsArray;
  
  if (Array.isArray(docs)) {
    docsArray = docs;
  } else if (typeof docs === "object" && docs !== null) {
    docsArray = Object.entries(docs).map(([id, data]) => ({ id, ...data }));
  } else {
    docsArray = [];
  }
  
  return {
    empty: docsArray.length === 0,
    size: docsArray.length,
    docs: docsArray.map((doc) => ({
      exists: true,
      id: doc.id || `doc-${Math.random().toString(36).substring(7)}`,
      data: () => doc,
      ref: {
        id: doc.id || `doc-${Math.random().toString(36).substring(7)}`,
      },
    })),
  };
};

// 創建查詢引用的工廠函數
const createQueryRef = (docs = []) => {
  const querySnapshot = createQuerySnapshot(docs);
  const getStub = sinon.stub().resolves(querySnapshot);
  
  return {
    get: getStub,
    where: sinon.stub().returnsThis(),
    orderBy: sinon.stub().returnsThis(),
    limit: sinon.stub().returnsThis(),
    offset: sinon.stub().returnsThis(),
    startAfter: sinon.stub().returnsThis(),
  };
};

// 創建集合引用的工廠函數
const createCollectionRef = (documents = {}) => {
  const docs = { ...documents };
  
  // 創建集合查詢方法的 stub
  const whereStub = sinon.stub();
  const orderByStub = sinon.stub();
  const limitStub = sinon.stub();
  const offsetStub = sinon.stub();
  const countStub = sinon.stub();
  const getStub = sinon.stub();
  const addStub = sinon.stub();
  
  // 文檔快照數組
  const docSnapshots = Object.entries(docs).map(([id, data]) => {
    const docRef = createDocRef(id, data, true);
    return docRef.docSnap;
  });
  
  // 默認的查詢結果
  const querySnapshot = {
    empty: docSnapshots.length === 0,
    size: docSnapshots.length,
    docs: docSnapshots,
    forEach: (callback) => docSnapshots.forEach(callback),
  };
  
  // 設置默認行為
  getStub.resolves(querySnapshot);
  addStub.callsFake((data) => {
    const id = data.id || `doc_${Object.keys(docs).length + 1}`;
    const newDoc = { ...data, id };
    docs[id] = newDoc;
    const docRef = createDocRef(id, newDoc, true);
    return Promise.resolve(docRef);
  });
  
  // 創建集合引用
  const collectionRef = {
    where: whereStub,
    orderBy: orderByStub,
    limit: limitStub,
    offset: offsetStub,
    count: countStub,
    get: getStub,
    add: addStub,
    doc: (id) => {
      // 如果文檔存在於集合中，則使用那些數據
      if (docs[id]) {
        return createDocRef(id, docs[id], true);
      }
      // 否則創建一個空文檔引用，但確保其 exists 屬性為 false
      return createDocRef(id, {}, false);
    },
  };
  
  // 為查詢方法設置鏈式調用
  whereStub.returns(collectionRef);
  orderByStub.returns(collectionRef);
  limitStub.returns(collectionRef);
  offsetStub.returns(collectionRef);
  
  // 為 count 設置默認行為
  countStub.returns({
    get: sinon.stub().resolves({ data: () => ({ count: docSnapshots.length }) }),
  });
  
  return collectionRef;
};

// 設置 collection 方法的行為
firestoreMock.collection.callsFake((path) => {
  return createCollectionRef({});
});

// 批量寫入模擬
const createBatch = () => {
  return {
    set: sinon.stub(),
    update: sinon.stub(),
    delete: sinon.stub(),
    commit: sinon.stub().resolves(),
  };
};

admin.firestore.batch = sinon.stub().returns(createBatch());

// 事務模擬
const createTransaction = () => {
  return {
    set: sinon.stub(),
    update: sinon.stub(),
    delete: sinon.stub(),
    get: sinon.stub().callsFake((docRef) => {
      return docRef.get();
    }),
  };
};

admin.firestore.runTransaction = sinon.stub().callsFake(async (callback) => {
  const transaction = createTransaction();
  return callback(transaction);
});

// 重置所有 stub 的歷史記錄
const reset = () => {
  sinon.resetHistory();
  firestoreMock.collection.resetHistory();
  
  // 默認情況下 collection 返回空集合
  firestoreMock.collection.callsFake((path) => {
    return createCollectionRef({});
  });
};

// 初始化時立即重置
reset();

module.exports = {
  admin,
  firestoreMock,
  createDocRef,
  createQuerySnapshot,
  createQueryRef,
  createCollectionRef,
  createBatch,
  createTransaction,
  reset,
};
