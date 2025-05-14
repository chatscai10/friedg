import React, { createContext, useState, ReactNode, useMemo, useCallback, useEffect } from 'react';
import { CartItem, CartItemOption } from '@/types/cart.types';
import { MenuItem as ProductItem } from '@/types/menu.types'; // Renaming to avoid confusion

interface CartContextType {
  cartItems: CartItem[];
  addItemToCart: (item: ProductItem, quantity?: number, options?: CartItemOption[]) => void;
  removeItemFromCart: (itemId: string) => void;
  updateItemQuantity: (itemId: string, newQuantity: number) => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  clearCart: () => void;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    // Load cart from localStorage on initial render
    try {
      const localData = localStorage.getItem('customerCart');
      return localData ? JSON.parse(localData) : [];
    } catch (error) {
      console.error("Error loading cart from localStorage:", error);
      return [];
    }
  });

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('customerCart', JSON.stringify(cartItems));
    } catch (error) {
      console.error("Error saving cart to localStorage:", error);
    }
  }, [cartItems]);

  const addItemToCart = useCallback((product: ProductItem, quantity: number = 1, options?: CartItemOption[]) => {
    setCartItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(item => item.id === product.id && JSON.stringify(item.selectedOptions) === JSON.stringify(options));
      if (existingItemIndex > -1) {
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex].quantity += quantity;
        return updatedItems;
      } else {
        const newItem: CartItem = {
          id: product.id,
          name: product.name,
          price: product.price, // Consider options price adjustments here if any
          quantity: quantity,
          imageUrl: product.imageUrl,
          selectedOptions: options,
        };
        return [...prevItems, newItem];
      }
    });
  }, []);

  const removeItemFromCart = useCallback((itemId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  }, []);

  const updateItemQuantity = useCallback((itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItemFromCart(itemId);
    } else {
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  }, [removeItemFromCart]);

  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => {
      let itemPrice = item.price;
      // Add option price adjustments if applicable
      if (item.selectedOptions) {
        item.selectedOptions.forEach(opt => {
          if (opt.priceAdjustment) {
            itemPrice += opt.priceAdjustment;
          }
        });
      }
      return total + itemPrice * item.quantity;
    }, 0);
  }, [cartItems]);

  const getCartItemCount = useCallback(() => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cartItems]);
  
  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const contextValue = useMemo(() => ({
    cartItems,
    addItemToCart,
    removeItemFromCart,
    updateItemQuantity,
    getCartTotal,
    getCartItemCount,
    clearCart,
  }), [cartItems, addItemToCart, removeItemFromCart, updateItemQuantity, getCartTotal, getCartItemCount, clearCart]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}; 