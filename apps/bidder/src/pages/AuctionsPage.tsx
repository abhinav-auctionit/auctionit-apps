import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError, type BidderAuctionSummary } from '@auction/api-client';
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

const TYPE_LABEL: Record<string, string> = {
  forward: 'Forward',
  reverse: 'Reverse',
  sealed_bid: 'Sealed bid',
  yankee: 'Yankee',
};

type Bucket = 'live' | 'upcoming' | 'past';

function bucketFor(a: BidderAuctionSummary): Bucket {
  if (a.status === 'live') return 'live';
  if (a.status === 'scheduled' || a.status === 'draft') return 'upcoming';
  return 'past';
}

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

export function AuctionsPage() {
  const api = useApiClient();
  const auctions = useQuery({
    queryKey: ['bidder', 'me', 'auctions'],
    queryFn: () => api.bidder.listMyAuctions(),
  });

  const buckets: Record<Bucket, BidderAuctionSummary[]> = {
    live: [],
    upcoming: [],
    past: [],
  };
  for (const a of auctions.data ?? []) buckets[bucketFor(a)].push(a);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Auctions</h1>
          <p className="text-sm text-muted-foreground">
            Auctions you've been attached to by an admin.
          </p>
        </div>

        {auctions.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {auctions.error && (
          <p className="text-sm text-destructive">
            {auctions.error instanceof ApiError
              ? auctions.error.message
              : 'Failed to load auctions'}
          </p>
        )}

        {auctions.data && auctions.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              You haven't been attached to any auctions yet. When an admin attaches you to
              a lot (or to an auction in consolidated mode), it'll appear here.
            </CardContent>
          </Card>
        )}

        {buckets.live.length > 0 && <Section title="Live now" items={buckets.live} />}
        {buckets.upcoming.length > 0 && (
          <Section title="Upcoming" items={buckets.upcoming} />
        )}
        {buckets.past.length > 0 && <Section title="Past" items={buckets.past} muted />}
      </div>
    </AppShell>
  );
}

function Section({
  title,
  items,
  muted,
}: {
  title: string;
  items: BidderAuctionSummary[];
  muted?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={`text-base ${muted ? 'text-muted-foreground' : ''}`}>
          {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((a) => (
          <AuctionRow key={a.id} auction={a} />
        ))}
      </CardContent>
    </Card>
  );
}

function AuctionRow({ auction }: { auction: BidderAuctionSummary }) {
  return (
    <Link
      to={`/auctions/${auction.id}`}
      className="flex items-start justify-between gap-3 rounded-md border p-4 transition-colors hover:bg-secondary"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{auction.code}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {TYPE_LABEL[auction.auctionType] ?? auction.auctionType}
          </span>
        </div>
        <div className="mt-1 font-medium">{auction.name}</div>
        <div className="text-xs text-muted-foreground">
          {auction.client.companyName} · {auction.lotCount}{' '}
          {auction.lotCount === 1 ? 'lot' : 'lots'}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Starts {formatWhen(auction.earliestStartTime)}</span>
          {auction.totalEmdHeld > 0 && (
            <span>EMD held: {inr.format(auction.totalEmdHeld)}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {auction.mode === 'consolidated' ? (
          <Badge variant="default">Consolidated</Badge>
        ) : (
          <Badge variant="secondary">Lot-level</Badge>
        )}
        <Badge variant="outline" className="text-[10px]">
          {auction.status}
        </Badge>
        <span className="text-xs text-muted-foreground">View →</span>
      </div>
    </Link>
  );
}
