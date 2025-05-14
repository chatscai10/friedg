/**
 * 訂單服務 - 離線支持示例
 * 展示如何在訂單服務中集成離線功能
 */

import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { 
  getOfflineStorage, 
  getNetworkService, 
  withOfflineSupport, 
  withOfflineRead 
} from '../offlineServiceInitializer';
import { showErrorNotification, showSuccessNotification } from '../../utils/notification';

// 訂單狀態
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// 訂單來源
export enum OrderSource {
  POS = 'pos',
  ONLINE = 'online',
  UBER_EATS = 'uber_eats',
  FOODPANDA = 'foodpanda'
}

// 支付方式
export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  LINE_PAY = 'line_pay',
  UBER_EATS = 'uber_eats',
  FOODPANDA = 'foodpanda'
}

// 訂單項目
export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  options: {
    optionId: string;
    optionName: string;
    optionPrice: number;
  }[];
  notes?: string;
  tenantId: string;
  storeId: string;
  createdAt: any;
  updatedAt: any;
}

// 訂單
export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  source: OrderSource;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  employeeId?: string;
  employeeName?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  notes?: string;
  tenantId: string;
  storeId: string;
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
  cancelledAt?: any;
  cancelReason?: string;
}

/**
 * 訂單服務類
 */
export class OrderService {
  private firestore = getFirestore();
  
  /**
   * 創建訂單
   */
  async createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const orderId = uuidv4();
    
    // 使用離線支持包裝器
    const createOrderWithOffline = withOfflineSupport(
      // 在線操作
      async () => {
        const orderRef = doc(this.firestore, 'orders', orderId);
        
        // 創建訂單
        const order: Order = {
          ...orderData,
          id: orderId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(orderRef, order);
        
        // 創建訂單項目
        for (const item of orderData.items) {
          const itemId = item.id || uuidv4();
          const itemRef = doc(this.firestore, 'orderItems', itemId);
          
          await setDoc(itemRef, {
            ...item,
            id: itemId,
            orderId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        
        showSuccessNotification('訂單創建成功');
        return orderId;
      },
      // 離線操作
      async () => {
        const storage = getOfflineStorage();
        
        // 創建訂單
        const order: Order = {
          ...orderData,
          id: orderId,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // 緩存訂單
        await storage.cacheDocument('orders', orderId, order, true);
        
        // 緩存訂單項目
        for (const item of orderData.items) {
          const itemId = item.id || uuidv4();
          
          await storage.cacheDocument('orderItems', itemId, {
            ...item,
            id: itemId,
            orderId,
            createdAt: new Date(),
            updatedAt: new Date()
          }, true);
        }
        
        showSuccessNotification('訂單已創建（離線模式）');
      },
      // 操作選項
      {
        collection: 'orders',
        documentId: orderId,
        operation: 'create',
        data: {
          ...orderData,
          id: orderId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    await createOrderWithOffline();
    return orderId;
  }
  
  /**
   * 獲取訂單
   */
  async getOrder(orderId: string): Promise<Order | null> {
    // 使用離線讀取包裝器
    const getOrderWithOffline = withOfflineRead(
      // 在線讀取
      async () => {
        const orderRef = doc(this.firestore, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
          return null;
        }
        
        return orderSnap.data() as Order;
      },
      // 離線讀取
      async () => {
        const storage = getOfflineStorage();
        const cachedOrder = await storage.getCachedDocument('orders', orderId);
        
        if (!cachedOrder) {
          return null;
        }
        
        return cachedOrder.data as Order;
      },
      // 讀取選項
      {
        collection: 'orders',
        documentId: orderId,
        cacheResult: true
      }
    );
    
    return await getOrderWithOffline();
  }
  
  /**
   * 獲取訂單項目
   */
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    // 檢查網絡狀態
    const network = getNetworkService();
    
    if (network.isOnline()) {
      try {
        // 在線獲取訂單項目
        const itemsRef = collection(this.firestore, 'orderItems');
        const q = query(
          itemsRef,
          where('orderId', '==', orderId),
          orderBy('createdAt', 'asc')
        );
        
        const itemsSnap = await getDocs(q);
        const items: OrderItem[] = [];
        
        itemsSnap.forEach(doc => {
          items.push(doc.data() as OrderItem);
        });
        
        // 緩存訂單項目
        const storage = getOfflineStorage();
        for (const item of items) {
          await storage.cacheDocument('orderItems', item.id, item, false);
        }
        
        return items;
      } catch (error) {
        console.error('獲取訂單項目失敗:', error);
        
        // 嘗試從緩存獲取
        return await this.getOrderItemsFromCache(orderId);
      }
    } else {
      // 離線獲取訂單項目
      return await this.getOrderItemsFromCache(orderId);
    }
  }
  
  /**
   * 從緩存獲取訂單項目
   */
  private async getOrderItemsFromCache(orderId: string): Promise<OrderItem[]> {
    const storage = getOfflineStorage();
    const allItems = await storage.getCachedDocumentsByCollection('orderItems');
    
    // 過濾出屬於指定訂單的項目
    return allItems
      .filter(item => (item.data as OrderItem).orderId === orderId)
      .map(item => item.data as OrderItem)
      .sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return aTime - bTime;
      });
  }
  
  /**
   * 更新訂單狀態
   */
  async updateOrderStatus(
    orderId: string, 
    status: OrderStatus, 
    additionalData: Partial<Order> = {}
  ): Promise<void> {
    // 使用離線支持包裝器
    const updateOrderWithOffline = withOfflineSupport(
      // 在線操作
      async () => {
        const orderRef = doc(this.firestore, 'orders', orderId);
        
        // 根據狀態設置額外字段
        const statusFields: any = {};
        
        if (status === OrderStatus.COMPLETED) {
          statusFields.completedAt = serverTimestamp();
        } else if (status === OrderStatus.CANCELLED) {
          statusFields.cancelledAt = serverTimestamp();
        }
        
        await updateDoc(orderRef, {
          status,
          ...statusFields,
          ...additionalData,
          updatedAt: serverTimestamp()
        });
        
        showSuccessNotification(`訂單狀態已更新為 ${status}`);
      },
      // 離線操作
      async () => {
        const storage = getOfflineStorage();
        
        // 獲取當前訂單
        const cachedOrder = await storage.getCachedDocument('orders', orderId);
        
        if (!cachedOrder) {
          throw new Error('訂單不存在');
        }
        
        const order = cachedOrder.data as Order;
        
        // 根據狀態設置額外字段
        const statusFields: any = {};
        
        if (status === OrderStatus.COMPLETED) {
          statusFields.completedAt = new Date();
        } else if (status === OrderStatus.CANCELLED) {
          statusFields.cancelledAt = new Date();
        }
        
        // 更新訂單
        const updatedOrder = {
          ...order,
          status,
          ...statusFields,
          ...additionalData,
          updatedAt: new Date()
        };
        
        // 緩存更新後的訂單
        await storage.cacheDocument('orders', orderId, updatedOrder, false);
        
        showSuccessNotification(`訂單狀態已更新為 ${status}（離線模式）`);
      },
      // 操作選項
      {
        collection: 'orders',
        documentId: orderId,
        operation: 'update',
        data: {
          status,
          ...(status === OrderStatus.COMPLETED ? { completedAt: new Date() } : {}),
          ...(status === OrderStatus.CANCELLED ? { cancelledAt: new Date() } : {}),
          ...additionalData,
          updatedAt: new Date()
        }
      }
    );
    
    await updateOrderWithOffline();
  }
  
  /**
   * 刪除訂單
   */
  async deleteOrder(orderId: string): Promise<void> {
    // 使用離線支持包裝器
    const deleteOrderWithOffline = withOfflineSupport(
      // 在線操作
      async () => {
        // 獲取訂單項目
        const itemsRef = collection(this.firestore, 'orderItems');
        const q = query(itemsRef, where('orderId', '==', orderId));
        const itemsSnap = await getDocs(q);
        
        // 刪除訂單項目
        const batch = this.firestore.batch();
        itemsSnap.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // 刪除訂單
        const orderRef = doc(this.firestore, 'orders', orderId);
        batch.delete(orderRef);
        
        await batch.commit();
        
        showSuccessNotification('訂單已刪除');
      },
      // 離線操作
      async () => {
        const storage = getOfflineStorage();
        
        // 獲取訂單項目
        const allItems = await storage.getCachedDocumentsByCollection('orderItems');
        const orderItems = allItems.filter(item => (item.data as OrderItem).orderId === orderId);
        
        // 刪除訂單項目
        for (const item of orderItems) {
          await storage.deleteCachedDocument('orderItems', item.documentId);
        }
        
        // 刪除訂單
        await storage.deleteCachedDocument('orders', orderId);
        
        showSuccessNotification('訂單已刪除（離線模式）');
      },
      // 操作選項
      {
        collection: 'orders',
        documentId: orderId,
        operation: 'delete'
      }
    );
    
    await deleteOrderWithOffline();
  }
}
