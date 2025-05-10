/**
 * 生成本地佔位圖片URL，替代via.placeholder.com服務
 * @returns 本地佔位圖片路徑
 */
export const getPlaceholderImage = (): string => {
  // 使用本地靜態資源路徑
  return `/assets/images/placeholder.svg`;
}; 