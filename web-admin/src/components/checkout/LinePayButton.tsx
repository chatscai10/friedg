import React, { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import { requestLinePayPayment } from '../../services/paymentService';

interface LinePayButtonProps {
  orderId: string;
  buttonText?: string;
  disabled?: boolean;
  variant?: 'text' | 'outlined' | 'contained';
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
}

/**
 * LINE Pay 付款按鈕組件
 * 
 * 用於觸發 LINE Pay 支付流程
 */
const LinePayButton: React.FC<LinePayButtonProps> = ({
  orderId,
  buttonText = '使用 LINE Pay 付款',
  disabled = false,
  variant = 'contained',
  fullWidth = false,
  size = 'medium'
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 處理支付按鈕點擊
   */
  const handlePaymentClick = async () => {
    if (!orderId) {
      setError('訂單ID無效，無法處理支付');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 呼叫支付服務
      const result = await requestLinePayPayment(orderId);
      
      if (result.success && result.paymentUrl) {
        // 跳轉到 LINE Pay 支付頁面
        window.location.href = result.paymentUrl;
      } else {
        // 處理錯誤
        setError(result.error || '無法獲取支付連結');
      }
    } catch (error) {
      console.error('處理 LINE Pay 支付時發生錯誤:', error);
      setError('處理支付請求時發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 關閉錯誤提示
   */
  const handleCloseError = () => {
    setError(null);
  };
  
  return (
    <>
      <Button
        variant={variant}
        color="primary"
        disabled={disabled || loading}
        onClick={handlePaymentClick}
        fullWidth={fullWidth}
        size={size}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
      >
        {loading ? '處理中...' : buttonText}
      </Button>
      
      {/* 錯誤提示 */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" variant="filled">
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};

export default LinePayButton; 