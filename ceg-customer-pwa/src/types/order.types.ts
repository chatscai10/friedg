// 訂單狀態類型定義
export type OrderStatus =
  | 'pending'       // 訂單已提交，等待商家確認或處理
  | 'pending_payment' // 等待顧客付款（例如，LINE Pay跳轉後尚未確認）
  | 'confirmed'     // 商家已確認訂單，準備中之前的一個狀態（可選）
  | 'preparing'     // 商家正在準備商品
  | 'ready'         // 商品準備完成，等待取餐/配送
  | 'delivering'    // 配送中 (如果支持配送)
  | 'completed'     // 訂單已完成 (顧客已取餐/已送達)
  | 'cancelled'     // 訂單已取消 (顧客或商家取消)
  | 'paid'          // 已付款 (作為一個獨立狀態或與 confirmed/preparing 結合)
  | 'payment_failed'// 付款失敗
  | 'declined';     // 商家拒絕訂單

// 訂單類型定義 (顧客PWA可能不需要所有管理後台的類型，但包含以保持一致性)
export type OrderType = 'dine-in' | 'takeout' | 'delivery';

// 支付狀態類型定義
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'refunded';

// 支付方式類型定義
export type PaymentMethod = 'cash' | 'linepay' | 'creditcard' | null;

// 訂單項目類型定義
export interface OrderItem {
  id?: string; // Firestore document ID of the menu item in the order
  menuItemId: string; // Original menu item ID
  name: string; // menuItemName is often used, be consistent
  // menuItemImage?: string; // Consider if needed for order history display
  quantity: number;
  price: number; // unitPrice or price, ensure consistency
  // totalPrice: number; // Typically quantity * price
  specialInstructions?: string;
  // variantId?: string; // If items have variants
  // variantName?: string;
}

// 訂單詳細信息 (顧客PWA視角)
export interface Order {
  id: string; // Firestore document ID
  orderNumber: string; // Human-readable order number
  storeId: string;
  // storeName?: string; // May not be needed directly if displaying generic info
  customerId: string; // Firebase UID of the customer
  // customerName?: string; // May be fetched separately or included if available
  // customerPhone?: string;
  status: OrderStatus;
  // orderType?: OrderType; // For customer, this might be implicit or part of pickupMethod
  items: OrderItem[];
  totalAmount: number; // Renamed from totalPrice for consistency with web-admin if that's the case
  paymentMethod?: PaymentMethod | string;
  pickupMethod?: 'store_pickup' | 'delivery'; // Example
  pickupTime?: any; // Firestore Timestamp or ISO string
  createdAt: any; // Firestore Timestamp or ISO string
  updatedAt?: any; // Firestore Timestamp or ISO string
  orderNotes?: string;
  // Add any other fields relevant to the customer's view of their order
  // e.g., deliveryAddress, estimatedCompletionTime
}

// 用於API響應的分頁信息 (如果顧客PWA訂單歷史支持分頁)
export interface OrdersPage {
  orders: Order[];
  lastVisible?: any; // For Firestore pagination cursor
  hasNextPage?: boolean;
} 