import { onRequest, HttpsOptions } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import express from 'express'; // Changed
import { Request, Response, NextFunction } from 'express';
// const express = expressModule; // Removed
import * as admin from "firebase-admin/app"; // Import admin from firebase-admin/app for initializeApp
import { getFirestore, Firestore } from "firebase-admin/firestore";
import * as Yup from 'yup'; // Import Yup
import { authenticateRequest } from '../middleware/auth.middleware'; // Import the actual auth middleware
// import { getAuth } from "firebase-admin/auth"; // Keep for actual auth

// Ensure Firebase Admin SDK is initialized only once
if (admin.getApps().length === 0) { // Correct way to check if already initialized
  admin.initializeApp();
}

const db: Firestore = getFirestore(); // getFirestore() doesn't need app arg if default app is initialized

// Schema for store creation
const storeSchema = Yup.object({
  name: Yup.string().required('店鋪名稱為必填').min(2, '店鋪名稱至少需要2個字符').max(100, '店鋪名稱不能超過100個字符'),
  address: Yup.string().required('店鋪地址為必填').min(5, '店鋪地址至少需要5個字符').max(200, '店鋪地址不能超過200個字符'),
  phone: Yup.string().optional().matches(/^[0-9\-\+]{7,15}$/, '請輸入有效的電話號碼'), // Basic phone validation
  // tenantId: Yup.string().required('Tenant ID is required'), // Assuming tenantId will be from authenticated user context
  isActive: Yup.boolean().default(true),
  // Add other fields like openingHours, etc. as needed
});

// Schema for store update (allows partial updates)
const storeUpdateSchema = Yup.object({
  name: Yup.string().optional().min(2, '店鋪名稱至少需要2個字符').max(100, '店鋪名稱不能超過100個字符'),
  address: Yup.string().optional().min(5, '店鋪地址至少需要5個字符').max(200, '店鋪地址不能超過200個字符'),
  phone: Yup.string().optional().nullable().matches(/^[0-9\-\+]{7,15}$/, '請輸入有效的電話號碼'),
  isActive: Yup.boolean().optional(),
  // Ensure no one can update tenantId or createdAt
  tenantId: Yup.mixed().strip(),
  createdAt: Yup.mixed().strip(),
});

// Global options for all functions in this file (optional)
const globalOpts: HttpsOptions = {
    region: "asia-east1",
    memory: "256MiB",
    // timeoutSeconds: 60,
    // minInstances: 0,
    // cors: true, // Enable CORS if functions are called directly, not through Hosting rewrites that handle CORS
};
setGlobalOptions({ region: "asia-east1" });

// Placeholder Middleware (as per previous design) - THIS WILL BE REMOVED OR REPLACED
// const authenticateRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
//    console.log("authenticateRequest middleware called (v2 placeholder) - Path:", req.path);
//    next();
// };

const authorizeTenant = async (req: Request, res: Response, next: NextFunction) => {
    console.log("authorizeTenant middleware called (v2 placeholder) - Path:", req.path);
    // For createStoreV2: User must have permission to create a store (e.g. 'admin' role for their tenantId).
    // For getStoreV2: User must have permission to view the store (e.g. belongs to the same tenantId or is a superadmin).
    // const userTenantId = (req as any).user?.tenant_id;
    // const storeTenantId = req.params.storeId ? (await db.collection('stores').doc(req.params.storeId).get()).data()?.tenantId : (req.body as any)?.tenantId;
    // if (userTenantId !== storeTenantId && !(req as any).user?.roles.includes('superadmin')) {
    //   return res.status(403).json({ error: "Forbidden: Access to this tenant's resource is denied." });
    // }
    next();
};

export const liststoresv2 = onRequest(async (request, response) => {
    const expressApp = express();
    expressApp.use(authenticateRequest); // Apply REAL authentication middleware
    expressApp.use(authorizeTenant);

    expressApp.get('*', async (req, res) => {
        console.log("liststoresv2 app.get('*') handler reached. Original URL:", request.originalUrl);
        // Check if user is populated by middleware
        const authenticatedUser = (req as any).user;
        if (authenticatedUser) {
            console.log("Authenticated user for liststoresv2:", authenticatedUser.uid);
        } else {
            // This case should ideally be handled by the authenticateRequest middleware sending a 401/403
            // However, if it reaches here without a user, it's an issue.
            console.warn("liststoresv2 reached without authenticated user after middleware.");
            // return res.status(403).json({ error: "Forbidden: Authentication details missing unexpectedly." });
        }

        try {
            const storesCollection = db.collection("stores");
            // If multi-tenant: const snapshot = await storesCollection.where("tenantId", "==", userTenantId).get();
            const snapshot = await storesCollection.get(); // For now, get all stores

            if (snapshot.empty) {
                res.status(200).json({ data: [] });
                return;
            }

            const stores: any[] = [];
            snapshot.forEach(doc => {
                stores.push({ id: doc.id, ...doc.data() });
            });

            res.status(200).json({ data: stores });
        } catch (error) {
            console.error("Error in liststoresv2 fetching from Firestore:", error);
            // firebase-functions/v2/logger can also be used: logger.error(...)
            res.status(500).json({ error: "Internal server error while fetching stores.", details: (error as Error).message });
        }
    });

    // Forward the main function request/response to the Express app
    expressApp(request, response);
});

// Placeholder for createStoreV2 (as per your design doc)
export const createstorev2 = onRequest(async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).send('Method Not Allowed');
        return;
    }
    const expressApp = express();
    expressApp.use(express.json());
    expressApp.use(authenticateRequest); // Apply REAL authentication middleware
    // authorizeTenant might be tricky here if tenantId is part of the body and not from user context yet for creation
    // Let's assume tenantId comes from authenticated user or a superadmin sets it.

    expressApp.post('*', async (req, res) => {
        console.log("createstorev2 app.post('*') handler reached.");
        try {
            // const authenticatedUser = (req as any).user;
            // if (!authenticatedUser || !authenticatedUser.tenant_id) { // Example: Tenant ID from user context
            //     return res.status(403).json({ error: "Forbidden: User must belong to a tenant." });
            // }
            // if (!authenticatedUser.roles?.includes('admin')) { // Example: Role check
            //    return res.status(403).json({ error: "Forbidden: User does not have permission to create stores." });
            // }

            const storeData = req.body;
            // Validate input
            await storeSchema.validate(storeData, { abortEarly: false });

            // const tenantId = authenticatedUser.tenant_id; // Use tenantId from authenticated user
            const dataToSave = {
                ...storeData,
                // tenantId, // Ensure tenantId is set, e.g., from authenticated user context
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const storeRef = await db.collection('stores').add(dataToSave);
            res.status(201).json({ message: "Store created successfully", data: { id: storeRef.id, ...dataToSave } });
        } catch (error) {
            if (error instanceof Yup.ValidationError) {
                return res.status(400).json({ error: "Validation failed", details: error.errors });
            }
            console.error("Error in createstorev2:", error);
            res.status(500).json({ error: "Internal server error while creating store.", details: (error as Error).message });
        }
    });
    expressApp(request,response);
});

export const getstorev2 = onRequest(async (request, response) => {
    const expressApp = express();
    expressApp.use(authenticateRequest); // Apply REAL authentication middleware
    expressApp.use(authorizeTenant);

    expressApp.get('/:storeId', async (req, res) => { // Changed to use router param
        console.log("getstorev2 app.get handler. Params:", req.params);
        try {
            const { storeId } = req.params;
            if (!storeId) {
                return res.status(400).json({ error: "Store ID is missing from the path." });
            }

            const storeDoc = await db.collection('stores').doc(storeId).get();

            if (!storeDoc.exists) {
                return res.status(404).json({ error: "Store not found." });
            }

            res.status(200).json({ data: { id: storeDoc.id, ...storeDoc.data() } });
        } catch (error) {
            console.error("Error in getstorev2:", error);
            res.status(500).json({ error: "Internal server error while fetching store.", details: (error as Error).message });
        }
    });
    expressApp(request,response);
});

export const updatestorev2 = onRequest(async (request, response) => {
    const expressApp = express();
    expressApp.use(express.json());
    expressApp.use(authenticateRequest); // Apply REAL authentication middleware
    expressApp.use(authorizeTenant);

    expressApp.put('/:storeId', async (req, res) => { // Changed to use router param
        console.log("updatestorev2 app.put handler. Params:", req.params, "Body:", req.body);
        try {
            const { storeId } = req.params;
            if (!storeId) {
                return res.status(400).json({ error: "Store ID is missing from the path." });
            }

            const storeDataToUpdate = req.body;
            await storeUpdateSchema.validate(storeDataToUpdate, { abortEarly: false, stripUnknown: true });

            const storeRef = db.collection('stores').doc(storeId);
            const storeDoc = await storeRef.get();

            if (!storeDoc.exists) {
                return res.status(404).json({ error: "Store not found to update." });
            }

            // Tenant check would happen in authorizeTenant middleware
            // const authenticatedUser = (req as any).user;
            // if (storeDoc.data()?.tenantId !== authenticatedUser.tenant_id && !authenticatedUser.roles?.includes('superadmin')) {
            //     return res.status(403).json({ error: "Forbidden: User cannot update this store." });
            // }

            const updatePayload = {
                ...storeDataToUpdate,
                updatedAt: new Date().toISOString(),
            };

            await storeRef.update(updatePayload);
            const updatedDoc = await storeRef.get();

            res.status(200).json({ message: "Store updated successfully", data: { id: updatedDoc.id, ...updatedDoc.data() } });
        } catch (error) {
            if (error instanceof Yup.ValidationError) {
                return res.status(400).json({ error: "Validation failed for update", details: error.errors });
            }
            console.error("Error in updatestorev2:", error);
            res.status(500).json({ error: "Internal server error while updating store.", details: (error as Error).message });
        }
    });
    expressApp(request,response);
});

export const deletestorev2 = onRequest(async (request, response) => {
    const expressApp = express();
    expressApp.use(authenticateRequest); // Apply REAL authentication middleware
    expressApp.use(authorizeTenant);

    expressApp.delete('/:storeId', async (req, res) => { // Changed to use router param
        console.log("deletestorev2 app.delete handler. Params:", req.params);
        try {
            const { storeId } = req.params;
            if (!storeId) {
                return res.status(400).json({ error: "Store ID is missing from the path." });
            }

            const storeRef = db.collection('stores').doc(storeId);
            const storeDoc = await storeRef.get();

            if (!storeDoc.exists) {
                return res.status(404).json({ error: "Store not found to delete." });
            }

            // Tenant check would happen in authorizeTenant middleware
            // const authenticatedUser = (req as any).user;
            // if (storeDoc.data()?.tenantId !== authenticatedUser.tenant_id && !authenticatedUser.roles?.includes('superadmin')) {
            //     return res.status(403).json({ error: "Forbidden: User cannot delete this store." });
            // }

            await storeRef.delete();
            res.status(200).json({ message: "Store deleted successfully", data: { id: storeId } }); // Or 204 No Content
        } catch (error) {
            console.error("Error in deletestorev2:", error);
            res.status(500).json({ error: "Internal server error while deleting store.", details: (error as Error).message });
        }
    });
    expressApp(request,response);
});

// ... (Other store functions like updateStoreV2, deleteStoreV2 would follow a similar pattern)

// Express app for stores (assuming it's defined elsewhere or below)
// export const storesApiV2 = onRequest(globalOpts, storesApp); // Example if it were Gen 2
// Or if it's Gen 1, it would be exported differently in index.ts like:
// exports.storesApiV2 = functions.https.onRequest(storesApp);

// IMPORTANT: This is a simplified representation.
// The actual export and app definition needs to be checked in index.ts and this file.