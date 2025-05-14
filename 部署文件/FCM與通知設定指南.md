# Firebase Cloud Messaging (FCM) 與通知設定指南

本文檔旨在引導開發者完成在「吃雞排找不早」POS系統中集成和配置 Firebase Cloud Messaging (FCM) 以實現推送通知功能的步驟。

## 1. Firebase Console 設定

1.  **啟用 Cloud Messaging API**:
    *   前往您的 Firebase 專案控制台。
    *   在左側導航欄中，找到「專案設定」(Project settings)，點擊進入。
    *   切換到「Cloud Messaging」分頁。
    *   如果尚未啟用，請啟用 Cloud Messaging API (通常默認啟用)。

2.  **生成 Web Push Certificates (VAPID 密鑰對)**:
    *   在「Cloud Messaging」分頁中，向下滾動到「Web 設定」(Web configuration) 部分。
    *   找到「Web Push 憑證」(Web Push certificates) 卡片。
    *   如果列表中沒有密鑰對，點擊「產生金鑰組」(Generate key pair) 按鈕。
    *   生成後，您會看到一個「金鑰組」字串，這就是您的 VAPID **公鑰**。複製此公鑰，後續將在顧客 PWA 配置中使用。
        *   **注意**: 私鑰由 Firebase 管理，您不需要直接操作它。

## 2. Cloud Functions 後端設定 (`functions` 目錄)

Cloud Functions 用於在特定事件 (如訂單狀態變更) 發生時，向用戶設備發送 FCM 通知。

*   **文件**: `functions/src/notifications/notifications.v2.ts`
*   **核心邏輯 (`onOrderStatusUpdate` 觸發器)**:
    1.  監聽 Firestore 中 `orders/{orderId}` 文檔的寫入事件。
    2.  當訂單狀態 (`status`) 發生變化且存在 `customerId` 時觸發通知邏輯。
    3.  從 Firestore 的 `users/{customerId}` 文檔中讀取該用戶的 FCM 註冊令牌 (存儲在 `fcmTokens` 數組字段中)。
    4.  構建通知負載 (`payload`)，包括:
        *   `notification.title`: 通知標題 (e.g., "您的訂單狀態已更新！")。
        *   `notification.body`: 通知內容 (e.g., "您的訂單 #xxxxxx 狀態已變更為: [狀態文本]")。
            *   **【重要】**: 確保 `notifications.v2.ts` 中生成狀態文本的邏輯 (例如 `orderStatusToString` 函數) 與 PWA 中顯示訂單狀態的文本 (例如 `getOrderStatusText` 函數) 保持一致，以提供統一的用戶體驗。
        *   `data.orderId`: 相關的訂單 ID。
        *   `data.newStatus`: 最新的訂單狀態。
        *   `data.clickPath`: 用於指導 PWA 在點擊通知後應導航到的內部路徑 (e.g., `/order/ORDER_ID`)。
    5.  使用 `admin.messaging().sendToDevice(tokens, payload)` 將通知發送給目標設備。
    6.  處理發送響應，特別是檢測無效或未註冊的 token (`messaging/invalid-registration-token`, `messaging/registration-token-not-registered`)，並從用戶的 `fcmTokens` 數組中移除這些無效 token。

*   **依賴與初始化**:
    *   確保 `firebase-admin` SDK 已在 `functions/src/index.ts` 中正確初始化 (`admin.initializeApp()`)。
    *   `onOrderStatusUpdate` 函數需要從 `functions/src/index.ts` 中導出才能部署。

## 3. 顧客 PWA 前端設定 (`ceg-customer-pwa` 目錄)

顧客 PWA 需要集成 Firebase SDK 以接收和處理 FCM 通知。

### 3.1. Firebase Service Worker (`public/firebase-messaging-sw.js`)

此 Service Worker 文件用於處理當 PWA 在背景或關閉時接收到的推送通知。

*   **引入 Firebase SDK**: 使用 `importScripts` 導入 Firebase app 和 messaging (compat 版本)。
*   **Firebase 初始化**: 
    *   複製您的 Firebase 專案配置對象 (從 Firebase Console > 專案設定 > 一般 > 您的應用程式 > SDK 設定和配置)。
    *   **【重要】將佔位符 (`YOUR_API_KEY`, `YOUR_MESSAGING_SENDER_ID` 等) 替換為您的真實配置。強烈建議將這些值存儲在環境變量中，並在構建 PWA 時注入，而不是直接硬編碼在 `firebase-messaging-sw.js` 中。如果您的構建流程不支持此操作，請確保手動更新此文件中的值。**
        *   示例環境變數名 (在 PWA 中，通常以 `REACT_APP_` 或 `VITE_` 開頭，取決於您的工具鏈):
            *   `REACT_APP_FIREBASE_API_KEY` / `VITE_FIREBASE_API_KEY`
            *   `REACT_APP_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_AUTH_DOMAIN`
            *   ...
    *   調用 `firebase.initializeApp(firebaseConfig);`
*   **背景消息處理 (`messaging.onBackgroundMessage`)**: 
    *   當收到背景通知時，此回調會被觸發。
    *   從 `payload` 中提取通知標題和內容，使用 `self.registration.showNotification()` 顯示系統級通知。
*   **通知點擊處理 (`self.addEventListener('notificationclick', ...)`):**
    *   當用戶點擊系統通知時觸發。
    *   從 `event.notification.data` 中獲取 `clickPath` 或 `orderId`。
    *   優先使用 `clickPath` 作為目標 URL。
    *   如果 `clickPath` 不存在但 `orderId` 存在，則構建一個默認的訂單相關路徑 (e.g., `/order/ORDER_ID?fromNotification=true`)。
    *   使用 `clients.matchAll()` 查找已打開的 PWA 窗口，如果找到則嘗試導航到目標 URL 並聚焦；否則，使用 `clients.openWindow()` 打開新窗口到目標 URL。

### 3.2. Firebase 初始化與 Messaging 配置 (`src/config/firebase.ts`)

此文件負責初始化 Firebase app 和其他服務，包括 Messaging。

*   **導入**: 導入 `initializeApp`, `getMessaging`, `onMessage`, `getToken` (建議重命名為 `getFcmToken`) 等。
*   **Firebase 初始化 (`firebaseConfig`)**:
    *   **【重要】再次確認此處的 Firebase 配置對象中的佔位符已替換為真實值。強烈建議將這些值通過環境變量注入。**
        *   請參考 `firebase-messaging-sw.js` 部分關於環境變數的說明。
*   **服務初始化**: `const messaging = getMessaging(app);`
*   **`getAndRegisterFcmToken(userId: string)` 函數**: 
    1.  請求用戶的通知權限: `Notification.requestPermission()`。
    2.  如果權限被授予，調用 `getFcmToken(messaging, { vapidKey: "YOUR_VAPID_KEY_FROM_ENV" })` 獲取 FCM token。
        *   **【重要】將 `YOUR_VAPID_KEY_FROM_ENV` 替換為從環境變量讀取的 VAPID 公鑰。強烈建議將此 VAPID 公鑰存儲在環境變量中 (例如 `REACT_APP_FIREBASE_VAPID_KEY` 或 `VITE_FIREBASE_VAPID_KEY`)，並從環境變量讀取，而不是硬編碼。**
        *   請確保已在 Firebase Console > 專案設定 > Cloud Messaging > Web Push 憑證 中生成金鑰組。
    3.  如果成功獲取 token，將其保存到該用戶在 Firestore 的文檔中 (`users/{userId}` 下的 `fcmTokens` 數組字段，使用 `arrayUnion` 避免重複)。
*   **導出**: 導出 `messaging`, `onMessage` (用於前台消息處理) 和 `getAndRegisterFcmToken`。

### 3.3. AuthContext 集成 (`src/contexts/AuthContext.tsx`)

在用戶認證狀態變化時，自動註冊或更新 FCM token。

*   導入 `getAndRegisterFcmToken` 從 `firebase.ts`。
*   在 `onAuthStateChangedListener` 回調中，當檢測到用戶登入 (`firebaseUser` 存在時)，調用 `await getAndRegisterFcmToken(firebaseUser.uid);`。
*   在 `confirmOtp` 函數成功確認 OTP 並獲取到 `firebaseUser` 後，同樣調用 `await getAndRegisterFcmToken(firebaseUser.uid);`。
*   進行適當的錯誤處理。

### 3.4. 前台消息處理 (`src/App.tsx`)

處理當 PWA 在前台活動時接收到的通知。

*   創建一個 `ForegroundMessageHandler` 組件。
*   在該組件的 `useEffect` hook 中，調用從 `firebase.ts` 導入的 `onMessage(messaging, callback)`。
*   `onMessage` 的回調函數在收到前台消息時觸發。
*   使用 `NotificationContext` (`useNotification`) 的 `addNotification` 方法將通知內容顯示為應用內 UI 通知 (例如 Toast)。

## 4. Firestore 資料結構

*   **用戶 FCM Tokens**: 
    *   路徑: `users/{userId}`
    *   字段: `fcmTokens` (類型: `Array<String>`)
    *   描述: 存儲屬於該用戶的一個或多個 FCM 註冊令牌。

## 5. Firestore 安全規則 (`firestore.rules`)

*   **用戶更新自己的 `fcmTokens`**: 
    *   `match /users/{userId}` 規則中應包含 `allow update: if request.auth.uid == userId;` (或更細化的權限)。這允許已登入用戶通過客戶端 SDK 更新自己的 `fcmTokens` 字段 (例如，使用 `arrayUnion` 添加 token)。
*   **Cloud Functions 權限**: 
    *   Cloud Functions 使用服務帳戶憑證運行，默認情況下可以繞過 Firestore 安全規則，因此它們有權限讀取任何用戶的 `fcmTokens` 以發送通知，並有權限移除無效 token。
    *   在本次通知系統的實現中，未對現有安全規則進行修改，因為現有規則已滿足基本需求。

## 6. 測試推送通知

1.  **確保所有配置正確**: Firebase 專案配置、VAPID 密鑰。
2.  **註冊設備**: 
    *   在顧客 PWA 中登入。
    *   應用程式應請求通知權限。授予權限。
    *   檢查瀏覽器控制台，確認 FCM token 已成功獲取並嘗試保存到 Firestore。
    *   檢查 Firestore `users/{userId}/fcmTokens` 字段是否包含註冊的 token。
3.  **觸發通知 (Cloud Function)**:
    *   手動更改 Firestore 中某個訂單的狀態 (該訂單的 `customerId` 應對應已註冊 FCM token 的用戶)。
    *   觀察 Cloud Function (`onOrderStatusUpdate`) 的日誌，確認其是否被觸發、是否成功獲取 token 並嘗試發送通知。
    *   觀察 `admin.messaging().sendToDevice()` 的日誌輸出 (成功/失敗計數)。
4.  **接收通知 (顧客 PWA)**:
    *   **PWA 在背景/關閉**: 應能收到系統級通知。點擊通知應能按預期打開 PWA 並導航。
    *   **PWA 在前台**: 應能收到應用內通知 (例如 Toast)。
5.  **檢查無效 Token移除**: 
    *   如果可能，模擬一個無效 token，觀察 Cloud Function 是否能正確處理並從 Firestore 中移除。

## 7. 注意事項與最佳實踐

*   **VAPID 密鑰安全**: VAPID 公鑰是公開的，但私鑰必須保密。Firebase 會為您管理私鑰。如果使用其他推送服務，需妥善保管私鑰。
*   **環境變量**: **強烈建議將所有敏感配置信息 (如 Firebase API 密鑰、項目ID、VAPID 公鑰等) 存儲在環境變量中，而不是硬編碼在源代碼中。** 這有助於安全性、配置管理和不同環境（開發、測試、生產）的部署。
*   **Token 管理**: FCM token 可能會過期或失效。後端應定期清理無效 token。
*   **用戶體驗**: 
    *   僅在適當的時候請求通知權限 (例如，在用戶理解為何需要通知之後)。
    *   提供用戶關閉通知的選項。
    *   精心設計通知內容，使其簡潔、有用且及時。
*   **錯誤處理**: 在前端和後端都實現健壯的錯誤處理和日誌記錄。 