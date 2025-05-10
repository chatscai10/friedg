// 在任何其他導入前，先 mock firebase-admin
const mockOrders = require("./orders.mock");
const sinon = require("sinon");
const { expect } = require("chai");
const { v4: uuidv4 } = require("uuid");

// 使用 proxyquire 來替換 orders.handlers.js 中的 firebase-admin 引用
const proxyquire = require("proxyquire").noCallThru();
const ordersHandlersPath = "../src/orders/orders.handlers";

// 模擬 uuid 函數，使其返回固定值
const uuidStub = sinon.stub();
uuidStub.returns("test-uuid-123");

const ordersHandlers = proxyquire(ordersHandlersPath, {
  "firebase-admin": mockOrders.admin,
  "uuid": { v4: uuidStub }
});

describe("Order Handlers - getOrders", function() {
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    mockOrders.reset();
    
    req = {
      query: {
        storeId: "test-store-123",
        page: 1,
        limit: 10
      },
      user: {
        uid: "test-user-123",
        role: "StoreManager",
        storeId: "test-store-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置模擬訂單數據
    const orders = [
      { 
        id: "order-1", 
        orderNumber: "ST220501001", 
        storeId: "test-store-123", 
        tenantId: "test-tenant-123",
        status: "pending", 
        totalAmount: 150,
        createdAt: new Date("2022-05-01")
      },
      { 
        id: "order-2", 
        orderNumber: "ST220502001", 
        storeId: "test-store-123", 
        tenantId: "test-tenant-123",
        status: "completed", 
        totalAmount: 250,
        createdAt: new Date("2022-05-02")
      }
    ];
    
    // 模擬訂單查詢結果
    const orderDocsArray = orders.map(order => ({
      id: order.id,
      data: () => order,
      ref: { id: order.id }
    }));
    
    const orderQuerySnapshot = {
      empty: false,
      docs: orderDocsArray,
      forEach: (callback) => orderDocsArray.forEach(callback)
    };
    
    // 模擬 count 結果
    const countSnapshotMock = {
      data: () => ({ count: 2 })
    };

    // 設置 collection 調用的返回值
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      where: sinon.stub().returns({
        where: sinon.stub().returns({
          get: sinon.stub().resolves({
            size: 2,
            docs: orderDocsArray,
            empty: false
          }),
          orderBy: sinon.stub().returns({
            limit: sinon.stub().returns({
              offset: sinon.stub().returns({
                get: sinon.stub().resolves({
                  size: 2,
                  docs: orderDocsArray,
                  empty: false
                })
              })
            })
          })
        })
      })
    });
    
    // 模擬店鋪查詢結果
    const storeDoc = {
      exists: true,
      data: () => ({ 
        id: "test-store-123", 
        name: "Test Store", 
        tenantId: "test-tenant-123" 
      })
    };
    
    mockOrders.firestoreMock.collection.withArgs("stores").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves(storeDoc)
      })
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should return orders list with pagination for StoreManager", async () => {
    await ordersHandlers.getOrders(req, res);
    
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.have.property("orders");
    expect(responseData.orders).to.be.an("array");
    if (responseData.pagination) {
      expect(responseData.pagination).to.be.an("object");
    }
  });

  it("should return 400 when missing required query parameters", async () => {
    req.query = {}; // 清空查詢參數
    
    await ordersHandlers.getOrders(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Missing required query parameter");
  });

  it("should return 401 when user is not authenticated", async () => {
    req.user = null;
    
    await ordersHandlers.getOrders(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Unauthorized");
  });

  it("should return 403 when user doesn't have permission to access the store", async () => {
    // 用戶嘗試訪問不屬於他的店鋪
    req.query.storeId = "different-store-123";
    
    await ordersHandlers.getOrders(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Forbidden");
  });

  it("should return empty orders array when no orders found", async () => {
    // 模擬空的訂單結果
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      where: sinon.stub().returns({
        where: sinon.stub().returns({
          get: sinon.stub().resolves({
            size: 0,
            docs: [],
            empty: true
          }),
          orderBy: sinon.stub().returns({
            limit: sinon.stub().returns({
              offset: sinon.stub().returns({
                get: sinon.stub().resolves({
                  size: 0,
                  docs: [],
                  empty: true
                })
              })
            })
          })
        })
      })
    });
    
    await ordersHandlers.getOrders(req, res);
    
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.have.property("orders");
    expect(responseData.orders).to.be.an("array").that.is.empty;
  });

  it("should handle database error gracefully", async () => {
    // 模擬數據庫錯誤
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      where: sinon.stub().returns({
        where: sinon.stub().returns({
          get: sinon.stub().rejects(new Error("Database connection failed"))
        })
      })
    });
    
    await ordersHandlers.getOrders(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Failed to list orders");
  });
});

describe("Order Handlers - getOrderById", function() {
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    mockOrders.reset();
    
    req = {
      params: {
        orderId: "test-order-123"
      },
      user: {
        uid: "test-user-123",
        role: "StoreManager",
        storeId: "test-store-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置模擬訂單數據
    const orderDoc = {
      exists: true,
      id: "test-order-123",
      data: sinon.stub().returns({
        id: "test-order-123",
        orderNumber: "TS220501001",
        storeId: "test-store-123",
        tenantId: "test-tenant-123",
        status: "pending",
        totalAmount: 150,
        createdAt: {
          toDate: () => new Date("2022-05-01")
        }
      })
    };
    
    // 設置 collection 調用的返回值
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves(orderDoc)
      })
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should return order details when found", async () => {
    await ordersHandlers.getOrderById(req, res);
    
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.have.property("id", "test-order-123");
    expect(responseData).to.have.property("orderNumber", "TS220501001");
    expect(responseData).to.have.property("status", "pending");
  });

  it("should return 404 when order not found", async () => {
    // 模擬訂單不存在
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: false
        })
      })
    });
    
    await ordersHandlers.getOrderById(req, res);
    
    expect(res.status.calledWith(404)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("not found");
  });

  it("should return 401 when user is not authenticated", async () => {
    req.user = null;
    
    await ordersHandlers.getOrderById(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Unauthorized");
  });

  it("should return 403 when user doesn't have permission to access the order", async () => {
    // 模擬訂單屬於不同的店鋪
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: true,
          id: "test-order-123",
          data: sinon.stub().returns({
            storeId: "different-store-123",
            tenantId: "test-tenant-123"
          })
        })
      })
    });
    
    await ordersHandlers.getOrderById(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Forbidden");
  });

  it("should handle database error gracefully", async () => {
    // 模擬數據庫錯誤
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().rejects(new Error("Failed to fetch order"))
      })
    });
    
    await ordersHandlers.getOrderById(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Failed to fetch order");
  });
});

describe("Order Handlers - createOrder", function() {
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    mockOrders.reset();
    
    req = {
      body: {
        storeId: "test-store-123",
        items: [
          {
            menuItemId: "item-1",
            quantity: 2,
            unitPrice: 50,
            specialInstructions: "不要辣"
          }
        ],
        deliveryInfo: {
          address: "Test Address"
        },
        paymentMethod: "cash",
        notes: "測試備註"
      },
      user: {
        uid: "test-user-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 模擬店鋪文檔
    const storeDoc = {
      exists: true,
      data: sinon.stub().returns({
        id: "test-store-123",
        name: "Test Store",
        tenantId: "test-tenant-123"
      })
    };
    
    // 模擬菜單項文檔
    const menuItemDoc = {
      exists: true,
      data: sinon.stub().returns({
        id: "item-1",
        name: "Test Item",
        price: 50,
        categoryId: "category-1",
        trackInventory: false
      }),
      ref: {
        id: "item-1",
        update: sinon.stub().resolves()
      }
    };
    
    // 設置 collection 調用的返回值
    mockOrders.firestoreMock.collection.withArgs("stores").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves(storeDoc)
      })
    });
    
    mockOrders.firestoreMock.collection.withArgs("menuItems").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves(menuItemDoc)
      })
    });
    
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        set: sinon.stub().resolves()
      })
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should create a new order and return 201 status", async () => {
    await ordersHandlers.createOrder(req, res);
    
    expect(res.status.calledWith(201)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.be.an("object");
    if (responseData.order) {
      expect(responseData.order).to.be.an("object");
    }
  });

  it("should return 400 when required fields are missing", async () => {
    req.body = {}; // 清空請求體
    
    await ordersHandlers.createOrder(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Missing or invalid required fields");
  });

  it("should return 401 when user is not authenticated", async () => {
    req.user = null;
    
    await ordersHandlers.createOrder(req, res);
    
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Unauthorized");
  });

  it("should return 400 when store doesn't exist", async () => {
    // 模擬店鋪不存在
    mockOrders.firestoreMock.collection.withArgs("stores").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: false
        })
      })
    });
    
    await ordersHandlers.createOrder(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Invalid storeId");
  });

  it("should return 400 when menu item doesn't exist", async () => {
    // 模擬菜單項不存在
    mockOrders.firestoreMock.collection.withArgs("menuItems").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: false
        })
      })
    });
    
    await ordersHandlers.createOrder(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Invalid or unavailable menu item");
  });

  it("should return 400 when inventory is insufficient", async () => {
    // 模擬庫存不足
    mockOrders.firestoreMock.collection.withArgs("menuItems").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: true,
          data: sinon.stub().returns({
            trackInventory: true,
            inventoryCount: 1, // 只有1個庫存
            name: "Test Item"
          })
        })
      })
    });
    
    req.body.items[0].quantity = 2; // 請求2個
    
    await ordersHandlers.createOrder(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
  });

  it("should handle database error gracefully", async () => {
    // 模擬數據庫錯誤
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        set: sinon.stub().rejects(new Error("Failed to create order"))
      })
    });
    
    await ordersHandlers.createOrder(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
  });
});

describe("Order Handlers - updateOrderStatus", function() {
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    mockOrders.reset();
    
    req = {
      params: {
        orderId: "test-order-123"
      },
      body: {
        status: "preparing",
        reason: ""
      },
      user: {
        uid: "test-user-123",
        role: "StoreManager",
        storeId: "test-store-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置模擬訂單數據
    const orderDoc = {
      exists: true,
      id: "test-order-123",
      data: sinon.stub().returns({
        id: "test-order-123",
        orderNumber: "TS220501001",
        storeId: "test-store-123",
        tenantId: "test-tenant-123",
        status: "pending",
        totalAmount: 150,
        items: [{
          id: "item-1",
          name: "Test Item",
          quantity: 2
        }],
        createdAt: {
          toDate: () => new Date("2022-05-01")
        }
      }),
      ref: {
        update: sinon.stub().resolves()
      }
    };
    
    // 設置 collection 調用的返回值
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves(orderDoc),
        update: sinon.stub().resolves()
      })
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should update order status successfully", async () => {
    await ordersHandlers.updateOrderStatus(req, res);
    
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.be.an("object");
    expect(responseData).to.have.property("success", true);
    expect(responseData).to.have.property("message").that.includes("updated");
    expect(responseData).to.have.property("order");
    expect(responseData.order).to.have.property("status", "preparing");
  });

  it("should return 400 when status is missing", async () => {
    req.body = {}; // 清空請求體
    
    await ordersHandlers.updateOrderStatus(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Invalid status");
  });

  it("should return 400 when status is invalid", async () => {
    req.body.status = "invalid-status";
    
    await ordersHandlers.updateOrderStatus(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Invalid status");
  });

  it("should return 404 when order not found", async () => {
    // 模擬訂單不存在
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: false
        })
      })
    });
    
    await ordersHandlers.updateOrderStatus(req, res);
    
    expect(res.status.calledWith(404)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("not found");
  });

  it("should return 403 when user doesn't have permission to update the order", async () => {
    // 模擬訂單屬於不同的店鋪
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: true,
          data: sinon.stub().returns({
            storeId: "different-store-123",
            tenantId: "test-tenant-123",
            status: "pending"
          })
        })
      })
    });
    
    await ordersHandlers.updateOrderStatus(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Forbidden");
  });

  it("should return 422 when status transition is invalid", async () => {
    // 嘗試從 pending 直接跳到 completed，這通常是不允許的
    req.body.status = "completed";
    
    await ordersHandlers.updateOrderStatus(req, res);
    
    expect(res.status.calledWith(422) || res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
  });

  it("should handle database error gracefully", async () => {
    // 模擬數據庫錯誤
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: true,
          data: sinon.stub().returns({
            id: "test-order-123",
            storeId: "test-store-123",
            tenantId: "test-tenant-123",
            status: "pending"
          }),
          ref: {
            update: sinon.stub().rejects(new Error("Failed to update order"))
          }
        }),
        update: sinon.stub().rejects(new Error("Failed to update order"))
      })
    });
    
    await ordersHandlers.updateOrderStatus(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
  });
});

describe("Order Handlers - recordPayment", function() {
  this.timeout(5000);
  
  let req, res;

  beforeEach(() => {
    mockOrders.reset();
    
    req = {
      params: {
        orderId: "test-order-123"
      },
      body: {
        paymentMethod: "cash",
        amount: 150,
        transactionId: "",
        notes: "測試付款"
      },
      user: {
        uid: "test-user-123",
        role: "StoreManager",
        storeId: "test-store-123",
        tenantId: "test-tenant-123"
      }
    };

    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub()
    };

    // 設置模擬訂單數據
    const orderDoc = {
      exists: true,
      id: "test-order-123",
      data: sinon.stub().returns({
        id: "test-order-123",
        orderNumber: "TS220501001",
        storeId: "test-store-123",
        tenantId: "test-tenant-123",
        status: "ready",
        paymentStatus: "unpaid",
        totalAmount: 150,
        items: [{
          id: "item-1",
          name: "Test Item",
          quantity: 2
        }],
        createdAt: {
          toDate: () => new Date("2022-05-01")
        }
      }),
      ref: {
        update: sinon.stub().resolves()
      }
    };
    
    // 設置 collection 調用的返回值
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves(orderDoc),
        update: sinon.stub().resolves()
      })
    });
    
    // 設置 collection 調用的返回值
    mockOrders.firestoreMock.collection.withArgs("paymentRecords").returns({
      add: sinon.stub().resolves({ id: "payment-123" })
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should record payment successfully", async () => {
    await ordersHandlers.recordPayment(req, res);
    
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    
    const responseData = res.send.firstCall.args[0];
    expect(responseData).to.be.an("object");
    expect(responseData).to.have.property("success", true);
    expect(responseData).to.have.property("message").that.includes("Payment recorded");
    expect(responseData).to.have.property("order");
    expect(responseData.order).to.have.property("paymentStatus", "paid");
  });

  it("should return 400 when required fields are missing", async () => {
    req.body = {}; // 清空請求體
    
    await ordersHandlers.recordPayment(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Missing required fields");
  });

  it("should return 404 when order not found", async () => {
    // 模擬訂單不存在
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: false
        })
      })
    });
    
    await ordersHandlers.recordPayment(req, res);
    
    expect(res.status.calledWith(404)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("not found");
  });

  it("should return 403 when user doesn't have permission", async () => {
    // 模擬訂單屬於不同的店鋪
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: true,
          data: sinon.stub().returns({
            storeId: "different-store-123",
            tenantId: "test-tenant-123"
          })
        })
      })
    });
    
    await ordersHandlers.recordPayment(req, res);
    
    expect(res.status.calledWith(403)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Forbidden");
  });

  it("should return 400 when amount doesn't match", async () => {
    req.body.amount = 100; // 少於訂單金額
    
    await ordersHandlers.recordPayment(req, res);
    
    expect(res.status.calledWith(400)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("Amount mismatch");
  });

  it("should return 409 when order is already paid", async () => {
    // 模擬訂單已支付
    mockOrders.firestoreMock.collection.withArgs("orders").returns({
      doc: sinon.stub().returns({
        get: sinon.stub().resolves({
          exists: true,
          data: sinon.stub().returns({
            id: "test-order-123",
            storeId: "test-store-123",
            tenantId: "test-tenant-123",
            status: "completed",
            paymentStatus: "paid"
          })
        })
      })
    });
    
    await ordersHandlers.recordPayment(req, res);
    
    expect(res.status.calledWith(409)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
    expect(res.send.firstCall.args[0].message).to.include("already paid");
  });

  it("should handle database error gracefully", async () => {
    // 模擬數據庫錯誤
    mockOrders.firestoreMock.collection.withArgs("paymentRecords").returns({
      add: sinon.stub().rejects(new Error("Failed to record payment"))
    });
    
    await ordersHandlers.recordPayment(req, res);
    
    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledOnce).to.be.true;
  });
}); 