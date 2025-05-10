import * as admin from 'firebase-admin';
import { StockCount, StockCountItem, InternalRequisition, RequisitionItem } from './types';
import { logAuditEvent, AuditLogAction, AuditLogEntityType, AuditLogStatus } from '../libs/audit';
import { logInventoryAction } from '../libs/audit/utils';
import { Request } from 'express';

/**
 * 代表盤點項目的簡化輸入結構
 */
export interface StockCountItemInput {
  inventoryItemId: string;
  countedQuantity: number;
  notes?: string;
}

/**
 * 開始新的庫存盤點流程
 * 
 * @param tenantId 租戶ID
 * @param locationId 盤點地點ID
 * @param initiatedBy 發起人用戶ID
 * @returns 新創建的盤點記錄
 */
export async function startStockCount(
  tenantId: string,
  locationId: string,
  initiatedBy: string
): Promise<StockCount> {
  const db = admin.firestore();
  
  // 創建新的盤點記錄文檔
  const now = admin.firestore.Timestamp.now();
  const countDate = now;
  
  const newStockCount: Omit<StockCount, 'id'> = {
    tenantId,
    locationId,
    countDate: countDate.toDate(),
    status: 'draft', // 初始狀態為草稿
    countedBy: initiatedBy,
    items: [], // 初始化空的盤點項目列表
    createdAt: now.toDate(),
    updatedAt: now.toDate()
  };
  
  // 將記錄寫入 Firestore
  const stockCountsRef = db.collection('stockCounts');
  const docRef = await stockCountsRef.add(newStockCount);
  
  // 返回完整的盤點記錄（包含ID）
  return {
    ...newStockCount,
    id: docRef.id
  };
}

/**
 * 記錄盤點項目
 * 
 * @param tenantId 租戶ID
 * @param stockCountId 盤點記錄ID
 * @param items 盤點項目及數量列表
 */
export async function recordStockCountItems(
  tenantId: string,
  stockCountId: string,
  items: StockCountItemInput[]
): Promise<void> {
  const db = admin.firestore();
  const stockCountRef = db.collection('stockCounts').doc(stockCountId);
  
  // 首先檢查盤點記錄是否存在且屬於正確的租戶
  const stockCountDoc = await stockCountRef.get();
  if (!stockCountDoc.exists) {
    throw new Error(`Stock count with ID ${stockCountId} not found`);
  }
  
  const stockCountData = stockCountDoc.data() as Omit<StockCount, 'id'>;
  if (stockCountData.tenantId !== tenantId) {
    throw new Error('Unauthorized access to stock count data');
  }
  
  // 檢查盤點記錄狀態是否允許修改
  if (stockCountData.status !== 'draft' && stockCountData.status !== 'submitted') {
    throw new Error(`Cannot modify stock count in ${stockCountData.status} status`);
  }
  
  // 將輸入項目轉換為標準格式的盤點項目
  const stockCountItems: StockCountItem[] = items.map(item => ({
    inventoryItemId: item.inventoryItemId,
    countedQuantity: item.countedQuantity,
    notes: item.notes
  }));
  
  // 更新盤點記錄中的項目
  // 注意：這裡採用的策略是完全替換項目列表，如果要支援增量更新則需要不同邏輯
  await stockCountRef.update({
    items: stockCountItems,
    updatedAt: admin.firestore.Timestamp.now().toDate()
  });
}

/**
 * 提交盤點記錄以待審核
 * 
 * @param tenantId 租戶ID
 * @param stockCountId 盤點記錄ID
 * @param submittedBy 提交人用戶ID
 * @param req Express 請求對象 (用於操作日誌)
 */
export async function submitStockCount(
  tenantId: string,
  stockCountId: string,
  submittedBy: string,
  req?: Request
): Promise<void> {
  const db = admin.firestore();
  const stockCountRef = db.collection('stockCounts').doc(stockCountId);
  
  // 檢查盤點記錄是否存在且屬於正確的租戶
  const stockCountDoc = await stockCountRef.get();
  if (!stockCountDoc.exists) {
    throw new Error(`Stock count with ID ${stockCountId} not found`);
  }
  
  const stockCountData = stockCountDoc.data() as Omit<StockCount, 'id'>;
  if (stockCountData.tenantId !== tenantId) {
    throw new Error('Unauthorized access to stock count data');
  }
  
  // 檢查盤點記錄狀態是否為草稿
  if (stockCountData.status !== 'draft') {
    throw new Error(`Cannot submit stock count in ${stockCountData.status} status`);
  }
  
  // 檢查是否至少有一個盤點項目
  if (!stockCountData.items || stockCountData.items.length === 0) {
    throw new Error('Cannot submit empty stock count');
  }
  
  // 更新盤點記錄狀態為已提交
  await stockCountRef.update({
    status: 'submitted',
    updatedAt: admin.firestore.Timestamp.now().toDate()
  });
  
  // 記錄操作日誌
  if (req) {
    try {
      await logInventoryAction(
        req,
        AuditLogAction.INVENTORY_CHECK,
        stockCountId,
        `Inventory Count (${new Date(stockCountData.countDate).toLocaleDateString()})`,
        AuditLogStatus.SUCCESS,
        '提交庫存盤點',
        {
          locationId: stockCountData.locationId,
          itemCount: stockCountData.items?.length || 0,
          countDate: stockCountData.countDate
        },
        { status: 'draft' },
        { status: 'submitted' }
      );
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }
  }
}

/**
 * 內部叫貨單的輸入資料結構
 */
export interface InternalRequisitionInput {
  tenantId: string;          // 租戶ID
  fromLocationId: string;    // 申請方地點ID
  toLocationId: string;      // 供應方地點ID
  requiredDate?: Date;       // 需求日期（選填）
  notes?: string;            // 備註（選填）
  items: RequisitionItemInput[]; // 叫貨項目列表
}

/**
 * 叫貨項目的輸入資料結構
 */
export interface RequisitionItemInput {
  inventoryItemId: string;   // 庫存項目ID
  requestedQuantity: number; // 需求數量
  notes?: string;            // 備註（選填）
}

/**
 * 創建新的內部叫貨單
 * 
 * @param requesterId 申請人用戶ID
 * @param requisitionData 叫貨單資料
 * @returns 新創建的叫貨單
 */
export async function createInternalRequisition(
  requesterId: string,
  requisitionData: InternalRequisitionInput
): Promise<InternalRequisition> {
  const db = admin.firestore();
  
  // 生成叫貨單號
  const timestamp = Date.now();
  const requestNumber = `REQ-${timestamp}-${requesterId.substring(0, 4)}`;
  
  // 創建新的叫貨單記錄
  const now = admin.firestore.Timestamp.now();
  const requestItems: RequisitionItem[] = requisitionData.items.map(item => ({
    inventoryItemId: item.inventoryItemId,
    requestedQuantity: item.requestedQuantity,
    notes: item.notes
  }));
  
  const newRequisition: Omit<InternalRequisition, 'id'> = {
    tenantId: requisitionData.tenantId,
    requestNumber: requestNumber,
    fromLocationId: requisitionData.fromLocationId,
    toLocationId: requisitionData.toLocationId,
    requestedBy: requesterId,
    status: 'submitted', // 初始狀態為已提交，等待審核
    requestDate: now.toDate(),
    requiredDate: requisitionData.requiredDate,
    notes: requisitionData.notes,
    items: requestItems,
    createdAt: now.toDate(),
    updatedAt: now.toDate()
  };
  
  // 將記錄寫入 Firestore
  const requisitionsRef = db.collection('internalRequisitions');
  const docRef = await requisitionsRef.add(newRequisition);
  
  // 返回完整的叫貨單記錄（包含ID）
  return {
    ...newRequisition,
    id: docRef.id
  };
}

/**
 * 更新內部叫貨單狀態 (審批或拒絕)
 * 
 * @param tenantId 租戶ID
 * @param requisitionId 叫貨單ID
 * @param processorId 處理人用戶ID
 * @param newStatus 新狀態 (approved 或 rejected)
 * @param comments 處理意見 (選填)
 * @param req Express 請求對象 (用於操作日誌)
 */
export async function updateInternalRequisitionStatus(
  tenantId: string,
  requisitionId: string,
  processorId: string,
  newStatus: 'approved' | 'rejected',
  comments?: string,
  req?: Request
): Promise<void> {
  const db = admin.firestore();
  const requisitionRef = db.collection('internalRequisitions').doc(requisitionId);
  
  // 檢查叫貨單是否存在
  const requisitionDoc = await requisitionRef.get();
  if (!requisitionDoc.exists) {
    throw new Error(`Requisition with ID ${requisitionId} not found`);
  }
  
  // 檢查租戶ID
  const requisitionData = requisitionDoc.data() as Omit<InternalRequisition, 'id'>;
  if (requisitionData.tenantId !== tenantId) {
    throw new Error('Unauthorized access to requisition data');
  }
  
  // 檢查叫貨單當前狀態
  if (requisitionData.status !== 'submitted') {
    throw new Error(`Cannot update requisition in ${requisitionData.status} status`);
  }
  
  // 更新叫貨單狀態
  const now = admin.firestore.Timestamp.now();
  const updateData = {
    status: newStatus,
    processedBy: processorId,
    processedAt: now.toDate(),
    processorComments: comments,
    updatedAt: now.toDate()
  };
  
  // 執行更新
  await requisitionRef.update(updateData);
  
  // 記錄操作日誌
  if (req) {
    try {
      await logInventoryAction(
        req,
        newStatus === 'approved' ? 'internal_requisition_approve' : 'internal_requisition_reject',
        requisitionId,
        `內部叫貨單 ${requisitionData.requestNumber}`,
        AuditLogStatus.SUCCESS,
        newStatus === 'approved' ? '核准內部叫貨單' : '拒絕內部叫貨單',
        {
          requestNumber: requisitionData.requestNumber,
          fromLocationId: requisitionData.fromLocationId,
          toLocationId: requisitionData.toLocationId,
          requestDate: requisitionData.requestDate,
          processorComments: comments
        },
        { status: requisitionData.status },
        { status: newStatus }
      );
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }
  }
}

/**
 * 完成內部叫貨單上的物品提供
 * 
 * @param tenantId 租戶ID
 * @param requisitionId 叫貨單ID
 * @param fulfillerId 履行人用戶ID
 * @param fulfillmentDetails 履行詳情
 * @param req Express 請求對象 (用於操作日誌)
 */
export async function fulfillInternalRequisition(
  tenantId: string,
  requisitionId: string,
  fulfillerId: string,
  fulfillmentDetails: {
    items: Array<{
      inventoryItemId: string;
      fulfilledQuantity: number;
      notes?: string;
    }>
  },
  req?: Request
): Promise<void> {
  const db = admin.firestore();
  const requisitionRef = db.collection('internalRequisitions').doc(requisitionId);
  
  // 檢查叫貨單是否存在
  const requisitionDoc = await requisitionRef.get();
  if (!requisitionDoc.exists) {
    throw new Error(`Requisition with ID ${requisitionId} not found`);
  }
  
  // 檢查租戶ID
  const requisitionData = requisitionDoc.data() as Omit<InternalRequisition, 'id'>;
  if (requisitionData.tenantId !== tenantId) {
    throw new Error('Unauthorized access to requisition data');
  }
  
  // 檢查叫貨單狀態是否為已批准
  if (requisitionData.status !== 'approved') {
    throw new Error(`Cannot fulfill requisition in ${requisitionData.status} status`);
  }
  
  // 確保履行項目的有效性
  if (!fulfillmentDetails.items || fulfillmentDetails.items.length === 0) {
    throw new Error('Fulfillment details must include at least one item');
  }
  
  // 驗證所有項目是否存在於原叫貨單中
  const itemMap = new Map<string, RequisitionItem>();
  requisitionData.items.forEach(item => {
    itemMap.set(item.inventoryItemId, item);
  });
  
  fulfillmentDetails.items.forEach(item => {
    if (!itemMap.has(item.inventoryItemId)) {
      throw new Error(`Item ${item.inventoryItemId} is not part of the original requisition`);
    }
    
    if (item.fulfilledQuantity < 0) {
      throw new Error(`Fulfilled quantity cannot be negative for item ${item.inventoryItemId}`);
    }
  });
  
  // 更新叫貨單的履行狀態和項目
  const now = admin.firestore.Timestamp.now();
  const updatedItems = requisitionData.items.map(originalItem => {
    const fulfilledItem = fulfillmentDetails.items.find(item => 
      item.inventoryItemId === originalItem.inventoryItemId
    );
    
    if (fulfilledItem) {
      return {
        ...originalItem,
        fulfilledQuantity: fulfilledItem.fulfilledQuantity,
        fulfillmentNotes: fulfilledItem.notes
      };
    }
    
    return originalItem;
  });
  
  const updateData = {
    status: 'fulfilled',
    fulfilledBy: fulfillerId,
    fulfilledAt: now.toDate(),
    items: updatedItems,
    updatedAt: now.toDate()
  };
  
  // 執行更新
  await requisitionRef.update(updateData);
  
  // 記錄操作日誌
  if (req) {
    try {
      await logInventoryAction(
        req,
        'internal_requisition_fulfill',
        requisitionId,
        `內部叫貨單 ${requisitionData.requestNumber}`,
        AuditLogStatus.SUCCESS,
        '完成內部叫貨單物品提供',
        {
          requestNumber: requisitionData.requestNumber,
          fromLocationId: requisitionData.fromLocationId,
          toLocationId: requisitionData.toLocationId,
          itemCount: fulfillmentDetails.items.length
        },
        { status: requisitionData.status },
        { status: 'fulfilled' }
      );
    } catch (logError) {
      console.error('記錄操作日誌失敗:', logError);
      // 不中斷主流程
    }
  }
} 