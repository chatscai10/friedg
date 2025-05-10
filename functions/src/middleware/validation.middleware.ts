import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, z } from 'zod';

/**
 * 請求驗證配置介面
 */
interface ValidationConfig {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

/**
 * 通用請求驗證中間件
 * 支持對 body、query 和 params 的驗證
 */
export const validateRequest = (schemas: ValidationConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 建立一個綜合的驗證物件，只包含需要驗證的部分
      const validationObject: Record<string, any> = {};
      if (schemas.body) validationObject.body = req.body;
      if (schemas.query) validationObject.query = req.query;
      if (schemas.params) validationObject.params = req.params;

      // 建立一個綜合的 schema
      const combinedSchema = z.object(
        Object.entries(schemas).reduce((acc, [key, schema]) => {
          if (schema) {
            acc[key] = schema;
          }
          return acc;
        }, {} as Record<string, AnyZodObject>)
      );

      // 執行驗證
      const validatedData = await combinedSchema.parseAsync(validationObject);

      // 將驗證後的數據賦值回請求對象
      if (validatedData.body) req.body = validatedData.body;
      if (validatedData.query) req.query = validatedData.query;
      if (validatedData.params) req.params = validatedData.params;

      next();
    } catch (error: any) {
      console.error('請求驗證失敗:', error);
      
      // 如果是 Zod 驗證錯誤，提供結構化的錯誤信息
      if (error.errors) {
        return res.status(400).json({
          status: 'error',
          message: '請求驗證失敗',
          errors: error.errors.map((err: any) => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }

      // 其他類型錯誤
      return res.status(400).json({
        status: 'error',
        message: error.message || '請求驗證失敗'
      });
    }
  };
}; 