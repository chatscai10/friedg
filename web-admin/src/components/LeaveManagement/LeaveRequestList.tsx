import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Typography,
  TablePagination,
  Tooltip
} from '@mui/material';
import { format, parseISO } from 'date-fns';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InfoIcon from '@mui/icons-material/Info';

import { LeaveRequest, LeaveType, listLeaveTypes, updateLeaveRequestStatus } from '../../services/leaveService';

// 請假狀態對應的顏色和標籤
const statusConfig: Record<string, { color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'; label: string }> = {
  pending: { color: 'warning', label: '待審批' },
  approved: { color: 'success', label: '已批准' },
  rejected: { color: 'error', label: '已拒絕' },
  cancelled: { color: 'default', label: '已取消' }
};

interface LeaveRequestListProps {
  leaveRequests: LeaveRequest[];
  loading: boolean;
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onStatusChange: () => void; // 當狀態變更時通知父組件刷新
}

const LeaveRequestList: React.FC<LeaveRequestListProps> = ({
  leaveRequests,
  loading,
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onStatusChange
}) => {
  // 請假類型列表
  const [leaveTypes, setLeaveTypes] = useState<Record<string, LeaveType>>({});
  
  // 拒絕對話框狀態
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  
  // 詳情對話框狀態
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  
  // 處理審批/拒絕中的狀態
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  
  // 獲取請假類型
  useEffect(() => {
    const fetchLeaveTypes = async () => {
      try {
        const types = await listLeaveTypes();
        // 將請假類型轉換為以ID為鍵的字典，便於查找
        const typesMap = types.reduce((acc, type) => {
          acc[type.leaveTypeId] = type;
          return acc;
        }, {} as Record<string, LeaveType>);
        setLeaveTypes(typesMap);
      } catch (error) {
        console.error('獲取請假類型失敗:', error);
      }
    };
    
    fetchLeaveTypes();
  }, []);
  
  // 處理頁碼變更
  const handleChangePage = (event: unknown, newPage: number) => {
    onPageChange(newPage);
  };
  
  // 處理每頁筆數變更
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    onPageSizeChange(parseInt(event.target.value, 10));
    onPageChange(0); // 重置頁碼
  };
  
  // 處理查看詳情
  const handleViewDetails = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setDetailsDialogOpen(true);
  };
  
  // 處理批准
  const handleApprove = async (requestId: string) => {
    // 更新處理狀態
    setProcessing(prev => ({ ...prev, [requestId]: true }));
    
    try {
      await updateLeaveRequestStatus(requestId, 'approved');
      // 通知父組件刷新
      onStatusChange();
    } catch (error) {
      console.error('批准請假失敗:', error);
    } finally {
      // 清除處理狀態
      setProcessing(prev => {
        const newState = { ...prev };
        delete newState[requestId];
        return newState;
      });
    }
  };
  
  // 打開拒絕對話框
  const handleOpenRejectDialog = (requestId: string) => {
    setSelectedRequestId(requestId);
    setRejectReason('');
    setRejectDialogOpen(true);
  };
  
  // 處理拒絕
  const handleReject = async () => {
    if (!selectedRequestId) return;
    
    // 更新處理狀態
    setProcessing(prev => ({ ...prev, [selectedRequestId]: true }));
    
    try {
      await updateLeaveRequestStatus(selectedRequestId, 'rejected', rejectReason);
      // 關閉對話框
      setRejectDialogOpen(false);
      // 通知父組件刷新
      onStatusChange();
    } catch (error) {
      console.error('拒絕請假失敗:', error);
    } finally {
      // 清除處理狀態
      setProcessing(prev => {
        const newState = { ...prev };
        delete newState[selectedRequestId!];
        return newState;
      });
    }
  };
  
  // 格式化日期時間
  const formatDateTime = (dateTimeString: string) => {
    try {
      return format(parseISO(dateTimeString), 'yyyy-MM-dd HH:mm');
    } catch (_) {
      return dateTimeString;
    }
  };
  
  // 獲取請假類型名稱
  const getLeaveTypeName = (typeId: string) => {
    return leaveTypes[typeId]?.name || '未知';
  };
  
  return (
    <Box>
      {/* 列表 */}
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell>申請ID</TableCell>
              <TableCell>員工姓名</TableCell>
              <TableCell>分店</TableCell>
              <TableCell>假別</TableCell>
              <TableCell>開始時間</TableCell>
              <TableCell>結束時間</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>申請時間</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={40} />
                  <Typography variant="body1" sx={{ mt: 1 }}>加載中...</Typography>
                </TableCell>
              </TableRow>
            ) : leaveRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                  <Typography variant="body1">暫無請假申請</Typography>
                </TableCell>
              </TableRow>
            ) : (
              leaveRequests.map((request) => (
                <TableRow key={request.requestId} hover>
                  <TableCell>{request.requestId.slice(0, 8)}</TableCell>
                  <TableCell>{request.employeeName || request.employeeId}</TableCell>
                  <TableCell>{request.storeName || request.storeId}</TableCell>
                  <TableCell>{getLeaveTypeName(request.leaveTypeId)}</TableCell>
                  <TableCell>{formatDateTime(request.startTime)}</TableCell>
                  <TableCell>{formatDateTime(request.endTime)}</TableCell>
                  <TableCell>
                    <Chip 
                      label={statusConfig[request.status]?.label || request.status} 
                      color={statusConfig[request.status]?.color || 'default'} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>{formatDateTime(request.requestedAt)}</TableCell>
                  <TableCell align="center">
                    <Box display="flex" justifyContent="center">
                      <Tooltip title="查看詳情">
                        <IconButton 
                          size="small" 
                          onClick={() => handleViewDetails(request)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      {/* 只有待審批狀態才顯示審批和拒絕按鈕 */}
                      {request.status === 'pending' && (
                        <>
                          <Tooltip title="批准">
                            <IconButton 
                              size="small"
                              color="success"
                              onClick={() => handleApprove(request.requestId)}
                              disabled={!!processing[request.requestId]}
                            >
                              {processing[request.requestId] ? 
                                <CircularProgress size={20} /> : 
                                <CheckCircleIcon fontSize="small" />
                              }
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="拒絕">
                            <IconButton 
                              size="small"
                              color="error"
                              onClick={() => handleOpenRejectDialog(request.requestId)}
                              disabled={!!processing[request.requestId]}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      
                      {/* 拒絕時顯示原因按鈕 */}
                      {request.status === 'rejected' && request.rejectionReason && (
                        <Tooltip title={`拒絕原因: ${request.rejectionReason}`}>
                          <IconButton size="small" color="info">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* 分頁控制項 */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={totalItems}
        rowsPerPage={pageSize}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="每頁顯示:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} 共 ${count}`}
      />
      
      {/* 拒絕原因對話框 */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>拒絕請假申請</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="拒絕原因"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            required
            error={rejectReason.trim() === ''}
            helperText={rejectReason.trim() === '' ? '請填寫拒絕原因' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>取消</Button>
          <Button 
            onClick={handleReject} 
            color="error" 
            variant="contained"
            disabled={rejectReason.trim() === '' || processing[selectedRequestId || '']}
          >
            {processing[selectedRequestId || ''] ? '處理中...' : '確認拒絕'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 詳情對話框 */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>請假申請詳情</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" gutterBottom>
                <strong>申請ID:</strong> {selectedRequest.requestId}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>員工:</strong> {selectedRequest.employeeName || selectedRequest.employeeId}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>分店:</strong> {selectedRequest.storeName || selectedRequest.storeId}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>假別:</strong> {getLeaveTypeName(selectedRequest.leaveTypeId)}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>開始時間:</strong> {formatDateTime(selectedRequest.startTime)}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>結束時間:</strong> {formatDateTime(selectedRequest.endTime)}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>請假原因:</strong> {selectedRequest.reason}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>狀態:</strong> {' '}
                <Chip 
                  label={statusConfig[selectedRequest.status]?.label || selectedRequest.status} 
                  color={statusConfig[selectedRequest.status]?.color || 'default'} 
                  size="small" 
                />
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>申請時間:</strong> {formatDateTime(selectedRequest.requestedAt)}
              </Typography>
              
              {selectedRequest.approvedBy && (
                <Typography variant="body1" gutterBottom>
                  <strong>審批人:</strong> {selectedRequest.approvedBy}
                </Typography>
              )}
              
              {selectedRequest.approvedAt && (
                <Typography variant="body1" gutterBottom>
                  <strong>審批時間:</strong> {formatDateTime(selectedRequest.approvedAt)}
                </Typography>
              )}
              
              {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                <Typography variant="body1" gutterBottom>
                  <strong>拒絕原因:</strong> {selectedRequest.rejectionReason}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>關閉</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeaveRequestList; 