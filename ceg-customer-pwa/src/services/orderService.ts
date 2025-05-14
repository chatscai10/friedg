import { CartItem } from "@/types/cart.types";
import { OrderStatus } from "@/types/order.types";

// This interface defines the customer-provided information at checkout
interface CustomerCheckoutInfo {
  name: string;        // Name provided in the checkout form
  phone: string;      // Contact phone for this specific order, from checkout form
  pickupTime?: string; // Desired pickup time, if applicable
  notes?: string;      // Any special notes for the order
}

// This interface defines the full payload to be sent to the createOrderV2 Cloud Function
export interface OrderPayload {
  items: CartItem[];
  totalAmount: number;
  customerInfo: CustomerCheckoutInfo; // Details collected from the checkout form
  paymentMethod: string;             // e.g., 'cash', 'credit_card', 'line_pay'
  pickupMethod: string;              // e.g., 'takeaway', 'delivery'
}

// This interface defines the expected structure of a successful response from createOrderV2
export interface SubmitOrderApiResponse {
  message: string;
  orderId: string;
  orderDetails: any; // Could be a more specific Order type if defined and needed
}

// This interface is for the service function's return, incorporating success status
export interface SubmitOrderResult {
  success: boolean;
  orderId?: string;
  message?: string;
  // orderDetails?: any; // Can be added if CheckoutPage needs full order details back
}

const API_BASE_URL = '/api/v2'; // Define your API base URL if not already globally configured

export const submitOrder = async (
  payload: OrderPayload,
  idToken: string | null // ID token for authentication
): Promise<SubmitOrderResult> => {
  console.log("Submitting order to backend with payload:", payload);

  if (!idToken) {
    console.error("Order submission failed: User is not authenticated.");
    return {
      success: false,
      message: "用戶未認證，無法提交訂單。",
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData: SubmitOrderApiResponse | { error: string } = await response.json();

    if (response.ok && 'orderId' in responseData) {
      console.log(`Order submitted successfully. Order ID: ${responseData.orderId}`);
      return {
        success: true,
        orderId: responseData.orderId,
        message: responseData.message,
      };
    } else {
      const errorMsg = ('message' in responseData ? responseData.message : ('error' in responseData ? responseData.error : '未知錯誤')) || '訂單提交失敗';
      console.error("Order submission failed:", errorMsg, responseData);
      return {
        success: false,
        message: errorMsg,
      };
    }
  } catch (error: any) {
    console.error("Network or other error during order submission:", error);
    return {
      success: false,
      message: error.message || "提交訂單時發生網絡錯誤，請稍後再試。",
    };
  }
};

// Define a basic Order type for the frontend, can be expanded
export interface Order {
  id: string; // Corresponds to orderId from backend
  customerId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  items: CartItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: string;
  pickupMethod: string;
  pickupTime?: string | null;
  orderNotes?: string | null;
  createdAt: any; // Firestore Timestamp, or string/number if converted
  updatedAt: any; // Firestore Timestamp, or string/number if converted
  orderNumber?: string;
  storeId?: string;
  // Any other fields returned by the backend
}

export interface GetMyOrdersResponse {
  success: boolean;
  data?: Order[];
  message?: string;
}

export interface GetOrderDetailsResponse {
  success: boolean;
  data?: Order;
  message?: string;
}

export const getMyOrders = async (idToken: string | null): Promise<GetMyOrdersResponse> => {
  if (!idToken) {
    return { success: false, message: '用戶未認證，無法獲取訂單列表。' };
  }
  try {
    const response = await fetch(`${API_BASE_URL}/myorders`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });
    const responseData = await response.json();
    if (response.ok) {
      return { success: true, data: responseData.data as Order[] };
    } else {
      return { success: false, message: responseData.error || responseData.message || '獲取訂單列表失敗' };
    }
  } catch (error: any) {
    console.error("Error fetching user orders:", error);
    return { success: false, message: error.message || '獲取訂單列表時發生網絡錯誤。' };
  }
};

export const getOrderDetails = async (orderId: string, idToken: string | null): Promise<GetOrderDetailsResponse> => {
  if (!idToken) {
    return { success: false, message: '用戶未認證，無法獲取訂單詳情。' };
  }
  if (!orderId) {
    return { success: false, message: '未提供訂單ID。' };
  }
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
      },
    });
    const responseData = await response.json();
    if (response.ok) {
      return { success: true, data: responseData.data as Order };
    } else {
      return { success: false, message: responseData.error || responseData.message || '獲取訂單詳情失敗' };
    }
  } catch (error: any) {
    console.error("Error fetching order details:", error);
    return { success: false, message: error.message || '獲取訂單詳情時發生網絡錯誤。' };
  }
}; 