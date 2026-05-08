import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@auction/api-client';
import { useApiClient } from '@auction/auth';
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
import { AppShell } from '../components/AppShell';

export function ClientsPage() {
  const api = useApiClient();
  const list = useQuery({
    queryKey: ['admin', 'clients'],
    queryFn: () => api.adminClients.list(),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Clients</h1>
            <p className="text-sm text-muted-foreground">
              Onboard a new client (seller) and manage existing accounts.
            </p>
          </div>
          <Button asChild>
            <Link to="/clients/new">+ New client</Link>
          </Button>
        </div>

        {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {list.error && (
          <p className="text-sm text-destructive">
            {list.error instanceof ApiError ? list.error.message : 'Failed to load'}
          </p>
        )}

        {list.data && list.data.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No clients onboarded yet. Click <strong>+ New client</strong> to add one.
            </CardContent>
          </Card>
        )}

        {list.data && list.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{list.data.length} client(s)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Onboarded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.companyName}</div>
                        {c.websiteUrl && (
                          <div className="text-xs text-muted-foreground">{c.websiteUrl}</div>
                        )}
                      </TableCell>
                      <TableCell>{c.country}</TableCell>
                      <TableCell className="font-mono text-xs">{c.pan}</TableCell>
                      <TableCell>
                        {c.isActive ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
