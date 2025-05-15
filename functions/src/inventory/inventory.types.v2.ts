import { z } from 'zod';

export interface StockItem {
  menuItemId: string;
  quantityToDeduct: number;
}

// Schema for stock deduction payload if it were an API
export const DeductStockPayloadSchema = z.object({
  orderId: z.string(), // For context/logging
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number().int().positive(),
  })).min(1),
});
export type DeductStockPayload = z.infer<typeof DeductStockPayloadSchema>;

export interface MenuItemStockDoc {
  // Assuming structure in menuItems collection
  name: string;
  manageStock: boolean;
  stock: {
    current: number;
    lowStockThreshold?: number;
  };
  // other fields...
}

// Custom error for Inventory service
export class InventoryServiceError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: any; // e.g., { itemId: string, reason: 'insufficient_stock' | 'not_found' }

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
} 