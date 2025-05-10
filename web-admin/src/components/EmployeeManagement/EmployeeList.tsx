import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Link,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sort as SortIcon,
  Refresh as RefreshIcon,
  Upload as UploadIcon,
  VpnKey as VpnKeyIcon,
  Store as StoreIcon,
} from '@mui/icons-material';

import { Employee, EmployeeStatus } from '../../types/employee';
import { getEmployees } from '../../services/employeeService';

// 定義與employeeService參數一致的接口
interface EmployeeListParams {
  page?: number;
  limit?: number;
  storeId?: string;
  role?: string;
  status?: EmployeeStatus;
  query?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

// 兼容不同的API分頁響應格式
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

// 多店鋪分配模態框的店鋪類型
interface StoreAssignment {
  id: string;
  name: string;
  storeCode: string;
  assignmentStatus: 'assigned' | 'not_assigned';
}

// 角色類型
interface Role {
  id: string;
  name: string;
  permissionLevel: number;
  description: string;
}

const EmployeeList: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 模態框相關狀態
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [permissionLevel, setPermissionLevel] = useState<number>(1);
  const [assignedStores, setAssignedStores] = useState<StoreAssignment[]>([]);
  const [availableStores, setAvailableStores] = useState<StoreAssignment[]>([]);
  const [newStoreSelection, setNewStoreSelection] = useState<string>('');

  const rowsPerPage = 10;

  // 狀態顯示的映射
  const statusMap: Record<EmployeeStatus, { label: string; color: 'success' | 'error' | 'warning' | 'default' }> = {
    active: { label: '在職', color: 'success' },
    inactive: { label: '待職', color: 'default' },
    on_leave: { label: '休假', color: 'warning' },
    terminated: { label: '離職', color: 'error' },
  };

  // 角色權限等級顏色映射
  const permissionLevelColorMap = (level: number): 'success' | 'primary' | 'secondary' | 'info' => {
    if (level >= 1 && level <= 3) return 'success';
    if (level >= 4 && level <= 6) return 'primary';
    if (level >= 7 && level <= 10) return 'secondary';
    return 'info';
  };

  // 模擬的角色數據
  const availableRoles: Role[] = [
    { id: '1', name: '見習員工', permissionLevel: 1, description: '基礎權限' },
    { id: '2', name: '員工', permissionLevel: 2, description: '標準操作權限' },
    { id: '3', name: '資深員工', permissionLevel: 3, description: '高級操作權限' },
    { id: '4', name: '組長', permissionLevel: 4, description: '小組管理權限' },
    { id: '5', name: '副店長', permissionLevel: 5, description: '店鋪副管理權限' },
    { id: '6', name: '店鋪管理員', permissionLevel: 6, description: '店鋪管理權限' },
    { id: '7', name: '區域經理', permissionLevel: 7, description: '區域管理權限' },
    { id: '8', name: '總監', permissionLevel: 8, description: '部門管理權限' },
    { id: '9', name: '副總經理', permissionLevel: 9, description: '副總管理權限' },
    { id: '10', name: '系統管理員', permissionLevel: 10, description: '最高系統權限' },
  ];

  // 獲取員工數據的函數
  const fetchEmployees = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: EmployeeListParams = {
        page: page,
        limit: rowsPerPage,
        sort: sortField,
        order: sortOrder
      };

      if (statusFilter) {
        params.status = statusFilter as EmployeeStatus;
      }

      if (roleFilter) {
        params.role = roleFilter;
      }

      if (storeFilter) {
        params.storeId = storeFilter;
      }

      if (searchQuery) {
        params.query = searchQuery;
      }

      const response = await getEmployees(params);
      
      if (response && response.employees) {
        setEmployees(response.employees);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages);
          setTotalItems(response.pagination.totalItems || 0);
        }
      } else {
        // 兼容不同的API響應格式
        console.warn('API返回格式可能與預期不符，嘗試適配...');
        
        // 假設response符合PaginatedResponse接口格式
        const paginatedResponse = response as unknown as PaginatedResponse<Employee>;
        if (paginatedResponse?.data) {
          setEmployees(paginatedResponse.data);
          setTotalPages(paginatedResponse.pagination.totalPages);
          setTotalItems(paginatedResponse.pagination.totalItems);
        } else if (Array.isArray(response)) {
          // 如果直接返回數組，則顯示所有數據
          setEmployees(response);
          setTotalPages(1);
          setTotalItems(response.length);
        } else {
          throw new Error('無法解析API返回的員工數據格式');
        }
      }
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
  }, [page, statusFilter, roleFilter, storeFilter, sortField, sortOrder]);

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

  // 處理角色篩選
  const handleRoleFilterChange = (event: SelectChangeEvent) => {
    setRoleFilter(event.target.value);
    setPage(1); // 重置頁碼
  };

  // 處理店鋪篩選
  const handleStoreFilterChange = (event: SelectChangeEvent) => {
    setStoreFilter(event.target.value);
    setPage(1); // 重置頁碼
  };

  // 處理排序
  const handleSortChange = (event: SelectChangeEvent) => {
    setSortField(event.target.value);
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

  // 處理新增員工按鈕點擊
  const handleAddNew = () => {
    navigate('/employees/new');
  };

  // 處理編輯按鈕點擊
  const handleEdit = (employeeId: string) => {
    navigate(`/employees/edit/${employeeId}`);
  };

  // 處理查看詳情按鈕點擊
  const handleViewDetails = (employeeId: string) => {
    navigate(`/employees/view/${employeeId}`);
  };

  // 處理刪除按鈕點擊 (實際操作將在此實現)
  const handleDelete = (employeeId: string) => {
    // 開發時可以實現確認對話框和刪除邏輯
    alert(`刪除員工操作尚未實現 (ID: ${employeeId})`);
  };

  // 處理角色設置按鈕點擊
  const handleRoleSetup = (employee: Employee) => {
    setSelectedEmployee(employee);
    
    // 設置當前角色和權限級別 (模擬數據，實際應該從employee中獲取)
    setSelectedRole('2'); // 假設該員工角色ID為2
    setPermissionLevel(2);  // 假設該員工權限等級為2
    
    setRoleModalOpen(true);
  };

  // 處理角色變更
  const handleRoleChange = (event: SelectChangeEvent) => {
    const roleId = event.target.value;
    setSelectedRole(roleId);
    
    // 自動設置對應的權限等級
    const role = availableRoles.find(r => r.id === roleId);
    if (role) {
      setPermissionLevel(role.permissionLevel);
    }
  };

  // 處理權限等級變更
  const handlePermissionLevelChange = (level: number) => {
    setPermissionLevel(level);
  };

  // 處理角色設置確認
  const handleRoleConfirm = () => {
    // 這裡應該實現保存角色設置的邏輯
    alert(`角色設置已保存: 角色=${selectedRole}, 權限等級=${permissionLevel}`);
    setRoleModalOpen(false);
  };

  // 處理店鋪分配按鈕點擊
  const handleStoreAssignment = (employee: Employee) => {
    setSelectedEmployee(employee);
    
    // 模擬已分配店鋪數據
    const mockAssignedStores: StoreAssignment[] = [
      { id: 's002', name: '新北門市', storeCode: 'S002', assignmentStatus: 'assigned' },
      { id: 's007', name: '板橋門市', storeCode: 'S007', assignmentStatus: 'assigned' }
    ];
    
    // 模擬可用但未分配的店鋪
    const mockAvailableStores: StoreAssignment[] = [
      { id: 's003', name: '台中門市', storeCode: 'S003', assignmentStatus: 'not_assigned' },
      { id: 's004', name: '高雄門市', storeCode: 'S004', assignmentStatus: 'not_assigned' },
      { id: 's005', name: '新竹門市', storeCode: 'S005', assignmentStatus: 'not_assigned' }
    ];
    
    setAssignedStores(mockAssignedStores);
    setAvailableStores(mockAvailableStores);
    setNewStoreSelection('');
    
    setStoreModalOpen(true);
  };

  // 處理新增店鋪分配
  const handleAddStoreAssignment = () => {
    if (!newStoreSelection) return;
    
    const storeToAdd = availableStores.find(s => s.id === newStoreSelection);
    if (storeToAdd) {
      // 從可用列表中移除
      setAvailableStores(prev => prev.filter(s => s.id !== newStoreSelection));
      
      // 添加到已分配列表
      setAssignedStores(prev => [
        ...prev, 
        { ...storeToAdd, assignmentStatus: 'assigned' }
      ]);
      
      setNewStoreSelection('');
    }
  };

  // 處理移除店鋪分配
  const handleRemoveStoreAssignment = (storeId: string) => {
    const storeToRemove = assignedStores.find(s => s.id === storeId);
    if (storeToRemove) {
      // 從已分配列表中移除
      setAssignedStores(prev => prev.filter(s => s.id !== storeId));
      
      // 添加到可用列表
      setAvailableStores(prev => [
        ...prev,
        { ...storeToRemove, assignmentStatus: 'not_assigned' }
      ]);
    }
  };

  // 處理店鋪分配確認
  const handleStoreAssignmentConfirm = () => {
    // 這裡應該實現保存店鋪分配的邏輯
    alert(`店鋪分配已保存: ${assignedStores.length}家店鋪`);
    setStoreModalOpen(false);
  };

  // 處理批量導入
  const handleBulkImport = () => {
    // 開發時可以實現文件上傳對話框或跳轉到導入頁面
    alert('批量導入功能尚未實現');
  };

  // 處理手動刷新
  const handleRefresh = () => {
    fetchEmployees();
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        員工管理
      </Typography>
      <Divider sx={{ mb: 3 }} />
      
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'wrap' }}>
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
          
          <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="status-filter-label">狀態</InputLabel>
            <Select
              labelId="status-filter-label"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              label="狀態"
            >
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="active">在職</MenuItem>
              <MenuItem value="inactive">待職</MenuItem>
              <MenuItem value="on_leave">休假</MenuItem>
              <MenuItem value="terminated">離職</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="role-filter-label">角色</InputLabel>
            <Select
              labelId="role-filter-label"
              value={roleFilter}
              onChange={handleRoleFilterChange}
              label="角色"
            >
              <MenuItem value="">全部</MenuItem>
              {availableRoles.map(role => (
                <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="store-filter-label">店鋪</InputLabel>
            <Select
              labelId="store-filter-label"
              value={storeFilter}
              onChange={handleStoreFilterChange}
              label="店鋪"
            >
              <MenuItem value="">全部店鋪</MenuItem>
              <MenuItem value="s001">台北門市</MenuItem>
              <MenuItem value="s002">新北門市</MenuItem>
              <MenuItem value="s003">台中門市</MenuItem>
              <MenuItem value="s004">高雄門市</MenuItem>
            </Select>
          </FormControl>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
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
                <MenuItem value="createdAt">創建日期</MenuItem>
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
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<UploadIcon />}
            onClick={handleBulkImport}
            sx={{ borderRadius: '4px' }}
          >
            批量導入
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddNew}
            sx={{ borderRadius: '4px' }}
          >
            新增員工
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ position: 'relative' }}>
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
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <Table>
          <TableHead sx={{ backgroundColor: '#355891' }}>
            <TableRow>
              <TableCell sx={{ color: 'white' }}>ID</TableCell>
              <TableCell sx={{ color: 'white' }}>姓名</TableCell>
              <TableCell sx={{ color: 'white' }}>職位</TableCell>
              <TableCell sx={{ color: 'white' }}>主店鋪</TableCell>
              <TableCell sx={{ color: 'white' }}>多店分配</TableCell>
              <TableCell sx={{ color: 'white' }}>角色</TableCell>
              <TableCell sx={{ color: 'white' }}>權限等級</TableCell>
              <TableCell sx={{ color: 'white' }}>狀態</TableCell>
              <TableCell sx={{ color: 'white' }}>入職日期</TableCell>
              <TableCell sx={{ color: 'white' }} align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((employee, index) => (
              <TableRow 
                key={employee.id}
                hover
                sx={{ backgroundColor: index % 2 === 0 ? 'rgba(0, 0, 0, 0.02)' : 'white' }}
              >
                <TableCell>{employee.employeeCode || employee.id.substring(0, 5)}</TableCell>
                <TableCell>
                  <Link 
                    component="button"
                    variant="body2"
                    onClick={() => handleViewDetails(employee.id)}
                    sx={{ textDecoration: 'none', cursor: 'pointer' }}
                  >
                    {`${employee.lastName}${employee.firstName}`}
                  </Link>
                </TableCell>
                <TableCell>{employee.position}</TableCell>
                <TableCell>{employee.storeName}</TableCell>
                <TableCell>
                  {/* 假設多店分配數量為 0-3 */}
                  {Math.floor(Math.random() * 4) > 0 ? (
                    <Chip 
                      label={`+${Math.floor(Math.random() * 3) + 1}家`} 
                      color="info" 
                      size="small"
                      variant="outlined"
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {/* 模擬角色 */}
                  {availableRoles[Math.floor(Math.random() * availableRoles.length)].name}
                </TableCell>
                <TableCell>
                  {/* 模擬權限等級 */}
                  {(() => {
                    const level = Math.floor(Math.random() * 10) + 1;
                    const chipColor = permissionLevelColorMap(level);
                    return (
                      <Chip 
                        label={level} 
                        color={chipColor}
                        size="small"
                      />
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={statusMap[employee.status]?.label || employee.status}
                    color={statusMap[employee.status]?.color || 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{employee.hireDate}</TableCell>
                <TableCell align="center">
                  <Tooltip title="編輯員工資料">
                    <IconButton color="primary" onClick={() => handleEdit(employee.id)} size="small">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="設置角色和權限">
                    <IconButton color="secondary" onClick={() => handleRoleSetup(employee)} size="small">
                      <VpnKeyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="管理多店分配">
                    <IconButton color="info" onClick={() => handleStoreAssignment(employee)} size="small">
                      <StoreIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="刪除員工">
                    <IconButton color="error" onClick={() => handleDelete(employee.id)} size="small">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  無符合條件的員工記錄
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Typography variant="body2" color="textSecondary">
          共 {totalItems} 筆紀錄
        </Typography>
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

      {/* 角色設置模態框 */}
      <Dialog open={roleModalOpen} onClose={() => setRoleModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: '#355891', color: 'white' }}>
          修改員工角色 - {selectedEmployee?.lastName}{selectedEmployee?.firstName} (ID: {selectedEmployee?.employeeCode || selectedEmployee?.id.substring(0, 5)})
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              當前角色: {availableRoles.find(r => r.id === selectedRole)?.name || '未設置'}
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              當前權限等級: {permissionLevel}
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                角色設定:
              </Typography>
              <FormControl fullWidth sx={{ mt: 1 }}>
                <InputLabel id="role-select-label">角色</InputLabel>
                <Select
                  labelId="role-select-label"
                  value={selectedRole}
                  onChange={handleRoleChange}
                  label="角色"
                >
                  {availableRoles.map(role => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                權限等級: (自動根據角色顯示，也可手動調整)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {[...Array(10)].map((_, i) => {
                  const btnColor = permissionLevelColorMap(i+1);
                  return (
                    <Button 
                      key={i}
                      variant={permissionLevel === i+1 ? "contained" : "outlined"}
                      color={btnColor}
                      onClick={() => handlePermissionLevelChange(i+1)}
                      sx={{ minWidth: 40 }}
                    >
                      {i+1}
                    </Button>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleModalOpen(false)} variant="outlined">
            取消
          </Button>
          <Button onClick={handleRoleConfirm} variant="contained" color="primary">
            確認修改
          </Button>
        </DialogActions>
      </Dialog>

      {/* 多店鋪分配模態框 */}
      <Dialog open={storeModalOpen} onClose={() => setStoreModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: '#355891', color: 'white' }}>
          員工多店鋪分配 - {selectedEmployee?.lastName}{selectedEmployee?.firstName} (ID: {selectedEmployee?.employeeCode || selectedEmployee?.id.substring(0, 5)})
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              主要店鋪: {selectedEmployee?.storeName || '未設置'}
            </Typography>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                額外分配店鋪:
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell>店鋪名稱</TableCell>
                      <TableCell>店鋪編號</TableCell>
                      <TableCell>分配狀態</TableCell>
                      <TableCell align="center">操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignedStores.length > 0 ? (
                      assignedStores.map(store => (
                        <TableRow key={store.id}>
                          <TableCell>{store.name}</TableCell>
                          <TableCell>{store.storeCode}</TableCell>
                          <TableCell>
                            <Chip label="已分配" color="success" size="small" />
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              onClick={() => handleRemoveStoreAssignment(store.id)}
                            >
                              移除
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          尚未分配額外店鋪
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                新增分配:
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs>
                  <FormControl fullWidth>
                    <InputLabel id="new-store-label">選擇店鋪</InputLabel>
                    <Select
                      labelId="new-store-label"
                      value={newStoreSelection}
                      onChange={(e) => setNewStoreSelection(e.target.value)}
                      label="選擇店鋪"
                    >
                      <MenuItem value="">請選擇店鋪</MenuItem>
                      {availableStores.map(store => (
                        <MenuItem key={store.id} value={store.id}>
                          {store.name} ({store.storeCode})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleAddStoreAssignment}
                    disabled={!newStoreSelection}
                  >
                    新增
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStoreModalOpen(false)} variant="outlined">
            關閉
          </Button>
          <Button onClick={handleStoreAssignmentConfirm} variant="contained" color="primary">
            保存變更
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeeList; 