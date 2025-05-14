import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './styles/theme';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import OrderStatusPage from './pages/OrderStatusPage';
import OrderProcessingPage from './pages/OrderProcessingPage';
import CheckoutCancelPage from './pages/CheckoutCancelPage';
import CheckoutErrorPage from './pages/CheckoutErrorPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/common/ProtectedRoute';
import CustomerNavigation from './components/layout/CustomerNavigation';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { setupForegroundMessageHandler } from './config/firebase';
import { AlertColor } from '@mui/material';
import PaymentConfirmPage from './pages/PaymentConfirmPage';
import PaymentCancelPage from './pages/PaymentCancelPage';

// Component to handle foreground FCM messages
const ForegroundMessageHandler: React.FC = () => {
  const { addNotification } = useNotification();

  useEffect(() => {
    const showAppNotification = (message: string, severity: AlertColor, title?: string) => {
      const fullMessage = title ? `${title}: ${message}` : message;
      addNotification(fullMessage, severity);
    };
    
    try {
      // setupForegroundMessageHandler 來自 @/config/firebase，它內部會使用 messaging 和 onMessage
      setupForegroundMessageHandler(showAppNotification);
      console.log('Foreground FCM message handler set up via App.tsx.');
    } catch (error) {
      console.error('Error setting up foreground FCM message handler in App.tsx:', error);
    }

    // onMessage 返回一個取消訂閱函數，但 setupForegroundMessageHandler 目前不返回
    // 如果 setupForegroundMessageHandler 將來返回取消訂閱函數，可以在此處調用它
    // return () => { /* cleanup logic if needed */ };
  }, [addNotification]);

  return null; // This component does not render anything
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <CartProvider>
              <ForegroundMessageHandler />
              <CustomerNavigation />

              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/cart" element={<CartPage />} />

                <Route 
                  path="/checkout"
                  element={
                    <ProtectedRoute>
                      <CheckoutPage />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/processing"
                  element={
                    <ProtectedRoute>
                      <OrderProcessingPage />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/checkout/cancel"
                  element={
                    <ProtectedRoute>
                      <CheckoutCancelPage />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/checkout/error"
                  element={
                    <ProtectedRoute>
                      <CheckoutErrorPage />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/order/:orderId/confirmation"
                  element={
                    <ProtectedRoute>
                      <OrderConfirmationPage />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/history"
                  element={
                    <ProtectedRoute>
                      <OrderHistoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/order/:orderId"
                  element={
                    <ProtectedRoute>
                      <OrderStatusPage />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <div>用戶資料 (受保護)</div>
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/payment/linepay/confirm"
                  element={
                    <ProtectedRoute>
                      <PaymentConfirmPage />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/payment/linepay/cancel"
                  element={
                    <ProtectedRoute>
                      <PaymentCancelPage />
                    </ProtectedRoute>
                  }
                />
                
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </CartProvider>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App; 