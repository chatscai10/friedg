# 核心參數 Schema 定義

根據程式碼分析，以下是專案中核心參數的結構定義：

## 1. BusinessHours (營業時間)

在專案中發現兩種不同的 BusinessHours 定義，需要統一標準：

### 定義1 (functions/src/stores/stores.types.ts)

```json
{
  "type": "object",
  "properties": {
    "monday": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
          "end": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }
        },
        "required": ["start", "end"]
      }
    },
    "tuesday": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
          "end": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }
        },
        "required": ["start", "end"]
      }
    },
    "wednesday": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
          "end": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }
        },
        "required": ["start", "end"]
      }
    },
    "thursday": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
          "end": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }
        },
        "required": ["start", "end"]
      }
    },
    "friday": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
          "end": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }
        },
        "required": ["start", "end"]
      }
    },
    "saturday": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
          "end": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }
        },
        "required": ["start", "end"]
      }
    },
    "sunday": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
          "end": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }
        },
        "required": ["start", "end"]
      }
    },
    "holidays": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "start": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
          "end": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }
        },
        "required": ["start", "end"]
      }
    }
  },
  "required": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
}
```

### 定義2 (functions/src/discovery/types.ts)

```json
{
  "type": "object",
  "properties": {
    "day": { "type": "number", "minimum": 0, "maximum": 6 },
    "isOpen": { "type": "boolean" },
    "openTime": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
    "closeTime": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
    "breakStart": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" },
    "breakEnd": { "type": "string", "pattern": "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }
  },
  "required": ["day", "isOpen"]
}
```

## 2. Coords (分店座標)

根據 `StoreList.tsx` 和 `AttendanceList.tsx` 的使用方式，座標定義為：

```json
{
  "type": "object",
  "properties": {
    "latitude": { "type": "number" },
    "longitude": { "type": "number" },
    "radius": { "type": "number", "description": "允許的半徑範圍（單位：公尺）" }
  },
  "required": ["latitude", "longitude"]
}
```

## 3. Positions (職位)

根據程式碼分析，職位定義為角色列表，在 `ScheduleForm.tsx` 中有定義：

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { 
        "type": "string",
        "enum": ["cashier", "server", "chef", "manager", "cleaner"]
      },
      "name": { "type": "string" }
    },
    "required": ["id", "name"]
  }
}
```

## 4. ScheduleMonth (排班月份)

基於 `SchedulingPage.tsx` 中對月份的處理，表示為：

```json
{
  "type": "object",
  "properties": {
    "year": { "type": "number", "minimum": 2000, "maximum": 2100 },
    "month": { "type": "number", "minimum": 1, "maximum": 12 },
    "startDate": { "type": "string", "format": "date" },
    "endDate": { "type": "string", "format": "date" }
  },
  "required": ["year", "month"]
}
```

## 5. BranchesList (分店清單)

根據 `stores.handlers.fixed.ts` 的模擬數據結構：

```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "storeId": { "type": "string" },
      "storeName": { "type": "string" },
      "storeCode": { "type": "string" },
      "address": { "type": "string" },
      "phoneNumber": { "type": "string" },
      "contactPerson": { "type": "string" },
      "email": { "type": "string", "format": "email" },
      "tenantId": { "type": "string" },
      "isActive": { "type": "boolean" },
      "geolocation": {
        "type": "object",
        "properties": {
          "latitude": { "type": "number" },
          "longitude": { "type": "number" },
          "radius": { "type": "number" }
        },
        "required": ["latitude", "longitude"]
      },
      "businessHours": { "type": "object" }
    },
    "required": ["storeId", "storeName", "isActive", "tenantId"]
  }
}
```

## 6. DailyNeed (每日需求人數)

沒有在程式碼中找到明確的 DailyNeed 類型定義，但從 `SchedulingSetting` 的部分屬性推測可能的結構為：

```json
{
  "type": "object",
  "properties": {
    "date": { "type": "string", "format": "date" },
    "storeId": { "type": "string" },
    "minStaffPerShift": { 
      "type": "object",
      "additionalProperties": { "type": "number" }
    },
    "roles": {
      "type": "object",
      "additionalProperties": { "type": "number" }
    }
  },
  "required": ["date", "storeId", "minStaffPerShift"]
}
```

## 結論與建議

1. **格式統一問題**：
   - BusinessHours 有兩種不同的定義方式，需要統一
   - Coords 在不同文件中可能有不同的命名方式（coords, geolocation 等）

2. **強型別定義**：
   - 建議為所有核心參數建立正式的 TypeScript 介面定義
   - 使用 zod 或類似的庫進行運行時驗證

3. **文檔化**：
   - 為核心參數建立統一的中央文檔
   - 添加說明描述每個參數的用途與限制

4. **驗證實現**：
   - 實作統一的驗證邏輯，確保所有程式碼使用同樣的參數結構 