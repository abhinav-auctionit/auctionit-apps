import { useNavigate } from 'react-router-dom';
import { useAuth } from '@auction/auth';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@auction/ui';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
            <h1 className="text-2xl font-semibold">Seller dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user.name} <Badge variant="secondary" className="ml-1">{user.role}</Badge>
            </p>
          </div>
          <Button variant="outline" onClick={onLogout}>
            Log out
          </Button>
        </header>

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
    </main>
  );
}
