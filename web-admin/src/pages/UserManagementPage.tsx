import React, { useEffect, useState, useCallback } from 'react';
import { listUsers, setUserRole, AdminUser } from '@/services/adminService';
import { useAuth } from '@/contexts/AuthContext'; // Assuming useAuth provides getIdToken and user claims
import { useNotification } from '@/contexts/NotificationContext';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  TablePagination,
  Container,
} from '@mui/material';

const ROLES_TO_ASSIGN = ["admin", "employee", "customer", "store_manager"];

const UserManagementPage: React.FC = () => {
  const { getIdToken, user } = useAuth();
  const { addNotification } = useNotification();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<{ [uid: string]: string }>({});
  const [updatingRoleFor, setUpdatingRoleFor] = useState<string | null>(null);

  // Pagination state
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [currentPageTokens, setCurrentPageTokens] = useState<string[]>([""]); // Stores tokens for prev pages, first element is for page 0
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10); // This is for display, actual fetch limit is in fetchUsers

  const fetchUsers = useCallback(async (token?: string) => {
    setLoading(true);
    setError(null);
    const idToken = await getIdToken();
    if (!idToken) {
      setError("未授權，無法獲取用戶列表。");
      setLoading(false);
      addNotification("您的登入憑證已過期或無效，請重新登入後再試。", "error");
      return;
    }

    // Check if current user is admin (client-side check for UX, server-side is definitive)
    if (user?.customClaims?.role !== 'admin'){
        setError("權限不足，僅管理員可訪問此頁面。");
        addNotification("權限不足，僅管理員可訪問此頁面。", "error");
        setLoading(false);
        setUsers([]);
        return;
    }

    const response = await listUsers(idToken, rowsPerPage, token);
    if (response.success) {
      setUsers(response.users || []);
      setNextPageToken(response.nextPageToken);
    } else {
      setError(response.message || "獲取用戶列表失敗。");
      addNotification(response.message || "獲取用戶列表失敗", "error");
      setUsers([]);
    }
    setLoading(false);
  }, [getIdToken, addNotification, rowsPerPage, user]);

  useEffect(() => {
    // Fetch initial users
    fetchUsers(currentPageTokens[page]);
  }, [fetchUsers, page, currentPageTokens]);

  const handleRoleChange = (uid: string, newRole: string) => {
    setSelectedRoles((prev) => ({ ...prev, [uid]: newRole }));
  };

  const handleUpdateRole = async (uid: string) => {
    const newRole = selectedRoles[uid];
    if (!newRole) {
      addNotification("請先為該用戶選擇一個新角色。", "warning");
      return;
    }
    
    // Ensure the current user (admin) has an ID token with admin role claim for the callable function
    const idToken = await getIdToken();
    if (!idToken || user?.customClaims?.role !== 'admin') {
        addNotification("管理員認證失敗，無法更新角色。", "error");
        return;
    }

    setUpdatingRoleFor(uid);
    const response = await setUserRole({ userId: uid, role: newRole });
    if (response.success) {
      addNotification(`用戶 ${uid} 的角色已成功更新為 ${newRole}。`, 'success');
      // Refetch users to show updated role
      fetchUsers(currentPageTokens[page]);
    } else {
      addNotification(response.message || `更新用戶 ${uid} 的角色失敗。`, 'error');
    }
    setUpdatingRoleFor(null);
    setSelectedRoles((prev) => {
        const newState = {...prev};
        delete newState[uid];
        return newState;
    });
  };

  const handleChangePage = (
    event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number,
  ) => {
    if (newPage > page && nextPageToken) { // Moving to next page
        if(newPage >= currentPageTokens.length) {
            setCurrentPageTokens(prev => [...prev, nextPageToken]);
        }
    } 
    setPage(newPage);
  };

  // Note: rowsPerPage is fixed for API calls for now, MUI pagination is just for visual consistency
  // To implement true rowsPerPage control, fetchUsers would need to take rowsPerPage for its API call.

  if (user?.customClaims?.role !== 'admin'){
    return (
        <Box sx={{ p: 3 }}>
            <Alert severity="error">權限不足，僅系統管理員可查看此頁面。</Alert>
        </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        用戶管理
      </Typography>
      {loading && !users.length ? (
        <Container sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
            <Box textAlign="center">
                <CircularProgress size={60} sx={{mb: 2}}/>
                <Typography variant="h6">載入用戶列表中...</Typography>
            </Box>
        </Container>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Paper sx={{ width: '100%', mb: 2 }}>
          <TableContainer>
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  <TableCell>UID</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>顯示名稱</TableCell>
                  <TableCell>目前角色</TableCell>
                  <TableCell>新角色</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.uid}>
                    <TableCell sx={{maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis'}}>{u.uid}</TableCell>
                    <TableCell>{u.email || 'N/A'}</TableCell>
                    <TableCell>{u.displayName || 'N/A'}</TableCell>
                    <TableCell>{u.customClaims?.role || '未指定'}</TableCell>
                    <TableCell>
                      <Select
                        value={selectedRoles[u.uid] || ''}
                        onChange={(e) => handleRoleChange(u.uid, e.target.value as string)}
                        displayEmpty
                        size="small"
                        sx={{ minWidth: 150 }}
                      >
                        <MenuItem value="" disabled>
                          <em>選擇角色</em>
                        </MenuItem>
                        {ROLES_TO_ASSIGN.map((role) => (
                          <MenuItem key={role} value={role}>
                            {role}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="contained"
                        onClick={() => handleUpdateRole(u.uid)}
                        disabled={updatingRoleFor === u.uid || !selectedRoles[u.uid]}
                        size="small"
                      >
                        {updatingRoleFor === u.uid ? <CircularProgress size={20} /> : '更新角色'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[rowsPerPage]} // For now, API limit is fixed
            component="div"
            count={-1} // Unknown total count for Firebase Auth listUsers, or set a very large number if you know an estimate.
                       // For true count, you'd need another mechanism or to fetch all users (not recommended for large sets)
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            // onRowsPerPageChange is not implemented as API limit is fixed
            labelDisplayedRows={({ from, to, count }) => {
                const total = nextPageToken ? -1 : page * rowsPerPage + users.length;
                if (total === -1) return `${from}-${to} ...`;
                return `${from}-${to} / ${total}`;
            }}
            nextIconButtonProps={{
                disabled: !nextPageToken && page >= Math.floor((currentPageTokens.length > 1 ? currentPageTokens.length -1 : 0) * rowsPerPage / rowsPerPage) 
            }}
          />
        </Paper>
      )}
    </Box>
  );
};

export default UserManagementPage; 