import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin/app'; // Use admin/app for initialization
import { getFirestore, FieldValue } from 'firebase-admin/firestore'; // Added FieldValue
import { logger } from 'firebase-functions';
// Assuming express app is initialized and exported from a central place if using a more complex router setup
// For a single function file, we can define a simple express app or directly use onRequest
import * as express from 'express';
import * as cors from 'cors';
import { authenticateRequest, authorizeRoles } from '../middleware/auth.middleware'; // Import the auth and role middleware
import { deductStock } from '../inventory/inventory.v2'; // Import deductStock

// Initialize Firebase Admin SDK (idempotent)
if (admin.getApps().length === 0) {
  admin.initializeApp();
}
const db = getFirestore();

// Initialize Express app
const app = express();

// Middlewares
app.use(cors({ origin: true })); // Enable CORS for all origins, adjust as needed for security
app.use(express.json()); // To parse JSON request bodies
// Note: authenticateRequest will be applied to specific routes that need it, or globally if all need it.
// For more granular control, apply it per route. Here it's applied before route definitions needing auth.
// app.use(authenticateRequest); // Moved to be applied to specific routes or router groups

interface CartItemOption {
    name: string;
    value: string;
    priceAdjustment?: number;
}

interface CartItem {
    id: string; 
    name: string;
    price: number; 
    quantity: number;
    imageUrl?: string;
    selectedOptions?: CartItemOption[];
}

interface OrderCustomerInfo {
    name?: string; // from checkout form
    phone?: string; // from checkout form, or could be from auth user
    pickupTime?: string; // e.g., ISO string or specific format
    notes?: string;
    // Add other fields like deliveryAddress if applicable
}

interface CreateOrderPayload {
    items: CartItem[];
    totalAmount: number;
    customerInfo: OrderCustomerInfo;
    paymentMethod: string; // e.g., 'cash', 'line_pay'
    pickupMethod: string; // e.g., 'takeaway', 'delivery'
}

// --- New GET route for listing user's orders --- (listMyOrdersV2 logic)
app.get('/myorders', authenticateRequest, async (req: express.Request, res: express.Response) => {
    logger.info('Attempting to list orders for user', { uid: (req as any).user?.uid });
    const firebaseUser = (req as any).user;
    if (!firebaseUser || !firebaseUser.uid) {
        return res.status(403).json({ error: 'Authentication required.' });
    }
    const customerId = firebaseUser.uid;

    try {
        const ordersSnapshot = await db.collection('orders')
                                     .where('customerId', '==', customerId)
                                     .orderBy('createdAt', 'desc')
                                     .get();
        if (ordersSnapshot.empty) {
            return res.status(200).json({ data: [] });
        }
        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ data: orders });
    } catch (error) {
        logger.error('Error listing user orders:', error);
        return res.status(500).json({ error: 'Failed to list orders.' });
    }
});

// --- New GET route for specific order details --- (getOrderDetailsV2 logic)
app.get('/:orderId', authenticateRequest, async (req: express.Request, res: express.Response) => {
    logger.info('Attempting to get order details', { uid: (req as any).user?.uid, params: req.params });
    const firebaseUser = (req as any).user;
    if (!firebaseUser || !firebaseUser.uid) {
        return res.status(403).json({ error: 'Authentication required.' });
    }
    const customerId = firebaseUser.uid;
    const { orderId } = req.params;

    if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required.' });
    }

    try {
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        const orderData = orderDoc.data();
        if (orderData?.customerId !== customerId) {
            logger.warn('User attempted to access order not belonging to them', { 
                requestingUid: customerId, 
                orderId: orderId, 
                actualOwnerUid: orderData?.customerId 
            });
            return res.status(403).json({ error: 'Forbidden. You do not have access to this order.' });
        }

        return res.status(200).json({ data: { id: orderDoc.id, ...orderData } });
    } catch (error) {
        logger.error('Error getting order details:', error);
        return res.status(500).json({ error: 'Failed to get order details.' });
    }
});

// --- New GET route for listing recent orders (for POS/admin) --- (listRecentOrdersV2 logic)
app.get('/recent', authenticateRequest, authorizeRoles('admin', 'employee'), async (req: express.Request, res: express.Response) => {
    logger.info('Attempting to list recent orders by authorized user', { uid: (req as any).user?.uid, role: (req as any).user?.role });
    // const firebaseUser = (req as any).user; // Already handled by middlewares

    // Role check is now handled by authorizeRoles middleware
    // if (!firebaseUser || !['employee', 'store_manager', 'tenant_admin', 'super_admin'].some(role => firebaseUser.roles?.includes(role))) {
    //     logger.warn('User does not have sufficient permissions to list recent orders', { uid: firebaseUser?.uid, roles: firebaseUser?.roles });
    //     return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    // }

    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50; // Default to 50 recent orders
        const ordersSnapshot = await db.collection('orders')
                                     .orderBy('createdAt', 'desc')
                                     .limit(limit)
                                     .get();
        if (ordersSnapshot.empty) {
            return res.status(200).json({ data: [] });
        }
        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ data: orders });
    } catch (error) {
        logger.error('Error listing recent orders:', error);
        return res.status(500).json({ error: 'Failed to list recent orders.' });
    }
});

// --- Existing POST route for creating an order --- (createOrderV2 logic)
app.post('/', authenticateRequest, async (req: express.Request, res: express.Response) => {
    logger.info('Attempting to create a new order', { body: req.body });

    const firebaseUser = (req as any).user;
    if (!firebaseUser || !firebaseUser.uid) {
        logger.warn('User not authenticated or uid missing in createOrderV2 handler (should have been caught by middleware).');
        return res.status(403).json({ error: 'Authentication required.' });
    }
    const customerId = firebaseUser.uid;

    const { items, totalAmount, customerInfo, paymentMethod, pickupMethod } = req.body as CreateOrderPayload;

    if (!items || items.length === 0 || !totalAmount || typeof totalAmount !== 'number' || totalAmount <= 0) {
        logger.warn('Invalid order payload', { payload: req.body });
        return res.status(400).json({ error: 'Invalid order data. Items and totalAmount are required.' });
    }
    if (!customerInfo || !paymentMethod || !pickupMethod) {
        logger.warn('Missing customerInfo, paymentMethod, or pickupMethod', { payload: req.body });
        return res.status(400).json({ error: 'Customer info, payment method, and pickup method are required.' });
    }

    const newOrderRef = db.collection('orders').doc(); // Generate new order ID beforehand

    try {
        await db.runTransaction(async (transaction) => {
            const orderData = {
                orderId: newOrderRef.id, // Use the pre-generated ID
                customerId,
                customerName: customerInfo.name || firebaseUser.displayName || null,
                customerPhone: customerInfo.phone || firebaseUser.phoneNumber || null,
                items: items.map(item => ({ // Ensure we only store relevant item data
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    imageUrl: item.imageUrl || null,
                    selectedOptions: item.selectedOptions || [],
                })),
                totalAmount,
                status: 'pending', 
                paymentMethod,
                paymentDetails: { // Initialize paymentDetails
                    method: paymentMethod,
                    status: paymentMethod === 'cash' ? 'pending_cash_payment' : 'pending_online_payment',
                },
                pickupMethod,
                pickupTime: customerInfo.pickupTime || null,
                orderNotes: customerInfo.notes || null,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            transaction.set(newOrderRef, orderData);
            logger.info(`Order ${newOrderRef.id} data prepared for transaction.`);

            // Prepare items for stock deduction
            const itemsForStockDeduction = items.map(item => ({ 
                itemId: item.id, 
                quantity: item.quantity 
            }));

            // Call deductStock (placeholder) within the transaction
            // This function is expected to throw an error if stock deduction fails, which would roll back the transaction.
            await deductStock(itemsForStockDeduction, transaction);
            logger.info(`Placeholder stock deduction called for order ${newOrderRef.id}.`);

            // If deductStock was real and failed, an error would be thrown and this point wouldn't be reached.
        });

        logger.info('Order created successfully within transaction', { orderId: newOrderRef.id, customerId });
        // Fetch the created order data to return (optional, but good for consistency)
        const createdOrderDoc = await newOrderRef.get();
        
        return res.status(201).json({ 
            message: 'Order created successfully',
            orderId: newOrderRef.id,
            orderDetails: createdOrderDoc.data() // Return the data as it is in Firestore
        });

    } catch (error: any) {
        logger.error(`Error creating order ${newOrderRef.id} within transaction:`, error);
        // Check if it's an HttpsError from deductStock (e.g., insufficient stock or item not found)
        if (error instanceof functions.https.HttpsError) {
            // Pass along the specific error code and message from HttpsError
            return res.status(error.httpErrorCode.status).json({ error: error.message, code: error.code });
        }
        // Generic error for other transaction failures
        return res.status(500).json({ error: 'Failed to create order. Please try again.', details: error.message });
    }
});

// --- New PUT route for updating order status (for POS/admin) ---
const ALLOWED_ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready_for_pickup", "completed", "cancelled", "paid", "payment_failed"];

app.put('/admin/:orderId/status', authenticateRequest, authorizeRoles('admin', 'employee'), async (req: express.Request, res: express.Response) => {
    logger.info('Attempting to update order status by authorized user', { uid: (req as any).user?.uid, role: (req as any).user?.role, params: req.params, body: req.body });
    const firebaseUser = (req as any).user;
    const { orderId } = req.params;
    const { status: newStatus } = req.body;

    // Authentication check is done by authenticateRequest
    // Role check is now handled by authorizeRoles middleware
    // const userRole = firebaseUser.role; 
    // if (!userRole || !['admin', 'employee'].includes(userRole)) {
    //     logger.warn('User does not have sufficient permissions to update order status (in-route check, should be caught by middleware)', { 
    //         uid: firebaseUser.uid, 
    //         role: userRole,
    //         requiredRoles: ['admin', 'employee']
    //     });
    //     return res.status(403).json({ error: 'Forbidden: Insufficient permissions to update order status.' });
    // }

    if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required.' });
    }
    if (!newStatus || typeof newStatus !== 'string') {
        return res.status(400).json({ error: 'New status is required and must be a string.' });
    }
    if (!ALLOWED_ORDER_STATUSES.includes(newStatus)) {
        return res.status(400).json({ error: `Invalid status value. Allowed statuses are: ${ALLOWED_ORDER_STATUSES.join(', ')}` });
    }

    try {
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        // Optional: Add checks here if certain status transitions are not allowed
        // For example, a 'completed' order cannot go back to 'preparing'.
        // const currentStatus = orderDoc.data()?.status;
        // if (currentStatus === 'completed' && newStatus !== 'completed') { // Example rule
        //    return res.status(400).json({ error: `Cannot change status of a completed order.`});
        // }

        await orderRef.update({
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
        });

        const updatedOrderDoc = await orderRef.get(); // Fetch the updated document
        logger.info('Order status updated successfully', { orderId, newStatus, adminUid: firebaseUser.uid });
        return res.status(200).json({ 
            message: 'Order status updated successfully.',
            data: { id: updatedOrderDoc.id, ...updatedOrderDoc.data() }
        });

    } catch (error) {
        logger.error('Error updating order status:', { orderId, newStatus, error });
        return res.status(500).json({ error: 'Failed to update order status.' });
    }
});

// Export the Express app as an HTTPS function
// The function name here (`createorderv2`) will be the base for all routes defined in the app.
// Firebase Hosting rewrites will direct specific paths to this single Cloud Function.
export const ordersApiV2 = functions.https.onRequest(app); 