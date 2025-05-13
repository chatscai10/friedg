# Firebase Functions 調試指南

## 問題摘要

當前系統中的Firebase Functions面臨以下問題：
1. API路由不正確，導致404錯誤
2. TypeScript編譯問題，大量非核心模塊錯誤
3. 區域設置不一致，導致API調用連接問題
4. PowerShell中使用`&&`運算符不被支持

## 解決方案

### 1. 修正index.ts

我們已簡化`index.ts`，只保留核心API功能：
- 統一使用`asia-east1`區域
- 添加了簡單測試端點`/api/test`
- 移除了可能有問題的未定義引用
- 確保路由結構清晰且正確註冊

### 2. PowerShell命令執行

在PowerShell中，**不能**使用`&&`連接命令，應改為：
```powershell
# 錯誤寫法
cd functions && npm run build

# 正確寫法（多行）
cd functions
npm run build
cd ..
```

或使用分號：
```powershell
cd functions; npm run build; cd ..
```

### 3. 編譯及啟動步驟

1. **編譯Firebase Functions:**
   ```powershell
   cd functions
   npm run build
   cd ..
   ```

2. **啟動Firebase模擬器:**
   ```powershell
   firebase emulators:start --only functions
   ```

3. **使用測試腳本:**
   ```powershell
   ./test-firebase-api.ps1
   ```

### 4. API URL結構

Firebase Function URL結構為：
```
http://localhost:5002/[項目ID]/[區域]/[函數名]/[路徑]
```

對於我們的API，完整URL為：
```
http://localhost:5002/friedg/asia-east1/api/[路徑]
```

例如：
- API根路徑: `http://localhost:5002/friedg/asia-east1/api/`
- 健康檢查: `http://localhost:5002/friedg/asia-east1/api/health`
- 測試端點: `http://localhost:5002/friedg/asia-east1/api/test`
- API測試: `http://localhost:5002/friedg/asia-east1/api/api/test`

### 5. 常見錯誤排查

1. **404錯誤**：
   - 檢查URL是否包含正確的項目ID、區域和函數名
   - 確認模擬器啟動時輸出的URL
   
2. **多實例警告**：
   - 使用`taskkill /F /IM node.exe`結束所有Node進程
   - 重啟模擬器

3. **編譯錯誤**：
   - 如果`npm run build`仍有大量錯誤，但希望先測試核心功能：
   ```
   npx tsc src/index.ts --skipLibCheck --outDir lib
   ```

## 後續步驟

1. 成功測試基本API路由後，逐步添加核心模塊（Roles, Users, Stores, Attendance）
2. 為每個模塊添加測試用例
3. 系統性地解決TypeScript編譯問題 