@echo off
echo 正在運行API測試...

cd %~dp0
call npm run test:api

if %errorlevel% equ 0 (
  echo 測試成功完成！
) else (
  echo 測試失敗，請檢查日誌。
)

pause 