import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from '@auction/auth';
import { Toaster } from '@auction/ui';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { WalletPage } from './pages/WalletPage';

const queryClient = new QueryClient();
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider baseUrl={apiUrl}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <RequireAuth roles={['bidder', 'admin']}>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/wallet"
              element={
                <RequireAuth roles={['bidder']}>
                  <WalletPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
