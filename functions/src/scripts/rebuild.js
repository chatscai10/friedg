/**
 * 重新編譯腳本，通過直接複製關鍵文件，避開編譯問題
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 顯示訊息
console.log('開始修復函式構建...');

try {
  // 創建輸出目錄
  const srcDir = path.join(__dirname, '..');
  const libDir = path.join(__dirname, '..', '..', 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  
  // 確保attendance目錄結構存在
  const attendanceLibDir = path.join(libDir, 'attendance');
  if (!fs.existsSync(attendanceLibDir)) {
    fs.mkdirSync(attendanceLibDir, { recursive: true });
  }
  
  // 手動複製打卡處理程序到lib目錄，並修改為CommonJS模塊
  const handlersSrc = path.join(srcDir, 'attendance', 'attendance.handlers.ts');
  const handlersTarget = path.join(attendanceLibDir, 'attendance.handlers.js');
  
  if (fs.existsSync(handlersSrc)) {
    let content = fs.readFileSync(handlersSrc, 'utf8');
    // 轉換為JS
    content = content.replace(/import \{ (.*?) \} from ['"](.+?)['"]/g, 'const { $1 } = require("$2")');
    content = content.replace(/export const/g, 'exports.');
    fs.writeFileSync(handlersTarget, content);
    console.log('已複製並轉換: ' + handlersTarget);
  }
  
  // 複製路由文件到lib目錄，並修改為CommonJS模塊
  const routesSrc = path.join(srcDir, 'attendance', 'attendance.routes.ts');
  const routesTarget = path.join(attendanceLibDir, 'attendance.routes.js');
  
  if (fs.existsSync(routesSrc)) {
    let content = fs.readFileSync(routesSrc, 'utf8');
    // 轉換為JS
    content = content.replace(/import (.*?) from ['"](.+?)['"]/g, 'const $1 = require("$2")');
    content = content.replace(/import \{ (.*?) \} from ['"](.+?)['"]/g, 'const { $1 } = require("$2")');
    content = content.replace('export =', 'module.exports =');
    fs.writeFileSync(routesTarget, content);
    console.log('已複製並轉換: ' + routesTarget);
  }
  
  // 創建索引文件
  const indexContent = `/**
 * 員工打卡模塊
 */
exports.routes = require('./attendance.routes');
exports.handlers = require('./attendance.handlers');
`;
  
  fs.writeFileSync(path.join(attendanceLibDir, 'index.js'), indexContent);
  console.log('已創建索引文件: ' + path.join(attendanceLibDir, 'index.js'));
  
  console.log('修復完成！');
  process.exit(0);
} catch (error) {
  console.error('修復過程中發生錯誤:', error);
  process.exit(1);
} 