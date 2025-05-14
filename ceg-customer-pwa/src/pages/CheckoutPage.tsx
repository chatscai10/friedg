import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { submitOrder, OrderPayload } from '@/services/orderService';
import { initiateLinePayPayment, LinePayRequestPayload } from '@/services/paymentService';
import { useNotification } from '@/contexts/NotificationContext';
import { 
    TextField, Button, CircularProgress, Typography, Box, Paper, 
    Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Divider 
} from '@mui/material';

const CheckoutPage: React.FC = () => {
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { user, isAuthenticated, getIdToken } = useAuth();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [customerName, setCustomerName] = useState(user?.displayName || user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phoneNumber || '');
  const [pickupMethod, setPickupMethod] = useState<'self-pickup' | 'delivery'>('self-pickup');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated || !user) {
      addNotification('請先登入再提交訂單。', 'warning');
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }
    if (cartItems.length === 0) {
      addNotification('您的購物車是空的，無法提交訂單。', 'info');
      navigate('/');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    const idToken = await getIdToken();
    if (!idToken) {
        const errMsg = '無法獲取用戶認證，請重新登入後再試。';
        setSubmitError(errMsg);
        addNotification(errMsg, 'error');
        setIsSubmitting(false);
        return;
    }

    const orderPayload: OrderPayload = {
      items: cartItems,
      totalAmount: getCartTotal(),
      pickupMethod,
      paymentMethod,
      customerInfo: {
        name: customerName,
        phone: customerPhone,
      },
    };

    try {
      const orderResponse = await submitOrder(orderPayload, idToken);
      if (orderResponse.success && orderResponse.orderId) {
        const orderId = orderResponse.orderId;
        const totalAmount = orderPayload.totalAmount;
        addNotification(`訂單 (ID: ${orderId.substring(0,6)}) 已成功創建。`, 'success');

        if (paymentMethod === 'linepay') {
          addNotification("正在準備 LINE Pay 支付...", 'info');
          const linePayPayload: LinePayRequestPayload = {
            originalSystemOrderId: orderId,
            amount: totalAmount,
            productName: `訂單 ${orderId.substring(0,8)}`,
            items: cartItems,
            confirmUrl: `${window.location.origin}/payment/linepay/confirm`,
            cancelUrl: `${window.location.origin}/payment/linepay/cancel`,
          };
          const linePayResponse = await initiateLinePayPayment(linePayPayload, idToken);
          if (linePayResponse.success && linePayResponse.paymentUrl && linePayResponse.transactionId) {
            sessionStorage.setItem('linePayOrderId', orderId);
            sessionStorage.setItem('linePayTransactionId', linePayResponse.transactionId);
            addNotification("LINE Pay 準備就緒，將跳轉至支付頁面...", 'success');
            window.location.href = linePayResponse.paymentUrl;
            clearCart();
          } else {
            const errMsg = linePayResponse.message || "啟動 LINE Pay 失敗，請稍後再試或選擇其他支付方式。";
            setSubmitError(errMsg);
            addNotification(errMsg, 'error');
          }
        } else {
          addNotification("訂單已提交，請準備現金支付。", 'success');
          clearCart();
          navigate(`/order/${orderId}/confirmation`);
        }
      } else {
        const errMsg = orderResponse.message || "提交訂單失敗，請稍後再試。";
        setSubmitError(errMsg);
        addNotification(errMsg, 'error');
      }
    } catch (err: any) {
      console.error("Error during checkout process:", err);
      const errMsg = err.message || '結帳過程中發生錯誤，請檢查網路連線或稍後再試。';
      setSubmitError(errMsg);
      addNotification(errMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated && !user) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return <Typography sx={{p:3, textAlign: 'center'}}>請先登入...</Typography>;
  }
  
  if (cartItems.length === 0 && !isSubmitting) {
      return (
          <Paper sx={{p: 3, textAlign: 'center', maxWidth: 400, margin: '20px auto'}} elevation={3}>
              <Typography variant="h6" gutterBottom>購物車是空的</Typography>
              <Button variant="contained" onClick={() => {
                  addNotification('您的購物車目前是空的。', 'info');
                  navigate('/');
              }}>返回首頁選購</Button>
          </Paper>
      )
  }

  return (
    <Paper elevation={3} sx={{ maxWidth: '700px', margin: '20px auto', padding: {xs: 2, sm: 3} }}>
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
        結帳
      </Typography>
      
      <Box component="form" onSubmit={handleFormSubmit} sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>顧客聯絡資訊</Typography>
        <TextField 
          label="姓名"
          type="text" 
          id="customerName" 
          value={customerName} 
          onChange={(e) => setCustomerName(e.target.value)} 
          required 
          fullWidth
          margin="normal"
          variant="outlined"
        />
        <TextField 
          label="手機號碼"
          type="tel" 
          id="customerPhone" 
          value={customerPhone} 
          onChange={(e) => setCustomerPhone(e.target.value)} 
          required 
          fullWidth
          margin="normal"
          variant="outlined"
        />
        
        <Divider sx={{ my: 3 }} />

        <FormControl component="fieldset" margin="normal" fullWidth>
          <FormLabel component="legend">取餐方式</FormLabel>
          <RadioGroup 
            row 
            name="pickupMethod" 
            value={pickupMethod} 
            onChange={(e) => setPickupMethod(e.target.value as 'self-pickup' | 'delivery')}
          >
            <FormControlLabel value="self-pickup" control={<Radio />} label="自取" />
            <FormControlLabel value="delivery" control={<Radio />} label="外送 (暫未開放)" disabled />
          </RadioGroup>
        </FormControl>

        <Divider sx={{ my: 3 }} />

        <FormControl component="fieldset" margin="normal" fullWidth>
          <FormLabel component="legend">支付方式</FormLabel>
          <RadioGroup 
            row 
            name="paymentMethod" 
            value={paymentMethod} 
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <FormControlLabel value="cash" control={<Radio />} label="現金付款" />
            <FormControlLabel value="linepay" control={<Radio />} label="LINE Pay" />
          </RadioGroup>
        </FormControl>
        
        <Divider sx={{ my: 3 }} />

        <Paper variant="outlined" sx={{ p: 2, mt: 2, mb: 3, backgroundColor: 'background.default' }}>
          <Typography variant="h6" gutterBottom>訂單摘要</Typography>
          {cartItems.map(item => {
            const adjustedItemPrice = item.price + (item.selectedOptions?.reduce((acc, opt) => acc + (opt.priceAdjustment || 0), 0) || 0);
            return (
              <Box key={`${item.id}-${JSON.stringify(item.selectedOptions)}`} sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                  <Typography variant="body1">{item.name} x {item.quantity}</Typography>
                  <Typography variant="body1" sx={{fontWeight:'medium'}}>${(adjustedItemPrice * item.quantity).toFixed(2)}</Typography>
                </Box>
                {item.selectedOptions && item.selectedOptions.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1, display: 'block'}}>
                    選項: {item.selectedOptions.map(opt => `${opt.name}${opt.priceAdjustment ? ` (+$${opt.priceAdjustment.toFixed(2)})`:''}`).join(', ')}
                  </Typography>
                )}
              </Box>
            );
          })}
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1}}>
            <Typography variant="subtitle1" sx={{fontWeight: 'bold'}}>總金額:</Typography>
            <Typography variant="subtitle1" sx={{fontWeight: 'bold'}}>${getCartTotal().toFixed(2)}</Typography>
          </Box>
        </Paper>
        
        {submitError && <Typography color="error" textAlign="center" sx={{ my: 2 }}>{submitError}</Typography>}

        <Button 
          type="submit" 
          variant="contained"
          color={paymentMethod === 'linepay' ? 'success' : 'primary'}
          disabled={isSubmitting || cartItems.length === 0}
          fullWidth
          size="large"
          startIcon={isSubmitting ? <CircularProgress size={24} color="inherit" /> : null}
          sx={{ mt: 2, py: 1.5, fontSize: '1.1rem' }}
        >
          {isSubmitting ? '處理中...' : (paymentMethod === 'linepay' ? '前往 LINE Pay 結帳' : '確認訂單 (現金付款)')}
        </Button>
      </Box>
    </Paper>
  );
};

export default CheckoutPage; 