import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
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

export function AuctionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const api = useApiClient();
  const qc = useQueryClient();

  const invitation = useQuery({
    queryKey: ['bidder', 'auction', id],
    queryFn: () => api.bidder.getInvitedAuction(id),
    enabled: !!id,
    retry: false,
  });

  const wallet = useQuery({
    queryKey: ['bidder', 'me', 'wallet'],
    queryFn: () => api.bidder.getMyWallet(),
  });

  const join = useMutation({
    mutationFn: () => api.bidder.joinAuction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bidder', 'auction', id] });
      qc.invalidateQueries({ queryKey: ['bidder', 'me', 'wallet'] });
      qc.invalidateQueries({ queryKey: ['bidder', 'me', 'invitations'] });
    },
  });

  if (invitation.isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (invitation.error || !invitation.data) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Link to="/auctions" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to auctions
          </Link>
          <p className="text-sm text-destructive">
            {invitation.error instanceof ApiError
              ? invitation.error.message
              : 'Failed to load auction'}
          </p>
        </div>
      </AppShell>
    );
  }

  const inv = invitation.data;
  const a = inv.auction;
  const isJoined = !!inv.joinedAt;
  const canJoin =
    !isJoined && (a.status === 'scheduled' || a.status === 'live');
  const insufficientBalance =
    wallet.data != null && wallet.data.balance < a.emdAmount;

  return (
    <AppShell>
      <div className="space-y-6">
        <Link to="/auctions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to auctions
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{a.code}</p>
            <h1 className="mt-1 text-2xl font-semibold">{a.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {a.client.companyName} · {TYPE_LABEL[a.auctionType] ?? a.auctionType}
            </p>
          </div>
          {isJoined ? (
            <Badge variant="default">Joined</Badge>
          ) : (
            <Badge variant="secondary">{a.status}</Badge>
          )}
        </div>

        {a.description && (
          <Card>
            <CardContent className="pt-6 text-sm leading-relaxed text-muted-foreground">
              {a.description}
            </CardContent>
          </Card>
        )}

        <JoinPanel
          isJoined={isJoined}
          emdAmount={a.emdAmount}
          walletBalance={wallet.data?.balance}
          canJoin={canJoin}
          insufficientBalance={insufficientBalance}
          status={a.status}
          busy={join.isPending}
          error={join.error}
          onJoin={() => join.mutate()}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lots ({a.lots.length})</CardTitle>
            {!isJoined && (
              <CardDescription>
                Bidding opens after you join. Lot timing shown below.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {a.lots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lots in this auction yet.</p>
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
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Start bid</th>
                      <th className="px-3 py-2 text-right">Incr.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.lots.map((l) => (
                      <tr key={l.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 tabular-nums">{l.lotNo}</td>
                        <td className="px-3 py-2 font-medium">{l.itemName}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {formatWhen(l.startTime)}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {formatWhen(l.endTime)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                        <td className="px-3 py-2">{l.uom}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatRsFromCents(l.startingPriceCents)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatRsFromCents(l.bidIncrementCents)}
                        </td>
                      </tr>
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

function JoinPanel({
  isJoined,
  emdAmount,
  walletBalance,
  canJoin,
  insufficientBalance,
  status,
  busy,
  error,
  onJoin,
}: {
  isJoined: boolean;
  emdAmount: number;
  walletBalance: number | undefined;
  canJoin: boolean;
  insufficientBalance: boolean;
  status: string;
  busy: boolean;
  error: unknown;
  onJoin: () => void;
}) {
  if (isJoined) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-sm font-medium">You've joined this auction.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {emdAmount > 0
                ? `${inr.format(emdAmount)} EMD is held from your wallet. It will be refunded if you don't win.`
                : 'No EMD was required for this auction.'}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/wallet">View wallet</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === 'ended' || status === 'cancelled') {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          This auction is {status}; participation is closed.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Join this auction</CardTitle>
        <CardDescription>
          {emdAmount > 0
            ? `An EMD of ${inr.format(emdAmount)} will be debited from your wallet when you join. It's refunded if you don't win.`
            : 'No EMD is required for this auction. Joining lets you place bids when lots open.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {walletBalance != null && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Wallet balance</dt>
            <dd className="font-medium tabular-nums">{inr.format(walletBalance)}</dd>
            <dt className="text-muted-foreground">EMD required</dt>
            <dd className="font-medium tabular-nums">{inr.format(emdAmount)}</dd>
            <dt className="text-muted-foreground">After join</dt>
            <dd
              className={`font-medium tabular-nums ${
                walletBalance - emdAmount < 0 ? 'text-destructive' : ''
              }`}
            >
              {inr.format(walletBalance - emdAmount)}
            </dd>
          </dl>
        )}
        {insufficientBalance && (
          <p className="text-sm text-destructive">
            Insufficient wallet balance. Contact the admin team to top up.
          </p>
        )}
        {error != null && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.message : 'Failed to join'}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button onClick={onJoin} disabled={busy || !canJoin || insufficientBalance}>
            {busy ? 'Joining…' : 'Join auction'}
          </Button>
          <Button asChild variant="outline">
            <Link to="/wallet">Wallet</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
