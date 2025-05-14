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

// 此映射應與 web-admin/src/utils/orderUtils.ts 中的 ORDER_STATUS_MAP 保持文本一致
const ORDER_STATUS_TEXT_MAP: Record<OrderStatus, string> = {
  pending: '待處理',
  pending_payment: '待付款',
  confirmed: '已確認',
  preparing: '準備中',
  ready: '可取餐/待配送',
  delivering: '配送中',
  completed: '已完成',
  cancelled: '已取消',
  paid: '已付款',
  payment_failed: '付款失敗',
  declined: '已拒絕',
};

export const orderStatusToString = (status: OrderStatus | string): string => {
  if (status in ORDER_STATUS_TEXT_MAP) {
    return ORDER_STATUS_TEXT_MAP[status as OrderStatus];
  }
  return status as string; // Fallback for unknown statuses
}; 