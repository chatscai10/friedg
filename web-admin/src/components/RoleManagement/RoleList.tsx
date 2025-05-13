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
  IconButton,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Stack,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  SelectChangeEvent,
  Menu,
  ListItemIcon,
  ListItemText,
  styled
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  PersonAdd as PersonAddIcon,
  Security as SecurityIcon,
  Sort as SortIcon
} from '@mui/icons-material';
import { Role, RoleScope } from '../../types/role';
import { getRoles, GetRolesParams, deleteRole } from '../../services/roleService';
import { visuallyHidden } from '@mui/utils';

interface RoleListProps {
  onEdit: (roleId: string) => void;
  onAdd: () => void;
  onView: (roleId: string) => void;
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
type OrderBy = keyof Role | ''; // 根據實際可排序字段定義，'' 用於操作列等不可排序的列

// 角色列表組件
const RoleList: React.FC<RoleListProps> = ({ onEdit, onAdd, onView }) => {
  // 狀態管理
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionAnchorEl, setActionAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // 每頁顯示的記錄數
  const rowsPerPage = 10;

  // 角色範圍顯示映射
  const scopeDisplayMap: Record<RoleScope, { label: string; color: 'primary' | 'secondary' | 'default' | 'info' }> = {
    'global': { label: '全局', color: 'primary' },
    'tenant': { label: '租戶', color: 'secondary' },
    'store': { label: '店鋪', color: 'info' }
  };

  // 角色狀態顏色映射
  const roleStatusColors: Record<'active' | 'inactive' | 'deleted', 'success' | 'default' | 'error'> = {
    'active': 'success',
    'inactive': 'default',
    'deleted': 'error',
  };

  // 角色狀態文本映射
  const roleStatusText: Record<'active' | 'inactive' | 'deleted', string> = {
    'active': '激活',
    'inactive': '停用',
    'deleted': '已刪除',
  };

  // 獲取角色數據
  const fetchRoles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: GetRolesParams = {
        page,
        limit: rowsPerPage
      };

      if (searchQuery) {
        params.query = searchQuery;
      }

      if (scopeFilter) {
        params.scope = scopeFilter as RoleScope;
      }

      const response = await getRoles(params);
      setRoles(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.totalItems);
    } catch (err) {
      console.error('獲取角色列表失敗:', err);
      setError('獲取角色數據時發生錯誤，請稍後再試。');
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 頁面加載和依賴項更改時獲取數據
  useEffect(() => {
    fetchRoles();
  }, [page, scopeFilter]);

  // 處理搜索
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // 執行搜索
  const handleSearchSubmit = () => {
    setPage(1); // 重置頁碼
    fetchRoles();
  };

  // 按Enter鍵搜索
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  // 處理範圍篩選
  const handleScopeFilterChange = (event: SelectChangeEvent) => {
    setScopeFilter(event.target.value);
    setPage(1); // 重置頁碼
  };

  // 處理分頁
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  // 處理刷新
  const handleRefresh = () => {
    fetchRoles();
  };

  // 處理操作菜單開啟
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, roleId: string) => {
    setActionAnchorEl(event.currentTarget);
    setSelectedRoleId(roleId);
  };

  // 處理操作菜單關閉
  const handleMenuClose = () => {
    setActionAnchorEl(null);
    setSelectedRoleId(null);
  };

  // 處理查看角色
  const handleViewRole = () => {
    if (selectedRoleId) {
      onView(selectedRoleId);
    }
    handleMenuClose();
  };

  // 處理編輯角色
  const handleEditRole = () => {
    if (selectedRoleId) {
      onEdit(selectedRoleId);
    }
    handleMenuClose();
  };

  // 處理刪除角色
  const handleDeleteRole = async () => {
    if (selectedRoleId) {
      if (window.confirm('確定要刪除此角色嗎？此操作無法撤銷。')) {
        try {
          await deleteRole(selectedRoleId);
          fetchRoles(); // 重新加載角色列表
          alert('角色已成功刪除');
        } catch (error) {
          console.error('刪除角色失敗:', error);
          alert('刪除角色失敗，請稍後再試。');
        }
      }
    }
    handleMenuClose();
  };

  // 獲取權限等級顯示
  const getLevelDisplay = (level: number) => {
    if (level >= 8) return '高';
    if (level >= 5) return '中';
    return '基礎';
  };

  // 創建可排序的表格頭部單元格處理函數
  const createSortHandler = (property: OrderBy) => (event: React.MouseEvent<unknown>) => {
    // onRequestSort(property);
  };

  // 定義表格頭部
  const headCells: { id: OrderBy; label: string; disableSorting: boolean; align?: 'left' | 'right' | 'center'; }[] = [
    { id: 'roleId', label: '角色 ID', disableSorting: true },
    { id: 'roleName', label: '角色名稱', disableSorting: false },
    { id: 'description', label: '描述', disableSorting: true },
    { id: 'scope', label: '範圍', disableSorting: false },
    { id: 'roleLevel', label: '權限等級', disableSorting: false },
    { id: 'permissions', label: '權限數量', disableSorting: true, align: 'center' },
    { id: 'specialPermissions', label: '特殊權限', disableSorting: true, align: 'center' },
    { id: 'status', label: '狀態', disableSorting: false },
    { id: 'isSystemRole', label: '系統角色', disableSorting: false, align: 'center' },
    { id: 'createdAt', label: '創建時間', disableSorting: false },
    { id: 'updatedAt', label: '更新時間', disableSorting: false },
    { id: ' as OrderBy, label: '操作', disableSorting: true, align: 'center' },
  ];

  if (isLoading && roles.length === 0) {
    return <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
  }
  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }
  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          角色管理
        </Typography>
        {/* 前端 RBAC 考量：根據 canCreateRole 控制此按鈕的顯示 */}
        {/* {canCreateRole && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={onAdd}
            sx={{ borderRadius: '4px' }}
          >
            新增角色
          </Button>
        )} */}
      </Box>
      <Divider sx={{ mb: 3 }} />

      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          variant="outlined"
          size="small"
          placeholder="搜尋角色..."
          value={searchQuery}
          onChange={handleSearchChange}
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
          <InputLabel id="scope-filter-label">角色範圍</InputLabel>
          <Select
            labelId="scope-filter-label"
            value={scopeFilter}
            onChange={handleScopeFilterChange}
            label="角色範圍"
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="global">全局</MenuItem>
            <MenuItem value="tenant">租戶</MenuItem>
            <MenuItem value="store">店鋪</MenuItem>
          </Select>
        </FormControl>

        <IconButton onClick={handleRefresh} color="primary" title="刷新數據">
          <SecurityIcon />
        </IconButton>
      </Box>

      <TableContainer component={Paper} sx={{ position: 'relative' }}>
        {isLoading && roles.length > 0 && (
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
        <Table sx={{ minWidth: 650 }} aria-label="role table">
          <TableHead>
            <TableRow>
              {headCells.map((headCell) => (
                <StyledTableCell
                  key={headCell.id}
                  align={headCell.align || 'left'}
                  padding='normal'
                  sortDirection={searchQuery === headCell.id ? 'asc' : false}
                >
                  {!headCell.disableSorting ? (
                    <TableSortLabel
                      active={searchQuery === headCell.id}
                      direction={searchQuery === headCell.id ? 'asc' : 'asc'}
                      onClick={createSortHandler(headCell.id as OrderBy)}
                    >
                      {headCell.label}
                      {searchQuery === headCell.id && (
                        <Box component="span" sx={visuallyHidden}>
                          {'sorted ascending'}
                        </Box>
                      )}
                    </TableSortLabel>
                  ) : (
                    headCell.label
                  )}
                </StyledTableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.length === 0 && !isLoading ? (
              <StyledTableRow>
                <TableCell colSpan={headCells.length} align="center">
                  <Typography variant="body2">沒有找到角色數據。</Typography>
                </TableCell>
              </StyledTableRow>
            ) : (
              roles.map((role) => (
                <StyledTableRow
                  key={role.id}
                >
                  <TableCell>{role.id.substring(0, 8)}...</TableCell>
                  <TableCell>
                    <Box sx={{ fontWeight: 'bold', cursor: 'pointer' }} onClick={() => onView(role.id)}>
                      {role.name}
                    </Box>
                  </TableCell>
                  <TableCell>{role.description || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={scopeDisplayMap[role.scope]?.label || role.scope}
                      color={scopeDisplayMap[role.scope]?.color || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Chip
                        label={getLevelDisplay(role.level)}
                        color={role.level >= 8 ? 'error' : role.level >= 5 ? 'warning' : 'success'}
                        size="small"
                      />
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        ({role.level})
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">{role.permissions.length}</TableCell>
                  <TableCell align="center">{role.specialPermissions ? <Chip label="是" color="primary" size="small" /> : <Chip label="否" size="small" />}</TableCell>
                  <TableCell>
                    <Chip
                      label={roleStatusText[role.status] || role.status}
                      color={roleStatusColors[role.status] || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">{role.isSystemRole ? <Chip label="是" color="info" size="small" /> : <Chip label="否" size="small" />}</TableCell>
                  <TableCell>{role.createdAt ? new Date(role.createdAt).toLocaleString() : '-'}</TableCell>
                  <TableCell>{role.updatedAt ? new Date(role.updatedAt).toLocaleString() : '-'}</TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      {/* 前端 RBAC 考量：根據 canEditRole 控制編輯按鈕的顯示/啟用狀態，系統角色可能不允許編輯 */}
                      {/* {canEditRole && !role.isSystemRole && (
                        <IconButton size="small" onClick={() => onEdit(role.id)} color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )} */}
                      {/* 前端 RBAC 考量：根據 canDeleteRole 控制刪除按鈕的顯示/啟用狀態，系統角色不允許刪除 */}
                      {/* {canDeleteRole && !role.isSystemRole && (
                        <IconButton size="small" onClick={() => onDelete(role.id)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )} */}
                    </Stack>
                  </TableCell>
                </StyledTableRow>
              ))
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

      {/* 操作菜單 */}
      <Menu
        anchorEl={actionAnchorEl}
        open={Boolean(actionAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewRole}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          <ListItemText>查看詳情</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEditRole}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>編輯</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteRole}>
          <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>刪除</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>分配用戶</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default RoleList; 