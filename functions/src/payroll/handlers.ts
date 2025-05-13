/**
 * 薪資計算API處理函式
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { generatePayslip, calculateGrossSalary, calculateBonuses, calculateDeductions } from './service';
import { PayrollCalculationRequest } from './types';
// 導入標準 RBAC/Auth 中間件
import { withAuthentication, withTenantIsolation, withRole, withStoreIsolation } from '../middleware/auth.middleware';

/**
 * 生成薪資單
 * HTTP 端點: POST /generatePayslip
 */
export const generatePayslipHandler = onCall({
  region: 'asia-east1',
  maxInstances: 10
}, withTenantIsolation(withRole('tenant_admin', async (data, context, user) => {
  // 薪資生成需要租戶管理員或更高權限

  const requestData = data as PayrollCalculationRequest;

  // 驗證輸入參數
  if (!requestData.periodStart || !requestData.periodEnd) {
    throw new HttpsError(
      'invalid-argument',
      '缺少必要參數：periodStart, periodEnd'
    );
  }

  try {
    // 轉換日期字串為Date物件
    const periodStartDate = new Date(requestData.periodStart);
    const periodEndDate = new Date(requestData.periodEnd);

    // 驗證日期
    if (isNaN(periodStartDate.getTime()) || isNaN(periodEndDate.getTime())) {
      throw new HttpsError(
        'invalid-argument',
        '無效的日期格式，請使用YYYY-MM-DD格式'
      );
    }

    if (periodStartDate > periodEndDate) {
      throw new HttpsError(
        'invalid-argument',
        '起始日期不能晚於結束日期'
      );
    }

    let result;

    if (requestData.employeeId) {
      // 單一員工薪資單生成
      console.log(`生成員工 ${requestData.employeeId} 的薪資單`);
      const payslip = await generatePayslip(
        requestData.employeeId,
        periodStartDate,
        periodEndDate,
        requestData.tenantId,
        requestData.storeId,
        requestData.saveDraft
      );
      result = { success: true, payslip };
    } else {
      // 批次生成多員工薪資單
      console.log(`批次生成所有員工的薪資單`);
      
      // 獲取所有活躍員工
      const db = require('firebase-admin/firestore').getFirestore();
      const employeesSnapshot = await db.collection('employees')
        .where('tenantId', '==', requestData.tenantId)
        .where('storeId', '==', requestData.storeId)
        .where('status', '==', 'active')
        .get();

      const payslips = [];
      const errors = [];

      // 為每個員工生成薪資單
      for (const employeeDoc of employeesSnapshot.docs) {
        const employeeId = employeeDoc.id;
        try {
          const payslip = await generatePayslip(
            employeeId,
            periodStartDate,
            periodEndDate,
            requestData.tenantId,
            requestData.storeId,
            requestData.saveDraft
          );
          payslips.push(payslip);
        } catch (error: any) {
          console.error(`生成員工 ${employeeId} 薪資單時出錯:`, error);
          errors.push({
            employeeId,
            error: error.message || '未知錯誤'
          });
        }
      }

      result = {
        success: true,
        payslipsGenerated: payslips.length,
        errors: errors.length > 0 ? errors : undefined
      };
    }

    return result;
  } catch (error: any) {
    console.error('生成薪資單時發生錯誤:', error);
    throw new HttpsError(
      'internal',
      `生成薪資單時發生錯誤: ${error.message || '未知錯誤'}`
    );
  }
})));

/**
 * 預覽薪資計算
 * HTTP 端點: POST /previewPayrollCalculation
 * 用於在不實際生成薪資單的情況下預覽計算結果
 */
export const previewPayrollCalculationHandler = onCall({
  region: 'asia-east1',
  maxInstances: 10
}, withTenantIsolation(withStoreIsolation(withRole('store_manager', async (data, context, user) => {
  // 薪資預覽計算需要店鋪管理員或更高權限
  
  const requestData = data as PayrollCalculationRequest;

  // 驗證輸入參數
  if (!requestData.employeeId || !requestData.periodStart || !requestData.periodEnd) {
    throw new HttpsError(
      'invalid-argument',
      '缺少必要參數：employeeId, periodStart, periodEnd'
    );
  }

  try {
    // 轉換日期字串為Date物件
    const periodStartDate = new Date(requestData.periodStart);
    const periodEndDate = new Date(requestData.periodEnd);

    // 驗證日期
    if (isNaN(periodStartDate.getTime()) || isNaN(periodEndDate.getTime())) {
      throw new HttpsError(
        'invalid-argument',
        '無效的日期格式，請使用YYYY-MM-DD格式'
      );
    }

    // 分別計算各項組成，但不實際生成薪資單
    const grossSalaryResult = await calculateGrossSalary(
      requestData.employeeId,
      periodStartDate,
      periodEndDate,
      requestData.tenantId,
      requestData.storeId
    );

    const bonusResult = await calculateBonuses(
      requestData.employeeId,
      periodStartDate,
      periodEndDate,
      grossSalaryResult,
      requestData.tenantId,
      requestData.storeId
    );

    const deductionResult = await calculateDeductions(
      requestData.employeeId,
      periodStartDate,
      periodEndDate,
      grossSalaryResult,
      bonusResult,
      requestData.tenantId,
      requestData.storeId
    );

    // 計算實發薪資
    const netPay = grossSalaryResult.totalGrossSalary + bonusResult.totalBonusAmount - deductionResult.totalDeductionAmount;

    return {
      employeeId: requestData.employeeId,
      periodStart: requestData.periodStart,
      periodEnd: requestData.periodEnd,
      salaryType: grossSalaryResult.salaryType,
      grossSalary: grossSalaryResult,
      bonuses: bonusResult,
      deductions: deductionResult,
      netPay: netPay,
      currency: 'TWD'
    };
  } catch (error: any) {
    console.error('預覽薪資計算時發生錯誤:', error);
    throw new HttpsError(
      'internal',
      `預覽薪資計算時發生錯誤: ${error.message || '未知錯誤'}`
    );
  }
})))); 