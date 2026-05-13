import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError, type BidderInvitation } from '@auction/api-client';
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

function bucketFor(i: BidderInvitation): Bucket {
  const s = i.auction.status;
  if (s === 'live') return 'live';
  if (s === 'scheduled' || s === 'draft') return 'upcoming';
  return 'past'; // ended | cancelled
}

function earliestStart(i: BidderInvitation): string | null {
  return i.auction.lots.reduce<string | null>(
    (min, l) => (!min || l.startTime < min ? l.startTime : min),
    null,
  );
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
  const invitations = useQuery({
    queryKey: ['bidder', 'me', 'invitations'],
    queryFn: () => api.bidder.listMyInvitations(),
  });

  const buckets: Record<Bucket, BidderInvitation[]> = {
    live: [],
    upcoming: [],
    past: [],
  };
  for (const i of invitations.data ?? []) {
    buckets[bucketFor(i)].push(i);
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Auctions</h1>
          <p className="text-sm text-muted-foreground">
            Auctions you've been invited to. Join an auction with your wallet EMD to bid.
          </p>
        </div>

        {invitations.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {invitations.error && (
          <p className="text-sm text-destructive">
            {invitations.error instanceof ApiError
              ? invitations.error.message
              : 'Failed to load invitations'}
          </p>
        )}

        {invitations.data && invitations.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              You haven't been invited to any auctions yet. When clients invite you, they'll
              appear here.
            </CardContent>
          </Card>
        )}

        {buckets.live.length > 0 && (
          <Section title="Live now" items={buckets.live} />
        )}
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
  items: BidderInvitation[];
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
        {items.map((i) => (
          <InvitationRow key={i.id} invitation={i} />
        ))}
      </CardContent>
    </Card>
  );
}

function InvitationRow({ invitation }: { invitation: BidderInvitation }) {
  const a = invitation.auction;
  const start = earliestStart(invitation);
  const joined = invitation.joinedAt != null;
  return (
    <Link
      to={`/auctions/${a.id}`}
      className="flex items-start justify-between gap-3 rounded-md border p-4 transition-colors hover:bg-secondary"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{a.code}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {TYPE_LABEL[a.auctionType] ?? a.auctionType}
          </span>
        </div>
        <div className="mt-1 font-medium">{a.name}</div>
        <div className="text-xs text-muted-foreground">
          {a.client.companyName} · {a.lots.length} lot{a.lots.length === 1 ? '' : 's'}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Starts {formatWhen(start)}</span>
          {a.emdAmount > 0 && <span>EMD {inr.format(a.emdAmount)}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {joined ? (
          <Badge variant="default">Joined</Badge>
        ) : a.status === 'live' || a.status === 'scheduled' ? (
          <Badge variant="secondary">Invited</Badge>
        ) : (
          <Badge variant="outline">{a.status}</Badge>
        )}
        <span className="text-xs text-muted-foreground">View →</span>
      </div>
    </Link>
  );
}
