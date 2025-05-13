/**
 * 內部溝通系統資料模型
 * 包含公告、知識庫和投票等功能的資料結構定義
 */

/**
 * 公告狀態枚舉
 */
export type AnnouncementStatus = 
  | 'draft'       // 草稿：尚未發布
  | 'published'   // 已發布：正在展示中
  | 'archived';   // 已歸檔：不再展示

/**
 * 公告重要性等級枚舉
 */
export enum ImportanceLevel {
  LOW = 'low',           // 一般：日常資訊
  MEDIUM = 'medium',     // 中等：需注意的資訊
  HIGH = 'high',         // 高：重要公告
  URGENT = 'urgent'      // 緊急：最高優先級
}

/**
 * 公告內容格式枚舉
 */
export type ContentFormatType = 'plain' | 'markdown' | 'html';

/**
 * 公告對象類型
 * 用於指定公告的目標對象
 */
export interface AnnouncementTarget {
  roles?: string[];        // 目標角色列表，例如：['manager', 'cashier']
  locations?: string[];    // 目標地點列表，例如：['台北店', '新竹店']
  departments?: string[];  // 目標部門列表，例如：['行銷', '人資']
  employeeIds?: string[];  // 特定員工ID列表（直接指定對象）
  isAllStaff: boolean;     // 是否面向所有員工
}

/**
 * 公告附件類型
 */
export interface AnnouncementAttachment {
  id: string;              // 附件ID
  fileName: string;        // 檔案名稱
  fileType: string;        // 檔案類型
  fileSize: number;        // 檔案大小（bytes）
  downloadUrl: string;     // 下載URL
  uploadedAt: Date;        // 上傳時間
}

/**
 * 公告確認追蹤
 * 用於追蹤哪些員工已閱讀公告
 */
export interface AnnouncementAcknowledgement {
  employeeId: string;      // 員工ID
  acknowledgedAt: Date;    // 確認時間
  deviceInfo?: string;     // 設備資訊（選填）
}

/**
 * 公告記錄
 * 儲存公告的詳細資訊
 */
export interface Announcement {
  id: string;                                   // 公告ID
  tenantId: string;                             // 租戶ID
  title: string;                                // 標題
  content: string;                              // 內容
  contentFormat: ContentFormatType;             // 內容格式
  summary?: string;                             // 摘要（選填）
  authorId: string;                             // 作者ID
  publisherId?: string;                         // 發布者ID（可能與作者不同）
  createdAt: Date;                              // 創建時間
  updatedAt: Date;                              // 更新時間
  publishedAt?: Date;                           // 發布時間
  expiresAt?: Date;                             // 過期時間（選填）
  status: AnnouncementStatus;                   // 狀態
  importance: ImportanceLevel;                  // 重要性等級
  target: AnnouncementTarget;                   // 目標對象
  attachments?: AnnouncementAttachment[];       // 附件列表（選填）
  acknowledgements?: AnnouncementAcknowledgement[]; // 確認追蹤（選填）
  isSticky?: boolean;                           // 是否置頂（選填）
  tags?: string[];                              // 標籤（選填）
  editHistory?: {                               // 編輯歷史（選填）
    editorId: string;                           // 編輯者ID
    editedAt: Date;                             // 編輯時間
    changeDescription?: string;                 // 變更描述
  }[];
}

/**
 * 公告輸入資料
 * 用於創建或更新公告
 */
export interface AnnouncementInput {
  tenantId: string;                             // 租戶ID
  title: string;                                // 標題
  content: string;                              // 內容
  contentFormat?: ContentFormatType;            // 內容格式（預設plain）
  summary?: string;                             // 摘要（選填）
  expiresAt?: Date;                             // 過期時間（選填）
  importance?: ImportanceLevel;                 // 重要性等級（預設MEDIUM）
  target?: Partial<AnnouncementTarget>;         // 目標對象（預設所有員工）
  attachments?: Omit<AnnouncementAttachment, 'id' | 'uploadedAt'>[]; // 附件
  isSticky?: boolean;                           // 是否置頂（選填）
  tags?: string[];                              // 標籤（選填）
}

/**
 * 知識庫文章狀態枚舉
 */
export type KbArticleStatus = 
  | 'draft'         // 草稿：撰寫中
  | 'review'        // 審核中：等待審核
  | 'published'     // 已發布：可被查看
  | 'archived';     // 已歸檔：不再顯示

/**
 * 知識庫文章分類
 */
export interface KbCategory {
  id: string;                 // 分類ID
  tenantId: string;           // 租戶ID
  name: string;               // 分類名稱
  description?: string;       // 分類描述（選填）
  parentCategoryId?: string;  // 父分類ID（選填，用於階層分類）
  iconUrl?: string;           // 分類圖標URL（選填）
  order: number;              // 排序順序
  createdAt: Date;            // 創建時間
  updatedAt: Date;            // 更新時間
  createdBy: string;          // 創建者ID
}

/**
 * 知識庫文章附件
 */
export interface KbAttachment {
  id: string;                 // 附件ID
  fileName: string;           // 檔案名稱
  fileType: string;           // 檔案類型（MIME類型）
  fileSize: number;           // 檔案大小（bytes）
  downloadUrl: string;        // 下載URL
  uploadedAt: Date;           // 上傳時間
}

/**
 * 知識庫文章評論
 */
export interface KbComment {
  id: string;                 // 評論ID
  authorId: string;           // 評論者ID
  content: string;            // 評論內容
  createdAt: Date;            // 創建時間
  updatedAt?: Date;           // 更新時間（選填）
  isEdited: boolean;          // 是否被編輯過
  parentCommentId?: string;   // 父評論ID（用於回覆）
}

/**
 * 知識庫文章版本歷史
 */
export interface KbVersionHistory {
  versionId: string;          // 版本ID
  title: string;              // 版本標題
  content: string;            // 版本內容
  editorId: string;           // 編輯者ID
  editedAt: Date;             // 編輯時間
  changeDescription?: string; // 變更描述
}

/**
 * 知識庫權限控制
 */
export interface KbPermission {
  viewRoles: string[];        // 可查看的角色列表
  editRoles: string[];        // 可編輯的角色列表
  isPublic: boolean;          // 是否對所有員工可見
}

/**
 * 知識庫文章
 */
export interface KnowledgeBaseArticle {
  id: string;                 // 文章ID
  tenantId: string;           // 租戶ID
  title: string;              // 標題
  content: string;            // 內容
  contentFormat: ContentFormatType; // 內容格式
  summary?: string;           // 摘要（選填）
  categoryId?: string;        // 分類ID（選填）
  authorId: string;           // 作者ID
  publisherId?: string;       // 發布者ID（可能與作者不同）
  status: KbArticleStatus;    // 狀態
  tags?: string[];            // 標籤（選填）
  relatedArticleIds?: string[]; // 相關文章ID（選填）
  viewCount: number;          // 查看次數
  likeCount: number;          // 讚數
  permissions: KbPermission;  // 權限設定
  attachments?: KbAttachment[]; // 附件列表（選填）
  comments?: KbComment[];     // 評論列表（選填）
  versionHistory?: KbVersionHistory[]; // 版本歷史（選填）
  createdAt: Date;            // 創建時間
  updatedAt: Date;            // 更新時間
  publishedAt?: Date;         // 發布時間（選填）
  archivedAt?: Date;          // 歸檔時間（選填）
  lastReviewedAt?: Date;      // 最後審核時間（選填）
}

/**
 * 知識庫文章輸入資料
 */
export interface KbArticleInput {
  tenantId: string;                     // 租戶ID
  title: string;                        // 標題
  content: string;                      // 內容
  contentFormat?: ContentFormatType;    // 內容格式（預設markdown）
  summary?: string;                     // 摘要（選填）
  categoryId?: string;                  // 分類ID（選填）
  tags?: string[];                      // 標籤（選填）
  relatedArticleIds?: string[];         // 相關文章ID（選填）
  permissions?: Partial<KbPermission>;  // 權限設定（選填）
  attachments?: Omit<KbAttachment, 'id' | 'uploadedAt'>[]; // 附件
}

/**
 * 知識庫分類輸入資料
 */
export interface KbCategoryInput {
  tenantId: string;           // 租戶ID
  name: string;               // 分類名稱
  description?: string;       // 分類描述（選填）
  parentCategoryId?: string;  // 父分類ID（選填）
  iconUrl?: string;           // 分類圖標URL（選填）
  order?: number;             // 排序順序（選填）
}

import { Timestamp } from 'firebase-admin/firestore';

// 內容類型枚舉
export enum ContentType {
  ANNOUNCEMENT = 'announcement',
  ARTICLE = 'article',
  DOCUMENT = 'document'
}

// 內容格式枚舉
export enum ContentFormat {
  MARKDOWN = 'markdown',
  HTML = 'html',
  PLAIN_TEXT = 'plain_text'
}

// 內容可見性枚舉
export enum ContentVisibility {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  RESTRICTED = 'restricted'
}

// 內容狀態枚舉
export enum ContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

// 內容介面
export interface Content {
  id: string;
  tenantId: string;
  storeId?: string;
  title: string;
  summary?: string;
  content: string;
  contentType: ContentType;
  contentFormat: ContentFormat;
  visibility: ContentVisibility;
  status: ContentStatus;
  tags?: string[];
  featuredImageUrl?: string;
  attachmentUrls?: string[];
  authorId: string;
  authorName?: string;
  publishedAt?: Timestamp | Date;
  expiresAt?: Timestamp | Date;
  viewCount?: number;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * 投票選項
 */
export interface PollOption {
  id: string;
  text: string;
  count: number;
}

/**
 * 投票狀態枚舉
 */
export type PollStatus = 'draft' | 'active' | 'closed' | 'archived';

/**
 * 投票結果
 */
export interface PollResult {
  optionId: string;
  optionText: string;
  count: number;
  percentage: number;
}

/**
 * 投票記錄
 */
export interface Poll {
  id: string;
  tenantId: string;
  storeId?: string;
  title: string;
  description?: string;
  options: PollOption[];
  status: PollStatus;
  isAnonymous: boolean;
  allowMultipleVotes: boolean;
  maxVotesPerUser: number;
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
  createdBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  totalVotes: number;
  results?: PollResult[];
}

/**
 * 投票創建輸入
 */
export interface PollInput {
  tenantId: string;
  storeId?: string;
  title: string;
  description?: string;
  options: { text: string }[];
  isAnonymous?: boolean;
  allowMultipleVotes?: boolean;
  maxVotesPerUser?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 投票表決
 */
export interface PollVote {
  id: string;
  pollId: string;
  tenantId: string;
  userId: string;
  optionIds: string[];
  votedAt: Timestamp | Date;
}

/**
 * 投票表決輸入
 */
export interface PollVoteInput {
  pollId: string;
  tenantId: string;
  optionIds: string[];
} 