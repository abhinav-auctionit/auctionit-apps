import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@auction/auth';
import { Badge, Button, Separator } from '@auction/ui';

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const SIDEBAR_BG = '#f7f8fc';

type NavLeaf = { kind: 'leaf'; label: string; to: string; end?: boolean };
type NavGroup = { kind: 'group'; label: string; basePaths: string[]; children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;

const NAV: NavItem[] = [
  { kind: 'leaf', label: 'Home', to: '/', end: true },
  {
    kind: 'group',
    label: 'Bidding',
    basePaths: ['/auctions', '/bids', '/watchlist'],
    children: [
      { kind: 'leaf', label: 'Live auctions', to: '/auctions' },
      { kind: 'leaf', label: 'My bids', to: '/bids' },
      { kind: 'leaf', label: 'Watchlist', to: '/watchlist' },
    ],
  },
  {
    kind: 'group',
    label: 'Account',
    basePaths: ['/wallet', '/profile'],
    children: [
      { kind: 'leaf', label: 'Wallet', to: '/wallet' },
      { kind: 'leaf', label: 'Profile', to: '/profile' },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
            Auction · Bidder
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
        <div
          key={location.pathname}
          className="mx-auto max-w-6xl px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out"
        >
          {children}
        </div>
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
        `group relative block rounded-md px-3 py-1.5 text-sm transition-all duration-200 ease-out hover:translate-x-0.5 ${
          inset ? 'pl-7' : ''
        } ${
          isActive
            ? 'bg-foreground/10 font-medium text-foreground'
            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-foreground transition-all duration-200 ease-out ${
              isActive ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'
            }`}
            aria-hidden
          />
          {children}
        </>
      )}
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
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ease-out ${
            open ? 'rotate-90' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <ul className="mt-0.5 space-y-0.5 overflow-hidden">
          {item.children.map((c) => (
            <li key={c.to}>
              <SidebarLink to={c.to} end={c.end} inset>
                {c.label}
              </SidebarLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
