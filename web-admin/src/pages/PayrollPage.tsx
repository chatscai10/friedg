import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  TextField,
  Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, startOfMonth, endOfMonth, isBefore } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import CalculateIcon from '@mui/icons-material/Calculate';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InfoIcon from '@mui/icons-material/Info';

import { 
  triggerPayrollCalculation, 
  listEmployeePayslips, 
  Payslip, 
  PayrollCalculationResponse,
  PaginatedResponse
} from '../services/payrollService';
import { listEmployees } from '../services/employeeService';

// 薪資單狀態對應的顏色和標籤
const statusConfig: Record<string, { color: 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning', label: string }> = {
  'pending': { color: 'warning', label: '待處理' },
  'processing': { color: 'info', label: '處理中' },
  'paid': { color: 'success', label: '已支付' },
  'rejected': { color: 'error', label: '已拒絕' },
  'cancelled': { color: 'default', label: '已取消' }
};

// 薪資計算結果顯示組件
type CalculationResultProps = {
  result: PayrollCalculationResponse | null;
  onClose: () => void;
};

const CalculationResult: React.FC<CalculationResultProps> = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6">薪資計算結果</Typography>
        <Button size="small" onClick={onClose}>關閉</Button>
      </Box>
      <Divider sx={{ mb: 2 }} />
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2">員工ID:</Typography>
          <Typography>{result.employeeId}</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2">薪資類型:</Typography>
          <Typography>
            {result.salaryType === 'hourly' ? '時薪制' : 
             result.salaryType === 'monthly' ? '月薪制' : 
             result.salaryType === 'commission' ? '提成制' : result.salaryType}
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2">計薪週期:</Typography>
          <Typography>{result.periodStart} 至 {result.periodEnd}</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2">貨幣:</Typography>
          <Typography>{result.currency}</Typography>
        </Grid>
        
        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle1" gutterBottom>基本薪資項目</Typography>
          
          {result.salaryType === 'hourly' && (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2">一般工時:</Typography>
                  <Typography>{result.grossSalary.regularHours || 0} 小時</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2">一般工資:</Typography>
                  <Typography>${result.grossSalary.regularPay || 0}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2">加班時數 (1.33倍):</Typography>
                  <Typography>{result.grossSalary.overtimeHours?.rate1 || 0} 小時</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2">加班費 (1.33倍):</Typography>
                  <Typography>${result.grossSalary.overtimePay?.rate1 || 0}</Typography>
                </Grid>
              </Grid>
              <Grid container spacing={2} mt={1}>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2">加班時數 (1.66倍):</Typography>
                  <Typography>{result.grossSalary.overtimeHours?.rate2 || 0} 小時</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2">加班費 (1.66倍):</Typography>
                  <Typography>${result.grossSalary.overtimePay?.rate2 || 0}</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2">假日工時:</Typography>
                  <Typography>{result.grossSalary.holidayHours || 0} 小時</Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="body2">假日工資:</Typography>
                  <Typography>${result.grossSalary.holidayPay || 0}</Typography>
                </Grid>
              </Grid>
            </>
          )}
          
          {result.salaryType === 'monthly' && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Typography variant="body2">基本月薪:</Typography>
                <Typography>${result.grossSalary.baseSalary || 0}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2">實際工作天數:</Typography>
                <Typography>{result.grossSalary.workingDays || 0} 天</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2">應工作總天數:</Typography>
                <Typography>{result.grossSalary.totalWorkDays || 0} 天</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2">按比例計算薪資:</Typography>
                <Typography>${result.grossSalary.proRatedSalary || 0}</Typography>
              </Grid>
            </Grid>
          )}
          
          {result.salaryType === 'commission' && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Typography variant="body2">底薪:</Typography>
                <Typography>${result.grossSalary.commissionBaseSalary || 0}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2">銷售額:</Typography>
                <Typography>${result.grossSalary.salesAmount || 0}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2">提成金額:</Typography>
                <Typography>${result.grossSalary.commissionAmount || 0}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" fontWeight="bold">總毛薪:</Typography>
                <Typography fontWeight="bold">${result.grossSalary.totalGrossSalary || 0}</Typography>
              </Grid>
            </Grid>
          )}
        </Grid>
        
        {result.bonuses.bonusItems.length > 0 && (
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle1" gutterBottom>獎金項目</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>獎金名稱</TableCell>
                    <TableCell>類型</TableCell>
                    <TableCell>金額</TableCell>
                    <TableCell>說明</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.bonuses.bonusItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.bonusType}</TableCell>
                      <TableCell>${item.amount}</TableCell>
                      <TableCell>{item.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography fontWeight="bold">獎金總額</Typography>
                    </TableCell>
                    <TableCell colSpan={2}>
                      <Typography fontWeight="bold">${result.bonuses.totalBonusAmount}</Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        )}
        
        {result.deductions.deductionItems.length > 0 && (
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle1" gutterBottom>扣除項目</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>扣除名稱</TableCell>
                    <TableCell>類型</TableCell>
                    <TableCell>金額</TableCell>
                    <TableCell>說明</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.deductions.deductionItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.deductionType}</TableCell>
                      <TableCell>${item.amount}</TableCell>
                      <TableCell>{item.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography fontWeight="bold">扣除總額</Typography>
                    </TableCell>
                    <TableCell colSpan={2}>
                      <Typography fontWeight="bold">${result.deductions.totalDeductionAmount}</Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        )}
        
        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">實發薪資:</Typography>
            <Typography variant="h6" color="primary">${result.netPay}</Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

// 薪資管理主頁
const PayrollPage: React.FC = () => {
  // 狀態
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [employees, setEmployees] = useState<Array<{ id: string, name: string }>>([]);
  const [periodStart, setPeriodStart] = useState<Date | null>(startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date | null>(endOfMonth(new Date()));
  
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calculationResult, setCalculationResult] = useState<PayrollCalculationResponse | null>(null);
  
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [isLoadingPayslips, setIsLoadingPayslips] = useState<boolean>(false);
  const [totalPayslips, setTotalPayslips] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info');
  
  // 獲取員工列表
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await listEmployees();
        setEmployees(response.data.map(emp => ({ id: emp.id, name: emp.name })));
      } catch (error) {
        console.error('Error fetching employees:', error);
        showSnackbar('獲取員工列表失敗', 'error');
      }
    };
    
    fetchEmployees();
  }, []);
  
  // 當選擇的員工變化時，獲取該員工的薪資單列表
  useEffect(() => {
    if (selectedEmployee) {
      fetchPayslips();
    } else {
      setPayslips([]);
      setTotalPayslips(0);
    }
  }, [selectedEmployee, page, rowsPerPage]);
  
  // 獲取薪資單列表
  const fetchPayslips = async () => {
    if (!selectedEmployee) return;
    
    setIsLoadingPayslips(true);
    try {
      const response = await listEmployeePayslips(selectedEmployee, {
        page: page + 1, // API使用1-based索引，而Material UI使用0-based索引
        limit: rowsPerPage
      });
      
      setPayslips(response.data);
      setTotalPayslips(response.pagination.total);
    } catch (error) {
      console.error('Error fetching payslips:', error);
      showSnackbar('獲取薪資單列表失敗', 'error');
    } finally {
      setIsLoadingPayslips(false);
    }
  };
  
  // 觸發薪資計算
  const handleCalculateSalary = async () => {
    if (!selectedEmployee || !periodStart || !periodEnd) {
      showSnackbar('請選擇員工和計薪週期', 'error');
      return;
    }
    
    if (isBefore(periodEnd, periodStart)) {
      showSnackbar('結束日期不能早於開始日期', 'error');
      return;
    }
    
    setIsCalculating(true);
    try {
      const result = await triggerPayrollCalculation(
        selectedEmployee,
        format(periodStart, 'yyyy-MM-dd'),
        format(periodEnd, 'yyyy-MM-dd')
      );
      
      setCalculationResult(result);
      showSnackbar('薪資計算成功', 'success');
      
      // 刷新薪資單列表
      fetchPayslips();
    } catch (error) {
      console.error('Error calculating salary:', error);
      showSnackbar('薪資計算失敗', 'error');
    } finally {
      setIsCalculating(false);
    }
  };
  
  // 顯示提示訊息
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };
  
  // 處理分頁變更
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  // 處理每頁數量變更
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // 格式化薪資單的狀態顯示
  const formatPayslipStatus = (status: string) => {
    const config = statusConfig[status] || { color: 'default', label: status };
    return <Chip size="small" color={config.color} label={config.label} />;
  };
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        薪資管理
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          薪資計算
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="employee-select-label">選擇員工</InputLabel>
              <Select
                labelId="employee-select-label"
                id="employee-select"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value as string)}
                label="選擇員工"
              >
                <MenuItem value="">
                  <em>請選擇</em>
                </MenuItem>
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
              <DatePicker
                label="計薪週期開始"
                value={periodStart}
                onChange={(newValue) => setPeriodStart(newValue)}
                slotProps={{ textField: { fullWidth: true, variant: 'outlined' } }}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
              <DatePicker
                label="計薪週期結束"
                value={periodEnd}
                onChange={(newValue) => setPeriodEnd(newValue)}
                slotProps={{ textField: { fullWidth: true, variant: 'outlined' } }}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              disabled={!selectedEmployee || !periodStart || !periodEnd || isCalculating}
              onClick={handleCalculateSalary}
              startIcon={isCalculating ? <CircularProgress size={20} color="inherit" /> : <CalculateIcon />}
              sx={{ height: '56px' }}
            >
              {isCalculating ? '計算中...' : '計算薪資'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {calculationResult && (
        <CalculationResult
          result={calculationResult}
          onClose={() => setCalculationResult(null)}
        />
      )}
      
      {selectedEmployee && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            薪資單歷史
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>薪資單編號</TableCell>
                  <TableCell>期間</TableCell>
                  <TableCell>薪資類型</TableCell>
                  <TableCell>實發薪資</TableCell>
                  <TableCell>狀態</TableCell>
                  <TableCell>生成時間</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoadingPayslips ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress size={24} />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        載入中...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : payslips.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      無薪資單記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  payslips.map((payslip) => (
                    <TableRow key={payslip.id}>
                      <TableCell>{payslip.payslipNumber}</TableCell>
                      <TableCell>
                        {format(new Date(payslip.periodStart), 'yyyy-MM-dd')} 至 {format(new Date(payslip.periodEnd), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell>
                        {payslip.salaryType === 'hourly' ? '時薪制' : 
                          payslip.salaryType === 'monthly' ? '月薪制' : 
                          payslip.salaryType === 'commission' ? '提成制' : payslip.salaryType}
                      </TableCell>
                      <TableCell>${payslip.netPay}</TableCell>
                      <TableCell>{formatPayslipStatus(payslip.status)}</TableCell>
                      <TableCell>{format(new Date(payslip.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => {/* TODO: 實現查看詳情 */}}
                        >
                          查看
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalPayslips}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="每頁顯示:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count !== -1 ? count : '更多'}`}
          />
        </Paper>
      )}
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PayrollPage; 