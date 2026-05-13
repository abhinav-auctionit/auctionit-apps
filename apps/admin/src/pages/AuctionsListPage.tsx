import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type { AuctionStatus } from '@auction/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
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

const STATUS_BADGE: Record<AuctionStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  scheduled: { label: 'Scheduled', variant: 'secondary' },
  live: { label: 'Live', variant: 'default' },
  ended: { label: 'Ended', variant: 'secondary' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

const TYPE_LABEL: Record<string, string> = {
  forward: 'Forward',
  reverse: 'Reverse',
  sealed_bid: 'Sealed bid',
  yankee: 'Yankee',
};

export function AuctionsListPage() {
  const api = useApiClient();
  const [clientId, setClientId] = useState<string>('all');
  const [code, setCode] = useState('');

  const clients = useQuery({
    queryKey: ['admin', 'clients'],
    queryFn: () => api.adminClients.list(),
  });

  const list = useQuery({
    queryKey: ['admin', 'auctions', clientId, code],
    queryFn: () =>
      api.adminAuctions.list({
        clientId: clientId === 'all' ? undefined : clientId,
        code: code.trim() || undefined,
      }),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Auctions</h1>
            <p className="text-sm text-muted-foreground">
              All auctions across clients. Filter by client or search by code.
            </p>
          </div>
          <Button asChild>
            <Link to="/auctions/new">+ New auction</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_1fr]">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Auction code</Label>
              <Input
                id="code"
                placeholder="Search by code (e.g. JSW-2026-001)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {list.error && (
          <p className="text-sm text-destructive">
            {list.error instanceof ApiError ? list.error.message : 'Failed to load'}
          </p>
        )}

        {list.data && list.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No auctions match this filter.
            </CardContent>
          </Card>
        )}

        {list.data && list.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{list.data.length} auction(s)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Lots</TableHead>
                    <TableHead className="text-right">EMD (₹)</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((a) => {
                    const badge = STATUS_BADGE[a.status];
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Link
                            to={`/auctions/${a.id}`}
                            className="font-mono text-xs text-foreground hover:underline"
                          >
                            {a.code}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.client.companyName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {TYPE_LABEL[a.auctionType] ?? a.auctionType}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{a._count.lots}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.emdAmount.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleDateString()}
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
