import { z } from 'zod';

/**
 * LINE Token 交換請求驗證 Schema
 * 用於驗證 /api/auth/line 端點的請求體
 */
export const LineTokenExchangeSchema = z.object({
  /**
   * LINE Access Token，從 LIFF SDK 獲取
   * 用於存取 LINE Platform API (例如獲取用戶 Profile)
   */
  lineAccessToken: z.string().min(1, '請提供 LINE Access Token'),
  
  /**
   * LINE ID Token，從 LIFF SDK 獲取
   * 包含已驗證的用戶身份信息，用於後端驗證用戶身份
   */
  lineIdToken: z.string().min(1, '請提供 LINE ID Token'),
  
  /**
   * 租戶提示（可選）
   * 在多租戶環境中，可用於識別應該使用哪個租戶的 LINE Channel 配置
   * 可能來自子域名、URL 參數或用戶選擇
   */
  tenantHint: z.string().optional(),
});

// 導出請求體的類型定義
export type LineTokenExchangeInput = z.infer<typeof LineTokenExchangeSchema>;

/**
 * 員工 LINE Token 交換請求驗證 Schema
 * 用於驗證 /api/auth/employee-login 端點的請求體
 */
export const EmployeeLineLoginSchema = LineTokenExchangeSchema.extend({
  /**
   * 店鋪選擇（如果員工屬於多個店鋪）
   * 如果員工只屬於一個店鋪，可以省略
   */
  storeId: z.string().uuid().optional(),
});

// 導出員工請求體的類型定義
export type EmployeeLineLoginInput = z.infer<typeof EmployeeLineLoginSchema>; 