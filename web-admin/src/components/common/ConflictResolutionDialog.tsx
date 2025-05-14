/**
 * 衝突解決對話框元件
 * 用於解決資料同步衝突
 */

import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { Modal, Radio, Button, Space, Tabs, Typography, Divider, Alert } from 'antd';
import { SyncOutlined, WarningOutlined } from '@ant-design/icons';
import { hideConflictDialog } from '../../store/slices/appSlice';
import { SyncService, ConflictResolutionStrategy } from '../../services/syncService';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import ReactDiffViewer from 'react-diff-viewer';

const { Text, Title } = Typography;
const { TabPane } = Tabs;

interface ConflictResolutionDialogProps {
  syncService: SyncService;
}

const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({ syncService }) => {
  const dispatch = useDispatch();
  const { showConflictDialog, conflictDialogData } = useSelector(
    (state: RootState) => state.app
  );
  
  const [strategy, setStrategy] = useState<ConflictResolutionStrategy>(
    ConflictResolutionStrategy.SERVER_WINS
  );
  const [clientData, setClientData] = useState<any>(null);
  const [serverData, setServerData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  
  // 當對話框顯示時，獲取客戶端和服務器數據
  useEffect(() => {
    const fetchData = async () => {
      if (!showConflictDialog || !conflictDialogData) return;
      
      setDataLoading(true);
      
      try {
        // 獲取服務器數據
        const firestore = getFirestore();
        const docRef = doc(firestore, conflictDialogData.collection, conflictDialogData.documentId);
        const serverDocSnap = await getDoc(docRef);
        
        if (serverDocSnap.exists()) {
          setServerData(serverDocSnap.data());
        }
        
        // 設置客戶端數據
        if (conflictDialogData.clientData) {
          setClientData(conflictDialogData.clientData);
        }
      } catch (error) {
        console.error('獲取衝突數據失敗:', error);
      } finally {
        setDataLoading(false);
      }
    };
    
    fetchData();
  }, [showConflictDialog, conflictDialogData]);
  
  // 處理策略變更
  const handleStrategyChange = (e: any) => {
    setStrategy(e.target.value);
  };
  
  // 處理解決衝突
  const handleResolveConflict = async () => {
    if (!conflictDialogData) return;
    
    setLoading(true);
    
    try {
      // 調用同步服務解決衝突
      syncService.resolveConflict(conflictDialogData.operationId, strategy);
      
      // 關閉對話框
      dispatch(hideConflictDialog());
    } catch (error) {
      console.error('解決衝突失敗:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 處理取消
  const handleCancel = () => {
    dispatch(hideConflictDialog());
  };
  
  // 格式化數據為JSON字符串
  const formatData = (data: any) => {
    return JSON.stringify(data, null, 2);
  };
  
  // 獲取操作類型的中文描述
  const getOperationTypeText = (operation: string) => {
    switch (operation) {
      case 'create':
        return '創建';
      case 'update':
        return '更新';
      case 'delete':
        return '刪除';
      default:
        return operation;
    }
  };
  
  // 獲取集合的中文名稱
  const getCollectionName = (collection: string) => {
    const collectionNames: Record<string, string> = {
      'orders': '訂單',
      'orderItems': '訂單項目',
      'menuItems': '菜單項目',
      'menuCategories': '菜單分類',
      'inventoryItems': '庫存項目',
      'inventoryCounts': '庫存盤點',
      'inventoryOrders': '叫貨單',
      'employees': '員工',
      'attendanceRecords': '出勤記錄',
      'schedules': '排班',
      'leaves': '請假',
      'stores': '店鋪',
      'users': '用戶',
      'roles': '角色',
      'tenants': '租戶'
    };
    
    return collectionNames[collection] || collection;
  };
  
  if (!showConflictDialog || !conflictDialogData) {
    return null;
  }
  
  return (
    <Modal
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          <span>資料同步衝突</span>
        </Space>
      }
      open={showConflictDialog}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="resolve"
          type="primary"
          loading={loading}
          onClick={handleResolveConflict}
          icon={<SyncOutlined />}
        >
          解決衝突
        </Button>
      ]}
      width={800}
    >
      <Alert
        message="資料同步衝突"
        description={`在同步${getCollectionName(conflictDialogData.collection)}時發生衝突，請選擇如何解決。`}
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <div style={{ marginBottom: 16 }}>
        <Text strong>衝突詳情：</Text>
        <ul>
          <li>
            <Text>集合：{getCollectionName(conflictDialogData.collection)}</Text>
          </li>
          <li>
            <Text>文檔ID：{conflictDialogData.documentId}</Text>
          </li>
          <li>
            <Text>操作類型：{getOperationTypeText(conflictDialogData.operation)}</Text>
          </li>
        </ul>
      </div>
      
      <Divider />
      
      <Title level={5}>請選擇解決方案：</Title>
      
      <Radio.Group onChange={handleStrategyChange} value={strategy} style={{ marginBottom: 16 }}>
        <Space direction="vertical">
          <Radio value={ConflictResolutionStrategy.SERVER_WINS}>
            <Text strong>使用服務器版本</Text>
            <div>
              <Text type="secondary">放棄本地更改，使用服務器上的最新版本。</Text>
            </div>
          </Radio>
          
          <Radio value={ConflictResolutionStrategy.CLIENT_WINS}>
            <Text strong>使用本地版本</Text>
            <div>
              <Text type="secondary">覆蓋服務器版本，使用本地的更改。</Text>
            </div>
          </Radio>
        </Space>
      </Radio.Group>
      
      <Divider />
      
      <Tabs defaultActiveKey="diff">
        <TabPane tab="差異比較" key="diff">
          {dataLoading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <SyncOutlined spin />
              <div>載入數據中...</div>
            </div>
          ) : (
            <ReactDiffViewer
              oldValue={formatData(serverData)}
              newValue={formatData(clientData)}
              splitView={true}
              leftTitle="服務器版本"
              rightTitle="本地版本"
              useDarkTheme={false}
            />
          )}
        </TabPane>
        
        <TabPane tab="服務器版本" key="server">
          {dataLoading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <SyncOutlined spin />
              <div>載入數據中...</div>
            </div>
          ) : (
            <pre style={{ maxHeight: 400, overflow: 'auto' }}>
              {formatData(serverData)}
            </pre>
          )}
        </TabPane>
        
        <TabPane tab="本地版本" key="client">
          {dataLoading ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <SyncOutlined spin />
              <div>載入數據中...</div>
            </div>
          ) : (
            <pre style={{ maxHeight: 400, overflow: 'auto' }}>
              {formatData(clientData)}
            </pre>
          )}
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default ConflictResolutionDialog;
