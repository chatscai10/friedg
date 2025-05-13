import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { SnackbarProvider, useSnackbar, VariantType, SnackbarKey } from 'notistack';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// 定義通知上下文類型
interface NotificationContextType {
  showNotification: (message: string, type?: VariantType) => void;
  showSuccessNotification: (message: string) => void;
  showErrorNotification: (message: string) => void;
  showWarningNotification: (message: string) => void;
  showInfoNotification: (message: string) => void;
}

// 創建通知上下文
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// 通知上下文提供者
const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  
  // 一個用於關閉通知的動作按鈕
  const action = useCallback((key: SnackbarKey) => (
    <IconButton
      size="small"
      aria-label="close"
      color="inherit"
      onClick={() => closeSnackbar(key)}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  ), [closeSnackbar]);

  // 顯示通知的基本方法
  const showNotification = useCallback((message: string, type: VariantType = 'default') => {
    enqueueSnackbar(message, { 
      variant: type,
      action,
      autoHideDuration: 5000
    });
  }, [enqueueSnackbar, action]);

  // 顯示成功通知
  const showSuccessNotification = useCallback((message: string) => {
    showNotification(message, 'success');
  }, [showNotification]);

  // 顯示錯誤通知
  const showErrorNotification = useCallback((message: string) => {
    showNotification(message, 'error');
  }, [showNotification]);

  // 顯示警告通知
  const showWarningNotification = useCallback((message: string) => {
    showNotification(message, 'warning');
  }, [showNotification]);

  // 顯示信息通知
  const showInfoNotification = useCallback((message: string) => {
    showNotification(message, 'info');
  }, [showNotification]);

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        showSuccessNotification,
        showErrorNotification,
        showWarningNotification,
        showInfoNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// 包裹通知提供者的主組件
const NotificationContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <SnackbarProvider 
      maxSnack={3} 
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
    >
      <NotificationProvider>
        {children}
      </NotificationProvider>
    </SnackbarProvider>
  );
};

// 使用通知上下文的自定義鉤子
const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification必須在NotificationProvider內使用');
  }
  return context;
};

export { NotificationContextProvider, useNotification }; 