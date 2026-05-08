import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient, useAuth } from '@auction/auth';
import {
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
const formatRs = (rupees: number) => inr.format(rupees);

export function DashboardPage() {
  const api = useApiClient();
  const { user } = useAuth();

  const wallet = useQuery({
    queryKey: ['bidder', 'me', 'wallet'],
    queryFn: () => api.bidder.getMyWallet(),
    enabled: !!user && user.role === 'bidder',
    retry: false,
  });

  if (!user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Bidder dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user.name.split(' ')[0]}.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wallet balance</CardTitle>
              <CardDescription>Used as EMD when you join auctions.</CardDescription>
            </CardHeader>
            <CardContent>
              {wallet.isLoading && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
              {wallet.error && (
                <p className="text-sm text-destructive">
                  {wallet.error instanceof ApiError
                    ? wallet.error.message
                    : 'Failed to load wallet'}
                </p>
              )}
              {wallet.data && (
                <>
                  <p className="text-3xl font-semibold tracking-tight">
                    {formatRs(wallet.data.balance)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    To top up, contact the admin team — payments are processed offline.
                  </p>
                </>
              )}
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/wallet">View transactions</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live auctions</CardTitle>
              <CardDescription>Browse open auctions and place bids.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              No live auctions to show yet.
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
