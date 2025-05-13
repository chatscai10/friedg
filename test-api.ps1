Write-Host "開始測試API端點..." -ForegroundColor Cyan

Write-Host "`n測試根路徑...(http://localhost:5002/)" -ForegroundColor Yellow
try {
    $result = Invoke-WebRequest -Uri "http://localhost:5002/" -Method GET
    Write-Host "狀態碼: $($result.StatusCode)" -ForegroundColor Green
    Write-Host "響應: $($result.Content)" -ForegroundColor Green
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

Write-Host "`n測試API端點...(http://localhost:5002/api/)" -ForegroundColor Yellow
try {
    $result = Invoke-WebRequest -Uri "http://localhost:5002/api/" -Method GET
    Write-Host "狀態碼: $($result.StatusCode)" -ForegroundColor Green
    Write-Host "響應: $($result.Content)" -ForegroundColor Green
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

Write-Host "`n測試API測試端點...(http://localhost:5002/api/test)" -ForegroundColor Yellow
try {
    $result = Invoke-WebRequest -Uri "http://localhost:5002/api/test" -Method GET
    Write-Host "狀態碼: $($result.StatusCode)" -ForegroundColor Green
    Write-Host "響應: $($result.Content)" -ForegroundColor Green
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

Write-Host "`n測試API健康檢查端點...(http://localhost:5002/api/health)" -ForegroundColor Yellow
try {
    $result = Invoke-WebRequest -Uri "http://localhost:5002/api/health" -Method GET
    Write-Host "狀態碼: $($result.StatusCode)" -ForegroundColor Green
    Write-Host "響應: $($result.Content)" -ForegroundColor Green
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

Write-Host "`n測試API版本端點...(http://localhost:5002/api/version)" -ForegroundColor Yellow
try {
    $result = Invoke-WebRequest -Uri "http://localhost:5002/api/version" -Method GET
    Write-Host "狀態碼: $($result.StatusCode)" -ForegroundColor Green
    Write-Host "響應: $($result.Content)" -ForegroundColor Green
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

Write-Host "`n測試testApi端點...(http://localhost:5002/testApi)" -ForegroundColor Yellow
try {
    $result = Invoke-WebRequest -Uri "http://localhost:5002/testApi" -Method GET
    Write-Host "狀態碼: $($result.StatusCode)" -ForegroundColor Green
    Write-Host "響應: $($result.Content)" -ForegroundColor Green
} catch {
    Write-Host "錯誤: $_" -ForegroundColor Red
}

Write-Host "`n測試完成" -ForegroundColor Cyan

# Test creating a role
$Body = @{
  name = "Test Role"
  description = "Test role description"
  permissions = @(
    @{
      resource = "users"
      actions = @("read", "create")
    }
  )
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Method POST -Uri "http://localhost:5002/api/v1/roles" -ContentType "application/json" -Body $Body
    "API Response Status Code: $($response.StatusCode)"
    "API Response Content:"
    $response.Content
} catch {
    "API Request Failed: $_"
}

# Test getting role list
try {
    $response = Invoke-WebRequest -Method GET -Uri "http://localhost:5002/api/v1/roles" -ContentType "application/json"
    "API Response Status Code: $($response.StatusCode)"
    "API Response Content:"
    $response.Content
} catch {
    "API Request Failed: $_"
}

# Test Store API - Get store list
try {
    $response = Invoke-WebRequest -Method GET -Uri "http://localhost:5002/api/v1/stores" -ContentType "application/json"
    "API Response Status Code: $($response.StatusCode)"
    "API Response Content:"
    $response.Content
} catch {
    "API Request Failed: $_"
}

# Test Store API - Create store
$storeBody = @{
  name = "Test Store"
  storeCode = "TEST001"
  description = "Test store description"
  status = "active"
  address = @{
    city = "Taipei"
    street = "No. 1, Section 1, Zhongxiao East Road"
    postalCode = "100"
    country = "Taiwan"
  }
  contactInfo = @{
    email = "test@example.com"
    phone = "02-12345678"
  }
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Method POST -Uri "http://localhost:5002/api/v1/stores" -ContentType "application/json" -Body $storeBody
    "API Response Status Code: $($response.StatusCode)"
    "API Response Content:"
    $response.Content
} catch {
    "API Request Failed: $_"
}

# Test Store API - Update store
$updateBody = @{
  name = "Updated Test Store"
  description = "Updated test store description"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Method PUT -Uri "http://localhost:5002/api/v1/stores/1" -ContentType "application/json" -Body $updateBody
    "API Response Status Code: $($response.StatusCode)"
    "API Response Content:"
    $response.Content
} catch {
    "API Request Failed: $_"
}

# Test Attendance API - Clock in
$clockInBody = @{
  latitude = 25.0330
  longitude = 121.5654
  deviceInfo = @{
    deviceId = "test-device-123"
    deviceType = "Android"
    appVersion = "1.0.0"
  }
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Method POST -Uri "http://localhost:5002/api/v1/attendance/clock-in" -ContentType "application/json" -Body $clockInBody
    "API Response Status Code: $($response.StatusCode)"
    "API Response Content:"
    $response.Content
} catch {
    "API Request Failed: $_"
} 