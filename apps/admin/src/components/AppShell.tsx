import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@auction/auth';
import { Badge, Button, Separator } from '@auction/ui';

const SIDEBAR_BG = '#f7f8fc';

type NavLeaf = { kind: 'leaf'; label: string; to: string; end?: boolean };
type NavGroup = { kind: 'group'; label: string; basePaths: string[]; children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;

const NAV: NavItem[] = [
  { kind: 'leaf', label: 'Home', to: '/', end: true },
  {
    kind: 'group',
    label: 'Taxonomy',
    basePaths: ['/taxonomy', '/items'],
    children: [
      { kind: 'leaf', label: 'Categories', to: '/taxonomy/categories' },
      { kind: 'leaf', label: 'Attributes', to: '/taxonomy/attributes' },
      { kind: 'leaf', label: 'Items', to: '/items' },
    ],
  },
  {
    kind: 'group',
    label: 'Users',
    basePaths: ['/users'],
    children: [{ kind: 'leaf', label: 'Create user', to: '/users/new' }],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="flex w-60 shrink-0 flex-col border-r border-border"
        style={{ backgroundColor: SIDEBAR_BG }}
      >
        <div className="px-5 py-5">
          <Link to="/" className="font-semibold tracking-tight">
            Auction · Admin
          </Link>
        </div>
        <Separator />
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {NAV.map((item, i) => (
              <li key={i}>
                {item.kind === 'leaf' ? (
                  <SidebarLink to={item.to} end={item.end}>
                    {item.label}
                  </SidebarLink>
                ) : (
                  <SidebarGroup item={item} />
                )}
              </li>
            ))}
          </ul>
        </nav>
        <Separator />
        <div className="space-y-2 px-3 py-3">
          {user && (
            <div className="px-2 text-xs">
              <div className="truncate font-medium text-foreground">{user.name}</div>
              <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                <span className="truncate">{user.email}</span>
                <Badge variant="secondary" className="ml-1 shrink-0 text-[10px]">
                  {user.role}
                </Badge>
              </div>
            </div>
          )}
          <Button size="sm" className="w-full" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden bg-background">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

function SidebarLink({
  to,
  end,
  children,
  inset,
}: {
  to: string;
  end?: boolean;
  children: ReactNode;
  inset?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `block rounded-md px-3 py-1.5 text-sm transition-colors ${inset ? 'pl-7' : ''} ${
          isActive
            ? 'bg-foreground/10 font-medium text-foreground'
            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function SidebarGroup({ item }: { item: Extract<NavItem, { kind: 'group' }> }) {
  const location = useLocation();
  const isInGroup = item.basePaths.some((p) => location.pathname.startsWith(p));
  const [open, setOpen] = useState(isInGroup);

  // keep open when navigating into the group
  if (isInGroup && !open) setOpen(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
          isInGroup
            ? 'font-medium text-foreground'
            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        }`}
        aria-expanded={open}
      >
        <span>{item.label}</span>
        <span className="text-xs text-muted-foreground">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {item.children.map((c) => (
            <li key={c.to}>
              <SidebarLink to={c.to} end={c.end} inset>
                {c.label}
              </SidebarLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
