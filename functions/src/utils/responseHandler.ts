/**
 * 標準 API 響應處理工具
 * 
 * 提供統一的成功和錯誤響應格式
 */

import { Response } from 'express';
import { CustomError } from '../libs/utils/errors';

/**
 * 發送成功響應
 * 
 * @param res Express 響應對象
 * @param data 響應數據
 * @param statusCode HTTP 狀態碼 (默認 200)
 */
export function sendSuccessResponse(res: Response, data: any, statusCode: number = 200): void {
  const response = {
    success: true,
    data: data
  };
  
  res.status(statusCode).json(response);
}

/**
 * 發送錯誤響應
 * 
 * @param res Express 響應對象
 * @param error 錯誤對象
 */
export function sendErrorResponse(res: Response, error: any): void {
  console.error('API Error:', error);
  
  // 默認錯誤響應
  let statusCode = 500;
  let errorMessage = '伺服器內部錯誤';
  let errorDetails = undefined;
  
  // 處理 CustomError
  if (error instanceof CustomError) {
    statusCode = error.statusCode || 500;
    errorMessage = error.message;
    errorDetails = error.details;
  } 
  // 處理標準 Error
  else if (error instanceof Error) {
    errorMessage = error.message;
  }
  
  // 構建錯誤響應
  const response = {
    success: false,
    message: errorMessage
  };
  
  // 添加錯誤詳情 (如果有)
  if (errorDetails) {
    Object.assign(response, { error: errorDetails });
  }
  
  res.status(statusCode).json(response);
}
