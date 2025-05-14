import { functions } from '@/config/firebase'; // Assuming this is your Firebase app instance
import { httpsCallable } from 'firebase/functions';

// Types for user management - consider moving to a common types file e.g., admin.types.ts
export interface AdminUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  disabled: boolean;
  emailVerified: boolean;
  customClaims?: { [key: string]: any };
  metadata: {
    lastSignInTime?: string;
    creationTime?: string;
  };
}

export interface ListUsersResponse {
  success: boolean;
  users: AdminUser[];
  nextPageToken?: string;
  message?: string;
  error?: string;
}

export interface SetUserRolePayload {
  userId: string;
  role: string;
}

export interface SetUserRoleResponse {
  success: boolean;
  message: string;
}

/**
 * Lists users with pagination support.
 * Requires the calling user to be an admin with a valid ID token.
 */
export const listUsers = async (
  idToken: string | null,
  maxResults: number = 50,
  pageToken?: string
): Promise<ListUsersResponse> => {
  if (!idToken) {
    return {
      success: false,
      users: [],
      message: "ID token is required to list users.",
    };
  }

  try {
    let url = `/api/v2/admin/users?maxResults=${maxResults}`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return await response.json() as ListUsersResponse;
  } catch (error: any) {
    console.error('Error listing users:', error);
    return {
      success: false,
      users: [],
      message: error.message || 'An unexpected error occurred while listing users.',
      error: error.toString(),
    };
  }
};

/**
 * Calls the setUserRoleV2 Firebase Callable Function.
 * Requires the calling user to be an admin.
 */
export const setUserRole = async (payload: SetUserRolePayload): Promise<SetUserRoleResponse> => {
  try {
    const setUserRoleCallable = httpsCallable<SetUserRolePayload, SetUserRoleResponse>(functions, 'setUserRoleV2');
    const result = await setUserRoleCallable(payload);
    return result.data;
  } catch (error: any) {
    console.error('Error setting user role via callable function:', error);
    // Firebase callable functions throw HttpsError which has a message property
    const errorMessage = error.message || 'An unexpected error occurred.'; 
    return {
      success: false,
      message: `Failed to set user role: ${errorMessage}`,
    };
  }
}; 