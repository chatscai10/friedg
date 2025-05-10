import * as admin from 'firebase-admin';
import { PerformanceReviewCycle, ReviewCycleStatus, PerformanceReview, ReviewStatus, KpiAssessment, SelfAssessment } from './types';
import { Request } from 'express';
import { logAuditEvent, AuditLogStatus } from '../libs/audit';

/**
 * 代表考核週期的簡化輸入結構
 */
export interface PerformanceReviewCycleInput {
  tenantId: string;       // 租戶ID
  name: string;           // 週期名稱
  startDate: Date;        // 開始日期
  endDate: Date;          // 結束日期
  kpiTemplateId?: string; // 關聯的KPI模板ID（選填）
  notes?: string;         // 備註（選填）
}

/**
 * 代表績效考核記錄的輸入結構
 */
export interface PerformanceReviewInput {
  overallComments?: string;           // 總體評語
  strengths?: string;                 // 優點
  improvements?: string;              // 改進方向
  kpiAssessments?: KpiAssessment[];   // KPI評估項目
  selfAssessment?: SelfAssessment;    // 自我評估
  overallRating?: number;             // 總體評分
}

/**
 * 創建新的績效考核週期
 * 
 * @param cycleData 週期資料
 * @returns 新創建的週期記錄
 */
export async function createPerformanceReviewCycle(
  cycleData: PerformanceReviewCycleInput
): Promise<PerformanceReviewCycle> {
  const db = admin.firestore();
  
  // 驗證輸入資料
  if (!cycleData.name || !cycleData.startDate || !cycleData.endDate) {
    throw new Error('考核週期必須包含名稱、開始日期和結束日期');
  }
  
  if (cycleData.endDate < cycleData.startDate) {
    throw new Error('結束日期不能早於開始日期');
  }
  
  // 獲取當前時間
  const now = admin.firestore.Timestamp.now();
  
  // 創建新的考核週期記錄
  const newCycle: Omit<PerformanceReviewCycle, 'id'> = {
    tenantId: cycleData.tenantId,
    name: cycleData.name,
    startDate: cycleData.startDate,
    endDate: cycleData.endDate,
    status: 'preparing', // 初始狀態為準備中
    kpiTemplateId: cycleData.kpiTemplateId,
    notes: cycleData.notes,
    createdAt: now.toDate(),
    updatedAt: now.toDate()
  };
  
  // 將記錄寫入 Firestore
  const cyclesRef = db.collection('performanceReviewCycles');
  const docRef = await cyclesRef.add(newCycle);
  
  // 返回完整的週期記錄（包含ID）
  return {
    ...newCycle,
    id: docRef.id
  };
}

/**
 * 更新績效考核週期狀態
 * 
 * @param tenantId 租戶ID
 * @param cycleId 考核週期ID
 * @param newStatus 新狀態
 * @param req Express 請求對象 (用於操作日誌)
 */
export async function updatePerformanceReviewCycleStatus(
  tenantId: string,
  cycleId: string,
  newStatus: ReviewCycleStatus,
  req?: Request
): Promise<void> {
  const db = admin.firestore();
  const cycleRef = db.collection('performanceReviewCycles').doc(cycleId);
  
  // 獲取當前考核週期記錄
  const cycleDoc = await cycleRef.get();
  if (!cycleDoc.exists) {
    throw new Error(`找不到ID為 ${cycleId} 的考核週期`);
  }
  
  const cycleData = cycleDoc.data() as Omit<PerformanceReviewCycle, 'id'>;
  
  // 檢查租戶權限
  if (cycleData.tenantId !== tenantId) {
    throw new Error('無權限存取此考核週期');
  }
  
  const currentStatus = cycleData.status;
  
  // 檢查狀態轉換的有效性
  if (!isValidStatusTransition(currentStatus, newStatus)) {
    throw new Error(`不允許從 ${currentStatus} 狀態轉換到 ${newStatus} 狀態`);
  }
  
  // 更新週期狀態
  await cycleRef.update({
    status: newStatus,
    updatedAt: admin.firestore.Timestamp.now().toDate()
  });
  
  // 記錄操作日誌
  if (req) {
    try {
      await logAuditEvent({
        userId: req.user?.uid || 'unknown',
        userName: req.user?.name || req.user?.displayName,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        tenantId: tenantId,
        
        action: 'performance_cycle_status_change',
        status: AuditLogStatus.SUCCESS,
        
        targetEntityType: 'performance_cycle',
        targetEntityId: cycleId,
        targetEntityName: cycleData.name,
        
        details: { 
          cycleName: cycleData.name,
          startDate: cycleData.startDate,
          endDate: cycleData.endDate
        },
        previousState: { status: currentStatus },
        newState: { status: newStatus },
        
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }
  }
}

/**
 * 獲取租戶的績效考核週期列表
 * 
 * @param tenantId 租戶ID
 * @param limit 取回的最大記錄數（預設20）
 * @param status 可選的狀態過濾
 * @returns 考核週期記錄列表
 */
export async function getPerformanceReviewCycles(
  tenantId: string,
  limit: number = 20,
  status?: ReviewCycleStatus
): Promise<PerformanceReviewCycle[]> {
  const db = admin.firestore();
  
  // 建立基本查詢
  let query = db.collection('performanceReviewCycles')
    .where('tenantId', '==', tenantId)
    .orderBy('createdAt', 'desc')
    .limit(limit);
  
  // 如果指定了狀態，則加入狀態過濾
  if (status) {
    query = query.where('status', '==', status);
  }
  
  // 執行查詢
  const snapshot = await query.get();
  
  // 處理結果
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PerformanceReviewCycle[];
}

/**
 * 檢查狀態轉換是否有效
 * 
 * @param currentStatus 當前狀態
 * @param newStatus 新狀態
 * @returns 是否為有效的狀態轉換
 */
function isValidStatusTransition(
  currentStatus: ReviewCycleStatus,
  newStatus: ReviewCycleStatus
): boolean {
  // 狀態轉換規則
  const validTransitions: Record<ReviewCycleStatus, ReviewCycleStatus[]> = {
    'preparing': ['in_progress', 'cancelled'],  // 準備中 → 進行中 或 取消
    'in_progress': ['completed', 'cancelled'],  // 進行中 → 已完成 或 取消
    'completed': [],                            // 已完成狀態不能再變更
    'cancelled': []                             // 已取消狀態不能再變更
  };
  
  // 檢查當前狀態是否可以轉換為新狀態
  return validTransitions[currentStatus].includes(newStatus);
}

/**
 * 獲取特定考核週期的詳細資訊
 * 
 * @param tenantId 租戶ID
 * @param cycleId 考核週期ID
 * @returns 考核週期詳細資訊
 */
export async function getPerformanceReviewCycleById(
  tenantId: string,
  cycleId: string
): Promise<PerformanceReviewCycle> {
  const db = admin.firestore();
  const cycleRef = db.collection('performanceReviewCycles').doc(cycleId);
  
  // 獲取考核週期記錄
  const cycleDoc = await cycleRef.get();
  if (!cycleDoc.exists) {
    throw new Error(`找不到ID為 ${cycleId} 的考核週期`);
  }
  
  const cycleData = cycleDoc.data() as Omit<PerformanceReviewCycle, 'id'>;
  
  // 檢查租戶權限
  if (cycleData.tenantId !== tenantId) {
    throw new Error('無權限存取此考核週期');
  }
  
  // 返回完整的週期記錄（包含ID）
  return {
    ...cycleData,
    id: cycleDoc.id
  } as PerformanceReviewCycle;
}

/**
 * 創建或獲取績效考核記錄
 * 
 * @param tenantId 租戶ID
 * @param employeeId 被考核員工ID
 * @param cycleId 考核週期ID
 * @param initiatorId 發起考核的用戶ID
 * @returns 考核記錄
 */
export async function createOrGetPerformanceReview(
  tenantId: string,
  employeeId: string,
  cycleId: string,
  initiatorId: string
): Promise<PerformanceReview> {
  const db = admin.firestore();
  
  // 首先檢查考核週期是否存在且屬於正確租戶
  const cycleRef = db.collection('performanceReviewCycles').doc(cycleId);
  const cycleDoc = await cycleRef.get();
  
  if (!cycleDoc.exists) {
    throw new Error(`找不到ID為 ${cycleId} 的考核週期`);
  }
  
  const cycleData = cycleDoc.data() as PerformanceReviewCycle;
  if (cycleData.tenantId !== tenantId) {
    throw new Error('無權限存取此考核週期');
  }
  
  if (cycleData.status !== 'in_progress') {
    throw new Error('只能在進行中的考核週期創建考核記錄');
  }
  
  // 查詢是否已存在此員工在此週期的考核記錄
  const reviewsRef = db.collection('performanceReviews');
  const existingReviewsSnapshot = await reviewsRef
    .where('tenantId', '==', tenantId)
    .where('cycleId', '==', cycleId)
    .where('employeeId', '==', employeeId)
    .limit(1)
    .get();
  
  // 如果已存在，直接返回
  if (!existingReviewsSnapshot.empty) {
    const existingReview = existingReviewsSnapshot.docs[0];
    return {
      id: existingReview.id,
      ...existingReview.data()
    } as PerformanceReview;
  }
  
  // 若不存在，則創建新的考核記錄
  
  // 獲取員工的主管ID（在實際環境中，應從員工資料或組織架構中查詢）
  // 這裡我們暫時使用發起考核的用戶作為評核人，實際情況可能需要查詢員工的直屬主管
  const reviewerId = initiatorId;
  
  const now = admin.firestore.Timestamp.now();
  
  // 創建初始考核記錄
  const newReview: Omit<PerformanceReview, 'id'> = {
    tenantId: tenantId,
    cycleId: cycleId,
    employeeId: employeeId,
    reviewerId: reviewerId,
    status: 'draft', // 初始狀態為草稿
    kpiAssessments: [], // 初始化空的評估項目列表
    createdAt: now.toDate(),
    updatedAt: now.toDate()
  };
  
  // 將記錄寫入 Firestore
  const docRef = await reviewsRef.add(newReview);
  
  // 返回完整的考核記錄（包含ID）
  return {
    ...newReview,
    id: docRef.id
  };
}

/**
 * 更新績效考核記錄內容
 * 
 * @param tenantId 租戶ID
 * @param reviewId 考核記錄ID
 * @param updateData 更新資料
 * @param userId 執行更新的用戶ID
 */
export async function updatePerformanceReview(
  tenantId: string,
  reviewId: string,
  updateData: PerformanceReviewInput,
  userId: string
): Promise<void> {
  const db = admin.firestore();
  const reviewRef = db.collection('performanceReviews').doc(reviewId);
  
  // 獲取當前考核記錄
  const reviewDoc = await reviewRef.get();
  if (!reviewDoc.exists) {
    throw new Error(`找不到ID為 ${reviewId} 的考核記錄`);
  }
  
  const reviewData = reviewDoc.data() as PerformanceReview;
  
  // 檢查租戶權限
  if (reviewData.tenantId !== tenantId) {
    throw new Error('無權限存取此考核記錄');
  }
  
  // 檢查考核記錄的狀態
  const currentStatus = reviewData.status;
  
  // 根據狀態和用戶身份檢查是否允許更新
  if (!canUpdateReview(reviewData, userId, currentStatus, !!updateData.selfAssessment)) {
    throw new Error('您無權更新此考核記錄或當前狀態不允許更新');
  }
  
  // 根據用戶身份和考核狀態，過濾更新內容
  const filteredUpdateData = filterUpdateData(reviewData, userId, updateData);
  
  // 如果沒有可更新的內容，直接返回
  if (Object.keys(filteredUpdateData).length === 0) {
    return;
  }
  
  // 更新考核記錄
  await reviewRef.update({
    ...filteredUpdateData,
    updatedAt: admin.firestore.Timestamp.now().toDate()
  });
}

/**
 * 提交績效考核的特定階段
 * 
 * @param tenantId 租戶ID
 * @param reviewId 考核ID
 * @param stage 提交的階段 ('self_assessment' | 'manager_review' | 'approval')
 * @param userId 提交人用戶ID
 * @param req Express 請求對象 (用於操作日誌)
 */
export async function submitPerformanceReviewStage(
  tenantId: string,
  reviewId: string,
  stage: 'self_assessment' | 'manager_review' | 'approval',
  userId: string,
  req?: Request
): Promise<void> {
  const db = admin.firestore();
  const reviewRef = db.collection('performanceReviews').doc(reviewId);
  
  // 獲取考核記錄
  const reviewDoc = await reviewRef.get();
  if (!reviewDoc.exists) {
    throw new Error(`找不到ID為 ${reviewId} 的績效考核記錄`);
  }
  
  const review = reviewDoc.data() as PerformanceReview;
  
  // 檢查租戶權限
  if (review.tenantId !== tenantId) {
    throw new Error('無權限存取此績效考核記錄');
  }
  
  // 獲取當前時間
  const now = admin.firestore.Timestamp.now();
  
  // 根據提交的階段更新狀態和相關欄位
  let updateData: Record<string, any> = {
    updatedAt: now.toDate()
  };
  
  // 記錄原始狀態用於日誌
  const originalStatus = review.status;
  let newStatus: ReviewStatus | undefined;
  
  // 根據不同階段更新狀態
  if (stage === 'self_assessment') {
    // 檢查用戶是否為被考核員工
    if (review.employeeId !== userId) {
      throw new Error('只有被考核員工本人才能提交自我評估');
    }
    
    // 檢查當前狀態是否為等待自我評估
    if (review.status !== 'self_assessment') {
      throw new Error(`無法在 ${review.status} 狀態下提交自我評估`);
    }
    
    // 更新欄位
    updateData.selfAssessmentSubmittedAt = now.toDate();
    updateData.status = 'manager_review';
    newStatus = 'manager_review';
  }
  else if (stage === 'manager_review') {
    // 檢查用戶是否為考核經理
    if (review.managerId !== userId) {
      throw new Error('只有指定的考核經理才能提交經理評估');
    }
    
    // 檢查當前狀態是否為等待經理評估
    if (review.status !== 'manager_review') {
      throw new Error(`無法在 ${review.status} 狀態下提交經理評估`);
    }
    
    // 更新欄位
    updateData.managerReviewSubmittedAt = now.toDate();
    updateData.status = 'pending_approval';
    newStatus = 'pending_approval';
  }
  else if (stage === 'approval') {
    // 檢查用戶是否有權限審批（這裡假設存在一個審批者 ID 欄位）
    if (review.approverId !== userId) {
      throw new Error('只有指定的審批者才能進行審批');
    }
    
    // 檢查當前狀態是否為等待審批
    if (review.status !== 'pending_approval') {
      throw new Error(`無法在 ${review.status} 狀態下提交審批`);
    }
    
    // 更新欄位
    updateData.approvedAt = now.toDate();
    updateData.status = 'approved';
    newStatus = 'approved';
  }
  else {
    throw new Error(`不支援的階段: ${stage}`);
  }
  
  // 更新考核記錄
  await reviewRef.update(updateData);
  
  // 記錄操作日誌
  if (req && newStatus) {
    try {
      // 獲取員工姓名用於日誌
      const employeeRef = db.collection('employees').doc(review.employeeId);
      const employeeDoc = await employeeRef.get();
      const employeeName = employeeDoc.exists ? 
        (employeeDoc.data()?.name || employeeDoc.data()?.displayName || review.employeeId) : 
        review.employeeId;
      
      // 根據階段生成不同的操作描述
      let actionName = '';
      let statusMessage = '';
      
      switch (stage) {
        case 'self_assessment':
          actionName = 'performance_self_assessment_submit';
          statusMessage = '提交績效自我評估';
          break;
        case 'manager_review':
          actionName = 'performance_manager_review_submit';
          statusMessage = '提交績效經理評估';
          break;
        case 'approval':
          actionName = 'performance_review_approve';
          statusMessage = '審批績效評估';
          break;
      }
      
      await logAuditEvent({
        userId: userId,
        userName: req.user?.name || req.user?.displayName,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        tenantId: tenantId,
        
        action: actionName,
        status: AuditLogStatus.SUCCESS,
        statusMessage: statusMessage,
        
        targetEntityType: 'performance_review',
        targetEntityId: reviewId,
        targetEntityName: `${employeeName} - ${review.cycleId}`,
        
        details: { 
          employeeId: review.employeeId,
          employeeName,
          cycleId: review.cycleId,
          submittedStage: stage
        },
        previousState: { status: originalStatus },
        newState: { status: newStatus },
        
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }
  }
}

/**
 * 檢查是否允許更新考核記錄
 * 
 * @param review 考核記錄
 * @param userId 用戶ID
 * @param status 當前狀態
 * @param isSelfAssessment 是否更新自我評估部分
 * @returns 是否允許更新
 */
function canUpdateReview(
  review: PerformanceReview,
  userId: string,
  status: ReviewStatus,
  isSelfAssessment: boolean
): boolean {
  // 已最終確認的考核不能修改
  if (status === 'finalized' || status === 'approved') {
    return false;
  }
  
  // 員工只能在特定階段更新自評部分
  if (userId === review.employeeId) {
    if (isSelfAssessment) {
      return status === 'draft' || status === 'self_assessment';
    } else {
      // 員工不能修改非自評部分
      return false;
    }
  }
  
  // 主管可以在適當階段更新評核部分
  if (userId === review.reviewerId) {
    if (isSelfAssessment) {
      // 主管不能修改員工的自評部分
      return false;
    } else {
      return status === 'self_assessment' || status === 'manager_review' || status === 'pending_approval';
    }
  }
  
  // 其他用戶不能修改考核
  return false;
}

/**
 * 根據用戶身份和考核狀態過濾更新資料
 * 
 * @param review 考核記錄
 * @param userId 用戶ID
 * @param updateData 更新資料
 * @returns 過濾後的更新資料
 */
function filterUpdateData(
  review: PerformanceReview,
  userId: string,
  updateData: PerformanceReviewInput
): Record<string, any> {
  const filteredData: Record<string, any> = {};
  
  // 員工可以更新自評部分
  if (userId === review.employeeId) {
    if (updateData.selfAssessment) {
      filteredData.selfAssessment = updateData.selfAssessment;
    }
  }
  
  // 主管可以更新評核部分
  if (userId === review.reviewerId) {
    if (updateData.kpiAssessments) {
      filteredData.kpiAssessments = updateData.kpiAssessments;
    }
    if (updateData.overallRating !== undefined) {
      filteredData.overallRating = updateData.overallRating;
    }
    if (updateData.overallComments) {
      filteredData.overallComments = updateData.overallComments;
    }
    if (updateData.strengths) {
      filteredData.strengths = updateData.strengths;
    }
    if (updateData.improvements) {
      filteredData.improvements = updateData.improvements;
    }
  }
  
  return filteredData;
}

/**
 * 獲取員工的績效考核記錄列表
 * 
 * @param tenantId 租戶ID
 * @param employeeId 員工ID
 * @param limit 取回的最大記錄數（預設10）
 * @returns 考核記錄列表
 */
export async function getEmployeePerformanceReviews(
  tenantId: string,
  employeeId: string,
  limit: number = 10
): Promise<PerformanceReview[]> {
  const db = admin.firestore();
  
  const reviewsRef = db.collection('performanceReviews');
  const snapshot = await reviewsRef
    .where('tenantId', '==', tenantId)
    .where('employeeId', '==', employeeId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PerformanceReview[];
}

/**
 * 獲取主管需要評核的績效考核記錄列表
 * 
 * @param tenantId 租戶ID
 * @param reviewerId 評核主管ID
 * @param status 可選的狀態過濾
 * @param limit 取回的最大記錄數（預設20）
 * @returns 考核記錄列表
 */
export async function getReviewerPerformanceReviews(
  tenantId: string,
  reviewerId: string,
  status?: ReviewStatus,
  limit: number = 20
): Promise<PerformanceReview[]> {
  const db = admin.firestore();
  
  let query = db.collection('performanceReviews')
    .where('tenantId', '==', tenantId)
    .where('reviewerId', '==', reviewerId);
  
  if (status) {
    query = query.where('status', '==', status);
  }
  
  const snapshot = await query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as PerformanceReview[];
}

/**
 * 完成並確認績效考核結果
 * 
 * @param tenantId 租戶ID 
 * @param reviewId 考核ID
 * @param finalizerId 確認人用戶ID
 * @param finalComments 最終評語
 * @param req Express 請求對象 (用於操作日誌)
 */
export async function finalizePerformanceReview(
  tenantId: string,
  reviewId: string,
  finalizerId: string,
  finalComments?: string,
  req?: Request
): Promise<void> {
  const db = admin.firestore();
  const reviewRef = db.collection('performanceReviews').doc(reviewId);
  
  // 獲取考核記錄
  const reviewDoc = await reviewRef.get();
  if (!reviewDoc.exists) {
    throw new Error(`找不到ID為 ${reviewId} 的績效考核記錄`);
  }
  
  const review = reviewDoc.data() as PerformanceReview;
  
  // 檢查租戶權限
  if (review.tenantId !== tenantId) {
    throw new Error('無權限存取此績效考核記錄');
  }
  
  // 檢查當前狀態是否為已審批
  if (review.status !== 'approved') {
    throw new Error(`只有已審批的績效考核才能被確認，當前狀態: ${review.status}`);
  }
  
  // 檢查用戶是否有權限確認考核結果
  const hasPermission = await checkFinalizationPermission(tenantId, finalizerId, review);
  if (!hasPermission) {
    throw new Error('無權限確認此績效考核結果');
  }
  
  // 獲取當前時間
  const now = admin.firestore.Timestamp.now();
  
  // 更新考核記錄
  await reviewRef.update({
    status: 'finalized',
    finalizedAt: now.toDate(),
    finalizedBy: finalizerId,
    finalComments: finalComments,
    updatedAt: now.toDate()
  });
  
  // 記錄操作日誌
  if (req) {
    try {
      // 獲取員工姓名用於日誌
      const employeeRef = db.collection('employees').doc(review.employeeId);
      const employeeDoc = await employeeRef.get();
      const employeeName = employeeDoc.exists ? 
        (employeeDoc.data()?.name || employeeDoc.data()?.displayName || review.employeeId) : 
        review.employeeId;
      
      await logAuditEvent({
        userId: finalizerId,
        userName: req.user?.name || req.user?.displayName,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        tenantId: tenantId,
        
        action: 'performance_review_finalize',
        status: AuditLogStatus.SUCCESS,
        statusMessage: '確認績效評估結果',
        
        targetEntityType: 'performance_review',
        targetEntityId: reviewId,
        targetEntityName: `${employeeName} - ${review.cycleId}`,
        
        details: { 
          employeeId: review.employeeId,
          employeeName,
          cycleId: review.cycleId,
          overallRating: review.overallRating,
          finalComments
        },
        previousState: { status: review.status },
        newState: { status: 'finalized' },
        
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }
  }
}

/**
 * 檢查用戶是否有權限執行最終確認
 * 
 * @param tenantId 租戶ID
 * @param userId 用戶ID
 * @param review 考核記錄
 * @returns 是否有權限
 */
async function checkFinalizationPermission(
  tenantId: string,
  userId: string,
  review: PerformanceReview
): Promise<boolean> {
  const db = admin.firestore();
  
  // 檢查用戶角色權限
  // 這裡的實現示例假設有一個 userRoles 集合存儲用戶角色信息
  try {
    const userRoleDoc = await db.collection('userRoles')
      .where('tenantId', '==', tenantId)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    if (userRoleDoc.empty) {
      return false;
    }
    
    const userRole = userRoleDoc.docs[0].data();
    
    // 假設我們有以下角色有權限進行最終確認:
    // 1. HR角色
    // 2. 管理層用戶(manager, director, executive)
    // 3. 考核記錄的審批人
    const hasRequiredRole = 
      userRole.roles?.includes('hr') || 
      userRole.roles?.includes('manager') || 
      userRole.roles?.includes('director') || 
      userRole.roles?.includes('executive');
    
    const isApprover = review.approvedBy === userId;
    
    return hasRequiredRole || isApprover;
  } catch (error) {
    console.error('檢查最終確認權限時發生錯誤:', error);
    return false;
  }
}

const getStatusTransitionAllowed = (status: string, role: string): boolean => {
  switch (role) {
    case 'employee':
      return status === 'draft' || status === 'self_assessment';
    case 'manager':
      return status === 'draft' || status === 'manager_review' || status === 'pending_approval';
    case 'admin':
      return true;
    default:
      return false;
  }
}; 