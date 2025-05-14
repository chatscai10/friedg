import { PrintLanguage } from './printConfig';
import { PrintableOrder, PrintableOrderItem, PrintLanguage as LanguageFromTypes } from './types'; // LanguageFromTypes ist nur ein Alias, um Kollisionen zu vermeiden, falls PrintLanguage auch in types.ts definiert wäre (ist es aber nicht)

// 實際項目中應從 @/types 或類似路徑導入訂單相關類型
// 此處為打印專用簡化接口
interface PrintableOrderItemOption {
  groupName: string;
  choiceName: string;
  priceAdjustment?: number;
}

interface PrintableOrderItem {
  name: string;
  quantity: number;
  unitPrice: number; // 商品原單價
  options?: PrintableOrderItemOption[];
  itemTotal: number; // 此項目（含選項，乘以數量後）的總價
}

export interface PrintableOrder {
  orderId: string;
  storeName?: string;
  orderNumber?: string; // 顯示給顧客的訂單號，可能與 orderId 不同
  createdAt: Date | string; // Firestore timestamp to Date
  customerName?: string;
  items: PrintableOrderItem[];
  subtotal: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount: number;
  paymentMethod?: string;
  notes?: string;
  tableNumber?: string;
  pickupCode?: string;
  // 可根據需要添加更多字段，如會員資訊等
}

// 根據打印紙寬度調整 (58mm 熱敏打印機通常為 32 字符/行)
const PAPER_WIDTH = 32;
const LINE_SEPARATOR = '-'.repeat(PAPER_WIDTH) + '\n';
const DOUBLE_LINE_SEPARATOR = '='.repeat(PAPER_WIDTH) + '\n';

function formatPrice(amount: number): string {
  // 可根據地區調整貨幣符號和格式
  return `$${amount.toFixed(2)}`;
}

function getItemDisplayName(item: PrintableOrderItem, language: PrintLanguage): string {
  let displayName = item.name;
  if (item.options && item.options.length > 0) {
    const optionStrings = item.options.map(opt => {
      let optionText = `${opt.groupName}: ${opt.choiceName}`;
      if (opt.priceAdjustment && opt.priceAdjustment !== 0) {
        optionText += ` (${opt.priceAdjustment > 0 ? '+' : ''}${formatPrice(opt.priceAdjustment)})`;
      }
      return optionText;
    });
    // 每個選項另起一行並縮進，更清晰
    displayName += '\n  ' + optionStrings.join('\n  ');
  }
  return displayName;
}

function padBetween(left: string, right: string, width: number = PAPER_WIDTH): string {
    const spaceNeeded = width - left.length - right.length;
    return left + ' '.repeat(Math.max(0, spaceNeeded)) + right;
}

export function formatOrderForPrinting(order: PrintableOrder, language: PrintLanguage = 'traditional-chinese'): string {
  let content = '';

  // 頁頭
  content += `<C><S3>${order.storeName || '吃雞排找不早'}</S3></C>\n`;
  content += `<C>--- 顧客存根 ---</C>\n`;
  content += LINE_SEPARATOR;
  
  content += `<L>訂單號: ${order.orderNumber || order.orderId}</L>\n`;
  content += `<L>日期: ${new Date(order.createdAt).toLocaleString('zh-TW')}</L>\n`; // 使用台灣地區時間格式
  if (order.tableNumber) {
    content += `<L><B>桌號: ${order.tableNumber}</B></L>\n`;
  }
  if (order.pickupCode) {
    content += `<L><B>取餐號: ${order.pickupCode}</B></L>\n`;
  }
  if (order.customerName) {
    content += `<L>顧客: ${order.customerName}</L>\n`;
  }
  content += LINE_SEPARATOR;

  // 商品列表
  content += `<L><B>商品明細</B></L>\n`;
  order.items.forEach(item => {
    const itemNameDisplay = getItemDisplayName(item, language);
    content += `<L>${itemNameDisplay}</L>\n`;
    
    const qtyLine = `  ${item.quantity} x ${formatPrice(item.unitPrice)}`;
    const itemTotalFormatted = formatPrice(item.itemTotal);
    content += `<L>${padBetween(qtyLine, itemTotalFormatted)}</L>\n`;
  });
  content += LINE_SEPARATOR;

  // 金額統計
  content += `<L>${padBetween('小計:', formatPrice(order.subtotal))}</L>\n`;
  if (order.discountAmount && order.discountAmount > 0) {
    content += `<L>${padBetween('折扣:', `-${formatPrice(order.discountAmount)}`)}</L>\n`;
  }
  if (order.taxAmount && order.taxAmount > 0) {
     content += `<L>${padBetween('稅金:', formatPrice(order.taxAmount))}</L>\n`;
  }
  content += DOUBLE_LINE_SEPARATOR;
  content += `<L><B>${padBetween('總計:', formatPrice(order.totalAmount))}</B></L>\n`;
  content += DOUBLE_LINE_SEPARATOR;
  
  if (order.paymentMethod) {
    content += `<L>支付方式: ${order.paymentMethod}</L>\n`;
  }
  
  // 頁尾
  if (order.notes) {
    content += LINE_SEPARATOR;
    content += `<L>備註:</L>\n<L>${order.notes.replace(/\n/g, '\n<L>')}</L>\n`; // 確保備註中的換行正確打印
  }
  content += `<C>謝謝惠顧，歡迎再次光臨！</C>\n`;
  content += `<C>*** ${order.storeName || '吃雞排找不早'} ***</C>\n\n\n`; //末尾多留空行以便撕紙
  // content += '<CUT>'; // 如打印機支持自動切紙，可添加切紙指令

  return content;
}

export function formatOrderForKitchen(order: PrintableOrder, language: PrintLanguage = 'traditional-chinese'): string {
    let content = '';
    content += `<C><S3>廚房單</S3></C>\n`;
    if (order.tableNumber) {
      content += `<C><S3>桌號: ${order.tableNumber}</S3></C>\n`;
    } else if (order.pickupCode) {
      content += `<C><S3>號碼: ${order.pickupCode}</S3></C>\n`;
    } else {
      // 使用訂單號後幾位作為簡易識別
      content += `<C><S2>訂單: #${(order.orderNumber || order.orderId).slice(-4)}</S2></C>\n`;
    }
    content += `<L>時間: ${new Date(order.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</L>\n`;
    content += DOUBLE_LINE_SEPARATOR;

    order.items.forEach(item => {
        // 廚房單商品名稱和數量字體放大
        content += `<S2>${item.name} x ${item.quantity}</S2>\n`;
        if (item.options && item.options.length > 0) {
            item.options.forEach(opt => {
                // 選項字體正常，縮進顯示
                content += `<L>  - ${opt.groupName}: ${opt.choiceName}</L>\n`;
            });
        }
        content += LINE_SEPARATOR;
    });

    if (order.notes) {
        content += `<L><B>備註:</B></L>\n<L><S1>${order.notes.replace(/\n/g, '\n<L><S1>')}</S1></L>\n`;
        content += LINE_SEPARATOR;
    }
    content += '\n\n\n';
    // content += '<CUT>';
    return content;
} 