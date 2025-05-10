// 在任何其他導入前，我們先 mock firebase-admin
const mockMenu = require('./menu.mock');
const sinon = require('sinon');
const { expect } = require('chai');
const { v4: uuidv4 } = require('uuid');

// 使用 proxyquire 來替換 menu.handlers.js 中的 firebase-admin 引用
const proxyquire = require('proxyquire').noCallThru();
const menuHandlersPath = '../src/menus/menu.handlers';
const menuCategoryHandlersPath = '../src/menus/menuCategory.handlers';
const menuItemHandlersPath = '../src/menus/menuItem.handlers';

// 模擬 uuid 函數，使其返回固定值
const uuidStub = sinon.stub();
uuidStub.returns('test-uuid-123');

const menuHandlers = proxyquire(menuHandlersPath, {
  'firebase-admin': mockMenu.admin,
  'uuid': { v4: uuidStub }
});

const menuCategoryHandlers = proxyquire(menuCategoryHandlersPath, {
  'firebase-admin': mockMenu.admin,
  'uuid': { v4: uuidStub }
});

const menuItemHandlers = proxyquire(menuItemHandlersPath, {
  'firebase-admin': mockMenu.admin,
  'uuid': { v4: uuidStub }
});

describe('Menu Handlers - getMenuForStore', function() {
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    mockMenu.reset();
    
    req = {
      params: {
        storeId: 'test-store-123'
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置模擬數據
    const categories = [
      { id: 'cat-1', name: '主食', displayOrder: 1, isActive: true, storeId: 'test-store-123' },
      { id: 'cat-2', name: '飲料', displayOrder: 2, isActive: true, storeId: 'test-store-123' }
    ];
    
    const items = [
      { id: 'item-1', name: '雞排', categoryId: 'cat-1', price: 100, isActive: true, displayOrder: 1 },
      { id: 'item-2', name: '可樂', categoryId: 'cat-2', price: 40, isActive: true, displayOrder: 1 }
    ];
    
    const options = [
      { id: 'option-1', name: '加辣', itemId: 'item-1', price: 5, isActive: true },
      { id: 'option-2', name: '去冰', itemId: 'item-2', price: 0, isActive: true }
    ];

    // 模擬分類查詢結果
    const categoryDocsArray = categories.map(cat => ({
      id: cat.id,
      data: () => cat,
      ref: { id: cat.id }
    }));
    
    const categoryQuerySnapshot = {
      empty: false,
      docs: categoryDocsArray,
      forEach: (callback) => categoryDocsArray.forEach(callback)
    };
    
    // 模擬菜品查詢結果
    const itemDocsArray = items.map(item => ({
      id: item.id,
      data: () => item,
      ref: { id: item.id }
    }));
    
    const itemQuerySnapshot = {
      empty: false,
      docs: itemDocsArray,
      forEach: (callback) => itemDocsArray.forEach(callback)
    };
    
    // 模擬選項查詢結果
    const optionDocsArray = options.map(option => ({
      id: option.id,
      data: () => option,
      ref: { id: option.id }
    }));
    
    const optionQuerySnapshot = {
      empty: false,
      docs: optionDocsArray,
      forEach: (callback) => optionDocsArray.forEach(callback)
    };

    // 設置 where 調用的返回值
    const whereStub = sinon.stub();
    whereStub.withArgs('storeId', '==', 'test-store-123').returns({
      where: sinon.stub().withArgs('isActive', '==', true).returns({
        orderBy: sinon.stub().returns({
          get: sinon.stub().resolves(categoryQuerySnapshot)
        })
      })
    });
    
    whereStub.withArgs('categoryId', 'in', sinon.match.array).returns({
      where: sinon.stub().withArgs('isActive', '==', true).returns({
        orderBy: sinon.stub().returns({
          get: sinon.stub().resolves(itemQuerySnapshot)
        })
      })
    });
    
    whereStub.withArgs('itemId', 'in', sinon.match.array).returns({
      where: sinon.stub().withArgs('isActive', '==', true).returns({
        get: sinon.stub().resolves(optionQuerySnapshot)
      })
    });

    // 設置 collection 調用的返回值
    mockMenu.firestoreMock.collection.withArgs('menuCategories').returns({
      where: whereStub
    });
    
    mockMenu.firestoreMock.collection.withArgs('menuItems').returns({
      where: whereStub
    });
    
    mockMenu.firestoreMock.collection.withArgs('menuOptions').returns({
      where: whereStub
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return menu structure with categories, items and options', async () => {
    await menuHandlers.getMenuForStore(req, res);
    
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.have.property('menu');
    expect(responseData.menu).to.be.an('array');
    expect(responseData.menu.length).to.be.at.least(2);
    
    // 檢查第一個分類的結構
    const firstCategory = responseData.menu[0];
    expect(firstCategory).to.have.property('id', 'cat-1');
    expect(firstCategory).to.have.property('name', '主食');
    expect(firstCategory).to.have.property('items').that.is.an('array');
    
    // 檢查第一個分類的第一個菜品
    const firstItem = firstCategory.items[0];
    expect(firstItem).to.have.property('id', 'item-1');
    expect(firstItem).to.have.property('name', '雞排');
    expect(firstItem).to.have.property('options').that.is.an('array');
    
    // 檢查選項
    const firstOption = firstItem.options[0];
    expect(firstOption).to.have.property('id', 'option-1');
    expect(firstOption).to.have.property('name', '加辣');
  });

  it('should return 400 when storeId is missing', async () => {
    req.params.storeId = null;
    
    await menuHandlers.getMenuForStore(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0]).to.have.property('message').that.includes('Missing storeId');
  });

  it('should return empty menu when no categories found', async () => {
    // 模擬沒有找到分類的情況
    mockMenu.firestoreMock.collection.withArgs('menuCategories').returns({
      where: sinon.stub().returns({
        where: sinon.stub().returns({
          orderBy: sinon.stub().returns({
            get: sinon.stub().resolves({ empty: true, docs: [] })
          })
        })
      })
    });
    
    await menuHandlers.getMenuForStore(req, res);
    
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.have.property('menu');
    expect(responseData.menu).to.have.property('categories').that.is.an('array').with.lengthOf(0);
  });

  it('should handle database error gracefully', async () => {
    // 模擬數據庫錯誤
    mockMenu.firestoreMock.collection.withArgs('menuCategories').returns({
      where: sinon.stub().returns({
        where: sinon.stub().returns({
          orderBy: sinon.stub().returns({
            get: sinon.stub().rejects(new Error('Database connection error'))
          })
        })
      })
    });
    
    await menuHandlers.getMenuForStore(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0]).to.have.property('message').that.includes('Failed to fetch menu');
    expect(res.send.firstCall.args[0]).to.have.property('error').that.includes('Database connection error');
  });
});

describe('Menu Category Handlers - createMenuCategory', function() {
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    mockMenu.reset();
    
    req = {
      body: {
        name: '主食',
        description: '主餐類別',
        displayOrder: 1,
        type: 'main_dish',
        isActive: true
      },
      user: {
        uid: 'test-user-123',
        tenantId: 'test-tenant-123'
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };

    // 模擬成功創建文檔
    mockMenu.firestoreMock.collection.withArgs('menuCategories').returns({
      doc: sinon.stub().returns({
        set: sinon.stub().resolves()
      })
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should create a new menu category and return 201 status', async () => {
    await menuCategoryHandlers.createMenuCategory(req, res);
    
    expect(res.status.calledWith(201)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    
    const responseData = res.json.firstCall.args[0];
    expect(responseData).to.have.property('success', true);
    expect(responseData).to.have.property('message').that.includes('創建成功');
    expect(responseData).to.have.property('data');
    expect(responseData.data).to.have.property('name', '主食');
    expect(responseData.data).to.have.property('tenantId', 'test-tenant-123');
    expect(responseData.data).to.have.property('id', 'test-uuid-123');
  });

  it('should return 403 when user has no tenantId', async () => {
    req.user.tenantId = null;
    
    await menuCategoryHandlers.createMenuCategory(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('success', false);
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('沒有權限');
  });

  it('should return 400 when validation fails', async () => {
    req.body = { name: '' }; // 空名稱，不符合驗證
    
    await menuCategoryHandlers.createMenuCategory(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('success', false);
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('驗證失敗');
  });

  it('should handle database error gracefully', async () => {
    // 模擬數據庫錯誤
    mockMenu.firestoreMock.collection.withArgs('menuCategories').returns({
      doc: sinon.stub().returns({
        set: sinon.stub().rejects(new Error('Database write error'))
      })
    });
    
    await menuCategoryHandlers.createMenuCategory(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('success', false);
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('伺服器內部錯誤');
    expect(res.json.firstCall.args[0]).to.have.property('error').that.includes('Database write error');
  });
});

describe('Menu Item Handlers - createMenuItem', function() {
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    mockMenu.reset();
    
    req = {
      body: {
        name: '雞排',
        description: '酥脆雞排',
        categoryId: 'test-category-123',
        price: 100,
        stockStatus: 'in_stock',
        isActive: true
      },
      user: {
        uid: 'test-user-123',
        tenantId: 'test-tenant-123',
        storeId: 'test-store-123'
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub()
    };

    // 模擬菜單分類查詢
    const categoryDoc = {
      exists: true,
      id: 'test-category-123',
      data: sinon.stub().returns({
        tenantId: 'test-tenant-123',
        name: '主食'
      })
    };
    
    mockMenu.firestoreMock.collection.withArgs('menuCategories').returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves(categoryDoc)
      })
    });

    // 模擬菜單項目創建和查詢
    const createdItemDoc = {
      exists: true,
      id: 'test-uuid-123',
      data: sinon.stub().returns({
        id: 'test-uuid-123',
        name: '雞排',
        categoryId: 'test-category-123',
        price: 100,
        tenantId: 'test-tenant-123',
        categoryName: '主食',
        createdAt: {
          toDate: () => new Date()
        },
        updatedAt: {
          toDate: () => new Date()
        }
      })
    };
    
    mockMenu.firestoreMock.collection.withArgs('menuItems').returns({
      doc: sinon.stub().withArgs('test-uuid-123').returns({
        set: sinon.stub().resolves(),
        get: sinon.stub().resolves(createdItemDoc)
      })
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should create a new menu item and return 201 status', async () => {
    await menuItemHandlers.createMenuItem(req, res);
    
    expect(res.status.calledWith(201)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    
    const responseData = res.json.firstCall.args[0];
    expect(responseData).to.have.property('success', true);
    expect(responseData).to.have.property('message').that.includes('菜單項目創建成功');
    expect(responseData).to.have.property('data');
    expect(responseData.data).to.have.property('name', '雞排');
    expect(responseData.data).to.have.property('tenantId', 'test-tenant-123');
    expect(responseData.data).to.have.property('id', 'test-uuid-123');
    expect(responseData.data).to.have.property('categoryName', '主食');
  });

  it('should return 403 when user has no tenantId', async () => {
    req.user.tenantId = null;
    
    await menuItemHandlers.createMenuItem(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('success', false);
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('沒有權限');
  });

  it('should return 400 when validation fails', async () => {
    req.body = { name: '', price: -10 }; // 無效數據
    
    await menuItemHandlers.createMenuItem(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('success', false);
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('驗證失敗');
  });

  it('should return 404 when category does not exist', async () => {
    // 模擬分類不存在
    mockMenu.firestoreMock.collection.withArgs('menuCategories').returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: false
        })
      })
    });
    
    await menuItemHandlers.createMenuItem(req, res);
    
    expect(res.status.calledWith(404)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('success', false);
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('不存在');
  });

  it('should return 403 when category belongs to different tenant', async () => {
    // 模擬分類屬於不同租戶
    const categoryDoc = {
      exists: true,
      data: sinon.stub().returns({
        tenantId: 'different-tenant-id',
        name: '主食'
      })
    };
    
    mockMenu.firestoreMock.collection.withArgs('menuCategories').returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves(categoryDoc)
      })
    });
    
    await menuItemHandlers.createMenuItem(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('success', false);
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('無法訪問其他租戶的菜單分類');
  });

  it('should handle database error gracefully', async () => {
    // 模擬數據庫寫入錯誤
    mockMenu.firestoreMock.collection.withArgs('menuItems').returns({
      doc: sinon.stub().returns({
        set: sinon.stub().rejects(new Error('Database write error'))
      })
    });
    
    await menuItemHandlers.createMenuItem(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    expect(res.json.firstCall.args[0]).to.have.property('success', false);
    expect(res.json.firstCall.args[0]).to.have.property('message').that.includes('伺服器內部錯誤');
  });
}); 