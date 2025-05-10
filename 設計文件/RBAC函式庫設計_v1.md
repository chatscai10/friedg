# 吃雞排找不早系統 - RBAC函式庫設計 v1.0

## 1. 函式庫概述

RBAC (Role-Based Access Control) 函式庫是「吃雞排找不早」系統中負責權限檢查的核心模組，主要用於在後端服務(如Cloud Functions)中實現細粒度的權限控制，補充Firestore安全規則無法覆蓋的複雜業務邏輯驗證。

### 1.1 設計目標

- **統一權限檢查**：提供統一的權限檢查邏輯，確保前後端權限控制一致
- **易用性**：提供簡潔清晰的API，降低開發人員使用成本
- **可擴展性**：支援新角色、權限和資源的添加，適應業務發展
- **效能優化**：高效實現權限檢查，減少數據庫查詢和計算開銷
- **可測試性**：便於單元測試，確保權限控制邏輯正確無誤

### 1.2 函式庫位置

函式庫將位於以下路徑：
```
D:\friedg\functions\src\libs\rbac\
```

### 1.3 技術選型

- 使用TypeScript實現，提供良好的類型安全和自動完成支援
- 使用Jest進行單元測試
- 支援Firebase Admin SDK和Cloud Functions環境

## 2. 函式庫架構

### 2.1 整體架構

RBAC函式庫採用分層設計，主要分為以下幾個模組：

1. **核心API層**：對外提供統一的權限檢查介面
2. **權限解析層**：解析權限規則，檢查用戶角色和權限
3. **數據訪問層**：從Firebase獲取必要的用戶信息和資源數據
4. **緩存層**：優化效能，減少重複查詢
5. **輔助工具層**：提供常用的輔助函數

### 2.2 文件結構

```
/functions/src/libs/rbac/
├── index.ts                # 主入口文件，導出公共API
├── types.ts                # 類型定義
├── constants.ts            # 常量定義
├── core/                   # 核心功能
│   ├── permissions.ts      # 權限檢查核心邏輯
│   ├── roles.ts            # 角色相關功能
│   └── resources.ts        # 資源相關功能
├── utils/                  # 工具函數
│   ├── cache.ts            # 快取機制
│   ├── claims.ts           # JWT claims處理
│   └── validators.ts       # 數據驗證工具
├── services/               # 外部服務整合
│   ├── auth.ts             # 驗證服務
│   └── firestore.ts        # Firestore數據存取
└── __tests__/              # 單元測試
    ├── permissions.test.ts
    ├── roles.test.ts
    └── e2e.test.ts
```

## 3. 核心API設計

### 3.1 主要函數介面

#### `checkPermission` - 檢查用戶是否有權限執行特定操作

```typescript
/**
 * 檢查用戶是否有權限執行特定操作
 * @param userId 用戶ID
 * @param action 操作名稱 (例如: "create", "read", "update", "delete")
 * @param resource 資源類型 (例如: "orders", "employees")
 * @param resourceId 資源ID (可選)
 * @param context 額外的上下文信息 (可選)
 * @returns Promise<boolean> 是否有權限
 */
async function checkPermission(
  userId: string,
  action: ActionType,
  resource: ResourceType,
  resourceId?: string,
  context?: PermissionContext
): Promise<boolean>;
```

#### `checkMultiplePermissions` - 檢查用戶是否有多個權限

```typescript
/**
 * 檢查用戶是否有多個權限
 * @param userId 用戶ID
 * @param permissions 權限列表 [{action, resource, resourceId?}]
 * @param context 額外的上下文信息 (可選)
 * @returns Promise<{[key: string]: boolean}> 每個權限的檢查結果
 */
async function checkMultiplePermissions(
  userId: string,
  permissions: PermissionQuery[],
  context?: PermissionContext
): Promise<Record<string, boolean>>;
```

#### `getUserPermissions` - 獲取用戶在特定資源上的所有權限

```typescript
/**
 * 獲取用戶在特定資源上的所有權限
 * @param userId 用戶ID
 * @param resource 資源類型
 * @param resourceId 資源ID (可選)
 * @returns Promise<string[]> 權限清單
 */
async function getUserPermissions(
  userId: string,
  resource: ResourceType,
  resourceId?: string
): Promise<string[]>;
```

#### `hasRole` - 檢查用戶是否具有特定角色

```typescript
/**
 * 檢查用戶是否具有特定角色
 * @param userId 用戶ID
 * @param role 角色名稱
 * @param tenantId 租戶ID (可選，如需檢查租戶相關角色)
 * @returns Promise<boolean> 是否具有角色
 */
async function hasRole(
  userId: string,
  role: RoleType,
  tenantId?: string
): Promise<boolean>;
```

#### `requirePermission` - 中間件：要求用戶具有特定權限（拋出異常）

```typescript
/**
 * 中間件：要求用戶具有特定權限，否則拋出異常
 * @param action 操作名稱
 * @param resource 資源類型
 * @param resourceIdFn 獲取資源ID的函數 (可選)
 * @returns 中間件函數
 */
function requirePermission(
  action: ActionType,
  resource: ResourceType,
  resourceIdFn?: (data: any) => string
): (req: Request, context: CallableContext) => Promise<void>;
```

### 3.2 類型定義

```typescript
// 操作類型
export type ActionType = 
  'create' | 'read' | 'update' | 'delete' | 
  'approve' | 'reject' | 'cancel' | 'complete' | 
  'print' | 'export' | 'discount' | 'refund';

// 資源類型
export type ResourceType = 
  'tenants' | 'stores' | 'users' | 'employees' | 
  'menuItems' | 'menuCategories' | 'menuOptions' | 
  'orders' | 'orderItems' | 'inventoryItems' | 
  'inventoryCounts' | 'inventoryOrders' | 'schedules' | 
  'attendances' | 'leaves' | 'payrolls';

// 角色類型
export type RoleType = 
  'super_admin' | 'tenant_admin' | 'store_manager' | 
  'shift_leader' | 'senior_staff' | 'staff' | 'trainee' | 'customer';

// 權限查詢
export interface PermissionQuery {
  action: ActionType;
  resource: ResourceType;
  resourceId?: string;
}

// 權限上下文
export interface PermissionContext {
  tenantId?: string;
  storeId?: string;
  additionalData?: Record<string, any>;
}
```

## 4. 內部實現機制

### 4.1 權限檢查流程

權限檢查的基本流程如下：

1. 驗證用戶身份和獲取用戶資訊
2. 檢查用戶角色和級別
3. 根據角色和資源確定基礎權限
4. 檢查特殊條件和業務規則
5. 返回最終權限結果

### 4.2 權限解析邏輯

權限檢查邏輯基於「核心資料模型與RBAC_v1.md」中定義的規則，主要考慮以下因素：

1. **角色等級**：超級管理員(0) > 租戶管理員(1) > 店長(2) > 班長(3) > 資深員工(4) > 一般員工(5) > 實習員工(6)
2. **租戶隔離**：確保租戶只能訪問自己的資源
3. **店鋪隔離**：確保店長和員工只能訪問自己店鋪的資源
4. **資源擁有者**：確保用戶可以操作自己的資源（例如員工查看自己的排班）
5. **特殊業務規則**：例如限制金額審批權、訂單狀態變更規則等

### 4.3 角色權限映射

從「核心資料模型與RBAC_v1.md」中提取的角色權限映射：

```typescript
// 部分示例，完整映射在實現中補充
const rolePermissionsMap: Record<RoleType, Record<ResourceType, ActionType[]>> = {
  super_admin: {
    tenants: ['create', 'read', 'update', 'delete'],
    stores: ['create', 'read', 'update', 'delete'],
    // ...全部資源的所有操作權限
  },
  tenant_admin: {
    tenants: ['read', 'update'], // 只能讀取和更新自己的租戶
    stores: ['create', 'read', 'update', 'delete'], // 可以管理自己租戶的所有分店
    employees: ['create', 'read', 'update', 'delete', 'approve'],
    // ...其他權限
  },
  store_manager: {
    stores: ['read', 'update'], // 只能讀取和更新自己的店
    employees: ['create', 'read', 'update'], // 可以管理自己店的員工
    // ...其他權限
  },
  // ...其他角色權限
};
```

### 4.4 緩存機制

為提高效能，函式庫將實現以下緩存策略：

1. **用戶資訊緩存**：緩存用戶角色、租戶等基本資訊，避免重複查詢
2. **權限結果緩存**：緩存近期的權限檢查結果，減少重複計算
3. **資源信息緩存**：緩存資源的元數據，如租戶ID、店鋪ID等

緩存將設置合理的過期時間，並在關鍵數據變更時主動清除。

## 5. 使用範例

### 5.1 Cloud Functions中使用

```typescript
import { checkPermission, requirePermission } from '../libs/rbac';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// 方式1：使用檢查函數
exports.updateEmployee = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '需要登入');
  }
  
  const { employeeId, employeeData } = data;
  const userId = context.auth.uid;
  
  // 檢查權限
  const hasPermission = await checkPermission(
    userId, 
    'update', 
    'employees', 
    employeeId,
    { tenantId: employeeData.tenantId, storeId: employeeData.storeId }
  );
  
  if (!hasPermission) {
    throw new functions.https.HttpsError('permission-denied', '沒有更新員工的權限');
  }
  
  // 執行更新操作
  return admin.firestore().collection('employees').doc(employeeId).update(employeeData);
});

// 方式2：使用權限中間件
exports.approveLeave = functions.https.onCall(
  requirePermission('approve', 'leaves', (data) => data.leaveId),
  async (data, context) => {
    // 權限檢查已在中間件完成，直接執行邏輯
    const { leaveId } = data;
    return admin.firestore().collection('leaves').doc(leaveId).update({
      status: 'approved',
      approvedBy: context.auth!.uid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
);
```

### 5.2 前端使用示例 (可選提供Frontend SDK)

```typescript
import { RBACClient } from '@friedg/rbac-client';

const rbacClient = new RBACClient();

// 檢查當前用戶權限
async function canUserManageEmployees() {
  const hasPermission = await rbacClient.checkPermission('update', 'employees');
  if (hasPermission) {
    // 顯示管理員工界面
    showEmployeeManagementUI();
  } else {
    // 隱藏或禁用相關功能
    hideEmployeeManagementUI();
  }
}

// 在組件中使用
function EmployeeListComponent() {
  const [canManage, setCanManage] = useState(false);
  
  useEffect(() => {
    rbacClient.checkPermission('update', 'employees')
      .then(result => setCanManage(result));
  }, []);
  
  return (
    <div>
      <h1>員工列表</h1>
      {canManage && <button>添加員工</button>}
      {/* ... 其他內容 */}
    </div>
  );
}
```

## 6. 安全考量

### 6.1 權限驗證的安全層級

RBAC函式庫將實現多層安全驗證：

1. **客戶端初步過濾**：前端UI基於權限隱藏/禁用功能，降低誤操作
2. **Firestore規則驗證**：數據庫層面的強制權限控制
3. **後端函數驗證**：使用RBAC函式庫進行精細權限控制
4. **資源存在性驗證**：確保被操作的資源存在且可訪問
5. **業務邏輯驗證**：確保操作符合業務規則和流程

### 6.2 防止提權攻擊

為防止提權攻擊，採取以下措施：

1. 不信任客戶端傳入的角色資訊，始終從後端獲取
2. 嚴格驗證JWT token中的claims
3. 不直接暴露角色和權限判斷的內部邏輯
4. 記錄敏感操作的審計日誌

## 7. 測試策略

為確保RBAC函式庫的正確性，將採用以下測試策略：

1. **單元測試**：測試各模組的功能正確性
2. **整合測試**：測試模組間的交互
3. **模擬測試**：使用模擬(mock)數據測試不同場景
4. **權限矩陣測試**：建立權限矩陣，驗證各角色在各資源上的權限
5. **邊界測試**：測試特殊和極端情況下的權限控制

## 8. 擴展與後續優化

### 8.1 可擴展性計劃

1. **自定義角色擴展**：支持租戶自定義角色和權限
2. **多維度權限**：擴展支持更複雜的多維度權限控制
3. **權限委派機制**：允許臨時權限委派和繼承
4. **權限分析工具**：提供權限使用情況和潛在問題分析

### 8.2 效能優化

1. **智能緩存策略**：根據使用模式自動調整緩存策略
2. **批量權限檢查**：優化同時檢查多個權限的效能
3. **權限預計算**：定期預計算和更新常用權限結果

### 8.3 後續版本規劃

1. **v1.1**：增加動態條件權限（如金額限制、時間限制）
2. **v1.2**：增加權限審計和分析功能
3. **v2.0**：支持圖形化權限管理介面

## 9. 結論

RBAC函式庫是「吃雞排找不早」系統中確保安全和業務邏輯一致性的核心組件。通過提供統一、易用的權限控制API，它將大幅降低開發複雜度，減少權限邏輯錯誤，並支持系統的長期擴展和演化。

此設計文檔定義了RBAC函式庫的整體架構、核心API和實現機制，作為開發的基礎指南。隨著系統的發展，函式庫將不斷優化和擴展，以滿足不斷變化的業務需求。 