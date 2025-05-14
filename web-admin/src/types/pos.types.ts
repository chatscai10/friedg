export interface PosOrderItem {
  id: string; // Typically the menu item's ID
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number; // Calculated as unitPrice * quantity
  // Add other details like selected options, discounts applied to this item, etc.
}

export interface PosOrder {
  items: PosOrderItem[];
  totalAmount: number;
  // customerId?: string;
  // orderType?: 'dine-in' | 'take-away' | 'delivery';
  // status?: string; 
  // ... other order level details
} 