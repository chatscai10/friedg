/**
 * 菜單模擬數據文件
 * 提供符合API返回格式的菜單分類和菜單項目模擬數據
 */

import { MenuCategory, MenuItem, MenuItemStockStatus, MenuCategoryType } from '../types/menuItem';

// 菜單分類模擬數據
export const mockMenuCategoriesData = {
  data: [
    {
      id: 'cat-001',
      name: '炸雞系列',
      displayName: '炸雞系列',
      description: '各種現炸酥脆雞肉料理',
      displayOrder: 1,
      type: 'main_dish' as MenuCategoryType,
      imageUrl: 'https://via.placeholder.com/150?text=Chicken',
      isActive: true,
      tenantId: 'default_tenant',
      createdAt: '2024-03-15T09:00:00Z',
      updatedAt: '2024-03-15T09:00:00Z'
    },
    {
      id: 'cat-002',
      name: '配餐',
      displayName: '配餐',
      description: '各種美味配餐選擇',
      displayOrder: 2,
      type: 'side_dish' as MenuCategoryType,
      imageUrl: 'https://via.placeholder.com/150?text=Sides',
      isActive: true,
      tenantId: 'default_tenant',
      createdAt: '2024-03-15T09:15:00Z',
      updatedAt: '2024-03-15T09:15:00Z'
    },
    {
      id: 'cat-003',
      name: '飲料',
      displayName: '飲料',
      description: '清涼飲品選擇',
      displayOrder: 3,
      type: 'drink' as MenuCategoryType,
      imageUrl: 'https://via.placeholder.com/150?text=Drinks',
      isActive: true,
      tenantId: 'default_tenant',
      createdAt: '2024-03-15T09:30:00Z',
      updatedAt: '2024-03-15T09:30:00Z'
    },
    {
      id: 'cat-004',
      name: '套餐',
      displayName: '超值套餐',
      description: '多種套餐組合，物超所值',
      displayOrder: 4,
      type: 'combo' as MenuCategoryType,
      imageUrl: 'https://via.placeholder.com/150?text=Combos',
      isActive: true,
      tenantId: 'default_tenant',
      createdAt: '2024-03-15T10:00:00Z',
      updatedAt: '2024-03-15T10:00:00Z'
    },
    {
      id: 'cat-005',
      name: '甜點',
      displayName: '甜點',
      description: '美味甜點選擇',
      displayOrder: 5,
      type: 'dessert' as MenuCategoryType,
      imageUrl: 'https://via.placeholder.com/150?text=Desserts',
      isActive: false, // 非活躍分類，用於測試isActive篩選
      tenantId: 'default_tenant',
      createdAt: '2024-03-15T10:30:00Z',
      updatedAt: '2024-03-15T10:30:00Z'
    }
  ],
  pagination: {
    total: 5,
    currentPage: 1,
    totalPages: 1
  }
};

// 菜單項目模擬數據
export const mockMenuItemsData = {
  data: [
    {
      id: 'item-001',
      categoryId: 'cat-001',
      categoryName: '炸雞系列',
      name: '椒鹽雞排',
      description: '採用新鮮雞胸肉，以獨家香料醃製，酥脆多汁',
      price: 80,
      discountPrice: 75,
      imageUrl: 'https://via.placeholder.com/200?text=ChickenSteak',
      thumbnailUrl: 'https://via.placeholder.com/100?text=ChickenSteak',
      isActive: true,
      isFeatured: true,
      isRecommended: true,
      isSpecial: false,
      tenantId: 'default_tenant',
      stockStatus: 'in_stock' as MenuItemStockStatus,
      allergens: ['gluten'],
      tags: ['spicy', 'popular'],
      createdAt: '2024-03-16T10:00:00Z',
      updatedAt: '2024-03-16T10:00:00Z'
    },
    {
      id: 'item-002',
      categoryId: 'cat-001',
      categoryName: '炸雞系列',
      name: '香酥雞腿',
      description: '精選雞腿肉，外酥內嫩，香氣四溢',
      price: 90,
      discountPrice: undefined,
      imageUrl: 'https://via.placeholder.com/200?text=ChickenLeg',
      thumbnailUrl: 'https://via.placeholder.com/100?text=ChickenLeg',
      isActive: true,
      isFeatured: false,
      isRecommended: false,
      isSpecial: true,
      tenantId: 'default_tenant',
      stockStatus: 'in_stock' as MenuItemStockStatus,
      allergens: ['gluten'],
      tags: ['best_seller'],
      createdAt: '2024-03-16T10:30:00Z',
      updatedAt: '2024-03-16T10:30:00Z'
    },
    {
      id: 'item-003',
      categoryId: 'cat-002',
      categoryName: '配餐',
      name: '薯條',
      description: '採用優質馬鈴薯，酥脆可口',
      price: 35,
      discountPrice: undefined,
      imageUrl: 'https://via.placeholder.com/200?text=Fries',
      thumbnailUrl: 'https://via.placeholder.com/100?text=Fries',
      isActive: true,
      isFeatured: false,
      isRecommended: false,
      isSpecial: false,
      tenantId: 'default_tenant',
      stockStatus: 'in_stock' as MenuItemStockStatus,
      allergens: ['gluten'],
      tags: ['vegetarian'],
      createdAt: '2024-03-16T11:00:00Z',
      updatedAt: '2024-03-16T11:00:00Z'
    },
    {
      id: 'item-004',
      categoryId: 'cat-003',
      categoryName: '飲料',
      name: '可樂',
      description: '清涼可口的汽水飲料',
      price: 25,
      discountPrice: undefined,
      imageUrl: 'https://via.placeholder.com/200?text=Cola',
      thumbnailUrl: 'https://via.placeholder.com/100?text=Cola',
      isActive: true,
      isFeatured: false,
      isRecommended: false,
      isSpecial: false,
      tenantId: 'default_tenant',
      stockStatus: 'in_stock' as MenuItemStockStatus,
      allergens: [],
      tags: ['drink'],
      createdAt: '2024-03-16T11:30:00Z',
      updatedAt: '2024-03-16T11:30:00Z'
    },
    {
      id: 'item-005',
      categoryId: 'cat-003',
      categoryName: '飲料',
      name: '檸檬茶',
      description: '新鮮檸檬與紅茶的完美結合',
      price: 30,
      discountPrice: undefined,
      imageUrl: 'https://via.placeholder.com/200?text=LemonTea',
      thumbnailUrl: 'https://via.placeholder.com/100?text=LemonTea',
      isActive: true,
      isFeatured: true,
      isRecommended: true,
      isSpecial: false,
      tenantId: 'default_tenant',
      stockStatus: 'in_stock' as MenuItemStockStatus,
      allergens: [],
      tags: ['drink', 'fresh'],
      createdAt: '2024-03-16T12:00:00Z',
      updatedAt: '2024-03-16T12:00:00Z'
    },
    {
      id: 'item-006',
      categoryId: 'cat-004',
      categoryName: '套餐',
      name: '雞排套餐',
      description: '椒鹽雞排配薯條和可樂',
      price: 130,
      discountPrice: 120,
      imageUrl: 'https://via.placeholder.com/200?text=ChickenCombo',
      thumbnailUrl: 'https://via.placeholder.com/100?text=ChickenCombo',
      isActive: true,
      isFeatured: true,
      isRecommended: true,
      isSpecial: true,
      tenantId: 'default_tenant',
      stockStatus: 'in_stock' as MenuItemStockStatus,
      allergens: ['gluten'],
      tags: ['combo', 'popular'],
      createdAt: '2024-03-16T13:00:00Z',
      updatedAt: '2024-03-16T13:00:00Z'
    },
    {
      id: 'item-007',
      categoryId: 'cat-001',
      categoryName: '炸雞系列',
      name: '炸雞翅',
      description: '特製醬料醃製，香脆可口',
      price: 75,
      discountPrice: undefined,
      imageUrl: 'https://via.placeholder.com/200?text=ChickenWings',
      thumbnailUrl: 'https://via.placeholder.com/100?text=ChickenWings',
      isActive: false, // 非活躍菜單項目，用於測試isActive篩選
      isFeatured: false,
      isRecommended: false,
      isSpecial: false,
      tenantId: 'default_tenant',
      stockStatus: 'out_of_stock' as MenuItemStockStatus, // 售罄狀態測試
      allergens: ['gluten'],
      tags: ['wings'],
      createdAt: '2024-03-16T14:00:00Z',
      updatedAt: '2024-03-16T14:00:00Z'
    }
  ],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 7
  }
};

/**
 * 獲取菜單分類列表的模擬數據
 * 支持根據isActive參數篩選
 */
export const getMockMenuCategories = (params: Record<string, unknown> = {}) => {
  // 複製一份數據以避免修改原始數據
  const result = { ...mockMenuCategoriesData };
  
  // 根據isActive參數篩選
  if (params.isActive !== undefined) {
    const isActive = params.isActive === 'true' || params.isActive === true;
    result.data = mockMenuCategoriesData.data.filter(category => category.isActive === isActive);
    result.pagination.total = result.data.length;
  }
  
  return result;
};

/**
 * 獲取菜單項目列表的模擬數據
 * 支持根據categoryId和isActive參數篩選，以及分頁功能
 */
export const getMockMenuItems = (params: Record<string, unknown> = {}) => {
  // 篩選菜單項目
  let filteredItems = [...mockMenuItemsData.data];
  
  // 根據分類ID篩選
  if (params.categoryId) {
    filteredItems = filteredItems.filter(item => item.categoryId === params.categoryId);
  }
  
  // 根據激活狀態篩選
  if (params.isActive !== undefined) {
    const isActive = params.isActive === 'true' || params.isActive === true;
    filteredItems = filteredItems.filter(item => item.isActive === isActive);
  }
  
  // 處理分頁
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  const limit = typeof params.limit === 'string' ? parseInt(params.limit, 10) : 10;
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalItems);
  
  // 返回分頁後的數據
  return {
    data: filteredItems.slice(startIndex, endIndex),
    pagination: {
      currentPage: page,
      totalPages,
      totalItems
    }
  };
};

/**
 * 獲取指定ID的菜單項目
 */
export const getMockMenuItemById = (id: string): MenuItem | null => {
  return mockMenuItemsData.data.find(item => item.id === id) || null;
};

/**
 * 獲取指定ID的菜單分類
 */
export const getMockMenuCategoryById = (id: string): MenuCategory | null => {
  return mockMenuCategoriesData.data.find(category => category.id === id) || null;
}; 