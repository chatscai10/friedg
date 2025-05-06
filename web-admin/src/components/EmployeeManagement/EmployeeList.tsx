import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Stack,
  Chip,
  SelectChangeEvent,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { Employee, EmployeeStatus } from '../../types/employee';
import { getEmployees, GetEmployeesParams } from '../../services/employeeService';

interface EmployeeListProps {
  onAddNew?: () => void;
  onEdit?: (employeeId: string) => void;
}

const EmployeeList: React.FC<EmployeeListProps> = ({ onAddNew, onEdit }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortField, setSortField] = useState<keyof Employee>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rowsPerPage = 5;

  // 狀態顯示的映射
  const statusMap: Record<EmployeeStatus, { label: string; color: 'success' | 'error' | 'warning' | 'default' }> = {
    active: { label: '在職', color: 'success' },
    inactive: { label: '待職', color: 'default' },
    on_leave: { label: '休假', color: 'warning' },
    terminated: { label: '離職', color: 'error' },
  };

  // 獲取員工數據的函數
  const fetchEmployees = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: GetEmployeesParams = {
        page: page - 1, // API可能使用0索引的分頁
        size: rowsPerPage,
        sort: `${sortField},${sortOrder}`,
      };

      if (statusFilter) {
        params.status = statusFilter;
      }

      if (searchQuery) {
        params.searchQuery = searchQuery;
      }

      const response = await getEmployees(params);
      setEmployees(response.content);
      setTotalPages(response.totalPages);
    } catch (err) {
      console.error('獲取員工列表失敗:', err);
      setError('獲取員工數據時發生錯誤，請稍後再試。');
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 當頁面加載或依賴項變更時獲取數據
  useEffect(() => {
    fetchEmployees();
  }, [page, statusFilter, sortField, sortOrder]);

  // 處理搜索
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // 執行搜索
  const handleSearchSubmit = () => {
    setPage(1); // 重置頁碼
    fetchEmployees();
  };

  // 處理按Enter鍵搜索
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  // 處理狀態篩選
  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value);
    setPage(1); // 重置頁碼
  };

  // 處理排序
  const handleSortChange = (event: SelectChangeEvent) => {
    setSortField(event.target.value as keyof Employee);
    setPage(1); // 重置頁碼
  };

  // 切換排序順序
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    setPage(1); // 重置頁碼
  };

  // 處理分頁
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  // 處理編輯按鈕點擊
  const handleEdit = (employeeId: string) => {
    if (onEdit) {
      onEdit(employeeId);
    }
  };

  // 處理手動刷新
  const handleRefresh = () => {
    fetchEmployees();
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        員工管理
      </Typography>
      <Box sx={{ my: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="搜尋員工..."
            value={searchQuery}
            onChange={handleSearch}
            onKeyPress={handleKeyPress}
            InputProps={{
              startAdornment: <SearchIcon color="primary" sx={{ mr: 1 }} />
            }}
            sx={{ minWidth: 200 }}
          />
          
          <IconButton onClick={handleSearchSubmit} color="primary" size="small">
            <SearchIcon />
          </IconButton>
          
          <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="status-filter-label">狀態篩選</InputLabel>
            <Select
              labelId="status-filter-label"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              label="狀態篩選"
              startAdornment={<FilterListIcon sx={{ mr: 1, color: 'primary.main' }} />}
            >
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="active">在職</MenuItem>
              <MenuItem value="inactive">待職</MenuItem>
              <MenuItem value="on_leave">休假</MenuItem>
              <MenuItem value="terminated">離職</MenuItem>
            </Select>
          </FormControl>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="sort-field-label">排序欄位</InputLabel>
              <Select
                labelId="sort-field-label"
                value={sortField}
                onChange={handleSortChange}
                label="排序欄位"
              >
                <MenuItem value="id">ID</MenuItem>
                <MenuItem value="firstName">姓名</MenuItem>
                <MenuItem value="position">職位</MenuItem>
                <MenuItem value="storeName">店鋪</MenuItem>
                <MenuItem value="status">狀態</MenuItem>
                <MenuItem value="hireDate">入職日期</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={toggleSortOrder} color="primary">
              <SortIcon sx={{ transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none' }} />
            </IconButton>
          </Box>
          
          <IconButton onClick={handleRefresh} color="primary" title="刷新數據">
            <RefreshIcon />
          </IconButton>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          sx={{ borderRadius: '50px', ml: 2 }}
          onClick={onAddNew}
        >
          新增員工
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ mt: 3, position: 'relative' }}>
        {isLoading && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>姓名</TableCell>
              <TableCell>職位</TableCell>
              <TableCell>店鋪</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>入職日期</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee) => (
              <TableRow key={employee.id} hover>
                <TableCell>{employee.id}</TableCell>
                <TableCell>{`${employee.lastName}${employee.firstName}`}</TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>{employee.storeName}</TableCell>
                <TableCell>
                  <Chip 
                    label={statusMap[employee.status].label}
                    color={statusMap[employee.status].color}
                    size="small"
                  />
                </TableCell>
                <TableCell>{employee.hireDate}</TableCell>
                <TableCell align="center">
                  <IconButton color="primary" onClick={() => handleEdit(employee.id)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  無符合條件的員工記錄
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Stack spacing={2}>
          <Pagination 
            count={totalPages} 
            page={page} 
            onChange={handlePageChange} 
            color="primary" 
            showFirstButton 
            showLastButton
            disabled={isLoading}
          />
        </Stack>
      </Box>
    </Box>
  );
};

export default EmployeeList; 