# 依賴清理建議 PR

根據 depcheck 分析結果，以下是對專案依賴項的處理建議：

## 1. 未使用的依賴

以下套件在專案中沒有被直接使用，建議移除：

### 生產依賴 (dependencies)

```bash
npm uninstall @mui/x-date-pickers @tanstack/react-query axios dayjs formik react-router-dom yup
```

| 套件名 | 移除建議 | 備註 |
|-------|---------|------|
| @mui/x-date-pickers | 確認不會在動態組件中使用後移除 | 日期選取器組件，請確認專案中未計劃使用 |
| @tanstack/react-query | 確認不會用於資料獲取後移除 | 強大的資料獲取工具，請確認專案未使用 |
| axios | 確認不會用於 API 請求後移除 | HTTP 客戶端，可能在某些組件中動態載入 |
| dayjs | 確認不會用於日期處理後移除 | 日期處理工具，可能被 MUI 組件內部使用 |
| formik | 確認不會用於表單處理後移除 | 表單處理工具，請確認專案中未計劃使用 |
| react-router-dom | 確認不會用於路由後移除 | 路由組件，請確認專案中未使用路由功能 |
| yup | 確認不會用於表單驗證後移除 | 常與 formik 一起使用的表單驗證庫 |

### 開發依賴 (devDependencies)

```bash
npm uninstall @eslint/js @types/jest depcheck eslint-plugin-jsdoc eslint-plugin-react-hooks eslint-plugin-react-refresh globals jsdoc prettier typescript-eslint
```

| 套件名 | 移除建議 | 備註 |
|-------|---------|------|
| @eslint/js | 確認 ESLint 配置不依賴後移除 | 可能在 ESLint 配置中被引用 |
| @types/jest | 如使用 vitest 不需要此依賴可移除 | TypeScript 中的 Jest 類型定義 |
| depcheck | 僅用於分析依賴的工具可移除 | 保留以方便未來依賴分析 |
| eslint-plugin-jsdoc | 不需要 JSDoc 檢查可移除 | 用於驗證 JSDoc 註解 |
| eslint-plugin-react-hooks | 不需要 React Hooks 檢查可移除 | React Hooks 規則檢查 |
| eslint-plugin-react-refresh | 不需要 React 重新加載檢查可移除 | Vite 的 React 快速重新加載插件 |
| globals | 確認不在 ESLint 配置中使用後移除 | 常用於 ESLint 配置中定義全局變量 |
| jsdoc | 如不需要生成文檔可移除 | 用於生成代碼文檔 |
| prettier | 如不需要程式碼格式化可移除 | 代碼格式化工具 |
| typescript-eslint | 確認與 TypeScript ESLint 插件不衝突後移除 | 可能會與 @typescript-eslint 混淆 |

## 2. 丟失的依賴

以下套件在專案中被使用但未在 package.json 中聲明：

```bash
npm install --save-dev express
```

✅ 已完成

| 套件名 | 安裝建議 | 使用位置 |
|-------|---------|---------|
| express | ✅ 已安裝為開發依賴 | 在測試文件中使用：<br>- D:\friedg\test\menus\menuCategory.handlers.test.ts<br>- D:\friedg\src\menus\__tests__\simple.menuItem.test.ts |

## 3. 可能有問題的文件

以下文件解析時 depcheck 報告有問題，但實際檢查後發現代碼已經正確：

- `src/menus/menuItem.handlers.ts` - depcheck 報告缺少 catch 或 finally 子句，但實際檢查檔案後發現已包含完整的 try-catch 區塊。

## 行動建議

1. ✅ 已修復 `src/menus/menuItem.handlers.ts` 中的語法錯誤
2. ✅ 已安裝丟失的依賴 express
3. 下一步：檢查所有"未使用"的依賴，確認它們確實不被需要後再移除
4. 對於一些核心框架依賴（如 react-router-dom），建議在確認專案未來不會使用它們後再移除 