import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { 
  NotificationChannelType, 
  NotificationPriority, 
  NotificationType,
  NotificationRequest 
} from './notification.types';

/**
 * 發送測試電子郵件通知
 * POST /api/notifications/send-test-email
 */
export const sendTestEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { to, subject, body, senderName } = req.body;
    
    if (!to || !Array.isArray(to) || to.length === 0) {
      res.status(400).json({
        status: 'error',
        message: '收件人列表不能為空，且必須是陣列格式'
      });
      return;
    }
    
    if (!subject || !body) {
      res.status(400).json({
        status: 'error',
        message: '郵件主題和內容不能為空'
      });
      return;
    }
    
    // 確保都是有效的電子郵件地址
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = to.filter(email => emailRegex.test(email));
    
    if (validEmails.length === 0) {
      res.status(400).json({
        status: 'error',
        message: '沒有提供有效的電子郵件地址'
      });
      return;
    }
    
    // 創建通知請求
    const notificationRequest: NotificationRequest = {
      base: {
        title: subject,
        body: body,
        recipients: validEmails,
        priority: NotificationPriority.NORMAL,
        type: NotificationType.SYSTEM,
        data: {
          testNotification: true,
          timestamp: new Date().toISOString()
        }
      },
      channels: {
        [NotificationChannelType.EMAIL]: {
          subject,
          text: body,
          html: `<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="line-height: 1.6; color: #444;">
              ${body.replace(/\n/g, '<br/>')}
            </div>
            <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
              這是一封測試郵件，由系統自動發送。
            </p>
          </div>`,
          from: senderName ? {
            name: senderName,
            email: 'noreply@example.com'
          } : undefined
        }
      }
    };
    
    // 發送通知
    const results = await notificationService.sendNotification(notificationRequest);
    
    const success = results.some(result => result.success);
    const failures = results.filter(result => !result.success);
    
    if (success) {
      res.status(200).json({
        status: 'success',
        message: `成功發送測試電子郵件到 ${validEmails.join(', ')}`,
        results,
        failureCount: failures.length
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: '所有發送嘗試均失敗',
        errors: failures.map(f => {
          if (f.error instanceof Error) {
            return f.error.message;
          } else if (typeof f.error === 'string') {
            return f.error;
          } else {
            return '未知錯誤';
          }
        })
      });
    }
    
  } catch (error) {
    console.error('發送測試電子郵件失敗:', error);
    res.status(500).json({
      status: 'error',
      message: '處理請求時發生錯誤',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * 獲取用戶的通知列表
 * GET /api/notifications
 */
export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: '未登入或身份無效'
      });
      return;
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    
    const result = await notificationService.getUserNotifications(userId, limit, page);
    
    res.status(200).json({
      status: 'success',
      data: result.notifications,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalCount,
        limit
      }
    });
    
  } catch (error) {
    console.error('獲取用戶通知失敗:', error);
    res.status(500).json({
      status: 'error',
      message: '處理請求時發生錯誤',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * 標記通知為已讀
 * PATCH /api/notifications/:id/read
 */
export const markNotificationAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    const notificationId = req.params.id;
    
    if (!userId) {
      res.status(401).json({
        status: 'error',
        message: '未登入或身份無效'
      });
      return;
    }
    
    if (!notificationId) {
      res.status(400).json({
        status: 'error',
        message: '通知ID不能為空'
      });
      return;
    }
    
    await notificationService.markAsRead(notificationId, userId);
    
    res.status(200).json({
      status: 'success',
      message: '通知已標記為已讀'
    });
    
  } catch (error) {
    console.error('標記通知為已讀失敗:', error);
    res.status(500).json({
      status: 'error',
      message: '處理請求時發生錯誤',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}; 