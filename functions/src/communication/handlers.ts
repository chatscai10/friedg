import * as admin from 'firebase-admin';
import { 
  Announcement, 
  AnnouncementStatus, 
  AnnouncementInput, 
  ImportanceLevel, 
  ContentFormat,
  KnowledgeBaseArticle,
  KbArticleStatus,
  KbArticleInput,
  KbCategory,
  KbCategoryInput,
  KbPermission,
  KbVersionHistory,
  Poll,
  PollOption,
  PollStatus,
  PollInput,
  PollVote,
  PollVoteInput,
  PollResult
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 創建新公告
 * 
 * @param announcementData 公告輸入資料
 * @param authorId 作者ID
 * @returns 新創建的公告
 */
export async function createAnnouncement(
  announcementData: AnnouncementInput,
  authorId: string
): Promise<Announcement> {
  const db = admin.firestore();
  
  // 驗證輸入資料
  if (!announcementData.title || !announcementData.content) {
    throw new Error('公告必須包含標題與內容');
  }
  
  if (!announcementData.tenantId) {
    throw new Error('必須指定租戶ID');
  }
  
  // 獲取當前時間
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 創建新公告記錄，設置默認值並填入資料
  const newAnnouncement: Omit<Announcement, 'id'> = {
    tenantId: announcementData.tenantId,
    title: announcementData.title,
    content: announcementData.content,
    contentFormat: announcementData.contentFormat || 'plain',
    summary: announcementData.summary,
    authorId: authorId,
    createdAt: now,
    updatedAt: now,
    status: 'draft',  // 初始狀態為草稿
    importance: announcementData.importance || ImportanceLevel.MEDIUM,
    target: {
      isAllStaff: announcementData.target?.isAllStaff !== undefined 
        ? announcementData.target.isAllStaff 
        : true,  // 默認針對所有員工
      roles: announcementData.target?.roles || [],
      locations: announcementData.target?.locations || [],
      departments: announcementData.target?.departments || [],
      employeeIds: announcementData.target?.employeeIds || []
    },
    isSticky: announcementData.isSticky || false,
    tags: announcementData.tags || []
  };
  
  // 如果有過期時間，加入過期時間
  if (announcementData.expiresAt) {
    newAnnouncement.expiresAt = announcementData.expiresAt;
  }
  
  // 處理附件
  if (announcementData.attachments && announcementData.attachments.length > 0) {
    newAnnouncement.attachments = announcementData.attachments.map(attachment => ({
      id: uuidv4(),  // 生成唯一ID
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      downloadUrl: attachment.downloadUrl,
      uploadedAt: now
    }));
  }
  
  // 寫入Firestore
  const announcementsRef = db.collection('announcements');
  const docRef = await announcementsRef.add(newAnnouncement);
  
  // 返回完整的公告記錄（包含ID）
  return {
    ...newAnnouncement,
    id: docRef.id
  };
}

/**
 * 發布公告
 * 
 * @param tenantId 租戶ID
 * @param announcementId 公告ID
 * @param publisherId 發布者ID
 */
export async function publishAnnouncement(
  tenantId: string,
  announcementId: string,
  publisherId: string
): Promise<void> {
  const db = admin.firestore();
  const announcementRef = db.collection('announcements').doc(announcementId);
  
  // 獲取當前公告記錄
  const announcementDoc = await announcementRef.get();
  if (!announcementDoc.exists) {
    throw new Error(`找不到ID為 ${announcementId} 的公告`);
  }
  
  const announcementData = announcementDoc.data() as Omit<Announcement, 'id'>;
  
  // 檢查租戶權限
  if (announcementData.tenantId !== tenantId) {
    throw new Error('無權限存取此公告');
  }
  
  // 檢查公告狀態
  if (announcementData.status !== 'draft') {
    throw new Error(`無法發布當前狀態為 ${announcementData.status} 的公告，只能發布處於草稿狀態的公告`);
  }
  
  // 更新公告狀態為已發布
  const now = admin.firestore.Timestamp.now().toDate();
  
  await announcementRef.update({
    status: 'published',
    publisherId: publisherId,
    publishedAt: now,
    updatedAt: now
  });
}

/**
 * 獲取公告列表
 * 
 * @param tenantId 租戶ID
 * @param filters 過濾條件
 * @param limit 取回的最大記錄數（預設20）
 * @returns 公告列表
 */
export async function getAnnouncements(
  tenantId: string,
  filters?: { 
    status?: AnnouncementStatus, 
    targetRole?: string, 
    targetLocation?: string,
    targetDepartment?: string,
    importance?: ImportanceLevel,
    isSticky?: boolean,
    tags?: string[]
  },
  limit: number = 20
): Promise<Announcement[]> {
  const db = admin.firestore();
  
  // 建立基本查詢
  let query = db.collection('announcements')
    .where('tenantId', '==', tenantId);
  
  // 根據過濾條件添加查詢條件
  
  // 1. 狀態過濾
  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  } else {
    // 默認只返回已發布的公告
    query = query.where('status', '==', 'published');
  }
  
  // 2. 重要性過濾
  if (filters?.importance) {
    query = query.where('importance', '==', filters.importance);
  }
  
  // 3. 是否置頂過濾
  if (filters?.isSticky !== undefined) {
    query = query.where('isSticky', '==', filters.isSticky);
  }
  
  // 執行查詢
  const snapshot = await query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  // 處理查詢結果
  let announcements = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Announcement[];
  
  // 針對角色、地點和部門進行前端過濾
  // 注意：理想情況下應在數據庫層面進行過濾，但Firestore對陣列查詢有限制
  // 如果陣列數量巨大，應考慮其他過濾機制
  if (filters?.targetRole || filters?.targetLocation || filters?.targetDepartment) {
    announcements = announcements.filter(announcement => {
      // 如果公告面向所有員工，則不論過濾條件都包含
      if (announcement.target.isAllStaff) {
        return true;
      }
      
      // 角色過濾
      if (filters.targetRole && 
          announcement.target.roles && 
          announcement.target.roles.includes(filters.targetRole)) {
        return true;
      }
      
      // 地點過濾
      if (filters.targetLocation && 
          announcement.target.locations && 
          announcement.target.locations.includes(filters.targetLocation)) {
        return true;
      }
      
      // 部門過濾
      if (filters.targetDepartment && 
          announcement.target.departments && 
          announcement.target.departments.includes(filters.targetDepartment)) {
        return true;
      }
      
      return false;
    });
  }
  
  // 標籤過濾
  if (filters?.tags && filters.tags.length > 0) {
    announcements = announcements.filter(announcement => {
      if (!announcement.tags) return false;
      
      // 檢查是否包含任一指定標籤
      return filters.tags!.some(tag => announcement.tags!.includes(tag));
    });
  }
  
  return announcements;
}

/**
 * 獲取單個公告詳情
 * 
 * @param tenantId 租戶ID
 * @param announcementId 公告ID
 * @returns 公告詳情或null
 */
export async function getAnnouncementById(
  tenantId: string,
  announcementId: string
): Promise<Announcement | null> {
  const db = admin.firestore();
  
  const announcementRef = db.collection('announcements').doc(announcementId);
  const announcementDoc = await announcementRef.get();
  
  if (!announcementDoc.exists) {
    return null;
  }
  
  const announcementData = announcementDoc.data() as Omit<Announcement, 'id'>;
  
  // 檢查租戶權限
  if (announcementData.tenantId !== tenantId) {
    throw new Error('無權限存取此公告');
  }
  
  // 返回完整公告資料（包含ID）
  return {
    ...announcementData,
    id: announcementDoc.id
  } as Announcement;
}

/**
 * 更新公告內容
 * 
 * @param tenantId 租戶ID
 * @param announcementId 公告ID
 * @param updateData 更新資料
 * @param editorId 編輯者ID
 * @param changeDescription 變更描述（選填）
 */
export async function updateAnnouncement(
  tenantId: string,
  announcementId: string,
  updateData: Partial<AnnouncementInput>,
  editorId: string,
  changeDescription?: string
): Promise<void> {
  const db = admin.firestore();
  const announcementRef = db.collection('announcements').doc(announcementId);
  
  // 獲取當前公告記錄
  const announcementDoc = await announcementRef.get();
  if (!announcementDoc.exists) {
    throw new Error(`找不到ID為 ${announcementId} 的公告`);
  }
  
  const announcementData = announcementDoc.data() as Announcement;
  
  // 檢查租戶權限
  if (announcementData.tenantId !== tenantId) {
    throw new Error('無權限存取此公告');
  }
  
  // 檢查公告狀態，已發布或歸檔的公告不能編輯
  if (announcementData.status !== 'draft') {
    throw new Error(`無法編輯當前狀態為 ${announcementData.status} 的公告，只能編輯處於草稿狀態的公告`);
  }
  
  // 準備更新資料
  const now = admin.firestore.Timestamp.now().toDate();
  const updatePayload: Record<string, any> = {
    updatedAt: now
  };
  
  // 更新基本欄位
  if (updateData.title) updatePayload.title = updateData.title;
  if (updateData.content) updatePayload.content = updateData.content;
  if (updateData.contentFormat) updatePayload.contentFormat = updateData.contentFormat;
  if (updateData.summary !== undefined) updatePayload.summary = updateData.summary;
  if (updateData.expiresAt !== undefined) updatePayload.expiresAt = updateData.expiresAt;
  if (updateData.importance) updatePayload.importance = updateData.importance;
  if (updateData.isSticky !== undefined) updatePayload.isSticky = updateData.isSticky;
  if (updateData.tags) updatePayload.tags = updateData.tags;
  
  // 更新目標對象
  if (updateData.target) {
    // 合併現有目標對象和更新資料
    const updatedTarget = {
      ...announcementData.target
    };
    
    if (updateData.target.isAllStaff !== undefined) {
      updatedTarget.isAllStaff = updateData.target.isAllStaff;
    }
    
    if (updateData.target.roles) {
      updatedTarget.roles = updateData.target.roles;
    }
    
    if (updateData.target.locations) {
      updatedTarget.locations = updateData.target.locations;
    }
    
    if (updateData.target.departments) {
      updatedTarget.departments = updateData.target.departments;
    }
    
    if (updateData.target.employeeIds) {
      updatedTarget.employeeIds = updateData.target.employeeIds;
    }
    
    updatePayload.target = updatedTarget;
  }
  
  // 處理附件更新
  if (updateData.attachments) {
    const updatedAttachments = updateData.attachments.map(attachment => ({
      id: uuidv4(),  // 生成唯一ID
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      downloadUrl: attachment.downloadUrl,
      uploadedAt: now
    }));
    
    updatePayload.attachments = updatedAttachments;
  }
  
  // 記錄編輯歷史
  const editHistoryEntry = {
    editorId: editorId,
    editedAt: now,
    changeDescription: changeDescription || '更新公告內容'
  };
  
  // 使用arrayUnion添加到編輯歷史陣列
  updatePayload['editHistory'] = admin.firestore.FieldValue.arrayUnion(editHistoryEntry);
  
  // 執行更新
  await announcementRef.update(updatePayload);
}

/**
 * 歸檔公告
 * 
 * @param tenantId 租戶ID
 * @param announcementId 公告ID
 * @param archiverId 歸檔操作者ID
 */
export async function archiveAnnouncement(
  tenantId: string,
  announcementId: string,
  archiverId: string
): Promise<void> {
  const db = admin.firestore();
  const announcementRef = db.collection('announcements').doc(announcementId);
  
  // 獲取當前公告記錄
  const announcementDoc = await announcementRef.get();
  if (!announcementDoc.exists) {
    throw new Error(`找不到ID為 ${announcementId} 的公告`);
  }
  
  const announcementData = announcementDoc.data() as Omit<Announcement, 'id'>;
  
  // 檢查租戶權限
  if (announcementData.tenantId !== tenantId) {
    throw new Error('無權限存取此公告');
  }
  
  // 檢查公告狀態，已歸檔的公告不能再次歸檔
  if (announcementData.status === 'archived') {
    throw new Error('此公告已經歸檔');
  }
  
  // 更新公告狀態為已歸檔
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 記錄歸檔操作到編輯歷史
  const editHistoryEntry = {
    editorId: archiverId,
    editedAt: now,
    changeDescription: '將公告歸檔'
  };
  
  await announcementRef.update({
    status: 'archived',
    updatedAt: now,
    // 使用arrayUnion添加到編輯歷史陣列
    editHistory: admin.firestore.FieldValue.arrayUnion(editHistoryEntry)
  });
}

/**
 * 記錄公告已被閱讀
 * 
 * @param tenantId 租戶ID
 * @param announcementId 公告ID
 * @param employeeId 員工ID
 * @param deviceInfo 設備資訊（選填）
 */
export async function acknowledgeAnnouncement(
  tenantId: string,
  announcementId: string,
  employeeId: string,
  deviceInfo?: string
): Promise<void> {
  const db = admin.firestore();
  const announcementRef = db.collection('announcements').doc(announcementId);
  
  // 獲取當前公告記錄
  const announcementDoc = await announcementRef.get();
  if (!announcementDoc.exists) {
    throw new Error(`找不到ID為 ${announcementId} 的公告`);
  }
  
  const announcementData = announcementDoc.data() as Omit<Announcement, 'id'>;
  
  // 檢查租戶權限
  if (announcementData.tenantId !== tenantId) {
    throw new Error('無權限存取此公告');
  }
  
  // 檢查公告狀態，只有已發布的公告可以被閱讀確認
  if (announcementData.status !== 'published') {
    throw new Error(`無法確認閱讀當前狀態為 ${announcementData.status} 的公告，只能確認已發布的公告`);
  }
  
  // 創建確認記錄
  const now = admin.firestore.Timestamp.now().toDate();
  const acknowledgement = {
    employeeId: employeeId,
    acknowledgedAt: now,
    deviceInfo: deviceInfo
  };
  
  // 更新公告的閱讀確認記錄
  await announcementRef.update({
    acknowledgements: admin.firestore.FieldValue.arrayUnion(acknowledgement)
  });
}

// ===================== 知識庫文章 CRUD 函式 ===================== //

/**
 * 創建新知識庫文章
 * 
 * @param articleData 文章輸入資料
 * @param authorId 作者ID
 * @returns 新創建的知識庫文章
 */
export async function createKbArticle(
  articleData: KbArticleInput,
  authorId: string
): Promise<KnowledgeBaseArticle> {
  const db = admin.firestore();
  
  // 驗證輸入資料
  if (!articleData.title || !articleData.content) {
    throw new Error('文章必須包含標題與內容');
  }
  
  if (!articleData.tenantId) {
    throw new Error('必須指定租戶ID');
  }
  
  // 獲取當前時間
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 設置預設的權限設定
  const defaultPermissions: KbPermission = {
    viewRoles: articleData.permissions?.viewRoles || ['all'],  // 預設所有人可查看
    editRoles: articleData.permissions?.editRoles || ['admin', 'manager'],  // 預設管理員和經理可編輯
    isPublic: articleData.permissions?.isPublic !== undefined ? articleData.permissions.isPublic : true  // 預設公開
  };
  
  // 創建新文章記錄
  const newArticle: Omit<KnowledgeBaseArticle, 'id'> = {
    tenantId: articleData.tenantId,
    title: articleData.title,
    content: articleData.content,
    contentFormat: articleData.contentFormat || 'markdown',  // 預設使用markdown格式
    summary: articleData.summary,
    categoryId: articleData.categoryId,
    authorId: authorId,
    status: 'draft',  // 初始狀態為草稿
    tags: articleData.tags || [],
    relatedArticleIds: articleData.relatedArticleIds || [],
    viewCount: 0,  // 初始查看次數為0
    likeCount: 0,  // 初始讚數為0
    permissions: defaultPermissions,
    createdAt: now,
    updatedAt: now
  };
  
  // 處理附件
  if (articleData.attachments && articleData.attachments.length > 0) {
    newArticle.attachments = articleData.attachments.map(attachment => ({
      id: uuidv4(),  // 生成唯一ID
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      downloadUrl: attachment.downloadUrl,
      uploadedAt: now
    }));
  }
  
  // 初始化空的評論列表
  newArticle.comments = [];
  
  // 初始化空的版本歷史
  newArticle.versionHistory = [{
    versionId: uuidv4(),
    title: articleData.title,
    content: articleData.content,
    editorId: authorId,
    editedAt: now,
    changeDescription: '創建初始版本'
  }];
  
  // 寫入Firestore
  const articlesRef = db.collection('knowledgeBaseArticles');
  const docRef = await articlesRef.add(newArticle);
  
  // 返回完整的文章記錄（包含ID）
  return {
    ...newArticle,
    id: docRef.id
  };
}

/**
 * 發布知識庫文章
 * 
 * @param tenantId 租戶ID
 * @param articleId 文章ID
 * @param publisherId 發布者ID
 */
export async function publishKbArticle(
  tenantId: string,
  articleId: string,
  publisherId: string
): Promise<void> {
  const db = admin.firestore();
  const articleRef = db.collection('knowledgeBaseArticles').doc(articleId);
  
  // 獲取當前文章記錄
  const articleDoc = await articleRef.get();
  if (!articleDoc.exists) {
    throw new Error(`找不到ID為 ${articleId} 的知識庫文章`);
  }
  
  const articleData = articleDoc.data() as Omit<KnowledgeBaseArticle, 'id'>;
  
  // 檢查租戶權限
  if (articleData.tenantId !== tenantId) {
    throw new Error('無權限存取此文章');
  }
  
  // 檢查文章狀態
  if (articleData.status !== 'draft' && articleData.status !== 'review') {
    throw new Error(`無法發布當前狀態為 ${articleData.status} 的文章，只能發布處於草稿或審核狀態的文章`);
  }
  
  // 更新文章狀態為已發布
  const now = admin.firestore.Timestamp.now().toDate();
  
  await articleRef.update({
    status: 'published',
    publisherId: publisherId,
    publishedAt: now,
    updatedAt: now
  });
}

/**
 * 獲取知識庫文章列表
 * 
 * @param tenantId 租戶ID
 * @param filters 過濾條件
 * @param userRoles 當前用戶角色
 * @param limit 取回的最大記錄數（預設20）
 * @returns 文章列表
 */
export async function getKbArticles(
  tenantId: string,
  filters?: { 
    status?: KbArticleStatus, 
    categoryId?: string,
    tags?: string[],
    searchText?: string
  },
  userRoles: string[] = ['all'],
  limit: number = 20
): Promise<KnowledgeBaseArticle[]> {
  const db = admin.firestore();
  
  // 建立基本查詢
  let query = db.collection('knowledgeBaseArticles')
    .where('tenantId', '==', tenantId);
  
  // 根據過濾條件添加查詢條件
  
  // 1. 狀態過濾
  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  } else {
    // 默認只返回已發布的文章
    query = query.where('status', '==', 'published');
  }
  
  // 2. 分類過濾
  if (filters?.categoryId) {
    query = query.where('categoryId', '==', filters.categoryId);
  }
  
  // 執行查詢
  const snapshot = await query
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();
  
  // 處理查詢結果
  let articles = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as KnowledgeBaseArticle[];
  
  // 根據用戶角色過濾可見的文章
  articles = articles.filter(article => {
    // 檢查用戶是否有權限查看
    if (article.permissions.isPublic) {
      return true;  // 公開文章所有人可見
    }
    
    // 檢查用戶角色是否有權查看
    return article.permissions.viewRoles.some(role => userRoles.includes(role));
  });
  
  // 標籤過濾
  if (filters?.tags && filters.tags.length > 0) {
    articles = articles.filter(article => {
      if (!article.tags) return false;
      
      // 檢查是否包含任一指定標籤
      return filters.tags!.some(tag => article.tags!.includes(tag));
    });
  }
  
  // 文本搜索過濾（簡單實現，實際可能需要更複雜的全文搜索）
  if (filters?.searchText && filters.searchText.trim() !== '') {
    const searchText = filters.searchText.toLowerCase();
    articles = articles.filter(article => 
      article.title.toLowerCase().includes(searchText) ||
      article.content.toLowerCase().includes(searchText) ||
      (article.summary && article.summary.toLowerCase().includes(searchText))
    );
  }
  
  return articles;
}

/**
 * 獲取單個知識庫文章詳情
 * 
 * @param tenantId 租戶ID
 * @param articleId 文章ID
 * @param userRoles 當前用戶角色
 * @param incrementViewCount 是否增加查看次數
 * @returns 文章詳情或null
 */
export async function getKbArticleById(
  tenantId: string,
  articleId: string,
  userRoles: string[] = ['all'],
  incrementViewCount: boolean = true
): Promise<KnowledgeBaseArticle | null> {
  const db = admin.firestore();
  
  const articleRef = db.collection('knowledgeBaseArticles').doc(articleId);
  const articleDoc = await articleRef.get();
  
  if (!articleDoc.exists) {
    return null;
  }
  
  const articleData = articleDoc.data() as Omit<KnowledgeBaseArticle, 'id'>;
  
  // 檢查租戶權限
  if (articleData.tenantId !== tenantId) {
    throw new Error('無權限存取此文章');
  }
  
  // 檢查用戶是否有權限查看
  const canView = articleData.permissions.isPublic || 
                  articleData.permissions.viewRoles.some(role => userRoles.includes(role));
  
  if (!canView) {
    throw new Error('您沒有權限查看此文章');
  }
  
  // 增加查看次數（如果需要）
  if (incrementViewCount && articleData.status === 'published') {
    await articleRef.update({
      viewCount: admin.firestore.FieldValue.increment(1)
    });
    
    // 更新本地數據
    articleData.viewCount++;
  }
  
  // 返回完整文章資料（包含ID）
  return {
    ...articleData,
    id: articleDoc.id
  } as KnowledgeBaseArticle;
}

/**
 * 更新知識庫文章內容
 * 
 * @param tenantId 租戶ID
 * @param articleId 文章ID
 * @param updateData 更新資料
 * @param editorId 編輯者ID
 * @param userRoles 當前用戶角色
 * @param changeDescription 變更描述（選填）
 */
export async function updateKbArticle(
  tenantId: string,
  articleId: string,
  updateData: Partial<KbArticleInput>,
  editorId: string,
  userRoles: string[] = [],
  changeDescription?: string
): Promise<void> {
  const db = admin.firestore();
  const articleRef = db.collection('knowledgeBaseArticles').doc(articleId);
  
  // 獲取當前文章記錄
  const articleDoc = await articleRef.get();
  if (!articleDoc.exists) {
    throw new Error(`找不到ID為 ${articleId} 的知識庫文章`);
  }
  
  const articleData = articleDoc.data() as KnowledgeBaseArticle;
  
  // 檢查租戶權限
  if (articleData.tenantId !== tenantId) {
    throw new Error('無權限存取此文章');
  }
  
  // 檢查用戶是否有權限編輯
  const canEdit = articleData.authorId === editorId || 
                 articleData.permissions.editRoles.some(role => userRoles.includes(role));
  
  if (!canEdit) {
    throw new Error('您沒有權限編輯此文章');
  }
  
  // 檢查文章狀態，已歸檔的文章不能編輯
  if (articleData.status === 'archived') {
    throw new Error('已歸檔的文章不能編輯');
  }
  
  // 準備更新資料
  const now = admin.firestore.Timestamp.now().toDate();
  const updatePayload: Record<string, any> = {
    updatedAt: now
  };
  
  // 更新基本欄位
  if (updateData.title) updatePayload.title = updateData.title;
  if (updateData.content) updatePayload.content = updateData.content;
  if (updateData.contentFormat) updatePayload.contentFormat = updateData.contentFormat;
  if (updateData.summary !== undefined) updatePayload.summary = updateData.summary;
  if (updateData.categoryId !== undefined) updatePayload.categoryId = updateData.categoryId;
  if (updateData.tags) updatePayload.tags = updateData.tags;
  if (updateData.relatedArticleIds) updatePayload.relatedArticleIds = updateData.relatedArticleIds;
  
  // 更新權限設定
  if (updateData.permissions) {
    // 合併現有權限和更新資料
    const updatedPermissions = {
      ...articleData.permissions
    };
    
    if (updateData.permissions.viewRoles) {
      updatedPermissions.viewRoles = updateData.permissions.viewRoles;
    }
    
    if (updateData.permissions.editRoles) {
      updatedPermissions.editRoles = updateData.permissions.editRoles;
    }
    
    if (updateData.permissions.isPublic !== undefined) {
      updatedPermissions.isPublic = updateData.permissions.isPublic;
    }
    
    updatePayload.permissions = updatedPermissions;
  }
  
  // 處理附件更新
  if (updateData.attachments) {
    const updatedAttachments = updateData.attachments.map(attachment => ({
      id: uuidv4(),  // 生成唯一ID
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      downloadUrl: attachment.downloadUrl,
      uploadedAt: now
    }));
    
    updatePayload.attachments = updatedAttachments;
  }
  
  // 如果標題或內容有更新，記錄新版本
  if (updateData.title || updateData.content) {
    // 創建版本歷史記錄
    const versionEntry: KbVersionHistory = {
      versionId: uuidv4(),
      title: updateData.title || articleData.title,
      content: updateData.content || articleData.content,
      editorId: editorId,
      editedAt: now,
      changeDescription: changeDescription || '更新文章內容'
    };
    
    // 使用arrayUnion添加到版本歷史陣列
    updatePayload['versionHistory'] = admin.firestore.FieldValue.arrayUnion(versionEntry);
  }
  
  // 執行更新
  await articleRef.update(updatePayload);
}

/**
 * 送審知識庫文章
 * 
 * @param tenantId 租戶ID
 * @param articleId 文章ID
 * @param submitterId 提交者ID
 */
export async function submitKbArticleForReview(
  tenantId: string,
  articleId: string,
  submitterId: string
): Promise<void> {
  const db = admin.firestore();
  const articleRef = db.collection('knowledgeBaseArticles').doc(articleId);
  
  // 獲取當前文章記錄
  const articleDoc = await articleRef.get();
  if (!articleDoc.exists) {
    throw new Error(`找不到ID為 ${articleId} 的知識庫文章`);
  }
  
  const articleData = articleDoc.data() as Omit<KnowledgeBaseArticle, 'id'>;
  
  // 檢查租戶權限
  if (articleData.tenantId !== tenantId) {
    throw new Error('無權限存取此文章');
  }
  
  // 檢查提交者是否為文章作者
  if (articleData.authorId !== submitterId) {
    throw new Error('只有文章作者可以提交審核');
  }
  
  // 檢查文章狀態
  if (articleData.status !== 'draft') {
    throw new Error(`無法提交當前狀態為 ${articleData.status} 的文章，只能提交處於草稿狀態的文章`);
  }
  
  // 更新文章狀態為審核中
  const now = admin.firestore.Timestamp.now().toDate();
  
  await articleRef.update({
    status: 'review',
    updatedAt: now,
    lastReviewedAt: now
  });
}

/**
 * 歸檔知識庫文章
 * 
 * @param tenantId 租戶ID
 * @param articleId 文章ID
 * @param archiverId 歸檔操作者ID
 * @param userRoles 當前用戶角色
 */
export async function archiveKbArticle(
  tenantId: string,
  articleId: string,
  archiverId: string,
  userRoles: string[] = []
): Promise<void> {
  const db = admin.firestore();
  const articleRef = db.collection('knowledgeBaseArticles').doc(articleId);
  
  // 獲取當前文章記錄
  const articleDoc = await articleRef.get();
  if (!articleDoc.exists) {
    throw new Error(`找不到ID為 ${articleId} 的知識庫文章`);
  }
  
  const articleData = articleDoc.data() as Omit<KnowledgeBaseArticle, 'id'>;
  
  // 檢查租戶權限
  if (articleData.tenantId !== tenantId) {
    throw new Error('無權限存取此文章');
  }
  
  // 檢查用戶是否有權限歸檔
  const canArchive = articleData.authorId === archiverId || 
                    articleData.permissions.editRoles.some(role => userRoles.includes(role));
  
  if (!canArchive) {
    throw new Error('您沒有權限歸檔此文章');
  }
  
  // 檢查文章狀態，已歸檔的文章不能再次歸檔
  if (articleData.status === 'archived') {
    throw new Error('此文章已經歸檔');
  }
  
  // 更新文章狀態為已歸檔
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 創建版本歷史記錄
  const versionEntry: KbVersionHistory = {
    versionId: uuidv4(),
    title: articleData.title,
    content: articleData.content,
    editorId: archiverId,
    editedAt: now,
    changeDescription: '歸檔文章'
  };
  
  await articleRef.update({
    status: 'archived',
    updatedAt: now,
    archivedAt: now,
    // 使用arrayUnion添加到版本歷史陣列
    versionHistory: admin.firestore.FieldValue.arrayUnion(versionEntry)
  });
}

/**
 * 點讚知識庫文章
 * 
 * @param tenantId 租戶ID
 * @param articleId 文章ID
 * @param userId 用戶ID
 */
export async function likeKbArticle(
  tenantId: string,
  articleId: string,
  userId: string
): Promise<void> {
  const db = admin.firestore();
  const articleRef = db.collection('knowledgeBaseArticles').doc(articleId);
  
  // 獲取當前文章記錄
  const articleDoc = await articleRef.get();
  if (!articleDoc.exists) {
    throw new Error(`找不到ID為 ${articleId} 的知識庫文章`);
  }
  
  const articleData = articleDoc.data() as Omit<KnowledgeBaseArticle, 'id'>;
  
  // 檢查租戶權限
  if (articleData.tenantId !== tenantId) {
    throw new Error('無權限存取此文章');
  }
  
  // 檢查文章狀態，只有已發布的文章可以點讚
  if (articleData.status !== 'published') {
    throw new Error('只有已發布的文章可以點讚');
  }
  
  // 創建點讚記錄
  const likeRef = db.collection('knowledgeBaseArticles')
    .doc(articleId)
    .collection('likes')
    .doc(userId);
  
  const likeDoc = await likeRef.get();
  
  // 如果已點讚，則取消點讚；如果未點讚，則點讚
  if (likeDoc.exists) {
    // 取消點讚
    await likeRef.delete();
    
    // 減少點讚數
    await articleRef.update({
      likeCount: admin.firestore.FieldValue.increment(-1)
    });
  } else {
    // 點讚
    await likeRef.set({
      userId: userId,
      likedAt: admin.firestore.Timestamp.now().toDate()
    });
    
    // 增加點讚數
    await articleRef.update({
      likeCount: admin.firestore.FieldValue.increment(1)
    });
  }
}

/**
 * 添加文章評論
 * 
 * @param tenantId 租戶ID
 * @param articleId 文章ID
 * @param authorId 評論者ID
 * @param content 評論內容
 * @param parentCommentId 父評論ID（選填，用於回覆）
 */
export async function addKbArticleComment(
  tenantId: string,
  articleId: string,
  authorId: string,
  content: string,
  parentCommentId?: string
): Promise<void> {
  const db = admin.firestore();
  const articleRef = db.collection('knowledgeBaseArticles').doc(articleId);
  
  // 獲取當前文章記錄
  const articleDoc = await articleRef.get();
  if (!articleDoc.exists) {
    throw new Error(`找不到ID為 ${articleId} 的知識庫文章`);
  }
  
  const articleData = articleDoc.data() as Omit<KnowledgeBaseArticle, 'id'>;
  
  // 檢查租戶權限
  if (articleData.tenantId !== tenantId) {
    throw new Error('無權限存取此文章');
  }
  
  // 檢查文章狀態，只有已發布的文章可以評論
  if (articleData.status !== 'published') {
    throw new Error('只有已發布的文章可以評論');
  }
  
  // 創建評論
  const now = admin.firestore.Timestamp.now().toDate();
  const newComment = {
    id: uuidv4(),
    authorId: authorId,
    content: content,
    createdAt: now,
    isEdited: false,
    parentCommentId: parentCommentId
  };
  
  // 更新文章的評論列表
  await articleRef.update({
    comments: admin.firestore.FieldValue.arrayUnion(newComment)
  });
}

// ===================== 知識庫分類 CRUD 函式 ===================== //

/**
 * 創建知識庫分類
 * 
 * @param categoryData 分類輸入資料
 * @param creatorId 創建者ID
 * @returns 新創建的分類
 */
export async function createKbCategory(
  categoryData: KbCategoryInput,
  creatorId: string
): Promise<KbCategory> {
  const db = admin.firestore();
  
  // 驗證輸入資料
  if (!categoryData.name) {
    throw new Error('分類必須包含名稱');
  }
  
  if (!categoryData.tenantId) {
    throw new Error('必須指定租戶ID');
  }
  
  // 檢查同名分類是否已存在
  const existingCategoriesSnapshot = await db.collection('kbCategories')
    .where('tenantId', '==', categoryData.tenantId)
    .where('name', '==', categoryData.name)
    .limit(1)
    .get();
  
  if (!existingCategoriesSnapshot.empty) {
    throw new Error(`分類「${categoryData.name}」已存在`);
  }
  
  // 獲取當前時間
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 獲取最大排序值，以便新分類放在最後
  let maxOrder = 0;
  const categoriesSnapshot = await db.collection('kbCategories')
    .where('tenantId', '==', categoryData.tenantId)
    .orderBy('order', 'desc')
    .limit(1)
    .get();
  
  if (!categoriesSnapshot.empty) {
    const lastCategory = categoriesSnapshot.docs[0].data() as KbCategory;
    maxOrder = lastCategory.order;
  }
  
  // 創建新分類記錄
  const newCategory: Omit<KbCategory, 'id'> = {
    tenantId: categoryData.tenantId,
    name: categoryData.name,
    description: categoryData.description,
    parentCategoryId: categoryData.parentCategoryId,
    iconUrl: categoryData.iconUrl,
    order: categoryData.order !== undefined ? categoryData.order : maxOrder + 10, // 增加10是為了留出間隔，方便未來插入
    createdAt: now,
    updatedAt: now,
    createdBy: creatorId
  };
  
  // 寫入Firestore
  const categoriesRef = db.collection('kbCategories');
  const docRef = await categoriesRef.add(newCategory);
  
  // 返回完整的分類記錄（包含ID）
  return {
    ...newCategory,
    id: docRef.id
  };
}

/**
 * 獲取知識庫分類列表
 * 
 * @param tenantId 租戶ID
 * @param parentCategoryId 父分類ID（選填，用於獲取子分類）
 * @returns 分類列表
 */
export async function getKbCategories(
  tenantId: string,
  parentCategoryId?: string
): Promise<KbCategory[]> {
  const db = admin.firestore();
  
  // 建立基本查詢
  let query = db.collection('kbCategories')
    .where('tenantId', '==', tenantId);
  
  // 如果指定了父分類ID，則查詢該父分類下的子分類
  if (parentCategoryId) {
    query = query.where('parentCategoryId', '==', parentCategoryId);
  } else {
    // 否則查詢頂級分類（無父分類ID的分類）
    query = query.where('parentCategoryId', '==', null);
  }
  
  // 執行查詢
  const snapshot = await query
    .orderBy('order', 'asc')
    .get();
  
  // 處理查詢結果
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as KbCategory[];
}

/**
 * 獲取單個知識庫分類詳情
 * 
 * @param tenantId 租戶ID
 * @param categoryId 分類ID
 * @returns 分類詳情或null
 */
export async function getKbCategoryById(
  tenantId: string,
  categoryId: string
): Promise<KbCategory | null> {
  const db = admin.firestore();
  
  const categoryRef = db.collection('kbCategories').doc(categoryId);
  const categoryDoc = await categoryRef.get();
  
  if (!categoryDoc.exists) {
    return null;
  }
  
  const categoryData = categoryDoc.data() as Omit<KbCategory, 'id'>;
  
  // 檢查租戶權限
  if (categoryData.tenantId !== tenantId) {
    throw new Error('無權限存取此分類');
  }
  
  // 返回完整分類資料（包含ID）
  return {
    ...categoryData,
    id: categoryDoc.id
  } as KbCategory;
}

/**
 * 更新知識庫分類
 * 
 * @param tenantId 租戶ID
 * @param categoryId 分類ID
 * @param updateData 更新資料
 */
export async function updateKbCategory(
  tenantId: string,
  categoryId: string,
  updateData: Partial<KbCategoryInput>
): Promise<void> {
  const db = admin.firestore();
  const categoryRef = db.collection('kbCategories').doc(categoryId);
  
  // 獲取當前分類記錄
  const categoryDoc = await categoryRef.get();
  if (!categoryDoc.exists) {
    throw new Error(`找不到ID為 ${categoryId} 的知識庫分類`);
  }
  
  const categoryData = categoryDoc.data() as Omit<KbCategory, 'id'>;
  
  // 檢查租戶權限
  if (categoryData.tenantId !== tenantId) {
    throw new Error('無權限存取此分類');
  }
  
  // 準備更新資料
  const now = admin.firestore.Timestamp.now().toDate();
  const updatePayload: Record<string, any> = {
    updatedAt: now
  };
  
  // 更新欄位
  if (updateData.name) updatePayload.name = updateData.name;
  if (updateData.description !== undefined) updatePayload.description = updateData.description;
  if (updateData.parentCategoryId !== undefined) updatePayload.parentCategoryId = updateData.parentCategoryId;
  if (updateData.iconUrl !== undefined) updatePayload.iconUrl = updateData.iconUrl;
  if (updateData.order !== undefined) updatePayload.order = updateData.order;
  
  // 執行更新
  await categoryRef.update(updatePayload);
}

/**
 * 刪除知識庫分類
 * 
 * @param tenantId 租戶ID
 * @param categoryId 分類ID
 */
export async function deleteKbCategory(
  tenantId: string,
  categoryId: string
): Promise<void> {
  const db = admin.firestore();
  const categoryRef = db.collection('kbCategories').doc(categoryId);
  
  // 獲取當前分類記錄
  const categoryDoc = await categoryRef.get();
  if (!categoryDoc.exists) {
    throw new Error(`找不到ID為 ${categoryId} 的知識庫分類`);
  }
  
  const categoryData = categoryDoc.data() as Omit<KbCategory, 'id'>;
  
  // 檢查租戶權限
  if (categoryData.tenantId !== tenantId) {
    throw new Error('無權限存取此分類');
  }
  
  // 檢查是否有子分類
  const childCategoriesSnapshot = await db.collection('kbCategories')
    .where('tenantId', '==', tenantId)
    .where('parentCategoryId', '==', categoryId)
    .limit(1)
    .get();
  
  if (!childCategoriesSnapshot.empty) {
    throw new Error('此分類下有子分類，無法刪除');
  }
  
  // 檢查是否有使用此分類的文章
  const articlesSnapshot = await db.collection('knowledgeBaseArticles')
    .where('tenantId', '==', tenantId)
    .where('categoryId', '==', categoryId)
    .limit(1)
    .get();
  
  if (!articlesSnapshot.empty) {
    throw new Error('此分類下有文章，無法刪除');
  }
  
  // 執行刪除
  await categoryRef.delete();
}

// ===================== 投票系統 CRUD 函式 ===================== //

/**
 * 創建新投票
 * 
 * @param pollData 投票輸入資料
 * @param creatorId 創建者ID
 * @returns 新創建的投票
 */
export async function createPoll(
  pollData: PollInput,
  creatorId: string
): Promise<Poll> {
  const db = admin.firestore();
  
  // 驗證輸入資料
  if (!pollData.title) {
    throw new Error('投票必須包含標題');
  }
  
  if (!pollData.options || pollData.options.length < 2) {
    throw new Error('投票必須至少包含兩個選項');
  }
  
  if (!pollData.tenantId) {
    throw new Error('必須指定租戶ID');
  }
  
  // 獲取當前時間
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 生成選項ID
  const options: PollOption[] = pollData.options.map(option => ({
    id: uuidv4(),
    text: option.text,
    count: 0  // 添加必要的count屬性，初始為0
  }));
  
  // 創建新投票記錄
  const newPoll: Omit<Poll, 'id'> = {
    tenantId: pollData.tenantId,
    title: pollData.title,
    description: pollData.description,
    options: options,
    status: 'draft',  // 初始狀態為草稿
    isAnonymous: pollData.isAnonymous ?? false,
    allowMultipleVotes: pollData.allowMultipleVotes ?? false,
    maxVotesPerUser: pollData.maxVotesPerUser ?? 1,
    startDate: pollData.startDate,
    endDate: pollData.endDate,
    totalVotes: 0,  // 初始投票數為0
    createdBy: creatorId,
    createdAt: now,
    updatedAt: now
  };
  
  // 如果開始日期是今天或過去，將狀態設為 active
  if (pollData.startDate <= now) {
    newPoll.status = 'active';
  }
  
  // 初始化結果計數
  newPoll.results = options.map(option => ({
    optionId: option.id,
    optionText: option.text,  // 添加必要的optionText屬性
    count: 0,
    percentage: 0
  }));
  
  // 寫入Firestore
  const pollsRef = db.collection('polls');
  const docRef = await pollsRef.add(newPoll);
  
  // 返回完整的投票記錄（包含ID）
  return {
    ...newPoll,
    id: docRef.id
  };
}

/**
 * 獲取投票列表
 * 
 * @param tenantId 租戶ID
 * @param filters 過濾條件
 * @param limit 取回的最大記錄數（預設20）
 * @returns 投票列表
 */
export async function getPolls(
  tenantId: string,
  filters?: { 
    status?: PollStatus, 
    creatorId?: string,
    targetGroup?: string
  },
  limit: number = 20
): Promise<Poll[]> {
  const db = admin.firestore();
  
  // 建立基本查詢
  let query = db.collection('polls')
    .where('tenantId', '==', tenantId);
  
  // 根據過濾條件添加查詢條件
  
  // 1. 狀態過濾
  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  }
  
  // 2. 創建者過濾
  if (filters?.creatorId) {
    query = query.where('creatorId', '==', filters.creatorId);
  }
  
  // 3. 目標群組過濾 (注意: 這裡假設targetGroups是一個陣列，並使用array-contains查詢)
  if (filters?.targetGroup) {
    query = query.where('targetGroups', 'array-contains', filters.targetGroup);
  }
  
  // 執行查詢
  const snapshot = await query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  // 處理查詢結果
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Poll[];
}

/**
 * 獲取單個投票詳情
 * 
 * @param tenantId 租戶ID
 * @param pollId 投票ID
 * @returns 投票詳情或null
 */
export async function getPollById(
  tenantId: string,
  pollId: string
): Promise<Poll | null> {
  const db = admin.firestore();
  
  const pollRef = db.collection('polls').doc(pollId);
  const pollDoc = await pollRef.get();
  
  if (!pollDoc.exists) {
    return null;
  }
  
  const pollData = pollDoc.data() as Omit<Poll, 'id'>;
  
  // 檢查租戶權限
  if (pollData.tenantId !== tenantId) {
    throw new Error('無權限存取此投票');
  }
  
  // 返回完整投票資料（包含ID）
  return {
    ...pollData,
    id: pollDoc.id
  } as Poll;
}

/**
 * 更新投票狀態（開始或結束投票）
 * 
 * @param tenantId 租戶ID
 * @param pollId 投票ID
 * @param newStatus 新狀態
 * @param operatorId 操作者ID
 */
export async function updatePollStatus(
  tenantId: string,
  pollId: string,
  newStatus: PollStatus,
  operatorId: string
): Promise<void> {
  const db = admin.firestore();
  const pollRef = db.collection('polls').doc(pollId);
  
  // 獲取當前投票記錄
  const pollDoc = await pollRef.get();
  if (!pollDoc.exists) {
    throw new Error(`找不到ID為 ${pollId} 的投票`);
  }
  
  const pollData = pollDoc.data() as Poll;
  
  // 檢查租戶權限
  if (pollData.tenantId !== tenantId) {
    throw new Error('無權限存取此投票');
  }
  
  // 檢查操作者權限（通常應該是創建者或管理員）
  if (pollData.createdBy !== operatorId) {
    // 這裡可以添加額外的權限檢查，例如檢查操作者是否為管理員
    throw new Error('您沒有權限更新此投票狀態');
  }
  
  // 檢查狀態變更是否有效
  if (pollData.status === newStatus) {
    throw new Error(`投票狀態已經是 ${newStatus}`);
  }
  
  // 特別檢查：不能將已關閉的投票重新開啟
  if (pollData.status === 'closed' && newStatus === 'active') {
    throw new Error('已關閉的投票不能重新開啟');
  }
  
  // 獲取當前時間
  const now = admin.firestore.Timestamp.now().toDate();
  
  // 更新投票狀態
  const updateData: Partial<Poll> = {
    status: newStatus,
    updatedAt: now
  };
  
  // 如果狀態變更為 closed，記錄關閉時間
  if (newStatus === 'closed') {
    // 因為 Poll 類型沒有 closedAt 屬性，我們需要手動指定類型
    (updateData as any).closedAt = now;
  }
  
  // 執行更新
  await pollRef.update(updateData);
}

/**
 * 投票（用戶提交投票）
 * 
 * @param tenantId 租戶ID
 * @param voteData 投票記錄輸入資料
 * @param voterId 投票者ID（匿名投票時可為選填）
 * @returns 投票記錄ID
 */
export async function castVote(
  tenantId: string,
  voteData: PollVoteInput,
  voterId?: string
): Promise<string> {
  const db = admin.firestore();
  
  // 1. 驗證投票存在且狀態為active
  const pollRef = db.collection('polls').doc(voteData.pollId);
  const pollDoc = await pollRef.get();
  
  if (!pollDoc.exists) {
    throw new Error(`找不到ID為 ${voteData.pollId} 的投票`);
  }
  
  const pollData = pollDoc.data() as Poll;
  
  // 檢查租戶權限
  if (pollData.tenantId !== tenantId) {
    throw new Error('無權限存取此投票');
  }
  
  // 檢查投票狀態
  if (pollData.status !== 'active') {
    throw new Error(`此投票當前狀態為 ${pollData.status}，不能進行投票`);
  }
  
  // 2. 檢查投票設定
  // 為了適應類型定義，我們將動態檢查並處理設定
  // 因為 Poll 類型沒有 settings 屬性，所以我們使用可選鏈和類型斷言
  const pollSettings = (pollData as any).settings || {};
  
  // 檢查是否需要身份驗證
  if (pollSettings.requireAuthentication && !voterId) {
    throw new Error('此投票需要身份驗證');
  }
  
  // 檢查選項是否有效
  if (!voteData.optionIds || voteData.optionIds.length === 0) {
    throw new Error('必須選擇至少一個選項');
  }
  
  // 檢查是否允許多選
  if (!pollSettings.allowMultipleOptions && voteData.optionIds.length > 1) {
    throw new Error('此投票僅允許單選');
  }
  
  // 檢查多選數量是否超過限制
  if (
    pollSettings.allowMultipleOptions && 
    pollSettings.maxSelectCount && 
    voteData.optionIds.length > pollSettings.maxSelectCount
  ) {
    throw new Error(`此投票最多只能選擇 ${pollSettings.maxSelectCount} 個選項`);
  }
  
  // 確認選擇的選項都存在於投票選項中
  const validOptionIds = new Set(pollData.options.map(option => option.id));
  for (const optionId of voteData.optionIds) {
    if (!validOptionIds.has(optionId)) {
      throw new Error(`選項 ID ${optionId} 不存在`);
    }
  }
  
  // 3. 檢查是否已經投過票（如果不允許重複投票）
  if (voterId && !pollSettings.allowRevote) {
    const existingVotes = await db.collection('pollVotes')
      .where('pollId', '==', voteData.pollId)
      .where('userId', '==', voterId)
      .limit(1)
      .get();
    
    if (!existingVotes.empty) {
      throw new Error('您已經參與過此投票');
    }
  }
  
  // 4. 創建投票記錄
  const now = admin.firestore.Timestamp.now().toDate();
  
  const newVote: Omit<PollVote, 'id'> = {
    pollId: voteData.pollId,
    tenantId: tenantId,
    userId: voterId || '',  // 使用空字串作為未提供 voterId 的默認值
    optionIds: voteData.optionIds,
    votedAt: now
  };
  
  // 5. 更新投票結果
  const batch = db.batch();
  
  // 5.1 寫入投票記錄
  const voteRef = db.collection('pollVotes').doc();
  batch.set(voteRef, newVote);
  
  // 5.2 更新投票結果計數
  // 更新總票數
  batch.update(pollRef, {
    totalVotes: admin.firestore.FieldValue.increment(1),
    updatedAt: now
  });
  
  // 更新各選項票數
  const pollResults = [...pollData.results || []];
  
  for (const optionId of voteData.optionIds) {
    const resultIndex = pollResults.findIndex(r => r.optionId === optionId);
    if (resultIndex >= 0) {
      // 使用 arrayRemove 和 arrayUnion 來更新陣列中的元素
      batch.update(pollRef, {
        [`results.${resultIndex}.count`]: admin.firestore.FieldValue.increment(1)
      });
    }
  }
  
  // 6. 執行批次操作
  await batch.commit();
  
  // 7. 在批次操作之外，重新計算和更新百分比
  // 這個操作是相對獨立的，所以可以在批次操作之後執行
  const updatedPollDoc = await pollRef.get();
  const updatedPollData = updatedPollDoc.data() as Poll;
  
  if (updatedPollData.results && updatedPollData.totalVotes > 0) {
    const updatedResults = updatedPollData.results.map(result => ({
      ...result,
      percentage: Math.round((result.count / updatedPollData.totalVotes) * 100)
    }));
    
    await pollRef.update({ results: updatedResults });
  }
  
  return voteRef.id;
}

/**
 * 獲取投票結果
 * 
 * @param tenantId 租戶ID
 * @param pollId 投票ID
 * @returns 投票結果
 */
export async function getPollResults(
  tenantId: string,
  pollId: string
): Promise<PollResult[]> {
  const db = admin.firestore();
  
  // 獲取投票資料
  const pollRef = db.collection('polls').doc(pollId);
  const pollDoc = await pollRef.get();
  
  if (!pollDoc.exists) {
    throw new Error(`找不到ID為 ${pollId} 的投票`);
  }
  
  const pollData = pollDoc.data() as Poll;
  
  // 檢查租戶權限
  if (pollData.tenantId !== tenantId) {
    throw new Error('無權限存取此投票');
  }
  
  // 檢查投票狀態或設定是否允許查看結果
  const pollSettings = (pollData as any).settings || {};
  if (pollData.status === 'active' && !pollSettings.visibleResults) {
    throw new Error('此投票尚未結束，且不允許在投票期間查看結果');
  }
  
  return pollData.results || [];
}

/**
 * 關閉投票
 * 
 * @param tenantId 租戶ID
 * @param pollId 投票ID
 * @param closerId 關閉者ID
 */
export async function closePoll(
  tenantId: string,
  pollId: string,
  closerId: string
): Promise<void> {
  // 直接調用更新投票狀態函式，將狀態設為 closed
  await updatePollStatus(tenantId, pollId, 'closed', closerId);
} 