import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from '@auction/auth';
import { Toaster } from '@auction/ui';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';

const queryClient = new QueryClient();
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const APPS_BY_ROLE = {
  admin: import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:5175',
  bidder: import.meta.env.VITE_BIDDER_URL ?? 'http://localhost:5174',
  client: import.meta.env.VITE_CLIENT_URL ?? 'http://localhost:5173',
} as const;

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider baseUrl={apiUrl} appsByRole={APPS_BY_ROLE}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <RequireAuth roles={['client']}>
                  <DashboardPage />
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
