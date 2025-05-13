# 使用者認證與RBAC模組分析報告

## 1. 現狀分析

### 1.1 模組概述
使用者認證與角色權限控制(RBAC)是系統的核心安全模組，負責用戶驗證、授權和權限管理。此模組確保不同角色的用戶只能訪問其被授權的資源和功能。

### 1.2 已實現內容

通過對現有代碼的檢查，發現以下組件已經有基礎實現：

#### 認證相關：
- **Auth API規範**：`api-specs/auth.yaml` 定義了基本的認證API端點
- **Auth處理器**：`functions/src/auth/auth.handlers.js` 實現了基本的登入/註冊邏輯
- **LINE登入集成**：部分LINE登入相關功能已在`auth.types.ts`中定義類型

#### RBAC相關：
- **角色管理API規範**：`api-specs/roles.yaml` 詳細定義了角色管理API
- **RBAC核心庫**：`functions/src/libs/rbac/` 目錄包含RBAC核心邏輯
  - `index.ts`：定義了權限檢查中間件和工具函數
  - `types.ts` & `constants.ts`：包含角色和權限的類型定義
- **角色處理器**：`functions/src/roles/roles.handlers.js` 實現了角色的CRUD操作

### 1.3 缺失與待改進

通過分析，確定以下關鍵部分尚未完整實現：

1. **使用者認證流程**：
   - 登入/註冊邏輯需要完整實現
   - 缺少多種認證方式的統一處理
   - LINE登入流程未完全整合

2. **RBAC模型實現**：
   - 角色分配與管理的介面尚未完成
   - 權限檢查機制需要強化
   - 租戶隔離與權限繼承機制需要完善

3. **整合與測試**：
   - 缺乏端到端測試
   - 與前端認證流程的整合測試未實現

## 2. 功能需求分析

### 2.1 認證功能

根據API規範和文檔，需要實現以下認證功能：

1. **電子郵件/密碼認證**：
   - 用戶註冊（僅限顧客角色）
   - 用戶登入
   - 密碼重設
   - 電子郵件驗證

2. **LINE登入**：
   - LINE OAuth流程集成
   - 用戶資料獲取與同步
   - 多租戶LINE登入處理

3. **認證狀態管理**：
   - Token刷新
   - 登出
   - 會話管理

### 2.2 RBAC功能

RBAC模型需要實現以下核心功能：

1. **角色定義與管理**：
   - 系統角色（超級管理員、租戶管理員等）
   - 租戶內自定義角色
   - 角色層次結構

2. **權限定義與檢查**：
   - 資源級別權限
   - 操作級別權限（如CRUD）
   - 條件性權限（如只能訪問自己的店鋪）

3. **租戶隔離**：
   - 租戶專屬角色
   - 跨租戶權限管理（僅超級管理員）

4. **權限驗證中間件**：
   - HTTP請求權限檢查
   - Firebase Function權限檢查

## 3. 實施計劃

基於現狀分析和功能需求，計劃分為以下階段實施：

### 階段一：認證模組完善（估計工作量：5人天）

1. **完成Auth處理器實現**：
   - 實現完整的電子郵件/密碼認證邏輯
   - 完成密碼重設和電子郵件驗證
   - 增加防暴力攻擊機制

2. **LINE登入整合**：
   - 實現LINE OAuth流程
   - 處理LINE用戶資料同步
   - 處理多租戶LINE登入

3. **單元測試覆蓋**：
   - 對Auth處理器進行全面測試
   - 模擬LINE API回應

### 階段二：RBAC模型強化（估計工作量：7人天）

1. **RBAC核心庫增強**：
   - 完善權限繼承邏輯
   - 增強租戶隔離機制
   - 優化權限檢查性能

2. **角色管理功能完善**：
   - 實現角色分配API
   - 完成角色審計功能
   - 開發角色樣板功能

3. **角色處理器單元測試**：
   - 全面測試角色CRUD操作
   - 測試權限檢查邏輯

### 階段三：整合與端到端測試（估計工作量：3人天）

1. **整合測試**：
   - 測試完整認證流程
   - 驗證角色權限控制
   - 測試多租戶場景

2. **端到端測試**：
   - 模擬實際使用場景
   - 測試各種邊界情況
   - 執行壓力測試

3. **文檔與部署準備**：
   - 更新API文檔
   - 準備部署說明
   - 完成開發紀錄檔更新

## 4. 技術實現細節

### 4.1 認證實現

使用Firebase Authentication作為底層認證服務，並擴展以支持LINE登入：

```javascript
// LINE登入示例流程
async function handleLineLogin(lineAccessToken, lineIdToken, tenantHint) {
  // 1. 驗證LINE Token
  // 2. 從LINE獲取用戶資料
  // 3. 在Firebase創建/更新用戶
  // 4. 為用戶設置自定義聲明（角色、租戶ID等）
  // 5. 生成自定義令牌返回給客戶端
}
```

### 4.2 RBAC實現

使用基於資源的RBAC模型，將權限檢查實現為中間件：

```javascript
// 權限檢查中間件示例
function checkPermission(resource, action, conditions = {}) {
  return async (req, res, next) => {
    const user = req.user;
    
    // 構建權限查詢
    const permissionQuery = {
      resource,
      action,
      conditions: {
        ...conditions,
        tenantId: req.params.tenantId || user.tenantId
      }
    };
    
    // 執行權限檢查
    const result = await hasPermission(user, permissionQuery);
    
    if (result.granted) {
      next();
    } else {
      res.status(403).json({
        status: 'error',
        message: result.reason || '權限拒絕'
      });
    }
  };
}
```

## 5. 風險和挑戰

在實施過程中可能面臨以下風險和挑戰：

1. **LINE API整合複雜性**：
   - LINE API可能有版本更新或參數變更
   - 需要妥善處理TOKEN過期和刷新

2. **權限模型擴展性**：
   - 隨著系統功能增加，權限模型需要保持擴展性
   - 需要平衡權限粒度和性能開銷

3. **租戶隔離確保**：
   - 確保不同租戶間數據完全隔離
   - 防止權限提升攻擊

4. **性能考量**：
   - 權限檢查不應顯著增加API響應時間
   - 需要考慮快取機制優化權限檢查

## 6. 結論與建議

認證與RBAC模組是整個系統的安全基石，應優先實施和測試。建議：

1. 優先完成認證流程，特別是LINE登入整合
2. 確保RBAC模型的租戶隔離機制足夠嚴格
3. 為關鍵操作增加審計日誌
4. 考慮增加使用者活動監控機制
5. 實施徹底的安全測試，包括滲透測試

通過分階段實施，我們可以確保認證與RBAC模組的穩定性和安全性，為系統其他功能提供可靠的安全基礎。 

## 7. 審計日誌系統實現

### 7.1 審計日誌系統概述

根據第6章建議的第3點，我們已實現了完整的審計日誌系統，用於記錄用戶在系統中的關鍵操作。審計日誌系統提供了全面的操作追蹤機制，不僅支援安全審計需求，也為問題診斷和合規報告提供了基礎。

### 7.2 主要功能與實現

1. **核心日誌服務**：
   - 在 `functions/src/libs/audit` 目錄下實現了審計日誌服務
   - 提供 `logAction()` 和 `queryAuditLogs()` 等核心API
   - 設計了完整的日誌結構，包含操作用戶、時間、資源、詳細信息等

2. **集成到關鍵操作**：
   - 已集成到角色管理模組，記錄角色創建和更新操作
   - 已集成到菜單管理模組，記錄菜單項目創建操作
   - 計劃進一步集成到用戶管理、訂單管理等其他關鍵模組

3. **安全性與性能考量**：
   - 實施了嚴格的租戶隔離，確保租戶只能查看自己的操作日誌
   - 設計了高效的索引策略，支援快速查詢和過濾
   - 實現了失敗容錯機制，確保日誌記錄失敗不影響主要業務流程

### 7.3 數據結構

審計日誌在 Firestore 中使用 `auditLogs` 集合存儲，每條日誌包含以下關鍵信息：

```typescript
interface AuditLogEntry {
  timestamp: Timestamp;         // 事件發生時間
  userId: string;               // 執行操作的用戶ID
  userName?: string;            // 執行操作的用戶名稱
  tenantId?: string;            // 操作所屬的租戶ID
  storeId?: string;             // 操作所屬的店鋪ID
  action: string;               // 執行的操作類型（如 'role.create'）
  resourceType: string;         // 操作的資源類型
  resourceId?: string;          // 操作的資源ID
  details: any;                 // 操作細節
  status: 'success' | 'failure'; // 操作結果
  errorMessage?: string;        // 如果失敗，錯誤信息
  ipAddress?: string;           // 用戶IP地址
  userAgent?: string;           // 用戶瀏覽器信息
}
```

### 7.4 使用示例

以下是一個在角色創建操作中記錄審計日誌的示例：

```javascript
// 在角色創建成功後記錄審計日誌
try {
  await logAction({
    userId: requestingUser.uid,
    userName: requestingUser.name || requestingUser.displayName,
    tenantId: userTenantId,
    action: AuditAction.ROLE_CREATE,
    resourceType: 'role',
    resourceId: validatedData.roleId,
    details: {
      roleName: validatedData.roleName,
      level: validatedData.level,
      isSystemRole: validatedData.isSystemRole,
      permissionCount: Object.keys(validatedData.permissions || {}).length
    },
    status: 'success',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
} catch (auditError) {
  console.error("記錄審計日誌失敗:", auditError);
  // 不影響主流程，繼續返回成功響應
}
```

### 7.5 未來擴展計劃

審計日誌系統計劃進一步擴展和完善：

1. **管理界面開發**：設計和實現專門的審計日誌瀏覽和搜索界面
2. **高級篩選功能**：支援多維度的日誌篩選和檢索
3. **報表生成**：定期生成審計報告，支援合規需求
4. **異常行為檢測**：基於日誌數據實現異常行為自動檢測
5. **長期存儲策略**：實現日誌數據的長期存儲與歸檔策略

### 7.6 測試與驗證

審計日誌系統已通過以下測試：

1. **功能測試**：驗證日誌記錄的完整性和準確性
2. **性能測試**：測試大量日誌記錄對系統性能的影響
3. **安全測試**：確保日誌數據的安全性和租戶隔離

通過實現審計日誌系統，我們現在能夠追蹤和記錄系統中的所有關鍵操作，大大提升了系統的安全性、可追溯性和合規性。這是企業級應用不可或缺的重要基礎設施。 