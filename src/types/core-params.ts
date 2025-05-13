/**
 * 核心參數類型定義
 * 
 * 此文件定義了整個應用程式中使用的核心參數標準介面
 * 所有使用這些參數的代碼都應該引用此文件中的定義
 */

/**
 * 時間範圍介面
 * 表示一個時間區間，使用24小時制
 */
export interface TimeRange {
  /** 開始時間，格式: "HH:MM" (24小時制) */
  start: string;
  /** 結束時間，格式: "HH:MM" (24小時制) */
  end: string;
}

/**
 * 營業時間介面 - 標準物件格式
 * 使用星期名稱作為屬性
 */
export interface BusinessHours {
  /** 星期一的營業時間 */
  monday: TimeRange[];
  /** 星期二的營業時間 */
  tuesday: TimeRange[];
  /** 星期三的營業時間 */
  wednesday: TimeRange[];
  /** 星期四的營業時間 */
  thursday: TimeRange[];
  /** 星期五的營業時間 */
  friday: TimeRange[];
  /** 星期六的營業時間 */
  saturday: TimeRange[];
  /** 星期日的營業時間 */
  sunday: TimeRange[];
  /** 假日的營業時間 (可選) */
  holidays?: TimeRange[];
}

/**
 * 單日營業時間介面 - 陣列項目格式
 * 用於前端表單或某些情境
 */
export interface DailyOperatingHours {
  /** 星期幾 (0-6, 0=星期日) */
  day: number;
  /** 是否營業 */
  isOpen: boolean;
  /** 開始營業時間 (格式: HH:MM) */
  openTime?: string;
  /** 結束營業時間 (格式: HH:MM) */
  closeTime?: string;
  /** 休息開始時間 (格式: HH:MM) */
  breakStart?: string;
  /** 休息結束時間 (格式: HH:MM) */
  breakEnd?: string;
}

/**
 * 地理位置座標介面
 * 用於表示分店位置和打卡半徑
 */
export interface Coordinates {
  /** 緯度 */
  latitude: number;
  /** 經度 */
  longitude: number;
  /** 允許的半徑範圍（單位：公尺）(可選) */
  radius?: number;
}

/**
 * 排班角色類型
 */
export type ScheduleRole = 'cashier' | 'server' | 'chef' | 'manager' | 'cleaner';

/**
 * 職位/角色定義介面
 */
export interface Position {
  /** 職位ID/代碼 */
  id: ScheduleRole;
  /** 職位名稱 */
  name: string;
}

/**
 * 標準職位列表
 */
export const DEFAULT_POSITIONS: Position[] = [
  { id: 'cashier', name: '收銀員' },
  { id: 'server', name: '服務員' },
  { id: 'chef', name: '廚師' },
  { id: 'manager', name: '經理' },
  { id: 'cleaner', name: '清潔員' }
];

/**
 * 排班月份介面
 */
export interface ScheduleMonth {
  /** 年份 */
  year: number;
  /** 月份 (1-12) */
  month: number;
  /** 該月第一天 (YYYY-MM-DD) */
  startDate: string;
  /** 該月最後一天 (YYYY-MM-DD) */
  endDate: string;
}

/**
 * 分店基本資訊介面
 */
export interface Branch {
  /** 分店ID */
  storeId: string;
  /** 分店名稱 */
  storeName: string;
  /** 分店代碼 */
  storeCode: string;
  /** 地址 */
  address: string;
  /** 電話號碼 */
  phoneNumber: string;
  /** 聯絡人 */
  contactPerson: string;
  /** 電子郵件 */
  email: string;
  /** 租戶ID */
  tenantId: string;
  /** 是否啟用 */
  isActive: boolean;
  /** 地理位置 */
  geolocation: Coordinates;
  /** 營業時間 */
  businessHours: BusinessHours;
  /** 創建時間 */
  createdAt: string;
  /** 更新時間 */
  updatedAt: string;
  /** 創建者 */
  createdBy: string;
  /** 更新者 */
  updatedBy: string;
}

/**
 * 分店清單類型
 */
export type BranchesList = Branch[];

/**
 * 每日人力需求介面
 */
export interface DailyNeed {
  /** 日期 (YYYY-MM-DD) */
  date: string;
  /** 分店ID */
  storeId: string;
  /** 每個班次最少人數，按角色分類 */
  minStaffPerShift: {
    /** 角色ID對應的需求人數 */
    [role in ScheduleRole]?: number;
  };
  /** 特殊事件/備註 (可選) */
  notes?: string;
}

/**
 * 工具函數：陣列格式營業時間轉換為物件格式
 * @param dailyHoursArray 陣列格式的營業時間
 * @returns 物件格式的營業時間
 */
export function convertArrayToBusinessHours(dailyHoursArray: DailyOperatingHours[]): BusinessHours {
  const daysMap: { [key: number]: keyof BusinessHours } = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
  };

  const result: Partial<BusinessHours> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  };

  dailyHoursArray.forEach(day => {
    const dayKey = daysMap[day.day];
    
    if (day.isOpen && day.openTime && day.closeTime) {
      result[dayKey]?.push({
        start: day.openTime,
        end: day.closeTime
      });
    }
  });

  return result as BusinessHours;
}

/**
 * 工具函數：物件格式營業時間轉換為陣列格式
 * @param businessHours 物件格式的營業時間
 * @returns 陣列格式的營業時間
 */
export function convertBusinessHoursToArray(businessHours: BusinessHours): DailyOperatingHours[] {
  const daysMap: { [key in keyof BusinessHours]?: number } = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };

  const result: DailyOperatingHours[] = [];

  Object.entries(businessHours).forEach(([day, timeRanges]) => {
    // 跳過 holidays
    if (day === 'holidays') return;

    const dayNumber = daysMap[day as keyof BusinessHours];
    if (dayNumber === undefined) return;

    if (timeRanges.length === 0) {
      // 沒有時間範圍，表示不營業
      result.push({
        day: dayNumber,
        isOpen: false
      });
    } else {
      // 使用第一個時間範圍
      const firstRange = timeRanges[0];
      result.push({
        day: dayNumber,
        isOpen: true,
        openTime: firstRange.start,
        closeTime: firstRange.end
      });
    }
  });

  return result;
}

/**
 * 工具函數：創建排班月份物件
 * @param year 年份
 * @param month 月份 (1-12)
 * @returns 排班月份物件
 */
export function createScheduleMonth(year: number, month: number): ScheduleMonth {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const formatDate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    year,
    month,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
} 