/**
 * 常用格式化工具函數
 */

/**
 * 格式化貨幣顯示
 * @param value 要格式化的數值
 * @param locale 地區設定，預設 'zh-TW'
 * @param currency 貨幣類型，預設 'TWD'
 * @returns 格式化後的貨幣字串
 */
export const formatCurrency = (
  value: number | string,
  locale: string = 'zh-TW',
  currency: string = 'TWD'
): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(numValue);
};

/**
 * 格式化百分比顯示
 * @param value 要格式化的數值 (0.1 表示 10%)
 * @param locale 地區設定，預設 'zh-TW'
 * @param digits 小數位數，預設 2
 * @returns 格式化後的百分比字串
 */
export const formatPercent = (
  value: number | string,
  locale: string = 'zh-TW',
  digits: number = 2
): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(numValue);
};

/**
 * 格式化日期顯示
 * @param value 要格式化的日期字串或日期對象
 * @param locale 地區設定，預設 'zh-TW'
 * @param options 日期格式化選項
 * @returns 格式化後的日期字串
 */
export const formatDate = (
  value: string | Date,
  locale: string = 'zh-TW',
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }
): string => {
  if (!value) return '';
  
  try {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch (error) {
    console.error('Date formatting error:', error);
    return String(value);
  }
};

/**
 * 格式化數值顯示
 * @param value 要格式化的數值
 * @param locale 地區設定，預設 'zh-TW'
 * @param digits 小數位數，預設 2
 * @returns 格式化後的數值字串
 */
export const formatNumber = (
  value: number | string,
  locale: string = 'zh-TW',
  digits: number = 2
): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'N/A';

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(numValue);
}; 