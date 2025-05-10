import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  // 读取原文件
  const reportPath = path.join(__dirname, '整合專案報告.txt');
  const contentPath = path.join(__dirname, 'menuItems_content.txt');

  // 读取内容
  const reportContent = fs.readFileSync(reportPath, 'utf8');
  const menuItemsContent = fs.readFileSync(contentPath, 'utf8');

  // 将文件内容分割成行
  const lines = reportContent.split('\n');
  
  // 找到目标位置 - 在Customers表格定义之后，在【⚡️ 每一個表格我會這樣全欄位規範！】之前
  let insertIndex = -1;
  
  // 扫描大约1010-1025行，寻找包含"updatedAt"和"更新時間"的行
  for (let i = 1010; i < 1025; i++) {
    if (i >= lines.length) break;
    
    // 找到updatedAt行后的分隔线位置
    if (lines[i].includes('updatedAt') && lines[i].includes('更新時間')) {
      // 查找下一个"---"分隔线
      for (let j = i + 1; j < i + 10; j++) {
        if (j >= lines.length) break;
        if (lines[j].trim() === '---') {
          insertIndex = j + 1;
          break;
        }
      }
      break;
    }
  }
  
  if (insertIndex === -1) {
    console.error('未找到适当的插入位置');
    process.exit(1);
  }
  
  // 在找到的位置插入内容
  const newLines = [
    ...lines.slice(0, insertIndex),
    '',
    ...menuItemsContent.split('\n'),
    '',
    ...lines.slice(insertIndex)
  ];
  
  // 写入文件
  fs.writeFileSync(reportPath, newLines.join('\n'), 'utf8');
  
  console.log('内容已成功插入到行号:', insertIndex);
} catch (error) {
  console.error('操作失败:', error);
  process.exit(1);
} 