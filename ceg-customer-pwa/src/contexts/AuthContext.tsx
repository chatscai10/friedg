import React, { createContext, useState, ReactNode, useMemo, useCallback, useEffect } from 'react';
import { User as LocalUser } from '@/types/auth.types'; // Renamed to LocalUser to avoid clash with FirebaseUser
import {
  initializeRecaptcha as initRecaptcha,
  sendOtp as firebaseSendOtp,
  confirmOtp as firebaseConfirmOtp,
  signOutUser as firebaseSignOutUser,
  onAuthStateChangedListener,
  clearRecaptchaVerifier,
  // We will use FirebaseUser from firebase/auth directly where needed, or map to LocalUser
} from '@/services/authService';
import { RecaptchaVerifier, User as FirebaseUser, getAuth } from 'firebase/auth';
import { app, db as firestore, getAndRegisterFcmToken } from '@/config/firebase'; // Import firestore and app
import { useNotification } from './NotificationContext'; // Import useNotification
import { collection, query, where, onSnapshot, Timestamp, DocumentData } from 'firebase/firestore'; // Firebase SDK
import { Order } from '@/services/orderService'; // Assuming Order type is here

interface AuthContextType {
  isAuthenticated: boolean;
  user: LocalUser | null; // Use our LocalUser type
  loading: boolean;
  error: string | null;
  isOtpSent: boolean;
  // Functions for phone auth flow
  initializeRecaptcha: (containerId: string) => RecaptchaVerifier | null;
  sendOtp: (phoneNumber: string, appVerifier: RecaptchaVerifier) => Promise<void>;
  confirmOtp: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  currentUserToken: () => Promise<string | null>; // Added to get ID token
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Helper to map FirebaseUser to our LocalUser type
const mapFirebaseUserToLocalUser = (firebaseUser: FirebaseUser): LocalUser => {
  return {
    uid: firebaseUser.uid,
    phoneNumber: firebaseUser.phoneNumber,
    displayName: firebaseUser.displayName,
    email: firebaseUser.email,
    photoURL: firebaseUser.photoURL,
  };
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true); // Start with loading true until auth state is checked
  const [error, setError] = useState<string | null>(null);
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [appVerifier, setAppVerifier] = useState<RecaptchaVerifier | null>(null);
  const { addNotification } = useNotification(); // Get addNotification function
  const [previousOrdersStatus, setPreviousOrdersStatus] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const authUnsubscribe = onAuthStateChangedListener(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser(mapFirebaseUserToLocalUser(firebaseUser));
        setIsAuthenticated(true);
        // Attempt to register FCM token when auth state changes to logged in
        try {
          await getAndRegisterFcmToken(firebaseUser.uid);
        } catch (tokenError) {
          console.error("Error registering FCM token on auth state change:", tokenError);
          // Optionally notify user or log further
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsOtpSent(false);
        setPreviousOrdersStatus(new Map()); // Clear previous statuses on logout
      }
      setLoading(false);
    });

    // Cleanup auth subscription on unmount
    return () => {
        authUnsubscribe();
        clearRecaptchaVerifier(); // Clean up reCAPTCHA when provider unmounts
    };
  }, []);

  // Effect for order status listener
  useEffect(() => {
    let ordersUnsubscribe: (() => void) | undefined = undefined;
    let localPreviousOrdersStatus = new Map<string, string>(); // Use a local map inside the effect

    if (isAuthenticated && user) {
      const q = query(
        collection(firestore, 'orders'),
        where('customerId', '==', user.uid),
        // Listen to orders that are not yet in a final state
        where('status', 'in', ['pending', 'confirmed', 'preparing', 'ready_for_pickup']) 
      );

      ordersUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const currentOrdersStatus = new Map<string, string>();
        querySnapshot.forEach((doc) => {
          const orderData = doc.data() as Order;
          currentOrdersStatus.set(doc.id, orderData.status);

          const previousStatus = localPreviousOrdersStatus.get(doc.id); // Use local map here
          if (orderData.status === 'ready_for_pickup' && previousStatus !== 'ready_for_pickup') {
            // Basic check to avoid notification if user is already on the order status page for this order.
            // This is a simple check and might need refinement.
            if (!window.location.pathname.includes(`/order/${doc.id}`)) {
                 addNotification(`您的訂單 #${doc.id.substring(0,6)} 已準備好取餐！`, 'success');
            }
          }
          // Add more notifications for other status changes if needed
        });
        // setPreviousOrdersStatus(currentOrdersStatus); // No longer needed to set in context state if only used here
        localPreviousOrdersStatus = currentOrdersStatus; // Update local map
      }, (err) => {
        console.error("Error listening to order status:", err);
        // Optionally notify user about the error in listening
        // addNotification('無法即時更新訂單狀態，請稍後再試。', 'error');
      });
    }

    return () => {
      if (ordersUnsubscribe) {
        ordersUnsubscribe();
      }
    };
  }, [isAuthenticated, user, addNotification]); // Removed previousOrdersStatus from dependencies

  const initializeRecaptcha = useCallback((containerId: string): RecaptchaVerifier | null => {
    try {
      const verifier = initRecaptcha(containerId);
      setAppVerifier(verifier);
      // addNotification('reCAPTCHA 初始化成功', 'info', 2000);
      return verifier;
    } catch (e: any) {
      console.error("Recaptcha init error:", e);
      const msg = e.message || 'Failed to initialize reCAPTCHA.';
      setError(msg); // Keep local error for pages that might use it directly
      addNotification(msg, 'error');
      setAppVerifier(null);
      return null;
    }
  }, [addNotification]);

  const sendOtp = useCallback(async (phoneNumber: string, verifier: RecaptchaVerifier) => {
    setLoading(true);
    setError(null);
    try {
      await firebaseSendOtp(phoneNumber, verifier || appVerifier! );
      setIsOtpSent(true);
      addNotification('驗證碼已發送，請查收。', 'success');
    } catch (e: any) {
      console.error("Send OTP error:", e);
      const msg = e.message || 'Failed to send OTP.';
      setError(msg);
      addNotification(msg, 'error');
      setIsOtpSent(false);
    } finally {
      setLoading(false);
    }
  }, [appVerifier, addNotification]);

  const confirmOtp = useCallback(async (otp: string) => {
    setLoading(true);
    setError(null);
    try {
      const firebaseUser = await firebaseConfirmOtp(otp);
      setUser(mapFirebaseUserToLocalUser(firebaseUser));
      setIsAuthenticated(true);
      setIsOtpSent(false); 
      addNotification('登入成功！', 'success');

      // Attempt to register FCM token after successful OTP confirmation
      try {
        await getAndRegisterFcmToken(firebaseUser.uid);
      } catch (tokenError) {
        console.error("Error registering FCM token after OTP confirmation:", tokenError);
        // Optionally notify user or log further
      }

    } catch (e: any) {
      console.error("Confirm OTP error:", e);
      const msg = e.message || 'Failed to confirm OTP.';
      setError(msg);
      addNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOutUser();
      addNotification('您已成功登出。', 'info');
      // setIsAuthenticated and setUser will be handled by onAuthStateChangedListener
    } catch (e: any) {
      console.error("Logout error:", e);
      const msg = e.message || 'Failed to logout.';
      setError(msg);
      addNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

 const currentUserToken = useCallback(async (): Promise<string | null> => {
    const auth = getAuth(app); // Get auth instance from firebaseConfig
    if (auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken(true); // Force refresh true
      } catch (error) {
        console.error("Error getting ID token:", error);
        return null;
      }
    }
    return null;
  }, []);

  const contextValue = useMemo(() => ({
    isAuthenticated,
    user,
    loading,
    error,
    isOtpSent,
    initializeRecaptcha,
    sendOtp,
    confirmOtp,
    logout,
    currentUserToken,
  }), [isAuthenticated, user, loading, error, isOtpSent, initializeRecaptcha, sendOtp, confirmOtp, logout, currentUserToken]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}; 