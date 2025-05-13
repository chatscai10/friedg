# Firebase Functions編譯腳本
Write-Host "清理和編譯Firebase Functions..." -ForegroundColor Cyan

# 顯示當前目錄
Write-Host "當前目錄: $(Get-Location)" -ForegroundColor Yellow

# 進入functions目錄
Set-Location -Path "functions"
Write-Host "切換到functions目錄: $(Get-Location)" -ForegroundColor Yellow

# 清理舊的編譯文件
if (Test-Path -Path "lib") {
    Write-Host "清理lib目錄..." -ForegroundColor Yellow
    Remove-Item -Path "lib" -Recurse -Force
    Write-Host "清理完成" -ForegroundColor Green
}

# 嘗試使用正常的build指令
Write-Host "執行npm run build..." -ForegroundColor Yellow
try {
    npm run build
    $buildSuccess = $?
    if ($buildSuccess) {
        Write-Host "構建成功!" -ForegroundColor Green
    } else {
        Write-Host "構建失敗，嘗試使用備用方法..." -ForegroundColor Yellow
        # 備用方法 - 使用TypeScript編譯器直接編譯index.ts
        Write-Host "執行: npx tsc src/index.ts --skipLibCheck --outDir lib" -ForegroundColor Yellow
        npx tsc src/index.ts --skipLibCheck --outDir lib
        
        if ($?) {
            Write-Host "備用構建成功!" -ForegroundColor Green
        } else {
            Write-Host "備用構建也失敗了。請檢查TypeScript錯誤。" -ForegroundColor Red
            exit 1
        }
    }
} catch {
    Write-Host "構建過程中出錯: $_" -ForegroundColor Red
    exit 1
}

# 檢查編譯後的文件
if (Test-Path -Path "lib/index.js") {
    Write-Host "編譯成功! lib/index.js已創建." -ForegroundColor Green
    
    # 顯示文件信息
    $fileInfo = Get-Item -Path "lib/index.js"
    Write-Host "檔案大小: $([math]::Round($fileInfo.Length/1KB, 2)) KB" -ForegroundColor Green
    Write-Host "最後修改時間: $($fileInfo.LastWriteTime)" -ForegroundColor Green
    
    # 回到上一層目錄
    Set-Location -Path ".."
    Write-Host "返回上層目錄: $(Get-Location)" -ForegroundColor Yellow
    
    # 提示下一步
    Write-Host "`n編譯完成! 你現在可以執行:" -ForegroundColor Cyan
    Write-Host "firebase emulators:start --only functions" -ForegroundColor Green
    Write-Host "來啟動Firebase Functions模擬器" -ForegroundColor Cyan
} else {
    Write-Host "編譯失敗! 找不到lib/index.js文件" -ForegroundColor Red
    # 回到上一層目錄
    Set-Location -Path ".."
    exit 1
} 