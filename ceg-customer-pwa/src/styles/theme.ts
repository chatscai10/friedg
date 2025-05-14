import { createTheme } from '@mui/material/styles';

// Define a light theme for the customer PWA, inspired by web-admin's palette

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#355891', // Using web-admin's primary color for brand consistency
      light: '#5f82a9',
      dark: '#1c3b6a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ffeba7', // Using web-admin's secondary color
      light: '#fff0ba',
      dark: '#e6d296',
      contrastText: '#2a2b38', // Text color for secondary elements
    },
    background: {
      default: '#f4f6f8', // A light grey for background
      paper: '#ffffff',    // White for paper elements like cards
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
      disabled: 'rgba(0, 0, 0, 0.38)',
    },
    // You can add error, warning, info, success colors as needed
    error: {
      main: '#d32f2f', // Standard MUI red
    },
    warning: {
      main: '#ed6c02', // Standard MUI orange
    },
    info: {
      main: '#0288d1', // Standard MUI blue
    },
    success: {
      main: '#2e7d32', // Standard MUI green
    },
  },
  typography: {
    fontFamily: '"Noto Sans TC", "Roboto", "Helvetica", "Arial", sans-serif',
    // Define typography variants as needed, or rely on MUI defaults for a simpler setup
    // Example:
    // h1: {
    //   fontWeight: 500,
    //   fontSize: '2.2rem',
    // },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '20px', // Updated from 8px to 20px for a rounder feel
          textTransform: 'none', // Consistent with web-admin
          fontWeight: 'bold', // Added for consistency with web-admin
        },
        containedPrimary: {
          // No complex gradient for customer PWA for simplicity, uses palette.primary.main
        },
        // Add other button variants if specific styling is needed
      },
    },
    MuiAppBar: {
        styleOverrides: {
            root: {
                // Example: Making AppBar background consistent with primary color
                // backgroundColor: '#355891', // or rely on default theme behavior
            }
        }
    }
    // Add other component overrides as UI development progresses
  },
});

export default theme; 