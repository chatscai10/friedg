import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
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
  TextField,
  Button,
  Chip,
  IconButton,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  CircularProgress,
  OutlinedInput,
  Checkbox,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { listCustomers, CustomerFilters } from '../../services/crmService';
import { formatDate } from '../../utils/dateUtils';
import { UserProfile } from '../../types/user.types';
import { usePermission } from '../../hooks/usePermission';

const ITEMS_PER_PAGE = 10;

const CustomerListPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<CustomerFilters>({
    limit: ITEMS_PER_PAGE,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  
  // 檢查權限
  const canReadCRM = usePermission('crm:read');
  const canManageCRM = usePermission('crm:manage');

  // 獲取客戶列表數據
  const { data, isLoading, isError, refetch } = useQuery(
    ['customers', filters],
    () => listCustomers({ ...filters, cursor }),
    {
      enabled: canReadCRM,
      keepPreviousData: true,
    }
  );

  // 處理搜索
  const handleSearch = () => {
    const newFilters: CustomerFilters = {
      ...filters,
      query: searchQuery,
    };
    setFilters(newFilters);
    setCursor(undefined);
  };

  // 處理標籤篩選變更
  const handleTagsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setSelectedTags(typeof value === 'string' ? value.split(',') : value);
  };

  // 處理狀態篩選變更
  const handleStatusChange = (event: SelectChangeEvent) => {
    setSelectedStatus(event.target.value);
  };

  // 應用篩選條件
  const applyFilters = () => {
    const newFilters: CustomerFilters = {
      ...filters,
      query: searchQuery,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      status: selectedStatus ? (selectedStatus as 'active' | 'inactive' | 'blocked') : undefined,
    };
    setFilters(newFilters);
    setCursor(undefined);
  };

  // 重置篩選條件
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setSelectedStatus('');
    setFilters({ limit: ITEMS_PER_PAGE });
    setCursor(undefined);
  };

  // 加載下一頁
  const loadNextPage = () => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  };

  // 加載上一頁
  const loadPrevPage = () => {
    if (data?.prevCursor) {
      setCursor(data.prevCursor);
    }
  };

  // 導航到客戶詳情頁
  const goToCustomerDetail = (customerId: string) => {
    navigate(`/crm/customers/view/${customerId}`);
  };

  // 導航到客戶編輯頁面
  const goToCustomerEdit = (customerId: string) => {
    navigate(`/crm/customers/edit/${customerId}`);
  };

  // 導航到新增客戶頁面
  const goToNewCustomer = () => {
    navigate('/crm/customers/new');
  };

  // 如果沒有權限，顯示錯誤信息
  if (!canReadCRM) {
    return (
      <Box p={3}>
        <Typography variant="h5" color="error">
          您沒有訪問客戶管理的權限
        </Typography>
      </Box>
    );
  }

  // 可用的標籤列表（實際應用中可能來自API）
  const availableTags = ['vip', 'new', 'repeat', 'promotion', 'inactive', 'high-value'];

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">客戶管理</Typography>
        {canManageCRM && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={goToNewCustomer}
          >
            新增客戶
          </Button>
        )}
      </Box>

      {/* 篩選器部分 */}
      <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          篩選條件
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="搜索（姓名/電話/郵箱）"
              variant="outlined"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={handleSearch}>
                    <SearchIcon />
                  </IconButton>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="tags-label">客戶標籤</InputLabel>
              <Select
                labelId="tags-label"
                id="tags-select"
                multiple
                value={selectedTags}
                onChange={handleTagsChange}
                input={<OutlinedInput label="客戶標籤" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} />
                    ))}
                  </Box>
                )}
              >
                {availableTags.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    <Checkbox checked={selectedTags.indexOf(tag) > -1} />
                    <ListItemText primary={tag} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="status-label">狀態</InputLabel>
              <Select
                labelId="status-label"
                id="status-select"
                value={selectedStatus}
                label="狀態"
                onChange={handleStatusChange}
              >
                <MenuItem value="">
                  <em>全部</em>
                </MenuItem>
                <MenuItem value="active">活躍</MenuItem>
                <MenuItem value="inactive">非活躍</MenuItem>
                <MenuItem value="blocked">已封禁</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3} display="flex" alignItems="center">
            <Button
              variant="contained"
              color="primary"
              onClick={applyFilters}
              sx={{ mr: 1 }}
            >
              套用篩選
            </Button>
            <Button variant="outlined" onClick={resetFilters}>
              重置
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* 客戶列表部分 */}
      <Paper elevation={3}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : isError ? (
          <Box p={3}>
            <Typography color="error">獲取客戶列表時發生錯誤</Typography>
            <Button variant="outlined" onClick={() => refetch()} sx={{ mt: 1 }}>
              重試
            </Button>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>姓名</TableCell>
                    <TableCell>電子郵件</TableCell>
                    <TableCell>電話</TableCell>
                    <TableCell>註冊日期</TableCell>
                    <TableCell>標籤</TableCell>
                    <TableCell>消費總額</TableCell>
                    <TableCell>訂單數</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.customers?.length ? (
                    data.customers.map((customer: UserProfile) => (
                      <TableRow key={customer.uid} hover>
                        <TableCell>
                          {customer.displayName || `${customer.firstName || ''} ${customer.lastName || ''}`}
                        </TableCell>
                        <TableCell>{customer.email || '-'}</TableCell>
                        <TableCell>{customer.phoneNumber || '-'}</TableCell>
                        <TableCell>
                          {customer.customerSince ? formatDate(customer.customerSince) : '-'}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {customer.tags?.map((tag) => (
                              <Chip key={tag} label={tag} size="small" />
                            )) || '-'}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {customer.totalSpent !== undefined ? `$${customer.totalSpent.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>{customer.orderCount || 0}</TableCell>
                        <TableCell>
                          <IconButton
                            color="primary"
                            onClick={() => goToCustomerDetail(customer.uid)}
                            title="查看詳情"
                          >
                            <VisibilityIcon />
                          </IconButton>
                          {canManageCRM && (
                            <IconButton
                              color="secondary"
                              onClick={() => goToCustomerEdit(customer.uid)}
                              title="編輯"
                            >
                              <EditIcon />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        無客戶數據
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* 分頁控制 */}
            <Box display="flex" justifyContent="space-between" p={2}>
              <Typography variant="body2">
                顯示 {data?.customers?.length || 0} 筆結果，共 {data?.totalCount || 0} 筆
              </Typography>
              <Box>
                <Button 
                  disabled={!data?.prevCursor} 
                  onClick={loadPrevPage}
                  sx={{ mr: 1 }}
                >
                  上一頁
                </Button>
                <Button 
                  disabled={!data?.nextCursor} 
                  onClick={loadNextPage}
                >
                  下一頁
                </Button>
              </Box>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default CustomerListPage; 