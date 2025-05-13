/**
 * 顧客評價系統資料模型
 * 主要用於LINE Bot收集顧客評價並儲存至Firestore
 */

/**
 * 問卷模板
 * 用於定義動態問卷的結構
 */
export interface FeedbackQuestionnaire {
  id: string;
  tenantId: string;           // 租戶ID
  title: string;              // 問卷標題
  description?: string;       // 問卷描述
  questions: QuestionItem[];  // 問題列表
  isActive: boolean;          // 是否啟用
  createdAt: Date;            // 建立時間
  updatedAt: Date;            // 最後更新時間
}

/**
 * 問卷問題項目
 */
export interface QuestionItem {
  id: string;                 // 問題ID
  questionText: string;       // 問題文字
  questionType: QuestionType; // 問題類型
  isRequired: boolean;        // 是否必填
  options?: string[];         // 選項列表（僅用於選擇題）
  order: number;              // 問題順序
}

/**
 * 問題類型枚舉
 */
export type QuestionType = 
  | 'rating'        // 評分題（1-5分）
  | 'text'          // 文字回答
  | 'singleChoice'  // 單選題
  | 'multiChoice'   // 多選題
  | 'boolean';      // 是/否問題

/**
 * 顧客評價記錄
 * 儲存顧客提交的評價內容
 */
export interface CustomerFeedback {
  id: string;
  tenantId: string;             // 租戶ID
  lineUserId: string;           // LINE用戶ID
  questionnaireId: string;      // 問卷模板ID
  storeId?: string;             // 店鋪ID（選填）
  orderId?: string;             // 訂單ID（選填）
  employeeId?: string;          // 服務人員ID（選填）
  answers: QuestionAnswer[];    // 回答列表
  overallRating?: number;       // 整體評分（1-5分）
  additionalComments?: string;  // 附加意見
  status: FeedbackStatus;       // 狀態
  feedbackChannel: 'line_bot' | 'web' | 'app' | 'pos'; // 評價來源渠道
  createdAt: Date;              // 建立時間
  completedAt?: Date;           // 完成時間（選填）
}

/**
 * 問題回答
 */
export interface QuestionAnswer {
  questionId: string;           // 問題ID
  questionText: string;         // 問題文字
  answerType: QuestionType;     // 回答類型（對應問題類型）
  textAnswer?: string;          // 文字回答
  ratingAnswer?: number;        // 評分回答（1-5分）
  choiceAnswers?: string[];     // 選擇題回答（選項列表）
  booleanAnswer?: boolean;      // 是/否回答
}

/**
 * 評價狀態枚舉
 */
export type FeedbackStatus = 
  | 'in_progress'  // 進行中（尚未完成所有問題）
  | 'completed'    // 已完成
  | 'abandoned';   // 已放棄（用戶中途離開未完成）

/**
 * LINE Bot互動追蹤
 * 用於追蹤與LINE用戶的互動狀態
 */
export interface LineBotInteraction {
  id: string;
  lineUserId: string;           // LINE用戶ID
  currentState: BotState;       // 當前狀態
  questionnaireId?: string;     // 進行中的問卷ID
  currentQuestionIndex?: number;// 當前問題索引
  feedback?: Partial<CustomerFeedback>; // 進行中的評價資料
  lastInteractionAt: Date;      // 最後互動時間
  createdAt: Date;              // 建立時間
}

/**
 * LINE Bot狀態機狀態
 */
export type BotState = 
  | 'idle'            // 閒置狀態
  | 'greeting'        // 問候狀態
  | 'collecting_info' // 收集基本資訊
  | 'asking_question' // 詢問問卷問題
  | 'confirming'      // 確認評價
  | 'completed'       // 已完成
  | 'fallback';       // 意外狀態/無法理解 