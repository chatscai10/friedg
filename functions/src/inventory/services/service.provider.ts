/**
 * 服務提供者
 * 
 * 提供統一的服務實例化和依賴注入管理
 */
import { databaseRegistry } from '../db/database.provider';

/**
 * 服務建構函數類型
 */
export type ServiceConstructor<T = any> = new (...args: any[]) => T;

/**
 * 服務註冊配置
 */
export interface ServiceRegistration<T = any> {
  /** 服務名稱 */
  name: string;
  /** 服務實現類別 */
  implementation: ServiceConstructor<T>;
  /** 是否為單例模式 */
  singleton?: boolean;
  /** 初始化參數提供函數 */
  params?: () => any[];
}

/**
 * 服務提供者類別
 */
export class ServiceProvider {
  /** 服務註冊表 */
  private static services: Map<string, ServiceRegistration> = new Map();
  /** 服務實例緩存 */
  private static instances: Map<string, any> = new Map();
  
  /**
   * 註冊服務
   * @param registration 服務註冊配置
   */
  static register<T>(registration: ServiceRegistration<T>): void {
    this.services.set(registration.name, registration);
  }
  
  /**
   * 獲取服務實例
   * @param name 服務名稱
   * @returns 服務實例
   */
  static get<T>(name: string): T {
    const registration = this.services.get(name);
    
    if (!registration) {
      throw new Error(`未找到服務 ${name}`);
    }
    
    // 若為單例模式且已有實例，則返回緩存的實例
    if (registration.singleton !== false && this.instances.has(name)) {
      return this.instances.get(name) as T;
    }
    
    // 獲取實例化參數
    const params = registration.params ? registration.params() : [];
    
    // 實例化服務
    const instance = new registration.implementation(...params);
    
    // 若為單例模式，則緩存實例
    if (registration.singleton !== false) {
      this.instances.set(name, instance);
    }
    
    return instance as T;
  }
  
  /**
   * 替換服務實現
   * @param name 服務名稱
   * @param implementation 新的服務實現類別
   * @param params 初始化參數提供函數
   */
  static mock<T>(
    name: string,
    implementation: ServiceConstructor<T>,
    params?: () => any[]
  ): void {
    const registration = this.services.get(name);
    
    if (!registration) {
      throw new Error(`未找到服務 ${name}`);
    }
    
    // 創建新的註冊配置
    const mockRegistration: ServiceRegistration<T> = {
      ...registration,
      implementation,
      params
    };
    
    // 更新註冊表
    this.services.set(name, mockRegistration);
    
    // 清除緩存實例
    this.instances.delete(name);
  }
  
  /**
   * 重置所有服務
   */
  static reset(): void {
    this.instances.clear();
  }
  
  /**
   * 設置為測試模式
   */
  static setupTestMode(): void {
    // 設置測試環境的資料庫提供者
    databaseRegistry.setDefaultProvider('test');
    
    // 重置所有服務實例
    this.reset();
  }
}

/**
 * 服務依賴裝飾器
 * @param serviceName 服務名稱
 */
export function Inject(serviceName: string): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    // 定義獲取屬性時的行為
    Object.defineProperty(target, propertyKey, {
      get: function() {
        return ServiceProvider.get(serviceName);
      },
      enumerable: true,
      configurable: true
    });
  };
} 