import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type { BidderStatus } from '@auction/types';
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

const STATUS_OPTIONS: Array<{ value: BidderStatus | 'all'; label: string }> = [
  { value: 'pending_approval', label: 'Pending review' },
  { value: 'draft', label: 'In progress' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATUS_BADGE: Record<BidderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  pending_approval: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export function BiddersPage() {
  const api = useApiClient();
  const [filter, setFilter] = useState<BidderStatus | 'all'>('pending_approval');

  const list = useQuery({
    queryKey: ['admin', 'bidder-profiles', filter],
    queryFn: () => api.adminBidders.list(filter === 'all' ? {} : { status: filter }),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Bidders</h1>
            <p className="text-sm text-muted-foreground">
              Review applications, mark registration fees paid, and approve or reject bidders.
            </p>
          </div>
          <div className="w-56">
            <Select value={filter} onValueChange={(v) => setFilter(v as BidderStatus | 'all')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              No bidder profiles match this filter.
            </CardContent>
          </Card>
        )}

        {list.data && list.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{list.data.length} profile(s)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((p) => {
                    const badge = STATUS_BADGE[p.status];
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.fullName ?? p.user.name}</div>
                          <div className="text-xs text-muted-foreground">{p.user.email}</div>
                        </TableCell>
                        <TableCell>{p.companyName ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {p.registrationFeePaid ? (
                            <Badge variant="default">Paid</Badge>
                          ) : (
                            <Badge variant="outline">Unpaid</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.submittedAt
                            ? new Date(p.submittedAt).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/bidders/${p.id}`}>Review</Link>
                          </Button>
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
