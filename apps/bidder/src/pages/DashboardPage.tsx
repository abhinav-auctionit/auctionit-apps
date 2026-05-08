import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient, useAuth } from '@auction/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@auction/ui';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const formatRs = (rupees: number) => inr.format(rupees);

export function DashboardPage() {
  const api = useApiClient();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const wallet = useQuery({
    queryKey: ['bidder', 'me', 'wallet'],
    queryFn: () => api.bidder.getMyWallet(),
    enabled: !!user && user.role === 'bidder',
    retry: false,
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
            <h1 className="text-2xl font-semibold">Bidder dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user.name}{' '}
              <Badge variant="secondary" className="ml-1">
                {user.role}
              </Badge>
            </p>
          </div>
          <Button variant="outline" onClick={onLogout}>
            Log out
          </Button>
        </header>

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
    </main>
  );
}
