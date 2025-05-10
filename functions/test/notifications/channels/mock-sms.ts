import { logger } from 'firebase-functions';
import * as twilioLib from 'twilio';
import path from 'path';
import fs from 'fs';

// 直接讀取並執行源代碼文件
const srcPath = path.resolve(__dirname, '../../../src/notifications/channels/sms.ts');
const srcContent = fs.readFileSync(srcPath, 'utf8');

// 對源代碼進行簡單的轉換，將 export class 替換為 class
const processedContent = srcContent.replace('export class SMSChannel', 'class SMSChannel');

// 創建模塊上下文
const module = { exports: {} };
const require = (id: string) => {
  if (id === 'firebase-functions') return { logger };
  if (id === 'twilio') return twilioLib;
  return {};
};

// 執行源代碼
eval(`(function(module, exports, require) {
  ${processedContent}
  module.exports = { SMSChannel };
})(module, module.exports, require)`);

// 導出 SMSChannel
export const SMSChannel = (module.exports as any).SMSChannel; 