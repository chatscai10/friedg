import { firestore } from 'firebase-admin';
import { 
  Role, 
  UserContext,
  PaginationMeta,
  CreateRoleRequest,
  UpdateRoleRequest,
  ActionType,
  ResourceType,
  RoleScope
} from './roles.types';
import { Timestamp, DocumentSnapshot, FieldValue } from 'firebase-admin/firestore';

// 獲取 Firestore 實例
const db = firestore();
const rolesCollection = db.collection('roles');
const usersCollection = db.collection('users');

/**
 * 預定義的有效資源-操作組合
 * 定義哪些資源可以執行哪些操作
 */
const VALID_RESOURCE_ACTIONS: Record<ResourceType, ActionType[]> = {
  // 租戶相關
  'tenants': ['create', 'read', 'update', 'delete', 'manage'],
  
  // 店鋪相關
  'stores': ['create', 'read', 'update', 'delete', 'manage'],
  
  // 用戶相關
  'users': ['create', 'read', 'update', 'delete', 'manage'],
  'employees': ['create', 'read', 'update', 'delete', 'approve', 'manage'],
  
  // 菜單相關
  'menuItems': ['create', 'read', 'update', 'delete', 'manage'],
  'menuCategories': ['create', 'read', 'update', 'delete', 'manage'],
  'menuOptions': ['create', 'read', 'update', 'delete', 'manage'],
  
  // 訂單相關
  'orders': ['create', 'read', 'update', 'delete', 'approve', 'reject', 'cancel', 'complete', 'print', 'export', 'discount', 'refund', 'manage'],
  'orderItems': ['create', 'read', 'update', 'delete', 'manage'],
  
  // 庫存相關
  'inventoryItems': ['create', 'read', 'update', 'delete', 'manage'],
  'inventoryCounts': ['create', 'read', 'update', 'delete', 'approve', 'manage'],
  'inventoryOrders': ['create', 'read', 'update', 'delete', 'approve', 'cancel', 'complete', 'manage'],
  
  // 排班和出勤相關
  'schedules': ['create', 'read', 'update', 'delete', 'approve', 'manage'],
  'attendances': ['create', 'read', 'update', 'delete', 'approve', 'manage'],
  'leaves': ['create', 'read', 'update', 'delete', 'approve', 'reject', 'manage'],
  
  // 薪資相關
  'payrolls': ['create', 'read', 'update', 'delete', 'approve', 'print', 'export', 'manage'],
  
  // 角色相關
  'roles': ['create', 'read', 'update', 'delete', 'manage']
};

/**
 * 角色過濾條件
 */
export interface RoleFilter {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  isActive?: boolean;
  isSystemRole?: boolean;
  scope?: RoleScope; // 角色範圍篩選
  tenantId?: string; // 租戶ID篩選
  query?: string; // 用於搜索角色名稱或描述
}

/**
 * 角色服務層 - 處理與 Firestore 的數據交互
 */
export class RoleService {
  /**
   * 根據 ID 獲取角色
   */
  async getRoleById(roleId: string, user: UserContext): Promise<Role | null> {
    try {
      // 查詢角色文檔
      const roleDoc = await rolesCollection.doc(roleId).get();
      
      if (!roleDoc.exists) {
        return null;
      }
      
      // 獲取角色數據
      const roleData = roleDoc.data() as Role;
      
      // 權限檢查邏輯：
      
      // 1. 對於isSystemRole=true且scope='global'的角色，允許所有認證用戶查看
      if (roleData.isSystemRole && roleData.scope === 'global') {
        // 允許所有認證用戶訪問
        return this.convertRoleDocument(roleDoc);
      }
      
      // 2. 對於其他系統角色，只有超級管理員可以訪問
      if (roleData.isSystemRole && user.roleLevel > 0) {
        throw new Error('未授權：無權訪問此系統角色');
      }
      
      // 3. 非系統角色必須屬於用戶的租戶
      if (!roleData.isSystemRole && roleData.tenantId !== user.tenantId) {
        throw new Error('未授權：此角色不屬於您的租戶');
      }
      
      return this.convertRoleDocument(roleDoc);
    } catch (error) {
      console.error(`獲取角色(${roleId})時出錯:`, error);
      throw error;
    }
  }
  
  /**
   * 獲取角色列表 (支持分頁和過濾)
   */
  async listRoles(filter: RoleFilter, user: UserContext): Promise<{
    roles: Role[],
    total: number,
    page: number,
    limit: number,
    totalPages: number
  }> {
    try {
      // 解構過濾條件
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        isActive,
        isSystemRole,
        scope,
        tenantId,
        query
      } = filter;
      
      // 構建查詢
      let queryRef = rolesCollection as firestore.Query;
      
      // 根據用戶角色等級處理查詢權限
      if (user.roleLevel === 0) { 
        // 超級管理員可查看所有角色
        if (isSystemRole !== undefined) {
          queryRef = queryRef.where('isSystemRole', '==', isSystemRole);
        }
        
        // 如果提供了scope篩選條件
        if (scope) {
          queryRef = queryRef.where('scope', '==', scope);
          
          // scope='global'角色的tenantId應為null，忽略用戶提供的tenantId
          if (scope === 'global') {
            queryRef = queryRef.where('tenantId', '==', null);
          } else if (tenantId) {
            // 非global範圍且有指定tenantId時
            queryRef = queryRef.where('tenantId', '==', tenantId);
          }
        } else if (tenantId) {
          // 未指定scope但指定了tenantId
          queryRef = queryRef.where('tenantId', '==', tenantId);
        }
      } else {
        // 非超級管理員的權限控制
        
        // 處理特定查詢請求
        if (scope === 'global') {
          // 如果明確要查詢global範圍角色，只返回系統角色中scope為global的
          queryRef = queryRef.where('scope', '==', 'global')
                          .where('isSystemRole', '==', true)
                          .where('tenantId', '==', null);
        } else if (isSystemRole === true) {
          // 如果明確要查詢系統角色，非超級管理員只能看到scope='global'的系統角色
          queryRef = queryRef.where('isSystemRole', '==', true)
                          .where('scope', '==', 'global')
                          .where('tenantId', '==', null);
        } else if (isSystemRole === false) {
          // 如果明確要查詢非系統角色，只能查看自己租戶的
          queryRef = queryRef.where('isSystemRole', '==', false)
                          .where('tenantId', '==', user.tenantId);
                            
          // 如果提供了scope篩選條件
          if (scope && scope !== 'global' as RoleScope) { // 防止誤用，非系統角色不應該有global範圍
            queryRef = queryRef.where('scope', '==', scope);
          }
        } else {
          // 未指定isSystemRole時，使用複合查詢（需要兩次查詢合併結果）
          
          // 先獲取系統角色（只獲取global範圍的）
          let systemRolesQuery = rolesCollection
            .where('isSystemRole', '==', true)
            .where('scope', '==', 'global')
            .where('tenantId', '==', null);
          
          // 再獲取用戶租戶的角色
          let tenantRolesQuery = rolesCollection
            .where('isSystemRole', '==', false)
            .where('tenantId', '==', user.tenantId);
          
          // 添加其他過濾條件
          if (isActive !== undefined) {
            systemRolesQuery = systemRolesQuery.where('isActive', '==', isActive);
            tenantRolesQuery = tenantRolesQuery.where('isActive', '==', isActive);
          }
          
          // 如果提供了非global的scope篩選
          if (scope && scope !== 'global' as RoleScope) {
            // 只對租戶角色應用非global的scope篩選
            tenantRolesQuery = tenantRolesQuery.where('scope', '==', scope);
          }
          
          // 應用排序
          const sortField = sort === 'createdAt' || sort === 'updatedAt' || sort === 'roleLevel' || sort === 'roleName' 
            ? sort 
            : 'createdAt';
          
          systemRolesQuery = systemRolesQuery.orderBy(sortField, order);
          tenantRolesQuery = tenantRolesQuery.orderBy(sortField, order);
          
          // 執行兩個查詢
          const [systemRolesSnapshot, tenantRolesSnapshot] = await Promise.all([
            systemRolesQuery.get(),
            tenantRolesQuery.get()
          ]);
          
          // 合併結果
          let allRoles = [
            ...systemRolesSnapshot.docs.map(doc => this.convertRoleDocument(doc)),
            ...tenantRolesSnapshot.docs.map(doc => this.convertRoleDocument(doc))
          ];
          
          // 應用客戶端排序（因為我們合併了兩個查詢結果）
          allRoles.sort((a, b) => {
            const fieldA = a[sortField as keyof Role];
            const fieldB = b[sortField as keyof Role];
            
            if (typeof fieldA === 'string' && typeof fieldB === 'string') {
              return order === 'asc' 
                ? fieldA.localeCompare(fieldB) 
                : fieldB.localeCompare(fieldA);
            }
            
            // 數字或日期比較
            const valA = fieldA as any;
            const valB = fieldB as any;
            return order === 'asc' ? valA - valB : valB - valA;
          });
          
          // 應用客戶端分頁
          const total = allRoles.length;
          const startIndex = (page - 1) * limit;
          const paginatedRoles = allRoles.slice(startIndex, startIndex + limit);
          
          // 過濾查詢（如果有）
          let filteredRoles = paginatedRoles;
          if (query) {
            const lowerQuery = query.toLowerCase();
            filteredRoles = paginatedRoles.filter(role =>
              role.roleName.toLowerCase().includes(lowerQuery) ||
              (role.description && role.description.toLowerCase().includes(lowerQuery))
            );
          }
          
          return {
            roles: filteredRoles,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          };
        }
      }
      
      // 應用其他過濾條件
      if (isActive !== undefined) {
        queryRef = queryRef.where('isActive', '==', isActive);
      }
      
      // 應用排序
      if (sort === 'createdAt' || sort === 'updatedAt' || sort === 'roleLevel' || sort === 'roleName') {
        queryRef = queryRef.orderBy(sort, order);
      } else {
        // 默認按創建時間排序
        queryRef = queryRef.orderBy('createdAt', order);
      }
      
      // 獲取總數 (使用 count() 聚合查詢)
      const countSnapshot = await queryRef.count().get();
      const total = countSnapshot.data().count;
      
      // 計算分頁信息
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);
      
      // 獲取特定頁面的結果
      const paginatedQuerySnapshot = await queryRef.offset(offset).limit(limit).get();
      
      // 轉換文檔
      let roles = paginatedQuerySnapshot.docs.map(doc =>
        this.convertRoleDocument(doc)
      );
      
      // 如果有搜索查詢，執行客戶端過濾（通常這應該在數據庫層完成，但 Firestore 不支持全文搜索）
      if (query) {
        const lowerQuery = query.toLowerCase();
        roles = roles.filter(role =>
          role.roleName.toLowerCase().includes(lowerQuery) ||
          (role.description && role.description.toLowerCase().includes(lowerQuery))
        );
      }
      
      return {
        roles,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error('獲取角色列表時出錯:', error);
      throw error;
    }
  }

  /**
   * 創建新角色
   */
  async createRole(data: CreateRoleRequest, user: UserContext): Promise<Role> {
    try {
      // 角色 ID 生成邏輯
      const roleId = this.generateRoleId();
      
      // 檢查是否有創建角色的權限
      if (!this.hasPermission(user, 'roles', 'create')) {
        throw new Error('未授權：您沒有創建角色的權限');
      }
      
      // 租戶隔離 - 只有超級管理員可以創建系統角色和全局範圍角色
      if ((data.isSystemRole || data.scope === 'global') && user.roleLevel > 0) {
        throw new Error('未授權：只有超級管理員可以創建系統角色或全局範圍角色');
      }
      
      // 如果是租戶或店鋪範圍角色，確保是同一租戶
      if (data.scope === 'tenant' || data.scope === 'store') {
        if (!user.tenantId) {
          throw new Error('未授權：請求用戶上下文無效（缺少 tenantId）');
        }
        
        // 確保使用者無法為其他租戶創建角色
        if (data.tenantId !== user.tenantId) {
          throw new Error('未授權：您無法為其他租戶創建角色');
        }
      }
      
      // 如果是店鋪範圍角色，後續可能需要驗證店鋪ID
      if (data.scope === 'store') {
        // TODO: 未來可以添加店鋪ID驗證邏輯
        // 例如：確認店鋪存在且屬於用戶的租戶
      }
      
      // 檢查角色等級 - 不能創建比自己高權限的角色
      if (data.roleLevel < user.roleLevel) {
        throw new Error('未授權：您無法創建比自己權限等級更高的角色');
      }
      
      // 系統角色設置檢查
      if (data.isSystemRole) {
        // 系統角色必須是全域範圍
        if (data.scope !== 'global') {
          throw new Error('系統角色必須是全域範圍(scope=global)');
        }
        
        // 系統角色不應有租戶ID
        if (data.tenantId) {
          throw new Error('系統角色不能指定租戶ID');
        }
      }
      
      // 全域範圍角色處理
      if (data.scope === 'global') {
        // 全域範圍角色不應有租戶ID
        if (data.tenantId) {
          throw new Error('全域範圍角色不應指定租戶ID');
        }
        
        // 全域範圍角色的權限等級限制
        if (data.roleLevel > 5) {
          throw new Error('全域範圍角色的權限等級不能高於5');
        }
      }
      
      // 檢查權限陣列中每個權限項目的有效性
      if (data.permissions) {
        const invalidPermissions: string[] = [];
        
        for (const [resourceType, permission] of Object.entries(data.permissions)) {
          // 檢查資源類型是否有效
          if (!VALID_RESOURCE_ACTIONS[resourceType as ResourceType]) {
            invalidPermissions.push(`無效的資源類型：${resourceType}`);
            continue;
          }
          
          // 檢查操作類型是否對該資源有效
          for (const [action, isEnabled] of Object.entries(permission)) {
            // 只檢查被啟用的權限
            if (isEnabled && !VALID_RESOURCE_ACTIONS[resourceType as ResourceType].includes(action as ActionType)) {
              invalidPermissions.push(`資源 "${resourceType}" 不支持操作 "${action}"`);
            }
          }
        }
        
        // 如果有無效的權限，拒絕創建請求
        if (invalidPermissions.length > 0) {
          throw new Error(`權限驗證失敗：${invalidPermissions.join('、')}`);
        }
      }
      
      // 檢查角色名稱格式
      if (!/^[\w\u4e00-\u9fa5\s-]+$/.test(data.roleName)) {
        throw new Error('角色名稱格式無效：只能包含字母、數字、漢字、空格、連字符和下劃線');
      }
      
      // 檢查角色名稱是否已存在（在相同範圍和租戶內）
      const existingRolesQuery = rolesCollection.where('roleName', '==', data.roleName);
      
      // 根據範圍添加查詢條件
      let scopeFilteredQuery;
      if (data.scope === 'global') {
        scopeFilteredQuery = existingRolesQuery.where('scope', '==', 'global');
      } else {
        scopeFilteredQuery = existingRolesQuery
          .where('scope', '==', data.scope)
          .where('tenantId', '==', data.tenantId);
      }
      
      const existingRoles = await scopeFilteredQuery.get();
      if (!existingRoles.empty) {
        throw new Error(`角色名稱 "${data.roleName}" 在此範圍內已存在`);
      }
      
      // 創建角色數據
      const roleData: Role = {
        roleId,
        roleName: data.roleName,
        description: data.description || '',
        roleLevel: data.roleLevel,
        scope: data.scope,
        permissions: data.permissions || {},
        isSystemRole: data.isSystemRole || false,
        isActive: data.isActive !== undefined ? data.isActive : true,
        tenantId: data.scope === 'global' ? null : data.tenantId,
        createdAt: FieldValue.serverTimestamp() as any,
        updatedAt: FieldValue.serverTimestamp() as any,
        createdBy: user.uid,
        updatedBy: user.uid
      };
      
      // 儲存到 Firestore
      await rolesCollection.doc(roleId).set(roleData);
      
      // 返回創建的角色資料（用於API響應）
      // 注意：這裡 serverTimestamp() 會在客戶端顯示為 null，需要處理
      return {
        ...roleData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('創建角色時出錯:', error);
      throw error;
    }
  }

  /**
   * 更新角色
   */
  async updateRole(roleId: string, data: UpdateRoleRequest, user: UserContext): Promise<Role | null> {
    try {
      // 獲取角色文檔
      const roleDoc = await rolesCollection.doc(roleId).get();
      
      if (!roleDoc.exists) {
        return null;
      }
      
      const roleData = roleDoc.data() as Role;
      
      // 租戶隔離 - 非超級管理員只能更新自己租戶的角色
      if (user.roleLevel > 0 && roleData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法更新其他租戶的角色');
      }
      
      // 系統角色限制 - 只有超級管理員可以更新系統角色
      if (roleData.isSystemRole && user.roleLevel > 0) {
        throw new Error('未授權：只有超級管理員可以更新系統角色');
      }
      
      // 範圍限制 - 全域角色只能由超級管理員更新
      if (roleData.scope === 'global' && user.roleLevel > 0) {
        throw new Error('未授權：只有超級管理員可以更新全域範圍的角色');
      }
      
      // 檢查角色等級 - 不能更改為比自己高權限的角色
      if (data.roleLevel !== undefined && data.roleLevel < user.roleLevel) {
        throw new Error('未授權：您無法將角色權限等級設置為比自己更高');
      }
      
      // 不可更新欄位過濾 - 確保某些關鍵欄位不被更新
      const updateObject: Partial<Role> = {};
      
      // 允許更新的欄位：description, permissions, isActive
      if (data.description !== undefined) {
        updateObject.description = data.description;
      }
      
      if (data.isActive !== undefined) {
        updateObject.isActive = data.isActive;
      }
      
      // 系統角色的特殊限制 - 超級管理員可以更新，但有限制
      if (roleData.isSystemRole) {
        // 超級管理員角色不能被停用
        if (roleData.roleId === 'role_super_admin' && data.isActive === false) {
          throw new Error('超級管理員角色不能被停用');
        }
        
        // 系統角色只允許更新description和isActive，不允許修改permissions
        if (data.permissions) {
          throw new Error('系統角色的權限結構不可修改');
        }
        
        // 系統角色不可更改名稱和範圍
        if (data.roleName !== undefined || data.scope !== undefined || data.roleLevel !== undefined) {
          throw new Error('系統角色的名稱、範圍和等級不可修改');
        }
      } else {
        // 非系統角色的更新處理
        
        // roleName的更新檢查（如果提供了）
        if (data.roleName !== undefined) {
          // 檢查名稱是否變更
          if (data.roleName !== roleData.roleName) {
            // 檢查新名稱是否已存在（在相同範圍和租戶內）
            const existingRolesQuery = rolesCollection.where('roleName', '==', data.roleName);
            
            // 根據範圍添加查詢條件
            let scopeFilteredQuery;
            if (roleData.scope === 'global') {
              scopeFilteredQuery = existingRolesQuery.where('scope', '==', 'global');
            } else {
              // 使用新的scope值（如果提供了）或保持原來的scope
              const newScope = data.scope !== undefined ? data.scope : roleData.scope;
              scopeFilteredQuery = existingRolesQuery
                .where('scope', '==', newScope)
                .where('tenantId', '==', roleData.tenantId);
            }
            
            const existingRoles = await scopeFilteredQuery.get();
            if (!existingRoles.empty) {
              throw new Error(`角色名稱 "${data.roleName}" 在此範圍內已存在`);
            }
            
            updateObject.roleName = data.roleName;
          }
        }
        
        // 範圍更新處理（如果提供了）
        if (data.scope !== undefined && data.scope !== roleData.scope) {
          // 不允許將非全域角色更改為全域角色
          if (data.scope === 'global' && roleData.scope !== 'global') {
            throw new Error('無法將非全域角色更改為全域角色');
          }
          
          // 不允許將全域角色更改為非全域角色
          if (roleData.scope === 'global' && data.scope !== 'global') {
            throw new Error('無法將全域角色更改為非全域角色');
          }
          
          updateObject.scope = data.scope;
        }
        
        // 角色等級更新（如果提供了）
        if (data.roleLevel !== undefined) {
          updateObject.roleLevel = data.roleLevel;
        }
        
        // 權限更新處理 - 檢查權限的有效性
        if (data.permissions) {
          const invalidPermissions: string[] = [];
          
          for (const [resourceType, permission] of Object.entries(data.permissions)) {
            // 檢查資源類型是否有效
            if (!VALID_RESOURCE_ACTIONS[resourceType as ResourceType]) {
              invalidPermissions.push(`無效的資源類型：${resourceType}`);
              continue;
            }
            
            // 檢查操作類型是否對該資源有效
            for (const [action, isEnabled] of Object.entries(permission)) {
              // 只檢查被啟用的權限
              if (isEnabled && !VALID_RESOURCE_ACTIONS[resourceType as ResourceType].includes(action as ActionType)) {
                invalidPermissions.push(`資源 "${resourceType}" 不支持操作 "${action}"`);
              }
            }
          }
          
          // 如果有無效的權限，拒絕更新請求
          if (invalidPermissions.length > 0) {
            throw new Error(`權限驗證失敗：${invalidPermissions.join('、')}`);
          }
          
          updateObject.permissions = data.permissions;
        }
      }
      
      // 添加審計欄位
      updateObject.updatedAt = FieldValue.serverTimestamp() as any;
      updateObject.updatedBy = user.uid;
      
      // 如果沒有實際的更新內容，直接返回當前角色資料
      if (Object.keys(updateObject).length <= 2) { // 只有審計欄位
        return this.convertRoleDocument(roleDoc);
      }
      
      // 執行更新操作
      await rolesCollection.doc(roleId).update(updateObject);
      console.log(`成功更新角色 ${roleId}`);
      
      // 獲取更新後的角色資料
      const updatedRoleDoc = await rolesCollection.doc(roleId).get();
      return this.convertRoleDocument(updatedRoleDoc);
    } catch (error) {
      console.error(`更新角色(${roleId})時出錯:`, error);
      throw error;
    }
  }

  /**
   * 刪除角色
   */
  async deleteRole(roleId: string, user: UserContext): Promise<boolean> {
    try {
      // 獲取角色文檔
      const roleDoc = await rolesCollection.doc(roleId).get();
      
      if (!roleDoc.exists) {
        return false;
      }
      
      const roleData = roleDoc.data() as Role;
      
      // 租戶隔離 - 非超級管理員只能刪除自己租戶的角色
      if (user.roleLevel > 0 && roleData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法刪除其他租戶的角色');
      }
      
      // 系統角色限制 - 系統角色不能刪除
      if (roleData.isSystemRole) {
        throw new Error('未授權：系統角色不能被刪除');
      }
      
      // 範圍限制 - 全域角色只能由超級管理員刪除
      if (roleData.scope === 'global' && user.roleLevel > 0) {
        throw new Error('未授權：只有超級管理員可以刪除全域範圍的角色');
      }
      
      // 角色等級限制 - 不能刪除比自己高權限等級的角色
      if (roleData.roleLevel < user.roleLevel) {
        throw new Error('未授權：您無法刪除比您權限等級更高的角色');
      }
      
      // 檢查角色是否正在被用戶使用
      const usersWithRole = await usersCollection
        .where('roleId', '==', roleId)
        .limit(1)
        .get();
      
      if (!usersWithRole.empty) {
        throw new Error('角色正在使用中：此角色已分配給用戶，無法刪除。請先將用戶分配到其他角色');
      }
      
      // 執行實際刪除操作
      await rolesCollection.doc(roleId).delete();
      
      console.log(`成功刪除角色 ${roleId}`);
      return true;
    } catch (error) {
      console.error(`刪除角色(${roleId})時出錯:`, error);
      throw error;
    }
  }

  /**
   * 更新角色權限
   */
  async updateRolePermissions(
    roleId: string, 
    permissions: { [key: string]: { create: boolean; read: boolean; update: boolean; delete: boolean } }, 
    user: UserContext
  ): Promise<Role | null> {
    try {
      // 獲取角色文檔
      const roleDoc = await rolesCollection.doc(roleId).get();
      
      if (!roleDoc.exists) {
        return null;
      }
      
      const roleData = roleDoc.data() as Role;
      
      // 租戶隔離 - 非超級管理員只能更新自己租戶的角色
      if (user.roleLevel > 0 && roleData.tenantId !== user.tenantId) {
        throw new Error('未授權：您無法更新其他租戶的角色權限');
      }
      
      // 系統角色限制 - 只有超級管理員可以更新系統角色權限
      if (roleData.isSystemRole && user.roleLevel > 0) {
        throw new Error('未授權：只有超級管理員可以更新系統角色權限');
      }
      
      // 執行更新操作
      await rolesCollection.doc(roleId).update({
        permissions,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid
      });
      
      console.log(`成功更新角色 ${roleId} 的權限`);
      
      // 獲取更新後的角色資料
      const updatedRoleDoc = await rolesCollection.doc(roleId).get();
      return this.convertRoleDocument(updatedRoleDoc);
    } catch (error) {
      console.error(`更新角色權限(${roleId})時出錯:`, error);
      throw error;
    }
  }
  
  /**
   * 將 Firestore 文檔轉換為 Role 對象
   */
  private convertRoleDocument(doc: DocumentSnapshot): Role {
    const data = doc.data() as Role;
    
    // 處理 Timestamp 類型，確保客戶端獲得標準格式
    let result = {
      ...data,
      roleId: doc.id // 如果沒有 roleId，使用文檔 ID
    } as Role;
    
    // 轉換時間戳記錄為可序列化格式
    if (data.createdAt && typeof data.createdAt !== 'string') {
      if ('toDate' in (data.createdAt as any)) {
        result.createdAt = (data.createdAt as Timestamp).toDate().toISOString();
      }
    }
    
    if (data.updatedAt && typeof data.updatedAt !== 'string') {
      if ('toDate' in (data.updatedAt as any)) {
        result.updatedAt = (data.updatedAt as Timestamp).toDate().toISOString();
      }
    }
    
    return result;
  }

  /**
   * 生成唯一的角色 ID (格式: role_{隨機字符})
   */
  private generateRoleId(): string {
    const randomStr = Math.random().toString(36).substring(2, 6);
    return `role_${randomStr}`;
  }

  /**
   * 檢查用戶是否具有特定資源的特定操作權限
   * (簡化版，實際實現可能更複雜)
   */
  private hasPermission(user: UserContext, resource: string, action: string): boolean {
    // 超級管理員擁有所有權限
    if (user.roleLevel === 0) {
      return true;
    }
    
    // 檢查用戶的權限
    if (user.permissions && 
        user.permissions[resource] && 
        user.permissions[resource][action as keyof typeof user.permissions[typeof resource]]) {
      return true;
    }
    
    // 根據角色檢查
    if (user.role === 'tenant_admin' && ['roles', 'employees', 'stores'].includes(resource)) {
      return true;
    }
    
    return false;
  }
}

// 導出服務單例
export const roleService = new RoleService(); 