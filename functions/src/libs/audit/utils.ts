/**
 * 操作日誌 (Audit Log) 模組 - 實用工具函數
 */
import { Request } from 'express';
import { logAuditEvent, AuditLogAction, AuditLogEntityType, AuditLogStatus } from './index';

/**
 * 從請求中獲取環境信息
 * @param req Express 請求對象
 * @returns 環境信息對象
 */
export const getRequestContext = (req: Request): { 
  ipAddress?: string; 
  userAgent?: string; 
  requestPath?: string;
  requestMethod?: string;
} => {
  return {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestPath: req.originalUrl,
    requestMethod: req.method
  };
};

/**
 * 用於系統操作的簡化操作日誌記錄函數
 * @param req Express 請求對象
 * @param action 操作類型
 * @param entityType 實體類型
 * @param entityId 實體ID
 * @param entityName 實體名稱（可選）
 * @param status 操作狀態
 * @param statusMessage 狀態消息（可選）
 * @param details 詳細信息（可選）
 * @param previousState 操作前狀態（可選）
 * @param newState 操作後狀態（可選）
 * @returns 日誌記錄ID
 */
export const logSystemAction = async (
  req: Request,
  action: string, 
  entityType: string,
  entityId: string,
  entityName?: string,
  status: AuditLogStatus = AuditLogStatus.SUCCESS,
  statusMessage?: string,
  details?: Record<string, any>,
  previousState?: Record<string, any>,
  newState?: Record<string, any>
): Promise<string | null> => {
  const user = (req as any).user;
  
  if (!user || !user.uid) {
    console.error('記錄操作日誌失敗：無法獲取用戶信息');
    return null;
  }

  const contextInfo = getRequestContext(req);
  
  return await logAuditEvent({
    userId: user.uid,
    userName: user.displayName || user.name,
    userEmail: user.email,
    userRole: user.role,
    tenantId: user.tenantId,
    storeId: user.storeId,
    
    action,
    status,
    statusMessage,
    
    targetEntityType: entityType,
    targetEntityId: entityId,
    targetEntityName: entityName,
    
    details,
    previousState,
    newState,
    
    ...contextInfo
  });
};

/**
 * 記錄登入成功事件
 */
export const logLoginSuccess = async (req: Request, userId: string, userName?: string) => {
  return await logSystemAction(
    req,
    AuditLogAction.USER_LOGIN,
    AuditLogEntityType.USER,
    userId,
    userName,
    AuditLogStatus.SUCCESS,
    '登入成功',
    { loginMethod: 'password' } // 可擴展為其他登入方法
  );
};

/**
 * 記錄登入失敗事件
 */
export const logLoginFailure = async (req: Request, userId: string, reason: string) => {
  const contextInfo = getRequestContext(req);
  
  return await logAuditEvent({
    userId: userId || 'unknown',
    action: AuditLogAction.USER_LOGIN,
    status: AuditLogStatus.FAILURE,
    statusMessage: reason,
    targetEntityType: AuditLogEntityType.USER,
    targetEntityId: userId || 'unknown',
    ...contextInfo
  });
};

/**
 * 記錄用戶登出事件
 */
export const logLogout = async (req: Request, userId: string, userName?: string) => {
  return await logSystemAction(
    req,
    AuditLogAction.USER_LOGOUT,
    AuditLogEntityType.USER,
    userId,
    userName,
    AuditLogStatus.SUCCESS,
    '用戶已登出'
  );
};

/**
 * 記錄請假申請相關事件
 */
export const logLeaveAction = async (
  req: Request,
  action: string,
  leaveId: string,
  leaveName: string,
  status: AuditLogStatus = AuditLogStatus.SUCCESS,
  statusMessage?: string,
  details?: Record<string, any>,
  previousState?: Record<string, any>,
  newState?: Record<string, any>
) => {
  return await logSystemAction(
    req,
    action,
    'leave_request',
    leaveId,
    leaveName,
    status,
    statusMessage,
    details,
    previousState,
    newState
  );
};

/**
 * 記錄添加新租戶事件
 */
export const logTenantCreation = async (
  req: Request,
  tenantId: string,
  tenantName: string,
  details?: Record<string, any>
) => {
  return await logSystemAction(
    req,
    AuditLogAction.TENANT_CREATE,
    AuditLogEntityType.TENANT,
    tenantId,
    tenantName,
    AuditLogStatus.SUCCESS,
    '建立新租戶',
    details
  );
};

/**
 * 記錄更新租戶狀態事件
 */
export const logTenantStatusChange = async (
  req: Request,
  tenantId: string,
  tenantName: string,
  oldStatus: string,
  newStatus: string,
  reason?: string
) => {
  return await logSystemAction(
    req,
    AuditLogAction.TENANT_STATUS_CHANGE,
    AuditLogEntityType.TENANT,
    tenantId,
    tenantName,
    AuditLogStatus.SUCCESS,
    `租戶狀態變更: ${oldStatus} -> ${newStatus}`,
    { reason },
    { status: oldStatus },
    { status: newStatus }
  );
};

/**
 * 記錄產品操作事件
 */
export const logProductAction = async (
  req: Request,
  action: string,
  productId: string,
  productName: string,
  status: AuditLogStatus = AuditLogStatus.SUCCESS,
  statusMessage?: string,
  details?: Record<string, any>,
  previousState?: Record<string, any>,
  newState?: Record<string, any>
) => {
  return await logSystemAction(
    req,
    action,
    AuditLogEntityType.PRODUCT,
    productId,
    productName,
    status,
    statusMessage,
    details,
    previousState,
    newState
  );
};

/**
 * 記錄員工操作事件
 */
export const logEmployeeAction = async (
  req: Request,
  action: string,
  employeeId: string,
  employeeName: string,
  status: AuditLogStatus = AuditLogStatus.SUCCESS,
  statusMessage?: string,
  details?: Record<string, any>,
  previousState?: Record<string, any>,
  newState?: Record<string, any>
) => {
  return await logSystemAction(
    req,
    action,
    AuditLogEntityType.EMPLOYEE,
    employeeId,
    employeeName,
    status,
    statusMessage,
    details,
    previousState,
    newState
  );
};

/**
 * 記錄系統設定變更事件
 */
export const logSettingsChange = async (
  req: Request,
  settingId: string,
  settingName: string,
  previousValue: any,
  newValue: any
) => {
  return await logSystemAction(
    req,
    AuditLogAction.SETTINGS_UPDATE,
    AuditLogEntityType.SETTINGS,
    settingId,
    settingName,
    AuditLogStatus.SUCCESS,
    '更新系統設定',
    { settingName },
    { value: previousValue },
    { value: newValue }
  );
};

/**
 * 記錄庫存操作事件
 */
export const logInventoryAction = async (
  req: Request,
  action: string,
  inventoryId: string,
  itemName: string,
  status: AuditLogStatus = AuditLogStatus.SUCCESS,
  statusMessage?: string,
  details?: Record<string, any>,
  previousState?: Record<string, any>,
  newState?: Record<string, any>
) => {
  return await logSystemAction(
    req,
    action,
    AuditLogEntityType.INVENTORY,
    inventoryId,
    itemName,
    status,
    statusMessage,
    details,
    previousState,
    newState
  );
}; 