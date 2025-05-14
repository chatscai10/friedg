/**
 * Firebase Functions Gen 2 部署腳本
 * 
 * 此腳本幫助用戶將 Gen 2 函數部署到 Firebase
 * 使用方法：node deploy-gen2.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 顏色代碼
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    crimson: '\x1b[38m'
  },
  
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
    crimson: '\x1b[48m'
  }
};

/**
 * 打印帶顏色的消息
 * @param {string} message 消息內容
 * @param {string} color 顏色代碼
 */
function printColored(message, color) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * 打印標題
 * @param {string} title 標題內容
 */
function printTitle(title) {
  console.log('\n');
  printColored('='.repeat(80), colors.fg.cyan);
  printColored(`  ${title}`, colors.bright + colors.fg.cyan);
  printColored('='.repeat(80), colors.fg.cyan);
  console.log('\n');
}

/**
 * 打印成功消息
 * @param {string} message 消息內容
 */
function printSuccess(message) {
  printColored(`✓ ${message}`, colors.fg.green);
}

/**
 * 打印錯誤消息
 * @param {string} message 消息內容
 */
function printError(message) {
  printColored(`✗ ${message}`, colors.fg.red);
}

/**
 * 打印警告消息
 * @param {string} message 消息內容
 */
function printWarning(message) {
  printColored(`⚠ ${message}`, colors.fg.yellow);
}

/**
 * 打印信息消息
 * @param {string} message 消息內容
 */
function printInfo(message) {
  printColored(`ℹ ${message}`, colors.fg.blue);
}

/**
 * 執行命令並返回輸出
 * @param {string} command 要執行的命令
 * @returns {string} 命令輸出
 */
function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' });
  } catch (error) {
    printError(`執行命令 "${command}" 時出錯：`);
    printError(error.message);
    return null;
  }
}

/**
 * 檢查文件是否存在
 * @param {string} filePath 文件路徑
 * @returns {boolean} 文件是否存在
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 複製文件
 * @param {string} source 源文件路徑
 * @param {string} destination 目標文件路徑
 */
function copyFile(source, destination) {
  try {
    fs.copyFileSync(source, destination);
    return true;
  } catch (error) {
    printError(`複製文件 "${source}" 到 "${destination}" 時出錯：`);
    printError(error.message);
    return false;
  }
}

/**
 * 備份文件
 * @param {string} filePath 文件路徑
 * @returns {string} 備份文件路徑
 */
function backupFile(filePath) {
  const backupPath = `${filePath}.backup`;
  if (copyFile(filePath, backupPath)) {
    printSuccess(`已備份文件 "${filePath}" 到 "${backupPath}"`);
    return backupPath;
  }
  return null;
}

/**
 * 恢復備份文件
 * @param {string} backupPath 備份文件路徑
 * @param {string} originalPath 原始文件路徑
 */
function restoreBackup(backupPath, originalPath) {
  if (copyFile(backupPath, originalPath)) {
    printSuccess(`已恢復文件 "${originalPath}" 從備份 "${backupPath}"`);
    return true;
  }
  return false;
}

// 主函數
async function main() {
  printTitle('Firebase Functions Gen 2 部署腳本');
  
  // 檢查是否在 functions 目錄中
  if (!fileExists('package.json')) {
    printError('請在 functions 目錄中運行此腳本');
    process.exit(1);
  }
  
  // 檢查 Gen 2 文件是否存在
  const gen2Files = [
    'src/index.v2.ts',
    'src/orders/index.v2.ts',
    'src/notifications/index.v2.ts',
    'src/equity/handlers.v2.ts',
    'src/equity/schedule.handlers.v2.ts',
    'src/financial/schedules.v2.ts',
    'src/financial/services/profitCalculation.v2.ts'
  ];
  
  let allFilesExist = true;
  for (const file of gen2Files) {
    if (!fileExists(file)) {
      printError(`找不到 Gen 2 文件：${file}`);
      allFilesExist = false;
    }
  }
  
  if (!allFilesExist) {
    printError('請先創建所有 Gen 2 文件');
    process.exit(1);
  }
  
  // 備份原始文件
  printInfo('正在備份原始文件...');
  const backups = {};
  const filesToBackup = [
    'src/index.ts'
  ];
  
  for (const file of filesToBackup) {
    if (fileExists(file)) {
      const backupPath = backupFile(file);
      if (backupPath) {
        backups[file] = backupPath;
      } else {
        printError(`備份文件 "${file}" 失敗`);
        process.exit(1);
      }
    }
  }
  
  try {
    // 複製 Gen 2 文件到原始文件位置
    printInfo('正在複製 Gen 2 文件到原始文件位置...');
    if (!copyFile('src/index.v2.ts', 'src/index.ts')) {
      throw new Error('複製 index.v2.ts 失敗');
    }
    
    // 構建項目
    printInfo('正在構建項目...');
    const buildOutput = runCommand('npm run build');
    if (!buildOutput) {
      throw new Error('構建項目失敗');
    }
    
    // 部署函數
    printInfo('正在部署 Gen 2 函數...');
    printWarning('此操作將部署所有 Gen 2 函數到 Firebase');
    printWarning('請確保您已經登錄到正確的 Firebase 項目');
    
    // 詢問用戶是否繼續
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('是否繼續部署？(y/n) ', resolve);
    });
    
    readline.close();
    
    if (answer.toLowerCase() !== 'y') {
      throw new Error('用戶取消部署');
    }
    
    // 執行部署
    const deployOutput = runCommand('firebase deploy --only functions');
    if (!deployOutput) {
      throw new Error('部署函數失敗');
    }
    
    printSuccess('Gen 2 函數已成功部署到 Firebase');
  } catch (error) {
    printError(`部署過程中出錯：${error.message}`);
    
    // 恢復備份
    printInfo('正在恢復備份...');
    for (const [originalPath, backupPath] of Object.entries(backups)) {
      restoreBackup(backupPath, originalPath);
    }
  }
}

// 運行主函數
main().catch(error => {
  printError(`腳本執行出錯：${error.message}`);
  process.exit(1);
});
