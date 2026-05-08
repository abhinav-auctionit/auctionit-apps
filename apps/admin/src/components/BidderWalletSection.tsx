import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, type WalletTransaction } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@auction/ui';

const errMsg = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Action failed';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const formatRs = (rupees: number) => inr.format(rupees);

const KIND_LABEL: Record<WalletTransaction['kind'], { label: string; isCredit: boolean }> = {
  admin_credit: { label: 'Admin credit', isCredit: true },
  admin_debit_correction: { label: 'Correction', isCredit: false },
  emd_debit: { label: 'EMD debit', isCredit: false },
  emd_refund: { label: 'EMD refund', isCredit: true },
  emd_forfeit: { label: 'EMD forfeit', isCredit: false },
};

export function BidderWalletSection({ profileId }: { profileId: string }) {
  const api = useApiClient();
  const qc = useQueryClient();

  const wallet = useQuery({
    queryKey: ['admin', 'bidder-wallet', profileId],
    queryFn: () => api.adminBidders.getWallet(profileId),
    enabled: !!profileId,
  });

  const txns = useQuery({
    queryKey: ['admin', 'bidder-wallet-txns', profileId],
    queryFn: () => api.adminBidders.listWalletTxns(profileId, { limit: 50 }),
    enabled: !!profileId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'bidder-wallet', profileId] });
    qc.invalidateQueries({ queryKey: ['admin', 'bidder-wallet-txns', profileId] });
  };

  const credit = useMutation({
    mutationFn: (input: { amount: number; note?: string }) =>
      api.adminBidders.creditWallet(profileId, input),
    onSuccess: invalidate,
  });
  const debit = useMutation({
    mutationFn: (input: { amount: number; note: string }) =>
      api.adminBidders.debitWallet(profileId, input),
    onSuccess: invalidate,
  });

  const [creditOpen, setCreditOpen] = useState(false);
  const [debitOpen, setDebitOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Wallet</CardTitle>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {wallet.data ? formatRs(wallet.data.balance) : '—'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {wallet.data
              ? `Currency: ${wallet.data.currency} · Updated ${new Date(wallet.data.updatedAt).toLocaleString()}`
              : 'Loading…'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setCreditOpen(true)}>
            + Credit
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDebitOpen(true)}>
            − Debit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <h4 className="mb-3 text-sm font-medium text-muted-foreground">Transaction history</h4>
        {txns.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {txns.error && (
          <p className="text-sm text-destructive">
            {txns.error instanceof ApiError ? txns.error.message : 'Failed to load transactions'}
          </p>
        )}
        {txns.data && txns.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        )}
        {txns.data && txns.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance after</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.data.map((t) => {
                const meta = KIND_LABEL[t.kind];
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.isCredit ? 'default' : 'secondary'}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        meta.isCredit ? '' : 'text-destructive'
                      }`}
                    >
                      {meta.isCredit ? '+' : '−'}
                      {formatRs(t.amount)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {formatRs(t.balanceAfter)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.createdBy?.name ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {t.note ?? '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AmountNoteDialog
        open={creditOpen}
        onOpenChange={setCreditOpen}
        title="Credit wallet"
        description="Record an offline payment received from the bidder. Amount is in whole rupees."
        noteLabel="Note (optional)"
        noteRequired={false}
        submitLabel={credit.isPending ? 'Saving…' : 'Credit'}
        busy={credit.isPending}
        error={errMsg(credit.error)}
        onSubmit={async ({ amount, note }) => {
          await credit.mutateAsync({ amount, note: note || undefined });
          setCreditOpen(false);
        }}
      />

      <AmountNoteDialog
        open={debitOpen}
        onOpenChange={setDebitOpen}
        title="Debit wallet (correction)"
        description="Use to correct an over-credit. Amount is in whole rupees. Reason is required."
        noteLabel="Reason (required)"
        noteRequired
        destructive
        submitLabel={debit.isPending ? 'Saving…' : 'Debit'}
        busy={debit.isPending}
        error={errMsg(debit.error)}
        onSubmit={async ({ amount, note }) => {
          await debit.mutateAsync({ amount, note });
          setDebitOpen(false);
        }}
      />
    </Card>
  );
}

function AmountNoteDialog({
  open,
  onOpenChange,
  title,
  description,
  noteLabel,
  noteRequired,
  destructive,
  submitLabel,
  busy,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  noteLabel: string;
  noteRequired: boolean;
  destructive?: boolean;
  submitLabel: string;
  busy: boolean;
  error?: string;
  onSubmit: (input: { amount: number; note: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  async function handle(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) return;
    if (noteRequired && note.trim().length === 0) return;
    await onSubmit({ amount: n, note: note.trim() });
    setAmount('');
    setNote('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setAmount('');
          setNote('');
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handle}>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">{noteLabel}</Label>
            <Textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required={noteRequired}
              placeholder="e.g., NEFT reference XYZ123 received 2026-05-07"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'default'}
              disabled={busy || !amount || (noteRequired && note.trim().length === 0)}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
