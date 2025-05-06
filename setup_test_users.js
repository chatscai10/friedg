const admin = require("firebase-admin");

// --- Configuration ---
// IMPORTANT: Ensure Auth emulator is running before executing this script!
// Set the FIRESTORE_EMULATOR_HOST environment variable so Admin SDK connects to the emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"; // Default Auth emulator port

try {
  // Initialize without explicit credential when using emulators
  // Ensure GOOGLE_APPLICATION_CREDENTIALS is not set in your env if you encounter issues
  admin.initializeApp({
    projectId: "friedg", // Still provide your project ID
    // Attempt to explicitly connect to emulator - might not be needed if env var works
    // databaseURL: `http://127.0.0.1:9000?ns=${process.env.FIREBASE_PROJECT_ID}` // Example for RTDB
    // storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com` // Example for Storage
    // We don't need explicit databaseURL or storageBucket for Auth interaction here
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
  // Add more test users if needed (e.g., a regular employee)
];

async function setupUsers() {
  console.log("Starting test user setup...");

  for (const userData of usersToCreate) {
    let userRecord;
    try {
      // Check if user already exists
      try {
        userRecord = await admin.auth().getUserByEmail(userData.email);
        console.log(`User ${userData.email} already exists (UID: ${userRecord.uid}). Updating claims...`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // User doesn't exist, create them
          userRecord = await admin.auth().createUser({
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
      await admin.auth().setCustomUserClaims(userRecord.uid, userData.claims);
      console.log(`Successfully set claims for ${userData.email}:`, userData.claims);

    } catch (error) {
      console.error(`Failed to process user ${userData.email}:`, error);
      // Decide if you want to stop or continue on error
    }
  }

  console.log("Test user setup finished.");
}

setupUsers().catch((error) => {
  console.error("Unhandled error during user setup:", error);
  process.exit(1);
}); 