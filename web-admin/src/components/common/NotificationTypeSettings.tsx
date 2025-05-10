import React from 'react';
import { 
  Typography, 
  FormGroup, 
  FormControlLabel, 
  Switch, 
  Box, 
  Divider 
} from '@mui/material';

interface NotificationTypeSettingsProps {
  orderUpdates: boolean;
  promotions: boolean;
  onChange: (key: 'orderUpdates' | 'promotions', value: boolean) => void;
}

const NotificationTypeSettings: React.FC<NotificationTypeSettingsProps> = ({ 
  orderUpdates, 
  promotions, 
  onChange 
}) => {
  const handleChange = (type: 'orderUpdates' | 'promotions') => 
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(type, event.target.checked);
    };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        通知類型
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        選擇您想接收的通知類型
      </Typography>
      <Divider sx={{ my: 2 }} />
      
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={orderUpdates}
              onChange={handleChange('orderUpdates')}
              color="primary"
            />
          }
          label="訂單更新通知"
        />
        <Typography variant="caption" color="textSecondary" sx={{ ml: 4, mt: -1 }}>
          接收關於您訂單狀態變更的通知
        </Typography>
        
        <Box mt={2} />
        
        <FormControlLabel
          control={
            <Switch
              checked={promotions}
              onChange={handleChange('promotions')}
              color="primary"
            />
          }
          label="促銷與活動通知"
        />
        <Typography variant="caption" color="textSecondary" sx={{ ml: 4, mt: -1 }}>
          接收關於優惠、折扣和新活動的通知
        </Typography>
      </FormGroup>
    </Box>
  );
};

export default NotificationTypeSettings; 