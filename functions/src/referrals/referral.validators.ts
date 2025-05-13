import { z } from 'zod';

/**
 * 應用推薦碼請求體 schema
 */
export const ApplyReferralCodeSchema = z.object({
  code: z.string().length(6, '推薦碼必須是6位')
}).strict();

/**
 * 獲取推薦記錄查詢參數 schema
 */
export const GetReferralsQuerySchema = z.object({
  type: z.enum(['referrer', 'referee', 'all']).optional().default('all')
}).strict();

// 定義返回類型
export type ApplyReferralCodeInput = z.infer<typeof ApplyReferralCodeSchema>;
export type GetReferralsQueryParams = z.infer<typeof GetReferralsQuerySchema>; 