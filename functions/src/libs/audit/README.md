# 操作日誌 (Audit Log) 模組

這個模組提供了一個通用的操作日誌記錄服務，可用於追蹤系統中的各種操作和事件，有助於問題診斷、安全審計和合規要求。

## 功能特點

- 記錄各種系統操作和事件
- 支持詳細的操作資訊，包括操作者、操作對象、操作內容等
- 不會影響主要業務流程的執行
- 提供日誌清理功能，避免日誌過度增長
- 支持分區索引，提高日誌查詢效能

## 使用方法

### 基本用法

```typescript
import { logAuditEvent, AuditLogAction, AuditLogEntityType, AuditLogStatus } from '../libs/audit';

// 在任何需要記錄操作的地方
async function updateUserProfile(userId: string, profileData: any) {
  try {
    // 執行業務邏輯
    const previousData = await getUserProfile(userId);
    await updateUserProfileInDatabase(userId, profileData);
    
    // 記錄操作日誌 (不阻塞主流程)
    logAuditEvent({
      userId: currentUser.uid,
      userName: currentUser.displayName,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      tenantId: currentUser.tenantId,
      
      action: AuditLogAction.USER_UPDATE,
      status: AuditLogStatus.SUCCESS,
      
      targetEntityType: AuditLogEntityType.USER,
      targetEntityId: userId,
      targetEntityName: previousData.displayName,
      
      previousState: previousData,
      newState: profileData,
      
      // 可選的請求資訊
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    return { success: true };
  } catch (error) {
    // 記錄失敗操作
    logAuditEvent({
      userId: currentUser.uid,
      action: AuditLogAction.USER_UPDATE,
      status: AuditLogStatus.FAILURE,
      statusMessage: error.message,
      targetEntityType: AuditLogEntityType.USER,
      targetEntityId: userId
    });
    
    throw error;
  }
}
```

### 在 Express 中間件中使用

```typescript
import { logAuditEvent, AuditLogStatus } from '../libs/audit';

// 創建一個中間件來自動記錄 API 操作
export function auditMiddleware(
  entityType: string,
  actionMap: Record<string, string> = {
    GET: 'read',
    POST: 'create',
    PUT: 'update',
    DELETE: 'delete'
  }
) {
  return async (req: any, res: any, next: any) => {
    const originalEnd = res.end;
    const requestStartTime = Date.now();
    
    // 擷取請求資訊
    const user = req.user;
    const method = req.method;
    const action = actionMap[method] || method.toLowerCase();
    const entityId = req.params.id || 'multiple';
    
    // 覆寫 res.end 方法
    res.end = function(chunk?: any, encoding?: any) {
      const responseTime = Date.now() - requestStartTime;
      const statusCode = res.statusCode;
      const isSuccess = statusCode >= 200 && statusCode < 400;
      
      // 記錄操作日誌
      logAuditEvent({
        userId: user ? user.uid : 'anonymous',
        userName: user ? user.displayName : undefined,
        userRole: user ? user.role : undefined,
        tenantId: user ? user.tenantId : undefined,
        
        action: `${entityType}_${action}`,
        status: isSuccess ? AuditLogStatus.SUCCESS : AuditLogStatus.FAILURE,
        statusMessage: isSuccess ? undefined : `HTTP ${statusCode}`,
        
        targetEntityType: entityType,
        targetEntityId: entityId,
        
        details: {
          method: req.method,
          path: req.path,
          query: req.query,
          responseTime,
          statusCode
        },
        
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        requestPath: req.originalUrl,
        requestMethod: req.method
      });
      
      // 調用原始的 end 方法
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}

// 在路由中使用
app.use('/api/users', auditMiddleware('user'));
```

## 清理過期日誌

您可以設置定期任務（例如 Google Cloud Scheduler）以 HTTP 觸發器的形式調用 `cleanupAuditLogs` 函數。
建議將此排程設置為每月執行一次，以清理超過 365 天的操作日誌。

## 注意事項

1. 日誌記錄功能設計為不影響主要業務流程，即使日誌記錄失敗也不會阻止業務操作繼續執行。
2. 對於包含敏感資訊的操作，應該謹慎考慮記錄的詳細程度，避免在日誌中存儲敏感數據。
3. 在高流量場景中，大量的日誌記錄可能會增加 Firestore 的讀寫操作成本，請考慮適當的日誌記錄策略。 