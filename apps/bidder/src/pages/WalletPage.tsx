import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError, type WalletTransaction } from '@auction/api-client';
import { useApiClient, useAuth } from '@auction/auth';
import {
  Badge,
  Button,
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

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const formatRs = (rupees: number) => inr.format(rupees);

const KIND_LABEL: Record<WalletTransaction['kind'], { label: string; isCredit: boolean }> = {
  admin_credit: { label: 'Top-up', isCredit: true },
  admin_debit_correction: { label: 'Correction', isCredit: false },
  emd_debit: { label: 'EMD', isCredit: false },
  emd_refund: { label: 'EMD refund', isCredit: true },
  emd_forfeit: { label: 'EMD forfeit', isCredit: false },
};

export function WalletPage() {
  const api = useApiClient();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to dashboard
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">My wallet</h1>
          </div>
          <Button variant="outline" onClick={onLogout}>
            Log out
          </Button>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tracking-tight">
              {wallet.data ? formatRs(wallet.data.balance) : '—'}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Top-ups are recorded by the admin team after they receive your offline payment.
              EMD is deducted automatically when you join an auction and refunded when the
              auction ends if you don't win.
            </p>
          </CardContent>
        </Card>

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
    </main>
  );
}
