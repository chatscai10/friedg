import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { OrderItem } from '../types/order';
import { MenuItem } from '../types/menuItem';

// 訂單上下文狀態
interface PosOrderState {
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  note: string;
  orderType: 'dine-in' | 'takeout' | 'delivery';
  tableNumber?: string;
  discount?: {
    type: 'percentage' | 'amount';
    value: number;
    amount: number;
  };
}

// 訂單操作類型
type PosOrderAction =
  | { type: 'ADD_ITEM'; payload: MenuItem }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_ORDER' }
  | { type: 'SET_NOTE'; payload: string }
  | { type: 'SET_ORDER_TYPE'; payload: 'dine-in' | 'takeout' | 'delivery' }
  | { type: 'SET_TABLE_NUMBER'; payload: string }
  | { type: 'APPLY_DISCOUNT'; payload: { type: 'percentage' | 'amount'; value: number } }
  | { type: 'REMOVE_DISCOUNT' };

// 初始訂單狀態
const initialState: PosOrderState = {
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  note: '',
  orderType: 'dine-in',
};

// 訂單狀態計算函數
const calculateOrderTotals = (items: OrderItem[], discount?: { type: 'percentage' | 'amount'; value: number }) => {
  const subtotal = items.reduce((total, item) => total + item.totalPrice, 0);
  
  // 計算折扣金額
  let discountAmount = 0;
  if (discount) {
    if (discount.type === 'percentage') {
      discountAmount = (subtotal * discount.value) / 100;
    } else {
      discountAmount = Math.min(discount.value, subtotal); // 確保折扣不超過小計
    }
  }
  
  const tax = 0; // 稅金可依需求調整計算邏輯
  const total = subtotal - discountAmount + tax;
  
  return { subtotal, tax, total, discountAmount };
};

// 訂單狀態 reducer
const posOrderReducer = (state: PosOrderState, action: PosOrderAction): PosOrderState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const menuItem = action.payload;
      
      // 檢查是否已有相同商品在訂單中
      const existingItemIndex = state.items.findIndex(item => 
        item.menuItemId === menuItem.id && !item.specialInstructions
      );
      
      let updatedItems: OrderItem[];
      
      if (existingItemIndex >= 0) {
        // 更新現有商品數量
        updatedItems = [...state.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + 1,
          totalPrice: (updatedItems[existingItemIndex].quantity + 1) * menuItem.price
        };
      } else {
        // 新增商品
        const newItem: OrderItem = {
          id: `${menuItem.id}_${Date.now()}`, // 臨時 ID
          menuItemId: menuItem.id,
          menuItemName: menuItem.name,
          menuItemImage: menuItem.imageUrl,
          quantity: 1,
          unitPrice: menuItem.price,
          totalPrice: menuItem.price
        };
        updatedItems = [...state.items, newItem];
      }
      
      // 重新計算訂單總額，保留現有折扣
      const { subtotal, tax, total, discountAmount } = calculateOrderTotals(updatedItems, state.discount);
      
      // 更新折扣金額（如果有折扣）
      const updatedDiscount = state.discount 
        ? { ...state.discount, amount: discountAmount }
        : undefined;
      
      return {
        ...state,
        items: updatedItems,
        subtotal,
        tax,
        total,
        discount: updatedDiscount
      };
    }
    
    case 'REMOVE_ITEM': {
      const updatedItems = state.items.filter(item => item.id !== action.payload.id);
      
      // 重新計算訂單總額，保留現有折扣
      const { subtotal, tax, total, discountAmount } = calculateOrderTotals(updatedItems, state.discount);
      
      // 更新折扣金額（如果有折扣）
      const updatedDiscount = state.discount 
        ? { ...state.discount, amount: discountAmount }
        : undefined;
      
      return {
        ...state,
        items: updatedItems,
        subtotal,
        tax,
        total,
        discount: updatedDiscount
      };
    }
    
    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      
      if (quantity <= 0) {
        // 如果數量為 0 或負數，則移除商品
        return posOrderReducer(state, { type: 'REMOVE_ITEM', payload: { id } });
      }
      
      const updatedItems = state.items.map(item => {
        if (item.id === id) {
          return {
            ...item,
            quantity,
            totalPrice: quantity * (item.unitPrice || 0)
          };
        }
        return item;
      });
      
      // 重新計算訂單總額，保留現有折扣
      const { subtotal, tax, total, discountAmount } = calculateOrderTotals(updatedItems, state.discount);
      
      // 更新折扣金額（如果有折扣）
      const updatedDiscount = state.discount 
        ? { ...state.discount, amount: discountAmount }
        : undefined;
      
      return {
        ...state,
        items: updatedItems,
        subtotal,
        tax,
        total,
        discount: updatedDiscount
      };
    }
    
    case 'CLEAR_ORDER':
      return initialState;
    
    case 'SET_NOTE':
      return {
        ...state,
        note: action.payload
      };
    
    case 'SET_ORDER_TYPE':
      return {
        ...state,
        orderType: action.payload
      };
    
    case 'SET_TABLE_NUMBER':
      return {
        ...state,
        tableNumber: action.payload
      };
    
    case 'APPLY_DISCOUNT': {
      const { type, value } = action.payload;
      const { subtotal, tax, total, discountAmount } = calculateOrderTotals(state.items, { type, value });
      
      return {
        ...state,
        discount: {
          type,
          value,
          amount: discountAmount
        },
        subtotal,
        tax,
        total
      };
    }
    
    case 'REMOVE_DISCOUNT': {
      const { subtotal, tax, total } = calculateOrderTotals(state.items);
      
      return {
        ...state,
        discount: undefined,
        subtotal,
        tax,
        total
      };
    }
    
    default:
      return state;
  }
};

// Context 類型定義
interface PosOrderContextType {
  state: PosOrderState;
  dispatch: React.Dispatch<PosOrderAction>;
  addItem: (item: MenuItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearOrder: () => void;
  setNote: (note: string) => void;
  setOrderType: (type: 'dine-in' | 'takeout' | 'delivery') => void;
  setTableNumber: (tableNumber: string) => void;
  applyDiscount: (discount: { type: 'percentage' | 'amount'; value: number }) => void;
  removeDiscount: () => void;
}

// 創建 Context
const PosOrderContext = createContext<PosOrderContextType | undefined>(undefined);

// Provider 組件
export const PosOrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(posOrderReducer, initialState);
  
  // 封裝常用操作
  const addItem = (item: MenuItem) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  };
  
  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  };
  
  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };
  
  const clearOrder = () => {
    dispatch({ type: 'CLEAR_ORDER' });
  };
  
  const setNote = (note: string) => {
    dispatch({ type: 'SET_NOTE', payload: note });
  };
  
  const setOrderType = (type: 'dine-in' | 'takeout' | 'delivery') => {
    dispatch({ type: 'SET_ORDER_TYPE', payload: type });
  };
  
  const setTableNumber = (tableNumber: string) => {
    dispatch({ type: 'SET_TABLE_NUMBER', payload: tableNumber });
  };
  
  const applyDiscount = (discount: { type: 'percentage' | 'amount'; value: number }) => {
    dispatch({ type: 'APPLY_DISCOUNT', payload: discount });
  };
  
  const removeDiscount = () => {
    dispatch({ type: 'REMOVE_DISCOUNT' });
  };
  
  return (
    <PosOrderContext.Provider value={{
      state,
      dispatch,
      addItem,
      removeItem,
      updateQuantity,
      clearOrder,
      setNote,
      setOrderType,
      setTableNumber,
      applyDiscount,
      removeDiscount
    }}>
      {children}
    </PosOrderContext.Provider>
  );
};

// 自定義 Hook
export const usePosOrder = () => {
  const context = useContext(PosOrderContext);
  if (context === undefined) {
    throw new Error('usePosOrder must be used within a PosOrderProvider');
  }
  return context;
}; 