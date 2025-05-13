# Roles API測試腳本
Write-Host "開始測試Roles API端點..." -ForegroundColor Cyan

# 等待函數
function Wait-Seconds {
    param ([int]$seconds)
    Write-Host "等待 $seconds 秒..." -ForegroundColor Gray
    Start-Sleep -Seconds $seconds
}

# 基礎URL
$baseUrl = "http://localhost:5002/friedg/us-central1/api"

# 測試Roles列表API
$rolesUrl = "$baseUrl/api/v1/roles"
Write-Host "測試獲取角色列表: $rolesUrl" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $rolesUrl -Method GET
    Write-Host "成功! 狀態碼: $($response.StatusCode)" -ForegroundColor Green
    
    # 檢查響應內容長度
    if ($response.Content.Length -lt 500) {
        Write-Host "響應內容: $($response.Content)" -ForegroundColor Green
    } else {
        Write-Host "響應內容過長，只顯示前500個字符: $($response.Content.Substring(0, 500))..." -ForegroundColor Green
    }
    
    # 嘗試解析JSON
    try {
        $jsonResponse = $response.Content | ConvertFrom-Json
        Write-Host "成功解析JSON響應!" -ForegroundColor Green
        Write-Host "響應狀態: $($jsonResponse.status)" -ForegroundColor Cyan
        
        if ($jsonResponse.data -ne $null) {
            Write-Host "角色數量: $($jsonResponse.data.length)" -ForegroundColor Cyan
            if ($jsonResponse.data.length -gt 0) {
                Write-Host "第一個角色: $($jsonResponse.data[0] | ConvertTo-Json)" -ForegroundColor Cyan
            }
        }
    } catch {
        Write-Host "無法解析JSON: $_" -ForegroundColor Yellow
    }
} catch {
    if ($_.Exception.Response) {
        Write-Host "請求失敗: 狀態碼 $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        
        # 嘗試獲取更多錯誤詳情
        try {
            $errorContent = $_.ErrorDetails.Message
            Write-Host "錯誤詳情: $errorContent" -ForegroundColor Red
        } catch {
            Write-Host "錯誤詳情: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "連接失敗: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 嘗試亞洲區域的URL
Write-Host "嘗試亞洲區域URL..." -ForegroundColor Yellow
$asiaBaseUrl = "http://localhost:5002/friedg/asia-east1/api"
$asiaRolesUrl = "$asiaBaseUrl/api/v1/roles"
Write-Host "測試獲取角色列表: $asiaRolesUrl" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $asiaRolesUrl -Method GET
    Write-Host "成功! 狀態碼: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "響應內容: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "請求失敗: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Roles API測試完成!" -ForegroundColor Cyan 