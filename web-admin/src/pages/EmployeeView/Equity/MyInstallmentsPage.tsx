import React from 'react';
import { useQuery } from 'react-query';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress
} from '@mui/material';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import equityService from '../../../services/equityService';
import { InstallmentStatus } from '../../../types/equity.types';

// 計劃數據類型
interface InstallmentPlan {
  planId: string;
  holdingId: string;
  employeeId: string;
  totalAmount: number;
  installments: number;
  installmentAmount: number;
  paidInstallments: number;
  remainingAmount: number;
  nextPaymentDate: { toDate: () => Date };
  startDate: { toDate: () => Date };
  expectedEndDate: { toDate: () => Date };
  status: InstallmentStatus;
}

const MyInstallmentsPage: React.FC = () => {
  // 獲取當前登錄員工的分期付款計劃
  const { data: plans, isLoading, isError, error } = useQuery(
    'myInstallmentPlans',
    equityService.getMyInstallmentPlans
  );
  
  // 根據計劃狀態返回相應的狀態顏色
  const getStatusColor = (status: InstallmentStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'completed':
        return 'info';
      case 'defaulted':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };
  
  // 獲取計劃狀態的顯示標籤
  const getStatusLabel = (status: InstallmentStatus) => {
    switch (status) {
      case 'active':
        return '進行中';
      case 'completed':
        return '已完成';
      case 'defaulted':
        return '已違約';
      case 'cancelled':
        return '已取消';
      default:
        return '未知狀態';
    }
  };
  
  // 計算進度百分比
  const calculateProgress = (plan: InstallmentPlan) => {
    if (plan.installments === 0) return 0;
    return (plan.paidInstallments / plan.installments) * 100;
  };
  
  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h5" gutterBottom>
        我的分期付款計劃
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="textSecondary">
          這裡展示了您當前的股權分期付款計劃詳情，包括付款進度、下次付款日期和剩餘金額等資訊。
        </Typography>
      </Box>
      
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : '載入分期付款計劃時發生錯誤'}
        </Alert>
      ) : plans && plans.length > 0 ? (
        <Paper elevation={2}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>計劃編號</TableCell>
                  <TableCell align="right">總金額</TableCell>
                  <TableCell align="right">每期金額</TableCell>
                  <TableCell align="center">進度</TableCell>
                  <TableCell align="right">已付期數</TableCell>
                  <TableCell align="right">剩餘金額</TableCell>
                  <TableCell>下次付款日</TableCell>
                  <TableCell>狀態</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plans.map((plan: InstallmentPlan) => (
                  <TableRow key={plan.planId}>
                    <TableCell>{plan.planId.substr(0, 8)}...</TableCell>
                    <TableCell align="right">{formatCurrency(plan.totalAmount)}</TableCell>
                    <TableCell align="right">{formatCurrency(plan.installmentAmount)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={calculateProgress(plan)} 
                            color={plan.status === 'active' ? 'primary' : 'secondary'}
                          />
                        </Box>
                        <Box sx={{ minWidth: 35 }}>
                          <Typography variant="body2" color="textSecondary">
                            {Math.round(calculateProgress(plan))}%
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {plan.paidInstallments} / {plan.installments}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(plan.remainingAmount)}</TableCell>
                    <TableCell>
                      {plan.status === 'active' ? 
                        formatDate(plan.nextPaymentDate.toDate()) : 
                        '—'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getStatusLabel(plan.status)}
                        color={getStatusColor(plan.status) as any}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : (
        <Alert severity="info">
          您目前沒有任何分期付款計劃。
        </Alert>
      )}
      
      {plans && plans.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              重要提示
            </Typography>
            <Typography variant="body2">
              分期付款金額會在每月1日從您的薪資中自動扣除。如有任何疑問或需要調整付款計劃，請聯繫人力資源部門。
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default MyInstallmentsPage; 