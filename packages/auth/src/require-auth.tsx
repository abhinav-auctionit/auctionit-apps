import { useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { UserRole } from '@auction/types';
import { useAuth } from './provider';

export function RequireAuth({
  children,
  roles,
  loginPath = '/login',
  fallback = <DefaultLoading />,
}: {
  children: ReactNode;
  roles?: UserRole[];
  loginPath?: string;
  fallback?: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <>{fallback}</>;

  if (!user) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <AccessDenied requiredRoles={roles} loginPath={loginPath} />;
  }

  return <>{children}</>;
}

function DefaultLoading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui',
        color: '#888',
      }}
    >
      Loading…
    </div>
  );
}

function AccessDenied({
  requiredRoles,
  loginPath,
}: {
  requiredRoles: UserRole[];
  loginPath: string;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onSwitch() {
    setBusy(true);
    try {
      await logout();
      navigate(loginPath, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Access denied</h1>
        <p style={{ color: '#666', marginTop: 8 }}>
          You&apos;re signed in as <strong>{user?.email}</strong> ({user?.role}). This area
          requires {requiredRoles.join(' or ')} access.
        </p>
        <button
          onClick={onSwitch}
          disabled={busy}
          style={{
            marginTop: 16,
            padding: '8px 16px',
            border: '1px solid #ccc',
            borderRadius: 6,
            cursor: 'pointer',
            background: 'white',
          }}
        >
          {busy ? 'Signing out…' : 'Sign in with a different account'}
        </button>
      </div>
    </div>
  );
}
