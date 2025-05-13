import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// --- Configuration ---
// IMPORTANT: Ensure Auth emulator is running before executing this script!
// Set the FIRESTORE_EMULATOR_HOST environment variable so Admin SDK connects to the emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:7099"; // Auth emulator port

console.log("Connecting to Auth emulator at:", process.env.FIREBASE_AUTH_EMULATOR_HOST);

try {
  // Initialize without explicit credential when using emulators
  // Ensure GOOGLE_APPLICATION_CREDENTIALS is not set in your env if you encounter issues
  const app = initializeApp({
    projectId: "friedg", // Provide your project ID
  });
  console.log("Firebase Admin SDK initialized for EMULATOR.");
} catch (e) {
  if (e.code !== 'app/duplicate-app') {
    console.error("Firebase Admin SDK initialization error:", e);
    process.exit(1);
  } else {
    console.log("Firebase Admin SDK already initialized.");
  }
}

const auth = getAuth();

const usersToCreate = [
  {
    email: "admin@test.com",
    password: "password123",
    displayName: "Test Tenant Admin",
    claims: { role: "TenantAdmin", tenantId: "tenant-123" },
  },
  {
    email: "manager@test.com",
    password: "password123",
    displayName: "Test Store Manager",
    claims: { role: "StoreManager", tenantId: "tenant-123", storeId: "store-abc" },
  },
  // Add more test users if needed
];

async function setupUsers() {
  console.log("Starting test user setup...");

  for (const userData of usersToCreate) {
    let userRecord;
    try {
      // Check if user already exists
      try {
        userRecord = await auth.getUserByEmail(userData.email);
        console.log(`User ${userData.email} already exists (UID: ${userRecord.uid}). Updating claims...`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // User doesn't exist, create them
          userRecord = await auth.createUser({
            email: userData.email,
            password: userData.password,
            displayName: userData.displayName,
            emailVerified: true, // Assume verified for testing
            disabled: false,
          });
          console.log(`Successfully created user ${userData.email} (UID: ${userRecord.uid})`);
        } else {
          throw error; // Re-throw other errors
        }
      }

      // Set custom claims
      await auth.setCustomUserClaims(userRecord.uid, userData.claims);
      console.log(`Successfully set claims for ${userData.email}:`, userData.claims);

    } catch (error) {
      console.error(`Failed to process user ${userData.email}:`, error);
      // Continue with next user on error
    }
  }

  console.log("Test user setup finished.");
}

setupUsers().catch((error) => {
  console.error("Unhandled error during user setup:", error);
  process.exit(1);
}); 