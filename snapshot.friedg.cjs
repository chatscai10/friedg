const fs = require('fs');


const path = require('path');

// 可編輯設定區
const EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'public/static',
  '.firebase',
];
const FILE_EXTENSIONS = ['.js', '.ts', '.vue', '.html', '.json', '.rules'];
const MAX_DEPTH = 3;
const PARSERS = {
  controller: {
    test: /module\.exports\s*=\s*{/,
    regex: /(?:async\s+)?(\w+)\s*\(([^)]*)\)/g,
    comment: /\/\/\s*(.*)/,
  },
  export: {
    test: /export\s+(?:function|const|let)/,
    regex: /export\s+(?:async\s+)?(?:function|const|let)\s+(\w+)\s*(?:\(([^)]*)\)|=\s*\([^)]*\)\s*=>)/g,
    comment: /\/\/\s*(.*)/,
  },
  firebaseFunctions: {
    test: /exports\.\w+\s*=\s*functions\./,
    regex: /exports\.(\w+)\s*=\s*functions\.(\w+)\.(\w+)\(([^)]*)\)/g,
    comment: /\/\/\s*(.*)/,
  },
  serviceWorker: {
    test: /self\.addEventListener/,
    regex: /self\.addEventListener\s*\(\s*['"]([^'"]+)['"]/g,
    comment: /\/\/\s*(.*)/,
  },
  firestoreRules: {
    test: /match\s+\/databases/,
    regex: /match\s+\/databases\/\{database\}\/documents\/\{[^}]+\}\s*\{([^}]*)\}/g,
    comment: /\/\/\s*(.*)/,
  },
  json: {
    test: /\.json$/,
    parse: (content) => {
      try {
        const json = JSON.parse(content);
        if (json.version) return `Version: ${json.version}`;
        if (json.hosting) return `Hosting Config: ${JSON.stringify(json.hosting)}`;
        return '';
      } catch {
        return 'Invalid JSON';
      }
    },
  },
};

// 掃描目錄（使用同步函式修正錯誤）
function scanDir(dir, depth = 0) {
  if (MAX_DEPTH && depth > MAX_DEPTH) return [];
  const files = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory() && !EXCLUDES.includes(file.name)) {
      result.push(...scanDir(fullPath, depth + 1));
    } else if (FILE_EXTENSIONS.includes(path.extname(file.name))) {
      result.push(fullPath);
    }
  }
  return result;
}


// 生成目錄樹
function generateTree(dir, prefix = '', depth = 0) {
  if (MAX_DEPTH && depth > MAX_DEPTH) return '';
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let tree = '';
  files.forEach((file, index) => {
    const isLast = index === files.length - 1;
    const fullPath = path.join(dir, file.name);
    if (!EXCLUDES.includes(file.name)) {
      tree += `${prefix}${isLast ? '└──' : '├──'} ${file.name}\n`;
      if (file.isDirectory()) {
        tree += generateTree(fullPath, `${prefix}${isLast ? '   ' : '│  '}`, depth + 1);
      }
    }
  });
  return tree;
}

// 提取註解
function getCommentAbove(content, commentRegex, index) {
  const lines = content.slice(0, index).split('\n');
  const lastLine = lines[lines.length - 1];
  const match = commentRegex.exec(lastLine);
  return match ? match[1] : '';
}

// 解析檔案
function parseFile(filePath, content) {
  const ext = path.extname(filePath);
  if (ext === '.json') return PARSERS.json.parse(content);
  if (ext === '.rules') {
    content = content.split('\n').slice(0, 100).join('\n');
  }
  for (const [key, parser] of Object.entries(PARSERS)) {
    if (parser.test && parser.test.test(content)) {
      const matches = [];
      let match;
      while ((match = parser.regex.exec(content)) !== null) {
        const comment = getCommentAbove(content, parser.comment, match.index);
        matches.push({
          name: match[1],
          params: match[2] || '',
          comment: comment || '',
        });
      }
      return matches;
    }
  }
  return [];
}

// 收集依賴（使用同步函式）
function collectDependencies(rootDir) {
  const dependencies = {};

  function scanDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory() && !EXCLUDES.includes(file.name)) {
        scanDir(fullPath);
      } else if (file.name === 'package.json') {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const pkg = JSON.parse(content);
          const relativePath = path.relative(rootDir, dir);
          dependencies[relativePath || 'root'] = {
            dependencies: pkg.dependencies || {},
            devDependencies: pkg.devDependencies || {},
          };
        } catch {
          console.warn(`Invalid package.json: ${fullPath}`);
        }
      }
    }
  }

  scanDir(rootDir);
  return dependencies;
}


// 生成 Markdown
async function generateMarkdown(rootDir, tree, functions, dependencies) {
  let md = '# Project Snapshot\n\n';
  md += '## Directory Structure\n\n```\n' + tree + '\n```\n\n';
  md += '## Function List\n\n';
  for (const [file, funcs] of Object.entries(functions)) {
    md += `### ${file}\n`;
    for (const func of funcs) {
      md += `- **${func.name}(${func.params})** - ${func.comment || 'No comment'}\n`;
    }
    md += '\n';
  }
  md += '## Special Files\n\n';
  const specialFiles = ['version.json', 'firestore.rules', 'manifest.json'];
  for (const file of specialFiles) {
    const filePath = path.join(rootDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseFile(filePath, content);
      md += `### ${file}\n\`\`\`\n${parsed}\n\`\`\`\n\n`;
    } catch {
      // 文件不存在，跳過
    }
  }
  md += '## Dependency List\n\n';
  for (const [dir, deps] of Object.entries(dependencies)) {
    md += `### ${dir || 'Root'}\n\n`;
    md += '#### dependencies\n```json\n' + JSON.stringify(deps.dependencies, null, 2) + '\n```\n';
    md += '#### devDependencies\n```json\n' + JSON.stringify(deps.devDependencies, null, 2) + '\n```\n';
  }
  return md;
}

// 主函數
async function main() {
  const rootDir = process.cwd();
  const files = await scanDir(rootDir);
  const tree = generateTree(rootDir);
  const functions = {};
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(rootDir, file);
    const parsed = parseFile(file, content);
    if (parsed.length || typeof parsed === 'string') {
      functions[relativePath] = parsed;
    }
  }
const dependencies = collectDependencies(rootDir);

  const md = await generateMarkdown(rootDir, tree, functions, dependencies);
fs.writeFileSync(path.join(rootDir, 'snapshot.md'), md);

  console.log('Snapshot generated: snapshot.md');
}

main().catch(console.error);