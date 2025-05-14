/**
 * Store API 適配層
 *
 * 此文件實現內部模型與API規範模型之間的轉換邏輯
 * 用於解決API規範與實際實現之間的結構和欄位命名差異
 */

import {
  Store,
  CreateStoreRequest,
  UpdateStoreRequest,
  UpdateStoreStatusRequest,
  GPSFenceRequest,
  PrinterConfigRequest
} from './stores.types';

/**
 * API規範中的店鋪狀態枚舉
 */
export type ApiStoreStatus = 'active' | 'inactive' | 'temporary_closed' | 'permanently_closed';

/**
 * API規範中的店鋪模型
 */
export interface ApiStore {
  id: string;
  name: string;
  storeCode: string;
  status: ApiStoreStatus;
  tenantId: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  contactInfo?: {
    email?: string;
    phone?: string;
    contactPerson?: string;
  };
  operatingHours?: Array<{
    day: number;
    isOpen: boolean;
    openTime?: string;
    closeTime?: string;
  }>;
  gpsFence?: {
    enabled: boolean;
    radius: number;
    center: {
      latitude: number;
      longitude: number;
    };
  };
  printerSettings?: {
    enabled: boolean;
    apiUrl?: string;
    apiKey?: string;
    printerType?: string;
    templates?: {
      receipt?: string;
      kitchen?: string;
      takeout?: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * API規範中的創建店鋪請求
 */
export interface ApiCreateStoreRequest {
  name: string;
  storeCode: string;
  tenantId: string;
  status: ApiStoreStatus;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
  contactInfo?: {
    email?: string;
    phone?: string;
    contactPerson?: string;
  };
  // 其他欄位...
}

/**
 * API規範中的更新店鋪請求
 */
export interface ApiUpdateStoreRequest {
  name?: string;
  storeCode?: string;
  status?: ApiStoreStatus;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  contactInfo?: {
    email?: string;
    phone?: string;
    contactPerson?: string;
  };
  // 其他欄位...
}

/**
 * API規範中的更新店鋪狀態請求
 */
export interface ApiUpdateStoreStatusRequest {
  status: ApiStoreStatus;
  reason?: string;
}

/**
 * 將API模型狀態轉換為內部模型狀態
 */
export function mapApiStatusToInternal(status: ApiStoreStatus): { isActive: boolean, isDeleted?: boolean } {
  switch (status) {
    case 'active':
      return { isActive: true };
    case 'inactive':
      return { isActive: false };
    case 'temporary_closed':
      return { isActive: false };
    case 'permanently_closed':
      return { isActive: false, isDeleted: true };
    default:
      return { isActive: true };
  }
}

/**
 * 將內部模型狀態轉換為API模型狀態
 */
export function mapInternalStatusToApi(isActive: boolean, isDeleted?: boolean): ApiStoreStatus {
  if (isDeleted) {
    return 'permanently_closed';
  }

  if (isActive) {
    return 'active';
  }

  return 'inactive';
}

/**
 * 將API創建店鋪請求轉換為內部創建請求
 */
export function fromApiCreateRequest(apiRequest: ApiCreateStoreRequest): CreateStoreRequest {
  const statusProps = mapApiStatusToInternal(apiRequest.status);

  return {
    name: apiRequest.name,
    storeCode: apiRequest.storeCode,
    tenantId: apiRequest.tenantId,
    status: apiRequest.status,
    address: apiRequest.address,
    location: apiRequest.location,
    contactInfo: apiRequest.contactInfo ? {
      email: apiRequest.contactInfo.email,
      phone: apiRequest.contactInfo.phone,
      managerId: apiRequest.contactInfo.contactPerson
    } : undefined,
    settings: {}
  };
}

/**
 * 將API更新店鋪請求轉換為內部更新請求
 */
export function fromApiUpdateRequest(apiRequest: ApiUpdateStoreRequest): UpdateStoreRequest {
  const result: UpdateStoreRequest = {};

  if (apiRequest.name !== undefined) {
    result.name = apiRequest.name;
  }

  if (apiRequest.storeCode !== undefined) {
    result.storeCode = apiRequest.storeCode;
  }

  if (apiRequest.status !== undefined) {
    result.status = apiRequest.status;
  }

  if (apiRequest.address !== undefined) {
    result.address = apiRequest.address;
  }

  if (apiRequest.contactInfo !== undefined) {
    result.contactInfo = {};

    if (apiRequest.contactInfo.email !== undefined) {
      result.contactInfo.email = apiRequest.contactInfo.email;
    }

    if (apiRequest.contactInfo.phone !== undefined) {
      result.contactInfo.phone = apiRequest.contactInfo.phone;
    }

    if (apiRequest.contactInfo.contactPerson !== undefined) {
      result.contactInfo.managerId = apiRequest.contactInfo.contactPerson;
    }
  }

  // 其他欄位可根據需要轉換...

  return result;
}

/**
 * 將API更新店鋪狀態請求轉換為內部更新狀態請求
 */
export function fromApiStatusUpdateRequest(apiRequest: ApiUpdateStoreStatusRequest): UpdateStoreStatusRequest {
  const statusProps = mapApiStatusToInternal(apiRequest.status);
  return {
    isActive: statusProps.isActive
  };
}

/**
 * 將內部店鋪模型轉換為API店鋪模型
 */
export function toApiStore(internalStore: Store): ApiStore {
  return {
    id: internalStore.storeId,
    name: internalStore.name,
    storeCode: internalStore.storeCode,
    status: internalStore.status || 'active',
    tenantId: internalStore.tenantId,
    address: internalStore.address,
    location: internalStore.location,
    contactInfo: internalStore.contactInfo ? {
      email: internalStore.contactInfo.email,
      phone: internalStore.contactInfo.phone,
      contactPerson: internalStore.contactInfo.managerId
    } : undefined,
    gpsFence: internalStore.gpsFence ? {
      enabled: internalStore.gpsFence.enabled,
      radius: internalStore.gpsFence.radius,
      center: {
        latitude: internalStore.gpsFence.center.latitude,
        longitude: internalStore.gpsFence.center.longitude
      }
    } : undefined,
    printerSettings: internalStore.printerSettings,
    createdAt: typeof internalStore.createdAt === 'string' ?
      internalStore.createdAt :
      undefined,
    updatedAt: typeof internalStore.updatedAt === 'string' ?
      internalStore.updatedAt :
      undefined
  };
}

/**
 * 將內部店鋪模型數組轉換為API店鋪模型數組
 */
export function toApiStores(internalStores: Store[]): ApiStore[] {
  return internalStores.map(toApiStore);
}