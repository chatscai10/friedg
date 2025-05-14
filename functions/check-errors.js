/**
 * TypeScript 編譯錯誤檢查腳本
 * 
 * 此腳本用於檢查 TypeScript 編譯錯誤，並提供詳細的錯誤報告
 * 使用方法：node check-errors.js
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
    if (error.stdout) {
      return error.stdout;
    }
    printError(`執行命令 "${command}" 時出錯：`);
    printError(error.message);
    return null;
  }
}

/**
 * 解析 TypeScript 編譯錯誤
 * @param {string} output 編譯輸出
 * @returns {Array} 錯誤列表
 */
function parseTypeScriptErrors(output) {
  const errors = [];
  const lines = output.split('\n');
  
  let currentError = null;
  
  for (const line of lines) {
    // 匹配錯誤行，例如：src/file.ts:10:20 - error TS2339: Property 'foo' does not exist on type 'Bar'.
    const errorMatch = line.match(/^(.+\.ts):(\d+):(\d+) - error (TS\d+): (.+)$/);
    
    if (errorMatch) {
      if (currentError) {
        errors.push(currentError);
      }
      
      currentError = {
        file: errorMatch[1],
        line: parseInt(errorMatch[2]),
        column: parseInt(errorMatch[3]),
        code: errorMatch[4],
        message: errorMatch[5],
        details: []
      };
    } else if (currentError && line.trim() !== '') {
      currentError.details.push(line.trim());
    }
  }
  
  if (currentError) {
    errors.push(currentError);
  }
  
  return errors;
}

/**
 * 按文件分組錯誤
 * @param {Array} errors 錯誤列表
 * @returns {Object} 按文件分組的錯誤
 */
function groupErrorsByFile(errors) {
  const groups = {};
  
  for (const error of errors) {
    if (!groups[error.file]) {
      groups[error.file] = [];
    }
    
    groups[error.file].push(error);
  }
  
  return groups;
}

/**
 * 打印錯誤報告
 * @param {Array} errors 錯誤列表
 */
function printErrorReport(errors) {
  if (errors.length === 0) {
    printSuccess('沒有發現 TypeScript 編譯錯誤！');
    return;
  }
  
  printError(`發現 ${errors.length} 個 TypeScript 編譯錯誤：`);
  console.log();
  
  const groups = groupErrorsByFile(errors);
  
  for (const [file, fileErrors] of Object.entries(groups)) {
    printColored(`文件：${file} (${fileErrors.length} 個錯誤)`, colors.bright + colors.fg.yellow);
    console.log();
    
    for (const error of fileErrors) {
      printColored(`  行 ${error.line}:${error.column} - ${error.code}: ${error.message}`, colors.fg.red);
      
      for (const detail of error.details) {
        console.log(`    ${detail}`);
      }
      
      console.log();
    }
  }
}

/**
 * 檢查 TypeScript 編譯錯誤
 */
function checkTypeScriptErrors() {
  printTitle('TypeScript 編譯錯誤檢查');
  
  printInfo('正在檢查 TypeScript 編譯錯誤...');
  
  const output = runCommand('npx tsc --noEmit');
  
  if (!output) {
    printSuccess('沒有發現 TypeScript 編譯錯誤！');
    return;
  }
  
  const errors = parseTypeScriptErrors(output);
  printErrorReport(errors);
  
  if (errors.length > 0) {
    printInfo('請修復以上錯誤後再嘗試部署。');
  }
}

// 執行檢查
checkTypeScriptErrors();
