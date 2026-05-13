import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ApiError,
  type AuctionHistoryRow,
  type AuctionHistoryStats,
} from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import type { AuctionStatus } from '@auction/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@auction/ui';

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Failed to load';

const STATUS_META: Record<
  AuctionStatus,
  { label: string; tone: string }
> = {
  draft: { label: 'Draft', tone: 'bg-slate-100 text-slate-700' },
  scheduled: { label: 'Upcoming', tone: 'bg-blue-100 text-blue-700' },
  live: { label: 'In progress', tone: 'bg-amber-100 text-amber-700' },
  ended: { label: 'Complete', tone: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', tone: 'bg-rose-100 text-rose-700' },
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatRsFromCents(cents: number): string {
  return inr.format(Math.round(cents / 100));
}

function formatCompactInr(cents: number): string {
  const rupees = cents / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)} L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1)} K`;
  return `₹${Math.round(rupees)}`;
}

function formatQty(value: number): string {
  if (Number.isInteger(value)) return value.toLocaleString('en-IN');
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

type TimeRange = 'all' | '3' | '6' | '12';
type SortField = 'date' | 'totalQty' | 'totalAmountCents' | 'code' | 'name';
type SortDir = 'asc' | 'desc';

export function ClientAuctionHistorySection({ clientId }: { clientId: string }) {
  const api = useApiClient();
  const history = useQuery({
    queryKey: ['admin', 'client', clientId, 'auction-history'],
    queryFn: () => api.adminClients.getAuctionHistory(clientId),
    enabled: !!clientId,
  });

  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: 'date',
    dir: 'desc',
  });

  const filtered: AuctionHistoryRow[] = useMemo(() => {
    const all = history.data?.auctions ?? [];
    const now = Date.now();
    const cutoff =
      timeRange === 'all' ? 0 : now - parseInt(timeRange, 10) * 30 * 24 * 60 * 60 * 1000;
    return all.filter((a) => {
      if (locationFilter !== 'all') {
        if (locationFilter === '__none__') {
          if (a.location !== null) return false;
        } else if (a.location?.id !== locationFilter) {
          return false;
        }
      }
      if (timeRange !== 'all') {
        if (!a.startAt || Date.parse(a.startAt) < cutoff) return false;
      }
      return true;
    });
  }, [history.data, locationFilter, timeRange]);

  const filteredStats: AuctionHistoryStats = useMemo(() => {
    const totalAuctions = filtered.length;
    const totalValueCents = filtered.reduce((s, r) => s + r.totalAmountCents, 0);
    const totalQty = filtered.reduce((s, r) => s + r.totalQty, 0);
    const uomSet = new Set(filtered.map((r) => r.qtyUom).filter((u): u is string => !!u));
    const qtyUom = uomSet.size === 1 ? Array.from(uomSet)[0]! : null;
    const avgValueCents =
      totalAuctions === 0 ? 0 : Math.round(totalValueCents / totalAuctions);
    return { totalAuctions, totalValueCents, avgValueCents, totalQty, qtyUom };
  }, [filtered]);

  const sorted = useMemo(() => {
    const list = filtered.slice();
    const { field, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (field) {
        case 'date':
          av = a.startAt ? Date.parse(a.startAt) : 0;
          bv = b.startAt ? Date.parse(b.startAt) : 0;
          break;
        case 'totalQty':
          av = a.totalQty;
          bv = b.totalQty;
          break;
        case 'totalAmountCents':
          av = a.totalAmountCents;
          bv = b.totalAmountCents;
          break;
        case 'code':
          av = a.code.toLowerCase();
          bv = b.code.toLowerCase();
          break;
        case 'name':
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
      }
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return list;
  }, [filtered, sort]);

  if (history.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (history.error || !history.data) {
    return <p className="text-sm text-destructive">{errMsg(history.error)}</p>;
  }

  const { upcoming, locations } = history.data;
  const conductedCount = history.data.auctions.filter((a) => a.status !== 'scheduled').length;
  const upcomingCount = history.data.auctions.filter((a) => a.status === 'scheduled').length;

  const toggleSort = (field: SortField) => {
    setSort((s) =>
      s.field === field
        ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'date' ? 'desc' : 'asc' },
    );
  };

  return (
    <section className="space-y-5">
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        All past auctions conducted for this client plus any upcoming scheduled auction. Click an
        auction ID to open its detail page.
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Auction history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {conductedCount} auction{conductedCount === 1 ? '' : 's'} conducted
            {upcomingCount > 0
              ? ` · ${upcomingCount} upcoming`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.length > 0 && <SelectItem value="__none__">No location</SelectItem>}
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {upcoming && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Upcoming
                </Badge>
                <Link
                  to={`/auctions/${upcoming.id}`}
                  className="font-mono text-sm font-semibold text-primary hover:underline"
                >
                  {upcoming.code}
                </Link>
              </div>
              <p className="text-sm font-medium">{upcoming.name}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">Date:</strong>{' '}
                  {upcoming.startAt
                    ? new Date(upcoming.startAt).toLocaleDateString(undefined, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
                {upcoming.location && (
                  <span>
                    <strong className="text-foreground">Location:</strong>{' '}
                    {upcoming.location.name}
                  </span>
                )}
                {upcoming.totalQty > 0 && (
                  <span>
                    <strong className="text-foreground">Qty:</strong> {formatQty(upcoming.totalQty)}
                    {upcoming.qtyUom ? ` ${upcoming.qtyUom}` : ''}
                  </span>
                )}
                {upcoming.firstItemName && (
                  <span>
                    <strong className="text-foreground">Material:</strong>{' '}
                    {upcoming.firstItemName}
                  </span>
                )}
              </div>
            </div>
            <Button asChild>
              <Link to={`/auctions/${upcoming.id}`}>View auction</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total auctions" value={String(filteredStats.totalAuctions)} />
        <StatCard label="Total value" value={formatCompactInr(filteredStats.totalValueCents)} />
        <StatCard label="Avg value / auction" value={formatCompactInr(filteredStats.avgValueCents)} />
        <StatCard
          label="Total qty sold"
          value={
            filteredStats.totalQty > 0
              ? `${formatQty(filteredStats.totalQty)}${
                  filteredStats.qtyUom ? ` ${filteredStats.qtyUom}` : ''
                }`
              : '—'
          }
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {history.data.auctions.length === 0
                ? 'No auctions yet for this client.'
                : 'No auctions match the current filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b">
                    <SortHeader
                      label="Auction ID"
                      field="code"
                      sort={sort}
                      onToggle={toggleSort}
                    />
                    <SortHeader label="Name" field="name" sort={sort} onToggle={toggleSort} />
                    <SortHeader label="Date" field="date" sort={sort} onToggle={toggleSort} />
                    <SortHeader
                      label="Total qty"
                      field="totalQty"
                      sort={sort}
                      onToggle={toggleSort}
                      align="right"
                    />
                    <SortHeader
                      label="Total amount"
                      field="totalAmountCents"
                      sort={sort}
                      onToggle={toggleSort}
                      align="right"
                    />
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => {
                    const meta = STATUS_META[a.status];
                    return (
                      <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="px-3 py-3">
                          <Link
                            to={`/auctions/${a.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {a.code}
                          </Link>
                        </td>
                        <td className="px-3 py-3 font-medium">{a.name}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {a.startAt
                            ? new Date(a.startAt).toLocaleDateString(undefined, {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {a.totalQty > 0
                            ? `${formatQty(a.totalQty)}${a.qtyUom ? ` ${a.qtyUom}` : ''}`
                            : '—'}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {a.totalAmountCents > 0 ? formatRsFromCents(a.totalAmountCents) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <Badge className={`${meta.tone} hover:${meta.tone}`}>
                            {meta.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SortHeader({
  label,
  field,
  sort,
  onToggle,
  align = 'left',
}: {
  label: string;
  field: SortField;
  sort: { field: SortField; dir: SortDir };
  onToggle: (f: SortField) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.field === field;
  const arrow = !active ? '' : sort.dir === 'asc' ? ' ↑' : ' ↓';
  return (
    <th className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onToggle(field)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          active ? 'text-foreground' : ''
        }`}
      >
        {label}
        {arrow}
      </button>
    </th>
  );
}
