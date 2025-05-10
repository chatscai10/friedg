import React from 'react';
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material';
import { Home as HomeIcon, Event as EventIcon } from '@mui/icons-material';
import AttendanceList from '../components/AttendanceManagement/AttendanceList';

const AttendancePage: React.FC = () => {
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              underline="hover"
              color="inherit"
              href="#"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              主頁
            </Link>
            <Typography
              sx={{ display: 'flex', alignItems: 'center' }}
              color="text.primary"
            >
              <EventIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              考勤紀錄
            </Typography>
          </Breadcrumbs>
        </Box>
        
        <AttendanceList />
      </Box>
    </Container>
  );
};

export default AttendancePage; 