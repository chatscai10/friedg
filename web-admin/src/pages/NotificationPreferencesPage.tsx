import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Container, 
  CircularProgress, 
  Alert, 
  Snackbar,
  Paper
} from '@mui/material';
import { notificationService } from '../services/notificationService';
import { NotificationPreferences } from '../types/notification.types';
import ChannelSettings from '../components/common/ChannelSettings';
import NotificationTypeSettings from '../components/common/NotificationTypeSettings';
import QuietHoursSettings from '../components/common/QuietHoursSettings';

const NotificationPreferencesPage: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationService.getNotificationPreferences();
      setPreferences(data);
      setHasChanges(false);
    } catch (error) {
      setError('無法獲取通知偏好設置。請稍後再試。');
      console.error('獲取通知偏好設置時出錯:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 處理保存按鈕點擊事件
  const handleSave = async () => {
    if (!preferences) return;
    
    try {
      // 設置保存中狀態
      setIsSaving(true);
      setError(null);
      
      // 準備要提交的數據（排除userId和updatedAt）
      const preferencesToSubmit = {
        channels: preferences.channels,
        orderUpdates: preferences.orderUpdates,
        promotions: preferences.promotions,
        quietHours: preferences.quietHours
      };
      
      // 調用API保存設置
      const result = await notificationService.updateNotificationPreferences(preferencesToSubmit);
      
      // 保存成功
      setSuccessMessage(result.message || '通知偏好設置已成功更新。');
      setHasChanges(false);
      
      // 重新獲取最新的設置
      await fetchPreferences();
    } catch (error) {
      // 保存失敗，顯示錯誤訊息
      setError('保存通知偏好設置時出錯。請稍後再試。');
      console.error('保存通知偏好設置時出錯:', error);
    } finally {
      // 無論成功或失敗，都結束保存狀態
      setIsSaving(false);
    }
  };

  const handleChannelChange = (channels: NotificationPreferences['channels']) => {
    if (preferences) {
      setPreferences({ ...preferences, channels });
      setHasChanges(true);
    }
  };

  const handleTypeChange = (
    key: 'orderUpdates' | 'promotions',
    value: boolean
  ) => {
    if (preferences) {
      setPreferences({ ...preferences, [key]: value });
      setHasChanges(true);
    }
  };

  const handleQuietHoursChange = (
    quietHours: NotificationPreferences['quietHours']
  ) => {
    if (preferences) {
      setPreferences({ ...preferences, quietHours });
      setHasChanges(true);
    }
  };

  const handleCloseSnackbar = () => {
    setSuccessMessage(null);
  };

  if (isLoading) {
    return (
      <Container maxWidth="md">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error && !preferences) {
    return (
      <Container maxWidth="md">
        <Box mt={4}>
          <Alert severity="error">{error}</Alert>
          <Box mt={2} display="flex" justifyContent="center">
            <Button variant="outlined" onClick={fetchPreferences}>
              重試
            </Button>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box mt={4} mb={6}>
        <Typography variant="h4" component="h1" gutterBottom>
          通知偏好設置
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          自定義您希望接收的通知類型和方式。
        </Typography>

        {error && (
          <Box mt={2} mb={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {preferences && (
          <Box mt={4}>
            <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
              <ChannelSettings
                channels={preferences.channels}
                onChange={handleChannelChange}
              />
            </Paper>

            <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
              <NotificationTypeSettings
                orderUpdates={preferences.orderUpdates}
                promotions={preferences.promotions}
                onChange={handleTypeChange}
              />
            </Paper>

            <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
              <QuietHoursSettings
                quietHours={preferences.quietHours}
                onChange={handleQuietHoursChange}
              />
            </Paper>

            <Box
              mt={4}
              display="flex"
              justifyContent="flex-end"
              alignItems="center"
            >
              {isSaving && <CircularProgress size={24} sx={{ mr: 2 }} />}
              <Button
                variant="contained"
                color="primary"
                disabled={!hasChanges || isSaving}
                onClick={handleSave}
              >
                {isSaving ? '保存中...' : '保存設置'}
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <Snackbar
        open={successMessage !== null}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default NotificationPreferencesPage; 