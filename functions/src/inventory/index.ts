/**
 * 庫存管理系統模組
 * 
 * 提供庫存項目管理、庫存水平追蹤和庫存調整功能
 */

// 導出類型定義
export * from './inventory.types';

// 導出處理函數
export * from './inventory.handlers';

// 導出路由
export { default as inventoryRoutes } from './inventory.routes'; 