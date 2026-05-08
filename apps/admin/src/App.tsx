import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from '@auction/auth';
import { Toaster } from '@auction/ui';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersNewPage } from './pages/UsersNewPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { AttributesPage } from './pages/AttributesPage';
import { ItemsPage } from './pages/ItemsPage';
import { ItemDetailPage } from './pages/ItemDetailPage';
import { NewItemPage } from './pages/NewItemPage';
import { BiddersPage } from './pages/BiddersPage';
import { BidderDetailPage } from './pages/BidderDetailPage';
import { ClientsPage } from './pages/ClientsPage';
import { NewClientPage } from './pages/NewClientPage';

const queryClient = new QueryClient();
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const APPS_BY_ROLE = {
  admin: import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:5175',
  bidder: import.meta.env.VITE_BIDDER_URL ?? 'http://localhost:5174',
  client: import.meta.env.VITE_CLIENT_URL ?? 'http://localhost:5173',
} as const;

const ADMIN = ['admin'] as const;

function adminRoute(element: React.ReactNode) {
  return <RequireAuth roles={[...ADMIN]}>{element}</RequireAuth>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider baseUrl={apiUrl} appsByRole={APPS_BY_ROLE}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={adminRoute(<DashboardPage />)} />
            <Route path="/users/new" element={adminRoute(<UsersNewPage />)} />
            <Route path="/inventory/categories" element={adminRoute(<CategoriesPage />)} />
            <Route path="/inventory/attributes" element={adminRoute(<AttributesPage />)} />
            <Route path="/items" element={adminRoute(<ItemsPage />)} />
            <Route path="/items/new" element={adminRoute(<NewItemPage />)} />
            <Route path="/items/:id" element={adminRoute(<ItemDetailPage />)} />
            <Route path="/bidders" element={adminRoute(<BiddersPage />)} />
            <Route path="/bidders/:id" element={adminRoute(<BidderDetailPage />)} />
            <Route path="/clients" element={adminRoute(<ClientsPage />)} />
            <Route path="/clients/new" element={adminRoute(<NewClientPage />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
