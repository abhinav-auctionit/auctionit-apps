import { Link } from 'react-router-dom';
import { useAuth } from '@auction/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@auction/ui';
import { AppShell } from '../components/AppShell';

const sections = [
  {
    title: 'Categories',
    description: 'Manage the 2-level category → subcategory hierarchy.',
    to: '/inventory/categories',
  },
  {
    title: 'Attributes',
    description: 'The reusable attribute library used across items.',
    to: '/inventory/attributes',
  },
  {
    title: 'Items',
    description: 'Catalog of sellable items, attached to a subcategory.',
    to: '/items',
  },
  {
    title: 'Create user',
    description: 'Invite an admin, client, or bidder.',
    to: '/users/new',
  },
];

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground">Pick where you want to work.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <Link key={section.to} to={section.to} className="group">
              <Card className="transition-colors group-hover:border-foreground/40">
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-primary">Open →</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
