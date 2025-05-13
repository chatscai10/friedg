/**
 * Firestore儲存庫實現
 * 
 * 基於Firebase Firestore的儲存庫實現
 */
import * as admin from 'firebase-admin';
import { 
  BaseRepository, 
  RepositoryOptions, 
  QueryOptions, 
  QueryCondition, 
  PaginatedResult,
  QueryResult,
  BatchWriteOperation,
  BatchWriteResult
} from './repository.base';
import { firestoreProvider } from './database.provider';

/**
 * Firestore儲存庫實現
 */
export class FirestoreRepository<T extends { id?: string }> extends BaseRepository<T> {
  /**
   * 構造函數
   * @param collectionName 集合名稱
   */
  constructor(collectionName: string) {
    super(collectionName);
  }
  
  /**
   * 獲取集合引用
   */
  getCollectionRef(options?: RepositoryOptions): admin.firestore.CollectionReference {
    const db = firestoreProvider.getFirestore();
    
    // 如果有自定義集合路徑
    if (options?.customCollectionPath) {
      return db.collection(options.customCollectionPath);
    }
    
    // 如果有租戶ID
    if (options?.tenantId) {
      return db.collection('tenants')
        .doc(options.tenantId)
        .collection(this.collectionName);
    }
    
    return db.collection(this.collectionName);
  }
  
  /**
   * 獲取文檔引用
   */
  getDocRef(id: string, options?: RepositoryOptions): admin.firestore.DocumentReference {
    return this.getCollectionRef(options).doc(id);
  }
  
  /**
   * 將Firestore數據轉換為應用模型數據
   */
  protected convertToModel(doc: admin.firestore.DocumentSnapshot, options?: RepositoryOptions): T | null {
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    if (!data) {
      return null;
    }
    
    // 若為軟刪除且不包含已刪除，則返回null
    if (data.deleted && options?.includeDeleted !== true) {
      return null;
    }
    
    // 轉換 Timestamp 為 Date
    const result: any = { 
      ...data,
      id: doc.id 
    };
    
    // 轉換所有 Timestamp 欄位為 Date
    Object.keys(result).forEach(key => {
      if (result[key] instanceof admin.firestore.Timestamp) {
        result[key] = result[key].toDate();
      }
    });
    
    return result as T;
  }
  
  /**
   * 將應用模型數據轉換為Firestore數據
   */
  protected convertToFirestore(data: Partial<T>): any {
    const result = { ...data };
    
    // 移除ID欄位，因為ID是文檔鍵
    if ('id' in result) {
      delete result.id;
    }
    
    // 添加更新時間
    result.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    return result;
  }
  
  /**
   * 應用查詢條件到Firestore查詢
   */
  protected applyQueryConditions(
    query: admin.firestore.Query,
    conditions: QueryCondition[]
  ): admin.firestore.Query {
    let result = query;
    
    for (const condition of conditions) {
      result = result.where(condition.field, condition.operator, condition.value);
    }
    
    return result;
  }
  
  /**
   * 應用排序條件到Firestore查詢
   */
  protected applyOrderOptions(
    query: admin.firestore.Query,
    options?: QueryOptions
  ): admin.firestore.Query {
    let result = query;
    
    if (options?.orderBy) {
      for (const order of options.orderBy) {
        result = result.orderBy(order.field, order.direction);
      }
    }
    
    return result;
  }
  
  /**
   * 套用軟刪除過濾條件到查詢
   */
  protected applySoftDeleteFilter(
    query: admin.firestore.Query,
    options?: RepositoryOptions | QueryOptions
  ): admin.firestore.Query {
    // 若不明確要求包含已刪除記錄，則添加過濾條件
    if (options?.includeDeleted !== true) {
      return query.where('deleted', '==', false);
    }
    return query;
  }
  
  /**
   * 獲取單個記錄
   */
  async getById(id: string, options?: RepositoryOptions): Promise<T | null> {
    try {
      const docRef = this.getDocRef(id, options);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        // 如果需要在找不到時創建
        if (options?.createIfNotExists) {
          const newData: Partial<T> = {
            createdAt: new Date()
          };
          
          await docRef.set({
            ...newData,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            deleted: false
          });
          
          const newDoc = await docRef.get();
          return this.convertToModel(newDoc, options);
        }
        return null;
      }
      
      return this.convertToModel(doc, options);
    } catch (error: any) {
      return this.handleError(error, 'getById', { id, options });
    }
  }
  
  /**
   * 根據條件查詢單個記錄
   */
  async findOne(conditions: QueryCondition[], options?: QueryOptions): Promise<T | null> {
    try {
      let query = this.getCollectionRef(options);
      
      // 應用查詢條件
      query = this.applyQueryConditions(query, conditions);
      
      // 應用軟刪除過濾
      query = this.applySoftDeleteFilter(query, options);
      
      // 應用排序選項
      query = this.applyOrderOptions(query, options);
      
      // 限制結果為1
      query = query.limit(1);
      
      const snapshot = await query.get();
      
      if (snapshot.empty) {
        return null;
      }
      
      return this.convertToModel(snapshot.docs[0], options);
    } catch (error: any) {
      return this.handleError(error, 'findOne', { conditions, options });
    }
  }
  
  /**
   * 根據條件查詢多個記錄
   */
  async find(conditions: QueryCondition[], options?: QueryOptions): Promise<QueryResult<T>> {
    try {
      let query = this.getCollectionRef(options);
      
      // 應用查詢條件
      query = this.applyQueryConditions(query, conditions);
      
      // 應用軟刪除過濾
      query = this.applySoftDeleteFilter(query, options);
      
      // 應用排序選項
      query = this.applyOrderOptions(query, options);
      
      // 應用分頁
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      if (options?.startAfter) {
        query = query.startAfter(options.startAfter);
      }
      
      const snapshot = await query.get();
      const results: T[] = [];
      
      snapshot.forEach(doc => {
        const item = this.convertToModel(doc, options);
        if (item) {
          results.push(item);
        }
      });
      
      let total: number | undefined = undefined;
      
      // 如果需要計算總數
      if (options?.countTotal) {
        try {
          const countQuery = this.getCollectionRef(options);
          // 應用相同的條件來計算總數
          const countQueryWithConditions = this.applyQueryConditions(countQuery, conditions);
          // 應用軟刪除過濾
          const finalCountQuery = this.applySoftDeleteFilter(countQueryWithConditions, options);
            
          const countSnapshot = await finalCountQuery.count().get();
          total = countSnapshot.data()?.count || 0;
        } catch (error) {
          console.warn('Count API not available, falling back to document fetch for counting:', error);
          // 如果 count() 方法不可用，退化為計算所有文檔
          const allDocsQuery = this.getCollectionRef(options);
          const allDocsWithConditions = this.applyQueryConditions(allDocsQuery, conditions);
          // 應用軟刪除過濾
          const finalAllDocsQuery = this.applySoftDeleteFilter(allDocsWithConditions, options);
            
          const allDocsSnapshot = await finalAllDocsQuery.get();
          total = allDocsSnapshot.size;
        }
      }
      
      return {
        success: true,
        data: results,
        lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : undefined,
        total
      };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }
  
  /**
   * 查詢帶分頁的記錄
   */
  async findWithPagination(
    conditions: QueryCondition[],
    page: number,
    pageSize: number,
    options?: QueryOptions
  ): Promise<PaginatedResult<T>> {
    try {
      // 計算偏移量
      const offset = (page - 1) * pageSize;
      let query = this.getCollectionRef(options);
      
      // 應用查詢條件
      query = this.applyQueryConditions(query, conditions);
      
      // 應用軟刪除過濾
      query = this.applySoftDeleteFilter(query, options);
      
      // 應用排序選項
      query = this.applyOrderOptions(query, options);
      
      // 獲取總數
      let total = 0;
      try {
        const countQuery = this.getCollectionRef(options);
        // 應用相同的條件來計算總數
        const countQueryWithConditions = this.applyQueryConditions(countQuery, conditions);
        // 應用軟刪除過濾
        const finalCountQuery = this.applySoftDeleteFilter(countQueryWithConditions, options);
          
        const countSnapshot = await finalCountQuery.count().get();
        total = countSnapshot.data()?.count || 0;
      } catch (error) {
        console.warn('Count API not available, falling back to document fetch for counting:', error);
        // 如果 count() 方法不可用，退化為計算所有文檔
        const allDocsQuery = this.getCollectionRef(options);
        const allDocsWithConditions = this.applyQueryConditions(allDocsQuery, conditions);
        // 應用軟刪除過濾
        const finalAllDocsQuery = this.applySoftDeleteFilter(allDocsWithConditions, options);
          
        const allDocsSnapshot = await finalAllDocsQuery.get();
        total = allDocsSnapshot.size;
      }
      
      // 應用分頁
      query = query.limit(pageSize);
      
      // 偏移處理
      if (offset > 0) {
        try {
          // Firestore不支持直接偏移，需要先獲取最後一個文檔
          const offsetSnapshot = await query.limit(offset).get();
          
          if (!offsetSnapshot.empty) {
            const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
            query = query.startAfter(lastDoc);
          }
        } catch (error) {
          console.warn('Error while applying offset, using default pagination:', error);
          // 如果失敗，仍能返回結果但可能不如預期
        }
      }
      
      const snapshot = await query.get();
      const results: T[] = [];
      
      snapshot.forEach(doc => {
        const item = this.convertToModel(doc, options);
        if (item) {
          results.push(item);
        }
      });
      
      return {
        items: results,
        total,
        page,
        pageSize,
        hasMore: (page * pageSize) < total
      };
    } catch (error: any) {
      return this.handleError(error, 'findWithPagination', { conditions, page, pageSize, options });
    }
  }
  
  /**
   * 創建記錄
   */
  async create(data: Partial<T>, options?: RepositoryOptions): Promise<T> {
    try {
      const collectionRef = this.getCollectionRef(options);
      
      // 準備數據
      const firestoreData = this.convertToFirestore(data);
      
      // 添加創建時間
      firestoreData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      firestoreData.deleted = false;
      
      // 創建文檔
      const docRef = data.id ? collectionRef.doc(data.id as string) : collectionRef.doc();
      await docRef.set(firestoreData);
      
      // 獲取創建後的文檔
      const newDoc = await docRef.get();
      const result = this.convertToModel(newDoc, options);
      
      if (!result) {
        throw new Error('創建文檔後無法獲取');
      }
      
      return result;
    } catch (error: any) {
      return this.handleError(error, 'create', { data, options });
    }
  }
  
  /**
   * 更新記錄
   */
  async update(id: string, data: Partial<T>, options?: RepositoryOptions): Promise<T> {
    try {
      const docRef = this.getDocRef(id, options);
      
      // 檢查文檔是否存在
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new Error(`Document with ID ${id} not found`);
      }
      
      // 準備數據
      const firestoreData = this.convertToFirestore(data);
      
      // 更新文檔
      await docRef.update(firestoreData);
      
      // 獲取更新後的文檔
      const updatedDoc = await docRef.get();
      const result = this.convertToModel(updatedDoc, options);
      
      if (!result) {
        throw new Error('更新文檔後無法獲取');
      }
      
      return result;
    } catch (error: any) {
      return this.handleError(error, 'update', { id, data, options });
    }
  }
  
  /**
   * 刪除記錄
   */
  async delete(id: string, options?: RepositoryOptions): Promise<boolean> {
    try {
      const docRef = this.getDocRef(id, options);
      
      // 軟刪除邏輯修正：預設使用軟刪除，除非明確指定硬刪除
      if (options?.hardDelete !== true) {
        // 軟刪除 - 更新為已刪除
        await docRef.update({
          deleted: true,
          deletedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // 硬刪除
        await docRef.delete();
      }
      
      return true;
    } catch (error: any) {
      return this.handleError(error, 'delete', { id, options });
    }
  }
  
  /**
   * 批量獲取記錄
   */
  async batchGet(ids: string[], options?: RepositoryOptions): Promise<Record<string, T>> {
    try {
      const result: Record<string, T> = {};
      
      // Firestore每次最多獲取10個文檔
      const batchSize = 10;
      
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const refs = batch.map(id => this.getDocRef(id, options));
        
        const snapshots = await firestoreProvider.getFirestore().getAll(...refs);
        
        snapshots.forEach(snapshot => {
          if (snapshot.exists) {
            const model = this.convertToModel(snapshot, options);
            if (model) {
              result[snapshot.id] = model;
            }
          }
        });
      }
      
      return result;
    } catch (error: any) {
      return this.handleError(error, 'batchGet', { ids, options });
    }
  }
  
  /**
   * 批量創建記錄
   */
  async batchCreate(items: Partial<T>[], options?: RepositoryOptions): Promise<T[]> {
    try {
      return this.runTransaction(async transaction => {
        const results: T[] = [];
        const collectionRef = this.getCollectionRef(options);
        
        for (const item of items) {
          // 準備數據
          const firestoreData = this.convertToFirestore(item);
          
          // 添加創建時間
          firestoreData.createdAt = admin.firestore.FieldValue.serverTimestamp();
          firestoreData.deleted = false;
          
          // 創建文檔
          const docRef = item.id ? collectionRef.doc(item.id as string) : collectionRef.doc();
          
          transaction.set(docRef, firestoreData);
          
          // 添加ID到結果
          results.push({ ...item, id: docRef.id } as T);
        }
        
        return results;
      });
    } catch (error: any) {
      return this.handleError(error, 'batchCreate', { items, options });
    }
  }
  
  /**
   * 批量更新記錄
   */
  async batchUpdate(items: Partial<T>[], options?: RepositoryOptions): Promise<T[]> {
    try {
      return this.runTransaction(async transaction => {
        const results: T[] = [];
        
        for (const item of items) {
          if (!item.id) {
            throw new Error('每項更新數據必須包含ID');
          }
          
          const docRef = this.getDocRef(item.id as string, options);
          
          // 準備數據
          const firestoreData = this.convertToFirestore(item);
          
          transaction.update(docRef, firestoreData);
          
          // 添加到結果
          results.push(item as T);
        }
        
        return results;
      });
    } catch (error: any) {
      return this.handleError(error, 'batchUpdate', { items, options });
    }
  }
  
  /**
   * 批量刪除記錄
   */
  async batchDelete(ids: string[], options?: RepositoryOptions): Promise<boolean> {
    try {
      return this.runTransaction(async transaction => {
        for (const id of ids) {
          const docRef = this.getDocRef(id, options);
          
          // 軟刪除邏輯修正：預設使用軟刪除，除非明確指定硬刪除
          if (options?.hardDelete !== true) {
            // 軟刪除 - 更新為已刪除
            transaction.update(docRef, {
              deleted: true,
              deletedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } else {
            // 硬刪除
            transaction.delete(docRef);
          }
        }
        
        return true;
      });
    } catch (error: any) {
      return this.handleError(error, 'batchDelete', { ids, options });
    }
  }
  
  /**
   * 在事務中執行
   */
  async runTransaction<R>(
    callback: (transaction: admin.firestore.Transaction) => Promise<R>
  ): Promise<R> {
    try {
      return firestoreProvider.runTransaction(callback);
    } catch (error: any) {
      return this.handleError(error, 'runTransaction');
    }
  }
  
  /**
   * 批量寫入操作
   */
  async batchWrite(operations: BatchWriteOperation[]): Promise<BatchWriteResult> {
    try {
      let batch = firestoreProvider.getFirestore().batch();
      const batchSize = 500; // Firestore每次最多500個操作
      let operationCount = 0;
      let affectedCount = 0;
      
      for (const operation of operations) {
        const docRef = this.getDocRef(operation.id, operation.options);
        
        switch (operation.type) {
          case 'create':
            batch.set(docRef, {
              ...operation.data,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              deleted: false
            });
            break;
          case 'update':
            batch.update(docRef, {
              ...operation.data,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            break;
          case 'set':
            batch.set(docRef, {
              ...operation.data,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            break;
          case 'delete':
            // 軟刪除邏輯修正：預設使用軟刪除，除非明確指定硬刪除
            if (operation.options?.hardDelete !== true) {
              // 軟刪除
              batch.update(docRef, {
                deleted: true,
                deletedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              // 硬刪除
              batch.delete(docRef);
            }
            break;
        }
        
        operationCount++;
        affectedCount++;
        
        // 如果達到批次大小，提交批次並重置
        if (operationCount === batchSize) {
          await batch.commit();
          batch = firestoreProvider.getFirestore().batch();
          operationCount = 0;
        }
      }
      
      // 提交剩餘的操作
      if (operationCount > 0) {
        await batch.commit();
      }
      
      return {
        success: true,
        affectedCount
      };
    } catch (error: any) {
      return {
        success: false,
        affectedCount: 0,
        error: error.message
      };
    }
  }
} 