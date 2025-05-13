/**
 * 員工動態股權制度 - 處理程序文件
 * 包含checkEquityEligibility等核心功能函數
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { EmployeeEquity, EquityStatus } from './types';

// 使用函數而非直接獲取Firestore集合，避免在模組加載時調用未初始化的Firebase
function getDb() {
  return admin.firestore();
}

function getEmployeesCollection() {
  return getDb().collection('employees');
}

function getEmployeeEquityCollection() {
  return getDb().collection('employee_equity');
}

function getPerformanceReviewCollection() {
  return getDb().collection('performance_reviews');
}

// 定義請求數據的接口
interface EquityEligibilityData {
  employeeId: string;
}

/**
 * 檢查員工是否符合股權認購資格
 * 條件：正職滿6個月 + 平均績效評分 >= 7
 */
export const checkEquityEligibility = functions.https.onCall(async (data: unknown, context: any) => {
  // 檢查身分驗證
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '需要登入才能執行此操作'
    );
  }

  // 檢查請求參數並進行安全轉換
  const parsedData = data as EquityEligibilityData;
  const employeeId = parsedData.employeeId;
  
  if (!employeeId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '請求缺少必要參數: employeeId'
    );
  }

  // 處理函數主體邏輯
  return processEquityEligibility(employeeId);
});

/**
 * 處理股權資格檢查的主要邏輯
 * 
 * @param employeeId 員工ID
 * @returns 處理結果
 */
export async function processEquityEligibility(employeeId: string) {
  try {
    // 1. 查詢員工資料
    const employeeDoc = await getEmployeesCollection().doc(employeeId).get();
    if (!employeeDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `找不到ID為 ${employeeId} 的員工`
      );
    }

    const employeeData = employeeDoc.data() as any;
    const { storeId, status, tenantId, createdAt } = employeeData;

    // 2. 檢查員工是否為正職狀態
    if (status !== 'active') {
      console.log(`員工 ${employeeId} 非正職狀態，不符合股權資格`);
      await updateEmployeeEquityStatus(employeeId, storeId, tenantId, false);
      return {
        success: false,
        reason: 'employee_not_active',
        message: '員工非正職狀態'
      };
    }

    // 3. 檢查工作年資是否達6個月
    const employmentStartDate = createdAt.toDate();
    const currentDate = new Date();
    const sixMonthsInMillis = 6 * 30 * 24 * 60 * 60 * 1000; // 約6個月
    
    if (currentDate.getTime() - employmentStartDate.getTime() < sixMonthsInMillis) {
      console.log(`員工 ${employeeId} 年資未達6個月，不符合股權資格`);
      await updateEmployeeEquityStatus(employeeId, storeId, tenantId, false);
      return {
        success: false,
        reason: 'insufficient_tenure',
        message: '員工年資未達6個月'
      };
    }

    // 4. 查詢並計算員工績效評分平均值
    const avgRating = await calculateAveragePerformanceRating(employeeId);
    
    // 5. 更新股權資格狀態
    const isEligible = avgRating >= 7.0;
    console.log(`員工 ${employeeId} 績效評分: ${avgRating}, 是否符合股權資格: ${isEligible}`);
    
    await updateEmployeeEquityStatus(employeeId, storeId, tenantId, isEligible);
    
    return {
      success: true,
      eligible: isEligible,
      avgRating,
      message: isEligible ? '員工符合股權資格' : '員工績效評分未達標準'
    };
    
  } catch (error) {
    console.error('檢查股權資格時發生錯誤:', error);
    throw new functions.https.HttpsError(
      'internal', 
      '檢查股權資格時發生錯誤'
    );
  }
}

/**
 * 計算員工績效評分平均值
 * 
 * @param employeeId 員工ID
 * @returns 返回員工的平均績效評分，如無有效評分則返回0
 */
async function calculateAveragePerformanceRating(employeeId: string): Promise<number> {
  try {
    // 查詢最近一年的績效評估記錄
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const reviewsQuery = await getPerformanceReviewCollection()
      .where('employeeId', '==', employeeId)
      .where('status', '==', 'finalized') // 只計算已定案的評估
      .where('updatedAt', '>=', oneYearAgo)
      .get();
    
    if (reviewsQuery.empty) {
      console.log(`員工 ${employeeId} 無有效績效評估記錄`);
      return 0;
    }
    
    let totalRating = 0;
    let validReviewCount = 0;
    
    reviewsQuery.forEach(doc => {
      const review = doc.data();
      // 將5分制評分轉換為10分制
      if (review.overallRating) {
        totalRating += (review.overallRating * 2);
        validReviewCount++;
      }
    });
    
    if (validReviewCount === 0) return 0;
    
    // 計算平均分
    return totalRating / validReviewCount;
    
  } catch (error) {
    console.error('計算績效評分時發生錯誤:', error);
    return 0;
  }
}

/**
 * 更新員工股權資格狀態
 * 
 * @param employeeId 員工ID
 * @param storeId 店鋪ID
 * @param tenantId 租戶ID
 * @param isEligible 是否符合資格
 */
async function updateEmployeeEquityStatus(
  employeeId: string,
  storeId: string,
  tenantId: string,
  isEligible: boolean
): Promise<void> {
  try {
    // 生成複合ID
    const equityId = `${employeeId}_${storeId}`;
    const equityRef = getEmployeeEquityCollection().doc(equityId);
    const equityDoc = await equityRef.get();
    
    const now = admin.firestore.Timestamp.now();
    
    if (!equityDoc.exists) {
      // 如果記錄不存在，創建新記錄
      const newEquityRecord: Partial<EmployeeEquity> = {
        employeeId,
        storeId,
        tenantId,
        equityEligible: isEligible,
        equityEligibleDate: isEligible ? now.toDate() : null,
        shares: 0,
        purchasedValue: 0,
        currentValue: 0,
        status: isEligible ? 'eligible' : 'none',
        vestingPercentage: 0,
        transactions: [],
        createdAt: now.toDate(),
        updatedAt: now.toDate()
      };
      
      await equityRef.set(newEquityRecord);
      
    } else {
      // 如果記錄已存在，更新資格狀態
      const equityData = equityDoc.data() as EmployeeEquity;
      
      // 狀態邏輯：只有在股權狀態為none時，才能更新為eligible
      // 如果已經在active或其他狀態，則不改變狀態
      let newStatus: EquityStatus = equityData.status;
      if (equityData.status === 'none' && isEligible) {
        newStatus = 'eligible';
      } else if (equityData.status === 'eligible' && !isEligible) {
        newStatus = 'none';
      }
      
      const updateData = {
        equityEligible: isEligible,
        equityEligibleDate: isEligible && !equityData.equityEligible ? 
          now.toDate() : equityData.equityEligibleDate || null,
        status: newStatus,
        updatedAt: now.toDate()
      };
      
      await equityRef.update(updateData);
    }
    
    // 也更新員工記錄
    await getEmployeesCollection().doc(employeeId).update({
      equityEligible: isEligible,
      updatedAt: now
    });
    
  } catch (error) {
    console.error('更新股權資格狀態時發生錯誤:', error);
    throw error;
  }
} 