import { OrderStatus } from '../types/order'; // 從 web-admin 自己的類型導入

export const ORDER_STATUS_MAP: Record<OrderStatus, { text: string; color: string }> = {
  pending: { text: '待處理', color: 'warning' },
  pending_payment: { text: '待付款', color: 'warning' },
  confirmed: { text: '已確認', color: 'info' }, // MUI Chip color 'info' or 'secondary' often used
  preparing: { text: '準備中', color: 'info' },
  ready: { text: '可取餐/待配送', color: 'primary' },
  delivering: { text: '配送中', color: 'info' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'error' },
  paid: { text: '已付款', color: 'success' },
  payment_failed: { text: '付款失敗', color: 'error' },
  declined: { text: '已拒絕', color: 'error' },
  // 根據 functions/src/notifications/notifications.v2.ts 和 ceg-customer-pwa 的 OrderStatus 擴展
  // 以下是根據常用PWA狀態的推測，需要與其他部分的 OrderStatus 定義對齊
  // 'pending_payment': { text: '待付款', color: 'warning' }, 
  // 'paid': { text: '已付款', color: 'success' },
  // 'confirmed': { text: '已確認', color: 'secondary' }, 
  // 'payment_failed': { text: '付款失敗', color: 'error' },
  // 'declined': { text: '已拒絕', color: 'error' },
  // 'delivering': { text: '配送中', color: 'info' },
  // 'delivered': { text: '已送達', color: 'success' },
  // 'failed_delivery': { text: '配送失敗', color: 'error' },
};

export const getOrderStatusText = (status: OrderStatus | string): string => {
  // 容錯處理，如果傳入的status不在預期類型中，直接返回status本身
  if (status in ORDER_STATUS_MAP) {
    return ORDER_STATUS_MAP[status as OrderStatus].text;
  }
  return status as string;
};

// 如果需要 Chip 的顏色，可以類似地創建一個函數
export const getOrderStatusChipColor = (status: OrderStatus | string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
  if (status in ORDER_STATUS_MAP) {
    const mappedColor = ORDER_STATUS_MAP[status as OrderStatus].color;
    switch (mappedColor) {
      case 'primary':
      case 'secondary': // Assuming secondary might be used
      case 'error':
      case 'info':
      case 'success':
      case 'warning':
        return mappedColor;
      default:
        return 'default';
    }
  }
  return 'default';
}; 