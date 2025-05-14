/**
 * 離線狀態指示器元件
 * 顯示當前網絡狀態和同步進度
 */

import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { Badge, Button, Popover, Progress, Space, Typography, Tooltip } from 'antd';
import { 
  WifiOutlined, 
  DisconnectOutlined, 
  SyncOutlined, 
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { SyncService } from '../../services/syncService';
import { OfflineStorageService, SyncStatus } from '../../services/offlineStorage';
import { setPendingOperationsCount } from '../../store/slices/appSlice';

const { Text } = Typography;

interface OfflineIndicatorProps {
  syncService: SyncService;
  offlineStorage: OfflineStorageService;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ syncService, offlineStorage }) => {
  const dispatch = useDispatch();
  const { isOnline, isSyncing, syncProgress, pendingOperationsCount } = useSelector(
    (state: RootState) => state.app
  );
  
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [pendingOperationsByStatus, setPendingOperationsByStatus] = useState<{
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    conflict: number;
  }>({
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
    conflict: 0
  });
  
  // 定期更新待同步操作數量
  useEffect(() => {
    const updatePendingOperations = async () => {
      try {
        // 獲取所有待同步操作
        const pendingOps = await offlineStorage.getPendingOperations();
        dispatch(setPendingOperationsCount(pendingOps.length));
        
        // 按狀態分類
        const byStatus = {
          pending: pendingOps.filter(op => op.status === SyncStatus.PENDING).length,
          inProgress: pendingOps.filter(op => op.status === SyncStatus.IN_PROGRESS).length,
          completed: pendingOps.filter(op => op.status === SyncStatus.COMPLETED).length,
          failed: pendingOps.filter(op => op.status === SyncStatus.FAILED).length,
          conflict: pendingOps.filter(op => op.status === SyncStatus.CONFLICT).length
        };
        
        setPendingOperationsByStatus(byStatus);
      } catch (error) {
        console.error('獲取待同步操作失敗:', error);
      }
    };
    
    // 初始更新
    updatePendingOperations();
    
    // 設置定時更新
    const intervalId = setInterval(updatePendingOperations, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [dispatch, offlineStorage]);
  
  // 手動同步
  const handleManualSync = () => {
    syncService.manualSync();
    setPopoverVisible(false);
  };
  
  // 計算狀態和顏色
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: <DisconnectOutlined />,
        text: '離線',
        color: 'red'
      };
    }
    
    if (isSyncing) {
      return {
        icon: <SyncOutlined spin />,
        text: '同步中',
        color: 'blue'
      };
    }
    
    if (pendingOperationsCount > 0) {
      return {
        icon: <ClockCircleOutlined />,
        text: '待同步',
        color: 'orange'
      };
    }
    
    return {
      icon: <CheckCircleOutlined />,
      text: '已同步',
      color: 'green'
    };
  };
  
  const statusInfo = getStatusInfo();
  
  // 彈出內容
  const popoverContent = (
    <div style={{ width: 250 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text strong>網絡狀態:</Text>
          <Text type={isOnline ? 'success' : 'danger'} style={{ marginLeft: 8 }}>
            {isOnline ? '在線' : '離線'}
          </Text>
        </div>
        
        {isSyncing && (
          <div>
            <Text strong>同步進度:</Text>
            <Progress percent={syncProgress} size="small" />
          </div>
        )}
        
        <div>
          <Text strong>待同步操作:</Text>
          <Text style={{ marginLeft: 8 }}>{pendingOperationsCount}</Text>
        </div>
        
        {pendingOperationsCount > 0 && (
          <div>
            <Space direction="vertical" style={{ width: '100%' }}>
              {pendingOperationsByStatus.pending > 0 && (
                <div>
                  <Badge status="warning" text={`待處理: ${pendingOperationsByStatus.pending}`} />
                </div>
              )}
              {pendingOperationsByStatus.inProgress > 0 && (
                <div>
                  <Badge status="processing" text={`處理中: ${pendingOperationsByStatus.inProgress}`} />
                </div>
              )}
              {pendingOperationsByStatus.failed > 0 && (
                <div>
                  <Badge status="error" text={`失敗: ${pendingOperationsByStatus.failed}`} />
                </div>
              )}
              {pendingOperationsByStatus.conflict > 0 && (
                <div>
                  <Badge status="error" text={`衝突: ${pendingOperationsByStatus.conflict}`} />
                </div>
              )}
            </Space>
          </div>
        )}
        
        {isOnline && pendingOperationsCount > 0 && (
          <Button 
            type="primary" 
            icon={<SyncOutlined />} 
            onClick={handleManualSync}
            loading={isSyncing}
            block
          >
            立即同步
          </Button>
        )}
      </Space>
    </div>
  );
  
  return (
    <Popover
      content={popoverContent}
      title="同步狀態"
      trigger="click"
      open={popoverVisible}
      onOpenChange={setPopoverVisible}
    >
      <Badge count={pendingOperationsCount} overflowCount={99} size="small">
        <Button 
          type="text" 
          icon={statusInfo.icon} 
          style={{ color: statusInfo.color }}
          onClick={() => setPopoverVisible(true)}
        >
          {statusInfo.text}
        </Button>
      </Badge>
    </Popover>
  );
};

export default OfflineIndicator;
