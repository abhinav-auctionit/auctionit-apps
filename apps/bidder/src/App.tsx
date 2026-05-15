import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from '@auction/auth';
import { Toaster } from '@auction/ui';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { WalletPage } from './pages/WalletPage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { AuctionsPage } from './pages/AuctionsPage';
import { AuctionDetailPage } from './pages/AuctionDetailPage';
import { BiddingRoomPage } from './pages/BiddingRoomPage';

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
                <RequireAuth roles={['bidder']}>
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
            <Route
              path="/auctions"
              element={
                <RequireAuth roles={['bidder']}>
                  <AuctionsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/auctions/:id"
              element={
                <RequireAuth roles={['bidder']}>
                  <AuctionDetailPage />
                </RequireAuth>
              }
            />
            <Route
              path="/auctions/:auctionId/lots/:lotId"
              element={
                <RequireAuth roles={['bidder']}>
                  <BiddingRoomPage />
                </RequireAuth>
              }
            />
            <Route
              path="/bids"
              element={
                <RequireAuth roles={['bidder']}>
                  <ComingSoonPage title="My bids" />
                </RequireAuth>
              }
            />
            <Route
              path="/watchlist"
              element={
                <RequireAuth roles={['bidder']}>
                  <ComingSoonPage title="Watchlist" />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth roles={['bidder']}>
                  <ComingSoonPage title="Profile" />
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
