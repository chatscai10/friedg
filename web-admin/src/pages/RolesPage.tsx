import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  Button as MuiButton,
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
  Alert as MuiAlert,
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
  SelectChangeEvent,
  CircularProgress as MuiCircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

import { Button as AntButton, Spin, Alert as AntAlert } from 'antd';

import LoadingState from '../components/common/LoadingState';
import Pagination from '../components/common/Pagination';
import { RootState } from '../store';
import { 
  fetchRoles,
  deleteRole,
  createRole,
  updateRole,
  setCurrentPage,
  setPageSize,
  clearCreateError,
  clearUpdateError,
  clearDeleteError
} from '../store/roleSlice';
import { 
  fetchAppPermissions,
  selectAllPermissions,
  selectPermissionsLoading,
  selectPermissionsError,
  clearPermissionsError
} from '../store/permissionSlice';
import { 
  fetchTenants,
  selectAllTenants,
  selectTenantsLoading,
  selectTenantsError,
  clearTenantsError
} from '../store/tenantSlice';
import {
  fetchStoresByTenantId,
  resetStoresForRoleForm,
  selectStoresForRoleFormList,
  selectStoresForRoleFormLoading,
  selectStoresForRoleFormError,
  clearStoresForRoleFormError
} from '../store/storesForRoleFormSlice';
import { Role, PermissionItem, RoleFormValues, RoleScope } from '../types/role';
import RoleFormModal from '../components/RoleManagement/RoleFormModal';
import { transformPermissionIdsToApiObjects } from '../utils/roleUtils';

/**
 * 角色管理頁面 - 主路由組件
 * 整合角色列表視圖和角色表單模態框
 */
const RolesPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { 
    roles, 
    loading, 
    error, 
    deleteLoading, 
    deleteError, 
    createLoading,
    createError,
    updateLoading,
    updateError,
    pagination 
  } = useSelector((state: RootState) => state.roles);
  const allPermissions = useSelector(selectAllPermissions);
  const allPermissionsLoading = useSelector(selectPermissionsLoading);
  const allPermissionsError = useSelector(selectPermissionsError);

  const tenantsList = useSelector(selectAllTenants);
  const tenantsLoading = useSelector(selectTenantsLoading);
  const tenantsError = useSelector(selectTenantsError);

  const storesForSelectedTenant = useSelector(selectStoresForRoleFormList);
  const storesLoading = useSelector(selectStoresForRoleFormLoading);
  const storesError = useSelector(selectStoresForRoleFormError);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    dispatch(fetchAppPermissions() as any);
    dispatch(fetchTenants() as any);
  }, [dispatch]);

  const fetchRolesData = useCallback((page = pagination.currentPage, limit = pagination.pageSize) => {
    dispatch(fetchRoles({
      page,
      limit,
      scope: scopeFilter || undefined,
      search: searchTerm || undefined,
    }) as any);
  }, [dispatch, pagination.currentPage, pagination.pageSize, scopeFilter, searchTerm, statusFilter]);

  useEffect(() => {
    fetchRolesData();
  }, [fetchRolesData]);

  useEffect(() => {
    if (isModalVisible && !editingRole) {
      if (createError) dispatch(clearCreateError());
      if (updateError) dispatch(clearUpdateError());
      if (tenantsError) dispatch(clearTenantsError());
      if (storesError) dispatch(clearStoresForRoleFormError());
    }
  }, [isModalVisible, editingRole, createError, updateError, tenantsError, storesError, dispatch]);

  const handleOpenCreateModal = () => {
    setEditingRole(null);
    if (createError) dispatch(clearCreateError());
    if (updateError) dispatch(clearUpdateError());
    if (tenantsError) dispatch(clearTenantsError());
    if (storesError) dispatch(clearStoresForRoleFormError());
    dispatch(resetStoresForRoleForm());
    setIsModalVisible(true);
  };
  
  const handleOpenEditModal = (role: Role) => {
    setEditingRole(role);
    if (createError) dispatch(clearCreateError()); 
    if (updateError) dispatch(clearUpdateError());
    if (tenantsError) dispatch(clearTenantsError());
    if (storesError) dispatch(clearStoresForRoleFormError());
    if (role.tenantId) {
      dispatch(fetchStoresByTenantId(role.tenantId) as any);
    } else {
      dispatch(resetStoresForRoleForm());
    }
    setIsModalVisible(true);
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingRole(null);
    if (createError) dispatch(clearCreateError());
    if (updateError) dispatch(clearUpdateError());
    dispatch(resetStoresForRoleForm());
  };

  const handleModalOk = (values: RoleFormValues) => {
    if (allPermissionsLoading || allPermissionsError) {
      console.warn("Form submission attempted while permissions are loading or in error state.");
      return;
    }

    const permissionsInApiFormat = transformPermissionIdsToApiObjects(
      values.permissions as string[],
      allPermissions
    );
    
    const dataToSubmit = {
      roleName: values.roleName,
      description: values.description,
      scope: values.scope,
      roleLevel: values.roleLevel,
      permissions: permissionsInApiFormat,
      specialPermissions: values.specialPermissions,
      status: values.status,
      tenantId: values.tenantId,
      storeId: values.storeId,
    };
    
    if (editingRole) {
      dispatch(updateRole({ ...dataToSubmit, roleId: editingRole.roleId }) as any)
        .unwrap()
        .then(() => {
          setIsModalVisible(false);
          setEditingRole(null);
          fetchRolesData();
        })
        .catch((err:any) => {
          console.error("更新角色失敗:", err);
        });
    } else {
      dispatch(createRole(dataToSubmit) as any)
        .unwrap()
        .then(() => {
          setIsModalVisible(false);
          fetchRolesData(1);
        })
        .catch((err:any) => {
          console.error("創建角色失敗:", err);
        });
    }
  };

  const handleEditRole = (role: Role) => {
    handleOpenEditModal(role);
  };

  const handleDeleteClick = (role: Role) => {
    setRoleToDelete({ id: role.roleId, name: role.roleName });
    if(deleteError) dispatch(clearDeleteError());
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (!deleteLoading) {
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  const handleConfirmDelete = () => {
    if (roleToDelete) {
      dispatch(deleteRole(roleToDelete.id) as any)
        .unwrap()
        .then(() => {
          setDeleteDialogOpen(false);
          setRoleToDelete(null);
          fetchRolesData();
        })
        .catch((err:any) => {
          console.error("刪除角色失敗:", err);
          setDeleteDialogOpen(false); 
          setRoleToDelete(null);
        });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    dispatch(setCurrentPage(1));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(setCurrentPage(1));
    fetchRolesData(1);
  };

  const handleScopeChange = (e: SelectChangeEvent<string>) => {
    setScopeFilter(e.target.value);
    dispatch(setCurrentPage(1));
  };

  const handleStatusChange = (e: SelectChangeEvent<string>) => {
    setStatusFilter(e.target.value);
    dispatch(setCurrentPage(1));
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setScopeFilter('');
    setStatusFilter('');
    dispatch(setCurrentPage(1));
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'global':
        return 'primary';
      case 'tenant':
        return 'secondary';
      case 'store':
        return 'info';
      default:
        return 'default';
    }
  };

  const renderSystemRoleBadge = (isSystemRole: boolean) => {
    if (isSystemRole) {
      return <Chip size="small" label="系統角色" color="info" sx={{ ml: 1 }} />;
    }
    return null;
  };

  const filteredRoles = statusFilter 
    ? roles.filter(role => {
        const roleStatus = (role as any).status || ((role as any).isActive ? 'active' : 'inactive');
        return roleStatus === statusFilter;
      })
    : roles;

  const handleTenantChangeForStores = useCallback((tenantId?: string) => {
    dispatch(resetStoresForRoleForm());
    if (tenantId) {
      dispatch(fetchStoresByTenantId(tenantId) as any);
    }
  }, [dispatch]);

  if (loading && roles.length === 0 && pagination.currentPage === 1) {
    return <LoadingState />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">角色管理</Typography>
        <MuiButton 
          variant="contained" 
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateModal}
        >
          創建新角色
        </MuiButton>
      </Box>

      {error && (
        <MuiAlert severity="error" sx={{ mb: 3 }}>
          獲取角色列表失敗: {typeof error === 'string' ? error : JSON.stringify(error)}
        </MuiAlert>
      )}

      {createError && (
        <MuiAlert severity="error" sx={{ mb: 3, mt: isModalVisible ? 0 : 2 }} onClose={() => dispatch(clearCreateError())}>
          創建角色失敗: {typeof createError === 'string' ? createError : JSON.stringify(createError)}
        </MuiAlert>
      )}
      
      {updateError && (
        <MuiAlert severity="error" sx={{ mb: 3, mt: isModalVisible ? 0 : 2 }} onClose={() => dispatch(clearUpdateError())}>
          更新角色失敗: {typeof updateError === 'string' ? updateError : JSON.stringify(updateError)}
        </MuiAlert>
      )}
      
      {deleteError && (
        <MuiAlert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearDeleteError())}>
          刪除角色失敗: {typeof deleteError === 'string' ? deleteError : JSON.stringify(deleteError)}
        </MuiAlert>
      )}

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
                <MenuItem value=""><em>全部範圍</em></MenuItem>
                <MenuItem value="global">全局 (Global)</MenuItem>
                <MenuItem value="tenant">租戶 (Tenant)</MenuItem>
                <MenuItem value="store">店鋪 (Store)</MenuItem>
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
                <MenuItem value=""><em>全部狀態</em></MenuItem>
                <MenuItem value="active">啟用 (Active)</MenuItem>
                <MenuItem value="inactive">停用 (Inactive)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <MuiButton 
              fullWidth 
              variant="outlined" 
              onClick={handleClearFilters} 
              startIcon={<FilterListIcon />}
              size="medium"
            >
              清除篩選
            </MuiButton>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} sx={{ mb:3 }}>
        <Table sx={{ minWidth: 650 }} aria-label="roles table">
          <TableHead>
            <TableRow>
              <TableCell>角色名稱</TableCell>
              <TableCell>描述</TableCell>
              <TableCell>範圍</TableCell>
              <TableCell>等級</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && pagination.currentPage === 1 && filteredRoles.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredRoles.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography>沒有找到符合條件的角色。</Typography>
                </TableCell>
              </TableRow>
            )}
            {filteredRoles.map((role) => {
              const roleStatus = (role as any).status || ((role as any).isActive ? 'active' : 'inactive');
              return (
                <TableRow key={role.roleId}>
                  <TableCell>
                    {role.roleName}
                    {renderSystemRoleBadge(role.isSystemRole)}
                  </TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    <Chip label={role.scope} color={getScopeColor(role.scope) as any} size="small" />
                  </TableCell>
                  <TableCell>{role.roleLevel}</TableCell>
                  <TableCell>
                    <Chip 
                      label={roleStatus === 'active' ? '啟用' : '停用'}
                      color={roleStatus === 'active' ? 'success' : 'default'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="編輯">
                      <IconButton onClick={() => handleEditRole(role)} size="small" disabled={role.isSystemRole}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="刪除">
                      <IconButton onClick={() => handleDeleteClick(role)} size="small" disabled={role.isSystemRole}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Pagination
        totalItems={pagination.totalItems}
        itemsPerPage={pagination.pageSize}
        currentPage={pagination.currentPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handlePageSizeChange}
      />

      {isModalVisible && (
        <RoleFormModal
          visible={isModalVisible}
          onCancel={handleModalCancel}
          onOk={handleModalOk}
          initialData={editingRole}
          isLoading={createLoading || updateLoading || allPermissionsLoading}
          allPermissions={allPermissions}
          allPermissionsLoading={allPermissionsLoading}
          allPermissionsError={allPermissionsError}
          createError={createError}
          updateError={updateError}
          clearCreateError={() => dispatch(clearCreateError())}
          clearUpdateError={() => dispatch(clearUpdateError())}
          clearPermissionsError={allPermissionsError ? () => dispatch(clearPermissionsError()) : undefined}
          okButtonProps={{
            disabled: allPermissionsLoading || !!allPermissionsError || tenantsLoading || !!tenantsError || storesLoading || !!storesError || createLoading || updateLoading
          }}
          tenantsList={tenantsList}
          tenantsLoading={tenantsLoading}
          tenantsError={tenantsError}
          clearTenantsError={tenantsError ? () => dispatch(clearTenantsError()) : undefined}
          onTenantChange={handleTenantChangeForStores}
          storesList={storesForSelectedTenant}
          storesLoading={storesLoading}
          storesError={storesError}
          clearStoresError={storesError ? () => dispatch(clearStoresForRoleFormError()) : undefined}
        />
      )}

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>確認刪除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            確定要刪除角色 "{roleToDelete?.name}" 嗎？此操作無法撤銷。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={handleCloseDeleteDialog} disabled={deleteLoading}>取消</MuiButton>
          <MuiButton onClick={handleConfirmDelete} color="error" disabled={deleteLoading}>
            {deleteLoading ? <CircularProgress size={24} /> : '刪除'}
          </MuiButton>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default RolesPage; 