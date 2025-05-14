import * as crypto from 'crypto';
import fetch from 'node-fetch'; // 需要安裝 node-fetch: npm install node-fetch @types/node-fetch
import { 
    FeieyunPrinterConfig, 
    PrintLanguage, 
    DEFAULT_FEIEYUN_API_URL,
    DEFAULT_PRINT_LANGUAGE,
    DEFAULT_PRINT_COPIES
} from './printConfig';
import * as functions from 'firebase-functions';

// 飛鵝云 API 端點名
const PRINT_CONTENT_ENDPOINT = 'PrintContent'; // 文字打印接口
// const QUERY_PRINTER_STATUS_ENDPOINT = 'QueryPrinterStatus'; // 查詢打印機狀態接口

/**
 * 飛鵝雲打印客戶端，用於與飛鵝雲API進行交互。
 */
export class FeieyunClient {
  private config: Required<FeieyunPrinterConfig>;

  constructor(config: FeieyunPrinterConfig) {
    if (!config.user || !config.ukey || !config.sn) {
      throw new Error('FeieyunClient Error: Missing required configuration (user, ukey, or sn).');
    }
    this.config = {
      user: config.user,
      ukey: config.ukey, // 請務必從安全來源獲取UKEY，不要硬編碼
      sn: config.sn,
      language: config.language || DEFAULT_PRINT_LANGUAGE,
      serverUrl: config.serverUrl || DEFAULT_FEIEYUN_API_URL,
      copies: config.copies || DEFAULT_PRINT_COPIES,
    };
  }

  private generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  private generateSignature(timestamp: string): string {
    const strToSign = this.config.user + this.config.ukey + timestamp;
    return crypto.createHash('sha1').update(strToSign).digest('hex');
  }

  private getInitSequence(): string {
    switch (this.config.language) {
      case 'traditional-chinese':
        return '<ESC>@<FS>&<ESC>t3'; // Initialize + Select Traditional Chinese font
      case 'simplified-chinese':
        return '<ESC>@<FS>&<ESC>t0'; // Initialize + Select Simplified Chinese font
      default:
        functions.logger.warn(`Unknown language: ${this.config.language}, defaulting to Traditional Chinese init sequence.`);
        return '<ESC>@<FS>&<ESC>t3';
    }
  }
  
  /**
   * 調用飛鵝雲API的通用方法
   * @param apiEndpoint API接口名稱，如 PrintContent
   * @param requestData 要發送的數據對象
   * @returns API響應的Promise
   */
  private async callApi(apiEndpoint: string, requestData: Record<string, string>): Promise<any> {
    const timestamp = this.generateTimestamp();
    const signature = this.generateSignature(timestamp);

    const params = new URLSearchParams();
    params.append('user', this.config.user);
    params.append('stime', timestamp);
    params.append('sig', signature);
    params.append('apiname', apiEndpoint);
    
    for (const key in requestData) {
      params.append(key, requestData[key]);
    }

    functions.logger.info(`Calling Feieyun API: ${this.config.serverUrl}, Endpoint: ${apiEndpoint}`, { params: requestData });

    try {
      const response = await fetch(this.config.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        functions.logger.error(`Feieyun API HTTP Error for ${apiEndpoint}: ${response.status} ${response.statusText}`, { errorText });
        throw new Error(`Feieyun API HTTP Error: ${response.status} - ${errorText}`);
      }

      const responseJson = await response.json();
      functions.logger.info(`Feieyun API Response for ${apiEndpoint}:`, responseJson);

      // 根據飛鵝雲的API文檔，ret=0表示成功
      if (responseJson.ret !== 0) {
        functions.logger.error(`Feieyun API Business Error for ${apiEndpoint}:`, responseJson);
        throw new Error(`Feieyun API Error: Code ${responseJson.ret}, Msg: ${responseJson.msg}, ServerMsg: ${responseJson.serverContent}`);
      }
      return responseJson;
    } catch (error) {
      functions.logger.error(`Error calling Feieyun API ${apiEndpoint}:`, error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  /**
   * 打印格式化後的內容。
   * @param formattedContent 經過排版和指令編碼的完整打印字符串。
   * @returns 打印結果的Promise。
   */
  public async printRawContent(formattedContent: string): Promise<any> {
    const fullContent = `${this.getInitSequence()}${formattedContent}`;
    
    const requestData: Record<string, string> = {
      sn: this.config.sn,
      content: fullContent,
      times: this.config.copies.toString(), // 打印份數
    };
    
    return this.callApi(PRINT_CONTENT_ENDPOINT, requestData);
  }

  // 可以根據需要添加其他API接口的封裝，例如查詢打印機狀態等
  // public async queryPrinterStatus(): Promise<string> {
  //   const response = await this.callApi(QUERY_PRINTER_STATUS_ENDPOINT, { sn: this.config.sn });
  //   return response.data; // "在线" or "离线" or "异常"
  // }
} 