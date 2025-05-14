# Firebase Functions Gen 1 到 Gen 2 遷移指南

本文檔提供了將 Firebase Cloud Functions 從 Gen 1 遷移到 Gen 2 的詳細指南。

## 目錄

1. [遷移概述](#遷移概述)
2. [主要變更](#主要變更)
3. [遷移步驟](#遷移步驟)
4. [測試與部署](#測試與部署)
5. [常見問題](#常見問題)
6. [參考資料](#參考資料)

## 遷移概述

Firebase Functions Gen 2 提供了許多改進，包括更好的性能、更低的冷啟動時間、更精細的配置選項以及更好的開發體驗。本遷移指南將幫助您將現有的 Gen 1 函數遷移到 Gen 2。

### 為什麼要遷移？

- **更好的性能**：Gen 2 函數具有更低的冷啟動時間和更高的性能。
- **更精細的配置**：Gen 2 允許您為每個函數單獨配置內存、超時和區域。
- **更好的開發體驗**：Gen 2 提供了更好的類型支持和更清晰的 API。
- **未來支持**：Firebase 將在未來專注於 Gen 2 的開發和改進。

## 主要變更

### 導入方式變更

Gen 1:
```typescript
import * as functions from 'firebase-functions';
```

Gen 2:
```typescript
// HTTP 函數
import { onRequest, onCall } from 'firebase-functions/v2/https';

// Firestore 觸發器
import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted, onDocumentWritten } from 'firebase-functions/v2/firestore';

// 排程函數
import { onSchedule } from 'firebase-functions/v2/scheduler';

// 日誌
import { logger } from 'firebase-functions/v2';
```

### 函數定義變更

Gen 1:
```typescript
// HTTP 函數
export const helloWorld = functions.https.onRequest((req, res) => {
  res.send('Hello World!');
});

// 可調用函數
export const addNumbers = functions.https.onCall((data, context) => {
  return { result: data.a + data.b };
});

// Firestore 觸發器
export const onUserCreate = functions.firestore
  .document('users/{userId}')
  .onCreate((snapshot, context) => {
    // ...
  });

// 排程函數
export const scheduledFunction = functions.pubsub
  .schedule('every 5 minutes')
  .onRun((context) => {
    // ...
  });
```

Gen 2:
```typescript
// HTTP 函數
export const helloWorld = onRequest((req, res) => {
  res.send('Hello World!');
});

// 可調用函數
export const addNumbers = onCall((request) => {
  const { a, b } = request.data;
  return { result: a + b };
});

// Firestore 觸發器
export const onUserCreate = onDocumentCreated({
  document: 'users/{userId}'
}, (event) => {
  // ...
});

// 排程函數
export const scheduledFunction = onSchedule({
  schedule: 'every 5 minutes'
}, (event) => {
  // ...
});
```

### 配置選項變更

Gen 1:
```typescript
export const helloWorld = functions
  .region('asia-east1')
  .runWith({
    memory: '256MB',
    timeoutSeconds: 60
  })
  .https.onRequest((req, res) => {
    res.send('Hello World!');
  });
```

Gen 2:
```typescript
export const helloWorld = onRequest({
  region: 'asia-east1',
  memory: '256MiB',
  timeoutSeconds: 60
}, (req, res) => {
  res.send('Hello World!');
});
```

## 遷移步驟

### 1. 更新依賴

確保您的 `package.json` 文件中的 `firebase-functions` 版本至少為 `5.0.0`：

```json
{
  "dependencies": {
    "firebase-functions": "^5.0.1"
  }
}
```

### 2. 更新 firebase.json

在 `firebase.json` 文件中添加 `runtime` 字段：

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs18"
  }
}
```

### 3. 遷移函數

對於每個函數，按照以下步驟進行遷移：

1. 更新導入語句
2. 更新函數定義
3. 更新配置選項
4. 更新函數參數

### 4. 測試函數

在部署之前，使用 Firebase 模擬器測試您的函數：

```bash
firebase emulators:start
```

### 5. 部署函數

使用以下命令部署您的函數：

```bash
firebase deploy --only functions
```

或者使用我們提供的部署腳本：

```bash
node deploy-gen2.js
```

## 測試與部署

### 本地測試

1. 啟動 Firebase 模擬器：

```bash
firebase emulators:start
```

2. 使用 Postman 或 curl 測試 HTTP 函數
3. 使用 Firebase 控制台測試可調用函數
4. 使用 Firebase 模擬器觸發 Firestore 事件

### 部署

1. 使用部署腳本：

```bash
node deploy-gen2.js
```

2. 或手動部署：

```bash
firebase deploy --only functions
```

## 常見問題

### Q: 我可以混合使用 Gen 1 和 Gen 2 函數嗎？

A: 是的，您可以在同一個項目中混合使用 Gen 1 和 Gen 2 函數。這使您可以逐步遷移您的函數。

### Q: 遷移後，我的函數 URL 會改變嗎？

A: 不會，您的函數 URL 將保持不變。

### Q: Gen 2 函數的定價與 Gen 1 相同嗎？

A: 是的，定價模型相同，但 Gen 2 函數可能由於更低的冷啟動時間而更具成本效益。

### Q: 我需要更新我的客戶端代碼嗎？

A: 不需要，客戶端代碼不需要更改。

## 常見錯誤修復指南

在遷移過程中，您可能會遇到一些常見的 TypeScript 編譯錯誤。以下是一些常見錯誤及其修復方法：

### 1. CallableOptions 類型錯誤

**錯誤信息**：
```
Argument of type '{ memory: string; timeoutSeconds: number; region: string; }' is not assignable to parameter of type 'CallableOptions'.
Types of property 'memory' are incompatible.
Type 'string' is not assignable to type 'ResetValue | Expression<number> | MemoryOption'.
```

**修復方法**：
將 `memory` 參數指定為常量類型：
```typescript
const runtimeOptions = {
  memory: '256MiB' as const,
  timeoutSeconds: 60
};
```

### 2. ResourceType 類型錯誤

**錯誤信息**：
```
Type '"equity"' is not assignable to type 'ResourceType'.
```

**修復方法**：
在 `src/libs/rbac/types.ts` 文件中的 `ResourceType` 類型定義中添加新的資源類型：
```typescript
export type ResourceType =
  'tenants' | 'stores' | 'users' | 'employees' |
  // ... 其他資源類型 ...
  'pickupNumbers' | 'equity' | 'financial';
```

### 3. 模塊導入錯誤

**錯誤信息**：
```
Cannot find module './services' or its corresponding type declarations.
```

**修復方法**：
創建一個 `services/index.ts` 文件，導出所有服務：
```typescript
export { service1, service2 } from './service1';
export { service3, service4 } from './service2';
```

### 4. Express 和 Cors 導入錯誤

**錯誤信息**：
```
This expression is not callable.
Type 'typeof e' has no call signatures.
```

**修復方法**：
將命名空間導入改為默認導入：
```typescript
// 錯誤的導入方式
import * as express from 'express';
import * as cors from 'cors';

// 正確的導入方式
import express from 'express';
import cors from 'cors';
```

### 5. 函數參數錯誤

**錯誤信息**：
```
Expected 2 arguments, but got 1.
```

**修復方法**：
檢查函數定義，確保提供所有必需的參數：
```typescript
// 錯誤的函數調用
await updateUncompensatedLosses(tenantId);

// 正確的函數調用
await updateUncompensatedLosses(tenantId, quarterlyNetProfit);
```

### 檢查編譯錯誤

我們提供了一個腳本來檢查 TypeScript 編譯錯誤：
```bash
node check-errors.js
```

此腳本將顯示所有 TypeScript 編譯錯誤，並按文件分組，以便您可以更輕鬆地修復它們。

## 參考資料

- [Firebase Functions v2 官方文檔](https://firebase.google.com/docs/functions/beta)
- [Firebase Functions v2 API 參考](https://firebase.google.com/docs/reference/functions/v2)
- [Firebase Functions v2 遷移指南](https://firebase.google.com/docs/functions/migrate-to-v2)

---

如有任何問題或需要進一步的幫助，請聯繫我們的技術支持團隊。
