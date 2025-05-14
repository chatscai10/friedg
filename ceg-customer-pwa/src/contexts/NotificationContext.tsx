import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Alert, AlertColor, Box, IconButton, Fade } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export type NotificationSeverity = AlertColor;

interface Notification {
  id: number;
  message: string;
  severity: NotificationSeverity;
  duration?: number; // in milliseconds
}

interface NotificationContextType {
  addNotification: (message: string, severity: NotificationSeverity, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((message: string, severity: NotificationSeverity, duration: number = 5000) => {
    const id = Date.now();
    const newNotification: Notification = { id, message, severity, duration };
    setNotifications(prevNotifications => [...prevNotifications, newNotification]);
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prevNotifications => prevNotifications.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
      {/* Component to render notifications will be separate or placed here */}
      <GlobalNotificationDisplay notifications={notifications} removeNotification={removeNotification} />
    </NotificationContext.Provider>
  );
};

// Separate component to display notifications to keep Provider clean
interface GlobalNotificationDisplayProps {
  notifications: Notification[];
  removeNotification: (id: number) => void;
}

const GlobalNotificationDisplay: React.FC<GlobalNotificationDisplayProps> = ({ notifications, removeNotification }) => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: (theme) => theme.zIndex.snackbar, // Use theme zIndex for consistency
        display: 'flex',
        flexDirection: 'column',
        gap: 1, // theme.spacing(1)
        maxWidth: '350px', // Ensure notifications don't get too wide
      }}
    >
      {notifications.map(notification => (
        <NotificationItem 
          key={notification.id} 
          notification={notification} 
          onClose={() => removeNotification(notification.id)} 
        />
      ))}
    </Box>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (notification.duration) {
      const timer = setTimeout(() => {
        setShow(false); // Start fade out
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification.duration]);

  const handleExited = () => {
    onClose(); // Remove from state after fade out completes
  };

  // Removed getBackgroundColor as MUI Alert handles it via severity

  return (
    <Fade in={show} timeout={300} onExited={handleExited} unmountOnExit>
        <Alert
            severity={notification.severity}
            onClose={onClose} // MUI Alert's built-in close button will call this
            // variant="filled" // Optional: for a more solid background
            sx={{ 
                width: '100%', 
                boxShadow: (theme) => theme.shadows[4], // Add some shadow
            }}
            action={ // Custom close button if needed, or rely on default
                <IconButton
                    aria-label="close"
                    color="inherit"
                    size="small"
                    onClick={onClose}
                >
                    <CloseIcon fontSize="inherit" />
                </IconButton>
            }
        >
            {notification.message}
        </Alert>
    </Fade>
  );
}; 