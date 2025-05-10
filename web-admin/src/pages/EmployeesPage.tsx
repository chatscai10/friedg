import React from 'react';
import { Box, Container, Breadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';

import EmployeeList from '../components/EmployeeManagement/EmployeeList';

/**
 * 員工管理頁面 - 主路由組件
 * 整合員工列表視圖和面包屑導航
 */
const EmployeesPage: React.FC = () => {
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Breadcrumbs 
          separator={<NavigateNextIcon fontSize="small" />} 
          aria-label="breadcrumb"
          sx={{ mb: 3 }}
        >
          <Link 
            component={RouterLink} 
            to="/" 
            color="inherit"
            underline="hover"
          >
            首頁
          </Link>
          <Typography color="text.primary">員工管理</Typography>
        </Breadcrumbs>
        
        <EmployeeList />
      </Box>
    </Container>
  );
};

export default EmployeesPage; 