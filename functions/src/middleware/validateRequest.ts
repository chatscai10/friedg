import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * 請求驗證中間件
 * 用 Zod schema 驗證請求內容
 */
export const validateRequest = (schema: z.ZodType<any, any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // 驗證請求體
      const validatedData = schema.parse(req.body);
      // 將已驗證的數據添加回請求對象
      req.body = validatedData;
      next();
    } catch (error) {
      // 若驗證失敗，傳回錯誤
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: '請求驗證失敗',
          errors: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      // 未知錯誤
      console.error('請求驗證時發生未知錯誤：', error);
      return res.status(500).json({
        status: 'error',
        message: '處理請求時發生錯誤'
      });
    }
  };
}; 