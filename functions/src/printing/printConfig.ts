export type PrintLanguage = 'traditional-chinese' | 'simplified-chinese';

export interface FeieyunPrinterConfig {
  user: string; // 飛鵝雲後台註冊的用戶名
  ukey: string; // 飛鵝雲後台獲取的 API 密鑰 (極其重要，勿硬編碼於此)
  sn: string;   // 打印機序列號
  language?: PrintLanguage; // 默認為繁體中文
  serverUrl?: string; // API服務器地址，默認為日本服務器
  copies?: number; // 打印份數，默認為1
}

export const DEFAULT_FEIEYUN_API_URL = 'https://api.jp.feieyun.com/Api/Open/';
export const DEFAULT_PRINT_LANGUAGE: PrintLanguage = 'traditional-chinese';
export const DEFAULT_PRINT_COPIES = 1; 