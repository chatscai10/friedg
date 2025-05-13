# Cursor自動同步GitHub設置指南

## 安裝擴展方法
1. 在Cursor中按`Ctrl+Shift+X`打開擴展面板
2. 搜索並安裝"GitDoc"擴展 (或類似自動提交擴展)
3. 重新啟動Cursor

## 配置GitDoc（推薦方法）
1. 按`Ctrl+,`打開設置
2. 搜索"GitDoc"
3. 設置以下選項：
   - 勾選"Autosave"啟用自動保存
   - 設置"Commit Interval"為您希望的間隔時間（如60000為1分鐘）
   - 勾選"Auto Push"啟用自動推送

## 使用自動推送腳本
也可使用專案根目錄中的`auto-push.ps1`腳本：
```powershell
# 手動執行
.\auto-push.ps1

# 或通過任務計劃程式設置定期執行
```

## 注意事項
- 確保已正確設置GitHub憑證
- 建議在非共享分支上使用自動提交功能
- 定期檢查提交歷史確保無意外操作 

# 吃雞排找不早 POS 系統

這是一個基於 Firebase 的多租戶 SaaS 餐飲管理系統。

## 專案結構

- `web-admin`: 租戶後台管理系統 (基於 React)
- `functions`: Firebase Cloud Functions (Node.js 後端)
- `public`: 前端公共資源
- `firestore.rules`: Firestore 安全規則
- `firestore.indexes.json`: Firestore 索引配置

## 環境設置

### 前置需求

- Node.js 20 LTS
- Firebase CLI (`npm install -g firebase-tools`)
- Git

### Firebase 專案設定

1. 安裝 Firebase CLI:
```bash
npm install -g firebase-tools
```

2. 登入 Firebase:
```bash
firebase login
```

3. 選擇專案:
```bash
firebase use friedg
```

4. 初始化模擬器:
```bash
firebase init emulators
```

### 環境變數配置

複製環境變數模板並進行設定:

```bash
cd web-admin
cp env-template.txt .env.development
```

編輯 `.env.development` 並設定正確的 Firebase 專案資訊。

### 初始化系統資料

1. 從 Firebase 主控台下載服務帳號金鑰並放在專案根目錄，命名為 `serviceAccountKey.json`

2. 執行初始化腳本:
```bash
node setup_firebase_init.js
```

這將設定系統所需的基本資料，包括:
- 超級管理員帳號
- 基本角色
- 系統設定
- 示範租戶與分店

## 本地開發

### 啟動模擬器環境

```bash
firebase emulators:start
```

這將啟動以下服務:
- Auth (端口: 7099)
- Firestore (端口: 8090)
- Functions (端口: 5002)
- UI (端口: 6001)

### 啟動前端開發伺服器

```bash
cd web-admin
npm run dev
```

前端伺服器會在 http://localhost:5173 運行。

## 部署

### 部署到 Firebase

```bash
firebase deploy
```

或者分別部署各個部分:

```bash
firebase deploy --only hosting  # 部署前端
firebase deploy --only functions  # 部署後端
firebase deploy --only firestore:rules  # 部署安全規則
firebase deploy --only firestore:indexes  # 部署索引
```

## 單元測試

```bash
cd functions
npm test
```

## 文件

更多詳細資訊請參考整合專案報告。 