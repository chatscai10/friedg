import { Employee } from '../types/employee';

export const mockEmployees: Employee[] = [
  {
    id: '001',
    employeeCode: 'EMP001',
    firstName: '小明',
    lastName: '王',
    position: '店長',
    employmentType: 'full_time',
    status: 'active',
    storeId: 'store001',
    storeName: '台北門市',
    hireDate: '2025-01-01',
    contactInfo: {
      phone: '0912-345-678',
      emergencyContact: '王大明',
      emergencyPhone: '0923-456-789'
    },
    schedule: {
      preferredShifts: ['morning', 'afternoon'],
      maxHoursPerWeek: 40,
      daysUnavailable: [0, 6]
    },
    payInfo: {
      hourlyRate: 200,
      salaryType: 'monthly',
      bankAccount: '012-345-678901'
    },
    userId: 'user001',
    tenantId: 'tenant001',
    createdAt: '2025-01-01T08:00:00Z',
    updatedAt: '2025-01-15T09:30:00Z'
  },
  {
    id: '002',
    employeeCode: 'EMP002',
    firstName: '小花',
    lastName: '李',
    position: '廚師',
    employmentType: 'full_time',
    status: 'active',
    storeId: 'store001',
    storeName: '台北門市',
    hireDate: '2025-01-03',
    contactInfo: {
      phone: '0934-567-890',
      emergencyContact: '李大花',
      emergencyPhone: '0945-678-901'
    },
    schedule: {
      preferredShifts: ['morning', 'afternoon', 'evening'],
      maxHoursPerWeek: 40,
      daysUnavailable: [2]
    },
    payInfo: {
      hourlyRate: 180,
      salaryType: 'monthly',
      bankAccount: '123-456-789012'
    },
    userId: 'user002',
    tenantId: 'tenant001',
    createdAt: '2025-01-03T08:00:00Z',
    updatedAt: '2025-01-15T09:30:00Z'
  },
  {
    id: '003',
    employeeCode: 'EMP003',
    firstName: '大雄',
    lastName: '陳',
    position: '櫃台',
    employmentType: 'part_time',
    status: 'active',
    storeId: 'store002',
    storeName: '新竹門市',
    hireDate: '2025-01-05',
    contactInfo: {
      phone: '0956-789-012',
      emergencyContact: '陳小雄',
      emergencyPhone: '0967-890-123'
    },
    schedule: {
      preferredShifts: ['afternoon', 'evening'],
      maxHoursPerWeek: 20,
      daysUnavailable: [1, 3, 5]
    },
    payInfo: {
      hourlyRate: 160,
      salaryType: 'hourly',
      bankAccount: '234-567-890123'
    },
    userId: 'user003',
    tenantId: 'tenant001',
    createdAt: '2025-01-05T08:00:00Z',
    updatedAt: '2025-01-15T09:30:00Z'
  },
  {
    id: '004',
    employeeCode: 'EMP004',
    firstName: '小玲',
    lastName: '林',
    position: '外送員',
    employmentType: 'full_time',
    status: 'on_leave',
    storeId: 'store003',
    storeName: '台中門市',
    hireDate: '2025-01-08',
    contactInfo: {
      phone: '0978-901-234',
      emergencyContact: '林大玲',
      emergencyPhone: '0989-012-345'
    },
    schedule: {
      preferredShifts: ['morning', 'afternoon', 'evening'],
      maxHoursPerWeek: 40,
      daysUnavailable: [4]
    },
    payInfo: {
      hourlyRate: 170,
      salaryType: 'monthly',
      bankAccount: '345-678-901234'
    },
    userId: 'user004',
    tenantId: 'tenant001',
    createdAt: '2025-01-08T08:00:00Z',
    updatedAt: '2025-01-15T09:30:00Z'
  },
  {
    id: '005',
    employeeCode: 'EMP005',
    firstName: '小華',
    lastName: '張',
    position: '助理',
    employmentType: 'intern',
    status: 'active',
    storeId: 'store004',
    storeName: '高雄門市',
    hireDate: '2025-01-10',
    contactInfo: {
      phone: '0991-123-456',
      emergencyContact: '張大華',
      emergencyPhone: '0910-234-567'
    },
    schedule: {
      preferredShifts: ['morning', 'afternoon'],
      maxHoursPerWeek: 30,
      daysUnavailable: [0, 6]
    },
    payInfo: {
      hourlyRate: 150,
      salaryType: 'hourly',
      bankAccount: '456-789-012345'
    },
    userId: 'user005',
    tenantId: 'tenant001',
    createdAt: '2025-01-10T08:00:00Z',
    updatedAt: '2025-01-15T09:30:00Z'
  }
]; 