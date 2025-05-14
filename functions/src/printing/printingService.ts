import * as functions from 'firebase-functions';
import { FeieyunClient } from './feieyunClient';
import { FeieyunPrinterConfig, PrintLanguage, DEFAULT_PRINT_LANGUAGE } from './printConfig';
import { PrintableOrder, formatOrderForPrinting, formatOrderForKitchen } from './printFormatter';

// 實際應用中，UKEY應從Firebase Secret Manager或環境變數安全獲取
// 例如: const ukey = functions.config().feieyun?.ukey || process.env.FEIEYUN_UKEY;

/**
 * 定義打印服務可以接受的打印機配置結構。
 * 可以有多個打印機，例如一個用於收據，一個用於廚房。
 */
export interface PrinterServiceConfigs {
  receiptPrinter?: FeieyunPrinterConfig; // 顧客收據打印機配置
  kitchenPrinter?: FeieyunPrinterConfig; // 廚房出單打印機配置
  // 可以根據需要添加更多打印機，例如吧台、打包台等
  // barPrinter?: FeieyunPrinterConfig;
}

export class PrintingService {
  private printers: {
    receipt?: FeieyunClient;
    kitchen?: FeieyunClient;
    // bar?: FeieyunClient;
  } = {};
  
  private defaultLanguage: PrintLanguage;

  /**
   * 構造 PrintingService。
   * @param configs 包含一個或多個打印機的配置對象。每個打印機配置都應已包含其 UKEY。
   * @param defaultLanguage 打印時的默認語言。
   */
  constructor(configs: PrinterServiceConfigs, defaultLanguage: PrintLanguage = DEFAULT_PRINT_LANGUAGE) {
    this.defaultLanguage = defaultLanguage;

    if (configs.receiptPrinter) {
      if (!configs.receiptPrinter.ukey) {
        functions.logger.warn(
          'Receipt printer config is missing UKEY. Printing will likely fail. '
          + 'Ensure UKEY is securely provided via environment variables or Secret Manager.'
        );
      } 
      // 即使UKEY缺失也嘗試初始化，FeieyunClient構造函數內部會有錯誤處理
      this.printers.receipt = new FeieyunClient(configs.receiptPrinter);
      functions.logger.info('Receipt printer client initialized.', { user: configs.receiptPrinter.user, sn: configs.receiptPrinter.sn });
    }

    if (configs.kitchenPrinter) {
      if (!configs.kitchenPrinter.ukey) {
        functions.logger.warn(
          'Kitchen printer config is missing UKEY. Printing will likely fail. '
          + 'Ensure UKEY is securely provided via environment variables or Secret Manager.'
        );
      }
      this.printers.kitchen = new FeieyunClient(configs.kitchenPrinter);
      functions.logger.info('Kitchen printer client initialized.', { user: configs.kitchenPrinter.user, sn: configs.kitchenPrinter.sn });
    }
    // 初始化其他打印機...
  }

  public async printOrderReceipt(orderData: PrintableOrder, language?: PrintLanguage): Promise<boolean> {
    if (!this.printers.receipt) {
      functions.logger.error('Receipt printer is not configured. Cannot print receipt for order:', orderData.orderId);
      return false;
    }

    const langToUse = language || this.defaultLanguage;
    try {
      const formattedReceipt = formatOrderForPrinting(orderData, langToUse);
      functions.logger.info(`Printing receipt for order: ${orderData.orderId}, Language: ${langToUse}`, {contentLength: formattedReceipt.length});
      await this.printers.receipt.printRawContent(formattedReceipt);
      functions.logger.info('Receipt printing job sent successfully for order:', orderData.orderId);
      return true;
    } catch (error) {
      functions.logger.error('Failed to print receipt for order:', orderData.orderId, error);
      return false;
    }
  }

  public async printKitchenSlip(orderData: PrintableOrder, language?: PrintLanguage): Promise<boolean> {
    if (!this.printers.kitchen) {
      functions.logger.error('Kitchen printer is not configured. Cannot print kitchen slip for order:', orderData.orderId);
      return false;
    }
    
    const langToUse = language || this.defaultLanguage;
    try {
      const formattedSlip = formatOrderForKitchen(orderData, langToUse);
      functions.logger.info(`Printing kitchen slip for order: ${orderData.orderId}, Language: ${langToUse}`, {contentLength: formattedSlip.length});
      await this.printers.kitchen.printRawContent(formattedSlip);
      functions.logger.info('Kitchen slip printing job sent successfully for order:', orderData.orderId);
      return true;
    } catch (error) {
      functions.logger.error('Failed to print kitchen slip for order:', orderData.orderId, error);
      return false;
    }
  }

  /**
   * 統一打印訂單的收據和/或廚房單。
   * @param orderData 要打印的訂單數據。
   * @param printReceipt 是否打印顧客收據，默認為 true。
   * @param printKitchen 是否打印廚房單，默認為 true。
   * @param language 可選的打印語言。
   * @returns 一個 Promise，解析為一個對象，包含各打印任務的成功狀態。
   */
  public async printOrderFull(
    orderData: PrintableOrder, 
    options: { printReceipt?: boolean; printKitchen?: boolean; language?: PrintLanguage } = {}
  ): Promise<{ receiptPrinted: boolean | null; kitchenSlipPrinted: boolean | null }> {
    const { printReceipt = true, printKitchen = true, language } = options;
    const results: { receiptPrinted: boolean | null; kitchenSlipPrinted: boolean | null } = {
        receiptPrinted: null,
        kitchenSlipPrinted: null,
    };

    const printTasks: Promise<void>[] = [];

    if (printReceipt) {
      if (this.printers.receipt) {
        printTasks.push(
            this.printOrderReceipt(orderData, language)
                .then(success => { results.receiptPrinted = success; })
        );
      } else {
        functions.logger.warn('Receipt printing requested but printer not configured for order:', orderData.orderId);
        results.receiptPrinted = false;
      }
    }

    if (printKitchen) {
      if (this.printers.kitchen) {
        printTasks.push(
            this.printKitchenSlip(orderData, language)
                .then(success => { results.kitchenSlipPrinted = success; })
        );
      } else {
        functions.logger.warn('Kitchen printing requested but printer not configured for order:', orderData.orderId);
        results.kitchenSlipPrinted = false;
      }
    }
    
    await Promise.all(printTasks);
    functions.logger.info('All requested print jobs processed for order:', orderData.orderId, results);
    return results;
  }
}

// 如何使用 PrintingService (示例):
// 1. 在某處 (例如 Firebase Functions 的環境變數或 Firestore 配置文檔) 安全地存儲打印機的 UKEY。
// 2. 在您的 Cloud Function (例如，訂單創建觸發器) 中:
//    const receiptPrinterUser = functions.config().printers?.receipt_user || 'your-feieyun-user';
//    const receiptPrinterSn = functions.config().printers?.receipt_sn || 'your-receipt-printer-sn';
//    const receiptPrinterUkey = functions.config().printers?.receipt_ukey; // 從安全來源獲取!
// 
//    const kitchenPrinterUser = functions.config().printers?.kitchen_user || 'your-feieyun-user';
//    const kitchenPrinterSn = functions.config().printers?.kitchen_sn || 'your-kitchen-printer-sn';
//    const kitchenPrinterUkey = functions.config().printers?.kitchen_ukey; // 從安全來源獲取!
// 
//    const printerConfigs: PrinterServiceConfigs = {};
//    if (receiptPrinterUkey) {
//      printerConfigs.receiptPrinter = {
//        user: receiptPrinterUser,
//        sn: receiptPrinterSn,
//        ukey: receiptPrinterUkey,
//        // language: 'traditional-chinese', // 可選
//        // copies: 1, // 可選
//      };
//    }
// 
//    if (kitchenPrinterUkey) {
//      printerConfigs.kitchenPrinter = {
//        user: kitchenPrinterUser,
//        sn: kitchenPrinterSn,
//        ukey: kitchenPrinterUkey,
//      };
//    }
// 
//    if (Object.keys(printerConfigs).length === 0) {
//        functions.logger.warn("No printers configured with UKEYs. Printing service will not be effective.");
//    }
//    const printingService = new PrintingService(printerConfigs);
// 
// 3. 從 Firestore 或其他來源獲取訂單數據，並將其轉換為 PrintableOrder 格式。
//    const orderSnapshot = await db.collection('orders').doc(orderId).get();
//    const orderData = orderSnapshot.data() as YourOrderType;
//    const printableOrder: PrintableOrder = mapYourOrderToPrintableOrder(orderData); // 您需要實現此映射函數
// 
// 4. 調用打印方法:
//    await printingService.printOrderFull(printableOrder, { printReceipt: true, printKitchen: true }); 