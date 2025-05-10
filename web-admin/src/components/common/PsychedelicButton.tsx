import * as React from 'react';
import { Button, ButtonProps, styled } from '@mui/material';

// 定義按鈕樣式
const StyledButton = styled(Button)(({ theme }) => ({
  position: 'relative',
  height: '64px',
  minWidth: '256px',
  padding: '12px',
  textAlign: 'left',
  fontWeight: 'bold',
  borderRadius: '8px',
  overflow: 'hidden',
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  border: `1px solid ${theme.palette.divider}`,
  textTransform: 'none',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  transition: 'all 0.5s',

  '&::before': {
    content: '""',
    position: 'absolute',
    width: '48px',
    height: '48px',
    right: '4px',
    top: '4px',
    zIndex: 10,
    backgroundColor: theme.palette.info.main,
    borderRadius: '50%',
    filter: 'blur(16px)',
    transition: 'all 0.5s',
  },

  '&::after': {
    content: '""',
    position: 'absolute',
    zIndex: 10,
    width: '80px',
    height: '80px',
    backgroundColor: theme.palette.error.main,
    right: '32px',
    top: '12px',
    borderRadius: '50%',
    filter: 'blur(16px)',
    transition: 'all 0.5s',
  },

  '&:hover': {
    borderColor: theme.palette.error.light,
    color: theme.palette.error.light,
    textDecoration: 'underline',
    textUnderlineOffset: '4px',
    textDecorationThickness: '2px',

    '&::before': {
      right: '48px',
      bottom: '-32px',
      filter: 'blur(20px)',
      boxShadow: `20px 20px 20px 30px ${theme.palette.info.dark}`,
    },

    '&::after': {
      right: '-32px',
    },
  },
}));

// PsychedelicButton元件接口
interface PsychedelicButtonProps extends ButtonProps {
  children: React.ReactNode;
}

/**
 * 迷幻風格按鈕
 * 基於風格/按鈕-迷幻.txt中的設計實現
 */
const PsychedelicButton: React.FC<PsychedelicButtonProps> = ({ children, ...props }) => {
  return (
    <StyledButton {...props}>
      {children}
    </StyledButton>
  );
};

export default PsychedelicButton; 