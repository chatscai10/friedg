/**
 * 授權管理頁面
 * 顯示授權狀態和激活授權
 */

import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Button, 
  Typography, 
  Space, 
  Divider, 
  Tag, 
  Input, 
  Form, 
  Alert, 
  Spin, 
  Modal, 
  Descriptions, 
  Badge 
} from 'antd';
import { 
  KeyOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  WarningOutlined, 
  LockOutlined, 
  UnlockOutlined 
} from '@ant-design/icons';
import { api } from '../../services/api';
import { showErrorNotification, showSuccessNotification } from '../../utils/notification';

const { Title, Text, Paragraph } = Typography;

// 授權類型
enum LicenseType {
  TRIAL = 'trial',
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

// 授權狀態
enum LicenseStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

// 授權信息
interface License {
  id: string;
  tenantId: string;
  type: LicenseType;
  status: LicenseStatus;
  features: string[];
  maxStores: number;
  maxUsers: number;
  startDate: any;
  endDate: any;
  createdAt: any;
  updatedAt: any;
  licenseKey: string;
  activationCode?: string;
  notes?: string;
}

// 授權檢查結果
interface LicenseCheckResult {
  isValid: boolean;
  license?: License;
  message?: string;
  daysRemaining?: number;
}

/**
 * 授權管理頁面
 */
const LicensePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [licenseResult, setLicenseResult] = useState<LicenseCheckResult | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);
  
  // 獲取授權狀態
  const fetchLicenseStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get<LicenseCheckResult>('/license/check');
      setLicenseResult(response);
    } catch (error) {
      console.error('獲取授權狀態失敗:', error);
      showErrorNotification('獲取授權狀態失敗');
    } finally {
      setLoading(false);
    }
  };
  
  // 激活授權
  const activateLicense = async () => {
    if (!activationCode.trim()) {
      showErrorNotification('請輸入激活碼');
      return;
    }
    
    try {
      setActivating(true);
      const response = await api.post<LicenseCheckResult>('/license/activate', {
        activationCode: activationCode.trim()
      });
      
      setLicenseResult(response);
      showSuccessNotification('授權激活成功');
      setActivationCode('');
    } catch (error) {
      console.error('激活授權失敗:', error);
      showErrorNotification('激活授權失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setActivating(false);
    }
  };
  
  // 初始加載
  useEffect(() => {
    fetchLicenseStatus();
  }, []);
  
  // 獲取授權類型名稱
  const getLicenseTypeName = (type: LicenseType): string => {
    switch (type) {
      case LicenseType.TRIAL:
        return '試用版';
      case LicenseType.BASIC:
        return '基礎版';
      case LicenseType.STANDARD:
        return '標準版';
      case LicenseType.PREMIUM:
        return '高級版';
      case LicenseType.ENTERPRISE:
        return '企業版';
      default:
        return type;
    }
  };
  
  // 獲取授權狀態名稱
  const getLicenseStatusName = (status: LicenseStatus): string => {
    switch (status) {
      case LicenseStatus.ACTIVE:
        return '有效';
      case LicenseStatus.EXPIRED:
        return '已過期';
      case LicenseStatus.SUSPENDED:
        return '已暫停';
      case LicenseStatus.PENDING:
        return '待啟用';
      default:
        return status;
    }
  };
  
  // 獲取授權狀態標籤
  const getLicenseStatusTag = (status: LicenseStatus): JSX.Element => {
    switch (status) {
      case LicenseStatus.ACTIVE:
        return <Tag color="success" icon={<CheckCircleOutlined />}>有效</Tag>;
      case LicenseStatus.EXPIRED:
        return <Tag color="error" icon={<CloseCircleOutlined />}>已過期</Tag>;
      case LicenseStatus.SUSPENDED:
        return <Tag color="warning" icon={<WarningOutlined />}>已暫停</Tag>;
      case LicenseStatus.PENDING:
        return <Tag color="processing" icon={<ClockCircleOutlined />}>待啟用</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };
  
  // 獲取功能名稱
  const getFeatureName = (feature: string): string => {
    const featureNames: Record<string, string> = {
      'basic_pos': '基本POS功能',
      'advanced_pos': '進階POS功能',
      'basic_inventory': '基本庫存管理',
      'advanced_inventory': '進階庫存管理',
      'basic_employee': '基本員工管理',
      'advanced_employee': '進階員工管理',
      'basic_reports': '基本報表',
      'advanced_reports': '進階報表與分析',
      'basic_customer': '基本顧客管理',
      'advanced_customer': '進階顧客關係管理',
      'offline_mode': '離線模式',
      'api_access': 'API存取',
      'line_pay': 'LINE Pay整合',
      'delivery_integration': '外送平台整合',
      'custom_branding': '自訂品牌',
      'priority_support': '優先支援',
      'data_export': '資料匯出',
      'multi_language': '多語言支援'
    };
    
    return featureNames[feature] || feature;
  };
  
  // 渲染授權信息
  const renderLicenseInfo = () => {
    if (!licenseResult || !licenseResult.license) {
      return (
        <Alert
          type="warning"
          message="無法獲取授權信息"
          description="請聯繫系統管理員或使用下方的激活碼激活系統。"
          showIcon
        />
      );
    }
    
    const license = licenseResult.license;
    const isExpired = license.status === LicenseStatus.EXPIRED;
    const isActive = license.status === LicenseStatus.ACTIVE;
    
    return (
      <Card>
        <Descriptions title="授權信息" bordered column={1}>
          <Descriptions.Item label="授權類型">
            <Space>
              {getLicenseTypeName(license.type)}
              {license.type === LicenseType.TRIAL && (
                <Tag color="blue">試用版</Tag>
              )}
            </Space>
          </Descriptions.Item>
          
          <Descriptions.Item label="授權狀態">
            <Space>
              {getLicenseStatusTag(license.status)}
              {isActive && licenseResult.daysRemaining !== undefined && (
                <Text type={licenseResult.daysRemaining <= 7 ? 'warning' : undefined}>
                  剩餘 {licenseResult.daysRemaining} 天
                </Text>
              )}
            </Space>
          </Descriptions.Item>
          
          <Descriptions.Item label="授權密鑰">
            <Text code>{license.licenseKey}</Text>
          </Descriptions.Item>
          
          <Descriptions.Item label="有效期">
            {new Date(license.startDate.seconds * 1000).toLocaleDateString()} 至 {new Date(license.endDate.seconds * 1000).toLocaleDateString()}
          </Descriptions.Item>
          
          <Descriptions.Item label="限制">
            <Space direction="vertical">
              <Text>最大店鋪數: {license.maxStores}</Text>
              <Text>最大用戶數: {license.maxUsers}</Text>
            </Space>
          </Descriptions.Item>
          
          <Descriptions.Item label="功能">
            <Button type="link" onClick={() => setShowFeatures(!showFeatures)}>
              {showFeatures ? '隱藏功能列表' : '顯示功能列表'}
            </Button>
            {showFeatures && (
              <div style={{ marginTop: 8 }}>
                {license.features.map(feature => (
                  <Tag key={feature} style={{ margin: '4px' }}>
                    {getFeatureName(feature)}
                  </Tag>
                ))}
              </div>
            )}
          </Descriptions.Item>
        </Descriptions>
        
        {isExpired && (
          <Alert
            type="error"
            message="授權已過期"
            description="您的授權已過期，請使用激活碼更新授權或聯繫系統管理員。"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
        
        {isActive && licenseResult.daysRemaining !== undefined && licenseResult.daysRemaining <= 7 && (
          <Alert
            type="warning"
            message="授權即將過期"
            description={`您的授權將在 ${licenseResult.daysRemaining} 天後過期，請及時更新授權。`}
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>
    );
  };
  
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card title={
        <Space>
          <KeyOutlined />
          <span>授權管理</span>
        </Space>
      }>
        <Spin spinning={loading}>
          {renderLicenseInfo()}
          
          <Divider />
          
          <Title level={4}>激活授權</Title>
          <Paragraph>
            如果您有激活碼，請在下方輸入以激活或更新您的授權。
          </Paragraph>
          
          <Form layout="vertical">
            <Form.Item label="激活碼">
              <Input.Search
                placeholder="請輸入激活碼，格式如：XXXX-XXXX-XXXX-XXXX"
                value={activationCode}
                onChange={e => setActivationCode(e.target.value)}
                enterButton="激活"
                loading={activating}
                onSearch={activateLicense}
              />
            </Form.Item>
          </Form>
          
          <Paragraph type="secondary">
            如需購買或續約授權，請聯繫我們的銷售團隊：<a href="mailto:sales@friedg.com">sales@friedg.com</a>
          </Paragraph>
        </Spin>
      </Card>
    </div>
  );
};

export default LicensePage;
