### ✅ MenuItems（菜單品項資料表）

| 欄位名           | 型態        | 必填 | 驗證規則                                | 說明 |
|-----------------|------------|-----|----------------------------------------|-----|
| id              | string     | 是   | UUID格式                               | 菜單品項ID |
| tenantId        | string     | 是   | UUID格式                               | 所屬租戶 |
| name            | string     | 是   | 1~100字                                | 品項名稱 |
| description     | string     | 否   | 最多500字                               | 品項描述 |
| categoryId      | string     | 是   | UUID格式                               | 所屬分類ID |
| categoryName    | string     | 是   | 1~50字，冗餘欄位，方便顯示                | 所屬分類名稱 |
| price           | number     | 是   | >=0                                    | 價格 |
| discountPrice   | number     | 否   | >=0                                    | 折扣價格 |
| costPrice       | number     | 否   | >=0                                    | 成本價格 |
| imageUrl        | string     | 否   | URL格式                                | 圖片URL |
| thumbnailUrl    | string     | 否   | URL格式                                | 縮略圖URL |
| stock           | number     | 否   | >=0, 整數                              | 庫存數量 |
| stockStatus     | string     | 是   | enum: ['in_stock', 'low_stock', 'out_of_stock'] | 庫存狀態 |
| unit            | string     | 否   | 最多20字                               | 計量單位 |
| preparationTime | number     | 否   | >=0, 整數                              | 準備時間(分鐘) |
| isRecommended   | boolean    | 是   | true/false                             | 是否推薦 |
| isSpecial       | boolean    | 是   | true/false                             | 是否特選 |
| isActive        | boolean    | 是   | true/false                             | 是否啟用 |
| displayOrder    | number     | 否   | >=0, 整數                              | 顯示順序 |
| availableOptions| array      | 否   | 陣列內為選項組物件                        | 可選選項組 |
| nutritionInfo   | map        | 否   | 包含calories, protein, carbs, fat等欄位 | 營養成分 |
| tags            | array      | 否   | 字串陣列                                | 標籤 |
| createdAt       | timestamp  | 是   | Firestore Timestamp格式                | 創建時間 |
| updatedAt       | timestamp  | 是   | Firestore Timestamp格式                | 更新時間 |

**特別約定事項：**

1. **庫存(`stock`)欄位處理約定**：
   * **說明**：`stock` 欄位型別為 `number`。
   * **約定**：如果品項需要庫存管理，則 `stock` 欄位必須存在且為一個非負整數。如果品項為無限量供應（無需庫存管理），則該品項數據中可以**不包含** `stock` 欄位，或者 `stock` 欄位的值為 `undefined`。系統在檢查庫存時，若 `stock` 欄位不存在或為 `undefined`，將視為無限庫存。

2. **品項選項組(`availableOptions`)欄位結構**：
   * **說明**：`availableOptions` 欄位型別為 `Array<Object>`，定義該品項所有可供顧客選擇的客製化種類。它儲存在 `menuItems` 各個文檔中。
   * **陣列元素結構**：`availableOptions` 陣列中的每一個元素都是一個物件，代表一個客製化種類（例如：甜度、冰塊、加料）。該物件應至少包含以下欄位：
       * `id: string` - 此客製化種類的唯一ID (例如 `"sugar_level"`, `"ice_level"`, `"toppings"`)。
       * `name: string` - 此客製化種類的顯示名稱 (例如 `"甜度"`, `"冰塊"`, `"加料"`)。
       * `choices: Array<Object>` - 一個包含此種類下所有可選項值的陣列。每個 `choice` 物件應包含：
           * `value: string` - 該選項值的具體內容 (例如 `"半糖"`, `"少冰"`, `"珍珠"`)。
           * `additionalPrice: number` (建議必填，無額外費用則為0) - 選擇此選項值需要額外增加的價格。
   * **範例** (`menuItems` 文件中的 `availableOptions` 結構):
       ```json
       // In a menuItem document:
       "availableOptions": [
         {
           "id": "sugar_level",
           "name": "甜度",
           "choices": [
             { "value": "全糖", "additionalPrice": 0 },
             { "value": "少糖", "additionalPrice": 0 },
             { "value": "半糖", "additionalPrice": 0 }
           ]
         },
         {
           "id": "toppings",
           "name": "加料",
           "choices": [
             { "value": "珍珠", "additionalPrice": 10 },
             { "value": "椰果", "additionalPrice": 10 }
           ]
         }
       ]
       ```

3. **訂單中選項記錄**：
   * **說明**：在訂單的每個品項 (`OrderItem`) 中，`options` 欄位型別為 `Array<Object>`，記錄顧客針對該品項所選擇的客製化選項。這些資訊是從 `menuItem.availableOptions` 中選定後，複製並可能加上實時價格資訊而來。
   * **陣列元素結構**：`OrderItem.options` 陣列中的每一個元素都是一個物件，代表一個顧客已選的選項值。該物件應至少包含以下欄位：
       * `optionId: string` - 所選的客製化種類的唯一ID (對應 `menuItem.availableOptions[].id`，例如 `"sugar_level"`)。
       * `optionName: string` - 所選的客製化種類的顯示名稱 (對應 `menuItem.availableOptions[].name`，例如 `"甜度"`)。
       * `value: string` - 所選的具體選項值 (例如 `"半糖"`)。
       * `additionalPrice: number` - 選擇此選項值額外增加的價格（此價格應為下單時從 `menuItem.availableOptions[].choices[]` 中獲取並確定的）。
   * **範例** (`OrderItem.options` 結構):
       ```json
       // In an OrderItem:
       "options": [
         { "optionId": "sugar_level", "optionName": "甜度", "value": "半糖", "additionalPrice": 0 },
         { "optionId": "toppings", "optionName": "加料", "value": "珍珠", "additionalPrice": 10 }
       ]
       ```

4. **範例**：
   * 菜單品項中定義可選選項：
     ```json
     "availableOptions": [
       {
         "id": "sugar_level",
         "name": "甜度",
         "required": true,
         "multiSelect": false,
         "minSelect": 1,
         "maxSelect": 1,
         "choices": [
           { "name": "全糖", "additionalPrice": 0, "isDefault": true },
           { "name": "半糖", "additionalPrice": 0 },
           { "name": "微糖", "additionalPrice": 0 },
           { "name": "無糖", "additionalPrice": 0 }
         ]
       },
       {
         "id": "toppings",
         "name": "加料",
         "required": false,
         "multiSelect": true,
         "minSelect": 0,
         "maxSelect": 3,
         "choices": [
           { "name": "珍珠", "additionalPrice": 10 },
           { "name": "椰果", "additionalPrice": 10 },
           { "name": "芋圓", "additionalPrice": 15 }
         ]
       }
     ]
     ```
   * 訂單中記錄的選擇：
     ```json
     "options": [
       { "optionId": "sugar_level", "optionName": "甜度", "value": "半糖", "additionalPrice": 0 },
       { "optionId": "toppings", "optionName": "加料", "value": "珍珠", "additionalPrice": 10 }
     ]
     ``` 