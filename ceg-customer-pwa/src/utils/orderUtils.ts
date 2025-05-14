import { OrderStatus } from '../types/order.types'; // 從 ceg-customer-pwa 自己的類型導入

export const ORDER_STATUS_MAP: Record<OrderStatus, { text: string; color?: string }> = {
  pending: { text: '待處理', color: 'warning' },
  pending_payment: { text: '等待付款', color: 'warning' },
  confirmed: { text: '已確認', color: 'info' },
  preparing: { text: '準備中', color: 'info' },
  ready: { text: '可取餐/待配送', color: 'primary' },
  delivering: { text: '配送中', color: 'info' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'error' },
  paid: { text: '已付款', color: 'success' },
  payment_failed: { text: '付款失敗', color: 'error' },
  declined: { text: '已拒絕', color: 'error' },
};

export const getOrderStatusText = (status: OrderStatus | string): string => {
  if (status in ORDER_STATUS_MAP) {
    return ORDER_STATUS_MAP[status as OrderStatus].text;
  }
  return status as string;
};

// 顧客PWA可能不需要Chip顏色，但保留函數結構以備將來使用或保持一致性
// MUI Chip color type for reference: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"
export const getOrderStatusChipColor = (status: OrderStatus | string): string | undefined => {
  if (status in ORDER_STATUS_MAP) {
    return ORDER_STATUS_MAP[status as OrderStatus].color;
  }
  return 'default'; // Fallback color
}; 