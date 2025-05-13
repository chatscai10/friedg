import React from 'react';
import { useQuery } from 'react-query';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import equityService from '../../../services/equityService';
import { EmployeeEquityHolding, EquityHoldingStatus, EquitySourceType } from '../../../types/equity.types';

const MyHoldingsPage: React.FC = () => {
  // 獲取當前登錄員工的持股數據
  const { data: holdings, isLoading, isError, error } = useQuery(
    'myEquityHoldings',
    equityService.getMyHoldings
  );
  
  // 根據股權狀態返回相應的狀態顏色
  const getStatusColor = (status: EquityHoldingStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'vesting':
        return 'info';
      case 'locked':
        return 'warning';
      case 'inactive':
        return 'error';
      default:
        return 'default';
    }
  };
  
  // 根據股權來源返回相應的來源類型顯示名稱
  const getSourceTypeLabel = (sourceType: EquitySourceType) => {
    switch (sourceType) {
      case 'performance':
        return '績效獎勵';
      case 'purchase':
        return '現金認購';
      default:
        return '未知來源';
    }
  };
  
  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h5" gutterBottom>
        我的股權持有
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="textSecondary">
          這裡展示了您目前持有的所有股權記錄，包括來源、數量和當前價值等詳細資訊。
        </Typography>
      </Box>
      
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">
          {error instanceof Error ? error.message : '載入股權資料時發生錯誤'}
        </Alert>
      ) : holdings && holdings.length > 0 ? (
        <Paper elevation={2}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>股權類型</TableCell>
                  <TableCell>來源</TableCell>
                  <TableCell align="right">股份數量</TableCell>
                  <TableCell align="right">當前價值</TableCell>
                  <TableCell align="center">已歸屬百分比</TableCell>
                  <TableCell>鎖定期結束日</TableCell>
                  <TableCell>狀態</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {holdings.map((holding: EmployeeEquityHolding) => (
                  <TableRow key={holding.holdingId}>
                    <TableCell>
                      {holding.equityType === 'phantom' ? '虛擬股' : '實股'}
                    </TableCell>
                    <TableCell>{getSourceTypeLabel(holding.sourceType)}</TableCell>
                    <TableCell align="right">{holding.shares.toLocaleString()}</TableCell>
                    <TableCell align="right">{formatCurrency(holding.currentValue)}</TableCell>
                    <TableCell align="center">
                      {Math.round(holding.vestingPercentage * 100)}%
                    </TableCell>
                    <TableCell>
                      {holding.vestingEndDate ? 
                        formatDate(holding.vestingEndDate.toDate()) : 
                        '無鎖定期'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={holding.status === 'active' ? '活躍' : 
                               holding.status === 'vesting' ? '鎖定中' :
                               holding.status === 'locked' ? '凍結' : '不活躍'}
                        color={getStatusColor(holding.status) as any}
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
          您目前沒有任何股權持有記錄。
        </Alert>
      )}
      
      {holdings && holdings.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  總持股數量
                </Typography>
                <Typography variant="h6">
                  {holdings.reduce((total, holding) => total + holding.shares, 0).toLocaleString()} 股
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  總持股價值
                </Typography>
                <Typography variant="h6">
                  {formatCurrency(
                    holdings.reduce((total, holding) => total + holding.currentValue, 0)
                  )}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  已全部解鎖的持股數量
                </Typography>
                <Typography variant="h6">
                  {holdings
                    .filter(holding => holding.vestingPercentage >= 1)
                    .reduce((total, holding) => total + holding.shares, 0)
                    .toLocaleString()} 股
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default MyHoldingsPage; 