import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

/**
 * 請求資料驗證中間件
 * 
 * 使用 zod 驗證 request 的各個部分 (body, params, query)，確保資料符合預期格式
 */

/**
 * 驗證選項
 */
interface ValidationOptions {
  body?: z.ZodType<any, any>;
  params?: z.ZodType<any, any>;
  query?: z.ZodType<any, any>;
}

/**
 * 創建請求資料驗證中間件 (進階版)
 * 支援驗證 body, params, query 等多個部分
 * 
 * @param options 驗證選項，可以指定驗證 body, params, query 的 schema
 * @returns Express 中間件
 */
export function validateRequest(options: ValidationOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 驗證請求體
      if (options.body) {
        req.body = options.body.parse(req.body);
      }
      
      // 驗證路由參數
      if (options.params) {
        req.params = options.params.parse(req.params);
      }
      
      // 驗證查詢參數
      if (options.query) {
        req.query = options.query.parse(req.query);
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // 格式化 Zod 錯誤
        const errorMessages = error.errors.map(err => {
          const path = err.path.join('.');
          return `${path ? `${path}: ` : ''}${err.message}`;
        });
        
        res.status(400).json({
          success: false,
          error: '請求資料驗證失敗',
          details: errorMessages
        });
        return;
      }
      
      // 處理其他錯誤
      console.error('資料驗證過程中發生未預期的錯誤:', error);
      res.status(500).json({
        success: false,
        error: '資料驗證過程中發生未預期的錯誤'
      });
    }
  };
}

/**
 * 簡化版請求資料驗證中間件
 * 只驗證請求體 (body)
 * 
 * @param schema Zod 驗證模式
 * @returns Express 中間件
 */
export function validateBody(schema: z.ZodType<any, any>) {
  return validateRequest({ body: schema });
}

/**
 * 建立一個測試環境中的模擬驗證中間件
 * 不執行實際驗證，僅用於測試環境
 * 
 * @returns Express 中間件
 */
export function createMockValidator() {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log('請求驗證中間件已跳過實際驗證（測試模式）');
    next();
  };
}
