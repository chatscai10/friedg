$sourceFile = ".\整合專案報告.txt"
$tempFile = ".\整合專案報告_temp.txt"
$menuItemsFile = ".\整合專案報告_完整版.txt"

# 獲取整個文件內容
$sourceContent = Get-Content -Path $sourceFile -Raw
$menuItemsContent = Get-Content -Path $menuItemsFile -Raw

# 查找Customers表格的updatedAt行之後的分隔線
$pattern = "\| updatedAt\s+\| timestamp\s+\| 是\s+\| Firestore Timestamp格式\s+\| 更新時間 \|\s+\r?\n\s*\r?\n---\s+\r?\n\s*\r?\n【⚡️ 每一個表格我會這樣全欄位規範！】"
$replacement = $menuItemsContent

# 替換內容
$newContent = $sourceContent -replace $pattern, $replacement

# 輸出到臨時檔案
$newContent | Out-File -FilePath $tempFile -Encoding UTF8

# 備份原文件
Copy-Item -Path $sourceFile -Destination "$sourceFile.bak" -Force

# 用新檔案替換原文件
Move-Item -Path $tempFile -Destination $sourceFile -Force

Write-Host "操作完成！內容已成功更新至 $sourceFile" 