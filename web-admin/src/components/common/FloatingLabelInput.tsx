import React, { useState } from 'react';
import { 
  FormControl, 
  InputLabel, 
  Input, 
  InputProps,
  FormHelperText
} from '@mui/material';

interface FloatingLabelInputProps extends Omit<InputProps, 'endAdornment'> {
  label: string;
  helperText?: string;
  error?: boolean;
}

/**
 * 浮動標籤輸入框組件
 * 基於風格/輸入框.txt中的設計實現
 */
const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label,
  id,
  helperText,
  error = false,
  required = false,
  ...props
}) => {
  const [isFilled, setIsFilled] = useState(!!props.value);
  
  // 處理輸入變化，追蹤輸入框是否有值
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsFilled(!!e.target.value);
    if (props.onChange) {
      props.onChange(e);
    }
  };

  // 處理初始輸入值
  React.useEffect(() => {
    setIsFilled(!!props.value);
  }, [props.value]);

  return (
    <FormControl 
      className="floating-label-input" 
      error={error} 
      fullWidth={props.fullWidth}
    >
      <Input
        id={id || `floating-input-${label.toLowerCase().replace(/\s+/g, '-')}`}
        {...props}
        onChange={handleChange}
        classes={{
          root: isFilled ? 'Mui-filled' : ''
        }}
        disableUnderline
      />
      <InputLabel 
        htmlFor={id || `floating-input-${label.toLowerCase().replace(/\s+/g, '-')}`}
        required={required}
      >
        {label}
      </InputLabel>
      {helperText && (
        <FormHelperText>{helperText}</FormHelperText>
      )}
    </FormControl>
  );
};

export default FloatingLabelInput; 