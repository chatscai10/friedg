/**
 * 庫存管理模組的資料庫提供者
 * 
 * 提供一個抽象層，允許在不同的資料庫實現之間切換
 */
import * as admin from 'firebase-admin';
import { DatabaseOperationError } from '../utils/errors';

/**
 * 資料庫查詢操作選項
 */
export interface QueryOptions {
  /** 排序欄位 */
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  }[];
  /** 限制數量 */
  limit?: number;
  /** 分頁起始點 */
  startAfter?: any;
  /** 分頁結束點 */
  endBefore?: any;
  /** 只取欄位的子集 */
  select?: string[];
  /** 使用軟刪除過濾 */
  includeDeleted?: boolean;
}

/**
 * 資料庫操作結果
 */
export interface DbOperationResult<T = any> {
  /** 操作是否成功 */
  success: boolean;
  /** 操作結果數據 */
  data?: T;
  /** 如果失敗，錯誤信息 */
  error?: Error;
  /** 受影響的文檔數量 */
  affectedCount?: number;
}

/**
 * 資料庫文檔數據
 */
export interface DbDocument {
  /** 文檔ID */
  id: string;
  /** 文檔數據 */
  [key: string]: any;
}

/**
 * 分頁查詢結果
 */
export interface DbPaginationResult {
  /** 當前頁結果 */
  items: DbDocument[];
  /** 總記錄數 */
  total?: number;
  /** 是否有更多 */
  hasMore: boolean;
  /** 下一頁標記 */
  nextPageToken?: string;
  /** 最後一個文檔 (用於分頁) */
  lastDoc?: any;
  /** 當前頁碼 */
  page: number;
  /** 每頁大小 */
  pageSize: number;
}

/**
 * 資料庫條件類型
 */
export type DbCondition = {
  field: string;
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'array-contains' | 'in' | 'array-contains-any';
  value: any;
};

/**
 * 資料庫操作類型
 */
export type DbBatchOperation = {
  type: 'create' | 'update' | 'delete' | 'softDelete';
  collection: string;
  id?: string;
  data?: any;
  options?: { 
    tenantId?: string;
    customRef?: any;
    merge?: boolean;
  };
};

/**
 * 資料庫提供者介面
 */
export interface DatabaseProvider {
  /**
   * 創建文檔
   * @param collection 集合名稱
   * @param data 文檔數據
   * @param id 文檔ID（可選）
   * @param options 附加選項
   * @returns 創建的文檔ID和引用
   */
  create(
    collection: string,
    data: any,
    id?: string,
    options?: { 
      tenantId?: string;
      customRef?: any; 
    }
  ): Promise<DbOperationResult<{ id: string; ref: any }>>;
  
  /**
   * 獲取文檔
   * @param collection 集合名稱
   * @param id 文檔ID
   * @param options 附加選項
   * @returns 文檔數據，不存在則返回null
   */
  get(
    collection: string,
    id: string,
    options?: { 
      tenantId?: string;
      customRef?: any;
      includeDeleted?: boolean;
    }
  ): Promise<DbOperationResult<DbDocument | null>>;
  
  /**
   * 更新文檔
   * @param collection 集合名稱
   * @param id 文檔ID
   * @param data 更新數據
   * @param options 附加選項
   * @returns 操作結果
   */
  update(
    collection: string,
    id: string,
    data: any,
    options?: { 
      tenantId?: string;
      customRef?: any;
      merge?: boolean;
    }
  ): Promise<DbOperationResult<boolean>>;
  
  /**
   * 刪除文檔
   * @param collection 集合名稱
   * @param id 文檔ID
   * @param options 附加選項
   * @returns 操作結果
   */
  delete(
    collection: string,
    id: string,
    options?: { 
      tenantId?: string;
      customRef?: any;
      softDelete?: boolean;
    }
  ): Promise<DbOperationResult<boolean>>;
  
  /**
   * 查詢文檔
   * @param collection 集合名稱
   * @param conditions 查詢條件
   * @param options 查詢選項
   * @returns 匹配的文檔數組
   */
  query(
    collection: string,
    conditions: DbCondition[],
    options?: QueryOptions & { 
      tenantId?: string;
      customRef?: any;
    }
  ): Promise<DbOperationResult<DbDocument[]>>;
  
  /**
   * 分頁查詢
   * @param collection 集合名稱
   * @param conditions 查詢條件
   * @param page 頁碼
   * @param pageSize 每頁大小
   * @param options 查詢選項
   * @returns 分頁結果
   */
  queryWithPagination(
    collection: string,
    conditions: DbCondition[],
    page: number,
    pageSize: number,
    options?: Omit<QueryOptions, 'limit'> & { 
      tenantId?: string;
      customRef?: any;
      countTotal?: boolean;
      pageToken?: string;
    }
  ): Promise<DbOperationResult<DbPaginationResult>>;
  
  /**
   * 批量獲取文檔
   * @param collection 集合名稱
   * @param ids 文檔ID數組
   * @param options 附加選項
   * @returns 文檔ID到數據的映射
   */
  batchGet(
    collection: string,
    ids: string[],
    options?: { 
      tenantId?: string;
      customRef?: any;
      includeDeleted?: boolean;
    }
  ): Promise<DbOperationResult<Record<string, DbDocument>>>;
  
  /**
   * 運行事務
   * @param updateFunction 事務更新函數
   * @param options 事務選項
   * @returns 事務結果
   */
  runTransaction<T>(
    updateFunction: (transaction: any) => Promise<T>,
    options?: { maxAttempts?: number }
  ): Promise<T>;
  
  /**
   * 批量寫入
   * @param operations 批量操作數組
   * @returns 操作結果
   */
  batchWrite(operations: DbBatchOperation[]): Promise<DbOperationResult<boolean>>;
  
  /**
   * 獲取集合引用
   * @param collection 集合名稱
   * @param options 附加選項
   * @returns 集合引用
   */
  getCollectionRef(
    collection: string,
    options?: { 
      tenantId?: string;
      customPath?: string;
    }
  ): any;
  
  /**
   * 獲取文檔引用
   * @param collection 集合名稱
   * @param id 文檔ID
   * @param options 附加選項
   * @returns 文檔引用
   */
  getDocRef(
    collection: string,
    id: string,
    options?: { 
      tenantId?: string;
      customPath?: string;
    }
  ): any;
  
  /**
   * 恢復已軟刪除的文檔
   * @param collection 集合名稱
   * @param id 文檔ID
   * @param options 附加選項
   * @returns 操作結果
   */
  restore(
    collection: string,
    id: string,
    options?: { 
      tenantId?: string;
      customRef?: any;
    }
  ): Promise<DbOperationResult<boolean>>;
}

/**
 * Firestore 資料庫實現
 */
export class FirestoreProvider implements DatabaseProvider {
  private readonly db: admin.firestore.Firestore;
  
  constructor() {
    // 確保 Firebase Admin 已初始化
    if (!admin.apps.length) {
      throw new Error('Firebase Admin SDK 未初始化，請先調用 admin.initializeApp()');
    }
    
    this.db = admin.firestore();
  }
  
  /**
   * 構建集合路徑
   * @private
   */
  private getCollectionPath(collection: string, tenantId?: string): string {
    // 如果提供了租戶ID，使用多租戶路徑
    if (tenantId) {
      return `tenants/${tenantId}/${collection}`;
    }
    
    return collection;
  }
  
  /**
   * 添加租戶ID到數據中
   * @private
   */
  private addTenantIdToData(data: any, tenantId?: string): any {
    if (!tenantId || !data) {
      return data;
    }
    
    return {
      ...data,
      tenantId
    };
  }
  
  /**
   * 添加軟刪除條件到查詢
   * @private
   */
  private addDeletedFilter(query: admin.firestore.Query, includeDeleted: boolean = false): admin.firestore.Query {
    if (!includeDeleted) {
      // 如果不包含已刪除文檔，添加條件:
      // 1. 不存在deletedAt字段，或
      // 2. deletedAt字段為null
      return query.where('deletedAt', '==', null);
    }
    return query;
  }
  
  /**
   * 創建文檔
   */
  async create(
    collection: string,
    data: any,
    id?: string,
    options?: { 
      tenantId?: string;
      customRef?: any;
    }
  ): Promise<DbOperationResult<{ id: string; ref: any }>> {
    try {
      const { tenantId, customRef } = options || {};
      let docRef: admin.firestore.DocumentReference;
      
      // 添加租戶ID到數據
      const docData = this.addTenantIdToData(data, tenantId);
      
      // 使用現有引用或創建新引用
      if (customRef) {
        docRef = customRef;
      } else {
        const collectionPath = this.getCollectionPath(collection, tenantId);
        const collectionRef = this.db.collection(collectionPath);
        
        if (id) {
          docRef = collectionRef.doc(id);
        } else {
          docRef = collectionRef.doc();
        }
      }
      
      // 添加時間戳和初始化軟刪除標記
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      const finalData = {
        ...docData,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null
      };
      
      // 寫入數據
      await docRef.set(finalData);
      
      return {
        success: true,
        data: {
          id: docRef.id,
          ref: docRef
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: new DatabaseOperationError(`創建 ${collection} 失敗`, error)
      };
    }
  }
  
  /**
   * 獲取文檔
   */
  async get(
    collection: string,
    id: string,
    options?: { 
      tenantId?: string;
      customRef?: any;
      includeDeleted?: boolean;
    }
  ): Promise<DbOperationResult<DbDocument | null>> {
    try {
      const { tenantId, customRef, includeDeleted = false } = options || {};
      let docRef: admin.firestore.DocumentReference;
      
      // 使用現有引用或創建新引用
      if (customRef) {
        docRef = customRef;
      } else {
        const collectionPath = this.getCollectionPath(collection, tenantId);
        docRef = this.db.collection(collectionPath).doc(id);
      }
      
      // 獲取文檔
      const doc = await docRef.get();
      
      // 文檔不存在
      if (!doc.exists) {
        return {
          success: true,
          data: null
        };
      }
      
      const docData = doc.data() as any;
      
      // 檢查軟刪除標記
      if (!includeDeleted && docData.deletedAt) {
        return {
          success: true,
          data: null
        };
      }
      
      // 返回文檔數據和ID
      return {
        success: true,
        data: {
          id: doc.id,
          ...docData
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: new DatabaseOperationError(`獲取 ${collection}/${id} 失敗`, error)
      };
    }
  }
  
  /**
   * 更新文檔
   */
  async update(
    collection: string,
    id: string,
    data: any,
    options?: { 
      tenantId?: string;
      customRef?: any;
      merge?: boolean;
    }
  ): Promise<DbOperationResult<boolean>> {
    try {
      const { tenantId, customRef, merge = true } = options || {};
      let docRef: admin.firestore.DocumentReference;
      
      // 使用現有引用或創建新引用
      if (customRef) {
        docRef = customRef;
      } else {
        const collectionPath = this.getCollectionPath(collection, tenantId);
        docRef = this.db.collection(collectionPath).doc(id);
      }
      
      // 先檢查文檔是否存在和是否被軟刪除
      const docSnapshot = await docRef.get();
      if (!docSnapshot.exists) {
        return {
          success: false,
          error: new Error(`文檔 ${collection}/${id} 不存在`)
        };
      }
      
      const docData = docSnapshot.data() as any;
      if (docData.deletedAt) {
        return {
          success: false,
          error: new Error(`文檔 ${collection}/${id} 已被刪除`)
        };
      }
      
      // 添加時間戳
      const updateData = {
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // 更新文檔
      if (merge) {
        await docRef.update(updateData);
      } else {
        // 確保保留deletedAt字段為null
        await docRef.set({
          ...updateData,
          deletedAt: null
        });
      }
      
      return {
        success: true,
        data: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: new DatabaseOperationError(`更新 ${collection}/${id} 失敗`, error)
      };
    }
  }
  
  /**
   * 刪除文檔
   */
  async delete(
    collection: string,
    id: string,
    options?: { 
      tenantId?: string;
      customRef?: any;
      softDelete?: boolean;
    }
  ): Promise<DbOperationResult<boolean>> {
    try {
      const { tenantId, customRef, softDelete = true } = options || {};
      let docRef: admin.firestore.DocumentReference;
      
      // 使用現有引用或創建新引用
      if (customRef) {
        docRef = customRef;
      } else {
        const collectionPath = this.getCollectionPath(collection, tenantId);
        docRef = this.db.collection(collectionPath).doc(id);
      }
      
      if (softDelete) {
        // 軟刪除: 更新deletedAt字段
        await docRef.update({
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // 硬刪除: 直接刪除文檔
        await docRef.delete();
      }
      
      return {
        success: true,
        data: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: new DatabaseOperationError(`刪除 ${collection}/${id} 失敗`, error)
      };
    }
  }
  
  /**
   * 查詢文檔
   */
  async query(
    collection: string,
    conditions: DbCondition[],
    options?: QueryOptions & { 
      tenantId?: string;
      customRef?: any;
    }
  ): Promise<DbOperationResult<DbDocument[]>> {
    try {
      const { 
        tenantId, 
        customRef, 
        orderBy, 
        limit, 
        startAfter, 
        endBefore,
        select,
        includeDeleted = false
      } = options || {};
      
      let queryRef: admin.firestore.Query;
      
      // 使用現有引用或創建新引用
      if (customRef) {
        queryRef = customRef;
      } else {
        const collectionPath = this.getCollectionPath(collection, tenantId);
        queryRef = this.db.collection(collectionPath);
      }
      
      // 添加查詢條件
      conditions.forEach(condition => {
        queryRef = queryRef.where(
          condition.field, 
          condition.operator as admin.firestore.WhereFilterOp, 
          condition.value
        );
      });
      
      // 添加軟刪除過濾
      queryRef = this.addDeletedFilter(queryRef, includeDeleted);
      
      // 添加排序
      if (orderBy && orderBy.length > 0) {
        orderBy.forEach(order => {
          queryRef = queryRef.orderBy(
            order.field, 
            order.direction
          );
        });
      }
      
      // 添加起始點
      if (startAfter) {
        queryRef = queryRef.startAfter(startAfter);
      }
      
      // 添加結束點
      if (endBefore) {
        queryRef = queryRef.endBefore(endBefore);
      }
      
      // 添加限制
      if (limit) {
        queryRef = queryRef.limit(limit);
      }
      
      // 選擇特定欄位
      if (select && select.length > 0) {
        queryRef = queryRef.select(...select);
      }
      
      // 執行查詢
      const querySnapshot = await queryRef.get();
      
      // 處理結果
      const results = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        success: true,
        data: results
      };
    } catch (error: any) {
      return {
        success: false,
        error: new DatabaseOperationError(`查詢 ${collection} 失敗`, error)
      };
    }
  }
  
  /**
   * 分頁查詢
   */
  async queryWithPagination(
    collection: string,
    conditions: DbCondition[],
    page: number,
    pageSize: number,
    options?: Omit<QueryOptions, 'limit'> & { 
      tenantId?: string;
      customRef?: any;
      countTotal?: boolean;
      pageToken?: string;
    }
  ): Promise<DbOperationResult<DbPaginationResult>> {
    try {
      const { 
        tenantId, 
        customRef, 
        orderBy, 
        endBefore,
        select,
        includeDeleted = false,
        countTotal = false,
        pageToken
      } = options || {};
      
      let queryRef: admin.firestore.Query;
      
      // 使用現有引用或創建新引用
      if (customRef) {
        queryRef = customRef;
      } else {
        const collectionPath = this.getCollectionPath(collection, tenantId);
        queryRef = this.db.collection(collectionPath);
      }
      
      // 添加查詢條件
      conditions.forEach(condition => {
        queryRef = queryRef.where(
          condition.field, 
          condition.operator as admin.firestore.WhereFilterOp, 
          condition.value
        );
      });
      
      // 添加軟刪除過濾
      queryRef = this.addDeletedFilter(queryRef, includeDeleted);
      
      // 添加排序
      if (orderBy && orderBy.length > 0) {
        orderBy.forEach(order => {
          queryRef = queryRef.orderBy(
            order.field, 
            order.direction
          );
        });
      } else {
        // 預設按更新時間排序
        queryRef = queryRef.orderBy('updatedAt', 'desc');
      }
      
      // 計算總數（如果需要）
      let total: number | undefined = undefined;
      if (countTotal) {
        const countSnapshot = await queryRef.count().get();
        total = countSnapshot.data().count;
      }
      
      // 處理分頁令牌
      if (pageToken) {
        try {
          const decodedToken = JSON.parse(
            Buffer.from(pageToken, 'base64').toString('utf-8')
          );
          
          if (decodedToken.lastDoc) {
            // 從上次查詢的最後一個文檔開始
            const lastDocRef = this.db.doc(decodedToken.lastDoc);
            const lastDocSnapshot = await lastDocRef.get();
            
            if (lastDocSnapshot.exists) {
              queryRef = queryRef.startAfter(lastDocSnapshot);
            }
          }
        } catch (e) {
          console.warn('Invalid page token:', e);
        }
      } else if (page > 1) {
        // 使用偏移分頁（不推薦大數據集）
        const offset = (page - 1) * pageSize;
        queryRef = queryRef.offset(offset);
      }
      
      // 添加結束點
      if (endBefore) {
        queryRef = queryRef.endBefore(endBefore);
      }
      
      // 選擇特定欄位
      if (select && select.length > 0) {
        queryRef = queryRef.select(...select);
      }
      
      // 多取一個用於判斷是否有更多
      queryRef = queryRef.limit(pageSize + 1);
      
      // 執行查詢
      const querySnapshot = await queryRef.get();
      
      // 確定是否有更多文檔
      const hasMore = querySnapshot.docs.length > pageSize;
      
      // 移除額外獲取的文檔
      const docs = hasMore 
        ? querySnapshot.docs.slice(0, pageSize) 
        : querySnapshot.docs;
      
      // 獲取最後一個文檔（用於續頁）
      const lastDoc = docs.length > 0 ? docs[docs.length - 1] : undefined;
      
      // 創建下一頁令牌
      let nextPageToken: string | undefined = undefined;
      if (hasMore && lastDoc) {
        const tokenData = {
          lastDoc: lastDoc.ref.path,
          collection,
          page: page + 1,
          pageSize
        };
        
        nextPageToken = Buffer.from(
          JSON.stringify(tokenData)
        ).toString('base64');
      }
      
      // 處理結果
      const items = docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        success: true,
        data: {
          items,
          total,
          hasMore,
          nextPageToken,
          lastDoc,
          page,
          pageSize
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: new DatabaseOperationError(`分頁查詢 ${collection} 失敗`, error)
      };
    }
  }
  
  /**
   * 批量獲取文檔
   */
  async batchGet(
    collection: string,
    ids: string[],
    options?: { 
      tenantId?: string;
      customRef?: any;
      includeDeleted?: boolean;
    }
  ): Promise<DbOperationResult<Record<string, DbDocument>>> {
    try {
      const { tenantId, customRef, includeDeleted = false } = options || {};
      
      // 如果沒有ID，直接返回空對象
      if (!ids.length) {
        return {
          success: true,
          data: {}
        };
      }
      
      // 分批處理（Firestore一次最多獲取10個文檔）
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        batches.push(batchIds);
      }
      
      // 處理每個批次
      const results: Record<string, DbDocument> = {};
      
      for (const batchIds of batches) {
        let collectionRef: admin.firestore.CollectionReference;
        
        // 使用現有引用或創建新引用
        if (customRef) {
          collectionRef = customRef;
        } else {
          const collectionPath = this.getCollectionPath(collection, tenantId);
          collectionRef = this.db.collection(collectionPath);
        }
        
        // 創建批量獲取
        const refs = batchIds.map(id => collectionRef.doc(id));
        const snapshots = await this.db.getAll(...refs);
        
        // 處理結果
        snapshots.forEach(doc => {
          if (doc.exists) {
            const docData = doc.data() as any;
            
            // 檢查軟刪除標記
            if (!includeDeleted && docData.deletedAt) {
              return;
            }
            
            results[doc.id] = {
              id: doc.id,
              ...docData
            };
          }
        });
      }
      
      return {
        success: true,
        data: results
      };
    } catch (error: any) {
      return {
        success: false,
        error: new DatabaseOperationError(`批量獲取 ${collection} 失敗`, error)
      };
    }
  }
  
  /**
   * 運行事務
   */
  async runTransaction<T>(
    updateFunction: (transaction: admin.firestore.Transaction) => Promise<T>,
    options?: { maxAttempts?: number }
  ): Promise<T> {
    try {
      const { maxAttempts = 5 } = options || {};
      
      return await this.db.runTransaction(
        updateFunction,
        { maxAttempts }
      );
    } catch (error: any) {
      throw new DatabaseOperationError(`執行事務失敗`, error);
    }
  }
  
  /**
   * 批量寫入
   */
  async batchWrite(operations: DbBatchOperation[]): Promise<DbOperationResult<boolean>> {
    try {
      // Firestore一次最多可以執行500個操作
      const maxBatchSize = 500;
      
      // 如果沒有操作，直接返回成功
      if (!operations.length) {
        return {
          success: true,
          data: true,
          affectedCount: 0
        };
      }
      
      // 分批處理
      const batches = [];
      for (let i = 0; i < operations.length; i += maxBatchSize) {
        const batchOps = operations.slice(i, i + maxBatchSize);
        batches.push(batchOps);
      }
      
      let totalAffected = 0;
      
      // 處理每個批次
      for (const batchOps of batches) {
        const batch = this.db.batch();
        
        for (const op of batchOps) {
          const { type, collection, id, data, options } = op;
          const { tenantId, customRef, merge = true } = options || {};
          
          let docRef: admin.firestore.DocumentReference;
          
          // 使用現有引用或創建新引用
          if (customRef) {
            docRef = customRef;
          } else {
            const collectionPath = this.getCollectionPath(collection, tenantId);
            const collectionRef = this.db.collection(collectionPath);
            
            if (type === 'create' && !id) {
              docRef = collectionRef.doc();
            } else {
              docRef = collectionRef.doc(id!);
            }
          }
          
          // 執行相應的批量操作
          switch (type) {
            case 'create': {
              // 添加時間戳
              const timestamp = admin.firestore.FieldValue.serverTimestamp();
              const createData = {
                ...data,
                createdAt: timestamp,
                updatedAt: timestamp,
                deletedAt: null
              };
              batch.set(docRef, this.addTenantIdToData(createData, tenantId));
              totalAffected++;
              break;
            }
              
            case 'update': {
              // 添加時間戳
              const updateData = {
                ...data,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              };
              
              if (merge) {
                batch.update(docRef, updateData);
              } else {
                batch.set(docRef, {
                  ...updateData,
                  deletedAt: null
                }, { merge });
              }
              totalAffected++;
              break;
            }
              
            case 'delete': {
              batch.delete(docRef);
              totalAffected++;
              break;
            }
              
            case 'softDelete': {
              batch.update(docRef, {
                deletedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              totalAffected++;
              break;
            }
          }
        }
        
        // 提交批次
        await batch.commit();
      }
      
      return {
        success: true,
        data: true,
        affectedCount: totalAffected
      };
    } catch (error: any) {
      return {
        success: false,
        error: new DatabaseOperationError(`批量寫入失敗`, error)
      };
    }
  }
  
  /**
   * 獲取集合引用
   */
  getCollectionRef(
    collection: string,
    options?: { 
      tenantId?: string;
      customPath?: string;
    }
  ): admin.firestore.CollectionReference {
    const { tenantId, customPath } = options || {};
    
    // 使用自定義路徑或生成的路徑
    const path = customPath || this.getCollectionPath(collection, tenantId);
    
    return this.db.collection(path);
  }
  
  /**
   * 獲取文檔引用
   */
  getDocRef(
    collection: string,
    id: string,
    options?: { 
      tenantId?: string;
      customPath?: string;
    }
  ): admin.firestore.DocumentReference {
    const { tenantId, customPath } = options || {};
    
    // 使用自定義路徑或生成的路徑
    const path = customPath || this.getCollectionPath(collection, tenantId);
    
    return this.db.collection(path).doc(id);
  }
  
  /**
   * 恢復已軟刪除的文檔
   */
  async restore(
    collection: string,
    id: string,
    options?: { 
      tenantId?: string;
      customRef?: any;
    }
  ): Promise<DbOperationResult<boolean>> {
    try {
      const { tenantId, customRef } = options || {};
      let docRef: admin.firestore.DocumentReference;
      
      // 使用現有引用或創建新引用
      if (customRef) {
        docRef = customRef;
      } else {
        const collectionPath = this.getCollectionPath(collection, tenantId);
        docRef = this.db.collection(collectionPath).doc(id);
      }
      
      // 檢查文檔是否存在
      const docSnapshot = await docRef.get();
      if (!docSnapshot.exists) {
        return {
          success: false,
          error: new Error(`文檔 ${collection}/${id} 不存在`)
        };
      }
      
      // 檢查文檔是否已被刪除
      const docData = docSnapshot.data() as any;
      if (!docData.deletedAt) {
        return {
          success: false,
          error: new Error(`文檔 ${collection}/${id} 未被刪除`)
        };
      }
      
      // 恢復文檔
      await docRef.update({
        deletedAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        restoredAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        success: true,
        data: true
      };
    } catch (error: any) {
      return {
        success: false,
        error: new DatabaseOperationError(`恢復 ${collection}/${id} 失敗`, error)
      };
    }
  }
}

/**
 * 資料庫服務提供者
 * 
 * 提供資料庫連接和服務的依賴注入
 */
export interface DatabaseProvider {
  /**
   * 獲取Firestore實例
   */
  getFirestore(): admin.firestore.Firestore;
  
  /**
   * 執行事務
   */
  runTransaction<T>(
    callback: (transaction: admin.firestore.Transaction) => Promise<T>
  ): Promise<T>;
}

/**
 * 資料庫提供者註冊表
 */
class DatabaseRegistry {
  private static providers: Map<string, DatabaseProvider> = new Map();
  private static defaultProvider: string = 'firestore';
  
  /**
   * 註冊提供者
   * @param name 提供者名稱
   * @param provider 提供者實例
   */
  static register(name: string, provider: DatabaseProvider): void {
    this.providers.set(name, provider);
  }
  
  /**
   * 獲取提供者
   * @param name 提供者名稱，如未指定則使用預設提供者
   */
  static getProvider(name?: string): DatabaseProvider {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`未找到名為 ${providerName} 的資料庫提供者`);
    }
    
    return provider;
  }
  
  /**
   * 設置默認提供者
   * @param name 提供者名稱
   */
  static setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`未找到名為 ${name} 的資料庫提供者`);
    }
    this.defaultProvider = name;
  }
}

// 註冊默認的Firestore提供者
DatabaseRegistry.register('firestore', FirestoreProvider.getInstance());

/**
 * 導出默認的Firestore提供者
 */
export const firestoreProvider = DatabaseRegistry.getProvider('firestore');

/**
 * 導出資料庫註冊表，供單元測試使用
 */
export const databaseRegistry = DatabaseRegistry; 