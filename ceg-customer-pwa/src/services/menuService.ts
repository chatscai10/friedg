import { MenuCategory, MenuItem } from '../types/menu.types';

const mockCategories: MenuCategory[] = [
  { id: 'cat1', name: '人氣雞排', tenantId: 'tenant1', description: '本店招牌，外酥內嫩' },
  { id: 'cat2', name: '炸物點心', tenantId: 'tenant1', description: '多種選擇，滿足味蕾' },
  { id: 'cat3', name: '清涼飲品', tenantId: 'tenant1', description: '解渴消暑，最佳搭配' },
];

const mockMenuItems: MenuItem[] = [
  // 人氣雞排
  { 
    id: 'item1', categoryId: 'cat1', name: '經典原味雞排', description: '傳統美味，百吃不厭', price: 70, 
    imageUrl: 'https://via.placeholder.com/150/FFC107/000000?Text=OriginalChicken', 
    stockStatus: 'in_stock', tenantId: 'tenant1', isRecommended: true, isActive: true, categoryName: '人氣雞排'
  },
  { 
    id: 'item2', categoryId: 'cat1', name: '香辣紅椒雞排', description: '特製辣粉，挑戰味蕾', price: 75, 
    imageUrl: 'https://via.placeholder.com/150/F44336/FFFFFF?Text=SpicyChicken', 
    stockStatus: 'in_stock', tenantId: 'tenant1', isActive: true, categoryName: '人氣雞排',
    optionGroups: [
      {
        id: 'og1_spice', name: '辣度選擇', type: 'single', isRequired: true,
        options: [
          { name: '不辣', value: 'none', priceAdjustment: 0, isDefault: false },
          { name: '小辣', value: 'mild', priceAdjustment: 0, isDefault: true },
          { name: '中辣', value: 'medium', priceAdjustment: 5 }, // 中辣加5元
          { name: '大辣', value: 'hot', priceAdjustment: 5 },    // 大辣加5元
        ]
      },
      {
        id: 'og2_garnish', name: '額外加料 (可複選)', type: 'multiple', isRequired: false,
        options: [
          { name: '加起司', value: 'cheese', priceAdjustment: 15 },
          { name: '加泡菜', value: 'kimchi', priceAdjustment: 10 },
        ]
      }
    ]
  },
  { 
    id: 'item3', categoryId: 'cat1', name: '濃郁起司雞排', description: '牽絲起司，無法抗拒', price: 85, 
    imageUrl: 'https://via.placeholder.com/150/FFEB3B/000000?Text=CheeseChicken', 
    stockStatus: 'low_stock', tenantId: 'tenant1', isSpecial: true, isActive: true, categoryName: '人氣雞排'
  },
  // 炸物點心
  { 
    id: 'item4', categoryId: 'cat2', name: '酥脆薯條', description: '金黃酥脆，點心首選', price: 35, 
    imageUrl: 'https://via.placeholder.com/150/9C27B0/FFFFFF?Text=Fries', 
    stockStatus: 'in_stock', tenantId: 'tenant1', isActive: true, categoryName: '炸物點心'
  },
  { 
    id: 'item5', categoryId: 'cat2', name: '甜不辣', description: '台灣道地，Q彈可口', price: 30, 
    imageUrl: 'https://via.placeholder.com/150/009688/FFFFFF?Text=Tempura', 
    stockStatus: 'in_stock', tenantId: 'tenant1', isActive: true, categoryName: '炸物點心'
  },
  // 清涼飲品
  { 
    id: 'item6', categoryId: 'cat3', name: '珍珠奶茶', description: '經典台式，濃郁茶香', price: 50, 
    imageUrl: 'https://via.placeholder.com/150/3F51B5/FFFFFF?Text=BubbleTea', 
    stockStatus: 'out_of_stock', tenantId: 'tenant1', isActive: true, categoryName: '清涼飲品'
  },
  { 
    id: 'item7', categoryId: 'cat3', name: '檸檬紅茶', description: '酸甜清爽，消暑解渴', price: 40, 
    imageUrl: 'https://via.placeholder.com/150/CDDC39/000000?Text=LemonTea', 
    stockStatus: 'in_stock', tenantId: 'tenant1', isActive: true, categoryName: '清涼飲品'
  },
];

export const getMockMenuCategories = async (): Promise<MenuCategory[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockCategories);
    }, 500); // Simulate network delay
  });
};

export const getMockMenuItems = async (categoryId?: string): Promise<MenuItem[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (categoryId) {
        resolve(mockMenuItems.filter(item => item.categoryId === categoryId && item.isActive));
      } else {
        resolve(mockMenuItems.filter(item => item.isActive));
      }
    }, 500); // Simulate network delay
  });
}; 