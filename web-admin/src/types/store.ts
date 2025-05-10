export type StoreStatus = 'active' | 'inactive' | 'temporary_closed' | 'permanently_closed';

export interface StoreLocation {
  latitude: number;
  longitude: number;
}

export interface StoreAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  fullAddress?: string; // 完整地址（用於顯示）
}

export interface StoreContactInfo {
  email?: string;
  phone?: string;
  managerId?: string;
  managerName?: string; // 店長姓名（用於顯示）
}

export interface StoreOperatingHours {
  day: number; // 0-6, 0=星期日
  isOpen: boolean;
  openTime?: string; // 格式："HH:MM" 24小時制
  closeTime?: string; // 格式："HH:MM" 24小時制
}

export interface StoreGpsFence {
  enabled: boolean;
  radius?: number; // 單位：公尺
  center?: StoreLocation;
}

export interface StorePrinterSettings {
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  printerType?: 'thermal' | 'label' | 'normal';
  templates?: {
    receipt?: string;
    kitchen?: string;
    takeout?: string;
  };
}

export interface Store {
  id: string;
  tenantId: string;
  name: string;
  storeCode?: string;
  description?: string;
  status: StoreStatus;
  address?: StoreAddress;
  location?: StoreLocation;
  contactInfo?: StoreContactInfo;
  operatingHours?: StoreOperatingHours[];
  gpsFence?: StoreGpsFence;
  printerSettings?: StorePrinterSettings;
  createdAt: string;
  updatedAt: string;
} 