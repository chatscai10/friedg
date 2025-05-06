// 訂單狀態類型定義
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

// 訂單類型定義
export type OrderType = 'dine-in' | 'takeout' | 'delivery';

// 支付狀態類型定義
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'refunded';

// 支付方式類型定義
export type PaymentMethod = 'cash' | 'linepay' | 'creditcard' | null;

// 訂單項目類型定義
export interface OrderItem {
  id?: string;
  menuItemId: string;
  menuItemName: string;
  name?: string;
  menuItemImage?: string;
  quantity: number;
  unitPrice?: number;
  price?: number;
  totalPrice: number;
  specialInstructions?: string;
}

// 訂單類型定義
export interface Order {
  id: string;
  orderNumber: string;
  storeId: string;
  storeName?: string;
  customerId: string | null;
  customerName?: string;
  customerPhone?: string;
  status: OrderStatus;
  orderType: OrderType;
  items: OrderItem[];
  subtotal?: number;
  taxAmount?: number;
  totalPrice: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  userId?: string;
}

// 用於 API 響應的分頁信息
export interface PaginationInfo {
  totalOrders: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

// getOrders API 響應類型
export interface GetOrdersResponse {
  orders: Order[];
  pagination: PaginationInfo;
} 