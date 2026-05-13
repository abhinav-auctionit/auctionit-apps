import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type AuctionDetail, type Lot } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
import {
  uomSchema,
  type AuctionStatus,
  type CreateLotInput,
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
import { AuctionInvitationsSection } from '../components/AuctionInvitationsSection';

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

  const setStatus = useMutation({
    mutationFn: (status: AuctionStatus) => api.adminAuctions.update(id, { status }),
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
              {a.client.companyName} · {TYPE_LABEL[a.auctionType] ?? a.auctionType}
              {a.emdAmount > 0 ? ` · EMD ${inr.format(a.emdAmount)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <StatusActions
              status={a.status}
              hasLots={a.lots.length > 0}
              busy={setStatus.isPending}
              onChange={(s) => setStatus.mutate(s)}
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
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-2">
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

        <AuctionInvitationsSection
          auctionId={id}
          canInvite={a.status !== 'ended' && a.status !== 'cancelled'}
        />
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
  status,
  hasLots,
  busy,
  onChange,
}: {
  status: AuctionStatus;
  hasLots: boolean;
  busy: boolean;
  onChange: (s: AuctionStatus) => void;
}) {
  if (status === 'draft') {
    return (
      <>
        <Button
          size="sm"
          disabled={busy || !hasLots}
          onClick={() => onChange('scheduled')}
          title={hasLots ? '' : 'Add at least one lot first'}
        >
          Publish
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:bg-destructive/10"
          disabled={busy}
          onClick={() => onChange('cancelled')}
        >
          Cancel
        </Button>
      </>
    );
  }
  if (status === 'scheduled' || status === 'live') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        disabled={busy}
        onClick={() => onChange('cancelled')}
      >
        Cancel auction
      </Button>
    );
  }
  return null;
}

// -- Lot dialog ----------------------------------------------------------

type LotForm = {
  itemName: string;
  description: string;
  qty: string;
  uom: Uom;
  auctionDate: string;
  startTime: string;
  endTime: string;
  startingPriceRupees: string;
  bidIncrementRupees: string;
};

const initialLotForm = (): LotForm => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    itemName: '',
    description: '',
    qty: '',
    uom: 'MT',
    auctionDate: today,
    startTime: `${today}T10:00`,
    endTime: `${today}T11:00`,
    startingPriceRupees: '',
    bidIncrementRupees: '100',
  };
};

const lotToForm = (l: Lot): LotForm => ({
  itemName: l.itemName,
  description: l.description ?? '',
  qty: l.qty,
  uom: l.uom,
  auctionDate: l.auctionDate.slice(0, 10),
  startTime: toLocalDateTimeInput(l.startTime),
  endTime: toLocalDateTimeInput(l.endTime),
  startingPriceRupees: String(Math.round(l.startingPriceCents / 100)),
  bidIncrementRupees: String(Math.round(l.bidIncrementCents / 100)),
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
    const qty = Number(f.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be greater than 0');
      return;
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
    const startTime = new Date(f.startTime);
    const endTime = new Date(f.endTime);
    if (!(endTime > startTime)) {
      setError('End time must be after start time');
      return;
    }

    const payload: CreateLotInput = {
      itemName: f.itemName.trim(),
      description: f.description.trim() || null,
      qty,
      uom: f.uom,
      auctionDate: new Date(f.auctionDate),
      startTime,
      endTime,
      startingPriceCents: startCents,
      bidIncrementCents: incCents,
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
