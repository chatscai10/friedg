# 參數 Schema 一致性檢查報告

經過對程式碼中核心參數使用的掃描分析，我們發現了以下潛在的不一致之處：

## 1. BusinessHours (營業時間) 不一致問題

### 問題描述

專案中存在兩種不同的 BusinessHours 定義模式：

1. **按星期命名的物件模式**：在 `functions/src/stores/stores.types.ts` 中定義，使用 monday, tuesday 等作為屬性名
2. **陣列模式**：在 `functions/src/discovery/types.ts` 中定義，使用 day (0-6) 表示星期幾

### 不一致檔案

| 檔案 | 行號 | 問題描述 |
|------|------|----------|
| `functions/src/stores/stores.handlers.fixed.ts` | 19-27 | 使用星期命名物件模式 |
| `functions/src/attendance/attendance.service.ts` | 302-330 | 使用索引方式訪問 `businessHours[dayOfWeek]` |
| `web-admin/src/types/store.ts` | 23-28 | 使用陣列模式，每個物件包含 day 屬性 |
| `web-admin/src/components/StoreManagement/StoreSettingsForm.tsx` | 402-420 | 使用陣列模式，展示和編輯 operatingHours 陣列 |

## 2. Coords (分店座標) 不一致問題

### 問題描述

座標相關的欄位在不同檔案中有不同命名和結構：

1. **coords**: 某些檔案中直接使用 coords 命名
2. **geolocation**: 在 `stores.handlers.fixed.ts` 中使用 geolocation 命名
3. **使用解構**: 部分檔案直接使用 latitude, longitude 作為獨立欄位

### 不一致檔案

| 檔案 | 行號 | 問題描述 |
|------|------|----------|
| `functions/src/stores/stores.handlers.fixed.ts` | 11-15 | 使用 geolocation 物件 |
| `web-admin/src/components/AttendanceManagement/AttendanceList.tsx` | 143-146 | 格式化座標使用獨立的 lat, lng 參數 |
| `web-admin/src/components/AttendanceManagement/AttendanceList.tsx` | 372-377 | 使用 latitude, longitude 作為獨立欄位 |

## 3. Positions (職位) 不一致問題

### 問題描述

職位/角色定義在不同檔案中有不同表示方式：

1. **預設角色列表**: 在 `web-admin/src/components/Scheduling/ScheduleForm.tsx` 中定義為物件陣列
2. **直接使用字串**: 某些檔案中直接使用角色字串值
3. **使用 roleNameMap**: 某些元件使用映射表來處理顯示名稱

### 不一致檔案

| 檔案 | 行號 | 問題描述 |
|------|------|----------|
| `web-admin/src/components/Scheduling/ScheduleForm.tsx` | 34-43 | 定義為 `{ id: ScheduleRole; name: string }[]` |
| `web-admin/src/pages/SchedulingPage.tsx` | 167-177 | 使用 switch 語句來根據角色字串獲取顏色 |

## 4. ScheduleMonth (排班月份) 不一致問題

### 問題描述

沒有找到明確的 ScheduleMonth 物件定義，但日期/月份處理方式不一致：

1. **使用 Date 物件**: 大部分使用 JavaScript Date 物件
2. **使用字串**: 某些地方使用 YYYY-MM-DD 格式字串
3. **缺少統一處理日期範圍的函數**: 不同檔案使用不同方式計算日期範圍

### 不一致檔案

| 檔案 | 行號 | 問題描述 |
|------|------|----------|
| `web-admin/src/pages/SchedulingPage.tsx` | 187-195 | 使用 Date 物件處理月份變更 |
| `functions/src/scheduling/scheduling.types.ts` | 75-77 | 使用字串格式 YYYY-MM-DD 定義日期範圍 |
| `functions/src/equity/schedule.handlers.ts` | 509-518 | 自訂函數計算月份差異 |

## 5. BranchesList (分店清單) 不一致問題

### 問題描述

分店清單結構在不同檔案中略有差異：

1. **模擬數據**: 在 `functions/src/stores/stores.handlers.fixed.ts` 中的結構
2. **前端元件**: 在 `web-admin/src/components/StoreManagement/StoreList.tsx` 中的使用方式
3. **欄位命名**: 某些檔案使用 id 而非 storeId

### 不一致檔案

| 檔案 | 行號 | 問題描述 |
|------|------|----------|
| `functions/src/stores/stores.handlers.fixed.ts` | 4-78 | 定義了詳細的分店結構，使用 storeId |
| `web-admin/src/components/StoreManagement/StoreList.tsx` | 365-397 | 表格顯示時使用不同的欄位集合 |
| `web-admin/src/pages/SchedulingPage.tsx` | 162 | 使用 store.id 而非 storeId |

## 6. DailyNeed (每日需求人數) 不一致問題

### 問題描述

在程式碼中沒有找到明確的 dailyNeed 結構定義，相關功能可能散落在不同檔案中：

1. **SchedulingSetting**: 在 `functions/src/scheduling/handlers.ts` 中包含 minStaffPerShift
2. **缺少集中定義**: 沒有找到專門的每日需求人數物件定義

### 不一致檔案

| 檔案 | 行號 | 問題描述 |
|------|------|----------|
| `functions/src/scheduling/handlers.ts` | 669-677 | SchedulingSetting 包含 minStaffPerShift 但缺少日期維度 |

## 建議解決方案

1. **統一定義核心參數**:
   - 建立一個中央型別定義檔 `types/core-params.ts`
   - 使用 TypeScript 介面明確定義所有核心參數結構

2. **營業時間統一**:
   - 選擇一種 BusinessHours 表示方式，推薦使用星期命名的物件方式
   - 提供工具函數在兩種格式間轉換

3. **建立驗證機制**:
   - 使用 zod 或類似庫定義驗證方案
   - 在資料輸入點統一驗證

4. **更新不一致的使用處**:
   - 逐步更新所有不一致的使用點
   - 追加自動化測試確保一致性

5. **文檔化**:
   - 創建參數使用指南，明確說明正確的使用方式
   - 在程式碼中添加註釋說明物件結構 