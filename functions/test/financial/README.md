# 金融模組測試指南

## 概述

金融模組包含關鍵的財務計算功能，如月度利潤計算和未彌補虧損更新。為確保這些功能的正確性，我們提供了兩種測試方式：

1. **使用 Firebase Emulator 的整合測試**：`*.test.ts`
2. **直接測試（不依賴外部系統）**：`*.direct.test.ts`

## 測試前準備

### 環境要求

- Node.js v14+
- 已安裝 Firebase CLI (`npm install -g firebase-tools`)
- Firebase CLI 已登入 (`firebase login`)

### 啟動 Firebase Emulator

在運行測試前，需要先啟動 Firebase Firestore Emulator：

```bash
# 在項目根目錄執行
firebase emulators:start --only firestore
```

## 運行測試

### 方法 1：使用 npm 腳本

在 `functions` 目錄中執行以下命令：

```bash
npm run test:emulator
```

這將自動設置 `FIRESTORE_EMULATOR_HOST` 環境變數並執行所有金融模組測試。

### 方法 2：手動設置環境變數

#### Windows (PowerShell)：

```powershell
$env:FIRESTORE_EMULATOR_HOST="localhost:9283"; npx jest test/financial/
```

#### Windows (CMD)：

```cmd
set FIRESTORE_EMULATOR_HOST=localhost:9283 && npx jest test/financial/
```

#### Linux/Mac：

```bash
export FIRESTORE_EMULATOR_HOST=localhost:9283 && npx jest test/financial/
```

## 測試文件說明

### 標準測試 (`*.test.ts`)

這些測試使用 Firebase Emulator 作為持久層，測試核心業務邏輯以及與 Firestore 的整合。例如：

- `profitCalculation.test.ts`：測試月度利潤計算
- `lossTracking.test.ts`：測試未彌補虧損更新

### 直接測試 (`*.direct.test.ts`) 

這些測試不依賴 Firebase 或任何外部系統，直接測試核心業務邏輯。這些測試可以在沒有 Emulator 的情況下運行：

```bash
npx jest test/financial/*.direct.test.ts
```

## 故障排除

如果測試未能正確連接到 Emulator，請檢查：

1. Emulator 是否正在運行（應看到 `✔ All emulators ready!` 訊息）
2. Emulator 端口是否與測試中使用的端口匹配
3. 環境變數 `FIRESTORE_EMULATOR_HOST` 是否正確設置 