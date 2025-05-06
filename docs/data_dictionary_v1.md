# 「吃雞排找不早」POS 與後台管理系統資料字典

本文檔定義了系統中四個核心集合 (Collections) 的數據結構、欄位定義和相關說明。

## 1. Customers（顧客資料表）

顧客資料表存儲所有註冊系統的顧客資訊，包括個人資料、會員狀態和積分信息。

| 欄位名稱 | 資料類型 | 必填 | 說明 | 範例值 |
|---------|---------|------|------|-------|
| `customerId` | string | 是 | 主鍵 (PK)，顧客唯一標識符 | `"cust_123456"` |
| `tenantId` | string | 是 | 外鍵 (FK)，所屬租戶ID | `"tenant_abcdef"` |
| `lineUid` | string | 否 | LINE用戶ID，用於LINE登入綁定 | `"U1234567890abcdef"` |
| `displayName` | string | 是 | 顯示名稱 | `"張小明"` |
| `phone` | string | 否 | 手機號碼 | `"0912345678"` |
| `email` | string | 否 | 電子郵件 | `"user@example.com"` |
| `birthday` | timestamp | 否 | 生日日期 | `2000-01-01` |
| `points` | number | 是 | 會員積分數量 | `150` |
| `memberTags` | array | 否 | 會員標籤分類 | `["VIP", "常客"]` |
| `referralCode` | string | 否 | 專屬推薦碼 | `"MING2024"` |
| `createdAt` | timestamp | 是 | 創建時間 | `2024-01-01T12:00:00Z` |
| `updatedAt` | timestamp | 是 | 最後更新時間 | `2024-05-15T08:30:00Z` |

## 2. Employees（員工資料表）

員工資料表儲存所有企業員工的資訊，包括權限角色、薪資設定和工作門市分配。

| 欄位名稱 | 資料類型 | 必填 | 說明 | 範例值 |
|---------|---------|------|------|-------|
| `employeeId` | string | 是 | 主鍵 (PK)，員工唯一標識符 | `"emp_789012"` |
| `tenantId` | string | 是 | 外鍵 (FK)，所屬租戶ID | `"tenant_abcdef"` |
| `lineUid` | string | 否 | LINE用戶ID，用於LINE登入綁定 | `"U0987654321abcdef"` |
| `displayName` | string | 是 | 顯示名稱 | `"李經理"` |
| `phone` | string | 是 | 手機號碼 | `"0923456789"` |
| `email` | string | 否 | 電子郵件 | `"staff@example.com"` |
| `role` | string | 是 | 職位角色ID | `"store_manager"` |
| `assignedStores` | array | 是 | 分配的門市ID列表 | `["store_001", "store_002"]` |
| `salarySettings` | object | 是 | 薪資設定 | `{"base": 30000, "hourlyRate": 180}` |
| `active` | boolean | 是 | 帳號是否啟用 | `true` |
| `createdAt` | timestamp | 是 | 創建時間 | `2024-01-01T12:00:00Z` |
| `updatedAt` | timestamp | 是 | 最後更新時間 | `2024-05-15T08:30:00Z` |

## 3. Stores（門市資料表）

門市資料表儲存企業所有分店的基本資訊、位置、營業時間和相關設定。

| 欄位名稱 | 資料類型 | 必填 | 說明 | 範例值 |
|---------|---------|------|------|-------|
| `storeId` | string | 是 | 主鍵 (PK)，門市唯一標識符 | `"store_001"` |
| `tenantId` | string | 是 | 外鍵 (FK)，所屬租戶ID | `"tenant_abcdef"` |
| `storeName` | string | 是 | 門市名稱 | `"不早雞排忠孝店"` |
| `location` | object | 是 | 門市地址信息 | `{"address": "台北市忠孝東路123號", "city": "台北市", "district": "信義區"}` |
| `coordinates` | geopoint | 是 | 經緯度座標 | `{"latitude": 25.041171, "longitude": 121.565137}` |
| `openHours` | object | 是 | 營業時間設定 | `{"monday": {"open": "10:00", "close": "21:00"}, ...}` |
| `gpsFence` | object | 是 | GPS打卡圍欄設定 | `{"latitude": 25.041171, "longitude": 121.565137, "radius": 100}` |
| `printerSettings` | object | 否 | 雲端印表機設定 | `{"apiUrl": "https://printer.example.com", "apiKey": "xyz123", "template": "default"}` |
| `status` | string | 是 | 門市狀態 | `"active"` |
| `createdAt` | timestamp | 是 | 創建時間 | `2024-01-01T12:00:00Z` |
| `updatedAt` | timestamp | 是 | 最後更新時間 | `2024-05-15T08:30:00Z` |

## 4. Roles（角色定義表）

角色定義表儲存系統中所有預設的角色定義及其權限設定，用於實施基於角色的訪問控制(RBAC)。

| 欄位名稱 | 資料類型 | 必填 | 說明 | 範例值 |
|---------|---------|------|------|-------|
| `roleId` | string | 是 | 主鍵 (PK)，角色唯一標識符 | `"store_manager"` |
| `roleName` | string | 是 | 角色顯示名稱 | `"分店經理"` |
| `level` | number | 是 | 角色等級 (1-6，6為最高) | `5` |
| `description` | string | 否 | 角色描述 | `"負責分店的日常營運管理"` |
| `permissions` | array | 是 | 權限列表 | `["read:orders", "write:orders", "manage:staff"]` |
| `createdAt` | timestamp | 是 | 創建時間 | `2024-01-01T12:00:00Z` |
| `updatedAt` | timestamp | 是 | 最後更新時間 | `2024-05-15T08:30:00Z` |

## 資料關聯說明

- `Customer` 通過 `tenantId` 關聯到特定租戶
- `Employee` 通過 `tenantId` 關聯到特定租戶，通過 `role` 關聯到 `Roles` 表
- `Employee` 通過 `assignedStores` 關聯到多個 `Store`
- `Store` 通過 `tenantId` 關聯到特定租戶

## 數據安全考量

- 所有集合必須強制包含 `tenantId` 或 `storeId` 欄位
- 所有讀寫操作中必須進行 `tenantId` 或 `storeId` 過濾
- 所有關鍵操作需記錄 `createdAt` 和 `updatedAt` 時間戳
- 權限控制須在前端與後端安全規則中雙重實施

### **推定數據模型 (v1 - 基於實現推斷)**

**注意：** 以下數據模型定義是根據當前 API 實現推斷得出，用於指導初步開發。字段的可選/必填狀態、確切數據類型以及集合間的關聯方式可能需要根據最終業務需求進行審查和調整。

-----

#### **Collection: `employees`**

存儲員工基本信息和權限相關數據。

| 字段名        | 數據類型    | 必填 | 描述                                                                 |
| ------------- | ----------- | ---- | -------------------------------------------------------------------- |
| `uid`         | String      | Yes  | Firebase Auth User ID (由 `admin.auth().createUser()` 返回並設置)    |
| `email`       | String      | Yes  | 員工的電子郵件地址（在 Firebase Auth 中唯一）                        |
| `displayName` | String      | Yes  | 員工的顯示名稱                                                       |
| `role`        | String      | Yes  | 員工角色 ID (例如: 'StoreManager', 'StoreStaff' - 需定義有效列表) |
| `tenantId`    | String      | Yes  | 員工所屬的租戶 ID (來自創建者的 Custom Claims)                     |
| `storeId`     | String      | Yes  | 員工被分配到的店鋪 ID                                                 |
| `isActive`    | Boolean     | Yes  | 狀態標誌 (true: 活躍, false: 軟刪除) (軟刪除時設置)                  |
| `createdAt`   | Timestamp   | Yes  | Firestore 服務器時間戳（創建時）                                     |
| `updatedAt`   | Timestamp   | Yes  | Firestore 服務器時間戳（最後更新時）                                 |
| `...otherData`| Map         | No   | 創建時通過請求體傳入的其他自定義字段                                 |

-----

#### **Collection: `menuCategories`**

存儲菜單分類信息。

| 字段名         | 數據類型    | 必填 | 描述                                             |
| -------------- | ----------- | ---- | ------------------------------------------------ |
| `name`         | String      | Yes  | 分類名稱                                         |
| `storeId`      | String      | Yes  | 此分類所屬的店鋪 ID                               |
| `tenantId`     | String      | Yes  | 此分類所屬的租戶 ID                               |
| `displayOrder` | Number      | No   | 用於排序的顯示順序 (例如: 0, 1, 2...)            |
| `isActive`     | Boolean     | Yes  | 狀態標誌 (true: 活躍, false: 軟刪除)           |
| `createdAt`    | Timestamp   | Yes  | Firestore 服務器時間戳（創建時）                 |
| `updatedAt`    | Timestamp   | Yes  | Firestore 服務器時間戳（最後更新時）             |

-----

#### **Collection: `menuItems`**

存儲菜單品項信息。

| 字段名         | 數據類型    | 必填 | 描述                                             |
| -------------- | ----------- | ---- | ------------------------------------------------ |
| `name`         | String      | Yes  | 品項名稱                                         |
| `description`  | String      | No   | 品項描述                                         |
| `price`        | Number      | Yes  | 品項的基礎價格                                   |
| `categoryId`   | String      | Yes  | 所屬 `menuCategories` 文檔的 ID                  |
| `storeId`      | String      | Yes  | 此品項所屬的店鋪 ID                               |
| `tenantId`     | String      | Yes  | 此品項所屬的租戶 ID                               |
| `imageUrl`     | String      | No   | 品項圖片的 URL                                   |
| `displayOrder` | Number      | No   | 在分類內的顯示順序                               |
| `isActive`     | Boolean     | Yes  | 狀態標誌 (true: 活躍, false: 軟刪除)           |
| `createdAt`    | Timestamp   | Yes  | Firestore 服務器時間戳（創建時）                 |
| `updatedAt`    | Timestamp   | Yes  | Firestore 服務器時間戳（最後更新時）             |

-----

#### **Collection: `menuOptions`**

存儲菜單選項信息。

| 字段名            | 數據類型    | 必填 | 描述                                                                 |
| ----------------- | ----------- | ---- | -------------------------------------------------------------------- |
| `name`            | String      | Yes  | 選項名稱 (例如: '大杯', '加辣')                                       |
| `priceAdjustment` | Number      | Yes  | 價格調整值 (例如: 0, 1.50, -0.50)                                  |
| `itemId`          | String      | Yes  | **(假設)** 所屬 `menuItems` 文檔的 ID                                 |
| `storeId`         | String      | Yes  | 此選項所屬的店鋪 ID                                                   |
| `tenantId`        | String      | Yes  | 此選項所屬的租戶 ID                                                   |
| `displayOrder`    | Number      | No   | 在品項的選項中的顯示順序                                             |
| `isActive`        | Boolean     | Yes  | 狀態標誌 (true: 活躍, false: 軟刪除)                               |
| `isDefault`       | Boolean     | No   | 是否為該品項的默認選中選項                                           |
| `createdAt`       | Timestamp   | Yes  | Firestore 服務器時間戳（創建時）                                     |
| `updatedAt`       | Timestamp   | Yes  | Firestore 服務器時間戳（最後更新時）                                 |
| *(注意)* |             |      | *實際關聯方式 (直接用 itemId 或通過 optionGroupId) 需要最終確認* |

-----

#### **Collection: `members`**

存儲會員（顧客）信息。

| 字段名        | 數據類型    | 必填 | 描述                                                         |
| ------------- | ----------- | ---- | ------------------------------------------------------------ |
| `name`        | String      | Yes  | 會員姓名                                                     |
| `phone`       | String      | Yes  | 會員手機號碼 (用於查找和關聯 Auth)                           |
| `email`       | String      | No   | 會員電子郵件地址 (可選)                                      |
| `userId`      | String      | No   | 關聯的 Firebase Auth User ID (uid) (未關聯時為 `null`)       |
| `storeId`     | String      | Yes  | 會員主要關聯的店鋪 ID                                        |
| `tenantId`    | String      | Yes  | 會員所屬的租戶 ID                                            |
| `isActive`    | Boolean     | Yes  | 狀態標誌 (true: 活躍, false: 軟刪除/禁用)                   |
| `createdAt`   | Timestamp   | Yes  | Firestore 服務器時間戳（創建時）                             |
| `updatedAt`   | Timestamp   | Yes  | Firestore 服務器時間戳（最後更新時）                         |

-----

#### **Collection: `orders`**

存儲訂單信息。

| 字段名          | 數據類型          | 必填 | 描述                                                                              |
| --------------- | ----------------- | ---- | --------------------------------------------------------------------------------- |
| `userId`        | String            | Yes  | 下單會員的 `userId` (關聯 Auth `uid`)                                              |
| `storeId`       | String            | Yes  | 訂單所屬的店鋪 ID                                                                    |
| `tenantId`      | String            | Yes  | 訂單所屬的租戶 ID                                                                    |
| `items`         | Array\<Map\>        | Yes  | 訂單包含的品項列表 (詳細結構見下)                                                  |
| `subtotal`      | Number            | Yes  | 訂單小計 (所有 `itemTotal` 之和)                                                   |
| `totalAmount`   | Number            | Yes  | 訂單總金額 (可能包含稅、運費等，初步實現等於 `subtotal`)                             |
| `status`        | String            | Yes  | 訂單狀態 (例如: 'pending', 'confirmed', 'completed', 'cancelled' - 需定義狀態列表) |
| `deliveryInfo`  | Map               | No   | 配送/自提信息 (例如: `{ type: 'pickup', name: 'John', phone: '...' }`)            |
| `paymentMethod` | String            | No   | 支付方式                                                                          |
| `notes`         | String            | No   | 顧客的訂單備註                                                                    |
| `createdAt`     | Timestamp         | Yes  | Firestore 服務器時間戳（創建時）                                                  |
| `updatedAt`     | Timestamp         | Yes  | Firestore 服務器時間戳（最後更新時）                                              |
| `orderNumber`   | String / Number   | No   | 便於人類識別的訂單號 (可能需要單獨生成)                                           |

-----

#### **Structure for `orders.items` Array Element:**

訂單中每個品項的詳細信息。

| 字段名        | 數據類型          | 描述                                                              |
| ------------- | ----------------- | ----------------------------------------------------------------- |
| `menuItemId`  | String            | 品項的 ID                                                           |
| `name`        | String            | 品項名稱（下單時快照）                                            |
| `quantity`    | Number            | 訂購數量                                                          |
| `price`       | Number            | 品項基礎單價（下單時後端驗證）                                    |
| `options`     | Array\<Map\>        | 選擇的選項列表 (詳細結構見下)                                      |
| `itemTotal`   | Number            | 此行品項的總計 ((基礎單價 + 選項調整總和) \* 數量)                  |

-----

#### **Structure for `orders.items.options` Array Element:**

訂單品項中每個選中選項的詳細信息。

| 字段名            | 數據類型   | 描述                                                              |
| ----------------- | -------- | ----------------------------------------------------------------- |
| `menuOptionId`    | String   | 選項的 ID                                                           |
| `name`            | String   | 選項名稱（下單時快照）                                            |
| `priceAdjustment` | Number   | 選項價格調整（下單時後端驗證）                                    |

----- 