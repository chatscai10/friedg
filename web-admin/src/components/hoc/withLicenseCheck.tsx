/**
 * 授權檢查高階元件
 * 用於保護需要特定授權的頁面
 */

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Result, Spin, Button, Space, Typography } from 'antd';
import { LockOutlined, KeyOutlined } from '@ant-design/icons';
import { licenseService, LicenseStatus } from '../../services/licenseService';

const { Text, Link } = Typography;

interface WithLicenseCheckProps {
  requiredFeature?: string;
  requiredLicenseType?: string;
}

/**
 * 授權檢查高階元件
 * @param WrappedComponent 被包裝的元件
 * @param options 選項
 * @returns 包裝後的元件
 */
export const withLicenseCheck = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithLicenseCheckProps = {}
) => {
  // 返回一個新的函數元件
  const WithLicenseCheck: React.FC<P> = (props) => {
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [licenseValid, setLicenseValid] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    
    useEffect(() => {
      const checkLicense = async () => {
        try {
          setLoading(true);
          
          // 檢查授權狀態
          const licenseResult = await licenseService.checkLicense();
          
          // 檢查授權是否有效
          if (!licenseResult.isValid || !licenseResult.license) {
            setLicenseValid(false);
            setErrorMessage(licenseResult.message || '授權無效');
            setHasAccess(false);
            return;
          }
          
          // 檢查授權狀態
          if (licenseResult.license.status !== LicenseStatus.ACTIVE) {
            setLicenseValid(false);
            setErrorMessage(`授權${licenseService.getLicenseStatusName(licenseResult.license.status)}`);
            setHasAccess(false);
            return;
          }
          
          setLicenseValid(true);
          
          // 如果需要特定功能，檢查是否有該功能
          if (options.requiredFeature) {
            const hasFeature = licenseResult.license.features.includes(options.requiredFeature);
            
            if (!hasFeature) {
              setErrorMessage(`此功能需要${licenseService.getFeatureName(options.requiredFeature)}權限`);
              setHasAccess(false);
              return;
            }
          }
          
          // 如果需要特定授權類型，檢查授權類型
          if (options.requiredLicenseType) {
            if (licenseResult.license.type !== options.requiredLicenseType) {
              setErrorMessage(`此功能需要${licenseService.getLicenseTypeName(options.requiredLicenseType as any)}或更高版本`);
              setHasAccess(false);
              return;
            }
          }
          
          // 通過所有檢查
          setHasAccess(true);
        } catch (error) {
          console.error('檢查授權失敗:', error);
          setLicenseValid(false);
          setErrorMessage('檢查授權時發生錯誤');
          setHasAccess(false);
        } finally {
          setLoading(false);
        }
      };
      
      checkLicense();
    }, [options.requiredFeature, options.requiredLicenseType]);
    
    // 如果正在加載，顯示加載中
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 50 }}>
          <Spin tip="檢查授權中..." />
        </div>
      );
    }
    
    // 如果沒有訪問權限，顯示錯誤信息
    if (!hasAccess) {
      return (
        <Result
          status="403"
          title="授權限制"
          subTitle={errorMessage}
          icon={<LockOutlined />}
          extra={
            <Space direction="vertical" align="center">
              {!licenseValid && (
                <Text type="warning">
                  您的授權無效或已過期，請更新授權以繼續使用此功能。
                </Text>
              )}
              
              <Space>
                <Button type="primary" icon={<KeyOutlined />} onClick={() => window.location.href = '/settings/license'}>
                  管理授權
                </Button>
                
                <Button onClick={() => window.history.back()}>
                  返回上一頁
                </Button>
              </Space>
              
              <Text type="secondary">
                如需幫助，請聯繫我們的支援團隊：<Link href="mailto:support@friedg.com">support@friedg.com</Link>
              </Text>
            </Space>
          }
        />
      );
    }
    
    // 如果有訪問權限，渲染原始元件
    return <WrappedComponent {...props} />;
  };
  
  // 設置顯示名稱
  const wrappedComponentName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  WithLicenseCheck.displayName = `withLicenseCheck(${wrappedComponentName})`;
  
  return WithLicenseCheck;
};

export default withLicenseCheck;
