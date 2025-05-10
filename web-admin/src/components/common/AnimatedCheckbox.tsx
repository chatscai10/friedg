import React from 'react';
import { Box, styled } from '@mui/material';

// 為樣式組件定義Props接口
interface StyledCheckboxProps {
  checked?: boolean;
}

// 定義核取方塊容器
const CheckboxContainer = styled(Box)({
  position: 'relative',
  display: 'inline-block',
  width: '18px',
  height: '18px',
  margin: '10px',
});

// 定義隱藏的原生checkbox
const HiddenCheckbox = styled('input')({
  display: 'none',
});

// 定義自定義的checkbox標籤
const CheckLabel = styled('label')<StyledCheckboxProps>(({ theme }) => ({
  cursor: 'pointer',
  position: 'relative',
  margin: 'auto',
  width: '18px',
  height: '18px',
  WebkitTapHighlightColor: 'transparent',
  transform: 'translate3d(0, 0, 0)',
  '&:before': {
    content: '""',
    position: 'absolute',
    top: '-15px',
    left: '-15px',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(34,50,84,0.03)',
    opacity: 0,
    transition: 'opacity 0.2s ease',
  },
  '&:hover:before': {
    opacity: 1,
  },
  '&:hover svg': {
    stroke: theme.palette.info.main || '#4285f4',
  },
}));

// 定義SVG樣式
const CheckSvg = styled('svg')<StyledCheckboxProps>(({ theme, checked }) => ({
  position: 'relative',
  zIndex: 1,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  stroke: checked ? (theme.palette.info.main || '#4285f4') : '#c8ccd4',
  strokeWidth: 1.5,
  transform: 'translate3d(0, 0, 0)',
  transition: 'all 0.2s ease',
}));

// 定義Path樣式
const PathElement = styled('path')<StyledCheckboxProps>(({ checked }) => ({
  strokeDasharray: 60,
  strokeDashoffset: checked ? 60 : 0,
  transition: 'all 0.3s linear',
}));

// 定義Polyline樣式
const PolylineElement = styled('polyline')<StyledCheckboxProps>(({ checked }) => ({
  strokeDasharray: 22,
  strokeDashoffset: checked ? 42 : 66,
  transition: 'all 0.2s linear',
  transitionDelay: checked ? '0.15s' : '0s',
}));

// AnimatedCheckbox組件接口
interface AnimatedCheckboxProps {
  id?: string;
  name?: string;
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  label?: React.ReactNode;
}

/**
 * 藍色框變勾動畫核取方塊
 * 基於風格/打勾-藍色框變勾.txt中的設計實現
 */
const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  id,
  name,
  checked = false,
  onChange,
  disabled = false,
  label,
  ...props
}) => {
  // 生成唯一ID
  const checkboxId = id || `animated-checkbox-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <CheckboxContainer>
        <HiddenCheckbox
          type="checkbox"
          id={checkboxId}
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          {...props}
        />
        <CheckLabel htmlFor={checkboxId} checked={checked}>
          <CheckSvg width="18px" height="18px" viewBox="0 0 18 18" checked={checked}>
            <PathElement 
              d="M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z"
              checked={checked}
            />
            <PolylineElement points="1 9 7 14 15 4" checked={checked} />
          </CheckSvg>
        </CheckLabel>
      </CheckboxContainer>
      {label && (
        <Box component="span" sx={{ ml: 1, userSelect: 'none', color: disabled ? 'text.disabled' : 'text.primary' }}>
          {label}
        </Box>
      )}
    </Box>
  );
};

export default AnimatedCheckbox; 