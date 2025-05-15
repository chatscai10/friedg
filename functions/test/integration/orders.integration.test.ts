import firebaseTest from 'firebase-functions-test';
import * as admin from 'firebase-admin';
import supertest from 'supertest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { aplikasi } from '../../src/api'; // Assuming your Express app is exported as 'aplikasi' from src/api/index.ts or similar
import { Order } from '../../src/orders/orders.types.v2'; // For type checking
import { MenuItemStockDoc } from '../../src/inventory/inventory.types.v2'; // For inventory checks

// Initialize firebase-functions-test. OFFLINE_MODE avoids calls to live Firebase services.
const testEnv = firebaseTest(); // No need to pass config if emulators are set up via firebase.json

let rulesTestEnv: RulesTestEnvironment;
let authedApp: admin.firestore.Firestore; // Firestore client for an authenticated user (via rules-unit-testing)
let adminApp: admin.firestore.Firestore;  // Firestore client with admin privileges

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'your-firebase-project-id'; // Set your project ID

// --- Test Users ---
type TestUser = { uid: string; email: string; token: string; roles?: string[] };
let customerUser: TestUser;
let staffUser: TestUser;
let adminUser: TestUser;

// --- Mock Express App for Supertest ---
// The main Express app instance from your project, e.g., from functions/src/index.ts or functions/src/api.ts
// We need to ensure it's initialized with emulated services if applicable.
const app = aplikasi; // Assuming your express app is 'aplikasi'

// Helper function to set up a user with custom claims (roles)
async function setupUserWithRoles(uid: string, email: string, roles: string[]): Promise<TestUser> {
  await admin.auth().createUser({ uid, email });
  await admin.auth().setCustomUserClaims(uid, { roles });
  const token = await admin.auth().createCustomToken(uid, { roles });
  return { uid, email, token, roles };
}

async function clearFirestoreData() {
    if (rulesTestEnv) {
        await rulesTestEnv.clearFirestore();
    }
    // Or, if using admin SDK to clear, iterate and delete collections (be careful!)
    // Example: const collections = await adminApp.listCollections();
    // for (const collection of collections) {
    //     const docs = await collection.listDocuments();
    //     for (const doc of docs) { await doc.delete(); }
    // }
}

async function seedMenuItem(itemId: string, initialStock: number, manageStock: boolean = true) {
    const menuItemData: Partial<MenuItemStockDoc> = {
        id: itemId,
        name: `Test Item ${itemId}`,
        price: 10, // Default price
        stock: {
            current: initialStock,
            manageStock: manageStock,
            lowStockThreshold: 5,
        },
        // ... other necessary fields for a menu item
    };
    await adminApp.collection('menuItems').doc(itemId).set(menuItemData);
    return menuItemData as MenuItemStockDoc;
}


beforeAll(async () => {
  // Initialize Firebase Admin SDK if not already initialized (for auth claims, etc.)
  // This might be done in a global setup file for all integration tests
  if (admin.apps.length === 0) {
    // Make sure GOOGLE_APPLICATION_CREDENTIALS is set or emulators are being used
    // For emulators, projectId can be anything for admin.initializeApp()
    admin.initializeApp({ projectId: PROJECT_ID }); 
  }
  adminApp = admin.firestore(); // For setup/admin operations

  // Setup test users with roles
  customerUser = await setupUserWithRoles('test-customer-uid', 'customer@example.com', ['customer']);
  staffUser = await setupUserWithRoles('test-staff-uid', 'staff@example.com', ['staff']);
  adminUser = await setupUserWithRoles('test-admin-uid', 'admin@example.com', ['admin']);

  // Initialize Firestore Rules Test Environment (optional, but good for testing rules alongside)
  // rulesTestEnv = await initializeTestEnvironment({ projectId: PROJECT_ID });
  // authedApp = rulesTestEnv.authenticatedContext(customerUser.uid, { token: customerUser.token }).firestore();

  // Ensure Firestore is pointing to the emulator if used
  // This might be set via FIRESTORE_EMULATOR_HOST env var
  // Alternatively, if admin.initializeApp() is called without args AND emulators are running, it should connect.
});

afterAll(async () => {
  await clearFirestoreData();
  // await rulesTestEnv?.cleanup();
  testEnv.cleanup(); // Cleanup firebase-functions-test mocks
  // Cleanup users
  await admin.auth().deleteUser(customerUser.uid).catch(() => {});
  await admin.auth().deleteUser(staffUser.uid).catch(() => {});
  await admin.auth().deleteUser(adminUser.uid).catch(() => {});
});

beforeEach(async () => {
  await clearFirestoreData(); // Clear data before each test for isolation
});

describe('POST /v2/orders - Create Order Integration Tests', () => {
  const storeId = 'test-store-123';
  const menuItemId = 'burger-001';
  const initialStock = 20;

  beforeEach(async () => {
    await seedMenuItem(menuItemId, initialStock);
  });

  it('should allow an authenticated customer to create an order successfully (201)', async () => {
    const orderPayload = {
      storeId: storeId,
      items: [{ itemId: menuItemId, name:'Test Burger', quantity: 2, price: 10 }],
      notes: 'Extra pickles please',
      // totalAmount is calculated server-side based on items
    };

    const response = await supertest(app)
      .post('/v2/orders')
      .set('Authorization', `Bearer ${customerUser.token}`)
      .send(orderPayload);

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    const orderId = response.body.id;
    expect(response.body.customerId).toBe(customerUser.uid);
    expect(response.body.storeId).toBe(storeId);
    expect(response.body.items.length).toBe(1);
    expect(response.body.items[0].itemId).toBe(menuItemId);
    expect(response.body.items[0].quantity).toBe(orderPayload.items[0].quantity);
    expect(response.body.items[0].price).toBe(orderPayload.items[0].price);
    expect(response.body.totalAmount).toBe(orderPayload.items[0].quantity * orderPayload.items[0].price);
    expect(response.body.status).toBe('pending_payment');
    expect(response.body.statusHistory).toBeDefined();
    expect(response.body.statusHistory.length).toBe(1);
    expect(response.body.statusHistory[0].status).toBe('pending_payment');

    // Verify in Firestore (using admin client for direct access)
    const orderDoc = await adminApp.collection('orders').doc(orderId).get();
    expect(orderDoc.exists).toBe(true);
    const orderData = orderDoc.data() as Order;
    expect(orderData.customerId).toBe(customerUser.uid);
    expect(orderData.totalAmount).toBe(20);

    // Verify stock deduction
    const menuItemDoc = await adminApp.collection('menuItems').doc(menuItemId).get();
    expect(menuItemDoc.exists).toBe(true);
    const itemStock = menuItemDoc.data()?.stock as MenuItemStockDoc['stock'];
    expect(itemStock.current).toBe(initialStock - orderPayload.items[0].quantity);
  });

  it('should return 401 if user is not authenticated', async () => {
    const orderPayload = {
      storeId: storeId,
      items: [{ itemId: menuItemId, name:'Test Burger', quantity: 1, price: 10 }],
    };
    const response = await supertest(app)
      .post('/v2/orders')
      .send(orderPayload); // No Authorization header
    expect(response.status).toBe(401);
  });
  
  it('should return 409 (Conflict) if not enough stock', async () => {
    const orderPayload = {
      storeId: storeId,
      items: [{ itemId: menuItemId, name:'Test Burger', quantity: initialStock + 5, price: 10 }], // Requesting more than available
    };

    const response = await supertest(app)
      .post('/v2/orders')
      .set('Authorization', `Bearer ${customerUser.token}`)
      .send(orderPayload);
    
    expect(response.status).toBe(409); 
    expect(response.body.code).toBe('inventory_error');

    // Verify stock was not changed
    const menuItemDoc = await adminApp.collection('menuItems').doc(menuItemId).get();
    const itemStock = menuItemDoc.data()?.stock as MenuItemStockDoc['stock'];
    expect(itemStock.current).toBe(initialStock);
  });

  it('should create order successfully on first call and return same order on second call (idempotency)', async () => {
    const orderPayload = {
      storeId: storeId,
      items: [{ itemId: menuItemId, name:'Test Burger', quantity: 1, price: 10 }],
    };

    // First call
    const response1 = await supertest(app)
      .post('/v2/orders')
      .set('Authorization', `Bearer ${customerUser.token}`)
      .send(orderPayload);
    
    expect(response1.status).toBe(201);
    const orderId1 = response1.body.id;

    // Second call with the same payload (should generate same idempotency key internally)
    const response2 = await supertest(app)
      .post('/v2/orders')
      .set('Authorization', `Bearer ${customerUser.token}`)
      .send(orderPayload);

    expect(response2.status).toBe(200); // Idempotency service returns existing resource with 200
    expect(response2.body.id).toBe(orderId1);
    expect(response2.body.totalAmount).toBe(response1.body.totalAmount);

    // Verify stock was only deducted once
    const menuItemDoc = await adminApp.collection('menuItems').doc(menuItemId).get();
    const itemStock = menuItemDoc.data()?.stock as MenuItemStockDoc['stock'];
    expect(itemStock.current).toBe(initialStock - orderPayload.items[0].quantity);
  });

});

describe('GET /v2/orders/:orderId - Get Order Integration Tests', () => {
  const storeId = 'test-store-for-get';
  const menuItemId = 'item-for-get';
  let testOrder: Order;
  let orderOwner: TestUser;
  let otherUser: TestUser;
  let adminForGet: TestUser;

  beforeAll(async () => {
    // Users specific to this describe block if needed, or use global ones
    orderOwner = await setupUserWithRoles('order-owner-uid', 'owner@example.com', ['customer']);
    otherUser = await setupUserWithRoles('other-user-uid', 'other@example.com', ['customer']);
    adminForGet = await setupUserWithRoles('admin-get-uid', 'adminget@example.com', ['admin']);
  });

  afterAll(async () => {
    await admin.auth().deleteUser(orderOwner.uid).catch(() => {});
    await admin.auth().deleteUser(otherUser.uid).catch(() => {});
    await admin.auth().deleteUser(adminForGet.uid).catch(() => {});
  });

  beforeEach(async () => {
    await seedMenuItem(menuItemId, 10);
    // Create a sample order owned by orderOwner
    const orderData = {
      customerId: orderOwner.uid,
      storeId: storeId,
      items: [{ itemId: menuItemId, name: 'Test Item', quantity: 1, price: 10 }],
      totalAmount: 10,
      status: 'pending_payment',
      notes: 'An order for GET tests',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      statusHistory: [{ status: 'pending_payment', updatedAt: admin.firestore.Timestamp.now(), updatedBy: orderOwner.uid }]
    };
    const orderRef = await adminApp.collection('orders').add(orderData);
    testOrder = { id: orderRef.id, ...orderData } as Order;
  });

  it('should allow the order owner to get their own order (200)', async () => {
    const response = await supertest(app)
      .get(`/v2/orders/${testOrder.id}`)
      .set('Authorization', `Bearer ${orderOwner.token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.id).toBe(testOrder.id);
    expect(response.body.customerId).toBe(orderOwner.uid);
  });

  it('should allow an admin user to get any order (200)', async () => {
    const response = await supertest(app)
      .get(`/v2/orders/${testOrder.id}`)
      .set('Authorization', `Bearer ${adminForGet.token}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(testOrder.id);
  });

  it('should prevent a non-owner, non-admin user from getting the order (403)', async () => {
    const response = await supertest(app)
      .get(`/v2/orders/${testOrder.id}`)
      .set('Authorization', `Bearer ${otherUser.token}`);
    
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('permission_denied');
  });

  it('should return 401 if the user is not authenticated', async () => {
    const response = await supertest(app)
      .get(`/v2/orders/${testOrder.id}`); // No token
      
    expect(response.status).toBe(401);
  });

  it('should return 404 if the order ID does not exist', async () => {
    const nonExistentOrderId = 'order-does-not-exist';
    const response = await supertest(app)
      .get(`/v2/orders/${nonExistentOrderId}`)
      .set('Authorization', `Bearer ${orderOwner.token}`); // Authenticated user
      
    expect(response.status).toBe(404);
  });
});

describe('PUT /v2/orders/:orderId/status - Update Order Status Integration Tests', () => {
  const storeId = 'test-store-for-put';
  const menuItemId = 'item-for-put';
  const initialStock = 30;
  let orderToUpdate: Order;
  let orderOwnerForPut: TestUser; // Customer who owns the order
  let staffForPut: TestUser;
  let adminForPutUpdate: TestUser;
  let basicCustomerForPut: TestUser; // Another customer, no special roles

  beforeAll(async () => {
    orderOwnerForPut = await setupUserWithRoles('owner-put-uid', 'ownerput@example.com', ['customer']);
    staffForPut = await setupUserWithRoles('staff-put-uid', 'staffput@example.com', ['staff']);
    adminForPutUpdate = await setupUserWithRoles('admin-put-uid', 'adminput@example.com', ['admin']);
    basicCustomerForPut = await setupUserWithRoles('customer-put-uid', 'customerput@example.com', ['customer']);
  });

  afterAll(async () => {
    await admin.auth().deleteUser(orderOwnerForPut.uid).catch(() => {});
    await admin.auth().deleteUser(staffForPut.uid).catch(() => {});
    await admin.auth().deleteUser(adminForPutUpdate.uid).catch(() => {});
    await admin.auth().deleteUser(basicCustomerForPut.uid).catch(() => {});
  });

  beforeEach(async () => {
    await seedMenuItem(menuItemId, initialStock, true);
    const orderData = {
      customerId: orderOwnerForPut.uid,
      storeId: storeId,
      items: [{ itemId: menuItemId, name: 'Test Item for PUT', quantity: 2, price: 10 }],
      totalAmount: 20,
      status: 'pending_payment',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      statusHistory: [{ status: 'pending_payment', updatedAt: admin.firestore.Timestamp.now(), updatedBy: orderOwnerForPut.uid }]
    };
    const orderRef = await adminApp.collection('orders').add(orderData);
    orderToUpdate = { id: orderRef.id, ...orderData } as Order;
  });

  it('should allow a staff user to update order status (e.g., to confirmed) (200)', async () => {
    const newStatus = 'confirmed';
    const response = await supertest(app)
      .put(`/v2/orders/${orderToUpdate.id}/status`)
      .set('Authorization', `Bearer ${staffForPut.token}`)
      .send({ status: newStatus });

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(orderToUpdate.id);
    expect(response.body.status).toBe(newStatus);
    expect(response.body.statusHistory.length).toBe(2);
    expect(response.body.statusHistory[1].status).toBe(newStatus);
    expect(response.body.statusHistory[1].updatedBy).toBe(staffForPut.uid);

    const updatedOrderDoc = await adminApp.collection('orders').doc(orderToUpdate.id).get();
    expect(updatedOrderDoc.data()?.status).toBe(newStatus);
  });

  it('should allow an admin user to update order status (e.g., to preparing) (200)', async () => {
    // First update to 'confirmed' by staff to allow transition to 'preparing'
    await adminApp.collection('orders').doc(orderToUpdate.id).update({ status: 'confirmed', statusHistory: admin.firestore.FieldValue.arrayUnion({status: 'confirmed', updatedAt: admin.firestore.Timestamp.now(), updatedBy: staffForPut.uid}) });

    const newStatus = 'preparing';
    const response = await supertest(app)
      .put(`/v2/orders/${orderToUpdate.id}/status`)
      .set('Authorization', `Bearer ${adminForPutUpdate.token}`)
      .send({ status: newStatus });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe(newStatus);
  });

  it('should prevent a customer (even owner) from updating order status (403)', async () => {
    const newStatus = 'confirmed';
    const response = await supertest(app)
      .put(`/v2/orders/${orderToUpdate.id}/status`)
      .set('Authorization', `Bearer ${orderOwnerForPut.token}`)
      .send({ status: newStatus });
    
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('permission_denied');
  });

  it('should return 401 if user is not authenticated', async () => {
    const response = await supertest(app)
      .put(`/v2/orders/${orderToUpdate.id}/status`)
      .send({ status: 'confirmed' }); // No token
    expect(response.status).toBe(401);
  });

  it('should return 404 if order ID does not exist', async () => {
    const response = await supertest(app)
      .put(`/v2/orders/non-existent-order/status`)
      .set('Authorization', `Bearer ${staffForPut.token}`)
      .send({ status: 'confirmed' });
    expect(response.status).toBe(404);
  });

  it('should return 400 (or 409 for invalid_state_transition) for invalid status value or transition', async () => {
    // Test invalid status enum value
    const responseInvalidEnum = await supertest(app)
      .put(`/v2/orders/${orderToUpdate.id}/status`)
      .set('Authorization', `Bearer ${staffForPut.token}`)
      .send({ status: 'this_is_not_a_valid_status' });
    expect(responseInvalidEnum.status).toBe(400); // Zod validation error from handler
    expect(responseInvalidEnum.body.code).toBe('validation_error');

    // Test invalid state transition (e.g., pending_payment to preparing)
    const responseInvalidTransition = await supertest(app)
      .put(`/v2/orders/${orderToUpdate.id}/status`)
      .set('Authorization', `Bearer ${staffForPut.token}`)
      .send({ status: 'preparing' }); // Cannot go from pending_payment to preparing
    expect(responseInvalidTransition.status).toBe(409);
    expect(responseInvalidTransition.body.code).toBe('invalid_state_transition');
  });

  it('should restore stock when order is cancelled by staff and update statusHistory', async () => {
    // Ensure order is in a cancellable state, e.g., 'confirmed'
    const confirmedStatusHistory = { status: 'confirmed', updatedAt: admin.firestore.Timestamp.now(), updatedBy: staffForPut.uid };
    await adminApp.collection('orders').doc(orderToUpdate.id).update({ status: 'confirmed', statusHistory: admin.firestore.FieldValue.arrayUnion(confirmedStatusHistory) });
    orderToUpdate.status = 'confirmed';
    orderToUpdate.statusHistory?.push(confirmedStatusHistory as any);

    const response = await supertest(app)
      .put(`/v2/orders/${orderToUpdate.id}/status`)
      .set('Authorization', `Bearer ${staffForPut.token}`)
      .send({ status: 'cancelled' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('cancelled');
    expect(response.body.statusHistory.length).toBe(orderToUpdate.statusHistory!.length +1 ); // Original + confirmed + cancelled
    expect(response.body.statusHistory.slice(-1)[0].status).toBe('cancelled');

    // Verify stock was restored
    const menuItemDoc = await adminApp.collection('menuItems').doc(menuItemId).get();
    const itemStock = menuItemDoc.data()?.stock as MenuItemStockDoc['stock'];
    // initialStock (30) - original order quantity (2) = 28. Then restored by 2 -> 30.
    expect(itemStock.current).toBe(initialStock);
  });
  
  it('should update status successfully on first call and return same on second (idempotency)', async () => {
    const newStatus = 'confirmed';
    // First call
    const response1 = await supertest(app)
      .put(`/v2/orders/${orderToUpdate.id}/status`)
      .set('Authorization', `Bearer ${staffForPut.token}`)
      .send({ status: newStatus });
    expect(response1.status).toBe(200);
    expect(response1.body.status).toBe(newStatus);

    // Second call
    const response2 = await supertest(app)
      .put(`/v2/orders/${orderToUpdate.id}/status`)
      .set('Authorization', `Bearer ${staffForPut.token}`)
      .send({ status: newStatus }); // Same status update request
      
    expect(response2.status).toBe(200);
    expect(response2.body.status).toBe(newStatus);
    expect(response2.body.id).toBe(orderToUpdate.id);
    // statusHistory length should remain the same as after the first successful update
    expect(response2.body.statusHistory.length).toBe(response1.body.statusHistory.length); 

    // Verify in Firestore that statusHistory was not duplicated
    const orderDoc = await adminApp.collection('orders').doc(orderToUpdate.id).get();
    expect((orderDoc.data() as Order).statusHistory?.length).toBe(response1.body.statusHistory.length);
  });

});


</rewritten_file> 