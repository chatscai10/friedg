# Store API 與 OpenAPI 規範一致性調整計劃

## 問題概述

經過檢查發現，`api-specs/stores.yaml` 中定義的API規範與 `functions/src/stores/` 目錄下的實際代碼實現存在一些不一致的地方。這些差異可能會導致前端開發時的混淆，以及API文檔與實際行為不符的問題。

## 主要差異點

### 1. 模型字段命名差異

| OpenAPI 規範         | 代碼實現             | 說明                           |
|---------------------|---------------------|-------------------------------|
| `name`              | `storeName`         | 店鋪名稱字段命名不同            |
| `status`            | `isActive`          | 狀態管理方式不同（枚舉vs布爾值） |
| `contactInfo.email` | `email`             | 聯絡信息在實現中使用平鋪結構    |
| `contactInfo.phone` | `phoneNumber`       | 聯絡電話字段命名不同            |
| N/A                 | `contactPerson`     | 聯絡人在規範中未明確定義        |
| `id`                | `storeId`           | 店鋪ID字段命名不同              |

### 2. 結構差異

- OpenAPI規範使用嵌套對象（如`contactInfo`、`address`），而代碼實現傾向於使用平鋪結構
- OpenAPI規範中的`status`使用枚舉類型（`active`, `inactive`, `temporary_closed`, `permanently_closed`），而實現僅使用布爾型`isActive`和`isDeleted`
- 實現中添加了`createdBy`和`updatedBy`追蹤欄位，這在規範中未明確定義

### 3. 端點差異

- OpenAPI規範未明確定義GPS圍欄和印表機配置的專用端點，而實現中有專門的端點
- 規範中未明確說明是否支持物理刪除，而實現中通過查詢參數`hardDelete`支持

## 建議解決方案

有兩種主要的調整方向：

### 方案A：修改代碼以符合API規範

1. 在`stores.types.ts`中修改模型定義，使用與規範一致的字段名
2. 在`stores.service.ts`和`stores.handlers.ts`中相應修改字段名稱
3. 修改數據存儲邏輯，將狀態從布爾值改為枚舉類型
4. 重新組織數據結構，使用嵌套對象

優點：保持API規範作為權威來源
缺點：需要大量修改現有代碼，可能引入回歸問題

### 方案B：修改API規範以符合實現

1. 更新`api-specs/stores.yaml`，修改字段名稱以匹配實現
2. 修改數據模型，將狀態從枚舉改為布爾值組合
3. 添加專用端點的規範定義（GPS圍欄、印表機配置）
4. 扁平化結構定義以匹配代碼實現

優點：最小化代碼變更，降低風險
缺點：已經發布的API文檔需要更新，可能影響前端開發

### 方案C：適配層解決方案（推薦）

1. 保持內部實現不變
2. 在處理器層添加轉換邏輯，將內部模型映射到API規範定義的模型
3. 在請求處理時將API模型轉換為內部模型，在響應時反向轉換

優點：
- 最小化風險，不需要修改核心業務邏輯
- 保持API規範和代碼實現的獨立性
- 為後續重構提供彈性

缺點：
- 需要額外的轉換邏輯
- 可能增加少量運行時開銷

## 建議行動計劃

1. 採用方案C（適配層方案）作為短期解決方案
2. 創建轉換函數 `toApiModel` 和 `fromApiModel`，在處理器中使用
3. 更新單元測試以覆蓋轉換邏輯
4. 為API規範添加專用端點的定義（保持向後兼容）
5. 在後續迭代中考慮完全統一API規範和實現（方案A或B）

## 示例轉換代碼

```typescript
// 從API請求模型轉換為內部模型
function fromApiModel(apiStore: ApiStore): InternalStore {
  return {
    storeId: apiStore.id,
    storeName: apiStore.name,
    isActive: apiStore.status === 'active',
    isDeleted: apiStore.status === 'permanently_closed',
    // ... 其他字段轉換
  };
}

// 從內部模型轉換為API響應模型
function toApiModel(internalStore: InternalStore): ApiStore {
  let status: 'active' | 'inactive' | 'temporary_closed' | 'permanently_closed';
  
  if (internalStore.isDeleted) {
    status = 'permanently_closed';
  } else if (internalStore.isActive) {
    status = 'active';
  } else {
    status = 'inactive';
  }
  
  return {
    id: internalStore.storeId,
    name: internalStore.storeName,
    status,
    // ... 其他字段轉換
  };
}
```

## 時間線

1. 第一週：實現適配層轉換邏輯
2. 第二週：更新單元測試和API規範文檔
3. 第三週：與前端團隊協調並確認變更
4. 長期計劃：在未來迭代中完全統一API規範和實現

## 責任

- 後端團隊：實現適配層轉換邏輯
- API文檔負責人：更新OpenAPI規範以添加缺失的端點定義
- QA團隊：驗證API行為與規範的一致性

## 結論

通過實施適配層解決方案，我們可以立即解決API規範與實現之間的不一致問題，同時為長期的架構改進留出空間。這種方法可以最小化風險，同時確保API的穩定性和一致性。 