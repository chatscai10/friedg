@echo off
echo === 啟動 Firebase 模擬器 ===
echo.
echo 模擬器設定:
echo - Auth: 端口 7099
echo - Functions: 端口 5002
echo - Firestore: 端口 8090
echo - UI: 端口 6001
echo.
echo 清理先前執行的模擬器...
taskkill /F /IM node.exe /T 2>nul
echo.
echo 啟動模擬器...
firebase emulators:start
pause 