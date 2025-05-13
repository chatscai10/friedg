# 吃雞排找不早 - Firebase Functions API

本目錄包含Firebase Functions後端API代碼，提供POS系統的核心功能。

## 核心API模塊

- **角色管理** (`/roles`): 管理系統角色和權限
- **用戶管理** (`/users`): 用戶帳戶和個人資料管理
- **店鋪管理** (`/stores`): 店鋪資訊、位置、營業時間管理
- **考勤管理** (`/attendance`): 員工打卡和出勤記錄

## 環境設置

### 安裝依賴

```bash
npm install
```

### 編譯TypeScript

```bash
npm run build
```

### 啟動Firebase模擬器

```bash
npm run serve
```

## API路由

所有API路由已統一使用 `/api/v1/` 前綴，例如：

- 角色管理: `/api/v1/roles`
- 用戶管理: `/api/v1/users`
- 用戶資料: `/api/v1/profile`
- 店鋪管理: `/api/v1/stores`
- 考勤管理: `/api/v1/attendance`

## API測試

我們提供了自動化測試腳本來驗證API路由是否正確工作。

### 運行測試

使用以下命令執行API測試：

```bash
npm run test:api
```

或直接運行批處理文件：

```
test-api.bat
```

測試將確認所有核心API路由能正確回應請求。

## 部署

快速構建和部署：

```bash
npm run quick-deploy
```

標準部署流程：

```bash
npm run build
firebase deploy --only functions
```

## 注意事項

- API統一使用`asia-east1`區域以減少台灣地區的延遲
- 所有路由遵循RESTful API設計規範
- 使用Firebase Emulator進行本地開發和測試 