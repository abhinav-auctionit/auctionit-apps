import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError, type BidderAuctionLot } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const formatRsFromCents = (c: number) => inr.format(c / 100);

const TYPE_LABEL: Record<string, string> = {
  forward: 'Forward',
  reverse: 'Reverse',
  sealed_bid: 'Sealed bid',
  yankee: 'Yankee',
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

const OUTCOME_LABEL: Record<string, { label: string; tone: string }> = {
  pending_lift: { label: 'Pending lift', tone: 'bg-amber-100 text-amber-800' },
  lifted: { label: 'Lifted', tone: 'bg-emerald-100 text-emerald-700' },
  forfeited: { label: 'Forfeited', tone: 'bg-rose-100 text-rose-700' },
  rejected_by_client: { label: 'Rejected by client', tone: 'bg-slate-200 text-slate-800' },
  no_winner: { label: 'No winner', tone: 'bg-muted text-muted-foreground' },
};

export function AuctionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const api = useApiClient();

  const detail = useQuery({
    queryKey: ['bidder', 'auction', id],
    queryFn: () => api.bidder.getMyAuction(id),
    enabled: !!id,
    retry: false,
  });

  if (detail.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link to="/auctions" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to auctions
          </Link>
          <p className="text-sm text-destructive">
            {detail.error instanceof ApiError
              ? detail.error.message
              : 'Failed to load auction'}
          </p>
        </div>
      </AppShell>
    );
  }

  const { auction, mode, consolidated, lots } = detail.data;
  const totalHeld =
    (consolidated?.heldAmount ?? 0) +
    lots.reduce((s, l) => s + (l.releasedAt ? 0 : l.emdHeldAmount), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <Link to="/auctions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to auctions
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{auction.code}</p>
            <h1 className="mt-1 text-2xl font-semibold">{auction.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {auction.client.companyName}
              {auction.location ? ` · ${auction.location.name}` : ''} ·{' '}
              {TYPE_LABEL[auction.auctionType] ?? auction.auctionType}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {mode === 'consolidated' ? (
              <Badge variant="default">Consolidated</Badge>
            ) : (
              <Badge variant="secondary">Lot-level</Badge>
            )}
            <Badge variant="outline">{auction.status}</Badge>
          </div>
        </div>

        {auction.description && (
          <Card>
            <CardContent className="pt-6 text-sm leading-relaxed text-muted-foreground">
              {auction.description}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">EMD overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {mode === 'consolidated' && consolidated && (
              <>
                <p>
                  <span className="text-muted-foreground">Consolidated held:</span>{' '}
                  <span className="font-medium tabular-nums">
                    {inr.format(consolidated.heldAmount)}
                  </span>
                </p>
                {consolidated.settledAt && (
                  <p className="text-xs text-muted-foreground">
                    Settled · refund {inr.format(consolidated.settlementRefundAmount ?? 0)} ·
                    forfeit {inr.format(consolidated.settlementForfeitAmount ?? 0)}
                    {consolidated.settlementShortfallAmount > 0 && (
                      <>
                        {' '}
                        · shortfall {inr.format(consolidated.settlementShortfallAmount)}
                      </>
                    )}
                  </p>
                )}
              </>
            )}
            {mode === 'lot' && (
              <p>
                <span className="text-muted-foreground">Currently held:</span>{' '}
                <span className="font-medium tabular-nums">{inr.format(totalHeld)}</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Your lots ({lots.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You're attached to this auction but no lot rows are visible.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Start</th>
                      <th className="px-3 py-2 text-left">End</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Start bid</th>
                      <th className="px-3 py-2 text-right">EMD held</th>
                      <th className="px-3 py-2 text-left">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((l) => (
                      <LotRow key={l.lotId} lot={l} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function LotRow({ lot }: { lot: BidderAuctionLot }) {
  const outcome = lot.outcomeStatus ? OUTCOME_LABEL[lot.outcomeStatus] : null;
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2 tabular-nums">{lot.lotNo}</td>
      <td className="px-3 py-2">
        <div className="font-medium">{lot.itemName}</div>
        {lot.description && (
          <div className="line-clamp-1 text-xs text-muted-foreground">{lot.description}</div>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{formatWhen(lot.startTime)}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{formatWhen(lot.endTime)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {lot.qty} {lot.uom}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatRsFromCents(lot.startingPriceCents)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {lot.releasedAt ? '—' : inr.format(lot.emdHeldAmount)}
      </td>
      <td className="px-3 py-2">
        {outcome ? (
          <div className="flex flex-col gap-1">
            <span
              className={`inline-block w-fit rounded px-1.5 py-0.5 text-[10px] font-medium ${outcome.tone}`}
            >
              {outcome.label}
            </span>
            {lot.isWinner && (
              <span className="text-[10px] font-medium text-emerald-700">
                You won @ {formatRsFromCents(lot.winningBidAmountCents ?? 0)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
