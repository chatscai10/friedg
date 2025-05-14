export interface User {
  uid: string;
  phoneNumber: string | null;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  // Add other user-specific fields as needed, e.g., roles for PWA if any
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
} 