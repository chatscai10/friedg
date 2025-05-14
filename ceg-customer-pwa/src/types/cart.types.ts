export interface CartItemOption {
  name: string;
  value: string;
  priceAdjustment?: number; // Optional price adjustment for this option
}

export interface CartItem {
  id: string; // This would typically be the MenuItem's ID
  name: string;
  price: number; // Unit price at the time of adding to cart
  quantity: number;
  imageUrl?: string;
  selectedOptions?: CartItemOption[]; // For customizable items
  // Add any other relevant item details you need to store in the cart
}

export interface CartState {
  items: CartItem[];
  // We can add other cart-level properties here later, e.g., discount codes, applied promotions
} 