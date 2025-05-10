/**
 * 薪資計算API處理函式
 */
import { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { generatePayslip, calculateGrossSalary, calculateBonuses, calculateDeductions } from './service';
import { PayrollCalculationRequest, PaymentStatus } from './types';

const db = admin.firestore();

/**
 * 觸發薪資計算
 * HTTP 端點: POST /payroll/calculate
 */
export const triggerPayrollCalculation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, periodStart, periodEnd, generatePayslip: shouldGeneratePayslip = true, saveDraft = false } = req.body as PayrollCalculationRequest;
    
    // 從請求中獲取租戶ID和店鋪ID
    const tenantId = res.locals.tenantId;
    const storeId = req.body.storeId;
    
    // 驗證必要參數
    if (!periodStart || !periodEnd) {
      res.status(400).json({
        success: false,
        error: '缺少必要參數：periodStart, periodEnd'
      });
      return;
    }
    
    // 轉換日期字串為Date物件
    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);
    
    // 驗證日期
    if (isNaN(periodStartDate.getTime()) || isNaN(periodEndDate.getTime())) {
      res.status(400).json({
        success: false,
        error: '無效的日期格式，請使用YYYY-MM-DD格式'
      });
      return;
    }
    
    if (periodStartDate > periodEndDate) {
      res.status(400).json({
        success: false,
        error: '起始日期不能晚於結束日期'
      });
      return;
    }

    // 如果提供了employeeId，則只計算該員工的薪資
    if (employeeId) {
      // 計算薪資但不產生薪資單
      const grossSalaryResult = await calculateGrossSalary(
        employeeId,
        periodStartDate,
        periodEndDate,
        tenantId,
        storeId
      );
      
      const bonusResult = await calculateBonuses(
        employeeId,
        periodStartDate,
        periodEndDate,
        grossSalaryResult,
        tenantId,
        storeId
      );
      
      const deductionResult = await calculateDeductions(
        employeeId,
        periodStartDate,
        periodEndDate,
        grossSalaryResult,
        bonusResult,
        tenantId,
        storeId
      );
      
      // 計算實發薪資
      const netPay = grossSalaryResult.totalGrossSalary + bonusResult.totalBonusAmount - deductionResult.totalDeductionAmount;
      
      // 如果需要產生薪資單
      let payslip = null;
      if (shouldGeneratePayslip) {
        payslip = await generatePayslip(
          employeeId,
          periodStartDate,
          periodEndDate,
          tenantId,
          storeId,
          saveDraft
        );
      }
      
      // 回傳計算結果
      res.status(200).json({
        success: true,
        employeeId: employeeId,
        periodStart: periodStart,
        periodEnd: periodEnd,
        salaryType: grossSalaryResult.salaryType,
        grossSalary: grossSalaryResult,
        bonuses: bonusResult,
        deductions: deductionResult,
        netPay: netPay,
        currency: 'TWD',
        payslip: payslip
      });
    } else {
      // 目前僅支援單一員工計算
      res.status(400).json({
        success: false,
        error: '必須提供 employeeId 參數'
      });
    }
  } catch (error: any) {
    console.error('薪資計算時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `薪資計算時發生錯誤: ${error.message || '未知錯誤'}`
    });
  }
};

/**
 * 獲取員工薪資單列表
 * HTTP 端點: GET /employees/{employeeId}/payslips
 */
export const listEmployeePayslips = async (req: Request, res: Response): Promise<void> => {
  try {
    // 從路徑參數獲取員工ID
    const employeeId = req.params.employeeId;
    
    // 從中間件獲取租戶ID和店鋪ID
    const { tenantId, storeId } = res.locals;
    
    // 查詢參數
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const status = req.query.status as PaymentStatus | undefined;
    const limit = parseInt(req.query.limit as string || '10', 10);
    const page = parseInt(req.query.page as string || '1', 10);
    
    // 構建查詢
    let query = db.collection('payslips')
      .where('employeeId', '==', employeeId)
      .where('tenantId', '==', tenantId);
    
    // 如果有店鋪ID，則過濾店鋪
    if (storeId) {
      query = query.where('storeId', '==', storeId);
    }
    
    // 如果有開始日期，則過濾
    if (startDate) {
      const startDateObj = new Date(startDate);
      if (!isNaN(startDateObj.getTime())) {
        query = query.where('periodStart', '>=', Timestamp.fromDate(startDateObj));
      }
    }
    
    // 如果有結束日期，則過濾
    if (endDate) {
      const endDateObj = new Date(endDate);
      if (!isNaN(endDateObj.getTime())) {
        query = query.where('periodEnd', '<=', Timestamp.fromDate(endDateObj));
      }
    }
    
    // 如果有狀態過濾，則添加狀態過濾
    if (status) {
      query = query.where('status', '==', status);
    }
    
    // 排序並分頁
    query = query.orderBy('periodStart', 'desc');
    
    // 執行查詢
    const snapshot = await query.get();
    
    // 計算總數
    const total = snapshot.size;
    
    // 計算分頁
    const offset = (page - 1) * limit;
    const payslips = snapshot.docs
      .slice(offset, offset + limit)
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    
    // 格式化時間戳
    const formattedPayslips = payslips.map(payslip => ({
      ...payslip,
      periodStart: payslip.periodStart instanceof Timestamp 
        ? payslip.periodStart.toDate().toISOString() 
        : payslip.periodStart,
      periodEnd: payslip.periodEnd instanceof Timestamp 
        ? payslip.periodEnd.toDate().toISOString() 
        : payslip.periodEnd,
      payDate: payslip.payDate instanceof Timestamp 
        ? payslip.payDate.toDate().toISOString() 
        : payslip.payDate,
      createdAt: payslip.createdAt instanceof Timestamp 
        ? payslip.createdAt.toDate().toISOString() 
        : payslip.createdAt,
      updatedAt: payslip.updatedAt instanceof Timestamp 
        ? payslip.updatedAt.toDate().toISOString() 
        : payslip.updatedAt,
    }));
    
    // 回傳結果
    res.status(200).json({
      success: true,
      data: formattedPayslips,
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('獲取員工薪資單列表時發生錯誤:', error);
    res.status(500).json({
      success: false,
      error: `獲取員工薪資單列表時發生錯誤: ${error.message || '未知錯誤'}`
    });
  }
}; 