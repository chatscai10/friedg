import { Request, Response } from 'express';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crmService from './crm.service';
import { CustomerNote } from '../users/user.types';

const logger = functions.logger;

/**
 * 獲取客戶資料
 * @param req 請求對象
 * @param res 響應對象
 */
export async function getCustomerHandler(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      logger.error('缺少租戶 ID');
      return res.status(400).json({ success: false, message: '缺少租戶 ID' });
    }

    const customer = await crmService.getCustomerById(customerId, tenantId);
    if (!customer) {
      return res.status(404).json({ success: false, message: '客戶不存在' });
    }

    return res.status(200).json({ success: true, data: customer });
  } catch (error: any) {
    logger.error('獲取客戶資料時發生錯誤', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: `獲取客戶資料失敗: ${error.message}` });
  }
}

/**
 * 更新客戶資料
 * @param req 請求對象
 * @param res 響應對象
 */
export async function updateCustomerHandler(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const updateData = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      logger.error('缺少租戶 ID');
      return res.status(400).json({ success: false, message: '缺少租戶 ID' });
    }

    const updatedCustomer = await crmService.updateCustomer(customerId, tenantId, updateData);
    return res.status(200).json({ success: true, data: updatedCustomer });
  } catch (error: any) {
    logger.error('更新客戶資料時發生錯誤', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: `更新客戶資料失敗: ${error.message}` });
  }
}

/**
 * 列出客戶
 * @param req 請求對象
 * @param res 響應對象
 */
export async function listCustomersHandler(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      logger.error('缺少租戶 ID');
      return res.status(400).json({ success: false, message: '缺少租戶 ID' });
    }

    // 從查詢參數中獲取過濾條件
    const {
      query,
      tags,
      minTotalSpent,
      maxTotalSpent,
      minOrderCount,
      status,
      membershipTier,
      source,
      lastActivityDateStart,
      lastActivityDateEnd,
      limit,
      cursor,
    } = req.query;

    // 轉換查詢參數
    const filters: Record<string, any> = {};
    if (query) filters.query = query as string;
    if (tags) filters.tags = (tags as string).split(',');
    if (minTotalSpent) filters.minTotalSpent = Number(minTotalSpent);
    if (maxTotalSpent) filters.maxTotalSpent = Number(maxTotalSpent);
    if (minOrderCount) filters.minOrderCount = Number(minOrderCount);
    if (status) filters.status = status as 'active' | 'inactive' | 'blocked';
    if (membershipTier) filters.membershipTier = membershipTier as string;
    if (source) filters.source = source as string;
    // 日期可能需要特殊處理，轉換為 Timestamp
    // 這裡假設前端傳入的是 ISO 格式的日期字符串
    if (lastActivityDateStart) {
      const date = new Date(lastActivityDateStart as string);
      filters.lastActivityDateStart = admin.firestore.Timestamp.fromDate(date);
    }
    if (lastActivityDateEnd) {
      const date = new Date(lastActivityDateEnd as string);
      filters.lastActivityDateEnd = admin.firestore.Timestamp.fromDate(date);
    }

    // 查詢結果
    const result = await crmService.listCustomers(
      filters,
      tenantId,
      limit ? Number(limit) : 10,
      cursor as string | undefined
    );

    return res.status(200).json({
      success: true,
      data: {
        customers: result.customers,
        nextCursor: result.nextCursor,
        totalCount: result.totalCount,
      },
    });
  } catch (error: any) {
    logger.error('列出客戶時發生錯誤', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: `列出客戶失敗: ${error.message}` });
  }
}

/**
 * 向客戶添加標籤
 * @param req 請求對象
 * @param res 響應對象
 */
export async function addTagToCustomerHandler(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const { tag } = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      logger.error('缺少租戶 ID');
      return res.status(400).json({ success: false, message: '缺少租戶 ID' });
    }

    if (!tag) {
      return res.status(400).json({ success: false, message: '缺少標籤' });
    }

    await crmService.addTagToCustomer(customerId, tenantId, tag);
    return res.status(200).json({ success: true, message: '添加標籤成功' });
  } catch (error: any) {
    logger.error('添加標籤時發生錯誤', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: `添加標籤失敗: ${error.message}` });
  }
}

/**
 * 從客戶移除標籤
 * @param req 請求對象
 * @param res 響應對象
 */
export async function removeTagFromCustomerHandler(req: Request, res: Response) {
  try {
    const { customerId, tag } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      logger.error('缺少租戶 ID');
      return res.status(400).json({ success: false, message: '缺少租戶 ID' });
    }

    if (!tag) {
      return res.status(400).json({ success: false, message: '缺少標籤' });
    }

    await crmService.removeTagFromCustomer(customerId, tenantId, tag);
    return res.status(200).json({ success: true, message: '移除標籤成功' });
  } catch (error: any) {
    logger.error('移除標籤時發生錯誤', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: `移除標籤失敗: ${error.message}` });
  }
}

/**
 * 向客戶添加備註
 * @param req 請求對象
 * @param res 響應對象
 */
export async function addNoteToCustomerHandler(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const { text, isImportant } = req.body;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.uid;
    // 從用戶文檔中獲取顯示名稱，或使用默認值
    const userName = '系統管理員';

    if (!tenantId) {
      logger.error('缺少租戶 ID');
      return res.status(400).json({ success: false, message: '缺少租戶 ID' });
    }

    if (!userId) {
      logger.error('缺少用戶 ID');
      return res.status(400).json({ success: false, message: '缺少用戶 ID' });
    }

    if (!text) {
      return res.status(400).json({ success: false, message: '備註內容不能為空' });
    }

    const noteData: Omit<CustomerNote, 'noteId' | 'timestamp'> = {
      text,
      addedBy: userId,
      addedByName: userName,
      isImportant: isImportant || false,
    };

    const newNote = await crmService.addNoteToCustomer(customerId, tenantId, noteData);
    return res.status(201).json({ success: true, data: newNote });
  } catch (error: any) {
    logger.error('添加備註時發生錯誤', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: `添加備註失敗: ${error.message}` });
  }
}

/**
 * 獲取客戶備註
 * @param req 請求對象
 * @param res 響應對象
 */
export async function getCustomerNotesHandler(req: Request, res: Response) {
  try {
    const { customerId } = req.params;
    const tenantId = req.user?.tenantId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    if (!tenantId) {
      logger.error('缺少租戶 ID');
      return res.status(400).json({ success: false, message: '缺少租戶 ID' });
    }

    const notes = await crmService.getCustomerNotes(customerId, tenantId, limit);
    return res.status(200).json({ success: true, data: notes });
  } catch (error: any) {
    logger.error('獲取備註時發生錯誤', { error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: `獲取備註失敗: ${error.message}` });
  }
} 