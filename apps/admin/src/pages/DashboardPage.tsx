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
            <h1 className="text-2xl font-semibold">Admin dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user.name} <Badge variant="secondary" className="ml-1">{user.role}</Badge>
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/users/new')}>Create user</Button>
            <Button variant="outline" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user.name.split(' ')[0]}</CardTitle>
            <CardDescription>Operational tools and data live here.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Hook this page up to your auctions, users, and audit data next.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
