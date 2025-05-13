/**
 * 表示系统中的一个原子权限项。
 * 与 types/role.ts 中的 PermissionItem 保持一致。
 */
export interface PermissionItem {
  id: string; // 唯一标识符，例如 'users:create' 或 'products:read:own'
  name: string; // 人类可读的权限名称，例如 "创建用户"
  resourceType: string; // 权限作用的资源类型，例如 'users', 'products', 'orders'
  action: string; // 对资源执行的操作，例如 'create', 'read', 'update', 'delete', 'manage'
  description?: string; // 对权限的详细描述
  conditions?: Record<string, any>; // 可选的条件，用于更细粒度的控制，例如 { department: 'sales' }
  // 未来可能添加的字段:
  // group?: string; // 权限分组，例如 '用户管理', '订单管理'
  // category?: string; // 权限分类，例如 '核心操作', '报表查看'
}

/**
 * 代表权限列表在 Redux store 中的状态。
 */
export interface PermissionState {
  permissionsList: PermissionItem[]; // 当前获取到的所有可用权限列表
  loading: boolean; // 指示权限列表是否正在加载中
  error: string | null; // 如果加载过程中发生错误，则存储错误信息
} 