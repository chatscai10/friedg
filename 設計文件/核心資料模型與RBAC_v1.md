# 吃雞排找不早系統 - 核心資料模型與RBAC設計 v1.0

## 1. 系統概述

「吃雞排找不早」系統為一套多租戶SaaS架構的POS與後台管理系統，支援線上點餐、線下POS操作、員工管理、排班與薪資計算、會員管理、庫存管理等功能。本文檔定義系統的核心資料模型與角色權限控制(RBAC)設計。

## 2. 基礎設計原則

根據「整合專案報告.txt」的要求，系統採用以下設計原則：

1. **多租戶(Multi-Tenant)架構**：共享資料庫、共享Schema，透過TenantID/StoreID隔離
2. **NoSQL設計**：利用Firestore文件導向資料庫特性優化查詢效能
3. **強制安全隔離**：所有租戶特定資料必須包含TenantID，並在所有讀寫操作強制過濾
4. **細粒度權限控制**：實現6級職等體系，對應不同系統權限範圍
5. **離線支援**：設計支援PWA離線操作的資料結構

## 3. 核心資料模型設計

### 3.1 頂層集合(Collections)概覽

| 集合名稱 | 用途描述 | 安全級別 |
|----------|----------|---------|
| `tenants` | 租戶(店家)基本資訊 | 高 |
| `stores` | 店家分店資訊 | 高 |
| `users` | 使用者資訊(含員工與顧客) | 高 |
| `roles` | 系統角色與權限定義 | 高 |
| `employees` | 員工詳細資訊 | 高 |
| `attendances` | 員工打卡紀錄 | 中 |
| `schedules` | 排班資訊 | 中 |
| `leaves` | 請假申請記錄 | 中 |
| `menuCategories` | 菜單分類 | 低 |
| `menuItems` | 菜單項目 | 低 |
| `menuOptions` | 菜單選項(如加料/調味) | 低 |
| `orders` | 訂單資訊 | 中 |
| `orderItems` | 訂單項目明細 | 中 |
| `inventoryItems` | 庫存項目 | 中 |
| `inventoryCounts` | 盤點記錄 | 中 |
| `inventoryOrders` | 叫貨單 | 中 |
| `payrolls` | 薪資記錄 | 高 |
| `bonusTasks` | 獎金任務定義 | 中 |
| `bonusRecords` | 獎金紀錄 | 中 |
| `ratings` | 顧客評價 | 低 |
| `announcements` | 公告資訊 | 低 |
| `knowledgeBase` | 知識庫資料 | 低 |
| `votes` | 投票紀錄 | 中 |
| `auditLogs` | 操作日誌 | 高 |
| `systemConfigs` | 系統配置 | 最高 |
| `adSlots` | 廣告欄位定義 | 中 |
| `adContents` | 廣告內容 | 低 |
| `referralCodes` | 推薦碼 | 中 |
| `referralUsages` | 推薦碼使用記錄 | 中 |
| `pickupNumbers` | 取餐號碼管理 | 低 |

### 3.2 主要集合結構詳細定義

#### `tenants` 集合
```
{
  "tenantId": "string", // 主鍵，租戶ID
  "name": "string", // 租戶名稱
  "ownerName": "string", // 負責人姓名
  "ownerContact": "string", // 負責人聯絡方式
  "createdAt": "timestamp", // 創建時間
  "status": "string", // 狀態: active, suspended, closed
  "planId": "string", // 方案ID
  "planExpiry": "timestamp", // 方案到期日
  "settings": { // 租戶設定
    "themeColor": "string", // 主題色彩
    "logo": "string", // Logo URL
    "contactPhone": "string", // 聯絡電話
    "defaultLanguage": "string", // 預設語言
    "timezone": "string", // 時區
    "isPublished": "boolean", // 是否公開於探索平台
    "isAdvertisementEnabled": "boolean" // 是否開啟廣告
  },
  "limits": { // 資源限制
    "maxStores": "number", // 最大分店數
    "maxEmployees": "number", // 最大員工數
    "maxMenuItems": "number", // 最大菜單項目數
    "maxStorage": "number" // 最大儲存空間(MB)
  },
  "integration": { // 外部整合設定
    "lineChannelId": "string", // LINE Channel ID
    "lineChannelSecret": "string", // LINE Channel Secret (不直接儲存，僅參考)
    "linePayMerchantId": "string", // LINE Pay 商家ID
    "printerApiEndpoint": "string" // 印表機API端點
  },
  "statistics": { // 統計資料
    "totalOrders": "number", // 總訂單數
    "totalStores": "number", // 總分店數
    "lastActivityAt": "timestamp" // 最後活動時間
  }
}
```

#### `stores` 集合
```
{
  "storeId": "string", // 主鍵，分店ID
  "tenantId": "string", // 租戶ID（關鍵隔離欄位）
  "name": "string", // 分店名稱
  "address": "string", // 地址
  "contactPhone": "string", // 聯絡電話
  "managerUid": "string", // 管理者UID
  "location": { // 地理位置
    "latitude": "number", // 緯度
    "longitude": "number", // 經度
    "geohash": "string" // Geohash值(方便地理位置查詢)
  },
  "operationHours": [ // 營業時間
    {
      "day": "number", // 星期(0-6)
      "openTime": "string", // 開始時間 (HH:MM)
      "closeTime": "string", // 結束時間 (HH:MM)
      "isClosed": "boolean" // 是否休息
    }
  ],
  "settings": { // 分店特定設定
    "punchRadius": "number", // 打卡允許半徑(公尺)
    "autoApproveLeaves": "boolean", // 自動審核請假
    "pickupSystem": "string", // 取餐系統類型: screen, notification, both
    "queueDisplayUrl": "string", // 取餐顯示螢幕URL
    "printerSettings": { // 印表機設定
      "enabled": "boolean", // 是否啟用
      "apiKey": "string", // API金鑰
      "printerIds": ["string"] // 印表機ID列表
    }
  },
  "createdAt": "timestamp", // 創建時間
  "updatedAt": "timestamp", // 更新時間
  "status": "string" // 狀態: active, inactive
}
```

#### `users` 集合
```
{
  "uid": "string", // 主鍵，用戶ID (Firebase Auth UID)
  "email": "string", // 電子郵件
  "displayName": "string", // 顯示名稱
  "photoURL": "string", // 頭像URL
  "phoneNumber": "string", // 電話號碼
  "lineId": "string", // LINE ID (如有綁定)
  "userType": "string", // 用戶類型: customer, employee, admin
  "tenantId": "string", // 租戶ID (員工必填，顧客選填)
  "defaultStoreId": "string", // 預設分店ID
  "registeredAt": "timestamp", // 註冊時間
  "lastLoginAt": "timestamp", // 最後登入時間
  "status": "string", // 狀態: active, suspended, deleted
  "preferences": { // 用戶偏好設定
    "language": "string", // 語言偏好
    "notifications": { // 通知設定
      "email": "boolean",
      "push": "boolean",
      "line": "boolean"
    }
  },
  "metadata": { // 其他元數據
    "registrationSource": "string", // 註冊來源: direct, line, referral
    "referralCode": "string", // 推薦碼 (若透過推薦註冊)
    "deviceInfo": "string" // 裝置資訊
  }
}
```

#### `employees` 集合
```
{
  "employeeId": "string", // 主鍵，員工ID (通常與uid相同)
  "uid": "string", // 關聯的用戶ID
  "tenantId": "string", // 租戶ID（關鍵隔離欄位）
  "storeId": "string", // 主要工作分店ID
  "additionalStoreIds": ["string"], // 額外工作分店ID列表
  "firstName": "string", // 名
  "lastName": "string", // 姓
  "idNumber": "string", // 身分證號碼
  "birthDate": "string", // 生日
  "gender": "string", // 性別
  "address": "string", // 地址
  "emergencyContact": { // 緊急聯絡人
    "name": "string",
    "relationship": "string",
    "phone": "string"
  },
  "employmentInfo": { // 僱用資訊
    "hireDate": "timestamp", // 入職日期
    "position": "string", // 職位
    "employmentType": "string", // 僱用類型: fulltime, parttime
    "role": "string", // 系統角色: tenant_admin, store_manager, cashier, etc.
    "roleLevel": "number", // 職等等級(1-6)
    "bankAccount": "string", // 銀行帳號(薪資匯款用)
    "baseSalary": "number", // 基本薪資
    "hourlySalary": "number" // 時薪(兼職適用)
  },
  "workingStatus": { // 工作狀態
    "isActive": "boolean", // 是否在職
    "leaveBalance": { // 假期餘額
      "annual": "number", // 年假
      "sick": "number", // 病假
      "personal": "number" // 事假
    }
  },
  "performanceMetrics": { // 績效指標
    "salesAmount": "number", // 銷售額
    "orderCount": "number", // 訂單數
    "averageRating": "number", // 平均評分
    "attendanceRate": "number" // 出勤率
  },
  "createdAt": "timestamp", // 創建時間
  "updatedAt": "timestamp", // 更新時間
  "isApproved": "boolean" // 是否已審核
}
```

#### `attendances` 集合
```
{
  "attendanceId": "string", // 主鍵，出勤記錄ID
  "employeeId": "string", // 員工ID
  "uid": "string", // 用戶ID
  "tenantId": "string", // 租戶ID（關鍵隔離欄位）
  "storeId": "string", // 分店ID
  "date": "string", // 日期 (YYYY-MM-DD)
  "type": "string", // 類型: clock_in, clock_out
  "timestamp": "timestamp", // 打卡時間戳
  "location": { // 打卡位置
    "latitude": "number", // 緯度
    "longitude": "number", // 經度
    "accuracy": "number" // 精確度(公尺)
  },
  "status": "string", // 狀態: normal, late, early_leave, overtime
  "notes": "string", // 備註
  "isManuallyAdded": "boolean", // 是否手動補登
  "approvedBy": "string", // 審核者ID (僅補登時需要)
  "scheduleId": "string" // 關聯的排班ID
}
```

#### `orders` 集合
```
{
  "orderId": "string", // 主鍵，訂單ID
  "orderNumber": "string", // 訂單編號(人類可讀)
  "tenantId": "string", // 租戶ID（關鍵隔離欄位）
  "storeId": "string", // 分店ID
  "customerId": "string", // 顧客ID (未登入為null)
  "employeeId": "string", // 處理員工ID (線下POS使用)
  "orderType": "string", // 訂單類型: dine_in, takeout, delivery
  "orderSource": "string", // 訂單來源: pos, online, foodpanda, ubereats
  "status": "string", // 狀態: pending, confirmed, preparing, ready, completed, cancelled
  "createdAt": "timestamp", // 創建時間
  "confirmedAt": "timestamp", // 確認時間
  "completedAt": "timestamp", // 完成時間
  "pickupNumber": "number", // 取餐號碼
  "tableNumber": "string", // 桌號 (內用時)
  "customerName": "string", // 顧客姓名
  "customerPhone": "string", // 顧客電話
  "customerNote": "string", // 顧客備註
  "payment": { // 付款資訊
    "method": "string", // 付款方式: cash, line_pay, credit_card
    "status": "string", // 狀態: pending, paid, refunded
    "transactionId": "string", // 交易ID
    "paidAt": "timestamp" // 付款時間
  },
  "amounts": { // 金額明細
    "subtotal": "number", // 小計
    "discount": "number", // 折扣
    "tax": "number", // 稅額
    "serviceCharge": "number", // 服務費
    "deliveryFee": "number", // 外送費
    "total": "number" // 總計
  },
  "couponCode": "string", // 優惠券代碼
  "isRated": "boolean", // 是否已評價
  "isPrinted": "boolean", // 是否已出單
  "metadata": { // 其他元數據
    "deviceInfo": "string", // 裝置資訊
    "ipAddress": "string", // IP地址
    "orderVersion": "number" // 訂單版本號(用於離線同步)
  }
}
```

#### `orderItems` 集合 (訂單項目)
```
{
  "orderItemId": "string", // 主鍵
  "orderId": "string", // 所屬訂單ID
  "tenantId": "string", // 租戶ID（關鍵隔離欄位）
  "storeId": "string", // 分店ID
  "menuItemId": "string", // 菜單項目ID
  "name": "string", // 品項名稱(冗餘儲存)
  "quantity": "number", // 數量
  "unitPrice": "number", // 單價
  "subtotal": "number", // 小計(含選項)
  "note": "string", // 備註
  "options": [ // 選項
    {
      "optionId": "string", // 選項ID
      "name": "string", // 選項名稱
      "value": "string", // 選項值
      "price": "number" // 選項價格
    }
  ],
  "status": "string", // 狀態: pending, preparing, completed, cancelled
  "sequence": "number" // 排序(用於廚房顯示順序)
}
```

#### `roles` 集合
```
{
  "roleId": "string", // 主鍵，角色ID
  "tenantId": "string", // 租戶ID (全局角色為null)
  "name": "string", // 角色名稱
  "level": "number", // 職等等級(1-6)
  "description": "string", // 說明
  "isSystem": "boolean", // 是否系統預設角色
  "permissions": { // 權限設定，針對各模組的操作權限
    "employee": { // 員工管理模組
      "view": "boolean",
      "create": "boolean", 
      "update": "boolean",
      "delete": "boolean",
      "approve": "boolean"
    },
    "schedule": { // 排班模組
      "view": "boolean",
      "create": "boolean",
      "update": "boolean",
      "approve": "boolean"
    },
    "order": { // 訂單模組
      "view": "boolean",
      "create": "boolean",
      "update": "boolean",
      "cancel": "boolean",
      "discount": "boolean"
    },
    "menu": { // 菜單模組
      "view": "boolean",
      "create": "boolean",
      "update": "boolean",
      "delete": "boolean"
    },
    "inventory": { // 庫存模組
      "view": "boolean",
      "count": "boolean",
      "order": "boolean",
      "approve": "boolean"
    },
    "report": { // 報表模組
      "view": "boolean",
      "export": "boolean"
    },
    "setting": { // 設定模組
      "view": "boolean",
      "update": "boolean"
    },
    "announcement": { // 公告模組
      "view": "boolean",
      "create": "boolean",
      "update": "boolean",
      "delete": "boolean"
    }
  },
  "createdAt": "timestamp", // 創建時間
  "updatedAt": "timestamp" // 更新時間
}
```

### 3.3 子集合(Subcollections)的使用

為了優化查詢效能，系統將使用以下子集合:

#### `tenants/{tenantId}/settings` 子集合
存放租戶特定的設定，如功能開關、UI設定等，可減少主文檔大小並便於細粒度更新。

#### `orders/{orderId}/events` 子集合
記錄訂單生命週期的所有事件，如狀態變更、備註、退款等。

#### `users/{userId}/devices` 子集合
記錄用戶的裝置資訊，用於推送通知。

#### `employees/{employeeId}/payrollHistory` 子集合
儲存員工的薪資歷史紀錄，避免主文檔過大。

### 3.4 索引設計

除了firestore.indexes.json中已定義的索引外，還建議以下索引:

1. 訂單查詢索引
```
orders: [tenantId ASC, storeId ASC, status ASC, createdAt DESC]
orders: [tenantId ASC, storeId ASC, orderType ASC, createdAt DESC]
orders: [customerId ASC, status ASC, createdAt DESC]
```

2. 盤點記錄索引
```
inventoryCounts: [tenantId ASC, storeId ASC, countDate DESC]
```

3. 出勤記錄索引
```
attendances: [tenantId ASC, storeId ASC, employeeId ASC, date DESC]
attendances: [employeeId ASC, date DESC]
```

4. 排班索引
```
schedules: [tenantId ASC, storeId ASC, startDate DESC]
schedules: [employeeId ASC, startDate DESC]
```

## 4. 角色權限控制(RBAC)設計

### 4.1 角色體系

系統採用6級職等體系，各職等對應不同的系統權限範圍:

| 角色ID | 角色名稱 | 職等 | 權限說明 |
|--------|----------|------|----------|
| `super_admin` | 超級管理員 | 0 | 平台最高管理者，可管理所有租戶 |
| `tenant_admin` | 租戶管理員 | 1 | 租戶內最高管理者，可管理所有分店 |
| `store_manager` | 店長 | 2 | 分店最高管理者，可管理本店員工與營運 |
| `shift_leader` | 班長 | 3 | 可負責班次，協助管理營運與員工 |
| `senior_staff` | 資深員工 | 4 | 有較多權限的一般員工 |
| `staff` | 一般員工 | 5 | 基本點餐、打卡、庫存操作 |
| `trainee` | 實習員工 | 6 | 有限的系統功能，需監督 |
| `customer` | 顧客 | 99 | 僅可使用線上點餐相關功能 |

### 4.2 角色預設權限範圍

#### 超級管理員 (Super Admin)
- 管理租戶(創建、停用、編輯、查看)
- 管理系統全局設定
- 設定租戶資源限制
- 管理廣告系統
- 管理推薦系統
- 查看系統操作日誌
- 管理租戶探索平台
- 查看系統監控與分析數據
- 能以任何租戶身份模擬登入(謹慎使用)

#### 租戶管理員 (Tenant Admin)
- 管理租戶所有分店
- 管理菜單與價格(分店級別)
- 管理所有員工(招聘、任命、辭退)
- 設定角色與權限
- 查看所有分店報表
- 管理跨店促銷活動
- 查看租戶操作日誌
- 設定租戶特定參數

#### 店長 (Store Manager)
- 管理本店員工資料
- 管理本店排班
- 審核請假申請
- 管理本店菜單
- 查看店鋪報表
- 處理訂單與退款
- 審核薪資與獎金
- 管理本店設定參數

#### 班長 (Shift Leader)
- 查看當前班次員工資料
- 暫時調整當前班次排班
- 處理訂單與基本退款(限額)
- 管理本班庫存盤點
- 審核員工打卡異常
- 發布店內公告(臨時性)

#### 資深員工 (Senior Staff)
- 處理訂單與結帳
- 處理簡單退款(低額)
- 完成庫存盤點
- 處理叫貨申請
- 協助新員工培訓

#### 一般員工 (Staff)
- 打卡上下班
- 接單與點餐
- 處理現金結帳
- 查看排班表
- 申請請假
- 查看個人薪資

#### 實習員工 (Trainee)
- 打卡上下班
- 協助點餐(不能完成訂單)
- 查看排班表
- 查看培訓資料
- 申請請假

#### 顧客 (Customer)
- 瀏覽菜單
- 線上點餐
- 查看訂單狀態
- 管理個人資料
- 查看會員積分/優惠券
- 提交評價

### 4.3 權限控制實施

#### 實施多層安全控制
1. **Firebase Authentication**：管理用戶身份驗證
2. **自定義Claims**：在Firebase Auth中設置用戶的`role`和`tenantId`等自定義Claims
3. **前端存取控制**：基於用戶角色顯示/隱藏UI元素
4. **Firestore安全規則**：定義細粒度資料存取權限
5. **Cloud Functions驗證**：在所有API中二次驗證權限

#### Firestore安全規則範例

```javascript
// 檢查是否為租戶管理員
function isTenantAdmin() {
  return request.auth != null && request.auth.token.role == 'tenant_admin';
}

// 檢查是否為指定租戶的店長
function isStoreManagerOfTenant(tenantId) {
  return request.auth != null && 
         request.auth.token.role == 'store_manager' && 
         request.auth.token.tenantId == tenantId;
}

// 檢查是否為指定分店的店長
function isStoreManager(storeId) {
  return request.auth != null && 
         request.auth.token.role == 'store_manager' && 
         request.auth.token.storeId == storeId;
}

// 訂單集合權限規則
match /orders/{orderId} {
  // 允許顧客查看自己的訂單
  allow read: if request.auth != null && 
              (resource.data.customerId == request.auth.uid);
              
  // 允許員工查看自己店鋪的訂單
  allow read: if request.auth != null && 
              resource.data.tenantId == request.auth.token.tenantId &&
              (resource.data.storeId == request.auth.token.storeId || 
               isTenantAdmin());
               
  // 允許店長及以上角色創建訂單
  allow create: if request.auth != null &&
                request.resource.data.tenantId == request.auth.token.tenantId &&
                (request.resource.data.storeId == request.auth.token.storeId || 
                 isTenantAdmin()) &&
                request.auth.token.role in ['tenant_admin', 'store_manager', 
                                          'shift_leader', 'senior_staff', 'staff'];
                
  // 允許店長及班長更新訂單狀態
  allow update: if request.auth != null &&
                resource.data.tenantId == request.auth.token.tenantId &&
                (resource.data.storeId == request.auth.token.storeId || 
                 isTenantAdmin()) &&
                request.auth.token.role in ['tenant_admin', 'store_manager', 
                                          'shift_leader'];
}
```

### 4.4 JWT自定義Claims設計

Firebase Authentication JWT中將包含以下自定義Claims:

```json
{
  "role": "store_manager",          // 角色ID
  "roleLevel": 2,                   // 職等等級(1-6)
  "tenantId": "tenant123",          // 租戶ID
  "storeId": "store456",            // 主要工作分店ID
  "additionalStoreIds": ["store789"], // 額外工作分店ID
  "permissions": {                   // 特定權限標記
    "canDiscount": true,
    "canRefund": true,
    "canAuditInventory": true
  }
}
```

## 5. 資料遷移與擴展考量

### 5.1 版本管理策略

- 在設計中預留版本欄位(`version`或`schemaVersion`)，便於未來資料結構遷移
- 特定文檔類型使用時間戳(`createdAt`、`updatedAt`)追蹤資料生命週期
- 關鍵操作支援原子性Transaction，確保資料完整性

### 5.2 擴展性設計考量

- 所有集合使用分散式ID生成策略(UUID v4或Firestore自動ID)，避免熱點問題
- 訂單數據使用分離策略，將訂單項目(`orderItems`)抽離為獨立集合減少文檔大小
- 使用複合索引優化常見查詢路徑
- 為高頻存取資料預留Redis或Memcached快取整合規劃

### 5.3 多租戶隔離實踐

- 強制所有API添加`tenantId`過濾
- 在Cloud Functions層面實施租戶隔離邏輯
- 定期資料稽核，確保租戶間資料不會交叉
- 考慮資料備份策略按租戶分割

## 6. 資料安全與隱私

### 6.1 敏感資料處理

- 身分證號碼(idNumber)僅存儲雜湊值或部分遮蔽顯示
- 銀行帳號(bankAccount)僅存儲加密形式或部分遮蔽顯示
- 所有用戶密碼透過Firebase Authentication管理，不直接存儲
- 第三方服務API密鑰存儲於Secret Manager，不直接存儲於Firestore

### 6.2 資料保留策略

- 用戶資料: 用戶帳號刪除後保留30天後完全刪除
- 訂單資料: 保留5年(依法律要求)
- 打卡資料: 保留2年用於薪資審計
- 操作日誌: 保留6個月

## 7. 結論與建議

本設計文檔定義了「吃雞排找不早」系統的核心資料模型與RBAC架構，遵循Firebase/Firestore最佳實踐，並著重於多租戶隔離與安全性設計。系統的權限控制採用6級職等體系，細粒度控制各角色對不同模組的存取權限。

### 建議事項

1. **集合命名統一採用camelCase複數形式**，如`orderItems`、`menuCategories`
2. **實施Firestore安全規則測試**，確保權限邏輯正確無誤
3. **定期檢視索引使用效率**，優化查詢性能
4. **注意文檔大小控制**，避免超過1MB限制
5. **嚴格控制跨租戶資料存取**，防止資料洩漏
6. **建立資料定期備份機制**，防止意外刪除

此資料模型與RBAC設計應作為開發的基礎依據，後續開發過程中可能需要根據實際需求進行微調，但核心設計原則應保持一致。 