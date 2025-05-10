import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Button,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Avatar,
  SelectChangeEvent,
  Snackbar,
  Alert,
  Tooltip,
  Stack,
  Chip
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Receipt as ReceiptIcon,
  LocalDining as DiningIcon,
  DirectionsWalk as TakeoutIcon,
  Print as PrintIcon,
  Campaign as CampaignIcon,
  Save as SaveIcon,
  Folder as FolderIcon,
  Payment as PaymentIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import { usePosOrder } from '../../contexts/PosOrderContext';
import { createPosOrder, printOrderReceipt, callPickupNumber, saveOrderDraft, getOrderDrafts } from '../../services/posService';
import { Order } from '../../types/order';

// 訂單操作狀態接口
interface OrderActionState {
  loading: boolean;
  success: boolean;
  error: string | null;
  orderId: string | null;
  orderNumber: string | null;
}

// 定義訂單草稿接口
interface OrderDraft {
  draftId: string;
  orderData: Partial<Order>;
  savedAt: string;
}

const PosOrderPanel: React.FC = () => {
  const { 
    state, 
    updateQuantity, 
    removeItem, 
    clearOrder, 
    setNote,
    setOrderType,
    setTableNumber
  } = usePosOrder();
  
  // 各操作狀態
  const [checkoutState, setCheckoutState] = useState<OrderActionState>({
    loading: false,
    success: false,
    error: null,
    orderId: null,
    orderNumber: null
  });
  
  const [printState, setPrintState] = useState({
    loading: false,
    success: false,
    error: null
  });
  
  const [callState, setCallState] = useState({
    loading: false,
    success: false,
    error: null
  });
  
  const [saveState, setSaveState] = useState({
    loading: false,
    success: false,
    error: null,
    draftId: null
  });
  
  // 對話框控制
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLoadDraftsDialog, setShowLoadDraftsDialog] = useState(false);
  const [availableDrafts, setAvailableDrafts] = useState<OrderDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  
  // 提示訊息控制
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState('');
  
  // 處理數量變更
  const handleQuantityChange = (id: string, delta: number, currentQuantity: number) => {
    const newQuantity = Math.max(1, currentQuantity + delta);
    updateQuantity(id, newQuantity);
  };
  
  // 處理直接輸入數量
  const handleQuantityInput = (id: string, value: string) => {
    const quantity = parseInt(value, 10);
    if (!isNaN(quantity) && quantity > 0) {
      updateQuantity(id, quantity);
    }
  };
  
  // 處理刪除商品
  const handleRemoveItem = (id: string) => {
    removeItem(id);
  };
  
  // 處理訂單類型變更
  const handleOrderTypeChange = (event: SelectChangeEvent) => {
    setOrderType(event.target.value as 'dine-in' | 'takeout' | 'delivery');
  };
  
  // 處理桌號變更
  const handleTableNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTableNumber(event.target.value);
  };
  
  // 處理備註變更
  const handleNoteChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNote(event.target.value);
  };
  
  // 確認清空訂單
  const handleClearOrderConfirm = () => {
    setShowClearConfirm(true);
  };
  
  // 取消清空訂單
  const handleCancelClear = () => {
    setShowClearConfirm(false);
  };
  
  // 執行清空訂單
  const handleConfirmClear = () => {
    clearOrder();
    setShowClearConfirm(false);
  };
  
  // 處理 Snackbar 關閉
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };
  
  // 顯示提示訊息
  const showMessage = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };
  
  // 結帳/送出訂單
  const handleCheckout = async () => {
    if (state.items.length === 0) {
      showMessage('訂單中沒有商品', 'warning');
      return;
    }
    
    try {
      setCheckoutState({ ...checkoutState, loading: true, error: null });
      
      // 準備訂單數據
      const orderData = {
        orderType: state.orderType,
        items: state.items,
        subtotal: state.subtotal,
        tax: state.tax,
        totalPrice: state.total,
        note: state.note,
        tableNumber: state.tableNumber,
        storeId: 'default_store', // 實際應用中從 context 或登入資料獲取
        paymentStatus: 'unpaid' as const, // 設置為 unpaid，稍後再處理支付
        paymentMethod: null // 初始未指定支付方式
      };
      
      // 呼叫 API 創建訂單
      const newOrder = await createPosOrder(orderData);
      
      setCheckoutState({
        loading: false,
        success: true,
        error: null,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber
      });
      
      showMessage(`訂單 #${newOrder.orderNumber} 已成功建立`, 'success');
      
      // 清空當前訂單
      clearOrder();
      
    } catch (error) {
      console.error('結帳失敗:', error);
      setCheckoutState({
        ...checkoutState,
        loading: false,
        success: false,
        error: '結帳失敗，請稍後再試',
        orderId: null,
        orderNumber: null
      });
      
      showMessage('結帳失敗，請稍後再試', 'error');
    }
  };
  
  // 列印訂單收據
  const handlePrintReceipt = async () => {
    if (!checkoutState.orderId) {
      showMessage('沒有可列印的訂單', 'warning');
      return;
    }
    
    try {
      setPrintState({ ...printState, loading: true, error: null });
      
      // 呼叫 API 列印收據
      const result = await printOrderReceipt(checkoutState.orderId);
      
      setPrintState({
        loading: false,
        success: true,
        error: null
      });
      
      showMessage(result.message || '列印請求已發送', 'success');
      
    } catch (error) {
      console.error('列印收據失敗:', error);
      setPrintState({
        ...printState,
        loading: false,
        success: false,
        error: '列印收據失敗，請稍後再試'
      });
      
      showMessage('列印收據失敗，請稍後再試', 'error');
    }
  };
  
  // 叫號通知取餐
  const handleCallPickup = async () => {
    if (!checkoutState.orderNumber) {
      showMessage('沒有可叫號的訂單', 'warning');
      return;
    }
    
    try {
      setCallState({ ...callState, loading: true, error: null });
      
      // 叫號 API
      const storeId = 'default_store'; // 實際應用中從 context 或登入資料獲取
      const result = await callPickupNumber(storeId, checkoutState.orderNumber);
      
      setCallState({
        loading: false,
        success: true,
        error: null
      });
      
      showMessage(result.message || '叫號成功', 'success');
      
    } catch (error) {
      console.error('叫號失敗:', error);
      setCallState({
        ...callState,
        loading: false,
        success: false,
        error: '叫號失敗，請稍後再試'
      });
      
      showMessage('叫號失敗，請稍後再試', 'error');
    }
  };
  
  // 暫存訂單
  const handleSaveOrder = async () => {
    if (state.items.length === 0) {
      showMessage('訂單中沒有商品', 'warning');
      return;
    }
    
    try {
      setSaveState({ ...saveState, loading: true, error: null });
      
      // 準備訂單數據
      const orderData = {
        orderType: state.orderType,
        items: state.items,
        subtotal: state.subtotal,
        tax: state.tax,
        totalPrice: state.total,
        note: state.note,
        tableNumber: state.tableNumber
      };
      
      // 呼叫 API 保存訂單草稿
      const result = await saveOrderDraft(orderData);
      
      setSaveState({
        loading: false,
        success: true,
        error: null,
        draftId: result.draftId
      });
      
      showMessage(result.message || '訂單已暫存', 'success');
      
    } catch (error) {
      console.error('暫存訂單失敗:', error);
      setSaveState({
        ...saveState,
        loading: false,
        success: false,
        error: '暫存訂單失敗，請稍後再試',
        draftId: null
      });
      
      showMessage('暫存訂單失敗，請稍後再試', 'error');
    }
  };
  
  // 載入訂單草稿對話框
  const handleOpenLoadDraftsDialog = async () => {
    setShowLoadDraftsDialog(true);
    setDraftsLoading(true);
    
    try {
      // 獲取訂單草稿列表
      const storeId = 'default_store'; // 實際應用中從 context 或登入資料獲取
      const drafts = await getOrderDrafts(storeId);
      setAvailableDrafts(drafts);
    } catch (error) {
      console.error('獲取訂單草稿列表失敗:', error);
      showMessage('獲取訂單草稿列表失敗', 'error');
    } finally {
      setDraftsLoading(false);
    }
  };
  
  // 關閉訂單草稿對話框
  const handleCloseLoadDraftsDialog = () => {
    setShowLoadDraftsDialog(false);
  };
  
  // 載入訂單草稿
  const handleLoadDraft = (draft: OrderDraft) => {
    // 實際實現中應載入草稿到 PosOrderContext
    console.log('載入草稿:', draft);
    setShowLoadDraftsDialog(false);
    showMessage('訂單草稿已載入', 'success');
  };
  
  // 打開備註對話框
  const handleOpenNoteDialog = () => {
    setCurrentNote(''); // 重置備註
    setNoteDialogOpen(true);
  };
  
  // 關閉備註對話框
  const handleCloseNoteDialog = () => {
    setNoteDialogOpen(false);
  };
  
  // 保存備註
  const handleSaveNote = () => {
    setNote(currentNote);
    setNoteDialogOpen(false);
  };
  
  return (
    <Paper elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 訂單標題 */}
      <Box p={2} bgcolor="primary.main" color="primary.contrastText">
        <Typography variant="h6">當前訂單</Typography>
      </Box>
      
      {/* 訂單類型選擇 */}
      <Box p={2} display="flex" alignItems="center" justifyContent="space-between">
        <FormControl variant="outlined" size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="order-type-label">訂單類型</InputLabel>
          <Select
            labelId="order-type-label"
            value={state.orderType}
            onChange={handleOrderTypeChange}
            label="訂單類型"
          >
            <MenuItem value="dine-in">
              <Box display="flex" alignItems="center">
                <DiningIcon fontSize="small" sx={{ mr: 1 }} />
                <Typography>內用</Typography>
              </Box>
            </MenuItem>
            <MenuItem value="takeout">
              <Box display="flex" alignItems="center">
                <TakeoutIcon fontSize="small" sx={{ mr: 1 }} />
                <Typography>外帶</Typography>
              </Box>
            </MenuItem>
          </Select>
        </FormControl>
        
        {state.orderType === 'dine-in' && (
          <TextField
            label="桌號"
            variant="outlined"
            size="small"
            value={state.tableNumber || ''}
            onChange={handleTableNumberChange}
            sx={{ width: '100px', ml: 2 }}
          />
        )}
      </Box>
      
      <Divider />
      
      {/* 訂單項目列表 */}
      <Box flex={1} overflow="auto">
        {state.items.length === 0 ? (
          <Box p={4} textAlign="center">
            <Typography color="text.secondary">訂單中尚無商品</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {state.items.map((item) => (
              <ListItem key={item.id} divider>
                <Box mr={2}>
                  {item.menuItemImage ? (
                    <Avatar alt={item.menuItemName} src={item.menuItemImage} variant="rounded" />
                  ) : (
                    <Avatar variant="rounded"><ReceiptIcon /></Avatar>
                  )}
                </Box>
                <ListItemText
                  primary={item.menuItemName}
                  secondary={`NT$ ${item.unitPrice} x ${item.quantity} = NT$ ${item.totalPrice}`}
                  primaryTypographyProps={{ variant: 'subtitle2' }}
                />
                <ListItemSecondaryAction>
                  <Box display="flex" alignItems="center">
                    <IconButton 
                      size="small" 
                      onClick={() => handleQuantityChange(item.id!, -1, item.quantity)} 
                      aria-label="減少數量"
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    
                    <TextField
                      value={item.quantity}
                      onChange={(e) => handleQuantityInput(item.id!, e.target.value)}
                      variant="outlined"
                      size="small"
                      inputProps={{ min: 1, style: { textAlign: 'center', width: '30px' } }}
                      sx={{ mx: 0.5 }}
                    />
                    
                    <IconButton 
                      size="small" 
                      onClick={() => handleQuantityChange(item.id!, 1, item.quantity)} 
                      aria-label="增加數量"
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                    
                    <IconButton 
                      size="small" 
                      onClick={() => handleRemoveItem(item.id!)} 
                      aria-label="移除"
                      sx={{ ml: 1 }}
                    >
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
      
      {/* 訂單備註 */}
      <Box p={2}>
        <TextField
          fullWidth
          label="訂單備註"
          variant="outlined"
          multiline
          rows={2}
          value={state.note}
          onChange={handleNoteChange}
          placeholder="請輸入特殊要求或備註"
        />
      </Box>
      
      <Divider />
      
      {/* 訂單摘要 */}
      <Box p={2}>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography>小計</Typography>
          <Typography>NT$ {state.subtotal}</Typography>
        </Box>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography>稅金</Typography>
          <Typography>NT$ {state.tax}</Typography>
        </Box>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography variant="h6">總計</Typography>
          <Typography variant="h6">NT$ {state.total}</Typography>
        </Box>
      </Box>
      
      {/* 操作按鈕區 - 第一行：訂單管理 */}
      <Box p={2} pt={0}>
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Button 
              fullWidth 
              variant="outlined" 
              color="primary"
              onClick={handleClearOrderConfirm}
              disabled={state.items.length === 0}
              startIcon={<DeleteIcon />}
            >
              清空
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button 
              fullWidth 
              variant="contained" 
              color="primary"
              onClick={handleCheckout}
              disabled={state.items.length === 0 || checkoutState.loading}
              startIcon={<PaymentIcon />}
            >
              {checkoutState.loading ? '處理中...' : '結帳'}
            </Button>
          </Grid>
        </Grid>
      </Box>
      
      {/* 操作按鈕區 - 第二行：暫存/載入 */}
      <Box px={2} pb={1}>
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Button 
              fullWidth 
              variant="outlined" 
              color="info"
              onClick={handleSaveOrder}
              disabled={state.items.length === 0 || saveState.loading}
              startIcon={<SaveIcon />}
            >
              {saveState.loading ? '儲存中...' : '暫存訂單'}
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button 
              fullWidth 
              variant="outlined" 
              color="info"
              onClick={handleOpenLoadDraftsDialog}
              startIcon={<FolderIcon />}
            >
              載入訂單
            </Button>
          </Grid>
        </Grid>
      </Box>
      
      {/* 操作按鈕區 - 第三行：列印/叫號 (只在有完成訂單後顯示) */}
      {checkoutState.success && checkoutState.orderId && (
        <Box px={2} pb={2}>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Tooltip title="列印收據">
                <Button 
                  fullWidth 
                  variant="outlined" 
                  color="success"
                  onClick={handlePrintReceipt}
                  disabled={printState.loading}
                  startIcon={<PrintIcon />}
                >
                  {printState.loading ? '列印中...' : '列印收據'}
                </Button>
              </Tooltip>
            </Grid>
            <Grid item xs={6}>
              <Tooltip title="叫號通知取餐">
                <Button 
                  fullWidth 
                  variant="outlined" 
                  color="warning"
                  onClick={handleCallPickup}
                  disabled={callState.loading}
                  startIcon={<CampaignIcon />}
                >
                  {callState.loading ? '叫號中...' : '叫號'}
                </Button>
              </Tooltip>
            </Grid>
          </Grid>
        </Box>
      )}
      
      {/* 清空訂單確認對話框 */}
      <Dialog
        open={showClearConfirm}
        onClose={handleCancelClear}
        aria-labelledby="clear-order-dialog-title"
      >
        <DialogTitle id="clear-order-dialog-title">確認清空訂單</DialogTitle>
        <DialogContent>
          <Typography>您確定要清空當前訂單嗎？此操作無法撤銷。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelClear} color="primary">
            取消
          </Button>
          <Button onClick={handleConfirmClear} color="error" variant="contained">
            確認清空
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 訂單草稿對話框 */}
      <Dialog
        open={showLoadDraftsDialog}
        onClose={handleCloseLoadDraftsDialog}
        aria-labelledby="load-drafts-dialog-title"
        maxWidth="md"
        fullWidth
      >
        <DialogTitle id="load-drafts-dialog-title">載入訂單草稿</DialogTitle>
        <DialogContent>
          {draftsLoading ? (
            <Box p={4} textAlign="center">
              <Typography>載入中...</Typography>
            </Box>
          ) : availableDrafts.length === 0 ? (
            <Box p={4} textAlign="center">
              <Typography>沒有可用的訂單草稿</Typography>
            </Box>
          ) : (
            <List>
              {availableDrafts.map((draft) => (
                <ListItem key={draft.draftId} button onClick={() => handleLoadDraft(draft)}>
                  <ListItemText
                    primary={`草稿 #${draft.draftId.split('_')[1]}`}
                    secondary={`儲存時間: ${new Date(draft.savedAt).toLocaleString()}`}
                  />
                  <Typography variant="body2">
                    {draft.orderData.orderType === 'dine-in' ? '內用' : '外帶'} | 
                    {draft.orderData.items.length} 項商品 | 
                    NT$ {draft.orderData.totalPrice}
                  </Typography>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLoadDraftsDialog} color="primary">
            取消
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 備註對話框 */}
      <Dialog open={noteDialogOpen} onClose={handleCloseNoteDialog}>
        <DialogTitle>添加訂單備註</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="訂單備註"
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNoteDialog}>取消</Button>
          <Button onClick={handleSaveNote} color="primary">
            保存
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 通知訊息 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default PosOrderPanel; 