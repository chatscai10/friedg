// 檔案路徑: web-admin/src/types/api.types.ts
export interface PaginationMeta {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  itemCount?: number; // 可選，根據API規格
}

export interface ApiLinks {
  first?: string;
  last?: string;
  prev?: string;
  next?: string;
}

declare module 'axios' {
  export interface AxiosResponse<T = any, D = any> {
    $meta?: PaginationMeta; 
    $links?: ApiLinks;   
  }
}

export interface ApiError { 
  code: string;
  message: string;
  details?: string;
  timestamp: string;
  path: string;
  stack?: string;
}

export interface ApiErrorResponseData {
  status: 'error' | 'fail';
  message: string;
  code?: string; 
  error?: ApiError; 
  errors?: ApiError[]; 
  details?: string | Record<string, any>; 
  timestamp?: string;
  path?: string;
} 