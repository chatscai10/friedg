import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Typography,
  Alert,
  CircularProgress
} from '@mui/material';
import { useSpecialPermissions } from '../../hooks/usePermission';
import { logAction } from '../../services/auditLogService';
import { AuditAction, AuditEntityType } from '../../types/audit';

interface PosDiscountDialogProps {
  open: boolean;
  onClose: () => void;
  onApplyDiscount: (discountData: { type: 'percentage' | 'amount', value: number }) => void;
  orderTotal: number;
  orderId?: string;
}

const PosDiscountDialog: React.FC<PosDiscountDialogProps> = ({
  open,
  onClose,
  onApplyDiscount,
  orderTotal,
  orderId
}) => {
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { loading, permissions } = useSpecialPermissions();

  // 重置表單在對話框打開時
  useEffect(() => {
    if (open) {
      setDiscountType('percentage');
      setDiscountValue('');
      setError(null);
    }
  }, [open]);

  // 處理折扣類型變更
  const handleTypeChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setDiscountType(event.target.value as 'percentage' | 'amount');
    setDiscountValue('');
    setError(null);
  };

  // 處理折扣值輸入
  const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // 只允許數字和小數點
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setDiscountValue(value);
      setError(null);
    }
  };

  // 驗證並應用折扣
  const handleApplyDiscount = () => {
    // 轉換折扣值為數字
    const numericValue = parseFloat(discountValue);
    
    // 檢查是否為有效數字
    if (isNaN(numericValue) || numericValue <= 0) {
      setError('請輸入有效的折扣值');
      return;
    }
    
    // 權限檢查 - 是否有折扣權限
    if (!permissions?.canDiscount) {
      setError('您沒有套用折扣的權限');
      return;
    }
    
    // 百分比折扣特殊檢查
    if (discountType === 'percentage') {
      // 檢查百分比範圍
      if (numericValue > 100) {
        setError('折扣百分比不能超過100%');
        return;
      }
      
      // 檢查最大折扣百分比權限
      if (permissions?.maxDiscountPercentage !== undefined && 
          numericValue > permissions.maxDiscountPercentage) {
        setError(`您的折扣權限上限為 ${permissions.maxDiscountPercentage}%`);
        return;
      }
    } else {
      // 金額折扣檢查
      if (numericValue > orderTotal) {
        setError('折扣金額不能超過訂單總額');
        return;
      }
      
      // 計算等效百分比來檢查權限
      const discountPercentage = (numericValue / orderTotal) * 100;
      if (permissions?.maxDiscountPercentage !== undefined && 
          discountPercentage > permissions.maxDiscountPercentage) {
        setError(`您的折扣權限上限為訂單總額的 ${permissions.maxDiscountPercentage}%（${(orderTotal * permissions.maxDiscountPercentage / 100).toFixed(2)} 元）`);
        return;
      }
    }
    
    // 記錄審計日誌
    if (orderId) {
      logAction({
        action: AuditAction.ORDER_DISCOUNT,
        resourceType: AuditEntityType.ORDER,
        resourceId: orderId,
        details: {
          discountType,
          discountValue: numericValue,
          orderTotal,
          discountPercentage: discountType === 'percentage' ? numericValue : (numericValue / orderTotal) * 100
        }
      }).catch(error => {
        console.error('記錄折扣操作失敗:', error);
      });
    }
    
    // 應用折扣
    onApplyDiscount({
      type: discountType,
      value: numericValue
    });
    
    // 關閉對話框
    onClose();
  };

  // 計算預覽金額
  const calculatePreview = (): string => {
    const numericValue = parseFloat(discountValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      return '0.00';
    }
    
    if (discountType === 'percentage') {
      return (orderTotal * numericValue / 100).toFixed(2);
    } else {
      return Math.min(numericValue, orderTotal).toFixed(2);
    }
  };

  // 計算折扣後總額
  const calculateFinalTotal = (): string => {
    const numericValue = parseFloat(discountValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      return orderTotal.toFixed(2);
    }
    
    if (discountType === 'percentage') {
      const discount = orderTotal * numericValue / 100;
      return (orderTotal - discount).toFixed(2);
    } else {
      const discount = Math.min(numericValue, orderTotal);
      return (orderTotal - discount).toFixed(2);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogContent>
          <CircularProgress />
          <Typography>檢查權限中...</Typography>
        </DialogContent>
      </Dialog>
    );
  }

  // 如果沒有折扣權限，顯示錯誤信息
  if (!permissions?.canDiscount) {
    return (
      <Dialog open={open} onClose={onClose}>
        <DialogTitle>套用折扣</DialogTitle>
        <DialogContent>
          <Alert severity="error">
            您沒有套用折扣的權限。請聯繫管理員或權限較高的同事協助。
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary">
            關閉
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>套用折扣</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          {permissions?.maxDiscountPercentage !== undefined && (
            <>您的折扣權限上限為: {permissions.maxDiscountPercentage}%</>
          )}
        </Typography>
        
        <FormControl fullWidth margin="normal">
          <InputLabel>折扣類型</InputLabel>
          <Select
            value={discountType}
            onChange={handleTypeChange}
            label="折扣類型"
          >
            <MenuItem value="percentage">百分比 (%)</MenuItem>
            <MenuItem value="amount">固定金額</MenuItem>
          </Select>
        </FormControl>
        
        <TextField
          fullWidth
          margin="normal"
          label={discountType === 'percentage' ? "折扣百分比" : "折扣金額"}
          value={discountValue}
          onChange={handleValueChange}
          error={!!error}
          helperText={error || (discountType === 'percentage' ? "請輸入1-100之間的百分比" : "請輸入有效金額")}
          InputProps={{
            endAdornment: <span>{discountType === 'percentage' ? '%' : '元'}</span>
          }}
        />
        
        {discountValue && (
          <Typography variant="body1" sx={{ mt: 2 }}>
            預覽：
            {discountType === 'percentage' 
              ? `${discountValue}% = ${calculatePreview()} 元`
              : `${discountValue} 元`}
            <br />
            折扣後總額：{calculateFinalTotal()} 元
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          取消
        </Button>
        <Button 
          onClick={handleApplyDiscount} 
          color="primary" 
          variant="contained"
          disabled={!discountValue || !!error || parseFloat(discountValue) <= 0}
        >
          套用折扣
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PosDiscountDialog; 