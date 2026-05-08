import { useAuth } from '@auction/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@auction/ui';
import { AppShell } from '../components/AppShell';

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Seller dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user.name.split(' ')[0]}.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your auctions</CardTitle>
            <CardDescription>Items you&apos;ve listed and their live status.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No auctions yet. Create your first listing to get started.
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
