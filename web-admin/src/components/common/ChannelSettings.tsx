import React from 'react';
import { 
  Typography, 
  FormGroup, 
  FormControlLabel, 
  Switch, 
  Box, 
  Divider 
} from '@mui/material';
import { NotificationPreferences } from '../../types/notification.types';

interface ChannelSettingsProps {
  channels: NotificationPreferences['channels'];
  onChange: (channels: NotificationPreferences['channels']) => void;
}

const ChannelSettings: React.FC<ChannelSettingsProps> = ({ channels, onChange }) => {
  const handleChange = (channelName: keyof NotificationPreferences['channels']) => 
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...channels,
        [channelName]: event.target.checked
      });
    };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        通知渠道
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        選擇您希望接收通知的方式
      </Typography>
      <Divider sx={{ my: 2 }} />
      
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={channels.appPush}
              onChange={handleChange('appPush')}
              color="primary"
            />
          }
          label="應用內推送通知"
        />
        <Typography variant="caption" color="textSecondary" sx={{ ml: 4, mt: -1 }}>
          通過應用推送接收通知
        </Typography>
        
        <Box mt={2} />
        
        <FormControlLabel
          control={
            <Switch
              checked={channels.email}
              onChange={handleChange('email')}
              color="primary"
            />
          }
          label="電子郵件通知"
        />
        <Typography variant="caption" color="textSecondary" sx={{ ml: 4, mt: -1 }}>
          通過電子郵件接收通知
        </Typography>
        
        <Box mt={2} />
        
        <FormControlLabel
          control={
            <Switch
              checked={channels.sms}
              onChange={handleChange('sms')}
              color="primary"
            />
          }
          label="SMS短信通知"
        />
        <Typography variant="caption" color="textSecondary" sx={{ ml: 4, mt: -1 }}>
          通過手機短信接收通知
        </Typography>
      </FormGroup>
    </Box>
  );
};

export default ChannelSettings; 