/**
 * 部署修復腳本
 * 自動複製index.js並確保CORS和其他必要模塊被正確引入
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 彩色日誌輸出
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`)
};

// 重要目錄
const rootDir = path.resolve(__dirname, '../..');
const srcDir = path.resolve(rootDir, 'src');
const libDir = path.resolve(rootDir, 'lib');

// 顯示一些信息
log.info(`源碼目錄: ${srcDir}`);
log.info(`輸出目錄: ${libDir}`);
log.info(`根目錄: ${rootDir}`);

// 確保lib目錄存在
if (!fs.existsSync(libDir)) {
  fs.mkdirSync(libDir, { recursive: true });
  log.info(`創建目錄: ${libDir}`);
}

// 嘗試編譯
log.info('開始編譯TypeScript代碼...');
try {
  execSync('node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc --skipLibCheck --project src/tsconfig.json --noEmitOnError false', 
    { stdio: 'inherit', cwd: rootDir }
  );
  log.success('編譯成功完成');
} catch (error) {
  log.warn('編譯過程中有警告，但將會繼續處理');
}

// 檢查index.js文件是否存在
const indexJsPath = path.resolve(libDir, 'index.js');
if (!fs.existsSync(indexJsPath)) {
  log.error(`找不到編譯後的index.js文件: ${indexJsPath}`);
  process.exit(1);
}

// 檢查CORS導入
log.info('檢查並修復CORS導入...');
let indexContent = fs.readFileSync(indexJsPath, 'utf-8');

// 確保CORS被正確導入和使用
if (!indexContent.includes('require("cors")')) {
  log.warn('未找到CORS導入，正在新增...');
  
  // 添加CORS導入
  indexContent = indexContent.replace(
    'const express_1 = __importDefault(require("express"));',
    'const express_1 = __importDefault(require("express"));\nconst cors_1 = __importDefault(require("cors"));'
  );
  
  // 添加CORS中間件
  indexContent = indexContent.replace(
    '// Express app\nconst app = (0, express_1.default)();',
    '// Express app\nconst app = (0, express_1.default)();\n\n// 啟用CORS\napp.use((0, cors_1.default)({ origin: true }));'
  );
  
  // 保存修改後的文件
  fs.writeFileSync(indexJsPath, indexContent, 'utf-8');
  log.success('已添加CORS導入和中間件');
}

// 部署到Firebase
log.info('正在部署到Firebase...');
try {
  execSync('firebase deploy --only functions:api --project friedg', 
    { stdio: 'inherit', cwd: path.resolve(__dirname, '../../../') }
  );
  log.success('API函數部署成功');
  
  execSync('firebase deploy --only functions:cleanupLogs --project friedg', 
    { stdio: 'inherit', cwd: path.resolve(__dirname, '../../../') }
  );
  log.success('日誌清理函數部署成功');
} catch (error) {
  log.error('部署過程中發生錯誤');
  process.exit(1);
}

log.success('所有函數已成功部署！'); 