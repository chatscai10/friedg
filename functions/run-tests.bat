@echo off
echo Installing Jest and dependencies...
call npm install --save-dev jest @types/jest ts-jest
echo Running tests...
call npx jest 