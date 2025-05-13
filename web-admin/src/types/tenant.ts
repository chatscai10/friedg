/**
 * 表示系統中的一個租戶項目，主要用於下拉選擇框等。
 */
export interface TenantItem {
  id: string;      // 租戶的唯一ID
  name: string;    // 租戶的顯示名稱
  // 可以根據後端 Tenant 模型的實際情況添加其他必要或有用的字段，
  // 例如 status, description 等，但 id 和 name 是下拉框最基本的。
}

/**
 * 代表租戶列表在 Redux store 中的狀態。
 */
export interface TenantState {
  tenantsList: TenantItem[]; // 當前獲取到的所有可用租戶列表
  loading: boolean;        // 指示租戶列表是否正在加載中
  error: string | null;    // 如果加載過程中發生錯誤，則存儲錯誤信息
} 