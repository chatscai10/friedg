# 測試指南

本文件提供關於如何有效地編寫和運行 POS 系統後端的測試的指南。

## 測試基礎設施

我們最近對測試基礎設施進行了重大改進：

1. **全局測試設置 (`jest.setup.ts`)**：
   - 自動初始化 Firebase Admin SDK
   - 設置測試環境變數
   - 提供一致的測試環境

2. **共享模擬 (`test/__mocks__/firebase-admin.ts`)**：
   - 提供所有測試可重用的 Firebase Admin 模擬
   - 確保模擬行為一致

## 如何使用

### 基本測試示例

```typescript
import { someFunction } from '../src/your-module';

describe('Your Module', () => {
  it('should do something', () => {
    // 測試代碼
    const result = someFunction();
    expect(result).toBe(expectedValue);
  });
});
```

### 使用 Firebase Admin 模擬

Firebase Admin 已在全局自動模擬，但如果需要自定義行為：

```typescript
// 從 __mocks__ 文件中導入模擬
import { firestore, auth } from '../__mocks__/firebase-admin';

// 或者通過 jest.mock 自動使用模擬
jest.mock('firebase-admin');
import * as admin from 'firebase-admin';
```

### 自定義模擬行為

```typescript
// 重置所有模擬
beforeEach(() => {
  jest.clearAllMocks();
});

// 自定義模擬行為
test('should handle specific data', () => {
  // 安排 - 設置模擬行為
  const mockDocData = { name: 'Test Doc' };
  
  // 方法1：使用模擬文件中的函數
  firestore().collection().doc().get.mockResolvedValueOnce({
    exists: true,
    data: () => mockDocData,
    id: 'test-doc-id'
  });
  
  // 方法2：使用 admin 導入
  admin.firestore().collection().doc().get.mockResolvedValueOnce({
    exists: true,
    data: () => mockDocData,
    id: 'test-doc-id'
  });
  
  // 執行操作並斷言結果
  // ...
});
```

## 中間件測試注意事項

由於我們最近將 `withAuthentication` 重命名為 `withExpressAuthentication`，請注意：

1. 在路由中使用 `withExpressAuthentication` 而非 `withAuthentication`
2. 測試中間件時，確保使用正確的函數名稱
3. `withAuthentication` 現在僅用於 Cloud Functions 上下文，而 `withExpressAuthentication` 用於 Express 路由

## 運行測試

```bash
# 運行所有測試
npm test

# 運行特定文件
npm test -- src/auth/line.handlers.test.ts

# 運行帶標籤的測試
npm test -- -t "should validate user"

# 檢視覆蓋率報告
npm test -- --coverage
```

## 測試最佳實踐

1. **使用 `describe` 和 `it` 清晰地組織測試**：
   ```typescript
   describe('UserService', () => {
     describe('createUser', () => {
       it('should create a user with valid data', () => { ... });
       it('should throw error with invalid data', () => { ... });
     });
   });
   ```

2. **測試安排 (AAA 模式)**：
   ```typescript
   // Arrange - 準備測試數據和環境
   const userData = { ... };
   const mockDb = { ... };
   
   // Act - 執行被測試的操作
   const result = await userService.createUser(userData);
   
   // Assert - 驗證操作結果
   expect(result).toHaveProperty('id');
   expect(mockDb.collection).toHaveBeenCalledWith('users');
   ```

3. **避免測試實現細節**：專注於測試公共 API 和行為，而非內部實現細節。

4. **使用 `beforeEach` 和 `afterEach` 進行設置和清理**

5. **隔離測試**：每個測試應該獨立執行，不依賴其他測試的狀態

## 故障排除

如果遇到 "Firebase app does not exist" 錯誤：
1. 確保您的測試未手動調用 `admin.initializeApp()`
2. 在特殊情況下，可使用 `initFirebaseAdminForTesting()` 從 `jest.setup.ts` 手動初始化

如果遇到 "Cannot access X before initialization" 錯誤：
1. 檢查模擬定義是否按正確順序呈現
2. 考慮使用我們的共享模擬 (`__mocks__/firebase-admin.ts`) 