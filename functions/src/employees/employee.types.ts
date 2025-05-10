import { Timestamp } from 'firebase-admin/firestore';

export interface Employee {
  employeeId: string;
  userId?: string;  // 關聯的 Firebase Auth User ID
  tenantId: string;
  storeId: string;
  additionalStoreIds?: string[];
  employeeCode?: string;
  firstName: string;
  lastName: string;
  displayName?: string; // 顯示名稱 (fullName)
  position: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern' | 'temporary';
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  hireDate?: string | null;  // ISO 日期格式 (YYYY-MM-DD)
  terminationDate?: string | null;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
  };
  photoURL?: string;
  idNumber?: string;
  birthDate?: string;
  gender?: string;
  schedule?: {
    preferredShifts?: Array<'morning' | 'afternoon' | 'evening' | 'night'>;
    maxHoursPerWeek?: number;
    daysUnavailable?: number[];  // 0-6 (週日-週六)
  };
  employmentInfo?: {
    roleId?: string;
    roleName?: string;
    roleLevel: number; // 1-10, 1=最低, 10=最高
  };
  payInfo?: {
    hourlyRate?: number;
    baseSalary?: number;
    salaryType?: 'hourly' | 'monthly' | 'annual';
    bankAccount?: string;
    bankName?: string;
    accountName?: string;
  };
  quietHours?: {
    enabled: boolean;
    startTime: string;  // HH:MM 格式
    endTime: string;    // HH:MM 格式
  };
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
  createdBy?: string;
  updatedBy?: string;
  isApproved?: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp | string;
}

// 創建員工時的請求體
export interface CreateEmployeeRequest {
  userId?: string;
  tenantId: string;
  storeId: string;
  additionalStoreIds?: string[];
  employeeCode?: string;
  firstName: string;
  lastName: string;
  position: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern' | 'temporary';
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  hireDate?: string;
  terminationDate?: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
  };
  photoURL?: string;
  schedule?: {
    preferredShifts?: Array<'morning' | 'afternoon' | 'evening' | 'night'>;
    maxHoursPerWeek?: number;
    daysUnavailable?: number[];
  };
  employmentInfo?: {
    roleId?: string;
    roleName?: string;
    roleLevel: number;
  };
  payInfo?: {
    hourlyRate?: number;
    baseSalary?: number;
    salaryType?: 'hourly' | 'monthly' | 'annual';
    bankAccount?: string;
    bankName?: string;
    accountName?: string;
  };
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

// 更新員工時的請求體 (部分欄位)
export interface UpdateEmployeeRequest {
  firstName?: string;
  lastName?: string;
  storeId?: string;
  additionalStoreIds?: string[];
  position?: string;
  employmentType?: 'full_time' | 'part_time' | 'contract' | 'intern' | 'temporary';
  status?: 'active' | 'inactive' | 'on_leave' | 'terminated';
  hireDate?: string;
  terminationDate?: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
  };
  photoURL?: string;
  schedule?: {
    preferredShifts?: Array<'morning' | 'afternoon' | 'evening' | 'night'>;
    maxHoursPerWeek?: number;
    daysUnavailable?: number[];
  };
  employmentInfo?: {
    roleId?: string;
    roleName?: string;
    roleLevel?: number;
  };
  payInfo?: {
    hourlyRate?: number;
    baseSalary?: number;
    salaryType?: 'hourly' | 'monthly' | 'annual';
    bankAccount?: string;
    bankName?: string;
    accountName?: string;
  };
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

// 查詢員工時的過濾條件
export interface EmployeeFilter {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: 'active' | 'inactive' | 'on_leave' | 'terminated';
  storeId?: string;
  employmentType?: 'full_time' | 'part_time' | 'contract' | 'intern' | 'temporary';
  position?: string;
  query?: string; // 搜尋關鍵字 (姓名、員工編號)
}

// 分頁回應格式
export interface PaginatedEmployeeResponse {
  status: 'success';
  data: Employee[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 用戶上下文介面 (從 Firebase Auth Custom Claims)
export interface UserContext {
  uid: string;
  email?: string;
  role: string;  // 角色：tenant_admin, store_manager, staff, etc.
  roleLevel?: number;
  tenantId: string;
  storeId?: string;
  additionalStoreIds?: string[];
} 