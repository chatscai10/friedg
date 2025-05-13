import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  Button, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Typography,
  Box,
  IconButton,
  Chip,
  Alert,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  SelectChangeEvent
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import LoadingState from '../components/common/LoadingState';
import Pagination from '../components/common/Pagination';
import { RootState } from '../store';
import { fetchRoles, deleteRole, setCurrentPage, setPageSize } from '../store/roleSlice';
import { Role } from '../types/role';

/**
 * 角色管理頁面 - 主路由組件
 * 整合角色列表視圖和角色表單模態框
 */
const RolesPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { roles, loading, error, deleteLoading, deleteError, pagination } = useSelector((state: RootState) => state.roles);

  // 篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // 分頁控制
  const handlePageChange = (newPage: number) => {
    dispatch(setCurrentPage(newPage));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    dispatch(setPageSize(newPageSize));
  };

  // 刪除對話框狀態
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{ id: string; name: string } | null>(null);

  // 加載角色列表
  useEffect(() => {
    dispatch(fetchRoles({
      page: pagination.currentPage,
      limit: pagination.pageSize,
      scope: scopeFilter || undefined,
      search: searchTerm || undefined
    }) as any);
  }, [dispatch, pagination.currentPage, pagination.pageSize, scopeFilter, searchTerm]);

  // 如果刪除成功後重新加載角色列表
  useEffect(() => {
    if (deleteDialogOpen && !deleteLoading && !deleteError && !roleToDelete) {
      setDeleteDialogOpen(false);
      dispatch(fetchRoles({
        page: pagination.currentPage,
        limit: pagination.pageSize,
        scope: scopeFilter || undefined,
        search: searchTerm || undefined
      }) as any);
    }
  }, [deleteLoading, deleteError, roleToDelete, deleteDialogOpen, dispatch, pagination.currentPage, pagination.pageSize, scopeFilter, searchTerm]);

  const handleAddRole = () => {
    navigate('/roles/create');
  };

  const handleEditRole = (roleId: string) => {
    navigate(`/roles/edit/${roleId}`);
  };

  // 打開刪除確認對話框
  const handleDeleteClick = (role: Role) => {
    setRoleToDelete({ id: role.roleId, name: role.roleName });
    setDeleteDialogOpen(true);
  };

  // 關閉刪除確認對話框
  const handleCloseDeleteDialog = () => {
    if (!deleteLoading) {
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  // 確認刪除角色
  const handleConfirmDelete = () => {
    if (roleToDelete) {
      dispatch(deleteRole(roleToDelete.id) as any)
        .then((result: any) => {
          if (!result.error) {
            setRoleToDelete(null);
          }
        });
    }
  };

  // 處理搜索
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    dispatch(setCurrentPage(1)); // 重置到第一頁
  };

  // 處理搜索提交
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(fetchRoles({
      page: 1,
      limit: pagination.pageSize,
      scope: scopeFilter || undefined,
      search: searchTerm || undefined
    }) as any);
  };

  // 處理範圍篩選
  const handleScopeChange = (e: SelectChangeEvent<string>) => {
    setScopeFilter(e.target.value);
    dispatch(setCurrentPage(1)); // 重置到第一頁
    
    // 立即使用新篩選條件請求資料
    dispatch(fetchRoles({
      page: 1,
      limit: pagination.pageSize,
      scope: e.target.value || undefined,
      search: searchTerm || undefined
    }) as any);
  };

  // 處理狀態篩選
  const handleStatusChange = (e: SelectChangeEvent<string>) => {
    setStatusFilter(e.target.value);
    dispatch(setCurrentPage(1)); // 重置到第一頁
    
    // 注意：後端API可能還不支持按狀態篩選，這裡先使用前端篩選
  };

  // 清除所有篩選器
  const handleClearFilters = () => {
    setSearchTerm('');
    setScopeFilter('');
    setStatusFilter('');
    dispatch(setCurrentPage(1));
    
    // 使用清除後的篩選條件請求資料
    dispatch(fetchRoles({
      page: 1,
      limit: pagination.pageSize
    }) as any);
  };

  // 獲取角色範圍標籤顏色
  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'global':
        return 'primary';
      case 'tenant':
        return 'secondary';
      default:
        return 'default';
    }
  };

  // 渲染系統角色標記
  const renderSystemRoleBadge = (isSystemRole: boolean) => {
    if (isSystemRole) {
      return <Chip size="small" label="系統角色" color="info" sx={{ ml: 1 }} />;
    }
    return null;
  };

  // 過濾角色列表（前端篩選方式）
  const filteredRoles = statusFilter 
    ? roles.filter(role => 
        (statusFilter === 'active' && role.isActive) || 
        (statusFilter === 'inactive' && !role.isActive)
      )
    : roles;

  if (loading && roles.length === 0) {
    return <LoadingState />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">角色管理</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={handleAddRole}
        >
          新增角色
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {deleteError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          刪除角色失敗: {deleteError}
        </Alert>
      )}

      {/* 篩選工具欄 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <form onSubmit={handleSearchSubmit}>
              <TextField
                fullWidth
                placeholder="搜索角色名稱或描述"
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
            </form>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="scope-filter-label">角色範圍</InputLabel>
              <Select
                labelId="scope-filter-label"
                value={scopeFilter}
                label="角色範圍"
                onChange={handleScopeChange}
              >
                <MenuItem value="">全部範圍</MenuItem>
                <MenuItem value="global">全局</MenuItem>
                <MenuItem value="tenant">租戶</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-filter-label">狀態</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                label="狀態"
                onChange={handleStatusChange}
              >
                <MenuItem value="">全部狀態</MenuItem>
                <MenuItem value="active">啟用</MenuItem>
                <MenuItem value="inactive">停用</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={handleClearFilters}
              fullWidth
            >
              清除篩選
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {filteredRoles.length === 0 && !loading ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            無符合條件的角色資料。
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>角色名稱</TableCell>
                  <TableCell>描述</TableCell>
                  <TableCell>範圍</TableCell>
                  <TableCell>權限等級</TableCell>
                  <TableCell>狀態</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress size={40} />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoles.map((role: Role) => (
                    <TableRow key={role.roleId}>
                      <TableCell>
                        {role.roleName}
                        {renderSystemRoleBadge(role.isSystemRole)}
                      </TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell>
                        <Chip 
                          label={role.scope === 'global' ? '全局' : '租戶'} 
                          color={getScopeColor(role.scope) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{role.roleLevel}</TableCell>
                      <TableCell>
                        <Chip 
                          label={role.isActive ? '啟用' : '停用'} 
                          color={role.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="編輯">
                          <IconButton 
                            onClick={() => handleEditRole(role.roleId)}
                            disabled={role.isSystemRole}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="刪除">
                          <IconButton 
                            onClick={() => handleDeleteClick(role)}
                            disabled={role.isSystemRole}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 分頁控制 */}
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}

      {/* 刪除確認對話框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          確認刪除角色
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            您確定要刪除角色 "{roleToDelete?.name}" 嗎？此操作無法撤銷。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteDialog} 
            disabled={deleteLoading}
          >
            取消
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            variant="contained"
            disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={20} color="inherit" /> : null}
            autoFocus
          >
            {deleteLoading ? '刪除中...' : '確認刪除'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default RolesPage; 