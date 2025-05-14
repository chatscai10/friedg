/**
 * 股權模塊服務 - 索引文件
 * 導出所有股權相關服務
 */

// 導出股權持有服務
export { 
  getEquityHolders,
  getHolderDetails,
  updateHolderDetails
} from './holding.service';

// 導出股權交易服務
export {
  getEquityTransactions,
  updateEquityRecord,
  validateEquityTransfer
} from './transaction.service';

// 導出股權估值服務
export {
  calculateEquityDistribution,
  getLatestValuation,
  updateEquityValuations
} from './valuation.service';

// 導出股權分紅服務
export {
  calculateDividends,
  distributeDividends,
  getDividendHistory,
  notifyUpcomingVestingEvents,
  archiveOldEquityTransactions
} from './dividend.service';

// 導出股權資格服務
export {
  checkEligibility,
  getEligibleEmployees
} from './eligibility.service';

// 導出股權池服務
export {
  getEquityPool,
  updateEquityPool
} from './pool.service';

// 導出法律配置服務
export {
  getLegalConfig,
  updateLegalConfig
} from './legalConfig.service';

// 導出生成股權報告服務
export const generateEquityReports = async (
  tenantId: string,
  startDate: Date,
  endDate: Date
) => {
  // 實現報告生成邏輯
  return {
    id: `report-${Date.now()}`,
    tenantId,
    period: {
      startDate,
      endDate
    },
    status: 'completed'
  };
};
