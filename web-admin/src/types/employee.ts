export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern' | 'temporary';
export type EmployeeStatus = 'active' | 'inactive' | 'on_leave' | 'terminated';

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  position: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  storeId: string;
  storeName: string;
  hireDate: string;
  terminationDate?: string;
  contactInfo: {
    phone: string;
    emergencyContact?: string;
    emergencyPhone?: string;
  };
  schedule?: {
    preferredShifts: string[];
    maxHoursPerWeek?: number;
    daysUnavailable?: number[];
  };
  payInfo?: {
    hourlyRate?: number;
    salaryType: 'hourly' | 'monthly' | 'annual';
    bankAccount?: string;
  };
  userId: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
} 