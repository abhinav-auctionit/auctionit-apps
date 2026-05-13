import * as React from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  type AttachFailure,
  type AttachResult,
  type AuctionDetail,
  type BidderSearchResult,
  type ParticipantBidder,
  type ParticipantLotRow,
  type ParticipantsView,
} from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@auction/ui';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Action failed';

type Mode = 'lot' | 'consolidated';

export function AuctionParticipantsSection({ auction }: { auction: AuctionDetail }) {
  const api = useApiClient();
  const qc = useQueryClient();
  const auctionId = auction.id;
  const mode: Mode = auction.consolidatedEmdAmount === null ? 'lot' : 'consolidated';
  const canMutate = auction.status !== 'ended' && auction.status !== 'cancelled';

  const participants = useQuery({
    queryKey: ['admin', 'auction', auctionId, 'participants'],
    queryFn: () => api.adminAuctions.listParticipants(auctionId),
    enabled: !!auctionId,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'auction', auctionId, 'participants'] });

  const [attachOpen, setAttachOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">
            Participants ({participants.data?.bidders.length ?? 0})
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === 'consolidated' ? (
              <>
                Consolidated mode · {inr.format(auction.consolidatedEmdAmount!)} held per
                attached bidder
              </>
            ) : (
              <>Lot-level mode · each lot's EMD is held per attachment</>
            )}
          </p>
        </div>
        {canMutate && (
          <Button size="sm" onClick={() => setAttachOpen(true)}>
            + Attach bidder
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {participants.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {participants.error && (
          <p className="text-sm text-destructive">{errMsg(participants.error)}</p>
        )}
        {participants.data && participants.data.bidders.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No bidders attached yet. Click <strong>+ Attach bidder</strong> to add one.
          </p>
        )}
        {participants.data && participants.data.bidders.length > 0 && (
          <ParticipantsList
            auctionId={auctionId}
            mode={mode}
            canMutate={canMutate}
            data={participants.data}
            onChanged={invalidate}
          />
        )}
      </CardContent>

      {attachOpen && (
        <AttachDialog
          auction={auction}
          mode={mode}
          onClose={() => setAttachOpen(false)}
          onAttached={() => {
            setAttachOpen(false);
            invalidate();
          }}
        />
      )}
    </Card>
  );
}

function ParticipantsList({
  auctionId,
  mode,
  canMutate,
  data,
  onChanged,
}: {
  auctionId: string;
  mode: Mode;
  canMutate: boolean;
  data: ParticipantsView;
  onChanged: () => void;
}) {
  const api = useApiClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const [confirmDetach, setConfirmDetach] = useState<{
    kind: 'lot' | 'auction';
    bidder: ParticipantBidder;
    lot?: ParticipantLotRow;
  } | null>(null);

  const detachLot = useMutation({
    mutationFn: (vars: { lotId: string; bidderProfileId: string }) =>
      api.adminAuctions.detachFromLot(auctionId, vars.lotId, vars.bidderProfileId),
    onSuccess: () => {
      setConfirmDetach(null);
      onChanged();
    },
  });
  const detachAuction = useMutation({
    mutationFn: (bidderProfileId: string) =>
      api.adminAuctions.detachFromAuction(auctionId, bidderProfileId),
    onSuccess: () => {
      setConfirmDetach(null);
      onChanged();
    },
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 text-left">Bidder</th>
            <th className="px-3 py-2 text-left">Mode</th>
            <th className="px-3 py-2 text-right">EMD held</th>
            <th className="px-3 py-2 text-right">Lots</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.bidders.map((b) => {
            const isOpen = expanded.has(b.bidderProfileId);
            const anyBid = b.lots.some((l) => l.hasBid);
            return (
              <React.Fragment key={b.bidderProfileId}>
                <tr className="border-b">
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => toggle(b.bidderProfileId)}
                    >
                      <div className="font-medium">{b.profile.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.profile.companyName ?? b.profile.user.email}
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    {b.mode === 'consolidated' ? (
                      <Badge variant="default">Consolidated</Badge>
                    ) : (
                      <Badge variant="secondary">Lot-level</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {inr.format(b.totalEmdHeld)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {b.lots.length}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {canMutate && b.mode === 'consolidated' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={anyBid}
                        title={
                          anyBid
                            ? 'Bidder has placed bids; cannot detach'
                            : 'Detach from auction'
                        }
                        onClick={() =>
                          setConfirmDetach({ kind: 'auction', bidder: b })
                        }
                      >
                        Detach
                      </Button>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b bg-muted/30">
                    <td colSpan={5} className="px-3 py-3">
                      <div className="space-y-2">
                        {b.lots.map((lot) => (
                          <div
                            key={lot.lotId}
                            className="flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-mono text-muted-foreground">
                                Lot {lot.lotNo}
                              </span>{' '}
                              <span className="font-medium">{lot.itemName}</span>
                              {' · '}
                              <span className="tabular-nums">
                                {lot.emdHeldAmount > 0
                                  ? `${inr.format(lot.emdHeldAmount)} held`
                                  : 'permission only (consolidated)'}
                              </span>
                              {lot.hasBid && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px]"
                                >
                                  has bid
                                </Badge>
                              )}
                            </div>
                            {canMutate && b.mode === 'lot' && (
                              <button
                                type="button"
                                className="text-destructive hover:underline disabled:opacity-50"
                                disabled={lot.hasBid}
                                title={
                                  lot.hasBid
                                    ? 'Bidder has placed bids on this lot; cannot detach'
                                    : 'Detach from lot'
                                }
                                onClick={() =>
                                  setConfirmDetach({ kind: 'lot', bidder: b, lot })
                                }
                              >
                                Detach
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <Dialog
        open={!!confirmDetach}
        onOpenChange={(o) => {
          if (!o) setConfirmDetach(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Detach{' '}
              {confirmDetach
                ? confirmDetach.kind === 'lot'
                  ? `from lot ${confirmDetach.lot?.lotNo}`
                  : 'from auction'
                : ''}
              ?
            </DialogTitle>
            <DialogDescription>
              {confirmDetach &&
                (confirmDetach.kind === 'lot'
                  ? 'The held EMD will be released back to the bidder.'
                  : 'The full consolidated EMD will be released back to the bidder, and all lot permissions will be removed.')}
            </DialogDescription>
          </DialogHeader>
          {(detachLot.error || detachAuction.error) && (
            <p className="text-sm text-destructive">
              {errMsg(detachLot.error ?? detachAuction.error)}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDetach(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmDetach) return;
                if (confirmDetach.kind === 'lot' && confirmDetach.lot) {
                  detachLot.mutate({
                    lotId: confirmDetach.lot.lotId,
                    bidderProfileId: confirmDetach.bidder.bidderProfileId,
                  });
                } else {
                  detachAuction.mutate(confirmDetach.bidder.bidderProfileId);
                }
              }}
              disabled={detachLot.isPending || detachAuction.isPending}
            >
              Detach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachDialog({
  auction,
  mode,
  onClose,
  onAttached,
}: {
  auction: AuctionDetail;
  mode: Mode;
  onClose: () => void;
  onAttached: () => void;
}) {
  const api = useApiClient();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<BidderSearchResult | null>(null);
  const [lotIds, setLotIds] = useState<Set<string>>(new Set());

  const results = useQuery({
    queryKey: ['admin', 'bidder-search', { q, excludeAttachedTo: auction.id }],
    queryFn: () => api.adminBidders.search({ q, excludeAttachedTo: auction.id }),
    enabled: q.trim().length > 0,
  });

  const attach = useMutation({
    mutationFn: () => {
      if (!picked) throw new Error('no bidder picked');
      if (mode === 'consolidated') {
        return api.adminAuctions.attachToConsolidated(auction.id, {
          bidderProfileIds: [picked.id],
        });
      }
      return api.adminAuctions.attachToLots(auction.id, {
        bidderProfileIds: [picked.id],
        lotIds: Array.from(lotIds),
      });
    },
    onSuccess: (result: AttachResult) => {
      if (result.failures.length > 0) {
        // Show failure to admin; don't close until they ack.
        return;
      }
      onAttached();
    },
  });

  const toggleLot = (lotId: string) => {
    setLotIds((prev) => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  const requiredAmount = useMemo(() => {
    if (mode === 'consolidated') return auction.consolidatedEmdAmount ?? 0;
    return auction.lots
      .filter((l) => lotIds.has(l.id))
      .reduce((s, l) => s + l.emdAmount, 0);
  }, [mode, auction, lotIds]);

  const availableBalance = picked?.wallet
    ? picked.wallet.balance - picked.wallet.lockedBalance
    : null;
  const insufficient =
    picked != null && availableBalance != null && availableBalance < requiredAmount;

  const result = attach.data as AttachResult | undefined;
  const submitDisabled =
    !picked ||
    (mode === 'lot' && lotIds.size === 0) ||
    attach.isPending ||
    insufficient;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Attach bidder</DialogTitle>
          <DialogDescription>
            {mode === 'consolidated' ? (
              <>
                Holds{' '}
                <strong>{inr.format(auction.consolidatedEmdAmount ?? 0)}</strong> from the
                bidder's wallet and allows them to bid on every lot in the auction.
              </>
            ) : (
              <>
                Pick lots — the lot's EMD will be held from the bidder's wallet for each.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bidder-search">Search approved bidders</Label>
            <Input
              id="bidder-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPicked(null);
              }}
              placeholder="Name, email, company, or phone…"
              autoFocus
            />
          </div>

          {q.trim().length > 0 && !picked && (
            <div className="max-h-48 overflow-y-auto rounded-md border">
              {results.isLoading && (
                <p className="p-3 text-xs text-muted-foreground">Searching…</p>
              )}
              {results.data && results.data.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">
                  No matching approved bidders (or all are already attached).
                </p>
              )}
              {results.data?.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPicked(r)}
                  className="block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                >
                  <div className="font-medium">{r.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.companyName ?? r.user.email}
                    {' · '}
                    Wallet:{' '}
                    {r.wallet
                      ? `${inr.format(r.wallet.balance - r.wallet.lockedBalance)} available`
                      : 'no wallet yet'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {picked && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{picked.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {picked.companyName ?? picked.user.email}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setPicked(null)}
                >
                  Change
                </button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Available balance:{' '}
                <span className={insufficient ? 'text-destructive' : ''}>
                  {availableBalance != null ? inr.format(availableBalance) : '—'}
                </span>
                {' · '}EMD required: {inr.format(requiredAmount)}
              </div>
            </div>
          )}

          {mode === 'lot' && picked && (
            <div className="space-y-2">
              <Label className="text-xs">Lots</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {auction.lots.map((l) => (
                  <label
                    key={l.id}
                    className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={lotIds.has(l.id)}
                      onCheckedChange={() => toggleLot(l.id)}
                    />
                    <span className="font-mono text-xs">Lot {l.lotNo}</span>
                    <span className="flex-1 truncate">{l.itemName}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      EMD {inr.format(l.emdAmount)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {result && result.failures.length > 0 && (
            <FailureList failures={result.failures} />
          )}
          {result && result.failures.length === 0 && result.created > 0 && (
            <p className="text-sm text-emerald-700">
              Attached {result.created} {result.created === 1 ? 'lot' : 'lots'}.
            </p>
          )}
          {attach.error && (
            <p className="text-sm text-destructive">{errMsg(attach.error)}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {result?.failures.length === 0 && result.created > 0 ? 'Close' : 'Cancel'}
          </Button>
          <Button
            type="button"
            disabled={submitDisabled}
            onClick={() => attach.mutate()}
          >
            {attach.isPending ? 'Attaching…' : 'Attach'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FailureList({ failures }: { failures: AttachFailure[] }) {
  return (
    <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
      {failures.map((f) => (
        <li key={f.bidderProfileId} className="text-destructive">
          {f.message}
        </li>
      ))}
    </ul>
  );
}

