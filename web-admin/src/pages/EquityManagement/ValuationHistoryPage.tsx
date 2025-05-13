import React, { useState } from 'react';
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
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TablePagination
} from '@mui/material';
import { Add as AddIcon, FilterList as FilterIcon, Clear as ClearIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';
import { formatCurrency } from '../../utils/formatters';

import equityService from '../../services/equityService';
import storeService from '../../services/storeService';
import { SharePriceLog } from '../../types/equity.types';
import NewValuationDialog from '../../components/EquityManagement/NewValuationDialog';

const ValuationHistoryPage: React.FC = () => {
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [isNewValuationOpen, setIsNewValuationOpen] = useState<boolean>(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  // 獲取店鋪列表
  const { data: stores, isLoading: loadingStores } = useQuery(
    'stores',
    () => storeService.getStores(),
    {
      onSuccess: (data) => {
        if (data.length > 0 && !selectedStoreId) {
          setSelectedStoreId(data[0].storeId);
        }
      }
    }
  );

  // 獲取估值歷史
  const {
    data: valuationsData,
    isLoading: loadingValuations,
    error: valuationsError,
    refetch
  } = useQuery(
    ['valuations', selectedStoreId, startDate?.format('YYYY-MM-DD'), endDate?.format('YYYY-MM-DD'), page, rowsPerPage],
    () => {
      if (!selectedStoreId) return { valuations: [], totalCount: 0 };
      
      const filters = {
        storeId: selectedStoreId,
        startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
        endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
        limit: rowsPerPage,
        cursor
      };
      
      return equityService.getValuations(filters);
    },
    {
      enabled: !!selectedStoreId,
      keepPreviousData: true
    }
  );

  const handleStoreChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedStoreId(event.target.value as string);
    setCursor(undefined);
    setPage(0);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    if (newPage > page && valuationsData?.nextCursor) {
      setCursor(valuationsData.nextCursor);
    } else if (newPage < page) {
      // 向前翻頁邏輯可能需要更複雜的實現，這裡簡化處理
      setCursor(undefined);
    }
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setCursor(undefined);
    setPage(0);
  };

  const handleFilterToggle = () => {
    setShowFilters(!showFilters);
  };

  const handleClearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setCursor(undefined);
    setPage(0);
    refetch();
  };

  const handleNewValuationOpen = () => {
    setIsNewValuationOpen(true);
  };

  const handleNewValuationClose = () => {
    setIsNewValuationOpen(false);
  };

  const handleNewValuationSuccess = () => {
    setIsNewValuationOpen(false);
    refetch();
  };

  if (loadingStores) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  // 計算分頁信息
  const totalCount = valuationsData?.totalCount || 0;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h1">
          股權估值歷史
        </Typography>

        <Box display="flex" gap={2}>
          <FormControl variant="outlined" sx={{ minWidth: 200 }}>
            <InputLabel id="store-select-label">選擇店鋪</InputLabel>
            <Select
              labelId="store-select-label"
              label="選擇店鋪"
              value={selectedStoreId}
              onChange={handleStoreChange}
            >
              {stores?.map((store) => (
                <MenuItem key={store.storeId} value={store.storeId}>
                  {store.storeName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="顯示篩選器">
            <IconButton onClick={handleFilterToggle} color={showFilters ? 'primary' : 'default'}>
              <FilterIcon />
            </IconButton>
          </Tooltip>

          {selectedStoreId && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleNewValuationOpen}
            >
              新增估值
            </Button>
          )}
        </Box>
      </Box>

      {showFilters && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={5}>
              <DatePicker
                label="開始日期"
                value={startDate}
                onChange={setStartDate}
                slotProps={{ textField: { fullWidth: true, variant: 'outlined' } }}
              />
            </Grid>
            <Grid item xs={12} sm={5}>
              <DatePicker
                label="結束日期"
                value={endDate}
                onChange={setEndDate}
                slotProps={{ textField: { fullWidth: true, variant: 'outlined' } }}
                minDate={startDate || undefined}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                >
                  清除篩選
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {!selectedStoreId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          請選擇一個店鋪來查看其估值歷史
        </Alert>
      )}

      {valuationsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          獲取估值歷史時發生錯誤。
        </Alert>
      )}

      {loadingValuations && selectedStoreId && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
          <CircularProgress />
        </Box>
      )}

      {valuationsData && !loadingValuations && (
        <>
          <TableContainer>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>生效日期</TableCell>
                  <TableCell align="right">股價</TableCell>
                  <TableCell align="right">價格變化</TableCell>
                  <TableCell align="right">平均稅後淨利</TableCell>
                  <TableCell align="right">計算月數</TableCell>
                  <TableCell align="right">乘數</TableCell>
                  <TableCell align="right">總公司估值</TableCell>
                  <TableCell>備註</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {valuationsData.valuations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      尚未有估值記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  valuationsData.valuations.map((valuation: SharePriceLog) => (
                    <TableRow key={valuation.valuationId}>
                      <TableCell>{dayjs(valuation.effectiveDate).format('YYYY-MM-DD')}</TableCell>
                      <TableCell align="right">{formatCurrency(valuation.sharePrice)}</TableCell>
                      <TableCell align="right" sx={{
                        color: valuation.priceChangePercentage > 0
                          ? 'success.main'
                          : valuation.priceChangePercentage < 0
                            ? 'error.main'
                            : 'text.primary'
                      }}>
                        {valuation.priceChangePercentage > 0 ? '+' : ''}
                        {valuation.priceChangePercentage.toFixed(2)}%
                      </TableCell>
                      <TableCell align="right">{formatCurrency(valuation.averageNetProfit)}</TableCell>
                      <TableCell align="right">{valuation.monthsInCalculation}</TableCell>
                      <TableCell align="right">{valuation.multiplier}</TableCell>
                      <TableCell align="right">{formatCurrency(valuation.totalCompanyValue)}</TableCell>
                      <TableCell>{valuation.valuationNotes || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="每頁行數:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
        </>
      )}

      {isNewValuationOpen && selectedStoreId && (
        <NewValuationDialog
          open={isNewValuationOpen}
          onClose={handleNewValuationClose}
          onSuccess={handleNewValuationSuccess}
          storeId={selectedStoreId}
        />
      )}
    </Paper>
  );
};

export default ValuationHistoryPage; 