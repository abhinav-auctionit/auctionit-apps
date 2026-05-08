import { Link } from 'react-router-dom';
import { Button, Card, CardContent } from '@auction/ui';
import { AppShell } from '../components/AppShell';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-2xl"
              aria-hidden="true"
            >
              🚧
            </span>
            <p className="text-base font-medium">Coming soon</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              This area is still being built. Check back soon.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to="/">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
