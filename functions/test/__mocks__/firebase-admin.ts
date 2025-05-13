/**
 * Firebase Admin 模擬文件
 * 為測試提供一致的 Firebase Admin 模擬
 */

// 模擬 Firestore 數據庫
const mockFirestore = {
  collection: jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: jest.fn().mockReturnValue({}),
        id: 'mock-doc-id'
      }),
      set: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true)
    }),
    where: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [],
          forEach: jest.fn()
        })
      }),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [],
        forEach: jest.fn()
      })
    }),
    add: jest.fn().mockResolvedValue({ id: 'mock-doc-id' }),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      empty: false,
      docs: [],
      forEach: jest.fn()
    })
  })
};

// 模擬 FieldValue
const mockFieldValue = {
  serverTimestamp: jest.fn().mockReturnValue('mock-timestamp'),
  increment: jest.fn().mockImplementation(val => `increment(${val})`),
  arrayUnion: jest.fn().mockImplementation((...vals) => `arrayUnion(${vals.join(',')})`),
  arrayRemove: jest.fn().mockImplementation((...vals) => `arrayRemove(${vals.join(',')})`)
};

// 模擬 Auth
const mockAuth = {
  createCustomToken: jest.fn().mockResolvedValue('mock-custom-token'),
  verifyIdToken: jest.fn().mockResolvedValue({
    uid: 'mock-user-id',
    email: 'mock@example.com',
    tenantId: 'mock-tenant-id',
    storeId: 'mock-store-id',
    role: 'staff',
    roleLevel: 5
  }),
  setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
  getUser: jest.fn().mockResolvedValue({
    uid: 'mock-user-id',
    email: 'mock@example.com',
    displayName: 'Mock User',
    photoURL: 'https://example.com/photo.jpg',
    customClaims: {
      tenantId: 'mock-tenant-id',
      storeId: 'mock-store-id',
      role: 'staff',
      roleLevel: 5
    }
  }),
  createUser: jest.fn().mockResolvedValue({
    uid: 'new-mock-user-id'
  }),
  updateUser: jest.fn().mockResolvedValue({
    uid: 'mock-user-id'
  }),
  listUsers: jest.fn().mockResolvedValue({
    users: [],
    pageToken: null
  })
};

// 模擬 Storage
const mockStorage = {
  bucket: jest.fn().mockReturnValue({
    file: jest.fn().mockReturnValue({
      getSignedUrl: jest.fn().mockResolvedValue(['https://storage.example.com/mock-file']),
      download: jest.fn().mockResolvedValue(['mock-file-content']),
      save: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(true)
    }),
    upload: jest.fn().mockResolvedValue([{ name: 'mock-file' }])
  })
};

// 創建帶有正確類型層次結構的 Firebase Admin 模擬
const mockAdmin = {
  // 使用先前的模擬對象
  initializeApp: jest.fn().mockReturnValue({}),
  credential: {
    cert: jest.fn().mockReturnValue({})
  },
  // 創建可調用函數和屬性存在於同一對象的模擬
  firestore: Object.assign(
    jest.fn().mockReturnValue(mockFirestore),
    { FieldValue: mockFieldValue }
  ),
  auth: jest.fn().mockReturnValue(mockAuth),
  storage: jest.fn().mockReturnValue(mockStorage),
  // 模擬其他可能用到的服務
  messaging: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue('message-id')
  })
};

// 導出模擬對象
module.exports = mockAdmin; 