import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type { UserRole } from '@auction/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

type RoleFilter = UserRole | 'all';

const ROLE_OPTIONS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'All users' },
  { value: 'admin', label: 'Admin users' },
  { value: 'client', label: 'Client users' },
  { value: 'bidder', label: 'Bidder users' },
];

const ROLE_BADGE: Record<UserRole, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  admin: { label: 'Admin', variant: 'default' },
  client: { label: 'Client', variant: 'secondary' },
  bidder: { label: 'Bidder', variant: 'outline' },
};

const VALID_ROLES: ReadonlySet<string> = new Set<UserRole>(['admin', 'client', 'bidder']);

function parseRoleFilter(value: string | null): RoleFilter {
  if (value && VALID_ROLES.has(value)) return value as UserRole;
  return 'all';
}

export function UsersListPage() {
  const api = useApiClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseRoleFilter(searchParams.get('role'));

  const list = useQuery({
    queryKey: ['admin', 'users', filter],
    queryFn: () =>
      api.auth.listUsers(filter === 'all' ? {} : { role: filter }),
  });

  function setFilter(next: RoleFilter) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('role');
    else params.set('role', next);
    setSearchParams(params, { replace: true });
  }

  const activeOption =
    ROLE_OPTIONS.find((o) => o.value === filter) ?? { value: 'all', label: 'All users' };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{activeOption.label}</h1>
            <p className="text-sm text-muted-foreground">
              Browse user accounts across the platform.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-48">
              <Select value={filter} onValueChange={(v) => setFilter(v as RoleFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button asChild size="sm">
              <Link to="/users/new">Create user</Link>
            </Button>
          </div>
        </div>

        {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {list.error && (
          <p className="text-sm text-destructive">
            {list.error instanceof ApiError ? list.error.message : 'Failed to load'}
          </p>
        )}

        {list.data && list.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No users match this filter.
            </CardContent>
          </Card>
        )}

        {list.data && list.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{list.data.length} user(s)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((u) => {
                    const badge = ROLE_BADGE[u.role];
                    const mobile =
                      u.mobileCountryCode && u.mobileNumber
                        ? `+${u.mobileCountryCode} ${u.mobileNumber}`
                        : '—';
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{mobile}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
