import React from 'react';
import { 
  Typography, 
  FormGroup, 
  FormControlLabel, 
  Switch, 
  Box, 
  Divider,
  Grid 
} from '@mui/material';
import { NotificationPreferences } from '../../types/notification.types';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhTW } from 'date-fns/locale';

interface QuietHoursSettingsProps {
  quietHours: NotificationPreferences['quietHours'];
  onChange: (quietHours: NotificationPreferences['quietHours']) => void;
}

const QuietHoursSettings: React.FC<QuietHoursSettingsProps> = ({ quietHours, onChange }) => {
  const handleEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...quietHours,
      enabled: event.target.checked
    });
  };

  // 將時間字符串轉換為Date對象
  const timeStringToDate = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // 將Date對象轉換為時間字符串 "HH:MM"
  const dateToTimeString = (date: Date | null): string => {
    if (!date) return '00:00';
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleStartTimeChange = (date: Date | null) => {
    if (date) {
      onChange({
        ...quietHours,
        startTime: dateToTimeString(date)
      });
    }
  };

  const handleEndTimeChange = (date: Date | null) => {
    if (date) {
      onChange({
        ...quietHours,
        endTime: dateToTimeString(date)
      });
    }
  };

  // 如果用戶直接輸入時間，處理格式化
  const handleTimeInputChange = (type: 'startTime' | 'endTime') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // 簡單的驗證，應該為 "HH:MM" 格式
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      onChange({
        ...quietHours,
        [type]: value
      });
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        勿擾時段
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        設置您不希望接收通知的時間段
      </Typography>
      <Divider sx={{ my: 2 }} />
      
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={quietHours.enabled}
              onChange={handleEnabledChange}
              color="primary"
            />
          }
          label="啟用勿擾時段"
        />
        
        {quietHours.enabled && (
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TimePicker
                  label="開始時間"
                  value={timeStringToDate(quietHours.startTime)}
                  onChange={handleStartTimeChange}
                  slotProps={{ 
                    textField: { 
                      fullWidth: true,
                      variant: 'outlined',
                      size: 'small',
                      onChange: handleTimeInputChange('startTime')
                    } 
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TimePicker
                  label="結束時間"
                  value={timeStringToDate(quietHours.endTime)}
                  onChange={handleEndTimeChange}
                  slotProps={{ 
                    textField: { 
                      fullWidth: true,
                      variant: 'outlined',
                      size: 'small',
                      onChange: handleTimeInputChange('endTime')
                    } 
                  }}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>
        )}
        
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
          在此時間段內，您將不會收到任何通知，除非是重要的系統通知。
        </Typography>
      </FormGroup>
    </Box>
  );
};

export default QuietHoursSettings; 