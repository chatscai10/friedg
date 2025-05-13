/**
 * 測試資料生成工具
 * 用於產生測試所需的模擬數據
 */

import { DateTime } from 'luxon';

/**
 * 生成隨機 ID
 * @param prefix 前綴
 * @returns 隨機ID字符串
 */
export function generateId(prefix: string = ''): string {
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${prefix ? '-' : ''}${randomPart}`;
}

/**
 * 生成隨機價格
 * @param min 最小值
 * @param max 最大值
 * @returns 隨機價格
 */
export function generatePrice(min: number = 10, max: number = 1000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成隨機日期
 * @param daysAgo 過去天數範圍
 * @returns ISO 日期字符串
 */
export function generateDate(daysAgo: number = 30): string {
  const days = Math.floor(Math.random() * daysAgo);
  return DateTime.now().minus({ days }).toISO();
}

/**
 * 創建模擬用戶
 * @param overrides 覆蓋屬性
 * @returns 模擬用戶資料
 */
export function createMockUser(overrides: Record<string, any> = {}) {
  const id = generateId('user');
  
  return {
    id,
    email: `test-${id}@example.com`,
    role: 'staff',
    displayName: `測試用戶 ${id}`,
    phoneNumber: `09${Math.floor(Math.random() * 100000000)}`,
    storeId: generateId('store'),
    tenantId: generateId('tenant'),
    createdAt: generateDate(),
    updatedAt: generateDate(5),
    active: true,
    ...overrides
  };
}

/**
 * 創建模擬庫存項目
 * @param overrides 覆蓋屬性
 * @returns 模擬庫存項目資料
 */
export function createMockInventoryItem(overrides: Record<string, any> = {}) {
  const id = generateId('item');
  const price = generatePrice();
  
  return {
    id,
    name: `測試商品 ${id}`,
    sku: `SKU-${id}`,
    price,
    cost: Math.floor(price * 0.6),
    stockLevel: Math.floor(Math.random() * 100),
    category: 'test-category',
    description: '測試商品描述',
    imageUrl: 'https://example.com/images/test.jpg',
    barcode: `BARCODE-${id}`,
    isActive: true,
    createdAt: generateDate(),
    updatedAt: generateDate(5),
    ...overrides
  };
}

/**
 * 創建模擬訂單
 * @param overrides 覆蓋屬性
 * @returns 模擬訂單資料
 */
export function createMockOrder(overrides: Record<string, any> = {}) {
  const id = generateId('order');
  const items = Array(Math.floor(Math.random() * 5) + 1)
    .fill(null)
    .map(() => {
      const item = createMockInventoryItem();
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: Math.floor(Math.random() * 5) + 1
      };
    });
    
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = Math.floor(subtotal * 0.05);
  
  return {
    id,
    customerId: generateId('customer'),
    storeId: generateId('store'),
    employeeId: generateId('employee'),
    orderNumber: `ORD-${Math.floor(Math.random() * 10000)}`,
    status: 'pending',
    items,
    subtotal,
    tax,
    total: subtotal + tax,
    paymentStatus: 'pending',
    createdAt: generateDate(),
    updatedAt: generateDate(1),
    ...overrides
  };
}

/**
 * 創建模擬分店
 * @param overrides 覆蓋屬性
 * @returns 模擬分店資料
 */
export function createMockStore(overrides: Record<string, any> = {}) {
  const id = generateId('store');
  
  return {
    id,
    name: `測試分店 ${id}`,
    address: '測試地址',
    phone: `02-${Math.floor(Math.random() * 10000000)}`,
    email: `store-${id}@example.com`,
    manager: generateId('employee'),
    status: 'active',
    tenantId: generateId('tenant'),
    createdAt: generateDate(),
    updatedAt: generateDate(5),
    ...overrides
  };
} 