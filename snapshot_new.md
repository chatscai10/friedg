# Project Snapshot

## Directory Structure

```
├── .firebaserc
├── .gitignore
├── api-specs
│  ├── attendance.yaml
│  ├── auth.yaml
│  ├── employees.yaml
│  ├── inventory.yaml
│  ├── leave.yaml
│  ├── main.yaml
│  ├── menu.yaml
│  ├── openapi.yaml
│  ├── orders.yaml
│  ├── payments.yaml
│  ├── payroll.yaml
│  ├── pickup.yaml
│  ├── pos.yaml
│  ├── roles.yaml
│  ├── scheduling.yaml
│  ├── stores.yaml
│  └── users.yaml
├── api_server.cjs
├── api_server.js
├── cloudbuild.yaml
├── config.json
├── couponTemplates.json
├── create-admin-user.js
├── docs
│  ├── auth_flow_v1.md
│  └── data_dictionary_v1.md
├── firebase-export-1746210189572DASsYd
│  └── firestore_export
│     └── all_namespaces
│        └── all_kinds
├── firebase-export-1746211287188S4pPQ3
│  ├── auth_export
│  │  ├── accounts.json
│  │  └── config.json
│  ├── firebase-export-metadata.json
│  └── firestore_export
│     ├── all_namespaces
│     │  └── all_kinds
│     └── firestore_export.overall_export_metadata
├── firebase-export-1746211654071QtVfqL
│  ├── auth_export
│  │  ├── accounts.json
│  │  └── config.json
│  ├── firebase-export-metadata.json
│  └── firestore_export
│     └── firestore_export.overall_export_metadata
├── firebase-startup.log
├── firebase.json
├── firebase.json.bak
├── firebase.json.new
├── firestore-debug.log
├── firestore.indexes.json
├── firestore.rules
├── functions  // Firebase Cloud Functions (TypeScript)
│  ├── .eslintrc.js
│  ├── .gitignore
│  ├── .nyc_output
│  ├── .prettierrc.js
│  ├── babel.config.js
│  ├── coverage
│  ├── firestore-debug.log
│  ├── index.js  // Default entry point, may need review depending on build/deploy
│  ├── jest.config.js
│  ├── package-lock.json
│  ├── package.json
│  ├── src // TypeScript source files for Cloud Functions
│  │  ├── admin
│  │  ├── ads
│  │  ├── api
│  │  ├── attendance
│  │  ├── auth
│  │  ├── communication
│  │  ├── coupons
│  │  ├── crm
│  │  ├── discovery
│  │  ├── employees
│  │  ├── equity
│  │  ├── feedback
│  │  ├── financial
│  │  ├── inventory
│  │  ├── leave
│  │  ├── libs
│  │  ├── loyalty
│  │  ├── members
│  │  ├── menus
│  │  ├── middleware
│  │  ├── notifications
│  │  ├── orders
│  │  ├── payments
│  │  ├── payroll
│  │  ├── performance
│  │  ├── pickup
│  │  ├── pos
│  │  ├── printing
│  │  ├── referrals
│  │  ├── roles
│  │  ├── scheduling
│  │  ├── scripts
│  │  ├── services
│  │  ├── stores
│  │  ├── superadmin
│  │  ├── types
│  │  └── utils
│  ├── tsconfig.json
│  └── webpack.config.js // Example, actual bundler config may vary
├── ceg-customer-pwa // Customer Facing PWA (React, TypeScript, Vite)
│  ├── public
│  ├── src
│  ├── index.html
│  ├── package.json
│  ├── tsconfig.json
│  ├── vite.config.ts
│  └── ... (other configuration files)
├── web-admin // Admin PWA (React, TypeScript, Vite)
│  ├── public
│  ├── src
│  ├── index.html
│  ├── package.json
│  ├── tsconfig.json
│  ├── vite.config.ts
│  └── ... (other configuration files)
├── get_token.html
├── jest.config.js
├── jsdoc.json
├── loyaltyTiers.json
├── menuCategories.json
├── package-lock.json
├── package.json
├── README.md
├── setup_firebase_init.js
├── setup_firestore_test_users.js
├── setup_test_data.cjs
├── setup_test_data.js
├── setup_test_users.js
├── setup_test_users.mjs
├── snapshot.friedg.cjs
├── snapshot.md // Existing snapshot file
├── storage.rules
├── vite.config.ts
├── vitest.config.js
├── 開發紀錄檔.txt // Development log
└── ... (other miscellaneous files and logs)
```

## 專案總覽

本專案「吃雞排找不早 POS 系統」旨在提供一套完整的餐飲業銷售時點情報系統 (POS)。系統主要包含以下幾個核心組件：

1.  **顧客端漸進式網頁應用 (PWA) (`ceg-customer-pwa`)**:
    *   **技術棧**: React, TypeScript, Vite。
    *   **核心功能**: 菜單瀏覽、線上點餐、購物車管理、Firebase 手機號碼認證、LINE Pay 支付整合、訂單狀態追蹤、訂單歷史查看。
    *   **目標**: 提供顧客流暢、便捷的自助點餐與支付體驗。

2.  **管理後台網頁應用 (`web-admin`)**:
    *   **技術棧**: React, TypeScript, Vite。
    *   **核心功能**: POS產品網格操作、訂單管理 (查看今日訂單、更新訂單狀態)、用戶管理 (查看用戶列表、指派角色)、庫存管理基礎界面。
    *   **目標**: 賦予店家員工及管理員高效管理日常營運的能力。

3.  **後端服務 (Firebase Cloud Functions) (`functions`)**:
    *   **技術棧**: Node.js, TypeScript, Express.js。
    *   **核心功能**:
        *   用戶認證與授權 (基於 Firebase Authentication 與 Custom Claims 的 RBAC)。
        *   訂單處理 (創建、查詢、狀態更新)。
        *   支付處理 (LINE Pay V3 API 整合，包括 Request, Confirm 流程，交易記錄)。
        *   庫存管理 (商品庫存扣減)。
        *   用戶與角色管理 API。
        *   其他業務邏輯 API (如商店資訊、菜單管理等)。
    *   **架構**: 採用模組化設計，將不同業務領域的邏輯分離到獨立的 Express 應用或 Callable Functions 中，並透過 `firebase.json` 的 `rewrites` 路由到統一的 API Gateway。
    *   **資料庫**: Firebase Firestore。
    *   **重要提示**: `functions/lib` 目錄（通常包含編譯後的 JavaScript）已被刪除。部署前需要執行 TypeScript 編譯步驟 (例如 `npm run build` 在 `functions` 目錄下)。

## 主要功能模組與特色

*   **用戶認證與 RBAC**:
    *   顧客端使用 Firebase Phone Authentication。
    *   管理後台用戶通過 Firebase Authentication 登入。
    *   後端通過 Firebase Custom Claims 實現角色基礎的存取控制 (RBAC)，保護敏感 API 與操作。
    *   提供了 `setUserRoleV2` Callable Function 供管理員指派角色。

*   **訂單生命週期管理**:
    *   從顧客下單、支付、店家確認、到訂單完成或取消，提供完整的狀態追蹤。
    *   顧客可查看訂單進度，員工可在後台管理訂單。

*   **LINE Pay 支付整合**:
    *   完整對接 LINE Pay V3 API 的 Request 與 Confirm 流程。
    *   後端處理支付請求簽名、交易記錄、支付確認及訂單狀態更新。
    *   顧客端引導至 LINE Pay 支付頁面，並處理支付後的回調。
    *   注重交易冪等性與 Firestore 事務一致性。

*   **庫存管理**:
    *   後端實現了訂單創建時的商品庫存即時扣減邏輯。
    *   Firestore `menuItems` 記錄商品庫存量。
    *   庫存不足時能阻止訂單創建並返回明確錯誤。

*   **前後端分離架構**:
    *   顧客 PWA、管理後台 PWA 與後端 Firebase Cloud Functions 三者分離，通過 API 進行通訊。
    *   有利於獨立開發、部署與擴展。

*   **開發與部署**:
    *   前端應用使用 Vite 進行建構。
    *   後端 Cloud Functions 使用 TypeScript 開發，需編譯為 JavaScript 後部署。
    *   使用 Firebase CLI 進行部署。
    *   （詳細部署步驟將在後續文檔中提供）

## 資料庫結構 (Firestore)

簡要概述主要集合及其用途：

*   `users`: 儲存用戶基本資訊，包括 Firebase UID, 電話號碼, Custom Claims (角色)。
*   `orders`: 儲存訂單詳細資訊，包括顧客 ID, 商品列表, 金額, 訂單狀態, 支付資訊 (LINE Pay 交易 ID), 時間戳等。
*   `menuItems`: 儲存菜單商品資訊，包括名稱, 價格, 分類, 圖片 URL, 以及庫存相關欄位 (`stock: { current: number, manageStock: boolean }`)。
*   `menuCategories`: 菜單分類。
*   `stores`: 商店資訊。
*   `linePayTransactions`: 記錄 LINE Pay 交易的詳細資訊，包括原始系統訂單 ID, LINE Pay 交易 ID, 金額, 狀態 (pending, confirmed_paid, confirmed_failed) 等，用於追蹤與冪等性控制。
*   `adminActivityLog` (或其他類似名稱): 用於記錄管理員操作日誌 (概念)。
*   `roles`: 定義系統中的角色及其權限 (概念，實際權限可能硬編碼或結合 Custom Claims)。

## API 端點概述

後端 Cloud Functions 主要通過 HTTP Functions (Express apps) 暴露 API。關鍵 API Namespace 包括：

*   `/usersApiV2`: 用戶相關操作 (如列表)。
*   `/ordersApiV2`: 訂單相關操作 (創建、查詢、更新狀態)。
*   `/paymentsApiV2`: 支付相關操作 (LINE Pay 請求、確認回調)。
*   `/storesApiV2`: 商店資訊。
*   Callable Functions: 如 `setUserRoleV2`。

（詳細的 API 規格書位於 `api-specs/` 目錄，或參考各模組的路由定義 (`functions/src/**/routes.ts` 或 `functions/src/**/index.ts` 等)）

---
**(後續將補充更詳細的各模組說明、部署指南、環境變數配置等)** 