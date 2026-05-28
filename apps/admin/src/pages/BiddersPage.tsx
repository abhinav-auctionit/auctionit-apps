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
  { value: 'all', label: 'All' },
  { value: 'pending_approval', label: 'Pending review' },
  { value: 'draft', label: 'In progress' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE: Record<BidderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  pending_approval: { label: 'Pending', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

const PAGE_SIZE = 50;

export function BiddersPage() {
  const api = useApiClient();
  const [filter, setFilter] = useState<BidderStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['admin', 'bidder-profiles', filter, page],
    queryFn: () =>
      api.adminBidders.list({
        ...(filter === 'all' ? {} : { status: filter }),
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  function changeFilter(next: BidderStatus | 'all') {
    setFilter(next);
    setPage(1);
  }

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
            <Select value={filter} onValueChange={(v) => changeFilter(v as BidderStatus | 'all')}>
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

        {list.data && rows.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No bidder profiles match this filter.
            </CardContent>
          </Card>
        )}

        {list.data && rows.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {total} profile{total === 1 ? '' : 's'}
                {pageCount > 1 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length}
                  </span>
                )}
              </CardTitle>
              {pageCount > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || list.isFetching}
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground">
                    Page {page} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={page >= pageCount || list.isFetching}
                  >
                    Next
                  </Button>
                </div>
              )}
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
                  {rows.map((p) => {
                    const badge = STATUS_BADGE[p.status];
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link
                            to={`/bidders/${p.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {p.fullName ?? p.user.name}
                          </Link>
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
                            <Link to={`/bidders/${p.id}`}>
                              {p.status === 'approved' ? 'Details' : 'Review'}
                            </Link>
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
