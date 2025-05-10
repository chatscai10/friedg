import { createTheme } from '@mui/material/styles';

// 根据风格指南设置色彩方案
// 主色调：深蓝色 (#355891) - 来自风格文件「輸入表格.txt」
// 辅助色：金黄色 (#ffeba7) - 来自风格文件「黑金 登入.txt」
// 背景色：深色调 (#2a2b38) - 来自风格文件「黑金 登入.txt」
// 互动元素：紫色太空渐变效果 - 来自风格文件「按鈕-紫色太空.txt」
// 输入框：浮动标签效果 - 来自风格文件「輸入框.txt」

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#355891',
      light: '#5f82a9',
      dark: '#1c3b6a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ffeba7',
      light: '#fff0ba',
      dark: '#e6d296',
      contrastText: '#2a2b38',
    },
    background: {
      default: '#1f2029',
      paper: '#2a2b38',
    },
    error: {
      main: '#fe53bb',
    },
    warning: {
      main: '#ffdb3b',
    },
    info: {
      main: '#8f51ea',
    },
    success: {
      main: '#0044ff',
    },
    text: {
      primary: '#ffffff',
      secondary: '#e6e6e6',
      disabled: '#aaaaaa',
    },
  },
  typography: {
    fontFamily: '"Noto Sans TC", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 500,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 500,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 500,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 500,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1rem',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '5rem',
          padding: '0.6em 1.2em',
          textTransform: 'none',
          fontWeight: 'bold',
        },
        containedPrimary: {
          background: 'linear-gradient(137.48deg, #ffdb3b 10%, #fe53bb 45%, #8f51ea 67%, #0044ff 87%)',
          border: 'double 4px transparent',
          backgroundOrigin: 'border-box',
          backgroundClip: 'content-box, border-box',
          transition: '0.5s',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        },
        outlinedSecondary: {
          borderColor: '#355891',
          color: '#ffffff',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: '#355891',
              borderRadius: '5px',
            },
            '&:hover fieldset': {
              borderColor: '#5f82a9',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#ffeba7',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#355891',
            '&.Mui-focused': {
              color: '#ffeba7',
            },
          },
        },
      },
    },
    // 添加自定义的浮动标签输入框样式
    MuiFormControl: {
      styleOverrides: {
        root: {
          '&.floating-label-input': {
            margin: '1em 0',
            position: 'relative',
            '& .MuiInputBase-root': {
              fontSize: '100%',
              padding: '0.8em',
              outline: 'none',
              border: '2px solid rgba(200, 200, 200, 0.7)',
              backgroundColor: 'transparent',
              borderRadius: '20px',
              width: '100%',
              '&.Mui-focused, &.Mui-filled': {
                borderColor: 'rgb(150, 150, 200)',
                '& + .MuiFormLabel-root': {
                  transform: 'translateY(-50%) scale(0.9)',
                  margin: '0',
                  marginLeft: '1.3em',
                  padding: '0.4em',
                  backgroundColor: '#2a2b38',
                  color: '#ffeba7',
                },
              },
            },
            '& .MuiInputBase-input': {
              padding: '0.4em 0.6em',
              borderRadius: '18px',
            },
            '& .MuiFormLabel-root': {
              position: 'absolute',
              left: '0',
              padding: '0.8em',
              marginLeft: '0.5em',
              pointerEvents: 'none',
              transition: 'all 0.3s ease',
              color: 'rgba(200, 200, 200, 0.7)',
              fontSize: '100%',
              '&.Mui-focused': {
                color: '#ffeba7',
              },
            },
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#1c3b6a',
          '& .MuiTableCell-head': {
            color: '#ffffff',
            fontWeight: 'bold',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:nth-of-type(odd)': {
            backgroundColor: '#2a2b38',
          },
          '&:nth-of-type(even)': {
            backgroundColor: '#232530',
          },
          '&:hover': {
            backgroundColor: '#2e3044',
            cursor: 'pointer',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#355891',
        },
      },
    },
    MuiPaginationItem: {
      styleOverrides: {
        root: {
          borderColor: '#355891',
          '&.Mui-selected': {
            backgroundColor: '#355891',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#5f82a9',
            },
          },
        },
      },
    },
  },
});

export default theme; 