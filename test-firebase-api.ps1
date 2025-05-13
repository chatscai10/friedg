# Firebase Functions API 測試腳本
Write-Host "開始測試Firebase Functions API...`n" -ForegroundColor Cyan

function Wait-Seconds {
    param ([int]$seconds)
    Write-Host "等待 $seconds 秒..." -ForegroundColor Gray
    Start-Sleep -Seconds $seconds
}

# 測試顯示Firebase專案ID
Write-Host "獲取Firebase專案ID..." -ForegroundColor Yellow
firebase use

# 編譯TypeScript
Write-Host "`n編譯Firebase Functions..." -ForegroundColor Yellow
Set-Location -Path "functions"
npm run build
Set-Location -Path ".."

# 啟動Firebase模擬器 (如果已在運行則跳過此步驟)
Write-Host "`n啟動Firebase Functions模擬器..." -ForegroundColor Yellow
Write-Host "請確保模擬器已經啟動 (firebase emulators:start --only functions)" -ForegroundColor Yellow
Wait-Seconds 3

# 測試直接訪問Function URL
Write-Host "`n測試Function API (區域asia-east1)..." -ForegroundColor Yellow
$baseUrl = "http://localhost:5002/friedg/asia-east1/api"

# 測試函數根路徑
Write-Host "`n測試API根路徑: $baseUrl/" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/" -Method GET
    Write-Host "狀態碼: $($response.StatusCode)" -ForegroundColor Green
    $response.Content
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

# 測試健康檢查
Write-Host "`n測試健康檢查: $baseUrl/health" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET
    Write-Host "狀態碼: $($response.StatusCode)" -ForegroundColor Green
    $response.Content
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

# 測試測試端點
Write-Host "`n測試測試端點: $baseUrl/test" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/test" -Method GET
    Write-Host "狀態碼: $($response.StatusCode)" -ForegroundColor Green
    $response.Content
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

# 測試新增的API測試端點
Write-Host "`n測試新API測試端點: $baseUrl/api/test" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/test" -Method GET
    Write-Host "狀態碼: $($response.StatusCode)" -ForegroundColor Green
    $response.Content
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

# 測試testApi函數
Write-Host "`n測試testApi函數..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5002/friedg/us-central1/testApi" -Method GET
    Write-Host "狀態碼: $($response.StatusCode)" -ForegroundColor Green
    $response.Content
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

Write-Host "`nAPI測試完成!" -ForegroundColor Green 