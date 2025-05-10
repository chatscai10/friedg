import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { Order, Receipt } from '../types';
import { DateTime } from 'luxon';

const db = admin.firestore();

/**
 * 收據編號生成器
 * 格式: E + 年份(2位) + 月份(2位) + 流水號(6位)
 */
async function generateReceiptNumber(storeId: string): Promise<string> {
  const today = DateTime.now().setZone('Asia/Taipei');
  const yearMonth = today.toFormat('yyMM');
  
  // 獲取當月已有收據數以生成流水號
  const startOfMonth = today.startOf('month').toJSDate();
  const endOfMonth = today.endOf('month').toJSDate();
  
  const snapshot = await db.collection('receipts')
    .where('storeId', '==', storeId)
    .where('issuedAt', '>=', startOfMonth)
    .where('issuedAt', '<=', endOfMonth)
    .get();
  
  const sequenceNum = (snapshot.size + 1).toString().padStart(6, '0');
  return `E${yearMonth}${sequenceNum}`;
}

/**
 * 為訂單生成收據
 */
export async function generateReceipt(orderId: string): Promise<Receipt> {
  // 使用事務確保數據一致性
  return await db.runTransaction(async (transaction) => {
    // 1. 獲取訂單信息
    const orderDoc = await transaction.get(
      db.collection('orders').doc(orderId)
    );
    
    if (!orderDoc.exists) {
      throw new Error(`訂單不存在: ${orderId}`);
    }
    
    const order = orderDoc.data() as Order;
    
    // 2. 檢查訂單是否已支付
    if (order.paymentStatus !== 'paid') {
      throw new Error('只能為已支付的訂單生成收據');
    }
    
    // 3. 檢查是否已經生成過收據
    const existingReceiptSnapshot = await transaction.get(
      db.collection('receipts').where('orderId', '==', orderId).limit(1)
    );
    
    if (!existingReceiptSnapshot.empty) {
      // 直接返回已存在的收據
      return existingReceiptSnapshot.docs[0].data() as Receipt;
    }
    
    // 4. 獲取店鋪信息
    const storeDoc = await transaction.get(
      db.collection('stores').doc(order.storeId)
    );
    
    if (!storeDoc.exists) {
      throw new Error(`店鋪不存在: ${order.storeId}`);
    }
    
    const storeData = storeDoc.data()!;
    
    // 5. 生成收據編號
    const receiptNumber = await generateReceiptNumber(order.storeId);
    
    // 6. 構建收據項目
    const receiptItems = order.items.map(item => ({
      name: item.menuItemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    }));
    
    // 7. 確定是否為電子發票
    const isElectronic = Boolean(order.customerEmail);
    
    // 8. 創建收據對象
    const now = admin.firestore.Timestamp.now();
    const receiptId = uuidv4();
    
    const receipt: Receipt = {
      id: receiptId,
      orderId: order.id,
      receiptNumber,
      storeId: order.storeId,
      storeName: storeData.name || order.storeName,
      storeAddress: storeData.address || '',
      storeTaxId: storeData.taxId || '',
      customerName: order.customerName,
      customerTaxId: order.customerTaxId,
      items: receiptItems,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      isElectronic,
      issuedAt: now.toDate()
    };
    
    // 如果是電子發票，生成電子發票URL
    if (isElectronic) {
      // 此處可以實現電子發票URL生成邏輯
      // 簡化實現，使用預設值
      receipt.electronicReceiptUrl = `https://e-receipts.friedg.com/view/${receiptId}`;
    }
    
    // 9. 保存收據到數據庫
    transaction.set(db.collection('receipts').doc(receiptId), receipt);
    
    // 10. 更新訂單，記錄已生成收據
    transaction.update(orderDoc.ref, {
      hasReceipt: true,
      receiptId: receiptId,
      updatedAt: now.toDate()
    });
    
    // 11. 記錄收據生成事件
    transaction.set(
      db.collection('orders').doc(orderId).collection('events').doc(),
      {
        eventType: 'receipt_generated',
        timestamp: now,
        details: {
          receiptId,
          receiptNumber
        }
      }
    );
    
    return receipt;
  });
}

/**
 * 根據ID獲取收據
 */
export async function getReceiptById(receiptId: string): Promise<Receipt | null> {
  const receiptDoc = await db.collection('receipts').doc(receiptId).get();
  
  if (!receiptDoc.exists) {
    return null;
  }
  
  return receiptDoc.data() as Receipt;
}

/**
 * 根據訂單ID獲取收據
 */
export async function getReceiptByOrderId(orderId: string): Promise<Receipt | null> {
  const receiptSnapshot = await db.collection('receipts')
    .where('orderId', '==', orderId)
    .limit(1)
    .get();
  
  if (receiptSnapshot.empty) {
    return null;
  }
  
  return receiptSnapshot.docs[0].data() as Receipt;
}

/**
 * 格式化收據為HTML
 */
export function formatReceiptAsHtml(receipt: Receipt): string {
  // 簡單的HTML模板
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>收據 ${receipt.receiptNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .receipt { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; }
        .header { text-align: center; margin-bottom: 20px; }
        .store-info { margin-bottom: 20px; }
        .items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items th, .items td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items th { background-color: #f2f2f2; }
        .total { text-align: right; margin-top: 20px; }
        .footer { margin-top: 30px; font-size: 12px; text-align: center; color: #666; }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>收據</h1>
          <p>收據編號: ${receipt.receiptNumber}</p>
          <p>開立日期: ${DateTime.fromJSDate(receipt.issuedAt).toFormat('yyyy-MM-dd HH:mm:ss')}</p>
        </div>
        
        <div class="store-info">
          <p>店鋪: ${receipt.storeName}</p>
          <p>地址: ${receipt.storeAddress}</p>
          <p>統一編號: ${receipt.storeTaxId}</p>
        </div>
        
        <div class="customer-info">
          <p>顧客: ${receipt.customerName || '無記名顧客'}</p>
          ${receipt.customerTaxId ? `<p>統一編號: ${receipt.customerTaxId}</p>` : ''}
        </div>
        
        <table class="items">
          <thead>
            <tr>
              <th>品項</th>
              <th>數量</th>
              <th>單價</th>
              <th>金額</th>
            </tr>
          </thead>
          <tbody>
            ${receipt.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>$${item.unitPrice.toFixed(2)}</td>
                <td>$${item.totalPrice.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total">
          <p>小計: $${receipt.subtotal.toFixed(2)}</p>
          <p>稅金: $${receipt.taxAmount.toFixed(2)}</p>
          ${receipt.discountAmount > 0 ? `<p>折扣: $${receipt.discountAmount.toFixed(2)}</p>` : ''}
          <h3>總計: $${receipt.totalAmount.toFixed(2)}</h3>
          <p>支付方式: ${getPaymentMethodText(receipt.paymentMethod)}</p>
        </div>
        
        <div class="footer">
          <p>感謝您的惠顧，歡迎再次光臨！</p>
          ${receipt.isElectronic ? `<p>電子發票可在以下連結查看: ${receipt.electronicReceiptUrl}</p>` : ''}
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * 獲取支付方式的顯示文字
 */
function getPaymentMethodText(method: string | null): string {
  switch (method) {
    case 'cash':
      return '現金';
    case 'linepay':
      return 'LINE Pay';
    case 'creditcard':
      return '信用卡';
    default:
      return '其他';
  }
} 