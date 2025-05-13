@echo off
set /p msg=Please enter commit message:
git add .
git commit -m "%msg%"
git push
pause