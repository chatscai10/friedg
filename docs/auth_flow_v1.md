# 「吃雞排找不早」POS 與後台管理系統 - 身份驗證流程設計

本文檔定義了系統中三種主要使用者類型（顧客、員工和管理員）的身份驗證流程，以確保安全且一致的登入體驗。

## 1. 顧客登入流程

顧客主要通過 LINE Login 進行身份驗證，以下是詳細流程：

### 流程步驟：

1. **前端初始化 LIFF SDK**：
   - 顧客在 PWA 介面點擊「LINE 登入」按鈕
   - 前端初始化 LIFF SDK (`liff.init()`)
   - 調用 `liff.login()` 啟動 LINE 授權流程

2. **LINE 授權與回調**：
   - 顧客在 LINE 環境中授權應用程序
   - LINE 將用戶重定向回應用 (LIFF Callback URL)
   - 前端獲取 LINE `accessToken` 和 `idToken`

3. **交換 Firebase Custom Token**：
   - 前端將 LINE `accessToken` 和 `idToken` 發送至後端 API
   ```
   POST /api/auth/line
   {
     "accessToken": "LINE的accessToken",
     "idToken": "LINE的idToken"
   }
   ```
   - 後端 Cloud Function：
     - 驗證 LINE Token 的有效性
     - 檢查用戶是否已存在於 `customers` 集合
     - 若不存在，在 `customers` 集合中建立新用戶記錄（提取基本資料如 displayName 等）
     - 生成 Firebase Custom Token
     - 返回 Custom Token 給前端

4. **Firebase 身份驗證**：
   - 前端使用 Custom Token 調用 `firebase.auth().signInWithCustomToken(token)`
   - Firebase SDK 驗證 Token 並建立會話
   - 顧客成功登入，可以訪問其權限範圍內的資源

### 安全考量：

- LINE Login 需設定適當的 Scope 權限 (profile, openid)
- 使用 HTTPS 確保 Token 交換過程安全
- 後端必須驗證 LINE Token 的有效性
- 使用 `tenantId` 過濾確保數據隔離
- 會話過期設定合理時間，避免永久有效令牌

## 2. 員工登入流程

員工同樣使用 LINE Login 進行身份驗證，但有額外的身份驗證和審核步驟：

### 2.1 首次登入流程：

1. **預備階段（管理員操作）**：
   - 租戶管理員需先在後台系統中創建員工基本資料
   - 系統生成員工唯一邀請碼或邀請連結

2. **員工接收邀請**：
   - 員工通過 LINE 或其他方式接收邀請連結
   - 點擊連結訪問員工 PWA 的註冊/綁定頁面

3. **LINE 綁定授權**：
   - 員工 PWA 初始化 LIFF SDK
   - 調用 `liff.login()` 進行 LINE 授權
   - 獲取 LINE `accessToken` 和 `idToken`

4. **綁定請求與審核**：
   - 前端將 LINE Token、邀請碼和基本信息發送至後端 API
   ```
   POST /api/auth/employee-binding
   {
     "accessToken": "LINE的accessToken",
     "idToken": "LINE的idToken",
     "inviteCode": "INVITE_CODE_123"
   }
   ```
   - 後端 Cloud Function：
     - 驗證 LINE Token 和邀請碼有效性
     - 在 `employees` 集合中找到對應的員工記錄
     - 更新員工記錄，綁定 LINE UID
     - 若設置為需要審核，創建審核記錄並通知管理員
     - 或直接啟用帳號並返回狀態

5. **審核流程（如需）**：
   - 管理員在後台看到待審核的 LINE 綁定請求
   - 確認員工身份後批准綁定
   - 系統啟用帳號，允許正常登入

### 2.2 日常登入流程：

1. **LINE 授權**：
   - 員工在 PWA 介面點擊「LINE 登入」按鈕
   - 同顧客流程，獲取 LINE `accessToken` 和 `idToken`

2. **交換 Firebase Custom Token**：
   - 前端將 Token 發送到特定的員工登入 API
   ```
   POST /api/auth/employee-login
   {
     "lineAccessToken": "LINE的accessToken",
     "idToken": "LINE的idToken"
   }
   ```
   - 後端 Cloud Function：
     - 驗證 LINE Token 的有效性
     - 使用 LINE UID 在 `employees` 集合中查找對應記錄
     - 驗證員工狀態是否為「啟用」
     - 讀取員工的 `role`、`tenantId` 和 `assignedStores` 信息
     - 生成包含這些信息（作為 claims）的 Firebase Custom Token
     - 返回 Custom Token 給前端

3. **Firebase 身份驗證與分店選擇**：
   - 前端完成 Firebase 身份驗證
   - 如果員工被分配到多個分店，顯示分店選擇界面
   - 員工選擇工作分店後，系統載入該分店的配置和數據

### 安全考量：

- 邀請碼應有過期時間和使用次數限制
- 員工登入需檢查帳號狀態（是否啟用）
- 權限控制需在前端與後端雙重實施
- 審計日誌記錄關鍵操作（如登入、綁定、權限更改）

## 3. 管理員登入流程

系統中有兩種主要的管理員類型：租戶管理員和超級管理員（Super Admin）。

### 3.1 租戶管理員登入流程：

租戶管理員基本上遵循與員工相同的登入流程，但具有更高權限。他們在 `employees` 集合中的 `role` 設定為管理員級別。

具體登入流程與員工的「日常登入流程」相同，在 Firebase Custom Token 中包含其管理員角色信息。

### 3.2 超級管理員（Super Admin）首次登入流程：

超級管理員的首次創建需要特殊處理，以下是可能的方案（根據文檔推測，需進一步釐清）：

1. **初始設置方案**：
   - 在系統部署時，通過 Firebase Admin SDK 或部署腳本直接在 Firebase Authentication 中創建初始超級管理員帳號（可能使用電子郵件/密碼方式）
   - 同時在特定的 `superadmins` 集合或 `employees` 集合中創建對應記錄
   - 將初始登入信息安全地傳達給指定的超級管理員

2. **登入與密碼重置**：
   - 超級管理員使用提供的電子郵件/密碼登入專用的超級管理後台
   - 系統強制首次登入後更改密碼
   - 可選配置雙因素驗證 (MFA)

3. **日常登入**：
   - 使用電子郵件/密碼（可能加 MFA）登入超級管理後台
   - 後端驗證身份並授予相應權限

### 釐清點：

關於超級管理員的首次創建與登入，文檔中未有明確描述。以上方案是基於常見實踐和文檔中關於權限分級的片段推測。需要進一步釐清：

1. 超級管理員是否也使用 LINE Login，還是採用獨立的身份驗證方式？
2. 首個超級管理員帳號的創建方式是什麼？
3. 是否需要專門的超級管理員註冊流程？

## 流程圖示（文字版）

### 顧客登入流程：
```
顧客 → LINE授權 → 獲取Token → 後端驗證 → 創建/更新顧客記錄 → Firebase認證 → 登入成功
```

### 員工首次登入流程：
```
管理員創建員工基本資料 → 生成邀請碼 → 員工接收邀請 → LINE授權 → 
綁定請求 → [審核流程] → 啟用帳號 → Firebase認證 → 登入成功
```

### 員工日常登入流程：
```
員工 → LINE授權 → 獲取Token → 後端驗證+查詢權限 → Firebase認證(含角色) → 
[多分店選擇] → 載入分店配置 → 登入成功
``` 