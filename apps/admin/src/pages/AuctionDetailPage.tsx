import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type AuctionDetail, type Lot } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  uomSchema,
  type AttributeType,
  type AuctionStatus,
  type CreateLotInput,
  type LotAttributeValueInput,
  type Uom,
} from '@auction/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';
import { AuctionParticipantsSection } from '../components/AuctionParticipantsSection';

const UOMS = uomSchema.options;

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

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const formatRsFromCents = (cents: number) => inr.format(cents / 100);

export function AuctionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const api = useApiClient();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['admin', 'auction', id],
    queryFn: () => api.adminAuctions.get(id),
    enabled: !!id,
  });

  const [lotDialog, setLotDialog] = useState<{ mode: 'create' } | { mode: 'edit'; lot: Lot } | null>(
    null,
  );
  const [deleteLotId, setDeleteLotId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'auction', id] });

  // PATCH only handles draft↔scheduled↔live now; ended and cancelled have
  // dedicated endpoints (added in the EMD lifecycle plan) so EMDs are processed.
  const setStatus = useMutation({
    mutationFn: (status: 'draft' | 'scheduled' | 'live') =>
      api.adminAuctions.update(id, { status }),
    onSuccess: invalidate,
  });
  const deleteLot = useMutation({
    mutationFn: (lotId: string) => api.adminAuctions.deleteLot(id, lotId),
    onSuccess: () => {
      setDeleteLotId(null);
      invalidate();
    },
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
        <Link to="/auctions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to auctions
        </Link>
        <p className="mt-3 text-sm text-destructive">
          {detail.error instanceof ApiError ? detail.error.message : 'Failed to load auction'}
        </p>
      </AppShell>
    );
  }

  const a = detail.data;
  const badge = STATUS_BADGE[a.status];

  return (
    <AppShell>
      <div className="space-y-6">
        <Link to="/auctions" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to auctions
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{a.code}</p>
            <h1 className="mt-1 text-2xl font-semibold">{a.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {a.client.companyName}
              {a.location ? ` · ${a.location.name}` : ''} ·{' '}
              {TYPE_LABEL[a.auctionType] ?? a.auctionType}
              {a.consolidatedEmdAmount != null
                ? ` · Consolidated EMD ${inr.format(a.consolidatedEmdAmount)}`
                : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <StatusActions
              auctionId={a.id}
              status={a.status}
              hasLots={a.lots.length > 0}
              busy={setStatus.isPending}
              onPublish={() => setStatus.mutate('scheduled')}
            />
          </div>
        </div>

        {a.description && (
          <Card>
            <CardContent className="pt-6 text-sm leading-relaxed text-muted-foreground">
              {a.description}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Lots ({a.lots.length})</CardTitle>
            <Button size="sm" onClick={() => setLotDialog({ mode: 'create' })}>
              + Add lot
            </Button>
          </CardHeader>
          <CardContent>
            {a.lots.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No lots yet. Click <strong>+ Add lot</strong> to create the first one.
              </p>
            )}
            {a.lots.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Start</th>
                      <th className="px-3 py-2 text-left">End</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Start bid</th>
                      <th className="px-3 py-2 text-right">Incr.</th>
                      <th className="px-3 py-2 text-right">EMD</th>
                      {a.status === 'ended' && (
                        <th className="px-3 py-2 text-left">Outcome</th>
                      )}
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.lots.map((l) => (
                      <tr key={l.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 tabular-nums">{l.lotNo}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{l.itemName}</div>
                          {l.description && (
                            <div className="line-clamp-1 text-xs text-muted-foreground">
                              {l.description}
                            </div>
                          )}
                          <div className="mt-1">
                            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {l.microcategory.subcategory.category.name} ›{' '}
                              {l.microcategory.subcategory.name} ›{' '}
                              {l.microcategory.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(l.auctionDate).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {new Date(l.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {new Date(l.endTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                        <td className="px-3 py-2">{l.uom}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatRsFromCents(l.startingPriceCents)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatRsFromCents(l.bidIncrementCents)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {inr.format(l.emdAmount)}
                        </td>
                        {a.status === 'ended' && (
                          <td className="px-3 py-2">
                            <LotOutcomeCell auctionId={a.id} lot={l} />
                          </td>
                        )}
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-2">
                            {a.status !== 'ended' && a.status !== 'cancelled' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setLotDialog({ mode: 'edit', lot: l })}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteLotId(l.id)}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <AuctionParticipantsSection auction={a} />
      </div>

      {lotDialog && (
        <LotDialog
          auctionId={id}
          mode={lotDialog.mode}
          lot={lotDialog.mode === 'edit' ? lotDialog.lot : null}
          onClose={() => setLotDialog(null)}
          onSaved={() => {
            setLotDialog(null);
            invalidate();
          }}
        />
      )}

      <Dialog
        open={!!deleteLotId}
        onOpenChange={(o) => {
          if (!o) setDeleteLotId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete lot?</DialogTitle>
            <DialogDescription>
              This removes the lot permanently. It cannot be deleted once bids have been placed.
            </DialogDescription>
          </DialogHeader>
          {deleteLot.error && (
            <p className="text-sm text-destructive">
              {deleteLot.error instanceof ApiError
                ? deleteLot.error.message
                : 'Failed to delete'}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteLotId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteLotId && deleteLot.mutate(deleteLotId)}
              disabled={deleteLot.isPending}
            >
              {deleteLot.isPending ? 'Deleting…' : 'Delete lot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatusActions({
  auctionId,
  status,
  hasLots,
  busy,
  onPublish,
}: {
  auctionId: string;
  status: AuctionStatus;
  hasLots: boolean;
  busy: boolean;
  onPublish: () => void;
}) {
  const api = useApiClient();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'auction', auctionId] });
    qc.invalidateQueries({ queryKey: ['admin', 'auction', auctionId, 'participants'] });
  };
  const endAuction = useMutation({
    mutationFn: () => api.adminAuctions.end(auctionId),
    onSuccess: invalidate,
  });
  const cancelAuction = useMutation({
    mutationFn: () => api.adminAuctions.cancel(auctionId, { note: null }),
    onSuccess: invalidate,
  });

  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (status === 'draft') {
    return (
      <>
        <Button
          size="sm"
          disabled={busy || !hasLots}
          onClick={onPublish}
          title={hasLots ? '' : 'Add at least one lot first'}
        >
          Publish
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:bg-destructive/10"
          disabled={busy || cancelAuction.isPending}
          onClick={() => setConfirmCancel(true)}
        >
          Cancel
        </Button>
        <CancelDialog
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => cancelAuction.mutate()}
          pending={cancelAuction.isPending}
          error={cancelAuction.error}
        />
      </>
    );
  }
  if (status === 'scheduled' || status === 'live') {
    return (
      <>
        <Button
          size="sm"
          disabled={endAuction.isPending}
          onClick={() => setConfirmEnd(true)}
        >
          {endAuction.isPending ? 'Ending…' : 'End auction'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:bg-destructive/10"
          disabled={cancelAuction.isPending}
          onClick={() => setConfirmCancel(true)}
        >
          Cancel
        </Button>
        <EndDialog
          open={confirmEnd}
          onClose={() => setConfirmEnd(false)}
          onConfirm={() => endAuction.mutate()}
          pending={endAuction.isPending}
          error={endAuction.error}
        />
        <CancelDialog
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          onConfirm={() => cancelAuction.mutate()}
          pending={cancelAuction.isPending}
          error={cancelAuction.error}
        />
      </>
    );
  }
  return null;
}

function EndDialog({
  open,
  onClose,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: unknown;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End auction?</DialogTitle>
          <DialogDescription>
            Computes the winner of each lot from top bids and releases EMDs to
            non-winners. Lots with winners move to "pending lift". This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error != null && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.message : 'Failed to end auction'}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? 'Ending…' : 'End auction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onClose,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: unknown;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel auction?</DialogTitle>
          <DialogDescription>
            Releases every held EMD (lot-level and consolidated) back to bidders
            and marks the auction cancelled. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error != null && (
          <p className="text-sm text-destructive">
            {error instanceof ApiError ? error.message : 'Failed to cancel auction'}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Back
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'Cancelling…' : 'Cancel auction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const OUTCOME_LABEL: Record<string, { label: string; tone: string }> = {
  pending_lift: { label: 'Pending lift', tone: 'bg-amber-100 text-amber-800' },
  lifted: { label: 'Lifted', tone: 'bg-emerald-100 text-emerald-700' },
  forfeited: { label: 'Forfeited', tone: 'bg-rose-100 text-rose-700' },
  rejected_by_client: { label: 'Rejected', tone: 'bg-slate-200 text-slate-800' },
  no_winner: { label: 'No winner', tone: 'bg-muted text-muted-foreground' },
};

function LotOutcomeCell({ auctionId, lot }: { auctionId: string; lot: Lot }) {
  const api = useApiClient();
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'auction', auctionId] });
    qc.invalidateQueries({ queryKey: ['admin', 'auction', auctionId, 'participants'] });
  };
  const lift = useMutation({
    mutationFn: () => api.adminAuctions.markLotLifted(auctionId, lot.id, { note: null }),
    onSuccess: invalidate,
  });
  const forfeit = useMutation({
    mutationFn: () => api.adminAuctions.forfeitLot(auctionId, lot.id, { note: null }),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: () =>
      api.adminAuctions.rejectLotByClient(auctionId, lot.id, { note: null }),
    onSuccess: invalidate,
  });

  const status = lot.outcomeStatus ?? 'pending_lift';
  const meta = OUTCOME_LABEL[status] ?? { label: status, tone: 'bg-muted' };
  const busy = lift.isPending || forfeit.isPending || reject.isPending;
  const error = lift.error ?? forfeit.error ?? reject.error;
  const company = lot.winner?.bidderProfile?.companyName ?? null;

  return (
    <div className="space-y-1.5 min-w-[180px]">
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.tone}`}
      >
        {meta.label}
      </span>
      {lot.winner ? (
        <div className="text-xs leading-tight">
          <div className="font-medium text-foreground">{lot.winner.name}</div>
          {company && (
            <div className="text-[11px] text-muted-foreground">{company}</div>
          )}
          {lot.winningBidAmountCents !== null && (
            <div className="font-medium tabular-nums text-emerald-700">
              {formatRsFromCents(lot.winningBidAmountCents)}
            </div>
          )}
        </div>
      ) : status === 'no_winner' ? (
        <div className="text-[11px] italic text-muted-foreground">No bids placed</div>
      ) : null}
      {status === 'pending_lift' && (
        <div className="flex flex-wrap gap-1 text-[10px]">
          <button
            type="button"
            className="text-primary hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() => lift.mutate()}
          >
            Mark lifted
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="text-destructive hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() => forfeit.mutate()}
          >
            Forfeit
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="text-muted-foreground hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() => reject.mutate()}
          >
            Reject
          </button>
        </div>
      )}
      {error && (
        <p className="text-[11px] text-destructive">
          {error instanceof ApiError ? error.message : 'Action failed'}
        </p>
      )}
    </div>
  );
}

// -- Lot dialog ----------------------------------------------------------

type LotAttributeRow = {
  uid: string;
  attributeId: string | null;
  customName: string;
  attrName: string;
  attrType: AttributeType | null;
  attrUnit: string | null;
  valueText: string;
  valueNumber: string;
  valueOptionIds: string[];
};

type LotForm = {
  categoryId: string;
  subcategoryId: string;
  microcategoryId: string;
  itemName: string;
  description: string;
  qty: string;
  uom: Uom;
  hsnCode: string;
  benchmarkRupees: string;
  auctionDate: string;
  startTime: string;
  endTime: string;
  startingPriceRupees: string;
  bidIncrementRupees: string;
  emdRupees: string;
  attributeValues: LotAttributeRow[];
};

const initialLotForm = (): LotForm => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    categoryId: '',
    subcategoryId: '',
    microcategoryId: '',
    itemName: '',
    description: '',
    qty: '',
    uom: 'MT',
    hsnCode: '',
    benchmarkRupees: '',
    auctionDate: today,
    startTime: `${today}T10:00`,
    endTime: `${today}T11:00`,
    startingPriceRupees: '',
    bidIncrementRupees: '100',
    emdRupees: '0',
    attributeValues: [],
  };
};

const lotToForm = (l: Lot): LotForm => ({
  categoryId: l.microcategory.subcategory.category.id,
  subcategoryId: l.microcategory.subcategory.id,
  microcategoryId: l.microcategory.id,
  itemName: l.itemName,
  description: l.description ?? '',
  qty: l.qty,
  uom: l.uom,
  hsnCode: l.hsnCode,
  benchmarkRupees:
    l.benchmarkCents !== null ? String(Math.round(l.benchmarkCents / 100)) : '',
  auctionDate: l.auctionDate.slice(0, 10),
  startTime: toLocalDateTimeInput(l.startTime),
  endTime: toLocalDateTimeInput(l.endTime),
  startingPriceRupees: String(Math.round(l.startingPriceCents / 100)),
  bidIncrementRupees: String(Math.round(l.bidIncrementCents / 100)),
  emdRupees: String(l.emdAmount),
  attributeValues: l.attributeValues.map((av) => ({
    uid: av.id,
    attributeId: av.attributeId,
    customName: av.customName ?? '',
    attrName: av.attribute?.name ?? av.customName ?? '',
    attrType: av.attribute?.type ?? null,
    attrUnit: av.attribute?.unit ?? null,
    valueText: av.valueText ?? '',
    valueNumber: av.valueNumber ?? '',
    valueOptionIds: av.valueOptionIds ?? [],
  })),
});

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function LotDialog({
  auctionId,
  mode,
  lot,
  onClose,
  onSaved,
}: {
  auctionId: string;
  mode: 'create' | 'edit';
  lot: Lot | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const [f, setF] = useState<LotForm>(lot ? lotToForm(lot) : initialLotForm());
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof LotForm>(k: K, v: LotForm[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const categories = useQuery({
    queryKey: ['admin', 'categories-tree'],
    queryFn: () => api.inventory.listCategories(),
  });

  const attributes = useQuery({
    queryKey: ['admin', 'attributes'],
    queryFn: () => api.inventory.listAttributes(),
  });

  const create = useMutation({
    mutationFn: (input: CreateLotInput) => api.adminAuctions.addLot(auctionId, input),
    onSuccess: onSaved,
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to save lot'),
  });
  const update = useMutation({
    mutationFn: (input: CreateLotInput) =>
      api.adminAuctions.updateLot(auctionId, lot!.id, input),
    onSuccess: onSaved,
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to save lot'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.microcategoryId) {
      setError('Pick a category, subcategory and microcategory');
      return;
    }
    const qty = Number(f.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (!f.hsnCode.trim()) {
      setError('HSN code is required');
      return;
    }
    let benchmarkCents: number | null = null;
    if (f.benchmarkRupees.trim()) {
      const cents = Math.round(Number(f.benchmarkRupees) * 100);
      if (!Number.isFinite(cents) || cents < 0) {
        setError('Benchmark price must be a non-negative number');
        return;
      }
      benchmarkCents = cents;
    }
    const startCents = Math.round(Number(f.startingPriceRupees) * 100);
    const incCents = Math.round(Number(f.bidIncrementRupees) * 100);
    if (!Number.isInteger(startCents) || startCents < 0) {
      setError('Starting price must be a non-negative number');
      return;
    }
    if (!Number.isInteger(incCents) || incCents <= 0) {
      setError('Bid increment must be positive');
      return;
    }
    const emdAmount = Math.round(Number(f.emdRupees));
    if (!Number.isInteger(emdAmount) || emdAmount < 0) {
      setError('EMD must be a non-negative whole rupee amount');
      return;
    }
    const startTime = new Date(f.startTime);
    const endTime = new Date(f.endTime);
    if (!(endTime > startTime)) {
      setError('End time must be after start time');
      return;
    }

    let attributeValues: LotAttributeValueInput[];
    try {
      attributeValues = f.attributeValues.map(rowToAttributeValueInput);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid attribute value');
      return;
    }

    const payload: CreateLotInput = {
      microcategoryId: f.microcategoryId,
      itemName: f.itemName.trim(),
      description: f.description.trim() || null,
      qty,
      uom: f.uom,
      hsnCode: f.hsnCode.trim(),
      benchmarkCents,
      auctionDate: new Date(f.auctionDate),
      startTime,
      endTime,
      startingPriceCents: startCents,
      bidIncrementCents: incCents,
      emdAmount,
      attributeValues,
    };

    if (mode === 'create') create.mutate(payload);
    else update.mutate(payload);
  }

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add lot' : `Edit lot ${lot?.lotNo}`}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Lot number is assigned automatically.'
              : 'Editing applies to draft and scheduled auctions only.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <MicrocategoryPicker
            categories={categories.data ?? []}
            categoryId={f.categoryId}
            subcategoryId={f.subcategoryId}
            microcategoryId={f.microcategoryId}
            onCategoryChange={(id) => {
              set('categoryId', id);
              set('subcategoryId', '');
              set('microcategoryId', '');
            }}
            onSubcategoryChange={(id) => {
              set('subcategoryId', id);
              set('microcategoryId', '');
            }}
            onMicrocategoryChange={(id) => set('microcategoryId', id)}
          />

          <div className="space-y-2">
            <Label htmlFor="itemName">
              Item name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="itemName"
              value={f.itemName}
              onChange={(e) => set('itemName', e.target.value)}
              maxLength={255}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={f.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={4000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="qty">
                Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="qty"
                type="number"
                step="0.0001"
                min={0}
                value={f.qty}
                onChange={(e) => set('qty', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uom">Unit</Label>
              <Select value={f.uom} onValueChange={(v) => set('uom', v as Uom)}>
                <SelectTrigger id="uom">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UOMS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="auctionDate">
                Auction date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="auctionDate"
                type="date"
                value={f.auctionDate}
                onChange={(e) => set('auctionDate', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">
                Start <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={f.startTime}
                onChange={(e) => set('startTime', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">
                End <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={f.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startBid">
                Starting bid (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startBid"
                type="number"
                min={0}
                step="0.01"
                value={f.startingPriceRupees}
                onChange={(e) => set('startingPriceRupees', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bidInc">
                Bid increment (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bidInc"
                type="number"
                min={0}
                step="0.01"
                value={f.bidIncrementRupees}
                onChange={(e) => set('bidIncrementRupees', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hsnCode">
                HSN code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="hsnCode"
                value={f.hsnCode}
                onChange={(e) => set('hsnCode', e.target.value)}
                maxLength={32}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="benchmark">Benchmark price (₹)</Label>
              <Input
                id="benchmark"
                type="number"
                min={0}
                step="0.01"
                value={f.benchmarkRupees}
                onChange={(e) => set('benchmarkRupees', e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <AttributeValuesEditor
            attributes={attributes.data ?? []}
            values={f.attributeValues}
            onChange={(next) => set('attributeValues', next)}
          />

          <div className="space-y-2">
            <Label htmlFor="lotEmd">
              Lot EMD (₹) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lotEmd"
              type="number"
              min={0}
              step={1}
              value={f.emdRupees}
              onChange={(e) => set('emdRupees', e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Held from the bidder's wallet when an admin attaches them to this lot.
              Released if they don't win, kept until lifting if they do, forfeited if
              they fail to lift.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : mode === 'create' ? 'Add lot' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Used to give TypeScript a hint about the AuctionDetail type we operate on.
export type _AuctionDetailFromApi = AuctionDetail;

// -- Microcategory picker ----------------------------------------------------

type CategoryTreeNode = {
  id: string;
  name: string;
  subcategories: {
    id: string;
    name: string;
    microcategories: { id: string; name: string }[];
  }[];
};

function MicrocategoryPicker({
  categories,
  categoryId,
  subcategoryId,
  microcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  onMicrocategoryChange,
}: {
  categories: CategoryTreeNode[];
  categoryId: string;
  subcategoryId: string;
  microcategoryId: string;
  onCategoryChange: (id: string) => void;
  onSubcategoryChange: (id: string) => void;
  onMicrocategoryChange: (id: string) => void;
}) {
  const subOptions = categories.find((c) => c.id === categoryId)?.subcategories ?? [];
  const microOptions = subOptions.find((s) => s.id === subcategoryId)?.microcategories ?? [];

  return (
    <div className="space-y-2">
      <Label>
        Category <span className="text-destructive">*</span>
      </Label>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={categoryId} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={subcategoryId}
          onValueChange={onSubcategoryChange}
          disabled={!categoryId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                !categoryId
                  ? 'Pick a category first'
                  : subOptions.length === 0
                    ? 'No subcategories'
                    : 'Subcategory'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {subOptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={microcategoryId}
          onValueChange={onMicrocategoryChange}
          disabled={!subcategoryId}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                !subcategoryId
                  ? 'Pick a subcategory first'
                  : microOptions.length === 0
                    ? 'No microcategories'
                    : 'Microcategory'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {microOptions.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// -- Attribute values editor -------------------------------------------------

type AttributeOption = { id: string; value: string; position: number; attributeId: string };

type AttributeLibraryEntry = {
  id: string;
  name: string;
  type: AttributeType;
  unit: string | null;
  options: AttributeOption[];
};

function AttributeValuesEditor({
  attributes,
  values,
  onChange,
}: {
  attributes: AttributeLibraryEntry[];
  values: LotAttributeRow[];
  onChange: (next: LotAttributeRow[]) => void;
}) {
  const usedIds = new Set(values.map((v) => v.attributeId).filter(Boolean) as string[]);
  const availableAttrs = attributes.filter((a) => !usedIds.has(a.id));

  function addFromLibrary(attrId: string) {
    const attr = attributes.find((a) => a.id === attrId);
    if (!attr) return;
    onChange([
      ...values,
      {
        uid: crypto.randomUUID(),
        attributeId: attr.id,
        customName: '',
        attrName: attr.name,
        attrType: attr.type,
        attrUnit: attr.unit,
        valueText: '',
        valueNumber: '',
        valueOptionIds: [],
      },
    ]);
  }

  function addCustom() {
    onChange([
      ...values,
      {
        uid: crypto.randomUUID(),
        attributeId: null,
        customName: '',
        attrName: '',
        attrType: null,
        attrUnit: null,
        valueText: '',
        valueNumber: '',
        valueOptionIds: [],
      },
    ]);
  }

  function updateRow(uid: string, patch: Partial<LotAttributeRow>) {
    onChange(values.map((v) => (v.uid === uid ? { ...v, ...patch } : v)));
  }

  function removeRow(uid: string) {
    onChange(values.filter((v) => v.uid !== uid));
  }

  const ADD_CUSTOM = '__add_custom__';

  return (
    <div className="space-y-2">
      <Label>Attributes</Label>
      <p className="text-xs text-muted-foreground">
        Capture lot-specific specs. Pick from the attribute library or add a custom one.
      </p>
      {values.length > 0 && (
        <div className="space-y-2 rounded-md border p-3">
          {values.map((row) => (
            <AttributeRow
              key={row.uid}
              row={row}
              attribute={
                row.attributeId
                  ? attributes.find((a) => a.id === row.attributeId) ?? null
                  : null
              }
              onChange={(patch) => updateRow(row.uid, patch)}
              onRemove={() => removeRow(row.uid)}
            />
          ))}
        </div>
      )}
      <Select
        value=""
        onValueChange={(v) => {
          if (v === ADD_CUSTOM) addCustom();
          else addFromLibrary(v);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="+ Add attribute" />
        </SelectTrigger>
        <SelectContent>
          {availableAttrs.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
              {a.unit ? ` (${a.unit})` : ''}
            </SelectItem>
          ))}
          <SelectItem value={ADD_CUSTOM}>+ Custom attribute…</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function AttributeRow({
  row,
  attribute,
  onChange,
  onRemove,
}: {
  row: LotAttributeRow;
  attribute: AttributeLibraryEntry | null;
  onChange: (patch: Partial<LotAttributeRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-start">
      <div>
        {row.attributeId ? (
          <div className="px-2 py-1.5 text-sm font-medium">
            {row.attrName}
            {row.attrUnit ? (
              <span className="ml-1 text-xs text-muted-foreground">({row.attrUnit})</span>
            ) : null}
          </div>
        ) : (
          <Input
            value={row.customName}
            onChange={(e) => onChange({ customName: e.target.value, attrName: e.target.value })}
            placeholder="Attribute name"
          />
        )}
      </div>
      <div>
        <AttributeValueInput row={row} attribute={attribute} onChange={onChange} />
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive hover:bg-destructive/10"
        onClick={onRemove}
      >
        Remove
      </Button>
    </div>
  );
}

function AttributeValueInput({
  row,
  attribute,
  onChange,
}: {
  row: LotAttributeRow;
  attribute: AttributeLibraryEntry | null;
  onChange: (patch: Partial<LotAttributeRow>) => void;
}) {
  // Custom attribute or text/number library attribute → free-form text/number.
  if (!attribute || attribute.type === 'text') {
    return (
      <Input
        value={row.valueText}
        onChange={(e) => onChange({ valueText: e.target.value })}
        placeholder="Value"
      />
    );
  }
  if (attribute.type === 'number') {
    return (
      <Input
        type="number"
        step="any"
        value={row.valueNumber}
        onChange={(e) => onChange({ valueNumber: e.target.value })}
        placeholder="Value"
      />
    );
  }
  if (attribute.type === 'single_select') {
    const current = row.valueOptionIds[0] ?? '';
    return (
      <Select
        value={current}
        onValueChange={(v) => onChange({ valueOptionIds: [v] })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Pick an option" />
        </SelectTrigger>
        <SelectContent>
          {attribute.options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  // multi_select — render a list of checkboxes
  return (
    <div className="flex flex-wrap gap-2">
      {attribute.options.map((o) => {
        const checked = row.valueOptionIds.includes(o.id);
        return (
          <label
            key={o.id}
            className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${
              checked ? 'bg-foreground text-background' : 'bg-background'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...row.valueOptionIds, o.id]
                  : row.valueOptionIds.filter((id) => id !== o.id);
                onChange({ valueOptionIds: next });
              }}
            />
            {o.value}
          </label>
        );
      })}
    </div>
  );
}

function rowToAttributeValueInput(row: LotAttributeRow): LotAttributeValueInput {
  const base = row.attributeId
    ? { attributeId: row.attributeId }
    : { customName: row.customName.trim() };
  if (!row.attributeId && !row.customName.trim()) {
    throw new Error('Custom attribute needs a name');
  }
  if (!row.attrType || row.attrType === 'text') {
    if (!row.valueText.trim()) throw new Error(`Attribute "${row.attrName}" needs a value`);
    return { ...base, valueText: row.valueText.trim() };
  }
  if (row.attrType === 'number') {
    const n = Number(row.valueNumber);
    if (!Number.isFinite(n)) throw new Error(`Attribute "${row.attrName}" needs a numeric value`);
    return { ...base, valueNumber: n };
  }
  if (!row.valueOptionIds.length) {
    throw new Error(`Attribute "${row.attrName}" needs a selection`);
  }
  return { ...base, valueOptionIds: row.valueOptionIds };
}
