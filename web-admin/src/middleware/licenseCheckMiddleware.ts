/**
 * 授權檢查中間件
 * 用於在前端路由中檢查授權
 */

import { NavigateFunction } from 'react-router-dom';
import { licenseService, LicenseStatus } from '../services/licenseService';
import { showErrorNotification } from '../utils/notification';

// 路由授權配置
export interface RouteAuthConfig {
  requiredFeature?: string;
  requiredLicenseType?: string;
}

// 路由授權配置映射
export const routeAuthConfig: Record<string, RouteAuthConfig> = {
  // 報表相關路由
  '/reports/sales': { requiredFeature: 'basic_reports' },
  '/reports/inventory': { requiredFeature: 'basic_reports' },
  '/reports/employee': { requiredFeature: 'basic_reports' },
  '/reports/customer': { requiredFeature: 'basic_reports' },
  '/reports/advanced': { requiredFeature: 'advanced_reports', requiredLicenseType: 'standard' },
  
  // 庫存相關路由
  '/inventory/items': { requiredFeature: 'basic_inventory' },
  '/inventory/counts': { requiredFeature: 'basic_inventory' },
  '/inventory/orders': { requiredFeature: 'basic_inventory' },
  '/inventory/analysis': { requiredFeature: 'advanced_inventory', requiredLicenseType: 'standard' },
  
  // 員工相關路由
  '/employees/list': { requiredFeature: 'basic_employee' },
  '/employees/attendance': { requiredFeature: 'basic_employee' },
  '/employees/schedule': { requiredFeature: 'basic_employee' },
  '/employees/payroll': { requiredFeature: 'advanced_employee', requiredLicenseType: 'standard' },
  '/employees/performance': { requiredFeature: 'advanced_employee', requiredLicenseType: 'standard' },
  
  // 顧客相關路由
  '/customers/list': { requiredFeature: 'basic_customer' },
  '/customers/loyalty': { requiredFeature: 'basic_customer' },
  '/customers/analysis': { requiredFeature: 'advanced_customer', requiredLicenseType: 'premium' },
  '/customers/campaigns': { requiredFeature: 'advanced_customer', requiredLicenseType: 'premium' },
  
  // 設置相關路由
  '/settings/api': { requiredFeature: 'api_access', requiredLicenseType: 'premium' },
  '/settings/branding': { requiredFeature: 'custom_branding', requiredLicenseType: 'enterprise' },
  
  // 整合相關路由
  '/integrations/line-pay': { requiredFeature: 'line_pay', requiredLicenseType: 'premium' },
  '/integrations/delivery': { requiredFeature: 'delivery_integration', requiredLicenseType: 'premium' }
};

/**
 * 檢查路由授權
 * @param pathname 路由路徑
 * @param navigate 導航函數
 * @returns 是否有權限
 */
export const checkRouteAuth = async (
  pathname: string,
  navigate: NavigateFunction
): Promise<boolean> => {
  try {
    // 檢查是否需要授權
    const config = routeAuthConfig[pathname];
    
    // 如果不需要授權，直接返回true
    if (!config) {
      return true;
    }
    
    // 檢查授權狀態
    const licenseResult = await licenseService.checkLicense();
    
    // 檢查授權是否有效
    if (!licenseResult.isValid || !licenseResult.license) {
      showErrorNotification('授權無效，請更新授權');
      navigate('/settings/license');
      return false;
    }
    
    // 檢查授權狀態
    if (licenseResult.license.status !== LicenseStatus.ACTIVE) {
      showErrorNotification(`授權${licenseService.getLicenseStatusName(licenseResult.license.status)}，請更新授權`);
      navigate('/settings/license');
      return false;
    }
    
    // 如果需要特定功能，檢查是否有該功能
    if (config.requiredFeature) {
      const hasFeature = licenseResult.license.features.includes(config.requiredFeature);
      
      if (!hasFeature) {
        showErrorNotification(`此功能需要${licenseService.getFeatureName(config.requiredFeature)}權限`);
        navigate('/settings/license');
        return false;
      }
    }
    
    // 如果需要特定授權類型，檢查授權類型
    if (config.requiredLicenseType) {
      const licenseTypeOrder = ['trial', 'basic', 'standard', 'premium', 'enterprise'];
      const requiredIndex = licenseTypeOrder.indexOf(config.requiredLicenseType);
      const currentIndex = licenseTypeOrder.indexOf(licenseResult.license.type);
      
      if (currentIndex < requiredIndex) {
        showErrorNotification(`此功能需要${licenseService.getLicenseTypeName(config.requiredLicenseType as any)}或更高版本`);
        navigate('/settings/license');
        return false;
      }
    }
    
    // 通過所有檢查
    return true;
  } catch (error) {
    console.error('檢查路由授權失敗:', error);
    showErrorNotification('檢查授權時發生錯誤');
    return false;
  }
};

/**
 * 授權檢查中間件
 * @param pathname 路由路徑
 * @param navigate 導航函數
 * @param next 下一個中間件
 */
export const licenseCheckMiddleware = async (
  pathname: string,
  navigate: NavigateFunction,
  next: () => void
) => {
  const hasAuth = await checkRouteAuth(pathname, navigate);
  
  if (hasAuth) {
    next();
  }
};
