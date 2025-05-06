import * as React from 'react';
import { Typography, TypographyProps, styled, keyframes } from '@mui/material';

// 定義動畫效果
const shine = keyframes`
  0% {
    background-position: 0;
  }
  60% {
    background-position: 180px;
  }
  100% {
    background-position: 180px;
  }
`;

// 定義樣式化文字組件
const StyledTypography = styled(Typography)(() => ({
  padding: '12px 0',
  color: '#fff',
  background: 'linear-gradient(to right, #9f9f9f 0, #fff 10%, #868686 20%)',
  backgroundPosition: '0',
  backgroundSize: '180px',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  animation: `${shine} 3s infinite linear`,
  animationFillMode: 'forwards',
  fontWeight: 600,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  display: 'inline-block',
  fontSize: 'inherit',
  // 可選是否為連結
  '&.link': {
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'none',
    },
  },
}));

// 組件接口定義
interface ShiningTextProps extends TypographyProps {
  isLink?: boolean;
  href?: string;
}

/**
 * 質感白色燈光效果文字元件
 * 基於風格/文字-質感白色燈.txt實現的發光文字效果
 */
const ShiningText: React.FC<ShiningTextProps> = ({
  children,
  isLink = false,
  href,
  className = '',
  ...props
}) => {
  // 確定組件類型
  const componentType = isLink ? 'a' : props.component || 'span';
  
  // 處理類別名稱
  const combinedClassName = `${className} ${isLink ? 'link' : ''}`.trim();

  // 處理href屬性
  const additionalProps: Record<string, unknown> = {};
  if (isLink && href) {
    additionalProps.href = href;
  }

  return (
    <StyledTypography
      component={componentType}
      className={combinedClassName}
      {...props}
      {...additionalProps}
    >
      {children}
    </StyledTypography>
  );
};

export default ShiningText; 