export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  tenantId: string; // Assuming multi-tenant or general identifier
}

export interface MenuItem {
  id: string;
  tenantId: string;
  categoryId: string;
  categoryName?: string; // Denormalized for easier display
  name: string;
  description: string;
  price: number;
  imageUrl?: string; // Placeholder for actual image URL from Firebase Storage
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  isRecommended?: boolean;
  isSpecial?: boolean;
  isActive?: boolean;
  tags?: string[];
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    allergens?: string[];
  };
  optionGroups?: OptionGroup[]; // Added optionGroups
  // Add other fields as necessary based on your design
}

// Added OptionGroup and OptionChoice interfaces
export interface OptionChoice {
  name: string;         // e.g., "小辣", "大杯"
  value: string;        // e.g., "mild", "large" (for programmatic use)
  priceAdjustment?: number; // e.g., 0, 10 (for +$10)
  isDefault?: boolean;
}

export interface OptionGroup {
  id: string;           // e.g., "spice-level", "size"
  name: string;         // e.g., "辣度選擇", "份量"
  type: 'single' | 'multiple'; // Whether user can select one or many from this group
  isRequired?: boolean;
  options: OptionChoice[];
} 