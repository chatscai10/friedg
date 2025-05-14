import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  FormControl,
  FormLabel,
  Typography,
  Box,
  TextField,
  Divider,
} from '@mui/material';
import { MenuItem as ProductItem, OptionGroup, OptionChoice } from '@/types/menu.types';
import { CartItemOption } from '@/types/cart.types';

interface OptionSelectionDialogProps {
  open: boolean;
  item: ProductItem | null;
  onClose: () => void;
  onAddToCart: (item: ProductItem, quantity: number, selectedOptions: CartItemOption[]) => void;
}

const OptionSelectionDialog: React.FC<OptionSelectionDialogProps> = ({ open, item, onClose, onAddToCart }) => {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, CartItemOption | CartItemOption[]>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [currentPrice, setCurrentPrice] = useState<number>(item?.price || 0);

  useEffect(() => {
    if (item) {
      const initialSelections: Record<string, CartItemOption | CartItemOption[]> = {};
      item.optionGroups?.forEach(group => {
        if (group.type === 'single') {
          const defaultOption = group.options.find(opt => opt.isDefault) || (group.isRequired ? group.options[0] : null);
          if (defaultOption) {
            initialSelections[group.id] = { 
              name: defaultOption.name, 
              value: defaultOption.value, 
              priceAdjustment: defaultOption.priceAdjustment 
            };
          }
        } else { // multiple
          initialSelections[group.id] = group.options.filter(opt => opt.isDefault).map(opt => ({ 
            name: opt.name, 
            value: opt.value, 
            priceAdjustment: opt.priceAdjustment 
          }));
        }
      });
      setSelectedOptions(initialSelections);
      setQuantity(1);
    } else {
      setSelectedOptions({});
      setQuantity(1);
    }
  }, [item]);

  useEffect(() => {
    if (item) {
      let calculatedPrice = item.price;
      Object.values(selectedOptions).forEach(selection => {
        if (Array.isArray(selection)) { // Multiple choice group
          selection.forEach(opt => {
            calculatedPrice += opt.priceAdjustment || 0;
          });
        } else if (selection) { // Single choice group
          calculatedPrice += selection.priceAdjustment || 0;
        }
      });
      setCurrentPrice(calculatedPrice * quantity);
    }
  }, [item, selectedOptions, quantity]);

  const handleOptionChange = (group: OptionGroup, choice: OptionChoice) => {
    setSelectedOptions(prev => {
      const newSelections = { ...prev };
      if (group.type === 'single') {
        newSelections[group.id] = { name: choice.name, value: choice.value, priceAdjustment: choice.priceAdjustment };
      } else { // multiple
        const currentGroupSelections = (newSelections[group.id] as CartItemOption[] || []);
        const choiceIndex = currentGroupSelections.findIndex(opt => opt.value === choice.value);
        if (choiceIndex > -1) {
          newSelections[group.id] = currentGroupSelections.filter(opt => opt.value !== choice.value);
        } else {
          newSelections[group.id] = [...currentGroupSelections, { name: choice.name, value: choice.value, priceAdjustment: choice.priceAdjustment }];
        }
      }
      return newSelections;
    });
  };

  const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(event.target.value, 10);
    if (!isNaN(val) && val > 0) {
      setQuantity(val);
    } else if (event.target.value === '' || val <=0) {
      setQuantity(1); // Reset to 1 if empty or invalid
    }
  };

  const handleSubmit = () => {
    if (!item) return;
    // Validate required options
    for (const group of item.optionGroups || []) {
      if (group.isRequired) {
        const selection = selectedOptions[group.id];
        if (!selection || (Array.isArray(selection) && selection.length === 0)) {
          alert(`請選擇 ${group.name} 的選項。`); // TODO: Replace with MUI Alert or Notification
          return;
        }
      }
    }

    const finalSelectedOptions: CartItemOption[] = [];
    Object.values(selectedOptions).forEach(selection => {
      if (Array.isArray(selection)) {
        finalSelectedOptions.push(...selection);
      } else if (selection) {
        finalSelectedOptions.push(selection);
      }
    });
    onAddToCart(item, quantity, finalSelectedOptions);
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{fontWeight: 'bold'}}>{item.name} - 選項與數量</DialogTitle>
      <DialogContent dividers>
        {item.optionGroups?.map(group => (
          <FormControl component="fieldset" key={group.id} margin="normal" fullWidth>
            <FormLabel component="legend" sx={{fontWeight:'medium', mb:0.5}}>
                {group.name} {group.isRequired && "(必選)"}
            </FormLabel>
            {group.type === 'single' ? (
              <RadioGroup
                value={(selectedOptions[group.id] as CartItemOption)?.value || ''}
                onChange={(e) => {
                  const choice = group.options.find(opt => opt.value === e.target.value);
                  if (choice) handleOptionChange(group, choice);
                }}
              >
                {group.options.map(choice => (
                  <FormControlLabel 
                    key={choice.value} 
                    value={choice.value} 
                    control={<Radio />} 
                    label={`${choice.name}${choice.priceAdjustment ? ` (+$${choice.priceAdjustment})` : ''}`} 
                  />
                ))}
              </RadioGroup>
            ) : ( // multiple
              <FormGroup>
                {group.options.map(choice => (
                  <FormControlLabel
                    key={choice.value}
                    control={<Checkbox 
                                checked={(selectedOptions[group.id] as CartItemOption[])?.some(opt => opt.value === choice.value) || false}
                                onChange={() => handleOptionChange(group, choice)} 
                            />}
                    label={`${choice.name}${choice.priceAdjustment ? ` (+$${choice.priceAdjustment})` : ''}`}
                  />
                ))}
              </FormGroup>
            )}
            <Divider sx={{mt:1}}/>
          </FormControl>
        ))}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1" sx={{fontWeight:'medium'}}>數量:</Typography>
            <TextField 
                type="number" 
                value={quantity} 
                onChange={handleQuantityChange} 
                inputProps={{ min: 1, style: { textAlign: 'center' } }} 
                sx={{ width: '80px' }} 
                size="small"
            />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: '16px 24px', borderTop: '1px solid rgba(0, 0, 0, 0.12)' }}>
        <Box sx={{ flexGrow: 1, textAlign: 'left'}}>
            <Typography variant="h6" sx={{fontWeight: 'bold'}}>總計: ${currentPrice.toFixed(2)}</Typography>
        </Box>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary" size="large">
          加入購物車
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OptionSelectionDialog; 