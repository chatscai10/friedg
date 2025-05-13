/**
 * 庫存管理模組
 * 
 * 主入口文件，匯出所有服務、儲存庫和類型
 */
import * as express from 'express';
import * as inventoryRouter from './inventory.routes';

// 匯出公共API，用於外部模組調用
export * from './inventory.types';
export * from './services';
export * from './repositories';
export * from './utils/errors';
export * from './utils/error-handler';

/**
 * 注冊庫存管理模組的API路由
 * @param app Express應用程序實例
 * @param basePath 庫存模組的基礎路徑
 */
export function registerInventoryRoutes(
  app: express.Application,
  basePath: string = '/inventory'
) {
  app.use(basePath, inventoryRouter.router);
  
  console.log(`✅ 成功注冊庫存管理模組API於 ${basePath}`);
  return app;
}

// 導出處理函數
export * from './inventory.handlers';

// 從原始handlers.ts導出盤點與內部叫貨功能
export * from './handlers';

// 導出驗證schema
export * from './schemas/inventory.schema';

// 導出路由
export { default as inventoryRoutes } from './inventory.routes'; 