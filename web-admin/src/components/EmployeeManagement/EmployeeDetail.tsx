import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Divider,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Event as EventIcon,
  Phone as PhoneIcon,
  AttachMoney as AttachMoneyIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Employee, EmployeeStatus } from '../../types/employee';
import { getEmployeeById } from '../../services/employeeService';

interface EmployeeDetailProps {
  employeeId?: string;
  onBack?: () => void;
  onEdit?: (employeeId: string) => void;
}

const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employeeId: propsEmployeeId, onBack, onEdit }) => {
  const params = useParams();
  const navigate = useNavigate();
  const employeeId = propsEmployeeId || params.id;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 狀態顯示的映射
  const statusMap: Record<EmployeeStatus, { label: string; color: 'success' | 'error' | 'warning' | 'default' }> = {
    active: { label: '在職', color: 'success' },
    inactive: { label: '待職', color: 'default' },
    on_leave: { label: '休假', color: 'warning' },
    terminated: { label: '離職', color: 'error' },
  };

  // 班次顯示的映射
  const shiftMap: Record<string, string> = {
    morning: '早班 (08:00-14:00)',
    afternoon: '午班 (14:00-20:00)',
    evening: '晚班 (20:00-02:00)',
  };

  // 星期幾顯示的映射
  const daysOfWeek = [
    '週日', '週一', '週二', '週三', '週四', '週五', '週六'
  ];

  // 獲取員工數據
  const fetchEmployee = async () => {
    if (!employeeId) {
      setError('員工 ID 不存在');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await getEmployeeById(employeeId);
      setEmployee(data);
    } catch (err) {
      console.error('獲取員工詳情失敗:', err);
      setError('獲取員工詳情時發生錯誤，請稍後再試。');
    } finally {
      setIsLoading(false);
    }
  };

  // 當employeeId變更時獲取數據
  useEffect(() => {
    if (employeeId) {
      fetchEmployee();
    }
  }, [employeeId]);

  // 格式化日期
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '未設定';
    try {
      return format(new Date(dateString), 'yyyy年MM月dd日', { locale: zhTW });
    } catch {
      return '日期格式錯誤';
    }
  };

  // 處理編輯按鈕點擊
  const handleEdit = () => {
    if (onEdit && employeeId) {
      onEdit(employeeId);
    } else if (employeeId) {
      navigate(`/employees/edit/${employeeId}`);
    }
  };

  // 處理返回按鈕點擊
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/employees');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ my: 2 }}>
        <Alert severity="error">{error}</Alert>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mt: 2 }}>
          返回列表
        </Button>
      </Box>
    );
  }

  if (!employee) {
    return (
      <Box sx={{ my: 2 }}>
        <Alert severity="info">沒有找到此員工的資料</Alert>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mt: 2 }}>
          返回列表
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={handleBack} size="large" sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            員工詳細資訊
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<EditIcon />} 
          onClick={handleEdit}
        >
          編輯資料
        </Button>
      </Box>

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>
              {employee.lastName} {employee.firstName}
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              {employee.position}
            </Typography>
          </Box>
          <Chip 
            label={statusMap[employee.status]?.label || employee.status}
            color={statusMap[employee.status]?.color || 'default'}
            sx={{ fontWeight: 'bold' }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={3}>
          {/* 基本信息 */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <EventIcon sx={{ mr: 1 }} /> 基本信息
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold', width: '40%' }}>
                      員工編號
                    </TableCell>
                    <TableCell>{employee.employeeCode || '未設定'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold', width: '40%' }}>
                      入職日期
                    </TableCell>
                    <TableCell>{formatDate(employee.hireDate)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>
                      雇傭類型
                    </TableCell>
                    <TableCell>{employee.employmentType}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>
                      工作分店
                    </TableCell>
                    <TableCell>{employee.storeName || employee.storeId}</TableCell>
                  </TableRow>
                  {employee.status === 'terminated' && (
                    <TableRow>
                      <TableCell component="th" sx={{ fontWeight: 'bold' }}>
                        離職日期
                      </TableCell>
                      <TableCell>{formatDate(employee.terminationDate)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* 聯絡資訊 */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <PhoneIcon sx={{ mr: 1 }} /> 聯絡資訊
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold', width: '40%' }}>
                      電話
                    </TableCell>
                    <TableCell>{employee.contactInfo?.phone || '未設定'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>
                      緊急聯絡人
                    </TableCell>
                    <TableCell>{employee.contactInfo?.emergencyContact || '未設定'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>
                      緊急聯絡電話
                    </TableCell>
                    <TableCell>{employee.contactInfo?.emergencyPhone || '未設定'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* 排班資訊 */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <AccessTimeIcon sx={{ mr: 1 }} /> 排班資訊
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold', width: '40%' }}>
                      班次偏好
                    </TableCell>
                    <TableCell>
                      {employee.schedule?.preferredShifts && employee.schedule.preferredShifts.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {employee.schedule.preferredShifts.map((shift) => (
                            <Chip 
                              key={shift} 
                              label={shiftMap[shift] || shift} 
                              size="small" 
                              color="primary" 
                              variant="outlined" 
                            />
                          ))}
                        </Box>
                      ) : (
                        '無偏好班次'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>
                      不可排班日
                    </TableCell>
                    <TableCell>
                      {employee.schedule?.daysUnavailable && employee.schedule.daysUnavailable.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {employee.schedule.daysUnavailable.map((day) => (
                            <Chip 
                              key={day} 
                              label={daysOfWeek[day]} 
                              size="small" 
                              color="error" 
                              variant="outlined" 
                            />
                          ))}
                        </Box>
                      ) : (
                        '無不可排班日'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>
                      每週最大工時
                    </TableCell>
                    <TableCell>{employee.schedule?.maxHoursPerWeek || '未設定'} 小時</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* 薪資資訊 */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <AttachMoneyIcon sx={{ mr: 1 }} /> 薪資資訊
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold', width: '40%' }}>
                      薪資類型
                    </TableCell>
                    <TableCell>
                      {employee.payInfo?.salaryType === 'hourly' && '時薪'}
                      {employee.payInfo?.salaryType === 'monthly' && '月薪'}
                      {employee.payInfo?.salaryType === 'annual' && '年薪'}
                      {!employee.payInfo?.salaryType && '未設定'}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>
                      {employee.payInfo?.salaryType === 'hourly' ? '時薪' : '薪資'}
                    </TableCell>
                    <TableCell>{employee.payInfo?.hourlyRate ? `NT$ ${employee.payInfo.hourlyRate}` : '未設定'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" sx={{ fontWeight: 'bold' }}>
                      銀行帳號
                    </TableCell>
                    <TableCell>{employee.payInfo?.bankAccount || '未設定'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default EmployeeDetail; 