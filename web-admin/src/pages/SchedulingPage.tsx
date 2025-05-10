import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Paper,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { zhTW } from 'date-fns/locale';
import { format, startOfMonth, endOfMonth, addMonths, parseISO, isWithinInterval } from 'date-fns';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';

import { listSchedules, deleteSchedule } from '../services/schedulingService';
import ScheduleForm from '../components/Scheduling/ScheduleForm';
import { Schedule } from '../types/scheduling.types';

// 假設的數據獲取函數，實際項目中應該從API獲取
const getEmployees = async () => {
  // 模擬API調用
  await new Promise(resolve => setTimeout(resolve, 300));
  return [
    { id: 'emp1', name: '張三' },
    { id: 'emp2', name: '李四' },
    { id: 'emp3', name: '王五' },
    { id: 'emp4', name: '趙六' },
    { id: 'emp5', name: '孫七' }
  ];
};

const getStores = async () => {
  // 模擬API調用
  await new Promise(resolve => setTimeout(resolve, 300));
  return [
    { id: 'store1', name: '台北店' },
    { id: 'store2', name: '新北店' },
    { id: 'store3', name: '桃園店' },
    { id: 'store4', name: '台中店' },
    { id: 'store5', name: '高雄店' }
  ];
};

// 角色名稱映射表
const roleNameMap: Record<string, string> = {
  'cashier': '收銀員',
  'server': '服務員',
  'chef': '廚師',
  'manager': '經理',
  'cleaner': '清潔員'
};

const SchedulingPage: React.FC = () => {
  // 狀態
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | undefined>(undefined);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; scheduleId: string | null }>({
    open: false,
    scheduleId: null
  });
  
  // 篩選條件
  const [filters, setFilters] = useState({
    storeId: '',
    employeeId: '',
    role: ''
  });
  
  // 行事曆視圖狀態
  const [calendarView, setCalendarView] = useState<'dayGridMonth' | 'timeGridWeek'>('dayGridMonth');
  
  // 加載排班數據
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      
      const params: any = {
        startDate,
        endDate
      };
      
      // 添加篩選條件（如果有）
      if (filters.storeId) params.storeId = filters.storeId;
      if (filters.employeeId) params.employeeId = filters.employeeId;
      
      const response = await listSchedules(params);
      setSchedules(response.schedules);
    } catch (error) {
      console.error('獲取排班數據失敗:', error);
      setSnackbar({
        open: true,
        message: '獲取排班數據失敗',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [currentDate, filters]);
  
  // 加載員工和商店數據
  const fetchEmployeesAndStores = useCallback(async () => {
    try {
      const [employeesData, storesData] = await Promise.all([
        getEmployees(),
        getStores()
      ]);
      
      setEmployees(employeesData);
      setStores(storesData);
    } catch (error) {
      console.error('獲取員工和商店數據失敗:', error);
    }
  }, []);
  
  // 格式化排班為行事曆事件
  const formatSchedulesToEvents = useCallback(() => {
    return schedules
      .filter(schedule => {
        // 根據篩選條件過濾
        if (filters.storeId && schedule.storeId !== filters.storeId) return false;
        if (filters.employeeId && schedule.employeeId !== filters.employeeId) return false;
        if (filters.role && schedule.role !== filters.role) return false;
        
        return true;
      })
      .map(schedule => {
        // 找到對應的員工和商店名稱
        const employee = employees.find(emp => emp.id === schedule.employeeId);
        const store = stores.find(s => s.id === schedule.storeId);
        
        // 根據角色獲取顏色
        const getColorByRole = (role: string) => {
          switch (role) {
            case 'cashier': return '#4caf50'; // 綠色
            case 'server': return '#2196f3'; // 藍色
            case 'chef': return '#ff9800'; // 橙色
            case 'manager': return '#9c27b0'; // 紫色
            case 'cleaner': return '#795548'; // 棕色
            default: return '#757575'; // 灰色
          }
        };
        
        return {
          id: schedule.scheduleId,
          title: `${employee?.name || '未知員工'} (${roleNameMap[schedule.role] || schedule.role})`,
          start: schedule.startTime,
          end: schedule.endTime,
          backgroundColor: getColorByRole(schedule.role),
          borderColor: getColorByRole(schedule.role),
          extendedProps: {
            ...schedule,
            employeeName: employee?.name,
            storeName: store?.name
          }
        };
      });
  }, [schedules, filters, employees, stores]);
  
  // 處理月份變更
  const handleMonthChange = (date: Date | null) => {
    if (date) {
      setCurrentDate(date);
    }
  };
  
  // 處理篩選條件變更
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // 處理事件點擊
  const handleEventClick = (info: any) => {
    const schedule = info.event.extendedProps as Schedule;
    setSelectedSchedule(schedule);
    setFormOpen(true);
  };
  
  // 新增排班
  const handleAddSchedule = () => {
    setSelectedSchedule(undefined);
    setFormOpen(true);
  };
  
  // 處理排班保存成功
  const handleScheduleSaved = (savedSchedule: Schedule) => {
    fetchSchedules(); // 重新加載數據
    setSnackbar({
      open: true,
      message: `排班${selectedSchedule ? '更新' : '創建'}成功`,
      severity: 'success'
    });
  };
  
  // 處理刪除排班
  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await deleteSchedule(scheduleId);
      fetchSchedules();
      setSnackbar({
        open: true,
        message: '排班刪除成功',
        severity: 'success'
      });
    } catch (error) {
      console.error('刪除排班失敗:', error);
      setSnackbar({
        open: true,
        message: '刪除排班失敗',
        severity: 'error'
      });
    }
  };
  
  // 處理Snackbar關閉
  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };
  
  // 初始加載
  useEffect(() => {
    fetchEmployeesAndStores();
  }, [fetchEmployeesAndStores]);
  
  // 當日期或篩選條件變更時重新加載數據
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);
  
  // 前進一個月
  const nextMonth = () => {
    setCurrentDate(prev => addMonths(prev, 1));
  };
  
  // 後退一個月
  const prevMonth = () => {
    setCurrentDate(prev => addMonths(prev, -1));
  };
  
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          員工排班管理
        </Typography>
        
        {/* 篩選器 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={2.5}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={zhTW}>
                <DatePicker
                  label="選擇月份"
                  value={currentDate}
                  onChange={handleMonthChange}
                  views={['year', 'month']}
                  slotProps={{
                    textField: { fullWidth: true }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} md={2.5}>
              <FormControl fullWidth>
                <InputLabel>分店</InputLabel>
                <Select
                  value={filters.storeId}
                  label="分店"
                  onChange={(e) => handleFilterChange('storeId', e.target.value)}
                >
                  <MenuItem value="">全部分店</MenuItem>
                  {stores.map(store => (
                    <MenuItem key={store.id} value={store.id}>{store.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2.5}>
              <FormControl fullWidth>
                <InputLabel>員工</InputLabel>
                <Select
                  value={filters.employeeId}
                  label="員工"
                  onChange={(e) => handleFilterChange('employeeId', e.target.value)}
                >
                  <MenuItem value="">全部員工</MenuItem>
                  {employees.map(employee => (
                    <MenuItem key={employee.id} value={employee.id}>{employee.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2.5}>
              <FormControl fullWidth>
                <InputLabel>角色</InputLabel>
                <Select
                  value={filters.role}
                  label="角色"
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                >
                  <MenuItem value="">全部角色</MenuItem>
                  {Object.entries(roleNameMap).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6} md={1}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => setFilters({ storeId: '', employeeId: '', role: '' })}
              >
                重置
              </Button>
            </Grid>
            
            <Grid item xs={6} md={1}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                startIcon={<RefreshIcon />}
                onClick={() => fetchSchedules()}
              >
                刷新
              </Button>
            </Grid>
          </Grid>
        </Paper>
        
        {/* 操作按鈕 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddSchedule}
            >
              新增排班
            </Button>
          </Box>
          
          <Box>
            <Button
              variant={calendarView === 'dayGridMonth' ? 'contained' : 'outlined'}
              onClick={() => setCalendarView('dayGridMonth')}
              sx={{ mr: 1 }}
            >
              月視圖
            </Button>
            <Button
              variant={calendarView === 'timeGridWeek' ? 'contained' : 'outlined'}
              onClick={() => setCalendarView('timeGridWeek')}
            >
              週視圖
            </Button>
          </Box>
        </Box>
        
        {/* 行事曆 */}
        <Paper sx={{ p: 2, position: 'relative', minHeight: '70vh' }}>
          {loading && (
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.7)',
              zIndex: 10
            }}>
              <CircularProgress />
            </Box>
          )}
          
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={calendarView}
            headerToolbar={false}
            events={formatSchedulesToEvents()}
            height="auto"
            locale="zh-tw"
            eventClick={handleEventClick}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }}
            slotLabelFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }}
            allDaySlot={false}
            firstDay={1} // 周一為每週第一天
            eventContent={(eventInfo) => {
              const schedule = eventInfo.event.extendedProps as Schedule;
              return (
                <Box sx={{ p: 0.5, fontSize: 'inherit', overflow: 'hidden' }}>
                  <Box sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {eventInfo.timeText} - {schedule.employeeName}
                  </Box>
                  <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {roleNameMap[schedule.role] || schedule.role}
                  </Box>
                  {calendarView === 'timeGridWeek' && (
                    <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {schedule.storeName}
                    </Box>
                  )}
                  {calendarView === 'timeGridWeek' && schedule.note && (
                    <Box sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      備註: {schedule.note}
                    </Box>
                  )}
                  {calendarView === 'timeGridWeek' && (
                    <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                      <Tooltip title="編輯">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSchedule(schedule);
                            setFormOpen(true);
                          }}
                          sx={{ padding: 0.25 }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="刪除">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSchedule(schedule.scheduleId);
                          }}
                          sx={{ padding: 0.25 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              );
            }}
          />
        </Paper>
      </Box>
      
      {/* 排班表單對話框 */}
      <ScheduleForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={handleScheduleSaved}
        initialData={selectedSchedule}
        employees={employees}
        stores={stores}
      />
      
      {/* 通知訊息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default SchedulingPage; 