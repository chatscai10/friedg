/**
 * 績效考核系統資料模型
 * 包含考核週期、員工考核記錄、KPI指標、晉升/降級記錄等核心資料結構
 */

/**
 * 考核週期
 * 定義考核期間、狀態等資訊
 */
export interface PerformanceReviewCycle {
  id: string;
  tenantId: string;           // 租戶ID
  name: string;               // 週期名稱，例如：「2025年Q2考核」
  startDate: Date;            // 開始日期
  endDate: Date;              // 結束日期
  status: ReviewCycleStatus;  // 狀態：準備中、進行中、已完成
  kpiTemplateId?: string;     // 關聯的KPI模板ID（選填）
  notes?: string;             // 備註（選填）
  createdAt: Date;            // 建立時間
  updatedAt: Date;            // 最後更新時間
}

/**
 * 考核週期狀態
 */
export type ReviewCycleStatus = 'preparing' | 'in_progress' | 'completed' | 'cancelled';

/**
 * 績效考核記錄
 * 記錄特定員工在特定考核週期的評估結果
 */
export interface PerformanceReview {
  id: string;
  tenantId: string;           // 租戶ID
  cycleId: string;            // 考核週期ID
  employeeId: string;         // 被考核員工ID
  reviewerId: string;         // 評核人ID
  managerId?: string;         // 經理ID
  approverId?: string;        // 審批者ID
  status: ReviewStatus;       // 考核狀態
  overallRating?: number;     // 總體評分（1-5分）
  overallComments?: string;   // 總體評語
  strengths?: string;         // 優點
  improvements?: string;      // 改進方向
  kpiAssessments: KpiAssessment[]; // KPI評估項目
  selfAssessment?: SelfAssessment; // 自我評估（選填）
  approvedBy?: string;        // 批准人ID（選填）
  approvedAt?: Date;          // 批准時間（選填）
  finalComments?: string;     // 最終評語（選填）
  createdAt: Date;            // 建立時間
  updatedAt: Date;            // 最後更新時間
}

/**
 * 考核狀態
 */
export type ReviewStatus = 'draft' | 'self_assessment' | 'manager_review' | 'pending_approval' | 'approved' | 'finalized';

/**
 * KPI評估項目
 */
export interface KpiAssessment {
  kpiId: string;              // KPI指標ID
  name: string;               // 指標名稱
  weight: number;             // 權重（百分比）
  target: number;             // 目標值
  actual?: number;            // 實際值（選填）
  rating: number;             // 評分（1-5分）
  comments?: string;          // 評語（選填）
}

/**
 * 員工自我評估
 */
export interface SelfAssessment {
  achievements: string;       // 成就與貢獻
  challenges: string;         // 面臨的挑戰
  improvements: string;       // 自我改進計劃
  careerGoals?: string;       // 職涯目標（選填）
  submittedAt: Date;          // 提交時間
}

/**
 * KPI指標模板
 * 定義考核週期中使用的考核指標集合
 */
export interface KpiTemplate {
  id: string;
  tenantId: string;           // 租戶ID
  name: string;               // 模板名稱，例如：「門市員工考核指標」
  description?: string;       // 描述（選填）
  indicators: KpiIndicator[]; // 考核指標清單
  isActive: boolean;          // 是否啟用
  createdAt: Date;            // 建立時間
  updatedAt: Date;            // 最後更新時間
}

/**
 * KPI指標定義
 */
export interface KpiIndicator {
  id: string;
  name: string;               // 指標名稱，例如：「顧客服務滿意度」
  description: string;        // 指標描述
  category: string;           // 類別，例如：「服務」、「銷售」、「團隊合作」
  measurementMethod: string;  // 衡量方法，例如：「顧客評價平均分數」
  weight: number;             // 權重（百分比）
  targetValue?: number;       // 目標值（選填）
  minimumValue?: number;      // 最低可接受值（選填）
  maximumValue?: number;      // 最高可達成值（選填）
  unit?: string;              // 單位，例如：「%」、「分」（選填）
}

/**
 * 績效目標
 * 員工個人設定的績效目標
 */
export interface PerformanceGoal {
  id: string;
  tenantId: string;           // 租戶ID
  employeeId: string;         // 員工ID
  cycleId: string;            // 考核週期ID
  title: string;              // 目標標題
  description: string;        // 目標描述
  category: string;           // 目標類別，例如：「業務拓展」、「技能提升」
  targetDate: Date;           // 預計完成日期
  status: GoalStatus;         // 目標狀態
  progress: number;           // 進度百分比（0-100）
  milestones?: Milestone[];   // 里程碑（選填）
  managerComments?: string;   // 主管評語（選填）
  createdAt: Date;            // 建立時間
  updatedAt: Date;            // 最後更新時間
}

/**
 * 目標狀態
 */
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';

/**
 * 目標里程碑
 */
export interface Milestone {
  title: string;              // 里程碑標題
  dueDate: Date;              // 預計完成日期
  isCompleted: boolean;       // 是否已完成
  completedAt?: Date;         // 完成時間（選填）
}

/**
 * 晉升/降級記錄
 * 記錄員工職位變動歷史
 */
export interface PromotionDemotionRecord {
  id: string;
  tenantId: string;           // 租戶ID
  employeeId: string;         // 員工ID
  type: 'promotion' | 'demotion'; // 類型：晉升或降級
  fromPosition: string;       // 原職位
  toPosition: string;         // 新職位
  fromRoleLevel: number;      // 原權限等級
  toRoleLevel: number;        // 新權限等級
  reason: string;             // 變動原因
  relatedReviewId?: string;   // 關聯的績效考核ID（選填）
  effectiveDate: Date;        // 生效日期
  approvedBy: string;         // 批准人ID
  notes?: string;             // 備註（選填）
  createdAt: Date;            // 建立時間
}

/**
 * 晉升/降級投票
 * 用於團隊共同決策的投票記錄
 */
export interface PositionChangeVote {
  id: string;
  tenantId: string;           // 租戶ID
  candidateId: string;        // 候選人（被晉升/降級者）ID
  type: 'promotion' | 'demotion'; // 類型：晉升或降級
  fromPosition: string;       // 原職位
  toPosition: string;         // 目標職位
  initiatedBy: string;        // 發起人ID
  status: VoteStatus;         // 投票狀態
  startDate: Date;            // 開始日期
  endDate: Date;              // 結束日期
  requiredVotes: number;      // 所需投票數
  votes: Vote[];              // 投票記錄
  result?: 'approved' | 'rejected'; // 投票結果（選填）
  notes?: string;             // 備註（選填）
  createdAt: Date;            // 建立時間
  updatedAt: Date;            // 最後更新時間
}

/**
 * 投票狀態
 */
export type VoteStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

/**
 * 投票記錄
 */
export interface Vote {
  voterId: string;            // 投票人ID
  decision: 'approve' | 'reject'; // 決定：同意或拒絕
  comments?: string;          // 評語（選填）
  votedAt: Date;              // 投票時間
} 