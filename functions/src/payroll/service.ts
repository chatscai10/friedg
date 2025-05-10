/**
 * 薪資計算服務
 * 負責計算員工薪資、加班費等核心邏輯
 */

import * as admin from 'firebase-admin';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { EmployeeSalaryConfig, SalaryType, Payslip, PaymentStatus } from './types';

// 假設db已經從其他地方初始化
const db: Firestore = (global as any).db || (global as any).admin?.firestore();

/**
 * 總工時計算結果介面
 */
interface WorkHoursResult {
  regularHours: number;       // 一般工時
  overtimeHours: {            // 加班工時
    rate1: number;            // 加班時數 (倍率1)
    rate2: number;            // 加班時數 (倍率2)
  };
  holidayHours: number;       // 假日工時
  dailyWorkHours: Record<string, number>; // 每日工時記錄，用於計算每日加班
  scheduleRecords?: Array<{   // 相關排班記錄
    scheduleId: string;       // 排班ID
    date: string;             // 日期
    startTime: string;        // 開始時間
    endTime: string;          // 結束時間
    hours: number;            // 計算的工時
    isHoliday: boolean;       // 是否為假日
  }>;
}

/**
 * 應發工資計算結果介面
 */
export interface GrossSalaryResult {
  employeeId: string;         // 員工ID
  periodStart: Date;          // 計薪週期開始
  periodEnd: Date;            // 計薪週期結束
  salaryType: SalaryType;     // 薪資類型
  
  // 時薪制相關資訊
  regularHours?: number;      // 一般工時
  regularPay?: number;        // 一般工資
  overtimeHours?: {           // 加班工時
    rate1: number;            // 加班時數 (倍率1)
    rate2: number;            // 加班時數 (倍率2)
  };
  overtimePay?: {             // 加班費
    rate1: number;            // 加班費 (倍率1)
    rate2: number;            // 加班費 (倍率2)
  };
  holidayHours?: number;      // 假日工時
  holidayPay?: number;        // 假日工資
  
  // 月薪制相關資訊
  baseSalary?: number;        // 基本月薪
  workingDays?: number;       // 實際工作天數
  totalWorkDays?: number;     // 應工作總天數
  proRatedSalary?: number;    // 按比例計算的基本薪資(不足月)
  
  // 提成制相關資訊
  commissionBaseSalary?: number; // 提成制底薪
  salesAmount?: number;       // 銷售額
  commissionAmount?: number;  // 提成金額
  
  // 最終計算結果
  totalGrossSalary: number;   // 總應發工資
  
  // 計算依據資訊
  scheduleRecords?: Array<{   // 相關排班記錄
    scheduleId: string;       // 排班ID
    date: string;             // 日期
    startTime: string;        // 開始時間
    endTime: string;          // 結束時間
    hours: number;            // 計算的工時
    isHoliday: boolean;       // 是否為假日
  }>;
}

/**
 * 獎金計算結果介面
 */
export interface BonusResult {
  employeeId: string;                // 員工ID
  periodStart: Date;                 // 計算週期開始
  periodEnd: Date;                   // 計算週期結束
  bonusItems: Array<{
    bonusId: string;                 // 獎金規則ID
    bonusType: string;               // 獎金類型
    name: string;                    // 獎金名稱
    amount: number;                  // 獎金金額
    description: string;             // 說明
    calculationType: string;         // 計算類型
    condition: string;               // 觸發條件描述
  }>;
  totalBonusAmount: number;          // 獎金總額
}

/**
 * 薪資扣款類型枚舉
 */
export enum DeductionType {
  LABOR_INSURANCE = 'laborInsurance',       // 勞工保險
  HEALTH_INSURANCE = 'healthInsurance',     // 健康保險
  TAX_WITHHOLDING = 'taxWithholding',       // 預扣稅款
  LABOR_PENSION = 'laborPension',           // 勞工退休金自提
  WELFARE_FEE = 'welfareFee',               // 職工福利金
  OTHER = 'other'                           // 其他扣款
}

/**
 * 扣款項目計算結果介面
 */
export interface DeductionResult {
  employeeId: string;                // 員工ID
  periodStart: Date;                 // 計算週期開始
  periodEnd: Date;                   // 計算週期結束
  deductionItems: Array<{
    deductionType: DeductionType;    // 扣款類型
    name: string;                    // 扣款名稱
    amount: number;                  // 扣款金額
    description: string;             // 說明
    calculationBase: number;         // 計算基礎
    rate?: number;                   // 費率 (如適用)
  }>;
  totalDeductionAmount: number;      // 總扣款金額
}

/**
 * 計算員工總應發工資
 * @param employeeId 員工ID
 * @param periodStartDate 計薪週期開始日期
 * @param periodEndDate 計薪週期結束日期
 * @param tenantId 租戶ID
 * @param storeId 店鋪ID
 * @returns 計算結果，包含總應發工資及明細
 */
export async function calculateGrossSalary(
  employeeId: string,
  periodStartDate: Date,
  periodEndDate: Date,
  tenantId: string,
  storeId: string
): Promise<GrossSalaryResult> {
  console.log(`計算員工 ${employeeId} 從 ${periodStartDate.toISOString()} 到 ${periodEndDate.toISOString()} 的工資`);
  
  // 1. 獲取員工薪資設定
  const salaryConfigSnapshot = await db.collection('employeeSalaryConfigs')
    .where('employeeId', '==', employeeId)
    .where('tenantId', '==', tenantId)
    .where('storeId', '==', storeId)
    .where('effectiveFrom', '<=', Timestamp.fromDate(periodEndDate))
    .orderBy('effectiveFrom', 'desc')
    .limit(1)
    .get();
  
  if (salaryConfigSnapshot.empty) {
    throw new Error(`找不到員工 ${employeeId} 的薪資設定`);
  }
  
  const salaryConfig = salaryConfigSnapshot.docs[0].data() as EmployeeSalaryConfig;
  
  // 2. 獲取員工在指定週期內的排班記錄(僅狀態為confirmed的)
  const startDateStr = formatDate(periodStartDate);
  const endDateStr = formatDate(periodEndDate);
  
  const schedulesSnapshot = await db.collection('schedules')
    .where('employeeId', '==', employeeId)
    .where('tenantId', '==', tenantId)
    .where('storeId', '==', storeId)
    .where('status', '==', 'confirmed')
    .where('shiftDate', '>=', startDateStr)
    .where('shiftDate', '<=', endDateStr)
    .orderBy('shiftDate', 'asc')
    .get();
  
  // 初始化結果對象
  const result: GrossSalaryResult = {
    employeeId,
    periodStart: periodStartDate,
    periodEnd: periodEndDate,
    salaryType: salaryConfig.salaryType,
    totalGrossSalary: 0,
    scheduleRecords: []
  };
  
  // 3. 根據薪資類型進行計算
  switch (salaryConfig.salaryType) {
    case SalaryType.HOURLY:
      return calculateHourlySalary(result, salaryConfig, schedulesSnapshot.docs);
    
    case SalaryType.MONTHLY:
      return calculateMonthlySalary(result, salaryConfig, schedulesSnapshot.docs);
    
    case SalaryType.COMMISSION:
      return calculateCommissionSalary(result, salaryConfig, schedulesSnapshot.docs);
    
    default:
      throw new Error(`不支援的薪資類型: ${salaryConfig.salaryType}`);
  }
}

/**
 * 計算時薪制員工的薪資
 */
function calculateHourlySalary(
  result: GrossSalaryResult,
  salaryConfig: EmployeeSalaryConfig,
  schedulesDocs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]
): GrossSalaryResult {
  if (!salaryConfig.hourlyRates) {
    throw new Error('時薪制設定缺少必要的時薪率資訊');
  }
  
  // 1. 從排班記錄中計算總工時
  const workHours = calculateTotalWorkHours(schedulesDocs, salaryConfig);
  
  // 2. 記錄工時明細
  result.regularHours = workHours.regularHours;
  result.overtimeHours = workHours.overtimeHours;
  result.holidayHours = workHours.holidayHours;
  
  // 3. 計算薪資
  // 基本工資 = 一般工時 × 一般時薪
  result.regularPay = workHours.regularHours * salaryConfig.hourlyRates.regular;
  
  // 加班費 = 加班工時1 × 一般時薪 × 加班倍率1 + 加班工時2 × 一般時薪 × 加班倍率2
  result.overtimePay = {
    rate1: workHours.overtimeHours.rate1 * salaryConfig.hourlyRates.regular * salaryConfig.hourlyRates.overtime1,
    rate2: workHours.overtimeHours.rate2 * salaryConfig.hourlyRates.regular * salaryConfig.hourlyRates.overtime2
  };
  
  // 假日工資 = 假日工時 × 一般時薪 × 假日倍率
  result.holidayPay = workHours.holidayHours * salaryConfig.hourlyRates.regular * salaryConfig.hourlyRates.holiday;
  
  // 總應發工資 = 基本工資 + 加班費 + 假日工資
  result.totalGrossSalary = 
    result.regularPay + 
    result.overtimePay.rate1 + 
    result.overtimePay.rate2 + 
    result.holidayPay;
  
  console.log(`時薪制計算結果: 一般工資=${result.regularPay}, 加班費=${result.overtimePay.rate1 + result.overtimePay.rate2}, 假日工資=${result.holidayPay}, 總計=${result.totalGrossSalary}`);
  
  return result;
}

/**
 * 計算月薪制員工的薪資
 */
function calculateMonthlySalary(
  result: GrossSalaryResult,
  salaryConfig: EmployeeSalaryConfig,
  schedulesDocs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]
): GrossSalaryResult {
  if (!salaryConfig.monthlySettings) {
    throw new Error('月薪制設定缺少必要的月薪資訊');
  }
  
  // 1. 記錄基本月薪
  result.baseSalary = salaryConfig.baseSalary;
  
  // 2. 檢查是否為完整月份，如果不是則按比例計算
  const { periodStart, periodEnd } = result;
  const isFullMonth = isCompleteMonth(periodStart, periodEnd);
  
  if (isFullMonth) {
    // 完整月份，直接使用基本月薪
    result.totalGrossSalary = salaryConfig.baseSalary;
    console.log(`月薪制計算結果 (完整月份): 基本月薪=${salaryConfig.baseSalary}`);
  } else {
    // 不足月，按比例計算
    const totalDaysInMonth = getDaysInMonth(periodStart.getFullYear(), periodStart.getMonth());
    const actualDays = Math.min(
      periodEnd.getDate() - periodStart.getDate() + 1,
      totalDaysInMonth
    );
    
    result.workingDays = actualDays;
    result.totalWorkDays = totalDaysInMonth;
    result.proRatedSalary = (salaryConfig.baseSalary / totalDaysInMonth) * actualDays;
    result.totalGrossSalary = result.proRatedSalary;
    
    console.log(`月薪制計算結果 (不足月): 基本月薪=${salaryConfig.baseSalary}, 比例=${actualDays}/${totalDaysInMonth}, 按比例月薪=${result.proRatedSalary}`);
  }
  
  // 3. 計算加班費 (如果有)
  if (schedulesDocs.length > 0 && salaryConfig.monthlySettings.overtimeHourlyRate) {
    // 從排班記錄中計算工時
    const workHours = calculateTotalWorkHours(schedulesDocs, salaryConfig);
    
    // 月薪制一般不計算標準工時的薪資(已包含在月薪中)，但需要計算加班費
    if (workHours.overtimeHours.rate1 > 0 || workHours.overtimeHours.rate2 > 0) {
      result.overtimeHours = workHours.overtimeHours;
      
      // 加班費 = 加班工時 × 加班時薪計算基礎 × 加班倍率
      const overtimePay1 = workHours.overtimeHours.rate1 * 
                         salaryConfig.monthlySettings.overtimeHourlyRate * 
                         (salaryConfig.hourlyRates?.overtime1 || 1.33); // 默認首2小時1.33倍
      
      const overtimePay2 = workHours.overtimeHours.rate2 * 
                         salaryConfig.monthlySettings.overtimeHourlyRate * 
                         (salaryConfig.hourlyRates?.overtime2 || 1.66); // 默認超過2小時1.66倍
      
      result.overtimePay = {
        rate1: overtimePay1,
        rate2: overtimePay2
      };
      
      // 總加班費
      const totalOvertimePay = overtimePay1 + overtimePay2;
      
      // 更新總應發工資
      result.totalGrossSalary += totalOvertimePay;
      
      console.log(`月薪制加班費計算: 加班時數=${workHours.overtimeHours.rate1 + workHours.overtimeHours.rate2}, 加班費=${totalOvertimePay}`);
    }
  }
  
  return result;
}

/**
 * 計算提成制員工的薪資
 */
function calculateCommissionSalary(
  result: GrossSalaryResult,
  salaryConfig: EmployeeSalaryConfig,
  schedulesDocs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]
): GrossSalaryResult {
  if (!salaryConfig.commissionSettings) {
    throw new Error('提成制設定缺少必要的提成資訊');
  }
  
  // 1. 記錄底薪
  result.commissionBaseSalary = salaryConfig.commissionSettings.baseSalary;
  
  // 2. 目前簡單地計算底薪部分
  // 提成部分需要獲取銷售數據，可能需要另外的資料源
  // TODO: 當銷售數據可用時，完成提成計算
  result.totalGrossSalary = salaryConfig.commissionSettings.baseSalary;
  
  // 註: 此處只計算底薪部分，銷售提成需要獲取銷售記錄
  console.log(`提成制計算結果 (暫只計算底薪): 底薪=${salaryConfig.commissionSettings.baseSalary}`);
  
  // 3. 像時薪制一樣處理加班費 (如果有)
  if (schedulesDocs.length > 0 && salaryConfig.hourlyRates) {
    // 從排班記錄中計算工時
    const workHours = calculateTotalWorkHours(schedulesDocs, salaryConfig);
    
    // 計算加班費
    if (workHours.overtimeHours.rate1 > 0 || workHours.overtimeHours.rate2 > 0) {
      result.overtimeHours = workHours.overtimeHours;
      
      // 計算提成制的加班費基礎時薪
      const baseHourlyRate = salaryConfig.hourlyRates.regular || 150; // 假設默認時薪為150
      
      // 加班費計算
      result.overtimePay = {
        rate1: workHours.overtimeHours.rate1 * baseHourlyRate * salaryConfig.hourlyRates.overtime1,
        rate2: workHours.overtimeHours.rate2 * baseHourlyRate * salaryConfig.hourlyRates.overtime2
      };
      
      // 更新總應發工資
      result.totalGrossSalary += result.overtimePay.rate1 + result.overtimePay.rate2;
      
      console.log(`提成制加班費計算: 加班時數=${workHours.overtimeHours.rate1 + workHours.overtimeHours.rate2}, 加班費=${result.overtimePay.rate1 + result.overtimePay.rate2}`);
    }
  }
  
  return result;
}

/**
 * 計算總工時，包括一般工時、加班工時和假日工時
 */
function calculateTotalWorkHours(
  schedulesDocs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[],
  salaryConfig: EmployeeSalaryConfig
): WorkHoursResult {
  // 初始化工時結果
  const result: WorkHoursResult = {
    regularHours: 0,
    overtimeHours: {
      rate1: 0,
      rate2: 0
    },
    holidayHours: 0,
    dailyWorkHours: {}
  };
  
  // 工時的標準上限(每日)，超過此上限視為加班
  const dailyStandardHours = salaryConfig.monthlySettings?.workingHoursPerDay || 8;
  
  // 處理每個排班記錄
  schedulesDocs.forEach(doc => {
    const schedule = doc.data();
    const shiftDate = schedule.shiftDate;
    const startTime = schedule.startTime;
    const endTime = schedule.endTime;
    const isHoliday = schedule.isHoliday || false; // 是否為假日班次
    
    // 計算此班次的工時
    const hoursWorked = calculateShiftHours(startTime, endTime);
    
    // 更新班次記錄
    if (result.scheduleRecords) {
      result.scheduleRecords.push({
        scheduleId: doc.id,
        date: shiftDate,
        startTime,
        endTime,
        hours: hoursWorked,
        isHoliday
      });
    }
    
    // 累加每日工時，用於後續計算加班
    if (!result.dailyWorkHours[shiftDate]) {
      result.dailyWorkHours[shiftDate] = 0;
    }
    result.dailyWorkHours[shiftDate] += hoursWorked;
    
    // 若為假日班次，算入假日工時
    if (isHoliday) {
      result.holidayHours += hoursWorked;
    } else {
      // 非假日班次，算入一般工時
      result.regularHours += hoursWorked;
    }
  });
  
  // 計算每日加班時數
  Object.entries(result.dailyWorkHours).forEach(([date, hours]) => {
    if (hours > dailyStandardHours) {
      // 超過標準時數的部分算為加班
      const overtime = hours - dailyStandardHours;
      
      // 加班時數分為兩個級別：前兩小時和超過兩小時的部分
      // 按照常見的規定：前兩小時以1.33倍計算，超過兩小時以1.66倍計算
      const rate1Hours = Math.min(overtime, 2);
      const rate2Hours = Math.max(0, overtime - 2);
      
      // 從一般工時中扣除，並加入加班工時
      result.regularHours -= overtime;
      result.overtimeHours.rate1 += rate1Hours;
      result.overtimeHours.rate2 += rate2Hours;
    }
  });
  
  return result;
}

/**
 * 計算單個班次的工時
 * @param startTime 開始時間 (HH:MM 格式)
 * @param endTime 結束時間 (HH:MM 格式)
 * @returns 工作時長(小時)
 */
function calculateShiftHours(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  // 將時間轉換為分鐘
  let startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;
  
  // 處理跨天班次 (結束時間小於開始時間)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // 加上一天的分鐘數
  }
  
  // 計算總分鐘數並轉換為小時
  const minutesWorked = endMinutes - startMinutes;
  return minutesWorked / 60;
}

/**
 * 檢查是否為完整月份
 */
function isCompleteMonth(start: Date, end: Date): boolean {
  // 檢查是否為從月初到月底的完整月份
  return start.getDate() === 1 && 
         end.getDate() === getDaysInMonth(end.getFullYear(), end.getMonth());
}

/**
 * 獲取指定月份的總天數
 */
function getDaysInMonth(year: number, month: number): number {
  // 月份是 0-11，所以月份 + 1，日期設為 0 表示上個月的最後一天
  return new Date(year, month + 1, 0).getDate();
}

/**
 * 將日期格式化為 YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 計算員工的獎金
 * @param employeeId 員工ID
 * @param periodStartDate 計薪週期開始日期
 * @param periodEndDate 計薪週期結束日期
 * @param grossSalaryResult 應發工資計算結果 (可選，某些獎金計算可能依賴)
 * @param tenantId 租戶ID
 * @param storeId 店鋪ID
 * @returns 計算結果，包含獎金項目及總額
 */
export async function calculateBonuses(
  employeeId: string,
  periodStartDate: Date,
  periodEndDate: Date,
  grossSalaryResult?: GrossSalaryResult,
  tenantId?: string,
  storeId?: string
): Promise<BonusResult> {
  console.log(`計算員工 ${employeeId} 從 ${periodStartDate.toISOString()} 到 ${periodEndDate.toISOString()} 的獎金`);
  
  if (!tenantId || !storeId) {
    if (!grossSalaryResult) {
      throw new Error('缺少租戶ID和店鋪ID，且未提供薪資計算結果');
    }
    // 嘗試從薪資結果中獲取租戶信息
    tenantId = await getEmployeeTenantId(employeeId);
    storeId = await getEmployeeStoreId(employeeId);
  }
  
  // 初始化結果對象
  const result: BonusResult = {
    employeeId,
    periodStart: periodStartDate,
    periodEnd: periodEndDate,
    bonusItems: [],
    totalBonusAmount: 0
  };
  
  // 1. 獲取適用於該員工的獎金規則
  const applicableBonusRules = await getApplicableBonusRules(employeeId, tenantId, storeId, periodStartDate, periodEndDate);
  
  if (applicableBonusRules.length === 0) {
    console.log(`沒有找到適用於員工 ${employeeId} 的獎金規則`);
    return result;
  }
  
  console.log(`找到 ${applicableBonusRules.length} 條適用於員工 ${employeeId} 的獎金規則`);
  
  // 2. 遍歷每一條獎金規則，評估條件並計算獎金
  for (const rule of applicableBonusRules) {
    // 2.1 根據不同獎金類型評估條件
    let conditionMet = false;
    let conditionDescription = '';
    
    switch (rule.bonusType) {
      case 'attendance': // 全勤獎金
        const attendanceResult = await evaluateAttendanceCondition(
          employeeId, 
          tenantId, 
          storeId, 
          periodStartDate, 
          periodEndDate, 
          rule.attendanceCondition
        );
        conditionMet = attendanceResult.conditionMet;
        conditionDescription = attendanceResult.description;
        break;
        
      case 'performance': // 績效獎金
        // TODO: 績效獎金依賴績效考核系統，目前尚未開發，暫緩實作
        console.log(`績效獎金 ${rule.name} 的計算依賴績效考核系統，目前暫緩實作`);
        conditionMet = false;
        conditionDescription = '績效考核系統尚未整合';
        break;
        
      case 'sales': // 銷售獎金
        // TODO: 銷售獎金依賴銷售數據，目前可能尚未整合，暫緩實作
        console.log(`銷售獎金 ${rule.name} 的計算依賴銷售數據，目前暫緩實作`);
        conditionMet = false;
        conditionDescription = '銷售數據尚未整合';
        break;
        
      case 'referral': // 推薦獎金
        // TODO: 推薦獎金依賴推薦記錄，目前可能尚未整合，暫緩實作
        console.log(`推薦獎金 ${rule.name} 的計算依賴推薦記錄，目前暫緩實作`);
        conditionMet = false;
        conditionDescription = '推薦記錄尚未整合';
        break;
        
      case 'yearEnd': // 年終獎金
        // TODO: 年終獎金依賴年度績效和貢獻，目前暫緩實作
        console.log(`年終獎金 ${rule.name} 的計算依賴年度績效評估，目前暫緩實作`);
        conditionMet = false;
        conditionDescription = '年度績效評估尚未整合';
        break;
        
      case 'special': // 特殊獎金 (如專案完成獎金)
        if (rule.conditionType === 'always') {
          // 無條件發放的特殊獎金
          conditionMet = true;
          conditionDescription = '無條件發放';
        } else {
          // TODO: 其他特殊條件的獎金，可能需要個別評估
          console.log(`特殊獎金 ${rule.name} 的條件 ${rule.conditionType} 需要個別評估，目前暫緩實作`);
          conditionMet = false;
          conditionDescription = '條件評估待實作';
        }
        break;
        
      default:
        console.log(`未知獎金類型 ${rule.bonusType} 的規則 ${rule.name}，無法評估條件`);
        conditionMet = false;
        conditionDescription = '未知獎金類型';
    }
    
    // 2.2 如果滿足條件，計算獎金金額
    if (conditionMet) {
      let bonusAmount = 0;
      
      // 根據不同的計算類型計算獎金金額
      switch (rule.calculationType) {
        case 'fixed': // 固定金額
          bonusAmount = rule.fixedAmount || 0;
          break;
          
        case 'percentage': // 百分比
          if (rule.percentageSettings && grossSalaryResult) {
            // 根據百分比設定和基礎欄位計算
            const baseValue = getBaseValueForPercentage(rule.percentageSettings.baseField, grossSalaryResult);
            bonusAmount = baseValue * (rule.percentageSettings.percentage / 100);
          } else {
            console.log(`百分比獎金 ${rule.name} 缺少必要的百分比設定或薪資結果`);
            bonusAmount = 0;
          }
          break;
          
        case 'formula': // 公式
          // TODO: 公式計算需要更複雜的解析和運算，暫緩實作
          console.log(`公式計算的獎金 ${rule.name} 需要複雜的公式解析，目前暫緩實作`);
          bonusAmount = 0;
          break;
          
        default:
          console.log(`未知計算類型 ${rule.calculationType} 的獎金 ${rule.name}，無法計算金額`);
          bonusAmount = 0;
      }
      
      // 如果獎金金額大於0，添加到結果中
      if (bonusAmount > 0) {
        result.bonusItems.push({
          bonusId: rule.id,
          bonusType: rule.bonusType,
          name: rule.name,
          amount: bonusAmount,
          description: rule.description || '',
          calculationType: rule.calculationType,
          condition: conditionDescription
        });
        
        // 累加獎金總額
        result.totalBonusAmount += bonusAmount;
        
        console.log(`獎金 ${rule.name} 滿足條件，計算金額為 ${bonusAmount}`);
      }
    } else {
      console.log(`獎金 ${rule.name} 條件未滿足: ${conditionDescription}`);
    }
  }
  
  console.log(`員工 ${employeeId} 獎金計算完成，共 ${result.bonusItems.length} 項，總額 ${result.totalBonusAmount}`);
  
  return result;
}

/**
 * 評估全勤獎金條件
 * @returns 條件評估結果和描述
 */
async function evaluateAttendanceCondition(
  employeeId: string,
  tenantId: string,
  storeId: string,
  startDate: Date,
  endDate: Date,
  condition: any
): Promise<{ conditionMet: boolean; description: string }> {
  // 默認結果
  const result = {
    conditionMet: false,
    description: ''
  };
  
  if (!condition) {
    result.description = '缺少出勤條件設定';
    return result;
  }
  
  // 格式化日期範圍
  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);
  
  // 1. 檢查請假記錄
  const leaveRequestsSnapshot = await db.collection('leaves')
    .where('employeeId', '==', employeeId)
    .where('tenantId', '==', tenantId)
    .where('storeId', '==', storeId)
    .where('status', '==', 'approved')
    .where('startDate', '<=', endDateStr)
    .where('endDate', '>=', startDateStr)
    .get();
  
  // 如果有請假記錄且要求全勤，則條件不滿足
  if (!leaveRequestsSnapshot.empty && condition.fullAttendance) {
    result.description = `期間內有 ${leaveRequestsSnapshot.size} 筆請假記錄，不符合全勤要求`;
    return result;
  }
  
  // 2. 檢查遲到和早退記錄
  let lateTimes = 0;
  let earlyLeaveTimes = 0;
  
  // 獲取期間內的出勤記錄
  const attendanceRecordsSnapshot = await db.collection('attendanceRecords')
    .where('employeeId', '==', employeeId)
    .where('tenantId', '==', tenantId)
    .where('storeId', '==', storeId)
    .where('date', '>=', startDateStr)
    .where('date', '<=', endDateStr)
    .get();
  
  // 統計遲到和早退次數
  attendanceRecordsSnapshot.forEach(doc => {
    const record = doc.data();
    if (record.status === 'late') {
      lateTimes++;
    } else if (record.status === 'early_leave') {
      earlyLeaveTimes++;
    }
  });
  
  // 檢查是否超過允許的遲到或早退次數
  let attendanceIssues = [];
  
  if (condition.maxLateTimes !== undefined && lateTimes > condition.maxLateTimes) {
    attendanceIssues.push(`遲到次數 ${lateTimes} 超過允許的 ${condition.maxLateTimes} 次`);
  }
  
  if (condition.maxEarlyLeaveTimes !== undefined && earlyLeaveTimes > condition.maxEarlyLeaveTimes) {
    attendanceIssues.push(`早退次數 ${earlyLeaveTimes} 超過允許的 ${condition.maxEarlyLeaveTimes} 次`);
  }
  
  if (attendanceIssues.length > 0) {
    result.description = attendanceIssues.join('；');
    return result;
  }
  
  // 3. 如果沒有違反任何條件，則滿足全勤要求
  result.conditionMet = true;
  result.description = `符合全勤要求：無請假，遲到 ${lateTimes} 次，早退 ${earlyLeaveTimes} 次`;
  
  return result;
}

/**
 * 獲取適用於員工的獎金規則
 */
async function getApplicableBonusRules(
  employeeId: string,
  tenantId: string,
  storeId: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  // 獲取員工信息，用於檢查職位等
  const employeeDoc = await db.collection('employees').doc(employeeId).get();
  
  if (!employeeDoc.exists) {
    throw new Error(`找不到員工 ${employeeId} 的資料`);
  }
  
  const employee = employeeDoc.data();
  const position = employee?.position || '';
  
  // 1. 獲取全局適用於所有員工的獎金規則
  const globalRulesSnapshot = await db.collection('bonusRules')
    .where('tenantId', '==', tenantId)
    .where('isActive', '==', true)
    .where('applicableToAll', '==', true)
    .where('effectiveFrom', '<=', Timestamp.fromDate(endDate))
    .get();
  
  // 2. 獲取特定店鋪的獎金規則
  const storeRulesSnapshot = await db.collection('bonusRules')
    .where('tenantId', '==', tenantId)
    .where('storeId', '==', storeId)
    .where('isActive', '==', true)
    .where('effectiveFrom', '<=', Timestamp.fromDate(endDate))
    .get();
  
  // 合併規則並過濾
  const allRules: any[] = [];
  
  // 處理全局規則
  globalRulesSnapshot.forEach(doc => {
    const rule: any = { id: doc.id, ...doc.data() };
    
    // 檢查規則是否已過期
    if (rule.effectiveTo && Timestamp.fromDate(startDate) > rule.effectiveTo) {
      return; // 跳過已過期的規則
    }
    
    // 檢查適用職位
    if (!rule.applicableToAll && 
        rule.applicablePositions && 
        !rule.applicablePositions.includes(position)) {
      return; // 跳過不適用於該職位的規則
    }
    
    // 檢查特定員工ID列表
    if (!rule.applicableToAll && 
        rule.applicableEmployeeIds && 
        !rule.applicableEmployeeIds.includes(employeeId)) {
      return; // 跳過不適用於該員工的規則
    }
    
    allRules.push(rule);
  });
  
  // 處理店鋪特定規則
  storeRulesSnapshot.forEach(doc => {
    const rule: any = { id: doc.id, ...doc.data() };
    
    // 檢查規則是否已過期
    if (rule.effectiveTo && Timestamp.fromDate(startDate) > rule.effectiveTo) {
      return; // 跳過已過期的規則
    }
    
    // 檢查適用職位
    if (!rule.applicableToAll && 
        rule.applicablePositions && 
        !rule.applicablePositions.includes(position)) {
      return; // 跳過不適用於該職位的規則
    }
    
    // 檢查特定員工ID列表
    if (!rule.applicableToAll && 
        rule.applicableEmployeeIds && 
        !rule.applicableEmployeeIds.includes(employeeId)) {
      return; // 跳過不適用於該員工的規則
    }
    
    allRules.push(rule);
  });
  
  return allRules;
}

/**
 * 獲取百分比計算的基礎值
 */
function getBaseValueForPercentage(baseField: string, grossSalaryResult: GrossSalaryResult): number {
  switch (baseField) {
    case 'baseSalary':
      if (grossSalaryResult.salaryType === SalaryType.MONTHLY) {
        return grossSalaryResult.baseSalary || 0;
      } else if (grossSalaryResult.salaryType === SalaryType.HOURLY) {
        return grossSalaryResult.regularPay || 0;
      } else if (grossSalaryResult.salaryType === SalaryType.COMMISSION) {
        return grossSalaryResult.commissionBaseSalary || 0;
      }
      return 0;
      
    case 'totalGrossSalary':
      return grossSalaryResult.totalGrossSalary || 0;
      
    default:
      console.log(`未知的百分比基礎欄位 ${baseField}`);
      return 0;
  }
}

/**
 * 獲取員工所屬租戶ID (用於缺少租戶ID時)
 */
async function getEmployeeTenantId(employeeId: string): Promise<string> {
  const employeeDoc = await db.collection('employees').doc(employeeId).get();
  
  if (!employeeDoc.exists) {
    throw new Error(`找不到員工 ${employeeId} 的資料`);
  }
  
  const tenantId = employeeDoc.data()?.tenantId;
  
  if (!tenantId) {
    throw new Error(`員工 ${employeeId} 的資料缺少租戶ID`);
  }
  
  return tenantId;
}

/**
 * 獲取員工所屬店鋪ID (用於缺少店鋪ID時)
 */
async function getEmployeeStoreId(employeeId: string): Promise<string> {
  const employeeDoc = await db.collection('employees').doc(employeeId).get();
  
  if (!employeeDoc.exists) {
    throw new Error(`找不到員工 ${employeeId} 的資料`);
  }
  
  const storeId = employeeDoc.data()?.storeId;
  
  if (!storeId) {
    throw new Error(`員工 ${employeeId} 的資料缺少店鋪ID`);
  }
  
  return storeId;
}

/**
 * 計算員工的薪資扣款項目
 * @param employeeId 員工ID
 * @param periodStartDate 計薪週期開始日期
 * @param periodEndDate 計薪週期結束日期
 * @param grossSalaryResult 應發工資計算結果
 * @param bonusResult 獎金計算結果 (可選)
 * @param tenantId 租戶ID
 * @param storeId 店鋪ID
 * @returns 計算結果，包含扣款項目及總額
 */
export async function calculateDeductions(
  employeeId: string,
  periodStartDate: Date,
  periodEndDate: Date,
  grossSalaryResult: GrossSalaryResult,
  bonusResult?: BonusResult,
  tenantId?: string,
  storeId?: string
): Promise<DeductionResult> {
  console.log(`計算員工 ${employeeId} 從 ${periodStartDate.toISOString()} 到 ${periodEndDate.toISOString()} 的薪資扣款`);
  
  // 1. 如果沒有提供租戶ID或店鋪ID，則嘗試從員工紀錄中獲取
  if (!tenantId) {
    tenantId = await getEmployeeTenantId(employeeId);
  }
  
  if (!storeId) {
    storeId = await getEmployeeStoreId(employeeId);
  }
  
  // 2. 獲取員工薪資設定
  const salaryConfigSnapshot = await db.collection('employeeSalaryConfigs')
    .where('employeeId', '==', employeeId)
    .where('tenantId', '==', tenantId)
    .where('storeId', '==', storeId)
    .where('effectiveFrom', '<=', Timestamp.fromDate(periodEndDate))
    .orderBy('effectiveFrom', 'desc')
    .limit(1)
    .get();
  
  if (salaryConfigSnapshot.empty) {
    throw new Error(`找不到員工 ${employeeId} 的薪資設定`);
  }
  
  const salaryConfig = salaryConfigSnapshot.docs[0].data() as EmployeeSalaryConfig;
  
  // 3. 計算扣款項目的基礎(總收入 = 應發工資 + 獎金)
  const grossSalary = grossSalaryResult.totalGrossSalary;
  const bonusAmount = bonusResult ? bonusResult.totalBonusAmount : 0;
  
  // 初始化結果對象
  const result: DeductionResult = {
    employeeId,
    periodStart: periodStartDate,
    periodEnd: periodEndDate,
    deductionItems: [],
    totalDeductionAmount: 0
  };
  
  // 4. 計算勞保費 (如適用)
  if (salaryConfig.laborInsurance) {
    const laborInsuranceItem = calculateLaborInsurance(grossSalary, salaryConfig);
    result.deductionItems.push(laborInsuranceItem);
    result.totalDeductionAmount += laborInsuranceItem.amount;
  }
  
  // 5. 計算健保費 (如適用)
  if (salaryConfig.healthInsurance) {
    const healthInsuranceItem = calculateHealthInsurance(grossSalary, salaryConfig);
    result.deductionItems.push(healthInsuranceItem);
    result.totalDeductionAmount += healthInsuranceItem.amount;
  }
  
  // 6. 計算勞工退休金自提 (如適用)
  if (salaryConfig.laborPension && salaryConfig.laborPension.voluntaryContribution) {
    const laborPensionItem = calculateLaborPension(grossSalary, salaryConfig);
    result.deductionItems.push(laborPensionItem);
    result.totalDeductionAmount += laborPensionItem.amount;
  }
  
  // 7. 計算職工福利金 (如適用)
  if (salaryConfig.welfareFee && salaryConfig.welfareFee.enabled) {
    const welfareFeeItem = calculateWelfareFee(grossSalary, bonusAmount, salaryConfig);
    result.deductionItems.push(welfareFeeItem);
    result.totalDeductionAmount += welfareFeeItem.amount;
  }
  
  // 8. 計算預扣稅款 (如適用)
  // 注意：實際稅款計算可能需要更複雜的邏輯和考慮更多因素
  if (salaryConfig.taxWithholding) {
    // 以總收入的5%作為預扣稅款示例
    const taxableIncome = grossSalary + bonusAmount;
    const taxRate = 0.05; // 實際稅率應根據稅法規定和員工收入級別計算
    const taxAmount = Math.round(taxableIncome * taxRate);
    
    result.deductionItems.push({
      deductionType: DeductionType.TAX_WITHHOLDING,
      name: '預扣所得稅',
      amount: taxAmount,
      description: `依總收入 ${taxableIncome} 的 ${taxRate * 100}% 計算`,
      calculationBase: taxableIncome,
      rate: taxRate
    });
    
    result.totalDeductionAmount += taxAmount;
  }
  
  // 9. 獲取並處理一次性扣款記錄
  const oneTimeDeductionsSnapshot = await db.collection('payrollDeductions')
    .where('employeeId', '==', employeeId)
    .where('isProcessed', '==', false)
    .where('status', '==', 'pending')
    .get();
  
  if (!oneTimeDeductionsSnapshot.empty) {
    console.log(`找到 ${oneTimeDeductionsSnapshot.size} 筆待處理的一次性扣款記錄`);
    
    const batch = db.batch();
    
    for (const deductionDoc of oneTimeDeductionsSnapshot.docs) {
      const deductionData = deductionDoc.data();
      
      // 添加到扣款項目中
      result.deductionItems.push({
        deductionType: DeductionType.OTHER,
        name: '一次性扣款',
        amount: deductionData.amount,
        description: deductionData.description,
        calculationBase: 0 // 一次性扣款沒有計算基礎
      });
      
      result.totalDeductionAmount += deductionData.amount;
      
      // 更新扣款記錄為已處理
      batch.update(deductionDoc.ref, {
        isProcessed: true,
        status: 'processed',
        processedAt: admin.firestore.Timestamp.now().toDate(),
        appliedPayslipId: `${employeeId}_${formatDate(periodStartDate)}_${formatDate(periodEndDate)}`, // 薪資單ID的預期格式
        updatedAt: admin.firestore.Timestamp.now().toDate()
      });
    }
    
    // 提交批次更新
    await batch.commit();
    console.log(`已處理 ${oneTimeDeductionsSnapshot.size} 筆一次性扣款記錄`);
  }
  
  console.log(`員工 ${employeeId} 薪資扣款計算完成，共 ${result.deductionItems.length} 項，總額 ${result.totalDeductionAmount}`);
  return result;
}

/**
 * 計算勞保費用 (員工自付部分)
 */
function calculateLaborInsurance(baseAmount: number, salaryConfig: EmployeeSalaryConfig): {
  deductionType: DeductionType;
  name: string;
  amount: number;
  description: string;
  calculationBase: number;
  rate?: number;
} {
  // TODO: 需與人資部門確認實際的勞保自付額計算規則及費率
  // 實際上應根據勞保投保薪資分級表確定投保級距，並按規定的費率計算
  
  // 勞保費率：員工負擔 2.2075% (普通事故保險 + 就業保險)
  // 普通事故保險 11.5% (勞工負擔 20% = 2.3%)
  // 就業保險 1% (勞工負擔 20% = 0.2%)
  // 合計約為 2.5%，但這裡以統一 2.2075% 計算
  const laborInsuranceRate = 0.022075; // 2.2075%
  
  // 勞保有投保薪資分級表，這裡使用最新分級表
  let insuredSalary = baseAmount;
  
  // 2024年勞保投保薪資下限 (26,400元)
  const minInsuredSalary = 26400;
  
  // 2024年勞保投保薪資上限 (45,800元)
  const maxInsuredSalary = 45800;
  
  // 套用級距表 (此處簡化處理，實際應用完整的級距表)
  if (insuredSalary < minInsuredSalary) {
    insuredSalary = minInsuredSalary;
  } else if (insuredSalary > maxInsuredSalary) {
    insuredSalary = maxInsuredSalary;
  } else {
    // TODO: 應實作完整的勞保投保薪資分級表對照
    // 目前僅做簡單處理，實際上應依照官方公告的級距表調整為對應的投保級距金額
    // 例：24,000~25,200 應為第 6 級距，投保薪資為 25,200 元
  }
  
  // 根據投保薪資和費率計算勞保費用
  const laborInsuranceAmount = Math.round(insuredSalary * laborInsuranceRate);
  
  return {
    deductionType: DeductionType.LABOR_INSURANCE,
    name: '勞工保險費',
    amount: laborInsuranceAmount,
    description: '勞工保險費 (員工自付部分)',
    calculationBase: insuredSalary,
    rate: laborInsuranceRate
  };
}

/**
 * 計算健保費用 (員工自付部分)
 */
function calculateHealthInsurance(baseAmount: number, salaryConfig: EmployeeSalaryConfig): {
  deductionType: DeductionType;
  name: string;
  amount: number;
  description: string;
  calculationBase: number;
  rate?: number;
} {
  // TODO: 需與人資部門確認實際的健保自付額計算規則、費率及眷屬處理
  // 實際上應根據健保投保金額分級表確定投保級距，並考慮眷屬人數
  
  // 健保費率為 5.17%，員工負擔 30% = 1.551%
  const healthInsuranceRate = 0.01551; // 1.551%
  
  // 健保投保金額分級表
  let insuredAmount = baseAmount;
  
  // 2024年健保投保金額下限 (26,400元)
  const minInsuredAmount = 26400;
  
  // 2024年健保投保金額上限 (182,000元)
  const maxInsuredAmount = 182000;
  
  // 套用級距表 (此處簡化處理，實際應用完整的級距表)
  if (insuredAmount < minInsuredAmount) {
    insuredAmount = minInsuredAmount;
  } else if (insuredAmount > maxInsuredAmount) {
    insuredAmount = maxInsuredAmount;
  } else {
    // TODO: 應實作完整的健保投保金額分級表對照
    // 目前僅做簡單處理，實際上應依照官方公告的級距表調整為對應的投保級距金額
  }
  
  // TODO: 眷屬人數會影響健保費計算
  // 目前暫不考慮眷屬人數的影響，但實際計算中需要
  // 1. 獲取員工的眷屬人數資訊 (需從員工資料或健保設定中取得)
  // 2. 應用眷屬費率：投保金額 × 1.551% × (1 + 眷屬人數 × 眷屬負擔比例)
  // 但通常眷屬人數計算上限為 3 人
  
  // 根據投保金額和費率計算健保費
  const healthInsuranceAmount = Math.round(insuredAmount * healthInsuranceRate);
  
  return {
    deductionType: DeductionType.HEALTH_INSURANCE,
    name: '健康保險費',
    amount: healthInsuranceAmount,
    description: '健康保險費 (員工自付部分，不含眷屬)',
    calculationBase: insuredAmount,
    rate: healthInsuranceRate
  };
}

/**
 * 計算勞工退休金自提費用
 */
function calculateLaborPension(baseAmount: number, salaryConfig: EmployeeSalaryConfig): {
  deductionType: DeductionType;
  name: string;
  amount: number;
  description: string;
  calculationBase: number;
  rate?: number;
} {
  // TODO: 需確認勞工退休金自提計算基礎，通常與勞保投保薪資一致但有不同上限
  // 自提比例可由員工自行選擇，範圍為 0~6%
  
  // 獲取自提比例，如果未設定則默認為 0%
  const voluntaryRate = salaryConfig.laborPension?.voluntaryRate || 0;
  
  // 如果自提比例為 0%，則無須計算
  if (voluntaryRate <= 0) {
    return {
      deductionType: DeductionType.LABOR_PENSION,
      name: '勞工退休金自提',
      amount: 0,
      description: '勞工退休金自提 (未設定)',
      calculationBase: 0,
      rate: 0
    };
  }
  
  // 計算基礎通常與勞保投保薪資一致，但上限更高
  let pensionBase = baseAmount;
  
  // 2024年勞工退休金提繳工資分級表下限 (26,400元)
  const minPensionBase = 26400;
  
  // 2024年勞工退休金提繳工資分級表上限 (150,000元)
  const maxPensionBase = 150000;
  
  // 套用級距表
  if (pensionBase < minPensionBase) {
    pensionBase = minPensionBase;
  } else if (pensionBase > maxPensionBase) {
    pensionBase = maxPensionBase;
  } else {
    // TODO: 應實作完整的勞工退休金提繳工資分級表對照
    // 目前僅做簡單處理，實際上應依照官方公告的級距表調整
  }
  
  // 計算勞工退休金自提金額
  const laborPensionAmount = Math.round(pensionBase * (voluntaryRate / 100));
  
  return {
    deductionType: DeductionType.LABOR_PENSION,
    name: '勞工退休金自提',
    amount: laborPensionAmount,
    description: `勞工退休金自提 (${voluntaryRate}%)`,
    calculationBase: pensionBase,
    rate: voluntaryRate / 100
  };
}

/**
 * 計算職工福利金
 */
function calculateWelfareFee(baseAmount: number, bonusAmount: number, salaryConfig: EmployeeSalaryConfig): {
  deductionType: DeductionType;
  name: string;
  amount: number;
  description: string;
  calculationBase: number;
  rate?: number;
} {
  // TODO: 職工福利金計算需與人資部門確認實際計算基礎與比例
  // 通常是薪資加上獎金的總額乘以一定比例(0.5%)
  
  // 獲取職工福利金比例，默認為 0.5%
  const welfareRate = salaryConfig.welfareFee?.rate || 0.005;
  
  // 計算基礎通常是本薪加上各項獎金
  const calculationBase = baseAmount + bonusAmount;
  
  // 計算職工福利金
  const welfareFeeAmount = Math.round(calculationBase * welfareRate);
  
  return {
    deductionType: DeductionType.WELFARE_FEE,
    name: '職工福利金',
    amount: welfareFeeAmount,
    description: '職工福利金 (薪資+獎金總額的0.5%)',
    calculationBase: calculationBase,
    rate: welfareRate
  };
}

/**
 * 生成薪資單並儲存至資料庫
 * @param employeeId 員工ID
 * @param periodStartDate 計薪週期開始日期
 * @param periodEndDate 計薪週期結束日期
 * @param tenantId 租戶ID
 * @param storeId 店鋪ID
 * @param isDraft 是否為草稿 (默認false)
 * @returns 生成的薪資單物件
 */
export async function generatePayslip(
  employeeId: string,
  periodStartDate: Date,
  periodEndDate: Date,
  tenantId: string,
  storeId: string,
  isDraft: boolean = false
): Promise<Payslip> {
  console.log(`生成員工 ${employeeId} 從 ${periodStartDate.toISOString()} 到 ${periodEndDate.toISOString()} 的薪資單`);
  
  // 1. 計算應發工資
  const grossSalaryResult = await calculateGrossSalary(
    employeeId,
    periodStartDate,
    periodEndDate,
    tenantId,
    storeId
  );
  
  // 2. 計算獎金
  const bonusResult = await calculateBonuses(
    employeeId,
    periodStartDate,
    periodEndDate,
    grossSalaryResult,
    tenantId,
    storeId
  );
  
  // 3. 計算扣款
  const deductionResult = await calculateDeductions(
    employeeId,
    periodStartDate,
    periodEndDate,
    grossSalaryResult,
    bonusResult,
    tenantId,
    storeId
  );
  
  // 4. 計算實發薪資 (Net Pay)
  const netPay = grossSalaryResult.totalGrossSalary + bonusResult.totalBonusAmount - deductionResult.totalDeductionAmount;
  
  // 5. 獲取員工基本資訊 (姓名、職位等)
  const employeeSnapshot = await db.collection('employees').doc(employeeId).get();
  
  if (!employeeSnapshot.exists) {
    throw new Error(`找不到員工 ${employeeId} 的資料`);
  }
  
  const employeeData = employeeSnapshot.data();
  const employeeName = employeeData?.name || '未知姓名';
  const position = employeeData?.position || '未知職位';
  
  // 6. 生成薪資單編號 (格式: YYYYMM-EMPID)
  const yearMonth = `${periodEndDate.getFullYear()}${String(periodEndDate.getMonth() + 1).padStart(2, '0')}`;
  const payslipNumber = `${yearMonth}-${employeeId}`;
  
  // 7. 確定支付狀態
  const status = isDraft ? PaymentStatus.PENDING : PaymentStatus.PROCESSING;
  
  // 8. 計算預計發薪日期 (通常為下個月的指定日期)
  const payDate = new Date(periodEndDate);
  payDate.setMonth(payDate.getMonth() + 1);
  // 假設發薪日為每月 15 日
  payDate.setDate(15);
  
  // 9. 構建 Payslip 物件
  const now = new Date();
  const payslip: Payslip = {
    id: `${tenantId}-${payslipNumber}`, // 薪資單ID
    payslipNumber: payslipNumber,
    tenantId: tenantId,
    storeId: storeId,
    employeeId: employeeId,
    
    // 薪資期間
    periodStart: Timestamp.fromDate(periodStartDate),
    periodEnd: Timestamp.fromDate(periodEndDate),
    payDate: Timestamp.fromDate(payDate),
    
    // 基本資訊
    salaryType: grossSalaryResult.salaryType,
    employeeName: employeeName,
    position: position,
    
    // 薪資金額
    currency: 'TWD',
    
    // 收入項目
    earnings: {
      baseSalary: grossSalaryResult.baseSalary || grossSalaryResult.regularPay || grossSalaryResult.commissionBaseSalary || 0,
      
      // 時薪制特有欄位
      regularHours: grossSalaryResult.regularHours,
      regularPay: grossSalaryResult.regularPay,
      overtimeHours: grossSalaryResult.overtimeHours,
      overtimePay: grossSalaryResult.overtimePay,
      holidayHours: grossSalaryResult.holidayHours,
      holidayPay: grossSalaryResult.holidayPay,
      
      // 提成制特有欄位
      salesAmount: grossSalaryResult.salesAmount,
      commission: grossSalaryResult.commissionAmount,
      
      // 獎金項目
      bonuses: bonusResult.bonusItems.map(item => ({
        bonusId: item.bonusId,
        name: item.name,
        amount: item.amount,
        description: `${item.description} (${item.condition})`
      })),
      
      // 其他收入
      otherEarnings: [], // 暫無其他收入
      
      // 總收入
      totalEarnings: grossSalaryResult.totalGrossSalary + bonusResult.totalBonusAmount
    },
    
    // 扣除項目
    deductions: {
      // 從扣款結果中提取勞保、健保和預扣稅款
      laborInsurance: deductionResult.deductionItems.find(
        item => item.deductionType === DeductionType.LABOR_INSURANCE
      )?.amount || undefined,
      
      healthInsurance: deductionResult.deductionItems.find(
        item => item.deductionType === DeductionType.HEALTH_INSURANCE
      )?.amount || undefined,
      
      taxWithholding: deductionResult.deductionItems.find(
        item => item.deductionType === DeductionType.TAX_WITHHOLDING
      )?.amount || undefined,
      
      // 其他扣除項目 (勞退自提、職工福利金等)
      otherDeductions: deductionResult.deductionItems
        .filter(item => 
          item.deductionType !== DeductionType.LABOR_INSURANCE && 
          item.deductionType !== DeductionType.HEALTH_INSURANCE && 
          item.deductionType !== DeductionType.TAX_WITHHOLDING
        )
        .map(item => ({
          name: item.name,
          amount: item.amount,
          description: item.description
        })),
      
      // 總扣除金額
      totalDeductions: deductionResult.totalDeductionAmount
    },
    
    // 實發金額
    netPay: netPay,
    
    // 狀態追蹤
    status: status,
    statusHistory: [
      {
        status: status,
        timestamp: Timestamp.fromDate(now),
        updatedBy: 'system',
        reason: '系統自動生成'
      }
    ],
    
    // 關聯記錄
    relatedAttendanceRecordIds: [], // 需實際關聯
    relatedScheduleIds: grossSalaryResult.scheduleRecords?.map(record => record.scheduleId) || [],
    relatedSalesRecordIds: [], // 需實際關聯
    
    // 審計欄位
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    createdBy: 'system',
    updatedBy: 'system',
    
    // 員工確認
    isConfirmed: false
  };
  
  // 10. 儲存 Payslip 至 Firestore
  try {
    console.log(`儲存薪資單 ${payslip.payslipNumber} 至資料庫`);
    await db.collection('payslips').doc(payslip.id).set(payslip);
    console.log(`薪資單 ${payslip.payslipNumber} 儲存成功`);
    return payslip;
  } catch (error) {
    console.error(`儲存薪資單失敗: ${error}`);
    throw new Error(`儲存薪資單失敗: ${error}`);
  }
}

/**
 * 安排一次性薪資扣款
 * 
 * 此函數用於創建一次性薪資扣款記錄，將在下次薪資計算時自動處理
 * 
 * @param employeeId 員工ID
 * @param tenantId 租戶ID
 * @param amount 扣款金額
 * @param description 扣款描述
 * @param metadata 額外的元數據 (可選)
 * @returns 創建的扣款記錄ID
 */
export async function scheduleOneTimeDeduction(
  employeeId: string,
  tenantId: string,
  amount: number,
  description: string,
  metadata?: Record<string, any>
): Promise<string> {
  try {
    console.log(`為員工 ${employeeId} 安排一次性薪資扣款: ${amount}，描述: ${description}`);
    
    if (amount <= 0) {
      throw new Error('扣款金額必須大於0');
    }
    
    // 獲取員工所屬店鋪
    const employeeDoc = await db.collection('employees').doc(employeeId).get();
    
    if (!employeeDoc.exists) {
      throw new Error(`找不到員工 ${employeeId}`);
    }
    
    const employeeData = employeeDoc.data();
    const storeId = employeeData?.storeId;
    
    if (!storeId) {
      throw new Error(`員工 ${employeeId} 沒有關聯店鋪ID`);
    }
    
    // 創建一次性扣款記錄
    const deductionRef = db.collection('payrollDeductions').doc();
    const timestamp = admin.firestore.Timestamp.now();
    
    const deductionData = {
      id: deductionRef.id,
      employeeId: employeeId,
      tenantId: tenantId,
      storeId: storeId,
      amount: amount,
      description: description,
      deductionType: DeductionType.OTHER,
      status: 'pending', // 待處理
      isProcessed: false, // 未處理
      appliedPayslipId: null, // 尚未應用到任何薪資單
      scheduledAt: timestamp.toDate(),
      validUntil: null, // 無失效日期，一直有效直到被處理
      metadata: metadata || {},
      createdAt: timestamp.toDate(),
      updatedAt: timestamp.toDate()
    };
    
    await deductionRef.set(deductionData);
    console.log(`成功創建一次性扣款記錄 ${deductionRef.id} 金額: ${amount}`);
    
    return deductionRef.id;
  } catch (error) {
    console.error('安排一次性薪資扣款時發生錯誤:', error);
    throw error;
  }
} 