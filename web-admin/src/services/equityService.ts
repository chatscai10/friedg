/**
 * 動態股權系統 (Dynamic Equity Framework) 服務
 * 
 * 此文件提供與動態股權系統後端交互的服務函式。
 */

import api from './api';
import {
  LegalConfig,
  LegalConfigResponse,
  UpdateLegalConfigRequest,
  ValuationFilters,
  ValuationsResponse,
  SharePriceLog,
  ValuationResponse,
  StoreEquityPool,
  PoolResponse,
  UpdatePoolRequest,
  HoldingFilters,
  HoldingsResponse,
  EmployeeEquityHolding,
  HoldingResponse,
  EquityHoldingStatus,
  UpdateHoldingStatusRequest,
  DividendCycleFilters,
  DividendCyclesResponse,
  DividendCycle,
  DividendCycleResponse,
  TradeWindowFilters,
  TradeWindowsResponse,
  InternalTradeWindow,
  TradeWindowResponse
} from '../types/equity.types';

const BASE_URL = '/api/equity';

/**
 * 獲取法律配置
 * @param storeId 店鋪ID
 * @returns Promise<LegalConfig>
 */
export const getLegalConfig = async (storeId: string): Promise<LegalConfig> => {
  const response = await api.get<LegalConfigResponse>(`${BASE_URL}/legal-config/${storeId}`);
  return response.data.config;
};

/**
 * 更新法律配置
 * @param storeId 店鋪ID
 * @param data 更新資料
 * @returns Promise<LegalConfig>
 */
export const updateLegalConfig = async (
  storeId: string, 
  data: UpdateLegalConfigRequest
): Promise<LegalConfig> => {
  const response = await api.put<LegalConfigResponse>(`${BASE_URL}/legal-config/${storeId}`, data);
  return response.data.config;
};

/**
 * 獲取估值歷史記錄
 * @param filters 過濾條件
 * @returns Promise<ValuationsResponse>
 */
export const getValuations = async (filters: ValuationFilters): Promise<ValuationsResponse> => {
  const { storeId, startDate, endDate, limit, cursor } = filters;
  const queryParams = new URLSearchParams();
  
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (limit) queryParams.append('limit', limit.toString());
  if (cursor) queryParams.append('cursor', cursor);
  
  const url = `${BASE_URL}/valuations/${storeId}?${queryParams.toString()}`;
  const response = await api.get<ValuationsResponse>(url);
  return response.data;
};

/**
 * 創建估值記錄
 * @param storeId 店鋪ID
 * @param data 估值資料
 * @returns Promise<SharePriceLog>
 */
export const createValuation = async (
  storeId: string,
  data: {
    effectiveDate: string;
    sharePrice: number;
    averageNetProfit: number;
    monthsInCalculation: number;
    multiplier: number;
    valuationNotes?: string;
    totalCompanyValue: number;
  }
): Promise<SharePriceLog> => {
  const response = await api.post<ValuationResponse>(`${BASE_URL}/valuations/${storeId}`, data);
  return response.data.valuation;
};

/**
 * 獲取店鋪股權池資訊
 * @param storeId 店鋪ID
 * @returns Promise<StoreEquityPool>
 */
export const getEquityPool = async (storeId: string): Promise<StoreEquityPool> => {
  const response = await api.get<PoolResponse>(`${BASE_URL}/pools/${storeId}`);
  return response.data.pool;
};

/**
 * 初始化股權池
 * @param storeId 店鋪ID
 * @param data 初始化數據
 * @returns 初始化後的股權池數據
 */
export const initializePool = async (storeId: string, data: {
  totalShares: number;
  poolShares: number;
  initialSharePrice: number;
  equityType: string;
}): Promise<StoreEquityPool> => {
  const response = await api.post<{success: boolean, data: StoreEquityPool}>(
    `${BASE_URL}/pools/${storeId}/initialize`,
    data
  );
  return response.data.data;
};

/**
 * 更新店鋪股權池設定
 * @param storeId 店鋪ID
 * @param data 更新資料
 * @returns Promise<StoreEquityPool>
 */
export const updateEquityPool = async (
  storeId: string,
  data: UpdatePoolRequest
): Promise<StoreEquityPool> => {
  const response = await api.put<PoolResponse>(`${BASE_URL}/pools/${storeId}`, data);
  return response.data.pool;
};

/**
 * 獲取持股記錄列表
 * @param filters 過濾條件
 * @returns Promise<HoldingsResponse>
 */
export const getHoldings = async (filters: HoldingFilters): Promise<HoldingsResponse> => {
  const { storeId, employeeId, status, limit, cursor } = filters;
  const queryParams = new URLSearchParams();
  
  if (storeId) queryParams.append('storeId', storeId);
  if (employeeId) queryParams.append('employeeId', employeeId);
  if (status) queryParams.append('status', status);
  if (limit) queryParams.append('limit', limit.toString());
  if (cursor) queryParams.append('cursor', cursor);
  
  const url = `${BASE_URL}/holdings?${queryParams.toString()}`;
  const response = await api.get<HoldingsResponse>(url);
  return response.data;
};

/**
 * 獲取單個持股記錄
 * @param holdingId 持股記錄ID
 * @returns Promise<EmployeeEquityHolding>
 */
export const getHolding = async (holdingId: string): Promise<EmployeeEquityHolding> => {
  const response = await api.get<HoldingResponse>(`${BASE_URL}/holdings/${holdingId}`);
  return response.data.holding;
};

/**
 * 創建持股記錄
 * @param data 持股記錄數據
 * @returns 創建的持股記錄
 */
export const createHolding = async (data: any): Promise<EmployeeEquityHolding> => {
  const response = await api.post<{success: boolean, data: EmployeeEquityHolding}>(
    `${BASE_URL}/holdings`,
    data
  );
  return response.data.data;
};

/**
 * 更新持股記錄狀態
 * @param holdingId 持股記錄ID
 * @param data 狀態更新資料
 * @returns Promise<EmployeeEquityHolding>
 */
export const updateHoldingStatus = async (
  holdingId: string,
  data: UpdateHoldingStatusRequest
): Promise<EmployeeEquityHolding> => {
  const response = await api.put<HoldingResponse>(`${BASE_URL}/holdings/${holdingId}/status`, data);
  return response.data.holding;
};

/**
 * 獲取分紅週期列表
 * @param filters 過濾條件
 * @returns Promise<DividendCyclesResponse>
 */
export const getDividendCycles = async (filters: DividendCycleFilters): Promise<DividendCyclesResponse> => {
  const { storeId, year, quarter, status, limit, cursor } = filters;
  const queryParams = new URLSearchParams();
  
  if (storeId) queryParams.append('storeId', storeId);
  if (year) queryParams.append('year', year.toString());
  if (quarter) queryParams.append('quarter', quarter.toString());
  if (status) queryParams.append('status', status);
  if (limit) queryParams.append('limit', limit.toString());
  if (cursor) queryParams.append('cursor', cursor);
  
  const url = `${BASE_URL}/dividend-cycles?${queryParams.toString()}`;
  const response = await api.get<DividendCyclesResponse>(url);
  return response.data;
};

/**
 * 獲取單個分紅週期
 * @param cycleId 週期ID
 * @returns Promise<DividendCycle>
 */
export const getDividendCycle = async (cycleId: string): Promise<DividendCycle> => {
  const response = await api.get<DividendCycleResponse>(`${BASE_URL}/dividend-cycles/${cycleId}`);
  return response.data.cycle;
};

/**
 * 創建分紅週期
 * @param data 分紅週期數據
 * @returns 創建的分紅週期
 */
export const createDividendCycle = async (data: {
  storeId: string;
  year: number;
  quarter: number;
  totalNetProfit: number;
  previousDeficit?: number;
  startDate: Date | null;
  endDate: Date | null;
}): Promise<DividendCycle> => {
  // 格式化日期
  const formattedData = {
    ...data,
    startDate: data.startDate ? data.startDate.toISOString().split('T')[0] : undefined,
    endDate: data.endDate ? data.endDate.toISOString().split('T')[0] : undefined
  };

  const response = await api.post<{success: boolean, data: DividendCycle}>(
    `${BASE_URL}/dividend-cycles`,
    formattedData
  );
  return response.data.data;
};

/**
 * 計算分紅
 * @param cycleId 分紅週期ID
 * @returns 計算後的分紅週期
 */
export const calculateDividend = async (cycleId: string): Promise<DividendCycle> => {
  const response = await api.post<{success: boolean, data: DividendCycle}>(
    `${BASE_URL}/dividend-cycles/${cycleId}/calculate`
  );
  return response.data.data;
};

/**
 * 審批分紅
 * @param cycleId 分紅週期ID
 * @returns 審批後的分紅週期
 */
export const approveDividend = async (cycleId: string): Promise<DividendCycle> => {
  const response = await api.post<{success: boolean, data: DividendCycle}>(
    `${BASE_URL}/dividend-cycles/${cycleId}/approve`
  );
  return response.data.data;
};

/**
 * 分配分紅
 * @param cycleId 分紅週期ID
 * @returns 分配後的分紅週期
 */
export const distributeDividend = async (cycleId: string): Promise<DividendCycle> => {
  const response = await api.post<{success: boolean, data: DividendCycle}>(
    `${BASE_URL}/dividend-cycles/${cycleId}/distribute`
  );
  return response.data.data;
};

/**
 * 獲取交易窗口列表
 * @param filters 過濾條件
 * @returns Promise<TradeWindowsResponse>
 */
export const getTradeWindows = async (filters: TradeWindowFilters): Promise<TradeWindowsResponse> => {
  const { storeId, year, quarter, status, limit, cursor } = filters;
  const queryParams = new URLSearchParams();
  
  if (storeId) queryParams.append('storeId', storeId);
  if (year) queryParams.append('year', year.toString());
  if (quarter) queryParams.append('quarter', quarter.toString());
  if (status) queryParams.append('status', status);
  if (limit) queryParams.append('limit', limit.toString());
  if (cursor) queryParams.append('cursor', cursor);
  
  const url = `${BASE_URL}/trade-windows?${queryParams.toString()}`;
  const response = await api.get<TradeWindowsResponse>(url);
  return response.data;
};

/**
 * 獲取單個交易窗口
 * @param windowId 窗口ID
 * @returns Promise<InternalTradeWindow>
 */
export const getTradeWindow = async (windowId: string): Promise<InternalTradeWindow> => {
  const response = await api.get<TradeWindowResponse>(`${BASE_URL}/trade-windows/${windowId}`);
  return response.data.window;
};

/**
 * 創建交易窗口
 * @param data 交易窗口數據
 * @returns 創建的交易窗口
 */
export const createTradeWindow = async (data: {
  storeId: string;
  year: number;
  quarter: number;
  openDate: Date | null;
  closeDate: Date | null;
}): Promise<InternalTradeWindow> => {
  // 格式化日期
  const formattedData = {
    ...data,
    openDate: data.openDate ? data.openDate.toISOString().split('T')[0] : undefined,
    closeDate: data.closeDate ? data.closeDate.toISOString().split('T')[0] : undefined,
    // 默認值設定
    referenceSharePrice: 0, // 後端會基於當前估值計算
    minPrice: 0, // 後端會基於參考價格計算
    maxPrice: 0, // 後端會基於參考價格計算
    platformFeePercentage: 2.5 // 默認平台服務費
  };

  const response = await api.post<{success: boolean, data: InternalTradeWindow}>(
    `${BASE_URL}/trade-windows`,
    formattedData
  );
  return response.data.data;
};

/**
 * 切換交易窗口狀態（開啟/關閉）
 * @param windowId 交易窗口ID
 * @param action 操作類型 ('open' | 'close')
 * @returns 更新後的交易窗口
 */
export const toggleTradeWindow = async (windowId: string, action: 'open' | 'close'): Promise<InternalTradeWindow> => {
  const response = await api.post<{success: boolean, data: InternalTradeWindow}>(
    `${BASE_URL}/trade-windows/${windowId}/${action}`
  );
  return response.data.data;
};

/**
 * 獲取當前登錄員工的持股記錄
 * @returns Promise<EmployeeEquityHolding[]>
 */
export const getMyHoldings = async (): Promise<EmployeeEquityHolding[]> => {
  const response = await api.get<{success: boolean, data: EmployeeEquityHolding[]}>(`${BASE_URL}/employees/me/equity-holdings`);
  return response.data.data;
};

/**
 * 獲取當前登錄員工的分期付款計劃
 * @returns Promise<any[]>
 */
export const getMyInstallmentPlans = async (): Promise<any[]> => {
  const response = await api.get<{success: boolean, data: any[]}>(`${BASE_URL}/employees/me/installment-plans`);
  return response.data.data;
};

// 導出所有函式
const equityService = {
  getLegalConfig,
  updateLegalConfig,
  getValuations,
  createValuation,
  getEquityPool,
  initializePool,
  updateEquityPool,
  getHoldings,
  getHolding,
  createHolding,
  updateHoldingStatus,
  getDividendCycles,
  getDividendCycle,
  createDividendCycle,
  calculateDividend,
  approveDividend,
  distributeDividend,
  getTradeWindows,
  getTradeWindow,
  createTradeWindow,
  toggleTradeWindow,
  getMyHoldings,
  getMyInstallmentPlans
};

export default equityService; 