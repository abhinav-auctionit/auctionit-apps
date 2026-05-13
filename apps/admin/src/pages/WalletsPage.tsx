import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError, type BidderWalletRow } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function matches(row: BidderWalletRow, q: string) {
  const haystack = [
    row.fullName,
    row.companyName,
    row.user.email,
    row.user.name,
    `${row.contactCountryCode}${row.contactNumber}`,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function WalletsPage() {
  const api = useApiClient();
  const [search, setSearch] = useState('');

  const wallets = useQuery({
    queryKey: ['admin', 'wallets'],
    queryFn: () => api.adminBidders.listWallets(),
  });

  const rows = useMemo(() => {
    const data = wallets.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? data.filter((r) => matches(r, q)) : data;
  }, [wallets.data, search]);

  const totalBalance = useMemo(
    () => (wallets.data ?? []).reduce((sum, r) => sum + r.balance, 0),
    [wallets.data],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Bidder wallets</h1>
          <p className="text-sm text-muted-foreground">
            Approved bidders and their current wallet balances. Click Manage to credit or
            debit a bidder.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Bidders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {wallets.data?.length ?? '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Total balance held
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {wallets.data ? inr.format(totalBalance) : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Search</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="wallet-search" className="sr-only">
                Search
              </Label>
              <Input
                id="wallet-search"
                placeholder="Name, company, email, mobile"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        {wallets.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {wallets.error && (
          <p className="text-sm text-destructive">
            {wallets.error instanceof ApiError
              ? wallets.error.message
              : 'Failed to load wallets'}
          </p>
        )}

        {wallets.data && wallets.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No approved bidders yet. Approve a bidder application to enable their wallet.
            </CardContent>
          </Card>
        )}

        {wallets.data && wallets.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {rows.length} of {wallets.data.length} bidder
                {wallets.data.length === 1 ? '' : 's'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No bidders match &ldquo;{search}&rdquo;.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bidder</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.profileId}>
                        <TableCell>
                          <div className="font-medium">{r.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.user.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.companyName ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.contactCountryCode}
                          {r.contactNumber}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {inr.format(r.balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/bidders/${r.profileId}#wallet`}>
                              Manage
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
