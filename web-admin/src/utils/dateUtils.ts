import { Timestamp } from 'firebase/firestore';
import dayjs from 'dayjs';

/**
 * 將日期格式化為短日期格式
 * @param date Timestamp或Date或string
 * @returns 格式化的日期字符串 YYYY-MM-DD
 */
export const formatDate = (date: Timestamp | Date | string | undefined | null): string => {
  if (!date) return '';

  let dayjsDate;
  if (date instanceof Timestamp) {
    dayjsDate = dayjs(date.toDate());
  } else {
    dayjsDate = dayjs(date);
  }
  
  return dayjsDate.isValid() ? dayjsDate.format('YYYY-MM-DD') : '';
};

/**
 * 將日期時間格式化為詳細日期時間格式
 * @param date Timestamp或Date或string
 * @returns 格式化的日期時間字符串 YYYY-MM-DD HH:mm:ss
 */
export const formatDateTime = (date: Timestamp | Date | string | undefined | null): string => {
  if (!date) return '';

  let dayjsDate;
  if (date instanceof Timestamp) {
    dayjsDate = dayjs(date.toDate());
  } else {
    dayjsDate = dayjs(date);
  }
  
  return dayjsDate.isValid() ? dayjsDate.format('YYYY-MM-DD HH:mm:ss') : '';
};

/**
 * 將日期格式化為相對時間（例如：3小時前）
 * @param date Timestamp或Date或string
 * @returns 相對時間字符串
 */
export const formatRelativeTime = (date: Timestamp | Date | string | undefined | null): string => {
  if (!date) return '';

  let dayjsDate;
  if (date instanceof Timestamp) {
    dayjsDate = dayjs(date.toDate());
  } else {
    dayjsDate = dayjs(date);
  }
  
  if (!dayjsDate.isValid()) return '';
  
  const now = dayjs();
  const diffMinutes = now.diff(dayjsDate, 'minute');
  
  if (diffMinutes < 1) return '剛剛';
  if (diffMinutes < 60) return `${diffMinutes}分鐘前`;
  
  const diffHours = now.diff(dayjsDate, 'hour');
  if (diffHours < 24) return `${diffHours}小時前`;
  
  const diffDays = now.diff(dayjsDate, 'day');
  if (diffDays < 30) return `${diffDays}天前`;
  
  const diffMonths = now.diff(dayjsDate, 'month');
  if (diffMonths < 12) return `${diffMonths}個月前`;
  
  return `${now.diff(dayjsDate, 'year')}年前`;
}; 