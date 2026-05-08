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
  const { user, logout, appsByRole } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // The right app for the user's actual role, if known.
  const rightAppUrl = user ? appsByRole[user.role] : undefined;

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
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Wrong app for your role</h1>
        <p style={{ color: '#666', marginTop: 8, lineHeight: 1.5 }}>
          You&apos;re signed in as <strong>{user?.email}</strong> ({user?.role}). This area is
          for {requiredRoles.join(' or ')} accounts.
        </p>
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {rightAppUrl && (
            <a
              href={rightAppUrl}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                background: '#16243B',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Open the {user?.role} app →
            </a>
          )}
          <button
            onClick={onSwitch}
            disabled={busy}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: 6,
              cursor: busy ? 'not-allowed' : 'pointer',
              background: 'white',
            }}
          >
            {busy ? 'Signing out…' : 'Sign out & use a different account'}
          </button>
        </div>
      </div>
    </div>
  );
}
