# Firebase Functions Ping測試腳本
Write-Host "開始測試Firebase Functions /ping端點...`n" -ForegroundColor Cyan

# 等待函數
function Wait-Seconds {
    param ([int]$seconds)
    Write-Host "等待 $seconds 秒..." -ForegroundColor Gray
    Start-Sleep -Seconds $seconds
}

# 設置可能的URL列表
$possibleUrls = @(
    "http://localhost:5002/friedg/asia-east1/api/ping",
    "http://127.0.0.1:5002/friedg/asia-east1/api/ping",
    "http://localhost:5002/api/ping",
    "http://localhost:5000/api/ping",
    "http://localhost:5002/friedg/us-central1/api/ping",
    "http://localhost:5002/api/ping"
)

$found = $false

# 嘗試每個URL
foreach ($url in $possibleUrls) {
    Write-Host "`n嘗試 URL: $url" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5
        Write-Host "成功! 狀態碼: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "響應內容: $($response.Content)" -ForegroundColor Green
        $found = $true
        Write-Host "找到工作的URL: $url" -ForegroundColor Cyan
        break
    } catch {
        if ($_.Exception.Response) {
            Write-Host "請求失敗: 狀態碼 $($_.Exception.Response.StatusCode)" -ForegroundColor Red
            Write-Host "錯誤詳情: $($_.Exception.Message)" -ForegroundColor Red
        } else {
            Write-Host "連接失敗: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Wait-Seconds 1
}

if (-not $found) {
    Write-Host "`n無法找到工作的/ping端點。請確保Firebase Functions模擬器正在運行。" -ForegroundColor Red
    Write-Host "您可能需要在函數日誌中檢查確切的URL。" -ForegroundColor Yellow
} else {
    Write-Host "`n/ping端點測試成功!" -ForegroundColor Green
    
    # 如果主要測試成功，嘗試測試其他端點
    $testEndpoints = @(
        "$($url -replace '/ping', '/')",
        "$($url -replace '/ping', '/health')",
        "$($url -replace '/ping', '/test')",
        "$($url -replace '/ping', '/api/test')"
    )
    
    Write-Host "`n測試其他端點:" -ForegroundColor Cyan
    foreach ($endpoint in $testEndpoints) {
        Write-Host "`n嘗試端點: $endpoint" -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri $endpoint -Method GET -TimeoutSec 5
            Write-Host "成功! 狀態碼: $($response.StatusCode)" -ForegroundColor Green
            if ($response.Content.Length -lt 500) {
                Write-Host "響應內容: $($response.Content)" -ForegroundColor Green
            } else {
                Write-Host "響應內容過長，只顯示前500個字符: $($response.Content.Substring(0, 500))..." -ForegroundColor Green
            }
        } catch {
            if ($_.Exception.Response) {
                Write-Host "請求失敗: 狀態碼 $($_.Exception.Response.StatusCode)" -ForegroundColor Red
                Write-Host "錯誤詳情: $($_.Exception.Message)" -ForegroundColor Red
            } else {
                Write-Host "連接失敗: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        
        Wait-Seconds 1
    }
}

Write-Host "`n測試完成!" -ForegroundColor Cyan 