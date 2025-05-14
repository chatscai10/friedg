# Firebase Custom Claims 使用說明

本文檔記錄了專案中 Firebase Custom Claims 的使用策略。

## 1. Custom Claim 名稱

我們主要使用以下 Custom Claim：

*   `role`: 用於標識用戶在系統中的主要角色。

## 2. `role` Claim 的有效值及其含義

`role` Claim 可以具有以下有效值：

*   `admin`: 管理員。擁有系統最高管理權限，可以管理租戶、用戶、角色、系統設置等。
*   `employee`: 員工。隸屬於特定店鋪，具有操作 POS 系統、管理訂單等權限。
*   `customer`: 顧客。PWA 的使用者，可以瀏覽菜單、下單、查看訂單歷史等。
*   `store_manager`: 店鋪經理。管理特定店鋪的日常運營，包括員工管理、查看店鋪報表等。通常也具有 `employee` 的所有權限。

## 3. 設置 Custom Claims 的後端函數

負責設置用戶 Custom Claims（特別是 `role`）的後端 Cloud Function 主要為：

*   **`setUserRoleV2`**: 一個 HTTPS Callable Function。
    *   **路徑**: `functions/src/admin/userManagement.v2.ts`
    *   **功能**: 接收 `userId` 和 `role` 作為參數，由具有 `admin` 角色的調用者調用，使用 `admin.auth().setCustomUserClaims()` 為目標用戶設置指定的 `role`。

## 4. 依賴 Custom Claims 的後端邏輯

以下後端中間件或核心邏輯依賴 Custom Claims (特別是 `req.user.role`，該值在 `authenticateRequest` 中間件成功驗證 ID Token 後從 token 的 custom claims 中解析得到) 進行權限控制：

*   **`authorizeRoles` 中間件**: 
    *   **路徑**: `functions/src/middleware/auth.middleware.ts`
    *   **功能**: 作為一個中間件工廠函數 `authorizeRoles(...allowedRoles: string[])`，它返回一個 Express 中間件。此中間件檢查經過 `authenticateRequest` 後的 `req.user.role` 是否在 `allowedRoles` 列表中。如果不在，則拒絕訪問 (通常返回 403 Forbidden)。
    *   **應用場景**: 被應用於多個 Cloud Function Express app 的路由上，以限制特定角色才能訪問某些 API 端點。例如，用於保護只有 `admin`才能訪問的用戶管理 API，或只有 `admin` 和 `employee` 才能訪問的 POS 相關 API。

*   **Callable Functions 內部的權限檢查**: 
    *   例如 `setUserRoleV2` 內部會檢查調用者自身的 `customClaims.role` 是否為 `admin`，才允許其執行設置其他用戶角色的操作。

## 5. 注意事項

*   Custom Claims 的更新可能需要用戶重新登入或刷新其 ID Token 才能在客戶端生效。
*   後端始終應依賴通過 `admin.auth().verifyIdToken(true)` (包含檢查撤銷狀態) 或 `authenticateRequest` 中間件驗證和解碼後的 ID Token 中的 Custom Claims，而不是客戶端自行聲明的角色信息。 