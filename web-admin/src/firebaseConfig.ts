import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore"; // Uncomment if you need Firestore in the frontend
// import { getFunctions } from "firebase/functions"; // Uncomment if you need to call Cloud Functions directly

// Your web app's Firebase configuration
// IMPORTANT: Replace with your actual config values, preferably from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
// const firestore = getFirestore(app); // Uncomment if needed
// const functions = getFunctions(app); // Uncomment if needed

// Optionally configure emulators if running locally
// IMPORTANT: Make sure the ports match your firebase.json emulator settings
if (import.meta.env.DEV) {
  try {
    console.log("Connecting to Firebase Emulators...");
    // connectAuthEmulator(auth, "http://localhost:9199", { disableWarnings: true });
    // connectFirestoreEmulator(firestore, 'localhost', 9283);
    // connectFunctionsEmulator(functions, 'localhost', 5101);
    // Note: For Auth emulator, you often need to connect manually in your auth logic
    // rather than globally here, especially if using signInWithPopup/Redirect.
    // We will connect Auth emulator later in authService.ts if needed.
    console.log("Potential Emulator connections configured (check ports!). Auth connection deferred.");

  } catch (error) {
     console.error("Error connecting to Firebase Emulators: ", error);
  }
}


export { app, auth }; // Export necessary instances
// export { app, auth, firestore, functions }; // Export all if needed 