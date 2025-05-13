$content = Get-Content -Path .\整合專案報告.txt -Raw
$menuItems = Get-Content -Path .\menuItems_update.md -Raw

$searchStr = "updatedAt    | timestamp  | 是   | Firestore Timestamp格式                  | 更新時間 |`r`n`r`n---`r`n`r`n【⚡️ 每一個表格我會這樣全欄位規範！】"
$replaceStr = "updatedAt    | timestamp  | 是   | Firestore Timestamp格式                  | 更新時間 |`r`n`r`n---`r`n`r`n$menuItems`r`n`r`n【⚡️ 每一個表格我會這樣全欄位規範！】"

$updatedContent = $content -replace [regex]::Escape($searchStr), $replaceStr
$updatedContent | Set-Content -Path .\整合專案報告_更新.txt -Encoding UTF8

Write-Host "檔案已更新成功！完成後請檢查整合專案報告_更新.txt" 