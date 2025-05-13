import React from 'react';
import { Box, Pagination as MuiPagination, FormControl, Select, MenuItem, SelectChangeEvent, Typography } from '@mui/material';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100]
}) => {
  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    onPageChange(value);
  };

  const handlePageSizeChange = (event: SelectChangeEvent<number>) => {
    onPageSizeChange(Number(event.target.value));
  };

  // 計算當前顯示的項目範圍
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', my: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
          每頁顯示:
        </Typography>
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <Select
            value={pageSize}
            onChange={handlePageSizeChange}
            displayEmpty
          >
            {pageSizeOptions.map(option => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          顯示 {startItem}-{endItem} 共 {totalItems} 項
        </Typography>
      </Box>
      
      <MuiPagination 
        count={totalPages} 
        page={currentPage} 
        onChange={handlePageChange} 
        color="primary" 
        showFirstButton 
        showLastButton
      />
    </Box>
  );
};

export default Pagination; 