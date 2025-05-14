import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser, // Import FirebaseUser for type consistency
} from 'firebase/auth';
import { app } from '@/config/firebaseConfig'; // Assuming firebase app is initialized here

const auth = getAuth(app);

let confirmationResultHolder: ConfirmationResult | null = null;
let recaptchaVerifierHolder: RecaptchaVerifier | null = null;

// Ensure reCAPTCHA is rendered only once or handled if re-rendered.
export const initializeRecaptchaVerifier = (containerId: string): RecaptchaVerifier => {
  if (recaptchaVerifierHolder) {
    // Potentially clear previous instance if re-initializing is problematic, or ensure it's a singleton.
    // For simplicity, this example reuses or creates new if null.
    // In a real app, you might need to unmount/destroy the old one if containerId changes or on component unmount.
  }
  // Ensure the container is empty or properly managed if re-initializing
  const recaptchaContainer = document.getElementById(containerId);
  if (!recaptchaContainer) {
    throw new Error(`reCAPTCHA container with id '${containerId}' not found.`);
  }
  
  recaptchaVerifierHolder = new RecaptchaVerifier(auth, containerId, {
    'size': 'invisible',
    'callback': (response: any) => {
      // reCAPTCHA solved, allow signInWithPhoneNumber.
      // This callback is for a visible reCAPTCHA, for invisible it's typically not needed to be handled explicitly here.
      console.log("reCAPTCHA solved", response);
    },
    'expired-callback': () => {
      // Response expired. Ask user to solve reCAPTCHA again.
      console.log("reCAPTCHA expired");
      // Potentially reset reCAPTCHA or prompt user
    }
  });
  return recaptchaVerifierHolder;
};

export const sendOtp = async (phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<void> => {
  try {
    confirmationResultHolder = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    console.log('OTP sent to', phoneNumber);
  } catch (error) {
    console.error('Error sending OTP:', error);
    // Handle specific errors, e.g., auth/invalid-phone-number
    // Reset reCAPTCHA if necessary, especially for visible reCAPTCHA errors
    // appVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
    throw error;
  }
};

export const confirmOtp = async (otp: string): Promise<FirebaseUser> => {
  if (!confirmationResultHolder) {
    throw new Error('Confirmation result not available. Please send OTP first.');
  }
  try {
    const result = await confirmationResultHolder.confirm(otp);
    confirmationResultHolder = null; // Clear after use
    console.log('Phone number verified successfully');
    return result.user;
  } catch (error) {
    console.error('Error confirming OTP:', error);
    // Handle specific errors, e.g., auth/invalid-verification-code, auth/code-expired
    throw error;
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const onAuthStateChangedListener = (callback: (user: FirebaseUser | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

// Helper to get current user, though onAuthStateChangedListener is preferred for reacting to changes
export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

// It might be useful to also export a function to clear the reCAPTCHA verifier
// especially in SPAs when the component holding it unmounts.
export const clearRecaptchaVerifier = () => {
    if (recaptchaVerifierHolder) {
        // @ts-ignore // clear might not be in public d.ts but exists
        recaptchaVerifierHolder.clear(); 
        recaptchaVerifierHolder = null;
        console.log('reCAPTCHA verifier cleared.');
    }
    // Also remove the reCAPTCHA widget from the DOM if it was visible and managed manually
    const recaptchaContainer = document.getElementById('recaptcha-container'); // Or whatever ID used
    if (recaptchaContainer) {
        // recaptchaContainer.innerHTML = ''; // This might be too aggressive depending on how reCAPTCHA is added
    }
}; 