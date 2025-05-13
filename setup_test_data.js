const admin = require('firebase-admin');

// 初始化 Firebase Admin SDK
admin.initializeApp({
  projectId: 'demo-admin'
});

const db = admin.firestore();

// 菜單分類測試數據
const menuCategories = [
  { name: '熱門飲品', status: 'active', displayOrder: 1 },
  { name: '季節限定', status: 'active', displayOrder: 2 },
  { name: '經典咖啡', status: 'active', displayOrder: 3 },
  { name: '輕食點心', status: 'inactive', displayOrder: 4 }
];

// 優惠券模板測試數據
const couponTemplates = [
  { name: '新會員優惠', discount: 100, type: 'fixed', status: 'active' },
  { name: '週年慶特惠', discount: 20, type: 'percentage', status: 'active' }
];

// 會員等級測試數據
const loyaltyTiers = [
  { name: '一般會員', threshold: 0, benefits: ['免費生日飲品'] },
  { name: '銀卡會員', threshold: 5000, benefits: ['免費生日飲品', '消費9折'] },
  { name: '金卡會員', threshold: 15000, benefits: ['免費生日飲品', '消費8折', '專屬活動'] }
];

// 新增測試數據
async function setupTestData() {
  try {
    // 新增菜單分類
    for (const category of menuCategories) {
      await db.collection('menuCategories').add(category);
      console.log(`新增菜單分類: ${category.name}`);
    }

    // 新增優惠券模板
    for (const template of couponTemplates) {
      await db.collection('couponTemplates').add(template);
      console.log(`新增優惠券模板: ${template.name}`);
    }

    // 新增會員等級
    for (const tier of loyaltyTiers) {
      await db.collection('loyaltyTiers').add(tier);
      console.log(`新增會員等級: ${tier.name}`);
    }

    console.log('測試數據設置完成！');
  } catch (error) {
    console.error('設置測試數據時發生錯誤:', error);
  }
}

setupTestData(); 