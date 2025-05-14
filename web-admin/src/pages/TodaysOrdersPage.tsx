import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert, List, ListItem, ListItemText, Divider, Chip, Button, Select, MenuItem, FormControl, InputLabel, SelectChangeEvent, Container } from '@mui/material';
import { updateOrderStatus } from '../../services/posService'; // 保留 updateOrderStatus
import { Order, OrderStatus as WebAdminOrderStatus } from '../../types/order'; // Use Order type from web-admin
import { useAuth } from '../../contexts/AuthContext'; // Assuming AuthContext is available for web-admin
import { firestore } from '../../config/firebase'; // 引入 firestore
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp, DocumentData } from 'firebase/firestore'; // 引入所需函數
import { getOrderStatusText, ORDER_STATUS_MAP } from '../../utils/orderUtils'; // 引入訂單狀態工具
import { useNotification } from '../../hooks/useNotification'; // <--- 導入 useNotification

// Define OrderItem specifically for this page if structure differs significantly or for clarity
// For now, using WebAdminOrderItem from ../../types/order

const TodaysOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { getIdToken, user } = useAuth(); // Get ID token and user from AuthContext
  const { addNotification } = useNotification(); // <--- 使用 useNotification
  const audioRef = useRef<HTMLAudioElement>(null); // Ref for audio element
  const previousOrderIds = useRef<Set<string>>(new Set()); // Ref to store previous order IDs

  useEffect(() => {
    if (!user) {
      setError('用戶未登入，無法載入訂單。');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Start of tomorrow

    const ordersRef = collection(firestore, 'orders');
    // 查詢今天創建的訂單，按創建時間降序排列，最多50筆
    // 注意: Firestore 的 Timestamp 對象比較
    const q = query(ordersRef, 
                    where('createdAt', '>=', Timestamp.fromDate(today)), 
                    where('createdAt', '<', Timestamp.fromDate(tomorrow)), 
                    orderBy('createdAt', 'desc'), 
                    limit(50));

    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const fetchedOrders: Order[] = [];
        let hasNewOrder = false;
        const currentOrderIds = new Set<string>();

        querySnapshot.forEach((doc) => {
          currentOrderIds.add(doc.id);
          if (!previousOrderIds.current.has(doc.id)) {
            hasNewOrder = true;
          }
          const orderData = doc.data() as DocumentData;
          fetchedOrders.push({
            id: doc.id,
            orderNumber: orderData.orderNumber,
            customerId: orderData.customerId,
            items: orderData.items,
            totalAmount: orderData.totalAmount,
            status: orderData.status,
            paymentMethod: orderData.paymentMethod,
            pickupMethod: orderData.pickupMethod,
            pickupTime: orderData.pickupTime, // 可能是 Timestamp 或 string
            createdAt: orderData.createdAt, // 可能是 Timestamp
            updatedAt: orderData.updatedAt, // 可能是 Timestamp
            storeId: orderData.storeId,
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            orderNotes: orderData.orderNotes,
            // totalPrice 是舊欄位，新模型用 totalAmount，這裡兼容處理或確保數據模型一致
            totalPrice: orderData.totalAmount !== undefined ? orderData.totalAmount : (orderData.totalPrice || 0),
          } as Order);
        });

        setOrders(fetchedOrders);
        setLoading(false);

        if (hasNewOrder && previousOrderIds.current.size > 0) { // Avoid sound on initial load
          addNotification('有新的訂單進來了！', 'info'); // <--- 使用真實的 addNotification
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.warn("Error playing sound:", e));
          }
        }
        previousOrderIds.current = currentOrderIds; // Update previous order IDs

      },
      (err) => {
        console.error("Error listening to recent orders:", err);
        setError(err.message || '獲取今日訂單失敗，請稍後再試。');
        setLoading(false);
      }
    );

    return () => unsubscribe(); // 清理監聽器

  }, [user]); // 依賴 user 即可，getIdToken 會在 handleStatusChange 中獲取

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const originalOrders = [...orders];
    setOrders(prevOrders => 
        prevOrders.map(o => o.id === orderId ? { ...o, status: newStatus as WebAdminOrderStatus } : o)
    );
    setError(null);

    try {
        const idToken = await getIdToken();
        if (!idToken) {
            throw new Error('無法獲取用戶認證信息以更新訂單狀態。');
        }
        const updatedOrder = await updateOrderStatus(orderId, newStatus, idToken);
        // onSnapshot 會自動更新，這裡可以移除手動更新，或保留以提供更即時的樂觀更新視覺效果
        // 為簡化，暫時移除，依賴 onSnapshot
        addNotification(`訂單 ${orderId.substring(0,6)} 狀態已更新為 ${getOrderStatusText(newStatus as WebAdminOrderStatus)}`, 'success'); // <--- 使用真實的 addNotification
    } catch (err: any) {
        console.error(`Error updating order ${orderId} to status ${newStatus}:`, err);
        const errorMessage = `更新訂單 ${orderId.substring(0,6)} 狀態失敗: ${err.message || '請稍後再試'}`;
        setError(errorMessage);
        addNotification(errorMessage, 'error'); // <--- 使用真實的 addNotification 顯示錯誤
        setOrders(originalOrders);
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
        let date;
        if (timestamp instanceof Timestamp) {
          date = timestamp.toDate();
        } else if (timestamp.toDate && typeof timestamp.toDate === 'function') {
          date = timestamp.toDate();
        } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
          date = new Date(timestamp);
        } else {
          return 'Invalid Date';
        }
        return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
        console.error("Error formatting date:", e, "Timestamp:", timestamp);
        return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}> {/* Using Container and minHeight like PWA */}
        <Box textAlign="center">
            <CircularProgress size={60} sx={{mb: 2}}/>
            <Typography variant="h6">載入今日訂單中...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom component="h1">
        今日訂單 (最近50筆)
      </Typography>
      {/* Audio element for notification sound - 確保此文件存在於 web-admin/public/assets/sounds/ 目錄下 */}
      <audio ref={audioRef} src="/assets/sounds/new_order_sound.mp3" preload="auto"></audio>

      {orders.length === 0 ? (
        <Typography>目前沒有待處理的訂單。</Typography>
      ) : (
        <List component={Paper} elevation={3}>
          {orders.map((order, index) => (
            <React.Fragment key={order.id}>
              <ListItem alignItems="flex-start">
                <ListItemText
                  primary={`訂單號: ${order.orderNumber || order.id}`}
                  secondary={
                    <React.Fragment>
                      <Typography component="span" variant="body2" color="text.primary">
                        時間: {formatDate(order.createdAt)} | 總金額: ${order.totalAmount.toFixed(2)}
                      </Typography>
                      <br />
                      狀態: <Chip label={getOrderStatusText(order.status)} size="small" color={getOrderStatusChipColor(order.status)} />
                      <br />
                      項目: {order.items.map(item => `${item.name} x ${item.quantity}`).join(', ')}
                      {/* Order Status Update Controls */}
                      <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant="body2">更新狀態:</Typography>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel id={`status-select-label-${order.id}`}>狀態</InputLabel>
                          <Select
                            labelId={`status-select-label-${order.id}`}
                            value={order.status}
                            label="狀態"
                            onChange={(e: SelectChangeEvent<string>) => handleStatusChange(order.id, e.target.value as WebAdminOrderStatus)}
                          >
                            {Object.entries(ORDER_STATUS_MAP).map(([statusKey, statusValue]) => (
                              <MenuItem key={statusKey} value={statusKey as WebAdminOrderStatus}>{statusValue.text}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                    </React.Fragment>
                  }
                />
                {/* Add actions here if needed, e.g., view details, print, update status */}
              </ListItem>
              {index < orders.length - 1 && <Divider component="li" />}
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );
};

export default TodaysOrdersPage; 