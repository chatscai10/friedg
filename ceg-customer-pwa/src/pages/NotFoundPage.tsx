import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Button, Box, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'; // Or ReportProblemOutlined for a warning look

const NotFoundPage: React.FC = () => {
  return (
    <Container maxWidth="sm" sx={{ py: {xs:4, sm:8}, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: {xs:3, sm:5} }}>
        <ErrorOutlineIcon sx={{ fontSize: 70, color: 'warning.main', mb: 2 }} />
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold'}}>
          404
        </Typography>
        <Typography variant="h5" component="h2" color="text.secondary" paragraph sx={{mb:3}}>
          哎呀！找不到這個頁面。
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph sx={{mb:4}}>
          您想訪問的頁面可能已被移動、刪除，或者根本不存在。
        </Typography>
        <Button 
          component={RouterLink} 
          to="/"
          variant="contained"
          color="primary"
          size="large"
        >
          返回首頁
        </Button>
      </Paper>
    </Container>
  );
};

export default NotFoundPage; 