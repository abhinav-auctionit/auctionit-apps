import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type LotState } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  cn,
  toast,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const POLL_MS = 2000;

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const fmtRsCents = (c: number) => inr.format(c / 100);

const TYPE_LABEL: Record<string, string> = {
  forward: 'Forward',
  reverse: 'Reverse',
  sealed_bid: 'Sealed bid',
  yankee: 'Yankee',
};

function fmtRelative(iso: string, nowMs: number) {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, nowMs - then);
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return 'Lot closed';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function BiddingRoomPage() {
  const { auctionId = '', lotId = '' } = useParams<{
    auctionId: string;
    lotId: string;
  }>();
  const api = useApiClient();
  const qc = useQueryClient();

  const queryKey = ['bidder', 'lot-state', auctionId, lotId] as const;

  const state = useQuery({
    queryKey,
    queryFn: () => api.bidder.getLotState(auctionId, lotId),
    enabled: !!auctionId && !!lotId,
    retry: false,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  // Track server-time drift so countdowns don't lie when the user's clock is off.
  const driftRef = useRef(0);
  useEffect(() => {
    if (state.data?.serverTime) {
      driftRef.current = new Date(state.data.serverTime).getTime() - Date.now();
    }
  }, [state.data?.serverTime]);

  // Heartbeat for countdown rendering — independent of the polling cadence so
  // the timer updates every second even if the network is slow.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const nowMs = Date.now() + driftRef.current;

  const placeBid = useMutation({
    mutationFn: (amountCents: number) =>
      api.bidder.placeBid(auctionId, lotId, { amountCents }),
    onSuccess: () => {
      toast.success('Bid placed');
      qc.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to place bid');
    },
  });

  if (state.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (state.error || !state.data) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link
            to={`/auctions/${auctionId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to auction
          </Link>
          <p className="text-sm text-destructive">
            {state.error instanceof ApiError ? state.error.message : 'Failed to load'}
          </p>
        </div>
      </AppShell>
    );
  }

  const data = state.data;
  return (
    <AppShell>
      <div className="space-y-6">
        <Link
          to={`/auctions/${auctionId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to auction
        </Link>

        <Header data={data} />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <PriceCard data={data} nowMs={nowMs} tick={tick} />
            <BidForm
              data={data}
              onSubmit={(amount) => placeBid.mutate(amount)}
              busy={placeBid.isPending}
              nowMs={nowMs}
            />
            <RecentBidsCard data={data} nowMs={nowMs} tick={tick} />
          </div>
          <SidePanel data={data} />
        </div>
      </div>
    </AppShell>
  );
}

function Header({ data }: { data: LotState }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-mono text-xs text-muted-foreground">
          {data.auction.code} · Lot #{data.lot.lotNo}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{data.lot.itemName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.lot.qty} {data.lot.uom} · {TYPE_LABEL[data.auction.auctionType] ?? data.auction.auctionType}
        </p>
      </div>
      <Badge variant="outline" className="capitalize">
        {data.auction.status}
      </Badge>
    </div>
  );
}

function PriceCard({
  data,
  nowMs,
  tick,
}: {
  data: LotState;
  nowMs: number;
  tick: number;
}) {
  // tick prop is unused in the body; it forces re-render every second so the
  // countdown stays fresh between polls.
  void tick;
  const endMs = new Date(data.lot.endTime).getTime();
  const remaining = endMs - nowMs;
  const startedMs = new Date(data.lot.startTime).getTime();
  const notStarted = nowMs < startedMs;

  const status = (() => {
    if (data.auction.status === 'ended') return { label: 'Auction ended', tone: 'muted' };
    if (data.auction.status === 'cancelled') return { label: 'Cancelled', tone: 'destructive' };
    if (notStarted) return { label: 'Not started', tone: 'muted' };
    if (remaining <= 0) return { label: 'Lot closed', tone: 'muted' };
    if (data.you.isCurrentHigh) return { label: 'You are winning', tone: 'success' };
    if (data.you.yourLastBidAmount !== null) return { label: 'Outbid', tone: 'destructive' };
    return { label: 'Open for bids', tone: 'muted' };
  })();

  return (
    <Card>
      <CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Current bid
          </p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">
            {data.lot.currentBidCents !== null
              ? fmtRsCents(data.lot.currentBidCents)
              : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.lot.bidCount} bid{data.lot.bidCount === 1 ? '' : 's'} · increment{' '}
            {fmtRsCents(data.lot.bidIncrementCents)}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {notStarted ? 'Starts in' : 'Time remaining'}
          </p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">
            {fmtCountdown(notStarted ? startedMs - nowMs : remaining)}
          </p>
          <span
            className={cn(
              'mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              status.tone === 'success' && 'bg-emerald-100 text-emerald-700',
              status.tone === 'destructive' && 'bg-rose-100 text-rose-700',
              status.tone === 'muted' && 'bg-muted text-muted-foreground',
            )}
          >
            {status.label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function BidForm({
  data,
  onSubmit,
  busy,
  nowMs,
}: {
  data: LotState;
  onSubmit: (amountCents: number) => void;
  busy: boolean;
  nowMs: number;
}) {
  const [amount, setAmount] = useState<string>(
    String(Math.round(data.you.nextValidBidCents / 100)),
  );

  // When the server's next-valid increases (someone else bid), bump the input
  // unless the user has typed something higher manually.
  useEffect(() => {
    setAmount((prev) => {
      const cur = Math.round(Number(prev) * 100);
      if (Number.isNaN(cur) || cur < data.you.nextValidBidCents) {
        return String(Math.round(data.you.nextValidBidCents / 100));
      }
      return prev;
    });
  }, [data.you.nextValidBidCents]);

  const startedMs = new Date(data.lot.startTime).getTime();
  const endMs = new Date(data.lot.endTime).getTime();
  const inWindow = nowMs >= startedMs && nowMs < endMs;

  const liveStatus =
    data.auction.status === 'live' || data.auction.status === 'scheduled';

  const disabledReason = (() => {
    if (!data.you.isAttached) return 'You are not attached to this lot';
    if (!liveStatus) return `Auction is ${data.auction.status}`;
    if (!inWindow) return nowMs < startedMs ? 'Lot has not started yet' : 'Lot has ended';
    if (data.you.isCurrentHigh) return 'You are already the highest bidder';
    return null;
  })();

  function adjust(deltaCents: number) {
    const cur = Math.round(Number(amount) * 100);
    if (Number.isNaN(cur)) return;
    const next = Math.max(data.you.nextValidBidCents, cur + deltaCents);
    setAmount(String(Math.round(next / 100)));
  }

  function handle(e: FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (Number.isNaN(cents)) {
      toast.error('Enter a valid amount');
      return;
    }
    if (cents < data.you.nextValidBidCents) {
      toast.error(`Minimum bid is ${fmtRsCents(data.you.nextValidBidCents)}`);
      return;
    }
    onSubmit(cents);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Place a bid</CardTitle>
      </CardHeader>
      <CardContent>
        {disabledReason ? (
          <p className="text-sm text-muted-foreground">{disabledReason}</p>
        ) : (
          <form onSubmit={handle} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="bid-amount">
                Amount in ₹ · minimum {fmtRsCents(data.you.nextValidBidCents)}
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => adjust(-data.lot.bidIncrementCents)}
                  aria-label="Decrease"
                >
                  −
                </Button>
                <Input
                  id="bid-amount"
                  type="number"
                  inputMode="numeric"
                  step={Math.max(1, data.lot.bidIncrementCents / 100)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-center text-lg font-medium tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => adjust(data.lot.bidIncrementCents)}
                  aria-label="Increase"
                >
                  +
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Placing…' : 'Place bid'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SidePanel({ data }: { data: LotState }) {
  const startedFmt = useMemo(
    () =>
      new Date(data.lot.startTime).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }),
    [data.lot.startTime],
  );
  const endFmt = useMemo(
    () =>
      new Date(data.lot.endTime).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }),
    [data.lot.endTime],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lot details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Starting price" value={fmtRsCents(data.lot.startingPriceCents)} />
          <Row label="Increment" value={fmtRsCents(data.lot.bidIncrementCents)} />
          <Row label="Quantity" value={`${data.lot.qty} ${data.lot.uom}`} />
          <Row label="Starts" value={startedFmt} />
          <Row label="Ends" value={endFmt} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your position</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Attached" value={data.you.isAttached ? 'Yes' : 'No'} />
          <Row label="EMD held" value={inr.format(data.you.emdHeldAmount)} />
          <Row
            label="Your last bid"
            value={
              data.you.yourLastBidAmount !== null
                ? fmtRsCents(data.you.yourLastBidAmount)
                : '—'
            }
          />
          <Row
            label="Status"
            value={
              data.you.isCurrentHigh
                ? 'Winning'
                : data.you.yourLastBidAmount !== null
                  ? 'Outbid'
                  : 'No bid yet'
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function RecentBidsCard({
  data,
  nowMs,
  tick,
}: {
  data: LotState;
  nowMs: number;
  tick: number;
}) {
  void tick;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent bids</CardTitle>
      </CardHeader>
      <CardContent>
        {data.recentBids.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bids yet — be the first.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recentBids.map((b) => (
              <li
                key={b.id}
                className={cn(
                  'flex items-center justify-between py-2 text-sm',
                  b.isYou && 'font-medium text-foreground',
                )}
              >
                <span className={b.isYou ? '' : 'text-muted-foreground'}>
                  {b.bidderHandle}
                </span>
                <span className="flex items-center gap-3 tabular-nums">
                  <span className="text-xs text-muted-foreground">
                    {fmtRelative(b.placedAt, nowMs)}
                  </span>
                  <span>{fmtRsCents(b.amountCents)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
