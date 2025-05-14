# TypeScript 編譯錯誤修復計劃

## 概述

本文檔提供了一個分階段的計劃，用於修復項目中的 TypeScript 編譯錯誤。目前有 695 個錯誤分佈在 148 個文件中。

## 修復優先級

按照以下優先級順序修復錯誤：

1. **關鍵模塊導入錯誤**：這些錯誤會阻止其他代碼的編譯
2. **類型錯誤**：特別是那些影響核心功能的錯誤
3. **API 使用錯誤**：函數調用參數不正確
4. **未使用的變量**：這些錯誤通常不會影響功能，但會影響代碼質量

## 分批修復計劃

### 批次 1：修復關鍵模塊導入錯誤

1. 修復 `src/middleware` 目錄中的錯誤，因為許多其他模塊依賴於它
   - 特別是 `auth.middleware.ts` 和 `tenant.middleware.ts`

2. 修復 `src/libs/rbac` 目錄中的錯誤，因為許多權限相關功能依賴於它

3. 修復 `src/firebase.ts` 相關的導入錯誤

### 批次 2：修復類型錯誤

1. 修復 `src/attendance` 目錄中的類型錯誤
   - 特別是 `AttendanceLog` 類型相關的錯誤

2. 修復 `src/stores` 目錄中的類型錯誤
   - 特別是 `Store` 類型相關的錯誤

3. 修復 `src/users` 目錄中的類型錯誤
   - 特別是 `UserProfile` 類型相關的錯誤

### 批次 3：修復 API 使用錯誤

1. 修復 `src/equity/schedule.handlers.ts` 中的 `onSchedule` 相關錯誤

2. 修復 `src/stores/stores.service.ts` 中的 `hasPermission` 相關錯誤

3. 修復 `src/users/user.handlers.ts` 中的 `updateUserStatus` 相關錯誤

### 批次 4：修復未使用的變量

使用自動化腳本 `scripts/fix-common-errors.js` 來移除未使用的導入和變量。

### 批次 5：修復可能的未定義值

使用自動化腳本 `scripts/fix-common-errors.js` 來添加可能的未定義值檢查。

## 自動化工具

我們已經創建了兩個自動化腳本來幫助修復錯誤：

1. `scripts/fix-encoding.js`：用於檢測和修復編碼問題
2. `scripts/fix-common-errors.js`：用於修復常見的 TypeScript 錯誤

## 測試策略

每修復一個批次的錯誤後，運行以下命令來檢查進度：

```bash
npm run build
```

如果編譯仍然失敗，檢查錯誤日誌並相應地調整修復計劃。

## 完成標準

當 `npm run build` 命令成功執行，沒有任何錯誤時，修復工作就完成了。

## 注意事項

- 修復過程中可能會發現新的錯誤，需要相應地調整修復計劃
- 某些錯誤可能需要更深入的代碼理解，可能需要與開發團隊協商
- 在修復錯誤的同時，盡量不要改變代碼的功能行為
