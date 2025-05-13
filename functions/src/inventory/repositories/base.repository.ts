/**
 * 儲存庫基類
 * 
 * 為各種資源提供通用的CRUD操作
 */
import { BaseRepository as DatabaseBaseRepository, RepositoryOptions, QueryOptions, QueryCondition } from '../db/repository.base';
import { FirestoreRepository } from '../db/firestore-repository';
import { NotFoundError } from '../utils/error-handler';

/**
 * 基礎儲存庫
 */
export abstract class BaseRepository<T extends { id?: string }> {
  protected repository: DatabaseBaseRepository<T>;
  protected readonly resourceType: string;
  
  /**
   * 構造函數
   * @param collectionName 集合名稱
   * @param resourceType 資源類型名稱 (用於錯誤訊息)
   */
  constructor(collectionName: string, resourceType: string) {
    this.repository = new FirestoreRepository<T>(collectionName);
    this.resourceType = resourceType;
  }
  
  /**
   * 根據ID獲取單一記錄
   */
  async get(id: string, tenantId: string): Promise<T> {
    const options: RepositoryOptions = { tenantId };
    const result = await this.repository.getById(id, options);
    
    if (!result) {
      throw new NotFoundError(this.resourceType, id);
    }
    
    return result;
  }
  
  /**
   * 根據ID獲取單一記錄，不存在時返回null
   */
  async getOptional(id: string, tenantId: string): Promise<T | null> {
    const options: RepositoryOptions = { tenantId };
    return await this.repository.getById(id, options);
  }
  
  /**
   * 獲取指定條件的單一記錄
   */
  async findOne(tenantId: string, conditions: QueryCondition[]): Promise<T | null> {
    const options: QueryOptions = { tenantId };
    return await this.repository.findOne(conditions, options);
  }
  
  /**
   * 查詢滿足條件的記錄列表
   */
  async find(tenantId: string, conditions: QueryCondition[], orderBy?: any[], limit?: number): Promise<T[]> {
    const options: QueryOptions = {
      tenantId,
      orderBy,
      limit
    };
    
    const result = await this.repository.find(conditions, options);
    return result.data;
  }
  
  /**
   * 查詢分頁記錄
   */
  async findPaginated(tenantId: string, conditions: QueryCondition[], page: number, pageSize: number, orderBy?: any[]): Promise<{
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  }> {
    const options: QueryOptions = {
      tenantId,
      orderBy,
      countTotal: true
    };
    
    return await this.repository.findWithPagination(conditions, page, pageSize, options);
  }
  
  /**
   * 創建記錄
   */
  async create(data: Partial<T>, tenantId: string): Promise<T> {
    const options: RepositoryOptions = { tenantId };
    return await this.repository.create(data, options);
  }
  
  /**
   * 更新記錄
   */
  async update(id: string, data: Partial<T>, tenantId: string): Promise<T> {
    const options: RepositoryOptions = { tenantId };
    
    try {
      return await this.repository.update(id, data, options);
    } catch (error: any) {
      if (error.message && error.message.includes('not found')) {
        throw new NotFoundError(this.resourceType, id);
      }
      throw error;
    }
  }
  
  /**
   * 刪除記錄
   */
  async delete(id: string, tenantId: string, softDelete: boolean = true): Promise<boolean> {
    const options: RepositoryOptions = {
      tenantId,
      includeDeleted: !softDelete
    };
    
    try {
      return await this.repository.delete(id, options);
    } catch (error: any) {
      if (error.message && error.message.includes('not found')) {
        throw new NotFoundError(this.resourceType, id);
      }
      throw error;
    }
  }
  
  /**
   * 批量獲取記錄
   */
  async batchGet(ids: string[], tenantId: string): Promise<Record<string, T>> {
    const options: RepositoryOptions = { tenantId };
    return await this.repository.batchGet(ids, options);
  }
  
  /**
   * 批量創建記錄
   */
  async batchCreate(items: Partial<T>[], tenantId: string): Promise<T[]> {
    const options: RepositoryOptions = { tenantId };
    return await this.repository.batchCreate(items, options);
  }
  
  /**
   * 批量更新記錄
   */
  async batchUpdate(items: Partial<T>[], tenantId: string): Promise<T[]> {
    const options: RepositoryOptions = { tenantId };
    
    try {
      return await this.repository.batchUpdate(items, options);
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * 批量刪除記錄
   */
  async batchDelete(ids: string[], tenantId: string, softDelete: boolean = true): Promise<boolean> {
    const options: RepositoryOptions = {
      tenantId,
      includeDeleted: !softDelete
    };
    
    try {
      return await this.repository.batchDelete(ids, options);
    } catch (error: any) {
      throw error;
    }
  }
  
  /**
   * 在事務中執行
   */
  async runTransaction<R>(callback: (transaction: any) => Promise<R>): Promise<R> {
    return this.repository.runTransaction(callback);
  }
} 