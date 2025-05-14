import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Typography, Space, Alert, Card } from 'antd';
import { HomeOutlined, ShoppingCartOutlined, HistoryOutlined } from '@ant-design/icons';

const CheckoutCancelPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const paymentSpecificOrderId = queryParams.get('orderId');
  // const reason = queryParams.get('reason'); // 可選

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
      <Card style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
        <Typography.Title level={2} style={{ color: '#faad14' }}>
          支付已取消
        </Typography.Title>
        <Alert
          message="您的支付流程已被取消。"
          description={paymentSpecificOrderId ? `您的支付編號 (Payment ID): ${paymentSpecificOrderId} 已被取消。如果您有任何疑問，請聯繫客服。` : '您的支付流程已被取消。'}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Typography.Paragraph>
          您可以選擇返回購物車繼續購物，或查看您的訂單歷史。
        </Typography.Paragraph>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<ShoppingCartOutlined />}
            onClick={() => navigate('/cart')}
            block
          >
            返回購物車
          </Button>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => navigate('/history')}
            block
          >
            查看訂單歷史
          </Button>
          <Button
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
            block
          >
            返回首頁
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default CheckoutCancelPage; 