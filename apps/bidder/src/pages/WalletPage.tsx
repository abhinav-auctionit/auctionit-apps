import { useQuery } from '@tanstack/react-query';
import { ApiError, type WalletTransaction } from '@auction/api-client';
import { useApiClient, useAuth } from '@auction/auth';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@auction/ui';
import { AppShell } from '../components/AppShell';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const formatRs = (rupees: number) => inr.format(rupees);

const KIND_LABEL: Record<WalletTransaction['kind'], { label: string; isCredit: boolean }> = {
  admin_credit: { label: 'Top-up', isCredit: true },
  admin_debit_correction: { label: 'Correction', isCredit: false },
  emd_hold: { label: 'EMD hold', isCredit: false },
  emd_release: { label: 'EMD release', isCredit: true },
  emd_forfeit: { label: 'EMD forfeit', isCredit: false },
};

export function WalletPage() {
  const api = useApiClient();
  const { user } = useAuth();

  const wallet = useQuery({
    queryKey: ['bidder', 'me', 'wallet'],
    queryFn: () => api.bidder.getMyWallet(),
    enabled: !!user,
  });

  const txns = useQuery({
    queryKey: ['bidder', 'me', 'wallet', 'txns'],
    queryFn: () => api.bidder.listMyWalletTxns({ limit: 100 }),
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">My wallet</h1>
          <p className="text-sm text-muted-foreground">
            Used as EMD when you're attached to a lot or auction. Top-ups are processed
            offline by the admin team.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">
                {wallet.data
                  ? formatRs(wallet.data.balance - wallet.data.lockedBalance)
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Spendable for new attachments.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Held as EMD</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">
                {wallet.data ? formatRs(wallet.data.lockedBalance) : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Locked against your active participations.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">
                {wallet.data ? formatRs(wallet.data.balance) : '—'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Available + Held. Forfeits reduce this; releases return Held to Available.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction history</CardTitle>
          </CardHeader>
          <CardContent>
            {txns.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {txns.error && (
              <p className="text-sm text-destructive">
                {txns.error instanceof ApiError ? txns.error.message : 'Failed to load'}
              </p>
            )}
            {txns.data && txns.data.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No transactions yet. Once you make your first top-up, it'll appear here.
              </p>
            )}
            {txns.data && txns.data.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
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
        </Card>
      </div>
    </AppShell>
  );
}
