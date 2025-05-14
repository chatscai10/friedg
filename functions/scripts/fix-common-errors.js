/**
 * 此腳本用於自動修復一些常見的 TypeScript 錯誤
 * 包括：
 * 1. 移除未使用的導入和變量
 * 2. 修復一些常見的類型錯誤
 * 3. 添加可能的未定義值檢查
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

/**
 * 修復未使用的導入和變量
 * @param {string} content 文件內容
 * @returns {string} 修復後的內容
 */
function fixUnusedImportsAndVariables(content) {
  // 找出所有被標記為未使用的導入
  const unusedImportRegex = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"][^'"]+['"];?\s*\/\/\s*TS6133/g;
  const matches = [...content.matchAll(unusedImportRegex)];
  
  let fixed = content;
  
  for (const match of matches) {
    const importStatement = match[0];
    const importedItems = match[1].split(',').map(item => item.trim());
    
    // 移除整個導入語句
    fixed = fixed.replace(importStatement, '');
  }
  
  // 找出所有被標記為未使用的變量
  const unusedVarRegex = /(const|let|var)\s+([a-zA-Z0-9_]+)\s*=.*?;\s*\/\/\s*TS6133/g;
  const varMatches = [...fixed.matchAll(unusedVarRegex)];
  
  for (const match of varMatches) {
    const varStatement = match[0];
    
    // 移除整個變量聲明
    fixed = fixed.replace(varStatement, '');
  }
  
  return fixed;
}

/**
 * 修復可能的未定義值
 * @param {string} content 文件內容
 * @returns {string} 修復後的內容
 */
function fixPossiblyUndefinedValues(content) {
  // 找出所有被標記為可能未定義的值
  const undefinedValueRegex = /([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)(\s*\.\s*[a-zA-Z0-9_]+)?\s*\/\/\s*TS18048/g;
  const matches = [...content.matchAll(undefinedValueRegex)];
  
  let fixed = content;
  
  for (const match of matches) {
    const expression = match[1];
    const property = match[2] ? match[2].trim() : '';
    
    // 添加可選鏈操作符
    if (property) {
      fixed = fixed.replace(`${expression}${property}`, `${expression}?${property}`);
    } else {
      fixed = fixed.replace(`${expression}`, `${expression} ?? {}`);
    }
  }
  
  return fixed;
}

/**
 * 修復常見的類型錯誤
 * @param {string} content 文件內容
 * @returns {string} 修復後的內容
 */
function fixCommonTypeErrors(content) {
  let fixed = content;
  
  // 修復 Timestamp 類型錯誤
  fixed = fixed.replace(/Type 'string' is not assignable to type 'Timestamp'/g, (match) => {
    // 找到相關的代碼行
    const lineRegex = /(\w+):\s*timestamp/g;
    const lineMatches = [...fixed.matchAll(lineRegex)];
    
    for (const lineMatch of lineMatches) {
      const property = lineMatch[1];
      const original = `${property}: timestamp`;
      const replacement = `${property}: admin.firestore.Timestamp.fromDate(new Date(timestamp))`;
      fixed = fixed.replace(original, replacement);
    }
    
    return match;
  });
  
  // 修復其他常見類型錯誤
  // ...
  
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
        
        // 應用各種修復
        let fixed = content;
        fixed = fixUnusedImportsAndVariables(fixed);
        fixed = fixPossiblyUndefinedValues(fixed);
        fixed = fixCommonTypeErrors(fixed);
        
        // 如果有修改，則寫入文件
        if (fixed !== content) {
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
