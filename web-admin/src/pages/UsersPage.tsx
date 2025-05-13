import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormGroup,
  FormControlLabel,
  Checkbox,
  DialogContentText,
  Select,
  MenuItem,
  InputLabel,
  SelectChangeEvent,
  TextField,
  InputAdornment,
  Grid
} from '@mui/material';
import { useSnackbar } from 'notistack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SecurityIcon from '@mui/icons-material/Security';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import LoadingState from '../components/common/LoadingState';
import Pagination from '../components/common/Pagination';
import UserCreateForm from '../components/UserManagement/UserCreateForm';
import UserEditForm from '../components/UserManagement/UserEditForm';
import { RootState } from '../store';
import { fetchUsers, updateUserRoles, updateUserStatus, createUser, updateUser, setCurrentPage, setPageSize } from '../store/userSlice';
import { fetchWorkspaceRoles } from '../store/roleSlice';
import { User, UserStatus, UpdateUserRolesPayload, UpdateUserStatusPayload, CreateUserPayload, UpdateUserPayload } from '../types/user.types';
import { Role } from '../types/role';

/**
 * 用戶管理頁面 - 主路由組件
 * 顯示用戶列表，提供角色分配和狀態管理功能
 */
const UsersPage: React.FC = () => {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { users, loading, error, rolesUpdateLoading, statusUpdateLoading, saveLoading, saveError, pagination } = useSelector((state: RootState) => state.users);
  const { roles } = useSelector((state: RootState) => state.roles);
  const { currentUser } = useSelector((state: RootState) => state.auth);
  
  // 篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  
  // 分頁控制
  const handlePageChange = (newPage: number) => {
    dispatch(setCurrentPage(newPage));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    dispatch(setPageSize(newPageSize));
  };
  
  // 角色編輯對話框狀態
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roleDialogError, setRoleDialogError] = useState<string | null>(null);

  // 狀態編輯對話框狀態
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editingUserStatus, setEditingUserStatus] = useState<User | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<UserStatus>('active');
  const [statusDialogError, setStatusDialogError] = useState<string | null>(null);
  
  // 新增用戶對話框狀態
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // 編輯用戶基本資料對話框狀態
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUserData, setEditingUserData] = useState<User | null>(null);

  // 加載用戶列表
  useEffect(() => {
    dispatch(fetchUsers({
      page: pagination.currentPage,
      limit: pagination.pageSize,
      status: statusFilter || undefined,
      search: searchTerm || undefined
    }) as any);
  }, [dispatch, pagination.currentPage, pagination.pageSize, statusFilter, searchTerm]);

  // 加載角色列表（為角色編輯對話框準備數據）
  useEffect(() => {
    dispatch(fetchWorkspaceRoles());
  }, [dispatch]);

  // 獲取用戶狀態標籤顏色
  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'suspended':
        return 'error';
      default:
        return 'default';
    }
  };

  // 渲染用戶狀態標籤
  const renderUserStatus = (status: UserStatus) => {
    const statusLabels: Record<UserStatus, string> = {
      active: '啟用',
      inactive: '停用',
      suspended: '已暫停'
    };
    
    return (
      <Chip 
        label={statusLabels[status] || status} 
        color={getStatusColor(status) as any}
        size="small"
      />
    );
  };
  
  // 渲染系統用戶標記
  const renderSystemUserBadge = (isSystemUser: boolean | undefined) => {
    if (isSystemUser) {
      return <Chip size="small" label="系統用戶" color="info" sx={{ ml: 1 }} />;
    }
    return null;
  };

  // 渲染角色列表
  const renderRoles = (roleNames?: string[]) => {
    if (!roleNames || roleNames.length === 0) {
      return <Typography variant="body2" color="text.secondary">無角色</Typography>;
    }
    
    return roleNames.map((roleName, index) => (
      <Chip 
        key={index} 
        label={roleName} 
        size="small" 
        sx={{ mr: 0.5, mb: 0.5 }} 
      />
    ));
  };

  // 處理搜索
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    dispatch(setCurrentPage(1)); // 重置到第一頁
  };

  // 處理搜索提交
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(fetchUsers({
      page: 1,
      limit: pagination.pageSize,
      status: statusFilter || undefined,
      search: searchTerm || undefined
    }) as any);
  };

  // 處理角色篩選
  const handleRoleFilterChange = (e: SelectChangeEvent<string>) => {
    setRoleFilter(e.target.value);
    dispatch(setCurrentPage(1)); // 重置到第一頁
    
    // 注意：後端API可能不支持按角色ID篩選，先使用前端篩選
  };

  // 處理狀態篩選
  const handleStatusFilterChange = (e: SelectChangeEvent<string>) => {
    setStatusFilter(e.target.value);
    dispatch(setCurrentPage(1)); // 重置到第一頁
    
    // 立即使用新篩選條件請求資料
    dispatch(fetchUsers({
      page: 1,
      limit: pagination.pageSize,
      status: e.target.value || undefined,
      search: searchTerm || undefined
    }) as any);
  };

  // 清除所有篩選器
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setRoleFilter('');
    dispatch(setCurrentPage(1));
    
    // 使用清除後的篩選條件請求資料
    dispatch(fetchUsers({
      page: 1,
      limit: pagination.pageSize
    }) as any);
  };

  // 打開角色編輯對話框
  const handleEditRoles = (user: User) => {
    setEditingUser(user);
    setSelectedRoles(user.roles || []);
    setRoleDialogOpen(true);
    setRoleDialogError(null);
  };

  // 關閉角色編輯對話框
  const handleCloseRoleDialog = () => {
    if (!rolesUpdateLoading) {
      setRoleDialogOpen(false);
      setEditingUser(null);
      setSelectedRoles([]);
      setRoleDialogError(null);
    }
  };

  // 處理角色選擇變更
  const handleRoleCheckboxChange = (roleId: string, checked: boolean) => {
    if (checked) {
      setSelectedRoles(prev => [...prev, roleId]);
    } else {
      setSelectedRoles(prev => prev.filter(id => id !== roleId));
    }
  };

  // 確認更新用戶角色
  const handleConfirmUpdateRoles = () => {
    if (editingUser && selectedRoles) {
      // 檢查是否至少選擇了一個角色
      if (selectedRoles.length === 0) {
        setRoleDialogError('請至少選擇一個角色');
        return;
      }

      const roleData: UpdateUserRolesPayload = {
        roles: selectedRoles
      };

      dispatch(updateUserRoles({ userId: editingUser.userId, roleData }) as any)
        .then((result: any) => {
          if (!result.error) {
            handleCloseRoleDialog();
            enqueueSnackbar('用戶角色更新成功', { variant: 'success' });
            
            // 如果使用了角色篩選，可能需要重新加載用戶列表
            if (roleFilter) {
              dispatch(fetchUsers({
                page: pagination.currentPage,
                limit: pagination.pageSize,
                status: statusFilter || undefined,
                search: searchTerm || undefined
              }) as any);
            }
          } else {
            setRoleDialogError(result.payload);
            enqueueSnackbar('用戶角色更新失敗', { variant: 'error' });
          }
        });
    }
  };

  // 打開狀態編輯對話框
  const handleEditStatus = (user: User) => {
    setEditingUserStatus(user);
    setSelectedStatus(user.status);
    setStatusDialogOpen(true);
    setStatusDialogError(null);
  };

  // 關閉狀態編輯對話框
  const handleCloseStatusDialog = () => {
    if (!statusUpdateLoading) {
      setStatusDialogOpen(false);
      setEditingUserStatus(null);
      setStatusDialogError(null);
    }
  };

  // 處理狀態選擇變更
  const handleStatusChange = (event: SelectChangeEvent<string>) => {
    setSelectedStatus(event.target.value as UserStatus);
  };

  // 確認更新用戶狀態
  const handleConfirmUpdateStatus = () => {
    if (editingUserStatus && selectedStatus) {
      // 檢查是否選擇了與當前相同的狀態
      if (selectedStatus === editingUserStatus.status) {
        setStatusDialogError('請選擇不同的狀態');
        return;
      }

      const statusData: UpdateUserStatusPayload = {
        status: selectedStatus
      };

      dispatch(updateUserStatus({ userId: editingUserStatus.userId, statusData }) as any)
        .then((result: any) => {
          if (!result.error) {
            handleCloseStatusDialog();
            enqueueSnackbar('用戶狀態更新成功', { variant: 'success' });
            
            // 如果使用了狀態篩選，需要重新加載用戶列表
            if (statusFilter) {
              dispatch(fetchUsers({
                page: pagination.currentPage,
                limit: pagination.pageSize,
                status: statusFilter || undefined,
                search: searchTerm || undefined
              }) as any);
            }
          } else {
            setStatusDialogError(result.payload);
            enqueueSnackbar('用戶狀態更新失敗', { variant: 'error' });
          }
        });
    }
  };
  
  // 打開新增用戶對話框
  const handleOpenCreateDialog = () => {
    setCreateDialogOpen(true);
  };
  
  // 關閉新增用戶對話框
  const handleCloseCreateDialog = () => {
    if (!saveLoading) {
      setCreateDialogOpen(false);
    }
  };
  
  // 處理創建用戶
  const handleCreateUser = async (payload: CreateUserPayload) => {
    try {
      const resultAction = await dispatch(createUser(payload) as any);
      if (!resultAction.error) {
        enqueueSnackbar('用戶創建成功', { variant: 'success' });
        handleCloseCreateDialog();
        
        // 重新加載用戶列表以確保新用戶顯示
        dispatch(fetchUsers({
          page: pagination.currentPage,
          limit: pagination.pageSize,
          status: statusFilter || undefined,
          search: searchTerm || undefined
        }) as any);
      } else {
        enqueueSnackbar(`用戶創建失敗: ${resultAction.payload}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('用戶創建失敗', { variant: 'error' });
    }
  };
  
  // 打開編輯用戶基本資料對話框
  const handleEditUser = (user: User) => {
    setEditingUserData(user);
    setEditDialogOpen(true);
  };
  
  // 關閉編輯用戶基本資料對話框
  const handleCloseEditDialog = () => {
    if (!saveLoading) {
      setEditDialogOpen(false);
      setEditingUserData(null);
    }
  };
  
  // 處理更新用戶基本資料
  const handleUpdateUser = async (payload: UpdateUserPayload) => {
    if (!editingUserData) return;
    
    try {
      const resultAction = await dispatch(updateUser({ 
        userId: editingUserData.userId, 
        userData: payload 
      }) as any);
      
      if (!resultAction.error) {
        enqueueSnackbar('用戶資料更新成功', { variant: 'success' });
        handleCloseEditDialog();
      } else {
        enqueueSnackbar(`更新失敗: ${resultAction.payload}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar('更新用戶資料失敗', { variant: 'error' });
    }
  };

  // 過濾用戶列表（前端過濾 - 僅針對roleFilter，因為其他篩選已通過API參數處理）
  const filteredUsers = roleFilter 
    ? users.filter(user => user.roles && user.roles.includes(roleFilter))
    : users;

  if (loading && users.length === 0) {
    return <LoadingState />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">用戶管理</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={handleOpenCreateDialog}
        >
          新增用戶
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 篩選工具欄 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <form onSubmit={handleSearchSubmit}>
              <TextField
                fullWidth
                placeholder="搜索用戶名稱或郵箱"
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
              <InputLabel id="role-filter-label">角色</InputLabel>
              <Select
                labelId="role-filter-label"
                value={roleFilter}
                label="角色"
                onChange={handleRoleFilterChange}
              >
                <MenuItem value="">全部角色</MenuItem>
                {roles.map((role: Role) => (
                  <MenuItem key={role.roleId} value={role.roleId}>{role.roleName}</MenuItem>
                ))}
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
                onChange={handleStatusFilterChange}
              >
                <MenuItem value="">全部狀態</MenuItem>
                <MenuItem value="active">啟用</MenuItem>
                <MenuItem value="inactive">停用</MenuItem>
                <MenuItem value="suspended">已暫停</MenuItem>
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

      {filteredUsers.length === 0 && !loading ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="textSecondary">
            無符合條件的用戶資料。
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>用戶信息</TableCell>
                  <TableCell>角色</TableCell>
                  <TableCell>租戶/店鋪</TableCell>
                  <TableCell>狀態</TableCell>
                  <TableCell>創建時間</TableCell>
                  <TableCell>最後登入</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress size={40} />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: User) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="body1" component="span">
                              {user.displayName || user.email}
                            </Typography>
                            {renderSystemUserBadge(user.isSystemUser)}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {user.email}
                          </Typography>
                          {user.firstName && user.lastName && (
                            <Typography variant="body2" color="text.secondary">
                              {user.firstName} {user.lastName}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                          {renderRoles(user.roleNames)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {user.tenantId && (
                          <Typography variant="body2">
                            租戶: {user.tenantId}
                          </Typography>
                        )}
                        {user.storeId && (
                          <Typography variant="body2">
                            店鋪: {user.storeId}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderUserStatus(user.status)}
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString('zh-TW')}
                      </TableCell>
                      <TableCell>
                        {user.lastLogin 
                          ? new Date(user.lastLogin).toLocaleDateString('zh-TW') 
                          : '尚未登入'}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="修改狀態">
                          <IconButton 
                            disabled={user.isSystemUser}
                            onClick={() => handleEditStatus(user)}
                          >
                            <ToggleOnIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="編輯角色">
                          <IconButton 
                            disabled={user.isSystemUser}
                            onClick={() => handleEditRoles(user)}
                          >
                            <SecurityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="編輯用戶">
                          <IconButton 
                            disabled={user.isSystemUser}
                            onClick={() => handleEditUser(user)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="更多操作">
                          <IconButton 
                            disabled={user.isSystemUser}
                          >
                            <MoreVertIcon />
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

      {/* 編輯角色對話框 */}
      <Dialog
        open={roleDialogOpen}
        onClose={handleCloseRoleDialog}
        aria-labelledby="role-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="role-dialog-title">
          編輯用戶角色
        </DialogTitle>
        <DialogContent>
          {editingUser && (
            <DialogContentText sx={{ mb: 2 }}>
              正在編輯用戶: <strong>{editingUser.displayName || editingUser.email}</strong>
            </DialogContentText>
          )}
          
          {roleDialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {roleDialogError}
            </Alert>
          )}
          
          <FormControl component="fieldset" fullWidth>
            <FormGroup>
              {roles.map((role: Role) => (
                <FormControlLabel
                  key={role.roleId}
                  control={
                    <Checkbox
                      checked={selectedRoles.includes(role.roleId)}
                      onChange={(e) => handleRoleCheckboxChange(role.roleId, e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">{role.roleName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {role.description}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </FormGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseRoleDialog} 
            disabled={rolesUpdateLoading}
          >
            取消
          </Button>
          <Button 
            onClick={handleConfirmUpdateRoles} 
            color="primary" 
            variant="contained"
            disabled={rolesUpdateLoading}
            startIcon={rolesUpdateLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {rolesUpdateLoading ? '更新中...' : '確認更新'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編輯狀態對話框 */}
      <Dialog
        open={statusDialogOpen}
        onClose={handleCloseStatusDialog}
        aria-labelledby="status-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="status-dialog-title">
          修改用戶狀態
        </DialogTitle>
        <DialogContent>
          {editingUserStatus && (
            <DialogContentText sx={{ mb: 2 }}>
              正在編輯用戶: <strong>{editingUserStatus.displayName || editingUserStatus.email}</strong>
              <br />
              當前狀態: {renderUserStatus(editingUserStatus.status)}
            </DialogContentText>
          )}
          
          {statusDialogError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {statusDialogError}
            </Alert>
          )}
          
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="status-select-label">新狀態</InputLabel>
            <Select
              labelId="status-select-label"
              value={selectedStatus}
              label="新狀態"
              onChange={handleStatusChange}
            >
              <MenuItem value="active">啟用</MenuItem>
              <MenuItem value="inactive">停用</MenuItem>
              <MenuItem value="suspended">已暫停</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseStatusDialog} 
            disabled={statusUpdateLoading}
          >
            取消
          </Button>
          <Button 
            onClick={handleConfirmUpdateStatus} 
            color="primary" 
            variant="contained"
            disabled={statusUpdateLoading}
            startIcon={statusUpdateLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {statusUpdateLoading ? '更新中...' : '確認更新'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 新增用戶表單對話框 */}
      <UserCreateForm 
        open={createDialogOpen}
        onClose={handleCloseCreateDialog}
        onSubmit={handleCreateUser}
        availableRoles={roles}
        isSubmitting={saveLoading}
        error={saveError}
        currentTenantId={currentUser?.tenantId || undefined}
        isSuperAdmin={currentUser?.roles.includes('super_admin')}
      />
      
      {/* 編輯用戶資料對話框 */}
      <UserEditForm 
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        onSubmit={handleUpdateUser}
        user={editingUserData}
        isSubmitting={saveLoading}
        error={saveError}
      />
    </Box>
  );
};

export default UsersPage; 