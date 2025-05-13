/**
 * 動態股權系統 - 資格審核服務
 * 
 * 提供員工股權資格的檢查功能
 */

import * as admin from 'firebase-admin';

interface EmployeeData {
  status: string;
  createdAt: admin.firestore.Timestamp;
  storeId: string;
  tenantId: string;
}

interface PerformanceReview {
  employeeId: string;
  overallRating: number;
  status: string;
  updatedAt: admin.firestore.Timestamp;
}

export class EligibilityService {
  private db: FirebaseFirestore.Firestore;
  private employeesCollection: FirebaseFirestore.CollectionReference;
  private performanceReviewCollection: FirebaseFirestore.CollectionReference;
  private employeeEquityCollection: FirebaseFirestore.CollectionReference;

  constructor() {
    this.db = admin.firestore();
    this.employeesCollection = this.db.collection('employees');
    this.performanceReviewCollection = this.db.collection('performance_reviews');
    this.employeeEquityCollection = this.db.collection('employee_equity');
  }

  /**
   * 檢查員工是否符合股權資格
   * 條件：正職滿6個月 + 平均績效評分 >= 7
   * @param employeeId 員工ID
   * @returns 檢查結果
   */
  async checkEligibility(employeeId: string): Promise<{
    success: boolean;
    eligible: boolean;
    reason?: string;
    avgRating?: number;
    message: string;
  }> {
    try {
      // 1. 查詢員工資料
      const employeeDoc = await this.employeesCollection.doc(employeeId).get();
      if (!employeeDoc.exists) {
        return {
          success: false,
          eligible: false,
          reason: 'employee_not_found',
          message: `找不到ID為 ${employeeId} 的員工`
        };
      }

      const employeeData = employeeDoc.data() as EmployeeData;
      const { status, createdAt, storeId, tenantId } = employeeData;

      // 2. 檢查員工是否為正職狀態
      if (status !== 'active') {
        console.log(`員工 ${employeeId} 非正職狀態，不符合股權資格`);
        await this.updateEmployeeEquityStatus(employeeId, storeId, tenantId, false);
        return {
          success: true,
          eligible: false,
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
        await this.updateEmployeeEquityStatus(employeeId, storeId, tenantId, false);
        return {
          success: true,
          eligible: false,
          reason: 'insufficient_tenure',
          message: '員工年資未達6個月'
        };
      }

      // 4. 查詢並計算員工績效評分平均值
      const avgRating = await this.calculateAveragePerformanceRating(employeeId);
      
      // 5. 更新股權資格狀態
      const isEligible = avgRating >= 7.0;
      console.log(`員工 ${employeeId} 績效評分: ${avgRating}, 是否符合股權資格: ${isEligible}`);
      
      await this.updateEmployeeEquityStatus(employeeId, storeId, tenantId, isEligible);
      
      return {
        success: true,
        eligible: isEligible,
        avgRating,
        message: isEligible ? '員工符合股權資格' : '員工績效評分未達標準'
      };
    } catch (error) {
      console.error('檢查股權資格時發生錯誤:', error);
      return {
        success: false,
        eligible: false,
        reason: 'internal_error',
        message: '檢查股權資格時發生錯誤'
      };
    }
  }

  /**
   * 計算員工績效評分平均值
   * @param employeeId 員工ID
   * @returns 員工平均績效評分
   */
  private async calculateAveragePerformanceRating(employeeId: string): Promise<number> {
    try {
      // 查詢最近一年的績效評估記錄
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const reviewsQuery = await this.performanceReviewCollection
        .where('employeeId', '==', employeeId)
        .where('status', '==', 'finalized') // 只計算已定案的評估
        .where('updatedAt', '>=', admin.firestore.Timestamp.fromDate(oneYearAgo))
        .get();
      
      if (reviewsQuery.empty) {
        console.log(`員工 ${employeeId} 無有效績效評估記錄`);
        return 0;
      }
      
      let totalRating = 0;
      let validReviewCount = 0;
      
      reviewsQuery.forEach(doc => {
        const review = doc.data() as PerformanceReview;
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
   * @param employeeId 員工ID
   * @param storeId 店鋪ID
   * @param tenantId 租戶ID
   * @param isEligible 是否符合資格
   */
  private async updateEmployeeEquityStatus(
    employeeId: string,
    storeId: string,
    tenantId: string,
    isEligible: boolean
  ): Promise<void> {
    try {
      // 生成複合ID
      const equityId = `${employeeId}_${storeId}`;
      const equityRef = this.employeeEquityCollection.doc(equityId);
      const equityDoc = await equityRef.get();
      
      const now = admin.firestore.Timestamp.now();
      
      if (!equityDoc.exists) {
        // 如果記錄不存在，創建新記錄
        await equityRef.set({
          equityId,
          employeeId,
          storeId,
          tenantId,
          isEligible,
          lastCheckedAt: now,
          createdAt: now,
          updatedAt: now
        });
      } else {
        // 更新現有記錄
        await equityRef.update({
          isEligible,
          lastCheckedAt: now,
          updatedAt: now
        });
      }
    } catch (error) {
      console.error('更新員工股權資格狀態時發生錯誤:', error);
      throw error;
    }
  }
}

export default new EligibilityService(); 