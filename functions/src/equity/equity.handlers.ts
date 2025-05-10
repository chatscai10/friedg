/**
 * 動態股權系統 - 處理函數
 * 
 * 包含所有API端點的處理邏輯
 */

import { Request, Response } from 'express';
import legalConfigService from './services/legalConfig.service';
import valuationService from './services/valuation.service';
import poolService from './services/pool.service';
import holdingService from './services/holding.service';
import dividendService from './services/dividend.service';
import { EquityHoldingStatus, EquitySourceType, EquityType } from './equity.types';
import * as admin from 'firebase-admin';

// 擴展Request類型，加入tenantId和userId
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
    }
  }
}

// =========================
// 法律配置相關處理函數
// =========================

/**
 * 獲取指定店鋪的法律配置
 */
export const getLegalConfig = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    // 從請求中獲取租戶ID，如果不存在則使用"default"
    const tenantId = req.tenantId || req.query.tenantId as string || "default";

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: storeId'
      });
    }

    const config = await legalConfigService.getLegalConfig(storeId, tenantId);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: `店鋪 ${storeId} 的法律配置不存在`
      });
    }

    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('獲取法律配置時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '獲取法律配置時發生錯誤'
    });
  }
};

/**
 * 更新指定店鋪的法律配置
 */
export const updateLegalConfig = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    // 從請求中獲取租戶ID和用戶ID
    const tenantId = req.tenantId || req.query.tenantId as string || "default";
    const userId = req.userId || req.query.userId as string || "system";
    const configData = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: storeId'
      });
    }

    // 設置更新人
    configData.updatedBy = userId;

    const updatedConfig = await legalConfigService.updateLegalConfig(storeId, tenantId, configData);

    return res.status(200).json({
      success: true,
      data: updatedConfig
    });
  } catch (error) {
    console.error('更新法律配置時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '更新法律配置時發生錯誤'
    });
  }
};

// =========================
// 股價估值相關處理函數
// =========================

/**
 * 創建新的股價估值記錄
 */
export const createValuation = async (req: Request, res: Response) => {
  try {
    const { storeId, effectiveDate, sharePrice, averageNetProfit, monthsInCalculation, multiplier, totalCompanyValue, valuationNotes } = req.body;
    // 從請求中獲取租戶ID和用戶ID
    const tenantId = req.tenantId || req.query.tenantId as string || "default";
    const userId = req.userId || req.query.userId as string || "system";

    if (!storeId || !sharePrice || !averageNetProfit || !multiplier) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: storeId, sharePrice, averageNetProfit, multiplier'
      });
    }

    const valuation = await valuationService.createValuation({
      storeId,
      tenantId,
      effectiveDate: effectiveDate ? admin.firestore.Timestamp.fromDate(new Date(effectiveDate)) : admin.firestore.Timestamp.now(),
      sharePrice,
      priceChangePercentage: 0, // 會在服務中自動計算
      averageNetProfit,
      monthsInCalculation: monthsInCalculation || 12,
      multiplier,
      valuationNotes,
      totalCompanyValue: totalCompanyValue || (sharePrice * 100),
      approvedBy: userId
    });

    return res.status(201).json({
      success: true,
      data: valuation
    });
  } catch (error) {
    console.error('創建股價估值時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '創建股價估值時發生錯誤'
    });
  }
};

/**
 * 查詢估值歷史
 */
export const getValuations = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    // 從請求中獲取租戶ID
    const tenantId = req.tenantId || req.query.tenantId as string || "default";
    const limit = Number(req.query.limit) || 10;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: storeId'
      });
    }

    const valuations = await valuationService.getValuationHistory(storeId as string, tenantId, limit);

    return res.status(200).json({
      success: true,
      data: valuations
    });
  } catch (error) {
    console.error('查詢估值歷史時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '查詢估值歷史時發生錯誤'
    });
  }
};

// =========================
// 股權池相關處理函數
// =========================

/**
 * 初始化店鋪股權池
 */
export const initializeEquityPool = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { totalShares, poolShares, equityType } = req.body;
    // 從請求中獲取租戶ID
    const tenantId = req.tenantId || req.query.tenantId as string || "default";

    if (!storeId || !totalShares || !poolShares || !equityType) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: totalShares, poolShares, equityType'
      });
    }

    // 檢查股權池是否已存在
    const existingPool = await poolService.getPool(storeId, tenantId);
    if (existingPool) {
      return res.status(409).json({
        success: false,
        message: `店鋪 ${storeId} 的股權池已存在`
      });
    }

    const pool = await poolService.initializePool(storeId, tenantId, {
      totalShares: Number(totalShares),
      poolShares: Number(poolShares),
      equityType: equityType as EquityType
    });

    return res.status(201).json({
      success: true,
      data: pool
    });
  } catch (error) {
    console.error('初始化股權池時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '初始化股權池時發生錯誤'
    });
  }
};

/**
 * 獲取店鋪股權池狀態
 */
export const getEquityPool = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    // 從請求中獲取租戶ID
    const tenantId = req.tenantId || req.query.tenantId as string || "default";

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: storeId'
      });
    }

    const pool = await poolService.getPool(storeId, tenantId);
    
    if (!pool) {
      return res.status(404).json({
        success: false,
        message: `店鋪 ${storeId} 的股權池不存在`
      });
    }

    return res.status(200).json({
      success: true,
      data: pool
    });
  } catch (error) {
    console.error('獲取股權池狀態時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '獲取股權池狀態時發生錯誤'
    });
  }
};

/**
 * 更新店鋪股權池設定
 */
export const updateEquityPool = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    // 從請求中獲取租戶ID
    const tenantId = req.tenantId || req.query.tenantId as string || "default";
    const updateData = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: storeId'
      });
    }

    const pool = await poolService.updatePool(storeId, tenantId, updateData);

    return res.status(200).json({
      success: true,
      data: pool
    });
  } catch (error) {
    console.error('更新股權池設定時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '更新股權池設定時發生錯誤'
    });
  }
};

// =========================
// 持股相關處理函數
// =========================

/**
 * 創建員工持股記錄 (績效授予或認購)
 */
export const createHolding = async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      storeId,
      equityType,
      shares,
      purchasePrice,
      sourceType,
      installmentPlanId
    } = req.body;
    // 從請求中獲取租戶ID
    const tenantId = req.tenantId || req.query.tenantId as string || "default";

    if (!employeeId || !storeId || !equityType || !shares || !sourceType) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: employeeId, storeId, equityType, shares, sourceType'
      });
    }

    // 如果是現金認購，必須提供認購價格
    if (sourceType === EquitySourceType.PURCHASE && !purchasePrice) {
      return res.status(400).json({
        success: false,
        message: '現金認購必須提供認購價格 (purchasePrice)'
      });
    }

    // 獲取當前日期和鎖定期結束日期
    const now = new Date();
    const vestingEndDate = new Date();
    
    // 簡單設置6個月鎖定期，實際應從LegalConfig讀取
    vestingEndDate.setMonth(vestingEndDate.getMonth() + 6);
    
    const totalInvestment = purchasePrice ? purchasePrice * shares : undefined;

    // 確保Timestamp是正確的Firestore Timestamp
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
    const vestingEndTimestamp = admin.firestore.Timestamp.fromDate(vestingEndDate);

    const holding = await holdingService.createHolding({
      employeeId,
      storeId,
      tenantId,
      equityType: equityType as EquityType,
      shares: Number(shares),
      acquiredDate: nowTimestamp,
      sourceType: sourceType as EquitySourceType,
      purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
      totalInvestment,
      vestingStartDate: nowTimestamp,
      vestingEndDate: vestingEndTimestamp,
      lastValuationDate: nowTimestamp,
      installmentPlanId,
      status: EquityHoldingStatus.VESTING
    });

    return res.status(201).json({
      success: true,
      data: holding
    });
  } catch (error) {
    console.error('創建持股記錄時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '創建持股記錄時發生錯誤'
    });
  }
};

/**
 * 查詢持股記錄 (可按員工ID或店鋪ID過濾)
 */
export const getHoldings = async (req: Request, res: Response) => {
  try {
    const { employeeId, storeId } = req.query;

    if (!employeeId && !storeId) {
      return res.status(400).json({
        success: false,
        message: '必須提供過濾條件: employeeId 或 storeId'
      });
    }

    let holdings;
    
    if (employeeId) {
      // 查詢特定員工的持股記錄
      holdings = await holdingService.getEmployeeHoldings(employeeId as string, storeId as string | undefined);
    } else {
      // 查詢店鋪所有員工的持股記錄
      holdings = await holdingService.getStoreHoldings(storeId as string);
    }

    return res.status(200).json({
      success: true,
      data: holdings
    });
  } catch (error) {
    console.error('查詢持股記錄時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '查詢持股記錄時發生錯誤'
    });
  }
};

/**
 * 更新持股狀態 (如激活、歸屬等)
 */
export const updateHoldingStatus = async (req: Request, res: Response) => {
  try {
    const { holdingId } = req.params;
    const { status, vestingPercentage } = req.body;

    if (!holdingId || !status) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: holdingId, status'
      });
    }

    // 擴展：如果需要更新其他字段，可以在這裡添加
    const updateData: any = {};
    if (vestingPercentage !== undefined) {
      updateData.vestingPercentage = Number(vestingPercentage);
    }

    const holding = await holdingService.updateHoldingStatus(
      holdingId,
      status as EquityHoldingStatus,
      updateData
    );

    return res.status(200).json({
      success: true,
      data: holding
    });
  } catch (error) {
    console.error('更新持股狀態時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '更新持股狀態時發生錯誤'
    });
  }
};

/**
 * 獲取當前登錄員工的持股記錄
 */
export const getMyHoldings = async (req: Request, res: Response) => {
  try {
    // 從請求中獲取當前登錄用戶的ID
    const employeeId = req.userId;
    const tenantId = req.tenantId || req.query.tenantId as string || "default";

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: '未授權：需要用戶認證'
      });
    }

    // 查詢特定員工的持股記錄
    const holdings = await holdingService.getEmployeeHoldings(employeeId);

    return res.status(200).json({
      success: true,
      data: holdings
    });
  } catch (error) {
    console.error('查詢個人持股記錄時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '查詢個人持股記錄時發生錯誤'
    });
  }
};

/**
 * 獲取當前登錄員工的分期付款計劃
 */
export const getMyInstallmentPlans = async (req: Request, res: Response) => {
  try {
    // 從請求中獲取當前登錄用戶的ID
    const employeeId = req.userId;
    const tenantId = req.tenantId || req.query.tenantId as string || "default";

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: '未授權：需要用戶認證'
      });
    }

    // 獲取員工的所有持股記錄
    const holdings = await holdingService.getEmployeeHoldings(employeeId);
    
    // 提取所有持股記錄中包含的installmentPlanId
    const installmentPlanIds = holdings
      .filter(holding => holding.installmentPlanId)
      .map(holding => holding.installmentPlanId as string);
    
    if (installmentPlanIds.length === 0) {
      // 沒有分期付款計劃
      return res.status(200).json({
        success: true,
        data: []
      });
    }
    
    // 查詢所有分期付款計劃
    const plans = await Promise.all(
      installmentPlanIds.map(async (planId) => {
        // 獲取分期付款計劃的詳細資訊
        // 這裡假設有一個installmentService來處理這個操作
        // 如果沒有，則需要創建一個基本的數據獲取邏輯
        try {
          const planRef = admin.firestore().collection('equity_installment_plans').doc(planId);
          const planDoc = await planRef.get();
          if (planDoc.exists) {
            return { planId, ...planDoc.data() };
          }
          return null;
        } catch (err) {
          console.error(`獲取分期計劃 ${planId} 時出錯:`, err);
          return null;
        }
      })
    );
    
    // 過濾掉無效的計劃
    const validPlans = plans.filter(plan => plan !== null);

    return res.status(200).json({
      success: true,
      data: validPlans
    });
  } catch (error) {
    console.error('查詢個人分期付款計劃時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '查詢個人分期付款計劃時發生錯誤'
    });
  }
};

// =========================
// 分紅相關處理函數
// =========================

/**
 * 創建分紅週期記錄
 */
export const createDividendCycle = async (req: Request, res: Response) => {
  try {
    const { storeId, year, quarter, totalNetProfit, previousDeficit } = req.body;
    // 從請求中獲取租戶ID
    const tenantId = req.tenantId || req.query.tenantId as string || "default";

    if (!storeId || !year || !quarter || totalNetProfit === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: storeId, year, quarter, totalNetProfit'
      });
    }

    const cycle = await dividendService.createDividendCycle(
      storeId,
      tenantId,
      Number(year),
      Number(quarter),
      Number(totalNetProfit),
      previousDeficit ? Number(previousDeficit) : 0
    );

    return res.status(201).json({
      success: true,
      data: cycle
    });
  } catch (error) {
    console.error('創建分紅週期時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '創建分紅週期時發生錯誤'
    });
  }
};

/**
 * 獲取分紅週期列表 (可按店鋪ID過濾)
 */
export const getDividendCycles = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;
    
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: storeId'
      });
    }

    const limit = Number(req.query.limit) || 10;
    const cycles = await dividendService.getStoreDividendCycles(storeId as string, limit);

    return res.status(200).json({
      success: true,
      data: cycles
    });
  } catch (error) {
    console.error('獲取分紅週期列表時發生錯誤:', error);
    return res.status(500).json({
      success: false,
      message: '獲取分紅週期列表時發生錯誤'
    });
  }
}; 