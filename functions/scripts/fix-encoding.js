/**
 * 此腳本用於檢測和修復 TypeScript 文件中的編碼問題
 * 它會掃描所有 .ts 文件，檢查是否存在亂碼或未終止的字符串
 * 並嘗試修復這些問題
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// 常見的亂碼模式
const GARBLED_PATTERNS = [
  /�/g,                  // 未知字符
  /[\uFFFD\uFFFE\uFFFF]/g, // Unicode 替換字符
  /[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, // 控制字符
];

// 可能導致未終止字符串的模式
const UNTERMINATED_STRING_PATTERNS = [
  /'[^'\n]*$/gm,  // 未終止的單引號字符串
  /"[^"\n]*$/gm,  // 未終止的雙引號字符串
  /`[^`\n]*$/gm,  // 未終止的反引號字符串
];

/**
 * 檢查文件是否包含亂碼或未終止的字符串
 * @param {string} content 文件內容
 * @returns {boolean} 是否包含問題
 */
function hasEncodingIssues(content) {
  // 檢查亂碼
  for (const pattern of GARBLED_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }

  // 檢查未終止的字符串
  for (const pattern of UNTERMINATED_STRING_PATTERNS) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * 嘗試修復文件中的編碼問題
 * @param {string} content 文件內容
 * @returns {string} 修復後的內容
 */
function fixEncodingIssues(content) {
  // 替換常見的亂碼
  let fixed = content;
  
  // 替換亂碼為空格或適當的字符
  fixed = fixed.replace(/�/g, ' ');
  
  // 修復常見的中文亂碼模式
  fixed = fixed.replace(/香�?多�??��??��???/g, '香酥多汁，外酥內嫩');
  fixed = fixed.replace(/伺�??�內?�錯�?/g, '伺服器內部錯誤');
  fixed = fixed.replace(/�?皮?��?/g, '脆皮雞腿');
  fixed = fixed.replace(/�?單?�目?�建?��?/g, '菜單項目創建成功');
  fixed = fixed.replace(/�?單?��??�新?��?/g, '菜單項目更新成功');
  fixed = fixed.replace(/�?單?�目 .* 已�??�刪??/g, '菜單項目 $1 已成功刪除');
  
  // 修復未終止的字符串
  // 這部分需要更複雜的邏輯，這裡只是簡單示例
  // 實際應用中可能需要更精確的解析和修復
  
  return fixed;
}

/**
 * 遞歸掃描目錄中的所有 TypeScript 文件
 * @param {string} dir 目錄路徑
 * @returns {Promise<string[]>} 文件路徑列表
 */
async function scanDirectory(dir) {
  const files = [];
  const entries = await readdirAsync(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = await statAsync(fullPath);
    
    if (stat.isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'lib' && entry !== 'dist') {
        const subFiles = await scanDirectory(fullPath);
        files.push(...subFiles);
      }
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * 主函數
 */
async function main() {
  try {
    // 從 src 目錄開始掃描
    const srcDir = path.join(__dirname, '..', 'src');
    console.log(`掃描目錄: ${srcDir}`);
    
    const files = await scanDirectory(srcDir);
    console.log(`找到 ${files.length} 個 TypeScript 文件`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
      try {
        const content = await readFileAsync(file, 'utf8');
        
        if (hasEncodingIssues(content)) {
          console.log(`發現問題文件: ${file}`);
          
          const fixed = fixEncodingIssues(content);
          await writeFileAsync(file, fixed, 'utf8');
          
          console.log(`已修復: ${file}`);
          fixedCount++;
        }
      } catch (err) {
        console.error(`處理文件 ${file} 時出錯:`, err);
        errorCount++;
      }
    }
    
    console.log(`\n完成! 已修復 ${fixedCount} 個文件，${errorCount} 個文件處理失敗`);
  } catch (err) {
    console.error('執行腳本時出錯:', err);
  }
}

// 執行主函數
main();
