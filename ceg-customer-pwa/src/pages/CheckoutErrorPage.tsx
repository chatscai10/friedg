import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Typography, Space, Alert, Card } from 'antd';
import { HomeOutlined, ShoppingCartOutlined, RedoOutlined } from '@ant-design/icons';

const CheckoutErrorPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const orderId = queryParams.get('orderId');
  const message = queryParams.get('message') || '支付過程中發生未知錯誤。';
  // const code = queryParams.get('code'); // 可選，用於更詳細的錯誤判斷

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '20px' }}>
      <Card style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
        <Typography.Title level={2} style={{ color: '#ff4d4f' }}>
          支付失敗
        </Typography.Title>
        <Alert
          message="抱歉，您的支付未能成功處理。"
          description={`錯誤訊息: ${message}${orderId ? ` (相關訂單號: ${orderId})` : ''}`}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Typography.Paragraph>
          您可以嘗試返回購物車重新結帳，或返回首頁。
        </Typography.Paragraph>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<ShoppingCartOutlined />}
            onClick={() => navigate('/cart')} // 或者 navigate('/checkout') 如果購物車還在
            block
          >
            返回購物車重試
          </Button>
          <Button
            icon={<RedoOutlined />}
            onClick={() => navigate(orderId ? `/checkout?orderId=${orderId}` : '/checkout')} // 假設可以憑 orderId 重試特定訂單結帳
            block
            danger // 讓用戶知道這可能是重複操作，但提供選項
          >
            嘗試重新結帳
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

export default CheckoutErrorPage; 