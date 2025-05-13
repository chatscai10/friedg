import { AxiosRequestConfig } from 'axios';
import { MenuCategory, MenuItem } from '../../types/menuItem';

// 模擬菜單分類數據
const categories: MenuCategory[] = [
  {
    id: 'cat-001',
    name: '炸雞系列',
    displayName: '炸雞系列',
    description: '各種現炸酥脆雞肉料理',
    displayOrder: 1,
    imageUrl: 'https://via.placeholder.com/150?text=Chicken',
    isActive: true,
    tenantId: 'default_tenant',
    createdAt: new Date('2024-03-15T09:00:00Z'),
    updatedAt: new Date('2024-03-15T09:00:00Z')
  },
  {
    id: 'cat-002',
    name: '配餐',
    displayName: '配餐',
    description: '各種美味配餐選擇',
    displayOrder: 2,
    imageUrl: 'https://via.placeholder.com/150?text=Sides',
    isActive: true,
    tenantId: 'default_tenant',
    createdAt: new Date('2024-03-15T09:15:00Z'),
    updatedAt: new Date('2024-03-15T09:15:00Z')
  },
  {
    id: 'cat-003',
    name: '飲料',
    displayName: '飲料',
    description: '清涼飲品選擇',
    displayOrder: 3,
    imageUrl: 'https://via.placeholder.com/150?text=Drinks',
    isActive: true,
    tenantId: 'default_tenant',
    createdAt: new Date('2024-03-15T09:30:00Z'),
    updatedAt: new Date('2024-03-15T09:30:00Z')
  }
];

// 模擬菜單項目數據
const items: MenuItem[] = [
  {
    id: 'item-001',
    categoryId: 'cat-001',
    name: '椒鹽雞排',
    description: '採用新鮮雞胸肉，以獨家香料醃製，酥脆多汁',
    price: 80,
    discountPrice: null,
    imageUrl: 'https://via.placeholder.com/200?text=ChickenSteak',
    thumbnailUrl: 'https://via.placeholder.com/100?text=ChickenSteak',
    isActive: true,
    isFeatured: true,
    tenantId: 'default_tenant',
    stockStatus: 'in_stock',
    allergens: ['gluten'],
    tags: ['spicy', 'popular'],
    createdAt: new Date('2024-03-16T10:00:00Z'),
    updatedAt: new Date('2024-03-16T10:00:00Z')
  },
  {
    id: 'item-002',
    categoryId: 'cat-001',
    name: '香酥雞腿',
    description: '精選雞腿肉，外酥內嫩，香氣四溢',
    price: 90,
    discountPrice: null,
    imageUrl: 'https://via.placeholder.com/200?text=ChickenLeg',
    thumbnailUrl: 'https://via.placeholder.com/100?text=ChickenLeg',
    isActive: true,
    isFeatured: false,
    tenantId: 'default_tenant',
    stockStatus: 'in_stock',
    allergens: ['gluten'],
    tags: ['best_seller'],
    createdAt: new Date('2024-03-16T10:30:00Z'),
    updatedAt: new Date('2024-03-16T10:30:00Z')
  },
  {
    id: 'item-003',
    categoryId: 'cat-002',
    name: '薯條',
    description: '採用優質馬鈴薯，酥脆可口',
    price: 35,
    discountPrice: null,
    imageUrl: 'https://via.placeholder.com/200?text=Fries',
    thumbnailUrl: 'https://via.placeholder.com/100?text=Fries',
    isActive: true,
    isFeatured: false,
    tenantId: 'default_tenant',
    stockStatus: 'in_stock',
    allergens: ['gluten'],
    tags: ['vegetarian'],
    createdAt: new Date('2024-03-16T11:00:00Z'),
    updatedAt: new Date('2024-03-16T11:00:00Z')
  },
  {
    id: 'item-004',
    categoryId: 'cat-003',
    name: '可樂',
    description: '清涼可口的汽水飲料',
    price: 25,
    discountPrice: null,
    imageUrl: 'https://via.placeholder.com/200?text=Cola',
    thumbnailUrl: 'https://via.placeholder.com/100?text=Cola',
    isActive: true,
    isFeatured: false,
    tenantId: 'default_tenant',
    stockStatus: 'in_stock',
    allergens: [],
    tags: ['drink'],
    createdAt: new Date('2024-03-16T11:30:00Z'),
    updatedAt: new Date('2024-03-16T11:30:00Z')
  }
];

// 處理請求參數的通用函數
const parseParams = (config: AxiosRequestConfig) => {
  const params = config.params || {};
  const url = config.url || '';
  
  // 從URL提取ID (如果存在)
  let id = '';
  const idMatch = url.match(/\/([^/]+)$/);
  if (idMatch) {
    id = idMatch[1];
  }
  
  return { params, id };
};

// 模擬菜單數據處理函數
export const mockMenuData = {
  // 獲取所有菜單分類
  getCategories: (config: AxiosRequestConfig) => {
    const { params } = parseParams(config);
    let result = [...categories];
    
    // 處理篩選條件
    if (params.isActive !== undefined) {
      result = result.filter(cat => cat.isActive === params.isActive);
    }
    
    // 處理分頁
    return {
      data: result,
      pagination: {
        total: result.length
      }
    };
  },
  
  // 根據ID獲取特定菜單分類
  getCategoryById: (config: AxiosRequestConfig) => {
    const { id } = parseParams(config);
    const category = categories.find(cat => cat.id === id);
    
    if (!category) {
      throw {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: `菜單分類不存在: ${id}` }
        }
      };
    }
    
    return category;
  },
  
  // 獲取所有菜單項目
  getItems: (config: AxiosRequestConfig) => {
    const { params } = parseParams(config);
    let result = [...items];
    
    // 處理篩選條件
    if (params.categoryId) {
      result = result.filter(item => item.categoryId === params.categoryId);
    }
    
    if (params.isActive !== undefined) {
      result = result.filter(item => item.isActive === params.isActive);
    }
    
    // 處理分頁
    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '10');
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = result.slice(startIndex, endIndex);
    
    return {
      data: paginatedItems,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(result.length / limit),
        totalItems: result.length
      }
    };
  },
  
  // 根據ID獲取特定菜單項目
  getItemById: (config: AxiosRequestConfig) => {
    const { id } = parseParams(config);
    const item = items.find(item => item.id === id);
    
    if (!item) {
      throw {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: { message: `菜單項目不存在: ${id}` }
        }
      };
    }
    
    return item;
  }
}; 