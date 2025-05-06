import {
  // Auth, // Type not explicitly needed here
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  connectAuthEmulator, // Import emulator connector
  getIdToken,
  IdTokenResult // Import IdTokenResult
} from "firebase/auth";
import { auth } from "../firebaseConfig"; // Import the configured auth instance

// Helper type for internal flag check (use carefully)
type AuthWithEmulatorFlag = typeof auth & { _isEmulated?: boolean };

// Connect to the Auth emulator if in development
// NOTE: This needs to be called BEFORE any auth operations
if (import.meta.env.DEV) {
  try {
    // Check if already connected (Firebase throws error if connected multiple times)
    // A simple check like this might not be foolproof in HMR scenarios,
    // but it prevents the most common connection errors during development.
    if (!(auth as AuthWithEmulatorFlag)._isEmulated) { // Use type assertion
        console.log("Connecting to Auth Emulator at http://localhost:9199...");
        connectAuthEmulator(auth, "http://localhost:9199", { disableWarnings: true });
        console.log("Auth Emulator connected.");
        (auth as AuthWithEmulatorFlag)._isEmulated = true; // Mark as emulated
    } else {
        console.log("Auth Emulator connection already established.")
    }
  } catch (error) {
    console.error("Error connecting to Auth Emulator: ", error);
  }
}

/**
 * Logs in a user with email and password.
 * @param email User's email.
 * @param password User's password.
 * @returns A promise that resolves with the UserCredential on success.
 */
const login = async (email: string, password: string): Promise<User | null> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Force refresh token after successful login to get latest claims
    await getIdToken(userCredential.user, true); // <--- Added force refresh
    console.log("Login successful, token refreshed.");
    // Optionally fetch and log claims immediately after login
    const tokenResult = await getIdTokenResult(false); // No need to force refresh again immediately
    console.log("Claims after login:", tokenResult?.claims);
    return userCredential.user;
  } catch (error) {
    console.error("Login failed:", error);
    // Consider throwing a more specific error or returning a standardized error object
    throw error; // Re-throw the error to be handled by the calling component
  }
};

/**
 * Logs out the current user.
 * @returns A promise that resolves when logout is complete.
 */
const logout = (): Promise<void> => {
  return signOut(auth);
};

/**
 * Listens for changes in the user's authentication state.
 * @param callback Function to call when the auth state changes.
 *                 It receives the User object or null.
 * @returns An unsubscribe function to stop listening.
 */
const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Gets the currently signed-in user.
 * @returns The current User object or null.
 */
const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Gets the ID token for the currently signed-in user.
 * @param forceRefresh If true, forces a refresh of the token.
 * @returns A promise that resolves with the ID token string, or null if no user is signed in.
 */
const getAuthToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  const user = auth.currentUser;
  if (user) {
    try {
      // Pass the forceRefresh flag to getIdToken
      console.log(`Getting auth token (force refresh: ${forceRefresh})`); // Log forceRefresh status
      const token = await getIdToken(user, forceRefresh);
      return token;
    } catch (error) {
      console.error("Error getting auth token:", error);
      // Handle specific errors like 'auth/user-token-expired' if needed
      // Type guard for FirebaseError
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-token-expired') {
        console.warn("User token expired, attempting refresh...");
        try {
          const refreshedToken = await getIdToken(user, true); // Attempt refresh on expiry
          return refreshedToken;
        } catch (refreshError) {
          console.error("Error refreshing expired token:", refreshError);
          return null;
        }
      }
      return null;
    }
  }
  return null;
};

/**
 * Gets the custom claims for the currently signed-in user.
 * This requires parsing the ID token.
 * @param forceRefresh Whether to force refresh the token (defaults to true to ensure latest claims)
 * @returns A promise that resolves with the custom claims object, or null if no user is signed in or token fails to parse.
 */
const getUserClaims = async (): Promise<Record<string, unknown> | null> => {
    const user = getCurrentUser();
    if (user) {
        try {
            const idTokenResult = await user.getIdTokenResult(false); // Don't force refresh by default here
            return idTokenResult.claims;
        } catch (error) {
            console.error("Error getting user claims:", error);
            // Type guard for FirebaseError
            // Check if error is an object with a 'code' property
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-token-expired') {
                 console.warn("User token expired when getting claims, needs refresh/re-login.");
            }
            return null;
        }
    } else {
        return null;
    }
};

// Get the current user's ID token result (includes claims)
const getIdTokenResult = async (forceRefresh: boolean = false): Promise<IdTokenResult | null> => {
    const user = auth.currentUser;
    if (user) {
        try {
            // Pass the forceRefresh flag to getIdTokenResult
            console.log(`Getting ID token result (force refresh: ${forceRefresh})`); // Log forceRefresh status
            const tokenResult = await user.getIdTokenResult(forceRefresh);
            console.log("User Claims from getIdTokenResult:", tokenResult.claims); // Log claims when token result is fetched
            return tokenResult;
        } catch (error) {
            console.error("Error getting ID token result:", error);
             // Handle specific errors like 'auth/user-token-expired' if needed
            // Type guard for FirebaseError
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-token-expired') {
              console.warn("User token expired, attempting refresh for result...");
              try {
                const refreshedTokenResult = await user.getIdTokenResult(true); // Attempt refresh on expiry
                console.log("Refreshed User Claims:", refreshedTokenResult.claims);
                return refreshedTokenResult;
              } catch (refreshError) {
                console.error("Error refreshing expired token for result:", refreshError);
                return null;
              }
            }
            return null;
        }
    }
    return null;
};

// Get current user claims (potentially refreshed)
const getCurrentUserClaims = async (): Promise<Record<string, unknown> | null> => {
    // Always force refresh when explicitly asking for current claims
    const tokenResult = await getIdTokenResult(true);
    return tokenResult ? tokenResult.claims : null;
};

export const authService = {
  login,
  logout,
  onAuthStateChange,
  getCurrentUser,
  getAuthToken,
  getUserClaims,
  getIdTokenResult,
  getCurrentUserClaims,
}; 