import { OrderPayload } from './orderService'; // Assuming OrderPayload is relevant and exported
import { CartItem } from '@/hooks/useCart'; // Import CartItem type

const API_BASE_URL = '/api/v2/payments';

export interface LinePayRequestPayload {
  originalSystemOrderId: string; // Renamed from orderId for clarity, this is OUR system's order ID
  amount: number;
  productName?: string; // Optional: Can be derived or fixed for LINE Pay display
  items?: CartItem[]; // Add items for detailed package creation
  confirmUrl: string; // URL for successful payment redirect
  cancelUrl: string;  // URL for cancelled payment redirect
}

export interface LinePayRequestResponse {
  success: boolean;
  paymentUrl?: string;     // Simulated LINE Pay URL
  transactionId?: string;  // Simulated transaction ID from LINE Pay
  message?: string;
}

export const initiateLinePayPayment = async (
  payload: LinePayRequestPayload,
  idToken: string | null
): Promise<LinePayRequestResponse> => {
  if (!idToken) {
    return {
      success: false,
      message: "ID token is required for initiating LINE Pay payment.",
    };
  }

  try {
    const response = await fetch("/api/v2/payments/line/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        originalSystemOrderId: payload.originalSystemOrderId,
        amount: payload.amount,
        productName: payload.productName || `Order ${payload.originalSystemOrderId}`,
        items: payload.items, // Pass items to backend
        confirmUrl: payload.confirmUrl, // Pass confirmUrl to backend
        cancelUrl: payload.cancelUrl,   // Pass cancelUrl to backend
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Failed to parse error response"}));
      throw new Error(errorData.message || `LINE Pay request failed: ${response.status}`);
    }

    return await response.json() as LinePayRequestResponse;
  } catch (error: any) {
    console.error("Error initiating LINE Pay payment:", error);
    return {
      success: false,
      message: error.message || "An unexpected error occurred during LINE Pay initiation.",
    };
  }
}; 