import * as functionsV2 from 'firebase-functions/v2/https';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import * as yup from "yup";
import { authenticateRequest, authorizeRoles } from "../middleware/auth.middleware";
import express = require("express"); // Import express

// Ensure Firebase Admin SDK is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

interface SetUserRoleData {
  userId: string;
  role: string; // Expecting a single role string, e.g., 'admin', 'employee', 'customer'
                // Or roles: string[] if multiple roles are to be supported via claims
}

// Define valid roles - ADDED 'store_manager'
const VALID_ROLES = ["admin", "employee", "customer", "store_manager"];

const setUserRoleSchema = yup.object({
  userId: yup.string().required("User ID is required."),
  role: yup
    .string()
    .oneOf(VALID_ROLES, "Invalid role specified.")
    .required("Role is required."),
});

export const setUserRoleV2 = functionsV2.onCall(
  { region: 'asia-east1', timeoutSeconds: 60, memory: '256MiB' }, // Standard options
  async (request: functionsV2.CallableRequest<SetUserRoleData>) => {
    logger.info('setUserRoleV2 called with data:', request.data);
    logger.info('Caller auth context:', request.auth);

    // Authentication Check: Ensure the user is authenticated.
    if (!request.auth) {
      logger.error('Authentication failed: User is not authenticated.');
      throw new functionsV2.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }

    // Authorization Check: Ensure the user is an admin.
    // This relies on the calling user having a custom claim 'role': 'admin'.
    if (request.auth.token.role !== 'admin') {
      logger.error(
        'Authorization failed: User is not an admin.',
        { uid: request.auth.uid, role: request.auth.token.role }
      );
      throw new functionsV2.HttpsError(
        'permission-denied',
        'You must be an admin to set user roles.'
      );
    }

    // Validate input
    try {
      await setUserRoleSchema.validate(request.data);
    } catch (error: any) {
      logger.error('Validation error:', error.errors);
      throw new functionsV2.HttpsError(
        'invalid-argument',
        'Validation failed: ' + error.errors.join(', ')
      );
    }

    const { userId, role } = request.data;

    try {
      // Set custom user claims
      await admin.auth().setCustomUserClaims(userId, { role: role });
      logger.info(
        `Successfully set role '${role}' for user ${userId} by admin ${request.auth.uid}`
      );
      return {
        success: true,
        message: `Role '${role}' successfully set for user ${userId}.`,
      };
    } catch (error) {
      logger.error(`Error setting custom claims for user ${userId}:`, error);
      throw new functionsV2.HttpsError(
        'internal',
        'An internal error occurred while setting user role.'
      );
    }
  }
);

// --- New listUsersApiV2 Function ---
const listUsersApp = express();

// Middleware for authentication and authorization
listUsersApp.use(authenticateRequest); // Ensures req.user is populated
listUsersApp.use(authorizeRoles(["super_admin", "tenant_admin"])); // Ensures only admins can access

listUsersApp.get("/", async (req, res) => {
  const maxResults = parseInt(req.query.maxResults as string) || 100; // Max 1000 by Firebase
  const pageToken = req.query.pageToken as string | undefined;

  try {
    const listUsersResult = await admin
      .auth()
      .listUsers(maxResults, pageToken);

    const users = listUsersResult.users.map((userRecord) => {
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        disabled: userRecord.disabled,
        emailVerified: userRecord.emailVerified,
        customClaims: userRecord.customClaims, // Includes role if set
        metadata: {
          lastSignInTime: userRecord.metadata.lastSignInTime,
          creationTime: userRecord.metadata.creationTime,
        }
      };
    });

    logger.info(`Admin ${req.user?.uid} listed users. Count: ${users.length}`);
    res.status(200).json({
      success: true,
      users: users,
      nextPageToken: listUsersResult.pageToken,
    });
  } catch (error) {
    logger.error(`Error listing users by admin ${req.user?.uid}:`, error);
    res.status(500).json({
      success: false,
      message: "An error occurred while listing users.",
      error: (error as Error).message,
    });
  }
});

export const listUsersApiV2 = functionsV2.onRequest(
  { region: 'asia-east1', timeoutSeconds: 60, memory: '256MiB' },
  listUsersApp
);