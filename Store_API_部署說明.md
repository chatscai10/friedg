# Store API (Write Operations) 部署說明

本文檔提供Store API寫操作模組的部署指導，包括完整的部署流程、環境需求和最佳實踐。

## 1. 環境準備

### 1.1 必要工具與版本
- **Node.js**: 20.x LTS (必須)
- **Firebase CLI**: v12.x 或更高版本
- **Firebase Project**: 確保已設定好Firebase專案並連接

### 1.2 環境驗證
```bash
# 驗證Node.js版本
node -v  # 應顯示v20.x.x

# 驗證Firebase CLI版本
firebase -V  # 應顯示12.x.x或更高
```

## 2. 部署前準備

### 2.1 檢查配置文件
確保以下文件已正確設定：
- `.firebaserc`: 確認projectId設置正確
- `firebase.json`: 確認functions配置正確
- `functions/package.json`: 確認所有依賴都已安裝且版本一致

### 2.2 本地測試
在部署前，強烈建議先在本地模擬器中測試API功能：

```bash
# 啟動Firebase模擬器
cd D:\friedg
firebase emulators:start
```

使用Postman或其他工具測試以下API端點：
- `POST /api/v1/stores` (創建店鋪)
- `PUT /api/v1/stores/{storeId}` (更新店鋪)
- `PUT /api/v1/stores/{storeId}/status` (更新店鋪狀態)
- `DELETE /api/v1/stores/{storeId}` (刪除店鋪)
- `PUT /api/v1/stores/{storeId}/gps-fence` (更新GPS圍欄)
- `PUT /api/v1/stores/{storeId}/printer-config` (更新印表機配置)

## 3. 部署流程

### 3.1 部署到測試環境（建議）
如果有測試環境，請先部署到測試環境驗證：

```bash
# 部署到測試環境
cd D:\friedg
firebase use test  # 切換到測試環境
firebase deploy --only functions:stores  # 僅部署stores相關函數
```

### 3.2 部署到生產環境

```bash
# 部署到生產環境
cd D:\friedg
firebase use prod  # 切換到生產環境
firebase deploy --only functions:stores  # 僅部署stores相關函數
```

### 3.3 指定部署區域（重要）
確保部署到亞洲地區以減少延遲：

```bash
# 指定部署到亞洲地區
firebase deploy --only functions:stores --region=asia-east1
```

## 4. 部署後驗證

### 4.1 檢查部署狀態
在Firebase Console中檢查函數是否已成功部署：
1. 訪問 [Firebase Console](https://console.firebase.google.com/)
2. 選擇專案
3. 進入Functions頁面
4. 確認stores相關函數狀態為"活躍"

### 4.2 驗證API功能
使用Postman或類似工具測試生產環境中的API端點，確保：
- 認證正常工作
- 租戶隔離有效
- 適配層轉換準確
- 資料庫操作成功

## 5. 監控與日誌

### 5.1 設置監控
建議設置以下監控項目：
- 函數執行錯誤警報
- 函數執行時間過長警報（建議超過2秒）
- 函數調用次數異常警報

### 5.2 檢查日誌
部署後檢查Firebase日誌，確保無錯誤：
```bash
firebase functions:log
```

## 6. 回滾計劃

如果部署後發現嚴重問題，可以回滾到之前的版本：

```bash
# 查看之前的部署版本
firebase functions:list

# 回滾到特定版本
firebase functions:rollback <version_id> --only functions:stores
```

## 7. 最佳實踐與注意事項

1. **增量部署**: 僅部署更改的函數，減少風險
2. **非營業時段部署**: 盡量在非高峰期進行部署
3. **API版本控制**: 保持API版本穩定，避免破壞性變更
4. **監控部署後性能**: 關注冷啟動時間、平均響應時間等指標
5. **保護敏感數據**: 確保所有API請求都經過驗證和授權
6. **資源優化**: 確保函數內存設置適當（建議至少256MB）

## 8. 部署清單

最終部署前，請確認以下項目：

- [ ] 所有單元測試通過
- [ ] 所有整合測試通過
- [ ] API規範（api-specs/stores.yaml）與實現一致
- [ ] 適配層（stores.adapter.ts）已完整測試
- [ ] 租戶隔離和權限控制正確實現
- [ ] 所有依賴項已更新到兼容版本
- [ ] firebase.json配置正確
- [ ] 已進行本地測試且功能正常

---

完成上述步驟後，Store API的寫操作功能應已成功部署並可用於生產環境。 