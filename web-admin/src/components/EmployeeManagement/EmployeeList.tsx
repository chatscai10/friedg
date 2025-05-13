import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
  Divider,
  TableSortLabel,
  TablePagination,
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
import { visuallyHidden } from '@mui/utils';

import { Employee, EmployeeStatus } from '../../types/employee';
import { getEmployees } from '../../services/employeeService';
import { RootState } from '../store';
import { fetchEmployees, setPagination } from '../store/employeeSlice';
import { Role } from '../types/role';
import { Store } from '../types/store';
import { WorkspaceRoles, WorkspaceStores } from '../services/roleService';

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

// 自定義表格頭部單元格樣式
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: theme.palette.grey[200],
  fontWeight: 'bold',
}));

// 自定義表格行樣式 (斑馬紋)
const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:last-child td, &:last-child th': {
    border: 0,
  },
}));

// 定義排序鍵的類型
type Order = 'asc' | 'desc';
type OrderBy = keyof Employee | 'roleName' | 'storeNames'; // 假設可以按這些字段排序

const EmployeeList: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // 從 Redux store 獲取員工列表狀態
  const { employees, loading, error, pagination } = useSelector((state: RootState) => state.employees);

  // 篩選狀態
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<EmploymentType | ''>('');
  const [positionFilter, setPositionFilter] = useState<EmployeePosition | ''>('');
  const [roleFilterId, setRoleFilterId] = useState<string | ''>('');
  const [storeFilterId, setStoreFilterId] = useState<string | ''>('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | ''>(''); // 添加狀態篩選

  // 排序狀態
  const [orderBy, setOrderBy] = useState<OrderBy>('employmentInfo.hireDate'); // 默認按入職日期排序
  const [order, setOrder] = useState<Order>('desc'); // 默認倒序

  // 下拉選單數據狀態
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [dropdownsLoading, setDropdownsLoading] = useState<boolean>(true);
  const [dropdownsError, setDropdownsError] = useState<string | null>(null);

  // 每頁顯示的記錄數 (從 Redux 獲取或在這裡定義)
  const rowsPerPage = pagination.pageSize; // 使用 Redux 中的 pageSize
  const page = pagination.currentPage; // 使用 Redux 中的 currentPage
  const totalItems = pagination.totalItems; // 使用 Redux 中的 totalItems

  // 獲取下拉選單數據 (角色和店鋪)
  useEffect(() => {
    const loadDropdownData = async () => {
      setDropdownsLoading(true);
      setDropdownsError(null);
      try {
        // 獲取角色列表 (假設 WorkspaceRoles 返回所有工作區角色)
        const rolesData = await WorkspaceRoles();
        setAllRoles(rolesData);

        // 獲取店鋪列表 (假設 WorkspaceStores 返回所有工作區店鋪)
        const storesData = await WorkspaceStores();
        setAllStores(storesData);

      } catch (err: any) {
        console.error('Failed to load dropdown data:', err);
        setDropdownsError('無法加載篩選選項數據。');
      } finally {
        setDropdownsLoading(false);
      }
    };

    loadDropdownData();
  }, []); // 只在組件掛載時加載一次

  // 獲取員工列表數據
  const handleFetchEmployees = useMemo(() => {
    return (currentPage: number, pageSize: number) => {
      dispatch(fetchEmployees({
        page: currentPage,
        limit: pageSize,
        query: searchTerm || undefined,
        employmentType: employmentTypeFilter || undefined,
        position: positionFilter || undefined,
        roleId: roleFilterId || undefined,
        storeId: storeFilterId || undefined,
        status: statusFilter || undefined, // 添加狀態篩選參數
        orderBy: orderBy,
        order: order,
      }) as any); // 使用 as any 因為 dispatch 的類型可能不精確到 thunk 返回值
    };
  }, [dispatch, searchTerm, employmentTypeFilter, positionFilter, roleFilterId, storeFilterId, statusFilter, orderBy, order]);

  // 在分頁、排序、篩選狀態改變時重新獲取員工數據
  useEffect(() => {
    handleFetchEmployees(page, rowsPerPage);
  }, [page, rowsPerPage, handleFetchEmployees]); // 添加 handleFetchEmployees 作為依賴以確保篩選/排序變化觸發數據刷新

  // 處理分頁變化
  const handleChangePage = (event: unknown, newPage: number) => {
    dispatch(setPagination({ currentPage: newPage + 1, pageSize: rowsPerPage, totalItems: totalItems, totalPages: pagination.totalPages })); // MUI Pagination 是從 0 開始，所以需要 +1
  };

  // 處理每頁顯示數量變化
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPagination({ currentPage: 1, pageSize: parseInt(event.target.value, 10), totalItems: totalItems, totalPages: pagination.totalPages })); // 重置到第一頁
  };

  // 處理排序變化
  const handleRequestSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
    dispatch(setPagination({ currentPage: 1, pageSize: rowsPerPage, totalItems: totalItems, totalPages: pagination.totalPages })); // 排序時重置到第一頁
  };

  // 創建可排序的表格頭部單元格
  const createSortHandler = (property: OrderBy) => (event: React.MouseEvent<unknown>) => {
    handleRequestSort(property);
  };

  // 處理搜索輸入變化
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    // 可以選擇在這裡觸發搜索或等待用戶點擊搜索按鈕/按下回車
  };

  // 執行搜索 (當點擊搜索按鈕或回車時)
  const handlePerformSearch = () => {
    dispatch(setPagination({ currentPage: 1, pageSize: rowsPerPage, totalItems: totalItems, totalPages: pagination.totalPages })); // 重置到第一頁並觸發 useEffect 重新獲取數據
  };

  // 處理下拉篩選變化
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<any>>) => (event: SelectChangeEvent<any>) => {
    setter(event.target.value);
    dispatch(setPagination({ currentPage: 1, pageSize: rowsPerPage, totalItems: totalItems, totalPages: pagination.totalPages })); // 重置到第一頁並觸發 useEffect 重新獲取數據
  };

  // 獲取角色名稱
  const getRoleName = (roleId: string | undefined | null): string => {
    if (!roleId) return '未分配角色';
    const role = allRoles.find(r => r.roleId === roleId);
    return role ? role.roleName : '未知角色';
  };

  // 獲取店鋪名稱列表
  const getStoreNames = (storeIds: string[] | undefined | null): string => {
    if (!storeIds || storeIds.length === 0) return '未分配店鋪';
    const names = storeIds.map(storeId => {
      const store = allStores.find(s => s.storeId === storeId);
      return store ? store.storeName : '未知店鋪';
    }).filter(name => name !== '未知店鋪'); // 過濾掉未找到名稱的店鋪
    return names.length > 0 ? names.join(', ') : '未知店鋪';
  };

  // 處理新增員工 (前端 RBAC 考量：這個按鈕的顯示/隱藏需要根據用戶權限判斷)
  const handleAddEmployee = () => {
    // 導航到新增員工頁面或彈出 Modal
    navigate('/employees/create');
  };

  // 處理編輯員工 (前端 RBAC 考量：這個按鈕/菜單項的顯示/隱藏或禁用需要根據用戶權限判斷)
  const handleEditEmployee = (employeeId: string) => {
    // 導航到編輯員工頁面或彈出 Modal
    navigate(`/employees/edit/${employeeId}`);
  };

  // 處理刪除員工 (前端 RBAC 考量：這個按鈕/菜單項的顯示/隱藏或禁用需要根據用戶權限判斷)
  const handleDeleteEmployee = async (employeeId: string) => {
    if (window.confirm('確定要刪除此員工嗎？此操作無法撤銷。')) {
      // 調用刪除 API (假設 deleteEmployee 服務函數存在且已實現邏輯刪除)
      // await deleteEmployee(employeeId); // 需要從 service 層引入
      // 重新加載員工列表
      handleFetchEmployees(page, rowsPerPage);
    }
  };

  const employeeStatusColors: Record<EmployeeStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
    active: 'success',
    inactive: 'default',
    on_leave: 'warning',
    terminated: 'error',
    deleted: 'default', // 邏輯刪除的狀態
  };

  const employeeStatusText: Record<EmployeeStatus, string> = {
    active: '在職',
    inactive: '停用',
    on_leave: '請假',
    terminated: '已離職',
    deleted: '已刪除',
  };

  if (loading && employees.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>;
  }

  // 定義表格頭部
  const headCells: { id: OrderBy; label: string; disableSorting: boolean; align?: 'left' | 'right' | 'center'; }[] = [
    { id: 'employeeId', label: '員工 ID', disableSorting: true }, // ID 通常不排序
    { id: 'name', label: '姓名', disableSorting: false },
    { id: 'contact.email', label: '郵箱', disableSorting: true }, // 嵌套字段前端難以通用排序，除非後端支持
    { id: 'contact.phone', label: '電話', disableSorting: true },
    { id: 'employmentInfo.roleId', label: '角色', disableSorting: false }, // 按 roleId 排序，後端返回時可以考慮包含 roleName 字段便於前端顯示和可能的排序
    { id: 'employmentInfo.employmentType', label: '僱傭類型', disableSorting: false },
    { id: 'employmentInfo.position', label: '職位', disableSorting: false },
    { id: 'employmentInfo.hireDate', label: '入職日期', disableSorting: false },
    { id: 'assignedStores', label: '分配店鋪', disableSorting: true }, // 多值字段前端難以通用排序
    { id: 'status', label: '狀態', disableSorting: false }, // 直接按 status 字符串排序
    { id: 'createdAt', label: '創建時間', disableSorting: false },
    { id: 'updatedAt', label: '更新時間', disableSorting: false },
    { id: '' as OrderBy, label: '操作', disableSorting: true, align: 'center' }, // 操作列
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">員工管理</Typography>
        {/* 前端 RBAC 考量：根據用戶權限控制此按鈕的顯示 */}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddEmployee}
        >
          新增員工
        </Button>
      </Box>

      {dropdownsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}><CircularProgress size={20} /></Box>
      ) : dropdownsError ? (
        <Alert severity="error" sx={{ mb: 2 }}>{dropdownsError}</Alert>
      ) : null}

      {/* 篩選工具欄 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* 搜索框 */}
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="搜索姓名、郵箱、電話..."
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyPress={(e) => { if (e.key === 'Enter') handlePerformSearch(); }}
              InputProps={{
                startAdornment: (
                  <SearchIcon color="action" sx={{ mr: 1 }} />
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button variant="outlined" size="small" onClick={handlePerformSearch} startIcon={<SearchIcon />}>搜索</Button>
          </Grid>

          {/* 僱傭類型篩選 */}
          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>僱傭類型</InputLabel>
              <Select
                value={employmentTypeFilter}
                label="僱傭類型"
                onChange={handleFilterChange(setEmploymentTypeFilter)}
              >
                <MenuItem value="">全部類型</MenuItem>
                {Object.values(EmploymentType).map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem> // 假設 EmploymentType 是 string enum 或聯合類型
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 職位篩選 */}
          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>職位</InputLabel>
              <Select
                value={positionFilter}
                label="職位"
                onChange={handleFilterChange(setPositionFilter)}
              >
                <MenuItem value="">全部職位</MenuItem>
                {Object.values(EmployeePosition).map(position => (
                  <MenuItem key={position} value={position}>{position}</MenuItem> // 假設 EmployeePosition 是 string enum 或聯合類型
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 角色篩選 */}
          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth size="small" disabled={dropdownsLoading}>
              <InputLabel>角色</InputLabel>
              <Select
                value={roleFilterId}
                label="角色"
                onChange={handleFilterChange(setRoleFilterId)}
              >
                <MenuItem value="">全部角色</MenuItem>
                {allRoles.map(role => (
                  <MenuItem key={role.roleId} value={role.roleId}>{role.roleName}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 店鋪篩選 */}
          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth size="small" disabled={dropdownsLoading}>
              <InputLabel>店鋪</InputLabel>
              <Select
                value={storeFilterId}
                label="店鋪"
                onChange={handleFilterChange(setStoreFilterId)}
              >
                <MenuItem value="">全部店鋪</MenuItem>
                {allStores.map(store => (
                  <MenuItem key={store.storeId} value={store.storeId}>{store.storeName}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* 狀態篩選 */}
          <Grid item xs={12} sm={4} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>狀態</InputLabel>
              <Select
                value={statusFilter}
                label="狀態"
                onChange={handleFilterChange(setStatusFilter)}
              >
                <MenuItem value="">全部狀態</MenuItem>
                {Object.values(EmployeeStatus).map(status => (
                  <MenuItem key={status} value={status}>{employeeStatusText[status]}</MenuItem> // 使用映射顯示中文狀態
                ))}
              </Select>
            </FormControl>
          </Grid>

        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="employee table">
          <TableHead>
            <TableRow>
              {headCells.map((headCell) => (
                <StyledTableCell
                  key={headCell.id}
                  align={headCell.align || 'left'}
                  padding='normal'
                  sortDirection={orderBy === headCell.id ? order : false}
                >
                  {!headCell.disableSorting ? (
                    <TableSortLabel
                      active={orderBy === headCell.id}
                      direction={orderBy === headCell.id ? order : 'asc'}
                      onClick={createSortHandler(headCell.id)}
                    >
                      {headCell.label}
                      {orderBy === headCell.id ? (
                        <Box component="span" sx={visuallyHidden}>
                          {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                        </Box>
                      ) : null}
                    </TableSortLabel>
                  ) : (
                    headCell.label
                  )}
                </StyledTableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && employees.length === 0 ? (
              <StyledTableRow>
                <TableCell colSpan={headCells.length} align="center">
                  <CircularProgress size={20} />
                  <Typography variant="body2" sx={{ mt: 1 }}>載入中...</Typography>
                </TableCell>
              </StyledTableRow>
            ) : employees.length === 0 ? (
              <StyledTableRow>
                <TableCell colSpan={headCells.length} align="center">
                  <Typography variant="body2">沒有找到員工數據。</Typography>
                </TableCell>
              </StyledTableRow>
            ) : (
              employees.map((employee) => (
                <StyledTableRow
                  key={employee.employeeId}
                  // 可以添加 hover 效果或其他樣式
                >
                  <TableCell>{employee.employeeId}</TableCell>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.contact?.email || '-'}</TableCell>
                  <TableCell>{employee.contact?.phone || '-'}</TableCell>
                  <TableCell>{getRoleName(employee.employmentInfo?.roleId)}</TableCell>{/* 顯示角色名稱 */}
                  <TableCell>{employee.employmentInfo?.employmentType || '-'}</TableCell>
                  <TableCell>{employee.employmentInfo?.position || '-'}</TableCell>
                  <TableCell>{employee.employmentInfo?.hireDate ? new Date(employee.employmentInfo.hireDate).toLocaleDateString() : '-'}</TableCell>{/* 格式化日期 */}
                  <TableCell>
                    <Tooltip title={getStoreNames(employee.assignedStores)} arrow>
                      {/* 在列表中簡略顯示店鋪數量或前幾個名稱 */}
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getStoreNames(employee.assignedStores)}
                      </Typography>
                    </Tooltip>
                  </TableCell>{/* 顯示分配店鋪名稱列表 */}
                  <TableCell>
                    <Chip
                      label={employeeStatusText[employee.status] || employee.status}
                      color={employeeStatusColors[employee.status] || 'default'}
                      size="small"
                    />
                  </TableCell>{/* 顯示狀態 */}
                  <TableCell>{employee.createdAt ? new Date(employee.createdAt).toLocaleString() : '-'}</TableCell>{/* 格式化日期時間 */}
                  <TableCell>{employee.updatedAt ? new Date(employee.updatedAt).toLocaleString() : '-'}</TableCell>{/* 格式化日期時間 */}
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      {/* 前端 RBAC 考量：根據用戶權限控制編輯按鈕的顯示 */}
                      <IconButton size="small" onClick={() => handleEditEmployee(employee.employeeId)} color="primary">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      {/* 前端 RBAC 考量：根據用戶權限控制刪除按鈕的顯示 */}
                      <IconButton size="small" onClick={() => handleDeleteEmployee(employee.employeeId)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </StyledTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 分頁控制 */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={totalItems}
        rowsPerPage={rowsPerPage}
        page={page - 1} // MUI Pagination 是從 0 開始
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="每頁行數:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count} 項`}
      />
    </Box>
  );
};

export default EmployeeList; 