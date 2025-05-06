import * as React from 'react';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, CircularProgress, Box, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/zh-tw';

import theme from './styles/theme';
import MainLayout from './layouts/MainLayout';
import EmployeeList from './components/EmployeeManagement/EmployeeList';
import EmployeeForm from './components/EmployeeManagement/EmployeeForm';
import MenuItemList from './components/MenuManagement/MenuItemList';
import MenuItemForm from './components/MenuManagement/MenuItemForm';
import OrderList from './components/OrderManagement/OrderList';
import LoginPage from './pages/LoginPage';
import RankingExample from './components/examples/RankingExample';
import CommentBoardExample from './components/examples/CommentBoardExample';
import { authService } from './services/authService';
import { User } from 'firebase/auth';

interface ProtectedRouteProps {
  user: User | null;
  children: React.ReactElement;
}

function ProtectedRoute({ user, children }: ProtectedRouteProps): React.ReactElement {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  // Add state to store claims if needed later
  // const [userClaims, setUserClaims] = useState<Record<string, unknown> | null>(null); 

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = authService.onAuthStateChange(async (firebaseUser) => { // Make callback async
      console.log('Auth state changed:', firebaseUser);
      setUser(firebaseUser);
      
      // If user is logged in, try to get claims
      if (firebaseUser) {
        try {
          // This function forces a token refresh internally
          const claims = await authService.getCurrentUserClaims(); 
          console.log('User claims fetched in App.tsx (forced refresh):', claims);
          // setUserClaims(claims); // Store claims if needed
        } catch (error) {
          console.error("Error fetching user claims after auth state change:", error);
          // Handle error, maybe clear claims or show an error message
          // setUserClaims(null);
        }
      } else {
        // setUserClaims(null); // Clear claims on logout
      }

      setLoadingAuth(false); // Auth state determined, stop loading
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="zh-tw">
        <CssBaseline />
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/*"
              element={
                <ProtectedRoute user={user}>
                  <MainLayout>
                    <Routes>
                      <Route path="/" element={<Navigate to="/orders" replace />} />
                      <Route path="/employees" element={<EmployeeList />} />
                      <Route path="/employees/new" element={<EmployeeForm />} />
                      <Route path="/employees/edit/:id" element={<EmployeeForm isEdit />} />
                      <Route path="/menu" element={<MenuItemList />} />
                      <Route path="/menu/new" element={<MenuItemForm />} />
                      <Route path="/menu/edit/:id" element={<MenuItemForm isEdit />} />
                      <Route path="/orders" element={<OrderList />} />
                      <Route path="/ranking-example" element={<RankingExample />} />
                      <Route path="/comment-board-example" element={<CommentBoardExample />} />
                      <Route path="*" element={<Typography>頁面不存在 (404)</Typography>} />
                    </Routes>
                  </MainLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
